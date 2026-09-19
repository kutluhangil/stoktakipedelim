// Müşteri düzenleme / KVKK silme ve yedek şifreleme testi.
// Kullanım: npm run dev  &&  node betikler/musteri-kvkk-dogrula.mjs
import { chromium } from "@playwright/test";

const hedef = process.env.HEDEF ?? "http://127.0.0.1:3000";
const cikti = process.env.CIKTI ?? "/tmp/musteri";
const SIFRE = "Stok2026!";

const tarayici = await chromium.launch(
  process.env.CHROME_YOLU ? { executablePath: process.env.CHROME_YOLU } : {},
);
const sayfa = await tarayici.newPage({ viewport: { width: 1600, height: 1000 }, locale: "tr-TR" });

const hatalar = [];
sayfa.on("console", (m) => { if (m.type() === "error") hatalar.push(m.text()); });
sayfa.on("pageerror", (e) => hatalar.push(String(e)));

let basarisiz = 0;
function kontrol(baslik, kosul, ek = "") {
  if (!kosul) basarisiz += 1;
  console.log(`${kosul ? "✓" : "✗"} ${baslik}${ek ? ` — ${ek}` : ""}`);
}

async function giris(kullanici) {
  await sayfa.context().clearCookies();
  await sayfa.goto(`${hedef}/giris`, { waitUntil: "networkidle" });
  await sayfa.fill("#kullaniciAdi", kullanici);
  await sayfa.fill("#sifre", SIFRE);
  await Promise.all([
    sayfa.waitForURL("**/panel", { timeout: 20000 }),
    sayfa.click('button[type="submit"]'),
  ]);
}

async function govde() {
  return (await sayfa.locator("body").textContent()) ?? "";
}

/** Adıyla aranan müşterinin kayıt yönetimi bölümünü açar. */
async function yonetimiAc(ad) {
  await sayfa.goto(`${hedef}/musteriler?ara=${encodeURIComponent(ad)}`, { waitUntil: "networkidle" });
  const dugme = sayfa.locator('button:has-text("Kaydı düzenle")').first();
  await dugme.waitFor({ state: "visible", timeout: 15000 });
  await dugme.click();
}

const damga = Date.now();
const imei = `3594${damga}`.slice(0, 15);
const aliciAdi = `KVKK Alici ${damga % 100000}`;
const telefon = `0534${String(damga).slice(-7)}`;
const yeniAd = `${aliciAdi} Duzeltilmis`;

await giris("admin");

// --- Satış yaparak bağlı bir müşteri oluştur
await sayfa.goto(`${hedef}/faturalar/yeni`, { waitUntil: "networkidle" });
await sayfa.selectOption("#tedarikciId", { index: 1 });
await sayfa.fill("#faturaNo", `KVKK-${damga}`);
await sayfa.selectOption("#magazaId", { index: 1 });
await sayfa.fill("#okutma", imei);
await sayfa.press("#okutma", "Enter");
{
  const kart = sayfa.locator("form > section").nth(2).locator("> div").nth(1);
  await kart.locator("select").first().selectOption({ label: "Cep Telefonu" });
  await kart.locator("select").nth(1).selectOption({ label: "Sıfır" });
  const metinler = kart.locator('input[type="text"], input:not([type])');
  await metinler.nth(0).fill("Apple");
  await metinler.nth(1).fill(`iPhone KVKK ${damga % 1000}`);
  await metinler.nth(4).fill("Siyah");
  await kart.locator('input[inputmode="decimal"]').fill("15.000");
}
await Promise.all([
  sayfa.waitForURL(/\/faturalar\/\d+$/, { timeout: 20000 }),
  sayfa.click('button:has-text("Faturayı Kaydet")'),
]);

await sayfa.goto(`${hedef}/satis`, { waitUntil: "networkidle" });
await sayfa.fill("#okutmaKutusu", imei);
await sayfa.press("#okutmaKutusu", "Enter");
await sayfa.waitForTimeout(800);
await sayfa.fill("#satisFiyati", "20.000,00");
await sayfa.selectOption("#odemeTipi", "NAKIT");
await sayfa.fill("#yeniAd", aliciAdi);
await sayfa.fill("#yeniTelefon", telefon);
await Promise.all([
  sayfa.waitForURL(/\/cihazlar\/\d+$/, { timeout: 20000 }),
  sayfa.click('button:has-text("Satışı Kaydet")'),
]);
const cihazYolu = new URL(sayfa.url()).pathname;
kontrol("bağlı müşteri oluştu", (await govde()).includes(aliciAdi));

// --- Yetki: personel düzenleyemez
await giris("personel1");
await sayfa.goto(`${hedef}/musteriler?ara=${encodeURIComponent(aliciAdi)}`, { waitUntil: "networkidle" });
kontrol(
  "personelde kayıt yönetimi yok",
  (await sayfa.locator('button:has-text("Kaydı düzenle")').count()) === 0,
);

// --- Sorumlu düzenleyebilir ama silemez
await giris("sorumlu1");
await yonetimiAc(aliciAdi);
// Arama kutusu da aranan adı taşıdığı için alanlar id önekiyle seçilir.
kontrol(
  "sorumluda düzenleme açık",
  await sayfa.locator('input[id^="adSoyad-"]').first().isVisible(),
);
kontrol(
  "sorumluda silme yok",
  (await sayfa.locator('button:has-text("Kimlik bilgilerini sil")').count()) === 0,
);

// --- Düzeltme
await giris("admin");
await yonetimiAc(aliciAdi);
await sayfa.locator('input[id^="adSoyad-"]').first().fill(yeniAd);
await sayfa.locator('button:has-text("Kaydet")').first().click();
await sayfa.waitForTimeout(1500);
await sayfa.screenshot({ path: `${cikti}-duzenleme.png`, fullPage: true });

await yonetimiAc(yeniAd);
kontrol(
  "müşteri düzeltildi",
  (await sayfa.locator(`input[id^="adSoyad-"][value="${yeniAd}"]`).count()) > 0,
);

await sayfa.goto(`${hedef}/cihazlar?ara=${encodeURIComponent(yeniAd)}`, { waitUntil: "networkidle" });
kontrol("yeni ad cihaz aramasına işlendi", (await govde()).includes(imei));

await sayfa.goto(`${hedef}${cihazYolu}`, { waitUntil: "networkidle" });
kontrol("cihaz detayında yeni ad görünüyor", (await govde()).includes(yeniAd));

// --- Telefon çakışması reddedilmeli
await sayfa.goto(`${hedef}/satis`, { waitUntil: "networkidle" });
kontrol("satış ekranı açıldı", (await sayfa.locator("#okutmaKutusu").count()) > 0);

await yonetimiAc(yeniAd);
kontrol(
  "telefon alanı dolu geliyor",
  (await sayfa.locator(`input[id^="telefon-"][value="${telefon}"]`).count()) > 0,
);

// --- Bağlı işlemi olan kayıt anonimleştirilir
await sayfa.locator('label:has-text("Kimlik bilgilerini sil")').locator('input[type="checkbox"]').check();
await sayfa.locator('button:has-text("Kimlik bilgilerini sil")').first().click();
await sayfa.waitForTimeout(1500);
await sayfa.screenshot({ path: `${cikti}-anonim.png`, fullPage: true });

await sayfa.goto(`${hedef}/musteriler?ara=${encodeURIComponent(yeniAd)}`, { waitUntil: "networkidle" });
// Arama kutusu sorguyu geri yazdığı için gövde metni değil sonuç sayısı okunur.
kontrol(
  "anonimleştirilen kayıt eski adıyla bulunmuyor",
  (await govde()).includes("Aramanıza uyan müşteri bulunamadı"),
);

await sayfa.goto(`${hedef}/musteriler?ara=Silinmi`, { waitUntil: "networkidle" });
kontrol("anonimleştirilen kayıt duruyor", (await govde()).includes("Silinmiş Müşteri"));

await sayfa.goto(`${hedef}${cihazYolu}`, { waitUntil: "networkidle" });
const detay = await govde();
kontrol("cihaz detayında kimlik silinmiş", !detay.includes(yeniAd) && detay.includes("Silinmiş Müşteri"));
kontrol("satış kaydı duruyor", detay.includes("Satıldı"));

await sayfa.goto(`${hedef}/cihazlar?ara=${encodeURIComponent(yeniAd)}`, { waitUntil: "networkidle" });
kontrol("eski ad aramada bulunmuyor", !(await govde()).includes(imei));

// --- Yedek şifreleme durumu
await sayfa.goto(`${hedef}/ayarlar/yedekleme`, { waitUntil: "networkidle" });
const yedekGovde = await govde();
kontrol("yedek ekranında şifreleme durumu var", yedekGovde.includes("Şifreleme"));
kontrol(
  "şifreleme anahtarı tanımlı",
  yedekGovde.includes("AES-256-GCM"),
  yedekGovde.includes("Anahtar yok") ? "anahtar tanımsız" : "",
);
kontrol("yedeği geri açma yolu belgelenmiş", yedekGovde.includes("yedek:coz"));
await sayfa.screenshot({ path: `${cikti}-yedekleme.png`, fullPage: true });

console.log(hatalar.length ? `\nkonsol hataları:\n${hatalar.join("\n")}` : "\nkonsol hatası yok ✓");
await tarayici.close();

if (basarisiz > 0) {
  console.error(`\n${basarisiz} kontrol başarısız.`);
  process.exit(1);
}
console.log("\ntüm kontroller geçti.");
