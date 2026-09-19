"use server";

import { revalidatePath } from "next/cache";
import { logYaz } from "@/lib/log";
import { oturumAc } from "@/lib/oturum";
import { prisma } from "@/lib/prisma";
import { LOG_ISLEM, type Rol } from "@/lib/sabitler";
import { sifreDogrula, sifreHashle } from "@/lib/sifre";
import { YetkiHatasi, oturumZorunlu } from "@/lib/yetki";

export type SifreDurumu = { hata?: string; basari?: string };

/** Yeni şifrenin taşıması gereken asgari nitelik. */
const EN_AZ_UZUNLUK = 8;

/**
 * Kullanıcının kendi şifresini değiştirmesi.
 *
 * Mevcut şifre sorulur: çerezi ele geçiren biri şifreyi değiştirip hesabı
 * kalıcı olarak alamasın. Değişimde `oturumSurumu` artırılır — başka cihazlarda
 * açık kalan oturumlar kapanır, bu cihazın çerezi yeni sürümle tazelenir.
 */
export async function kendiSifreniDegistir(
  _onceki: SifreDurumu,
  form: FormData,
): Promise<SifreDurumu> {
  try {
    const oturum = await oturumZorunlu();

    const mevcutSifre = String(form.get("mevcutSifre") ?? "");
    const yeniSifre = String(form.get("yeniSifre") ?? "");
    const yeniSifreTekrar = String(form.get("yeniSifreTekrar") ?? "");

    if (!mevcutSifre) return { hata: "Mevcut şifrenizi girin." };
    if (yeniSifre.length < EN_AZ_UZUNLUK) {
      return { hata: `Yeni şifre en az ${EN_AZ_UZUNLUK} karakter olmalı.` };
    }
    if (yeniSifre !== yeniSifreTekrar) return { hata: "Yeni şifre tekrarı uyuşmuyor." };
    if (yeniSifre === mevcutSifre) return { hata: "Yeni şifre eskisiyle aynı olamaz." };

    const kullanici = await prisma.kullanici.findUnique({
      where: { id: oturum.kullaniciId },
      select: {
        id: true,
        kullaniciAdi: true,
        adSoyad: true,
        rol: true,
        magazaId: true,
        sifreHash: true,
        magaza: { select: { ad: true } },
      },
    });
    if (!kullanici) return { hata: "Kullanıcı bulunamadı." };

    if (!(await sifreDogrula(mevcutSifre, kullanici.sifreHash))) {
      return { hata: "Mevcut şifre hatalı." };
    }

    const guncel = await prisma.kullanici.update({
      where: { id: kullanici.id },
      data: {
        sifreHash: await sifreHashle(yeniSifre),
        oturumSurumu: { increment: 1 },
      },
      select: { oturumSurumu: true },
    });

    // Bu cihazın çerezi yeni sürümle tazelenir; diğer oturumlar geçersiz kalır.
    await oturumAc({
      kullaniciId: kullanici.id,
      kullaniciAdi: kullanici.kullaniciAdi,
      adSoyad: kullanici.adSoyad,
      rol: kullanici.rol as Rol,
      magazaId: kullanici.magazaId,
      magazaAdi: kullanici.magaza?.ad ?? null,
      oturumSurumu: guncel.oturumSurumu,
    });

    await logYaz(oturum, {
      islem: LOG_ISLEM.SIFRE_DEGISTIR,
      hedefTip: "Kullanici",
      hedefId: kullanici.id,
      detay: "Kullanıcı kendi şifresini değiştirdi",
    });

    revalidatePath("/profil");
    return { basari: "Şifreniz değiştirildi. Diğer cihazlardaki oturumlar kapatıldı." };
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message };
    console.error("Şifre değiştirilemedi:", hata);
    return { hata: "Şifre değiştirilemedi. Lütfen tekrar deneyin." };
  }
}
