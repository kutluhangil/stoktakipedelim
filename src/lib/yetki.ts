import "server-only";
import { redirect } from "next/navigation";
import { oturumuOku, type OturumBilgisi } from "./oturum";
import { prisma } from "./prisma";
import {
  adminMi,
  ayarlariYonetebilirMi,
  ikinciElAlabilirMi,
  magazadaIslemYapabilirMi,
  musteriDuzenleyebilirMi,
  stokEkleyebilirMi,
  stokSilebilirMi,
  type Rol,
} from "./yetkiKurallari";

/** Yetkisiz erişim denemelerinde fırlatılır; Server Action'larda mesajı kullanıcıya döner. */
export class YetkiHatasi extends Error {
  constructor(mesaj = "Bu işlem için yetkiniz yok.") {
    super(mesaj);
    this.name = "YetkiHatasi";
  }
}

/**
 * Jetonu her istekte veritabanıyla doğrular.
 *
 * Rol, mağaza ve aktiflik jetondan değil kullanıcı kaydından okunur: yetki
 * düşürüldüğünde, mağaza değiştiğinde veya hesap pasife alındığında jetonun
 * süresi dolmasını beklemek gerekmez. `oturumSurumu` uyuşmazlığı ise şifre
 * değişimi / oturum iptali sonrası eski jetonları kapatır.
 */
export async function oturumuDogrula(): Promise<OturumBilgisi | null> {
  const jeton = await oturumuOku();
  if (!jeton) return null;

  const kullanici = await prisma.kullanici.findUnique({
    where: { id: jeton.kullaniciId },
    select: {
      id: true,
      kullaniciAdi: true,
      adSoyad: true,
      rol: true,
      magazaId: true,
      aktif: true,
      oturumSurumu: true,
      magaza: { select: { ad: true } },
    },
  });

  if (!kullanici || !kullanici.aktif) return null;
  if (kullanici.oturumSurumu !== jeton.oturumSurumu) return null;

  return {
    kullaniciId: kullanici.id,
    kullaniciAdi: kullanici.kullaniciAdi,
    adSoyad: kullanici.adSoyad,
    rol: kullanici.rol as Rol,
    magazaId: kullanici.magazaId,
    magazaAdi: kullanici.magaza?.ad ?? null,
    oturumSurumu: kullanici.oturumSurumu,
  };
}

/**
 * Sayfalar için: oturum geçersizse çerezi temizleyen /cikis ucuna yollar.
 *
 * Doğrudan /giris'e yönlendirmek döngü kurardı: proxy çerezi görüp /giris'i
 * /panel'e geri atar, sayfa yine geçersiz oturumla karşılaşırdı.
 */
export async function oturumGerekli(): Promise<OturumBilgisi> {
  const oturum = await oturumuDogrula();
  if (!oturum) redirect("/cikis");
  return oturum;
}

/** Server Action'lar için: oturum yoksa hata fırlatır (yönlendirme yapmaz). */
export async function oturumZorunlu(): Promise<OturumBilgisi> {
  const oturum = await oturumuDogrula();
  if (!oturum) throw new YetkiHatasi("Oturumunuz sona ermiş. Lütfen tekrar giriş yapın.");
  return oturum;
}

export async function adminZorunlu(): Promise<OturumBilgisi> {
  const oturum = await oturumZorunlu();
  if (!adminMi(oturum)) {
    throw new YetkiHatasi("Bu işlemi yalnızca yönetici yapabilir.");
  }
  return oturum;
}

/** Sayfa seviyesinde yönetici kontrolü; yetkisizse panele döner. */
export async function adminSayfasi(): Promise<OturumBilgisi> {
  const oturum = await oturumGerekli();
  if (!adminMi(oturum)) redirect("/panel");
  return oturum;
}

export function magazaIslemiZorunlu(oturum: OturumBilgisi, magazaId: number): void {
  if (!magazadaIslemYapabilirMi(oturum, magazaId)) {
    throw new YetkiHatasi("Yalnızca kendi mağazanızda işlem yapabilirsiniz.");
  }
}

/** Server Action'lar için ikinci el alım yetkisi denetimi. */
export async function ikinciElZorunlu(): Promise<OturumBilgisi> {
  const oturum = await oturumZorunlu();
  if (!ikinciElAlabilirMi(oturum)) {
    throw new YetkiHatasi("İkinci el alımı yalnız yönetici ve mağaza sorumlusu yapabilir.");
  }
  return oturum;
}

/** Server Action'lar için müşteri düzenleme yetkisi denetimi. */
export async function musteriZorunlu(): Promise<OturumBilgisi> {
  const oturum = await oturumZorunlu();
  if (!musteriDuzenleyebilirMi(oturum)) {
    throw new YetkiHatasi("Müşteri kaydını yalnız yönetici ve mağaza sorumlusu düzenleyebilir.");
  }
  return oturum;
}

export {
  adminMi,
  ayarlariYonetebilirMi,
  ikinciElAlabilirMi,
  magazadaIslemYapabilirMi,
  musteriDuzenleyebilirMi,
  stokEkleyebilirMi,
  stokSilebilirMi,
};
export type { Rol };
