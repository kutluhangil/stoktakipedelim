import { createReadStream, createWriteStream } from "node:fs";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { stat } from "node:fs/promises";
import { pipeline } from "node:stream/promises";

/**
 * Yedek dosyası şifreleme (AES-256-GCM).
 *
 * Yedek müşteri adı, telefonu, TCKN ve adresini içerir; düz SQLite olarak
 * bulut depolamaya çıkması KVKK açısından savunulamaz. Bu dosya "server-only"
 * değildir: saf Node crypto/dosya işlemleri içerir, doğrudan test edilebilir.
 *
 * Dosya biçimi: <sihir(10)><iv(12)><şifreli veri><etiket(16)>
 * Etiket sonda tutulur; akış şifrelemede ancak veri bittiğinde üretilir.
 */
export const SIHIR = Buffer.from("STOKYEDEK1", "ascii");
const IV_UZUNLUK = 12;
const ETIKET_UZUNLUK = 16;
const ANAHTAR_UZUNLUK = 32;
export const SIFRELI_UZANTI = ".enc";

/** Ortamdaki 32 baytlık (64 hex karakter) şifreleme anahtarını okur. */
export function yedekAnahtariniOku(deger = process.env.YEDEK_SIFRELEME_ANAHTARI): Buffer {
  if (!deger || deger.trim() === "") {
    throw new Error(
      "YEDEK_SIFRELEME_ANAHTARI tanımlı değil. `openssl rand -hex 32` çıktısını .env dosyasına ekleyin.",
    );
  }
  const temiz = deger.trim();
  if (!/^[0-9a-fA-F]{64}$/.test(temiz)) {
    throw new Error(
      `YEDEK_SIFRELEME_ANAHTARI 64 hex karakter olmalı (şu an ${temiz.length} karakter). \`openssl rand -hex 32\` kullanın.`,
    );
  }
  return Buffer.from(temiz, "hex");
}

/** Dosyayı şifreler; oluşan dosyanın bayt boyutunu döner. */
export async function dosyayiSifrele(
  kaynakYol: string,
  hedefYol: string,
  anahtar: Buffer,
): Promise<number> {
  if (anahtar.length !== ANAHTAR_UZUNLUK) {
    throw new Error(`Şifreleme anahtarı ${ANAHTAR_UZUNLUK} bayt olmalı.`);
  }

  const iv = randomBytes(IV_UZUNLUK);
  const sifreleyici = createCipheriv("aes-256-gcm", anahtar, iv);
  const cikis = createWriteStream(hedefYol);

  cikis.write(SIHIR);
  cikis.write(iv);
  await pipeline(createReadStream(kaynakYol), sifreleyici, cikis, { end: false });

  await new Promise<void>((coz, hata) => {
    cikis.end(sifreleyici.getAuthTag(), () => coz());
    cikis.once("error", hata);
  });

  return (await stat(hedefYol)).size;
}

/**
 * Şifreli yedeği çözer.
 *
 * Etiket doğrulaması başarısızsa `decipher.final()` hata fırlatır: yanlış
 * anahtar ve bozulmuş dosya sessizce geçmez.
 */
export async function dosyayiCoz(
  kaynakYol: string,
  hedefYol: string,
  anahtar: Buffer,
): Promise<number> {
  const boyut = (await stat(kaynakYol)).size;
  const enAz = SIHIR.length + IV_UZUNLUK + ETIKET_UZUNLUK;
  if (boyut < enAz) throw new Error("Dosya şifreli yedek olamayacak kadar küçük.");

  const basliklar = await parcaOku(kaynakYol, 0, SIHIR.length + IV_UZUNLUK);
  if (!basliklar.subarray(0, SIHIR.length).equals(SIHIR)) {
    throw new Error("Dosya bu uygulamanın şifreli yedeği değil (imza uyuşmuyor).");
  }
  const iv = basliklar.subarray(SIHIR.length);
  const etiket = await parcaOku(kaynakYol, boyut - ETIKET_UZUNLUK, ETIKET_UZUNLUK);

  const cozucu = createDecipheriv("aes-256-gcm", anahtar, iv);
  cozucu.setAuthTag(etiket);

  await pipeline(
    createReadStream(kaynakYol, {
      start: SIHIR.length + IV_UZUNLUK,
      end: boyut - ETIKET_UZUNLUK - 1,
    }),
    cozucu,
    createWriteStream(hedefYol),
  );

  return (await stat(hedefYol)).size;
}

async function parcaOku(yol: string, baslangic: number, uzunluk: number): Promise<Buffer> {
  const parcalar: Buffer[] = [];
  const akis = createReadStream(yol, { start: baslangic, end: baslangic + uzunluk - 1 });
  for await (const parca of akis) parcalar.push(parca as Buffer);
  return Buffer.concat(parcalar);
}
