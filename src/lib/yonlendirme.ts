/**
 * Giriş sonrası dönüş adresinin doğrulanması.
 *
 * `devam` parametresini proxy üretir ama kullanıcı da elle verebilir; doğrudan
 * `redirect()`e geçirilirse açık yönlendirme (open redirect) olur:
 * "//example.com" tarayıcıda protokol-göreli dış adres sayılır, "/\example.com"
 * de aynı şekilde normalleştirilir. Bu yüzden yalnız tek "/" ile başlayan,
 * ikinci karakteri eğik çizgi olmayan ve kontrol karakteri içermeyen yollar
 * kabul edilir.
 */

const KONTROL_KARAKTERI = /[\u0000-\u001f]/;

export function guvenliDonusYolu(
  devam: string | null | undefined,
  varsayilan = "/panel",
): string {
  if (!devam) return varsayilan;
  if (devam[0] !== "/") return varsayilan;
  if (devam[1] === "/" || devam[1] === "\\") return varsayilan;
  if (KONTROL_KARAKTERI.test(devam)) return varsayilan;
  return devam;
}
