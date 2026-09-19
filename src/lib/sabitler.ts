/** Uygulama genelinde kullanılan sabit değerler ve Türkçe etiketleri. */

export const ROLLER = {
  ADMIN: "ADMIN",
  MAGAZA_SORUMLUSU: "MAGAZA_SORUMLUSU",
  MAGAZA_PERSONELI: "MAGAZA_PERSONELI",
} as const;
export type Rol = (typeof ROLLER)[keyof typeof ROLLER];

export const ROL_ETIKET: Record<Rol, string> = {
  ADMIN: "Yönetici",
  MAGAZA_SORUMLUSU: "Mağaza Sorumlusu",
  MAGAZA_PERSONELI: "Mağaza Personeli",
};

export const STOK_DURUM = {
  STOKTA: "STOKTA",
  TRANSFERDE: "TRANSFERDE",
  SATILDI: "SATILDI",
  IADE: "IADE",
  ARIZALI: "ARIZALI",
  /**
   * Sayımda bulunamayan cihaz. Kaydı ve tarihçesi durur ama stok adedine,
   * stok değerine ve satışa girmez; bulunursa "Satışa aç" ile geri döner.
   */
  KAYIP: "KAYIP",
  /**
   * Yanlış girilmiş kayıt. Kalıcı silme yerine bu duruma alınır:
   * listelerden, stok değerinden ve raporlardan düşer ama kaydın kendisi ve
   * hareket tarihçesi durur, yönetici geri alabilir.
   */
  IPTAL: "IPTAL",
} as const;
export type StokDurum = (typeof STOK_DURUM)[keyof typeof STOK_DURUM];

export const STOK_DURUM_ETIKET: Record<StokDurum, string> = {
  STOKTA: "Stokta",
  TRANSFERDE: "Transferde",
  SATILDI: "Satıldı",
  IADE: "İade",
  ARIZALI: "Arızalı",
  KAYIP: "Kayıp",
  IPTAL: "İptal",
};

/**
 * İade alınan cihazın gideceği durumlar. Müşteri malı geri getirdiğinde cihaz
 * fiziksel olarak elimizdedir; tekrar satılabilir mi, kontrol mü bekliyor,
 * yoksa arızalı mı — karar iadeyi alan kişinindir.
 */
export const IADE_SONUCLARI = [
  STOK_DURUM.STOKTA,
  STOK_DURUM.IADE,
  STOK_DURUM.ARIZALI,
] as const;

/** "Satışa aç" ile stoğa döndürülebilen durumlar. */
export const STOGA_DONEBILEN = [
  STOK_DURUM.IADE,
  STOK_DURUM.ARIZALI,
  STOK_DURUM.KAYIP,
] as const;
export type IadeSonucu = (typeof IADE_SONUCLARI)[number];

export const IADE_SONUC_ACIKLAMA: Record<IadeSonucu, string> = {
  STOKTA: "Sorunsuz, hemen tekrar satılabilir",
  IADE: "Kontrol bekliyor, satışa açılmadı",
  ARIZALI: "Arızalı, servise gidecek",
};

export const TRANSFER_DURUM = {
  BEKLIYOR: "BEKLIYOR",
  KABUL: "KABUL",
  KISMI_KABUL: "KISMI_KABUL",
  RED: "RED",
  IPTAL: "IPTAL",
} as const;
export type TransferDurum = (typeof TRANSFER_DURUM)[keyof typeof TRANSFER_DURUM];

export const TRANSFER_DURUM_ETIKET: Record<TransferDurum, string> = {
  BEKLIYOR: "Onay Bekliyor",
  KABUL: "Kabul Edildi",
  KISMI_KABUL: "Kısmi Kabul",
  RED: "Reddedildi",
  IPTAL: "İptal",
};

export const TRANSFER_KALEM_DURUM = {
  BEKLIYOR: "BEKLIYOR",
  KABUL: "KABUL",
  RED: "RED",
} as const;

export const HAREKET_TIP = {
  GIRIS: "GIRIS",
  TRANSFER_GONDERIM: "TRANSFER_GONDERIM",
  TRANSFER_KABUL: "TRANSFER_KABUL",
  TRANSFER_RED: "TRANSFER_RED",
  SATIS: "SATIS",
  IADE: "IADE",
  DUZELTME: "DUZELTME",
  SAYIM_FARK: "SAYIM_FARK",
} as const;
export type HareketTip = (typeof HAREKET_TIP)[keyof typeof HAREKET_TIP];

export const HAREKET_TIP_ETIKET: Record<HareketTip, string> = {
  GIRIS: "Stok Girişi",
  TRANSFER_GONDERIM: "Sevkiyat Gönderildi",
  TRANSFER_KABUL: "Sevkiyat Kabul Edildi",
  TRANSFER_RED: "Sevkiyat Reddedildi",
  SATIS: "Satış",
  IADE: "İade",
  DUZELTME: "Düzeltme",
  SAYIM_FARK: "Sayım Farkı",
};

export const SAYIM_DURUM = {
  DEVAM: "DEVAM",
  TAMAMLANDI: "TAMAMLANDI",
  IPTAL: "IPTAL",
} as const;

export const SAYIM_SONUC = {
  BULUNDU: "BULUNDU",
  BASKA_MAGAZADA: "BASKA_MAGAZADA",
  SATILMIS: "SATILMIS",
  KAYITSIZ: "KAYITSIZ",
  EKSIK: "EKSIK",
  /** Sayım başlarken bu depodan çıkmış ama karşı mağazaca kabul edilmemiş cihaz. */
  SEVKIYATTA: "SEVKIYATTA",
} as const;
export type SayimSonuc = (typeof SAYIM_SONUC)[keyof typeof SAYIM_SONUC];

export const SAYIM_SONUC_ETIKET: Record<SayimSonuc, string> = {
  BULUNDU: "Stokta bulundu",
  BASKA_MAGAZADA: "Başka mağazada kayıtlı",
  SATILMIS: "Satılmış görünüyor",
  KAYITSIZ: "Sistemde kayıtlı değil",
  EKSIK: "Okutulmadı (eksik)",
  SEVKIYATTA: "Sevkiyatta (depoda olmamalı)",
};

export const ODEME_TIPI = {
  NAKIT: "NAKIT",
  KREDI_KARTI: "KREDI_KARTI",
  HAVALE: "HAVALE",
  TAKAS: "TAKAS",
  DIGER: "DIGER",
} as const;
export type OdemeTipi = (typeof ODEME_TIPI)[keyof typeof ODEME_TIPI];

export const ODEME_TIPI_ETIKET: Record<OdemeTipi, string> = {
  NAKIT: "Nakit",
  KREDI_KARTI: "Kredi Kartı",
  HAVALE: "Havale/EFT",
  TAKAS: "Takas",
  DIGER: "Diğer",
};

/** Hızlı seçim için sık kullanılan vadeler; serbest gün girişi de kabul edilir. */
export const VADE_SECENEKLERI = [0, 21, 30, 45, 60, 90] as const;

/** Vadenin en fazla bu kadar gün olmasına izin verilir. */
export const VADE_EN_FAZLA_GUN = 365;

export function vadeEtiketi(gun: number): string {
  return gun === 0 ? "Vadesiz" : `${gun} gün`;
}

/**
 * Geriye dönük uyumluluk için bilinen değerlerin etiket haritası.
 * Serbest gün girişinde vadeEtiketi() kullanılır.
 */
export const VADE_ETIKET: Record<number, string> = Object.fromEntries(
  VADE_SECENEKLERI.map((g) => [g, vadeEtiketi(g)]),
);

/** Vadeye bu kadar gün veya daha az kaldıysa satır sarı uyarı verir. */
export const VADE_UYARI_GUN = 7;

export const LOG_ISLEM = {
  GIRIS_YAP: "GIRIS_YAP",
  CIKIS_YAP: "CIKIS_YAP",
  FATURA_EKLE: "FATURA_EKLE",
  STOK_EKLE: "STOK_EKLE",
  STOK_DUZENLE: "STOK_DUZENLE",
  STOK_SIL: "STOK_SIL",
  TRANSFER_GONDER: "TRANSFER_GONDER",
  TRANSFER_KABUL: "TRANSFER_KABUL",
  TRANSFER_RED: "TRANSFER_RED",
  SATIS_YAP: "SATIS_YAP",
  SAYIM_BASLAT: "SAYIM_BASLAT",
  SAYIM_KAPAT: "SAYIM_KAPAT",
  EXCEL_AKTAR: "EXCEL_AKTAR",
  AYAR_DEGISTIR: "AYAR_DEGISTIR",
  YEDEK_AL: "YEDEK_AL",
  SATIS_IADE: "SATIS_IADE",
  SIFRE_DEGISTIR: "SIFRE_DEGISTIR",
  OTURUM_IPTAL: "OTURUM_IPTAL",
  GIRIS_KILIT: "GIRIS_KILIT",
  MUSTERI_DUZENLE: "MUSTERI_DUZENLE",
  MUSTERI_SIL: "MUSTERI_SIL",
  SAYIM_FARK: "SAYIM_FARK",
} as const;
export type LogIslem = (typeof LOG_ISLEM)[keyof typeof LOG_ISLEM];
