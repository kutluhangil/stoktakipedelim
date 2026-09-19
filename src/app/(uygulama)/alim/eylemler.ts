"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { logYaz } from "@/lib/log";
import { aramaMetniUret, kodNormalize } from "@/lib/metin";
import { prisma } from "@/lib/prisma";
import { HAREKET_TIP, LOG_ISLEM, ODEME_TIPI, STOK_DURUM } from "@/lib/sabitler";
import { YetkiHatasi, ikinciElZorunlu, magazaIslemiZorunlu } from "@/lib/yetki";

const alimSemasi = z
  .object({
    magazaId: z.number().int().positive("Depo seçin."),
    kategoriId: z.number().int().positive("Kategori seçin."),
    altKategoriId: z.number().int().positive().nullable(),
    marka: z.string().trim().min(1, "Marka zorunlu.").max(60),
    model: z.string().trim().min(1, "Model zorunlu.").max(80),
    renk: z.string().trim().max(40).nullable(),
    kapasite: z.string().trim().max(40).nullable(),
    seriNo: z.string().trim().max(40).nullable(),
    barkod: z.string().trim().max(40).nullable(),
    alisFiyatiKurus: z
      .number()
      .int("Alış fiyatı geçersiz.")
      .min(1, "Alış fiyatı sıfırdan büyük olmalı.")
      .max(1_000_000_00_00, "Alış fiyatı çok yüksek."),
    odemeTipi: z.enum(Object.values(ODEME_TIPI) as [string, ...string[]], "Ödeme tipi seçin."),
    alimTarihi: z.coerce.date({ message: "Alım tarihi geçersiz." }),
    musteriId: z.number().int().positive().nullable(),
    musteriAdSoyad: z.string().trim().max(80).nullable(),
    musteriTelefon: z.string().trim().max(30).nullable(),
    musteriTcknVkn: z.string().trim().max(20).nullable(),
    musteriAdres: z.string().trim().max(200).nullable(),
    not: z.string().trim().max(300).nullable(),
  })
  .refine((v) => v.musteriId !== null || (v.musteriAdSoyad ?? "").length > 0, {
    message: "Satıcıyı seçin veya ad soyad girin.",
    path: ["musteriAdSoyad"],
  });

export type AlimDurumu = { hata?: string };

/**
 * Tezgâhtan ikinci el cihaz alır ve doğrudan stok kalemi oluşturur.
 *
 * Alış faturası akışından ayrı: ikinci elde tedarikçi ve fatura yok, bu yüzden
 * `alisFaturasiId` ve `tedarikciId` boş kalır — vade raporuna da girmez.
 * Kimden alındığı `IkinciElAlim` kaydında durur; `StokKalemi.musteriId` satış
 * alıcısına ayrılmıştır, satıcıyla karıştırılmaz.
 */
export async function ikinciElAl(_onceki: AlimDurumu, form: FormData): Promise<AlimDurumu> {
  let cihazId: number;

  try {
    const oturum = await ikinciElZorunlu();

    let cozulen: unknown;
    try {
      cozulen = JSON.parse(String(form.get("veri") ?? ""));
    } catch {
      return { hata: "Form verisi okunamadı. Sayfayı yenileyip tekrar deneyin." };
    }

    const sonuc = alimSemasi.safeParse(cozulen);
    if (!sonuc.success) return { hata: sonuc.error.issues[0].message };
    const veri = sonuc.data;

    magazaIslemiZorunlu(oturum, veri.magazaId);

    const kategori = await prisma.kategori.findUnique({
      where: { id: veri.kategoriId },
      select: { ad: true, seriNoZorunlu: true },
    });
    if (!kategori) return { hata: "Kategori bulunamadı." };

    const seriNo = kodNormalize(veri.seriNo) || null;
    const barkod = kodNormalize(veri.barkod) || null;

    if (kategori.seriNoZorunlu && !seriNo) {
      return { hata: `${kategori.ad} için seri no (IMEI) zorunludur.` };
    }

    if (seriNo) {
      const cakisan = await prisma.stokKalemi.findFirst({
        where: { seriNo },
        select: { id: true, durum: true },
      });
      if (cakisan) {
        return { hata: `${seriNo} sistemde zaten kayıtlı (#${cakisan.id}, ${cakisan.durum}).` };
      }
    }

    if (veri.altKategoriId) {
      const altKategori = await prisma.altKategori.findUnique({
        where: { id: veri.altKategoriId },
        select: { kategoriId: true },
      });
      if (!altKategori || altKategori.kategoriId !== veri.kategoriId) {
        return { hata: "Alt kategori seçilen kategoriye ait değil." };
      }
    }

    const alim = await prisma.$transaction(async (tx) => {
      let musteriId = veri.musteriId;

      if (musteriId) {
        const varMi = await tx.musteri.findUnique({ where: { id: musteriId }, select: { id: true } });
        if (!varMi) throw new Error("Seçilen satıcı bulunamadı.");
      } else {
        // Aynı telefonla kayıtlı kişi varsa tekrar oluşturma (satış akışıyla aynı kural).
        const telefon = veri.musteriTelefon?.replace(/\s/g, "") || null;
        const mevcut = telefon
          ? await tx.musteri.findFirst({ where: { telefon }, select: { id: true } })
          : null;

        if (mevcut) {
          musteriId = mevcut.id;
        } else {
          const yeni = await tx.musteri.create({
            data: {
              adSoyad: veri.musteriAdSoyad ?? "İsimsiz Satıcı",
              telefon,
              tcknVkn: veri.musteriTcknVkn,
              adres: veri.musteriAdres,
            },
          });
          musteriId = yeni.id;
        }
      }

      const musteri = await tx.musteri.findUniqueOrThrow({
        where: { id: musteriId },
        select: { adSoyad: true, telefon: true },
      });

      const kalem = await tx.stokKalemi.create({
        data: {
          barkod,
          seriNo,
          kategoriId: veri.kategoriId,
          altKategoriId: veri.altKategoriId,
          marka: veri.marka,
          model: veri.model,
          renk: veri.renk,
          kapasite: veri.kapasite,
          alisFiyatiKurus: veri.alisFiyatiKurus,
          girisTarihi: veri.alimTarihi,
          magazaId: veri.magazaId,
          durum: STOK_DURUM.STOKTA,
          not: veri.not,
          aramaMetni: aramaMetniUret([
            veri.marka,
            veri.model,
            veri.renk,
            veri.kapasite,
            seriNo,
            barkod,
            veri.not,
            musteri.adSoyad,
            musteri.telefon,
          ]),
        },
      });

      await tx.ikinciElAlim.create({
        data: {
          stokKalemiId: kalem.id,
          musteriId,
          magazaId: veri.magazaId,
          alisFiyatiKurus: veri.alisFiyatiKurus,
          odemeTipi: veri.odemeTipi,
          alimTarihi: veri.alimTarihi,
          not: veri.not,
          alanKullaniciId: oturum.kullaniciId,
        },
      });

      await tx.stokHareketi.create({
        data: {
          stokKalemiId: kalem.id,
          tip: HAREKET_TIP.GIRIS,
          hedefMagazaId: veri.magazaId,
          kullaniciId: oturum.kullaniciId,
          aciklama: `İkinci el alım · ${musteri.adSoyad}`,
          tarih: veri.alimTarihi,
        },
      });

      return { kalem, musteriAdi: musteri.adSoyad };
    });

    await logYaz(oturum, {
      islem: LOG_ISLEM.STOK_EKLE,
      hedefTip: "StokKalemi",
      hedefId: alim.kalem.id,
      detay: `İkinci el alım · ${veri.marka} ${veri.model}${
        seriNo ? ` (${seriNo})` : ""
      } · ${alim.musteriAdi}`,
    });

    revalidatePath("/cihazlar");
    revalidatePath("/panel");
    revalidatePath("/musteriler");
    revalidatePath("/rapor");
    cihazId = alim.kalem.id;
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message };
    if (hata instanceof Error && hata.message) return { hata: hata.message };
    console.error("İkinci el alım kaydedilemedi:", hata);
    return { hata: "Alım kaydedilemedi. Lütfen tekrar deneyin." };
  }

  redirect(`/cihazlar/${cihazId}`);
}
