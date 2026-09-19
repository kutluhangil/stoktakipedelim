/**
 * Giriş denemesi sınırı — saf karar fonksiyonları.
 *
 * Kayıt tutma ve sorgulama giriş eyleminin işi; buradaki fonksiyonlar yalnız
 * "bu denemelerle kilitli mi, ne kadar kaldı" sorusunu yanıtlar ve doğrudan
 * test edilebilir.
 */

/** Aynı kullanıcı adına bu kadar başarısız denemeden sonra giriş kilitlenir. */
export const KULLANICI_DENEME_SINIRI = 5;
/** Aynı IP'den bu kadar başarısız denemeden sonra giriş kilitlenir. */
export const IP_DENEME_SINIRI = 20;
/** Sayaç penceresi ve kilit süresi (dakika). */
export const PENCERE_DK = 15;

/**
 * Kilidin bitmesine kalan saniye; kilit yoksa 0.
 *
 * Kilit, penceredeki son `sinir` denemenin en eskisi pencereden düştüğünde
 * kalkar: ardışık denemeler kilidi uzatır, bekleyen kullanıcı beklediği kadar
 * erken açılır.
 */
export function kilitKalanSaniye(
  basarisizTarihler: Date[],
  sinir: number,
  simdi: Date,
  pencereDk: number = PENCERE_DK,
): number {
  const pencereMs = pencereDk * 60_000;
  const pencereBasi = simdi.getTime() - pencereMs;

  const icerideki = basarisizTarihler
    .map((t) => t.getTime())
    .filter((t) => t > pencereBasi)
    .sort((a, b) => a - b);

  if (icerideki.length < sinir) return 0;

  const kilidiAcan = icerideki[icerideki.length - sinir];
  return Math.max(0, Math.ceil((kilidiAcan + pencereMs - simdi.getTime()) / 1000));
}

/** Kullanıcıya gösterilecek kilit mesajı. */
export function kilitMesaji(kalanSaniye: number): string {
  const dakika = Math.ceil(kalanSaniye / 60);
  return `Çok fazla hatalı giriş denemesi. ${dakika} dakika sonra tekrar deneyin.`;
}
