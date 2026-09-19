"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { sifreDogrula } from "@/lib/sifre";
import { oturumAc, oturumKapat, oturumuOku } from "@/lib/oturum";
import { istemciIp, logYaz } from "@/lib/log";
import {
  IP_DENEME_SINIRI,
  KULLANICI_DENEME_SINIRI,
  PENCERE_DK,
  kilitKalanSaniye,
  kilitMesaji,
} from "@/lib/girisSinir";
import { LOG_ISLEM, type Rol } from "@/lib/sabitler";
import { guvenliDonusYolu } from "@/lib/yonlendirme";

export type GirisDurumu = {
  hata?: string;
  /** Hatalı denemeden sonra alanı yeniden doldurmak için geri verilir. */
  kullaniciAdi?: string;
  /** Her denemede artar; form alanlarını `key` ile tazelemek için. */
  deneme: number;
};

/** Başarısız denemeler burada tutulur; kaba kuvvet sayacının dayanağı. */
async function denemeYaz(kullaniciAdi: string, ip: string | undefined, basarili: boolean) {
  await prisma.girisDenemesi.create({ data: { kullaniciAdi, ip, basarili } });
}

/**
 * Penceredeki başarısız denemelere bakarak kilit süresini hesaplar.
 *
 * İki ayrı sınır: aynı kullanıcı adına yapılan denemeler hesabı korur, aynı
 * IP'den yapılanlar ise farklı kullanıcı adlarını tarayan saldırıyı yavaşlatır.
 */
async function kilitSuresi(kullaniciAdi: string, ip: string | undefined, simdi: Date) {
  const pencereBasi = new Date(simdi.getTime() - PENCERE_DK * 60_000);

  const denemeler = await prisma.girisDenemesi.findMany({
    where: {
      basarili: false,
      tarih: { gt: pencereBasi },
      OR: [{ kullaniciAdi }, ...(ip ? [{ ip }] : [])],
    },
    select: { kullaniciAdi: true, ip: true, tarih: true },
  });

  const kullaniciKilidi = kilitKalanSaniye(
    denemeler.filter((d) => d.kullaniciAdi === kullaniciAdi).map((d) => d.tarih),
    KULLANICI_DENEME_SINIRI,
    simdi,
  );
  const ipKilidi = ip
    ? kilitKalanSaniye(
        denemeler.filter((d) => d.ip === ip).map((d) => d.tarih),
        IP_DENEME_SINIRI,
        simdi,
      )
    : 0;

  return Math.max(kullaniciKilidi, ipKilidi);
}

export async function girisYap(
  oncekiDurum: GirisDurumu,
  form: FormData,
): Promise<GirisDurumu> {
  const deneme = oncekiDurum.deneme + 1;
  const kullaniciAdi = String(form.get("kullaniciAdi") ?? "").trim();
  const sifre = String(form.get("sifre") ?? "");
  const devam = String(form.get("devam") ?? "");

  if (!kullaniciAdi || !sifre) {
    return { hata: "Kullanıcı adı ve şifre zorunludur.", kullaniciAdi, deneme };
  }

  const ip = await istemciIp();
  const simdi = new Date();

  const kalan = await kilitSuresi(kullaniciAdi, ip, simdi);
  if (kalan > 0) {
    return { hata: kilitMesaji(kalan), kullaniciAdi, deneme };
  }

  const kullanici = await prisma.kullanici.findUnique({
    where: { kullaniciAdi },
    include: { magaza: true },
  });

  // Kullanıcı yok / şifre yanlış ayrımı yapılmaz: hesap taramasını zorlaştırır.
  const gecerli = kullanici ? await sifreDogrula(sifre, kullanici.sifreHash) : false;
  if (!kullanici || !gecerli || !kullanici.aktif) {
    await denemeYaz(kullaniciAdi, ip, false);

    // Bu deneme kilidi tetiklediyse yöneticinin log ekranında görünsün.
    const yeniKilit = await kilitSuresi(kullaniciAdi, ip, new Date());
    if (yeniKilit > 0) {
      await logYaz(null, {
        islem: LOG_ISLEM.GIRIS_KILIT,
        hedefTip: "Kullanici",
        detay: `${kullaniciAdi} için giriş kilitlendi (${Math.ceil(yeniKilit / 60)} dk)`,
      });
    }

    // Pasif hesap da hatalı şifreyle aynı mesajı alır; hesap varlığı sızmasın.
    if (kullanici && gecerli && !kullanici.aktif) {
      return { hata: "Bu hesap pasif durumda. Yönetici ile görüşün.", kullaniciAdi, deneme };
    }
    return { hata: "Kullanıcı adı veya şifre hatalı.", kullaniciAdi, deneme };
  }

  await prisma.$transaction([
    prisma.kullanici.update({ where: { id: kullanici.id }, data: { sonGiris: simdi } }),
    prisma.girisDenemesi.create({ data: { kullaniciAdi, ip, basarili: true } }),
    // Başarılı giriş sayacı sıfırlar; eski kayıtlar da burada budanır.
    prisma.girisDenemesi.deleteMany({ where: { kullaniciAdi, basarili: false } }),
    prisma.girisDenemesi.deleteMany({
      where: { tarih: { lt: new Date(simdi.getTime() - 7 * 24 * 60 * 60_000) } },
    }),
  ]);

  const oturum = {
    kullaniciId: kullanici.id,
    kullaniciAdi: kullanici.kullaniciAdi,
    adSoyad: kullanici.adSoyad,
    rol: kullanici.rol as Rol,
    magazaId: kullanici.magazaId,
    magazaAdi: kullanici.magaza?.ad ?? null,
    oturumSurumu: kullanici.oturumSurumu,
  };

  await oturumAc(oturum);
  await logYaz(oturum, { islem: LOG_ISLEM.GIRIS_YAP });

  redirect(guvenliDonusYolu(devam));
}

export async function cikisYap(): Promise<void> {
  const oturum = await oturumuOku();
  if (oturum) {
    await logYaz(oturum, { islem: LOG_ISLEM.CIKIS_YAP });
  }
  await oturumKapat();
  redirect("/giris");
}
