"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { logYaz } from "@/lib/log";
import { aramaMetniUret, kodNormalize } from "@/lib/metin";
import { prisma } from "@/lib/prisma";
import {
  HAREKET_TIP,
  LOG_ISLEM,
  STOGA_DONEBILEN,
  STOK_DURUM,
  STOK_DURUM_ETIKET,
  type StokDurum,
} from "@/lib/sabitler";
import { SUTUN_ANAHTARLARI, sutunlariSirala, type SutunAnahtari } from "@/lib/sutunlar";
import { YetkiHatasi, adminZorunlu, magazaIslemiZorunlu, oturumZorunlu } from "@/lib/yetki";

export type SutunDurumu = { hata?: string };

/**
 * Cihaz listesinde görünecek sütunları kullanıcıya özel kaydeder.
 * Seçim kullanıcı kaydında JSON olarak durur, oturumlar arası korunur.
 */
export async function sutunTercihiKaydet(
  _onceki: SutunDurumu,
  form: FormData,
): Promise<SutunDurumu> {
  try {
    const oturum = await oturumZorunlu();

    const secilenler = form
      .getAll("sutun")
      .map(String)
      .filter((a): a is SutunAnahtari => SUTUN_ANAHTARLARI.includes(a as SutunAnahtari));

    if (secilenler.length === 0) {
      return { hata: "En az bir sütun seçili kalmalı." };
    }

    await prisma.kullanici.update({
      where: { id: oturum.kullaniciId },
      data: { sutunTercihi: JSON.stringify(sutunlariSirala(secilenler)) },
    });

    revalidatePath("/cihazlar");
    return {};
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message };
    console.error("Sütun tercihi kaydedilemedi:", hata);
    return { hata: "Sütun tercihi kaydedilemedi." };
  }
}

/** Sütun seçimini varsayılana döndürür. */
export async function sutunTercihiSifirla(): Promise<void> {
  const oturum = await oturumZorunlu();
  await prisma.kullanici.update({
    where: { id: oturum.kullaniciId },
    data: { sutunTercihi: null },
  });
  revalidatePath("/cihazlar");
}

// ------------------------------------------------------- Cihaz kaydı düzeltme

const duzenlemeSemasi = z.object({
  cihazId: z.number().int().positive("Cihaz bulunamadı."),
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
    .min(0, "Alış fiyatı negatif olamaz.")
    .max(1_000_000_00_00, "Alış fiyatı çok yüksek."),
  not: z.string().trim().max(500).nullable(),
});

export type CihazDuzenlemeDurumu = { hata?: string; alanHatalari?: string[] };

/**
 * Yanlış girilmiş künye ve alış bilgisini düzeltir (yalnız yönetici).
 *
 * Cihaz satılmış veya sevkiyattaysa kayıt kilitlidir: satış sonrası alış
 * fiyatının değişmesi geçmiş kâr raporunu geriye dönük bozar, sevkiyattaki
 * cihazın künyesi ise karşı mağazanın okuttuğu şeyle uyuşmaz hâle gelir.
 */
export async function cihazDuzenle(
  _onceki: CihazDuzenlemeDurumu,
  form: FormData,
): Promise<CihazDuzenlemeDurumu> {
  let cihazId: number;

  try {
    const oturum = await adminZorunlu();

    let cozulen: unknown;
    try {
      cozulen = JSON.parse(String(form.get("veri") ?? ""));
    } catch {
      return { hata: "Form verisi okunamadı. Sayfayı yenileyip tekrar deneyin." };
    }

    const sonuc = duzenlemeSemasi.safeParse(cozulen);
    if (!sonuc.success) {
      return {
        hata: "Formda eksik veya hatalı alanlar var.",
        alanHatalari: sonuc.error.issues.map((i) => i.message),
      };
    }

    const veri = sonuc.data;

    const mevcut = await prisma.stokKalemi.findUnique({
      where: { id: veri.cihazId },
      include: { tedarikci: { select: { ad: true } } },
    });
    if (!mevcut) return { hata: "Cihaz bulunamadı." };

    if (mevcut.durum === STOK_DURUM.SATILDI) {
      return { hata: "Satılmış cihazın kaydı değiştirilemez." };
    }
    if (mevcut.durum === STOK_DURUM.TRANSFERDE) {
      return { hata: "Sevkiyattaki cihazın kaydı değiştirilemez. Önce sevkiyat sonuçlansın." };
    }
    if (mevcut.durum === STOK_DURUM.IPTAL) {
      return { hata: "İptal edilmiş cihaz düzenlenemez. Önce iptali geri alın." };
    }

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

    // Seri no başka bir cihazda kullanılıyor olamaz (kendisi hariç).
    if (seriNo) {
      const cakisan = await prisma.stokKalemi.findFirst({
        where: { seriNo, id: { not: veri.cihazId } },
        select: { id: true },
      });
      if (cakisan) {
        return { hata: `${seriNo} başka bir cihazda kayıtlı (#${cakisan.id}).` };
      }
    }

    // Alt kategori seçildiyse gerçekten bu kategoriye ait olmalı.
    if (veri.altKategoriId) {
      const altKategori = await prisma.altKategori.findUnique({
        where: { id: veri.altKategoriId },
        select: { kategoriId: true },
      });
      if (!altKategori || altKategori.kategoriId !== veri.kategoriId) {
        return { hata: "Alt kategori seçilen kategoriye ait değil." };
      }
    }

    const degisenler = alanFarklari(mevcut, { ...veri, seriNo, barkod });
    if (degisenler.length === 0) {
      return { hata: "Değişiklik yok." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.stokKalemi.update({
        where: { id: veri.cihazId },
        data: {
          kategoriId: veri.kategoriId,
          altKategoriId: veri.altKategoriId,
          marka: veri.marka,
          model: veri.model,
          renk: veri.renk,
          kapasite: veri.kapasite,
          seriNo,
          barkod,
          alisFiyatiKurus: veri.alisFiyatiKurus,
          not: veri.not,
          aramaMetni: aramaMetniUret([
            veri.marka,
            veri.model,
            veri.renk,
            veri.kapasite,
            seriNo,
            barkod,
            mevcut.tedarikci?.ad,
            veri.not,
          ]),
        },
      });

      await tx.stokHareketi.create({
        data: {
          stokKalemiId: veri.cihazId,
          tip: HAREKET_TIP.DUZELTME,
          hedefMagazaId: mevcut.magazaId,
          kullaniciId: oturum.kullaniciId,
          aciklama: `Kayıt düzeltildi: ${degisenler.join(", ")}`,
        },
      });
    });

    await logYaz(oturum, {
      islem: LOG_ISLEM.STOK_DUZENLE,
      hedefTip: "StokKalemi",
      hedefId: veri.cihazId,
      detay: `#${veri.cihazId} · ${degisenler.join(", ")}`,
    });

    revalidatePath(`/cihazlar/${veri.cihazId}`);
    revalidatePath("/cihazlar");
    cihazId = veri.cihazId;
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message };
    console.error("Cihaz düzenlenemedi:", hata);
    return { hata: "Cihaz düzenlenemedi. Lütfen tekrar deneyin." };
  }

  redirect(`/cihazlar/${cihazId}`);
}

/** Log ve hareket açıklamasında "neyin değiştiğini" yazabilmek için alan karşılaştırması. */
function alanFarklari(
  mevcut: {
    kategoriId: number;
    altKategoriId: number | null;
    marka: string;
    model: string;
    renk: string | null;
    kapasite: string | null;
    seriNo: string | null;
    barkod: string | null;
    alisFiyatiKurus: number;
    not: string | null;
  },
  yeni: {
    kategoriId: number;
    altKategoriId: number | null;
    marka: string;
    model: string;
    renk: string | null;
    kapasite: string | null;
    seriNo: string | null;
    barkod: string | null;
    alisFiyatiKurus: number;
    not: string | null;
  },
): string[] {
  const alanlar: [string, unknown, unknown][] = [
    ["kategori", mevcut.kategoriId, yeni.kategoriId],
    ["alt kategori", mevcut.altKategoriId, yeni.altKategoriId],
    ["marka", mevcut.marka, yeni.marka],
    ["model", mevcut.model, yeni.model],
    ["renk", mevcut.renk, yeni.renk],
    ["kapasite", mevcut.kapasite, yeni.kapasite],
    ["seri no", mevcut.seriNo, yeni.seriNo],
    ["barkod", mevcut.barkod, yeni.barkod],
    ["alış fiyatı", mevcut.alisFiyatiKurus, yeni.alisFiyatiKurus],
    ["not", mevcut.not, yeni.not],
  ];
  return alanlar.filter(([, eski, guncel]) => eski !== guncel).map(([ad]) => ad);
}

// ------------------------------------------------------------- İptal / geri al

export type CihazIptalDurumu = { hata?: string; basari?: string };

/**
 * Yanlış girilmiş kaydı iptale alır (yalnız yönetici).
 *
 * Kalıcı silme yerine durum değişikliği: kayıt ve hareket tarihçesi durur,
 * denetim izi kopmaz, gerekirse geri alınır. Sevkiyattaki cihaz iptal edilemez —
 * açık bir sevkiyatın kalemi ortadan kalkarsa kabul ekranı tutarsız hâle gelir.
 */
export async function cihaziIptalEt(
  _onceki: CihazIptalDurumu,
  form: FormData,
): Promise<CihazIptalDurumu> {
  try {
    const oturum = await adminZorunlu();

    const cihazId = Number(form.get("cihazId"));
    const neden = String(form.get("neden") ?? "").trim();
    if (!Number.isInteger(cihazId) || cihazId <= 0) return { hata: "Cihaz bulunamadı." };
    if (neden.length < 3) return { hata: "İptal nedenini yazın." };
    if (neden.length > 300) return { hata: "İptal nedeni çok uzun." };

    const cihaz = await prisma.stokKalemi.findUnique({
      where: { id: cihazId },
      select: { id: true, durum: true, magazaId: true, marka: true, model: true, seriNo: true },
    });
    if (!cihaz) return { hata: "Cihaz bulunamadı." };

    if (cihaz.durum === STOK_DURUM.IPTAL) return { hata: "Bu cihaz zaten iptal edilmiş." };
    if (cihaz.durum === STOK_DURUM.TRANSFERDE) {
      return { hata: "Sevkiyattaki cihaz iptal edilemez. Önce sevkiyat sonuçlansın." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.stokKalemi.update({
        where: { id: cihazId },
        data: { durum: STOK_DURUM.IPTAL },
      });
      await tx.stokHareketi.create({
        data: {
          stokKalemiId: cihazId,
          tip: HAREKET_TIP.DUZELTME,
          kaynakMagazaId: cihaz.magazaId,
          kullaniciId: oturum.kullaniciId,
          aciklama: `Kayıt iptal edildi: ${neden}`,
        },
      });
    });

    await logYaz(oturum, {
      islem: LOG_ISLEM.STOK_SIL,
      hedefTip: "StokKalemi",
      hedefId: cihazId,
      detay: `#${cihazId} ${cihaz.marka} ${cihaz.model}${
        cihaz.seriNo ? ` (${cihaz.seriNo})` : ""
      } iptal edildi: ${neden}`,
    });

    revalidatePath(`/cihazlar/${cihazId}`);
    revalidatePath("/cihazlar");
    revalidatePath("/panel");
    return { basari: "Cihaz iptal edildi; listelerde ve stok değerinde görünmeyecek." };
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message };
    console.error("Cihaz iptal edilemedi:", hata);
    return { hata: "Cihaz iptal edilemedi. Lütfen tekrar deneyin." };
  }
}

/** İptali geri alır; cihaz bulunduğu depoda tekrar stoğa döner (yalnız yönetici). */
export async function cihazIptaliniGeriAl(
  _onceki: CihazIptalDurumu,
  form: FormData,
): Promise<CihazIptalDurumu> {
  try {
    const oturum = await adminZorunlu();

    const cihazId = Number(form.get("cihazId"));
    if (!Number.isInteger(cihazId) || cihazId <= 0) return { hata: "Cihaz bulunamadı." };

    const cihaz = await prisma.stokKalemi.findUnique({
      where: { id: cihazId },
      select: { id: true, durum: true, magazaId: true, seriNo: true },
    });
    if (!cihaz) return { hata: "Cihaz bulunamadı." };
    if (cihaz.durum !== STOK_DURUM.IPTAL) return { hata: "Bu cihaz iptal edilmemiş." };

    await prisma.$transaction(async (tx) => {
      await tx.stokKalemi.update({
        where: { id: cihazId },
        data: { durum: STOK_DURUM.STOKTA },
      });
      await tx.stokHareketi.create({
        data: {
          stokKalemiId: cihazId,
          tip: HAREKET_TIP.DUZELTME,
          hedefMagazaId: cihaz.magazaId,
          kullaniciId: oturum.kullaniciId,
          aciklama: "İptal geri alındı, cihaz stoğa döndü",
        },
      });
    });

    await logYaz(oturum, {
      islem: LOG_ISLEM.STOK_DUZENLE,
      hedefTip: "StokKalemi",
      hedefId: cihazId,
      detay: `#${cihazId} iptali geri alındı`,
    });

    revalidatePath(`/cihazlar/${cihazId}`);
    revalidatePath("/cihazlar");
    revalidatePath("/panel");
    return { basari: "İptal geri alındı, cihaz stokta." };
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message };
    console.error("İptal geri alınamadı:", hata);
    return { hata: "İptal geri alınamadı. Lütfen tekrar deneyin." };
  }
}

// -------------------------------------------------------------- Satışa açma

export type StogaAlmaDurumu = { hata?: string; basari?: string };

/**
 * İade alınmış, arızalı veya kayıp cihazı tekrar satılabilir hâle getirir.
 *
 * Bu durumların hepsinin stoğa tek dönüş yolu burasıdır: kontrol biten iade,
 * servisten gelen arızalı, sayımdan sonra bulunan kayıp cihaz. Yetki iadeyle
 * aynı — cihazın bulunduğu mağazada işlem yapabilen herkes.
 */
export async function cihaziStogaAl(
  _onceki: StogaAlmaDurumu,
  form: FormData,
): Promise<StogaAlmaDurumu> {
  try {
    const oturum = await oturumZorunlu();

    const cihazId = Number(form.get("cihazId"));
    const aciklama = String(form.get("aciklama") ?? "").trim();
    if (!Number.isInteger(cihazId) || cihazId <= 0) return { hata: "Cihaz bulunamadı." };
    if (aciklama.length > 300) return { hata: "Açıklama çok uzun." };

    const cihaz = await prisma.stokKalemi.findUnique({
      where: { id: cihazId },
      select: { id: true, durum: true, magazaId: true, marka: true, model: true, seriNo: true },
    });
    if (!cihaz) return { hata: "Cihaz bulunamadı." };

    if (!(STOGA_DONEBILEN as readonly string[]).includes(cihaz.durum)) {
      return { hata: "Yalnız iade alınmış, arızalı veya kayıp cihaz satışa açılabilir." };
    }
    magazaIslemiZorunlu(oturum, cihaz.magazaId);

    await prisma.$transaction(async (tx) => {
      await tx.stokKalemi.update({
        where: { id: cihazId },
        data: { durum: STOK_DURUM.STOKTA },
      });
      await tx.stokHareketi.create({
        data: {
          stokKalemiId: cihazId,
          tip: HAREKET_TIP.DUZELTME,
          hedefMagazaId: cihaz.magazaId,
          kullaniciId: oturum.kullaniciId,
          aciklama: aciklama
            ? `Satışa açıldı: ${aciklama}`
            : `${STOK_DURUM_ETIKET[cihaz.durum as StokDurum] ?? cihaz.durum} durumundan satışa açıldı`,
        },
      });
    });

    await logYaz(oturum, {
      islem: LOG_ISLEM.STOK_DUZENLE,
      hedefTip: "StokKalemi",
      hedefId: cihazId,
      detay: `#${cihazId} ${cihaz.marka} ${cihaz.model}${
        cihaz.seriNo ? ` (${cihaz.seriNo})` : ""
      } satışa açıldı${aciklama ? `: ${aciklama}` : ""}`,
    });

    revalidatePath(`/cihazlar/${cihazId}`);
    revalidatePath("/cihazlar");
    revalidatePath("/panel");
    return { basari: "Cihaz stokta; tekrar satılabilir." };
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message };
    console.error("Cihaz satışa açılamadı:", hata);
    return { hata: "Cihaz satışa açılamadı. Lütfen tekrar deneyin." };
  }
}

/**
 * Stoktaki cihazı arızalı olarak işaretler.
 *
 * Arızalı cihaz stok değerinde ve satışta görünmez; servis dönüşünde
 * `cihaziStogaAl` ile geri açılır. Satılmış veya sevkiyattaki cihaz
 * işaretlenemez — satılmışta iade, sevkiyatta önce kabul akışı işler.
 */
export async function cihaziArizaliYap(
  _onceki: StogaAlmaDurumu,
  form: FormData,
): Promise<StogaAlmaDurumu> {
  try {
    const oturum = await oturumZorunlu();

    const cihazId = Number(form.get("cihazId"));
    const neden = String(form.get("neden") ?? "").trim();
    if (!Number.isInteger(cihazId) || cihazId <= 0) return { hata: "Cihaz bulunamadı." };
    if (neden.length < 3) return { hata: "Arıza nedenini yazın." };
    if (neden.length > 300) return { hata: "Arıza nedeni çok uzun." };

    const cihaz = await prisma.stokKalemi.findUnique({
      where: { id: cihazId },
      select: { id: true, durum: true, magazaId: true, marka: true, model: true, seriNo: true },
    });
    if (!cihaz) return { hata: "Cihaz bulunamadı." };
    if (cihaz.durum !== STOK_DURUM.STOKTA) {
      return { hata: "Yalnız stoktaki cihaz arızalı işaretlenebilir." };
    }
    magazaIslemiZorunlu(oturum, cihaz.magazaId);

    await prisma.$transaction(async (tx) => {
      await tx.stokKalemi.update({ where: { id: cihazId }, data: { durum: STOK_DURUM.ARIZALI } });
      await tx.stokHareketi.create({
        data: {
          stokKalemiId: cihazId,
          tip: HAREKET_TIP.DUZELTME,
          kaynakMagazaId: cihaz.magazaId,
          kullaniciId: oturum.kullaniciId,
          aciklama: `Arızalı işaretlendi: ${neden}`,
        },
      });
    });

    await logYaz(oturum, {
      islem: LOG_ISLEM.STOK_DUZENLE,
      hedefTip: "StokKalemi",
      hedefId: cihazId,
      detay: `#${cihazId} ${cihaz.marka} ${cihaz.model}${
        cihaz.seriNo ? ` (${cihaz.seriNo})` : ""
      } arızalı işaretlendi: ${neden}`,
    });

    revalidatePath(`/cihazlar/${cihazId}`);
    revalidatePath("/cihazlar");
    revalidatePath("/panel");
    return { basari: "Cihaz arızalı olarak işaretlendi; stok değerinden ve satıştan düştü." };
  } catch (hata) {
    if (hata instanceof YetkiHatasi) return { hata: hata.message };
    console.error("Cihaz arızalı işaretlenemedi:", hata);
    return { hata: "Cihaz arızalı işaretlenemedi. Lütfen tekrar deneyin." };
  }
}
