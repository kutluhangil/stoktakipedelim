"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logYaz } from "@/lib/log";
import { aramaMetniUret } from "@/lib/metin";
import { prisma } from "@/lib/prisma";
import { LOG_ISLEM } from "@/lib/sabitler";
import { YetkiHatasi, adminZorunlu, musteriZorunlu } from "@/lib/yetki";

export type MusteriDurumu = { hata?: string; basari?: string };

const musteriSemasi = z.object({
  id: z.number().int().positive("Müşteri bulunamadı."),
  adSoyad: z.string().trim().min(2, "Ad soyad en az 2 karakter olmalı.").max(80),
  telefon: z.string().trim().max(30).nullable(),
  tcknVkn: z.string().trim().max(20).nullable(),
  adres: z.string().trim().max(200).nullable(),
  not: z.string().trim().max(300).nullable(),
});

/**
 * Müşterinin satın aldığı cihazların arama metnini tazeler.
 *
 * `StokKalemi.aramaMetni` satış anında müşteri adı ve telefonunu da içerir;
 * kayıt düzeltilince eski ad arama kutusunda bulunmaya devam ederdi.
 */
async function aramaMetinleriniTazele(musteriId: number) {
  const cihazlar = await prisma.stokKalemi.findMany({
    where: { musteriId },
    include: { tedarikci: { select: { ad: true } }, musteri: { select: { adSoyad: true, telefon: true } } },
  });

  for (const c of cihazlar) {
    await prisma.stokKalemi.update({
      where: { id: c.id },
      data: {
        aramaMetni: aramaMetniUret([
          c.marka,
          c.model,
          c.renk,
          c.kapasite,
          c.seriNo,
          c.barkod,
          c.tedarikci?.ad,
          c.not,
          c.musteri?.adSoyad,
          c.musteri?.telefon,
        ]),
      },
    });
  }
}

/** Müşteri künyesini düzeltir (yönetici ve mağaza sorumlusu). */
export async function musteriDuzenle(
  _onceki: MusteriDurumu,
  form: FormData,
): Promise<MusteriDurumu> {
  try {
    const oturum = await musteriZorunlu();

    const sonuc = musteriSemasi.safeParse({
      id: Number(form.get("id")),
      adSoyad: String(form.get("adSoyad") ?? ""),
      telefon: String(form.get("telefon") ?? "").trim() || null,
      tcknVkn: String(form.get("tcknVkn") ?? "").trim() || null,
      adres: String(form.get("adres") ?? "").trim() || null,
      not: String(form.get("not") ?? "").trim() || null,
    });
    if (!sonuc.success) return { hata: sonuc.error.issues[0].message };
    const veri = sonuc.data;

    const mevcut = await prisma.musteri.findUnique({ where: { id: veri.id } });
    if (!mevcut) return { hata: "Müşteri bulunamadı." };

    const telefon = veri.telefon?.replace(/\s/g, "") || null;

    // Aynı telefon başka bir müşteride olamaz: satış akışı telefonu tekil kabul
    // edip mevcut kayda bağlanıyor, çift kayıt bu varsayımı bozar.
    if (telefon) {
      const cakisan = await prisma.musteri.findFirst({
        where: { telefon, id: { not: veri.id } },
        select: { id: true, adSoyad: true },
      });
      if (cakisan) {
        return { hata: `${telefon} numarası ${cakisan.adSoyad} kaydında (#${cakisan.id}).` };
      }
    }

    await prisma.musteri.update({
      where: { id: veri.id },
      data: {
        adSoyad: veri.adSoyad,
        telefon,
        tcknVkn: veri.tcknVkn,
        adres: veri.adres,
        not: veri.not,
      },
    });

    await aramaMetinleriniTazele(veri.id);

    await logYaz(oturum, {
      islem: LOG_ISLEM.MUSTERI_DUZENLE,
      hedefTip: "Musteri",
      hedefId: veri.id,
      detay: `${mevcut.adSoyad} → ${veri.adSoyad}`,
    });

    revalidatePath("/musteriler");
    revalidatePath("/cihazlar");
    return { basari: "Müşteri kaydı güncellendi." };
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message };
    console.error("Müşteri düzenlenemedi:", hata);
    return { hata: "Müşteri düzenlenemedi. Lütfen tekrar deneyin." };
  }
}

/**
 * KVKK silme hakkı (yalnız yönetici).
 *
 * Hiçbir işleme bağlı olmayan kayıt tamamen silinir. Satış, iade veya ikinci el
 * alımı olan müşteri silinemez — ticari kayıt ve fatura izi kopardı; bunun yerine
 * kimlik bilgileri temizlenip kayıt anonimleştirilir.
 */
export async function musteriSil(_onceki: MusteriDurumu, form: FormData): Promise<MusteriDurumu> {
  try {
    const oturum = await adminZorunlu();

    const id = Number(form.get("id"));
    if (!Number.isInteger(id) || id <= 0) return { hata: "Müşteri bulunamadı." };

    const musteri = await prisma.musteri.findUnique({
      where: { id },
      select: {
        id: true,
        adSoyad: true,
        _count: { select: { satinAlinanlar: true, iadeler: true, sattiklari: true } },
      },
    });
    if (!musteri) return { hata: "Müşteri bulunamadı." };

    const bagliKayit =
      musteri._count.satinAlinanlar + musteri._count.iadeler + musteri._count.sattiklari;

    if (bagliKayit === 0) {
      await prisma.musteri.delete({ where: { id } });
      await logYaz(oturum, {
        islem: LOG_ISLEM.MUSTERI_SIL,
        hedefTip: "Musteri",
        hedefId: id,
        detay: `${musteri.adSoyad} kaydı silindi (bağlı işlem yok)`,
      });
      revalidatePath("/musteriler");
      return { basari: "Müşteri kaydı tamamen silindi." };
    }

    await prisma.musteri.update({
      where: { id },
      data: {
        adSoyad: `Silinmiş Müşteri #${id}`,
        telefon: null,
        tcknVkn: null,
        adres: null,
        not: "KVKK talebiyle anonimleştirildi.",
      },
    });

    await aramaMetinleriniTazele(id);

    await logYaz(oturum, {
      islem: LOG_ISLEM.MUSTERI_SIL,
      hedefTip: "Musteri",
      hedefId: id,
      detay: `${musteri.adSoyad} anonimleştirildi (${bagliKayit} bağlı işlem korundu)`,
    });

    revalidatePath("/musteriler");
    revalidatePath("/cihazlar");
    return {
      basari: `Kimlik bilgileri silindi. ${bagliKayit} işlem kaydı ticari zorunluluk gereği korundu.`,
    };
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message };
    console.error("Müşteri silinemedi:", hata);
    return { hata: "Müşteri silinemedi. Lütfen tekrar deneyin." };
  }
}
