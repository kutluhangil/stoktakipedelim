// Faz 6 testi: sayım farkının işlenmesi, sevkiyattaki cihazın sayıma girmesi,
// arızalı işaretleme, serbest vade günü, firma adı ayarı ve Excel kesme uyarısı.
// Kullanım: npm run dev  &&  node betikler/kucuk-eksikler-dogrula.mjs
import { chromium } from "@playwright/test";

const hedef = process.env.HEDEF ?? "http://127.0.0.1:3000";
const cikti = process.env.CIKTI ?? "/tmp/kucuk";
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

const damga = Date.now();
// Son haneler farklı olmalı: damgaya eklenen fark slice ile kesiliyordu.
const imeiler = [0, 1, 2].map((i) => `3595${String(damga).slice(-10)}${i}`);
const VADE_GUN = "37";

await giris("admin");

// --- Serbest vade günü ile fatura
await sayfa.goto(`${hedef}/faturalar/yeni`, { waitUntil: "networkidle" });
await sayfa.selectOption("#tedarikciId", { index: 1 });
await sayfa.fill("#faturaNo", `KUCUK-${damga}`);
await sayfa.selectOption("#magazaId", { index: 1 });
kontrol("vade alanı serbest sayı girişi", (await sayfa.locator("#vadeGun").getAttribute("type")) === "number");
await sayfa.fill("#vadeGun", VADE_GUN);
// Faturada iki cihaz; üçüncüsü ikinci el alımdan girilip sevkiyata verilecek.
for (const kod of imeiler.slice(0, 2)) {
  await sayfa.fill("#okutma", kod);
  await sayfa.press("#okutma", "Enter");
}
for (let i = 0; i < 2; i++) {
  const kart = sayfa.locator("form > section").nth(2).locator("> div").nth(i + 1);
  await kart.locator("select").first().selectOption({ label: "Cep Telefonu" });
  await kart.locator("select").nth(1).selectOption({ label: "Sıfır" });
  const metinler = kart.locator('input[type="text"], input:not([type])');
  await metinler.nth(0).fill("Nokia");
  await metinler.nth(1).fill(`Kucuk Eksik ${i + 1}`);
  await metinler.nth(4).fill("Gri");
  await kart.locator('input[inputmode="decimal"]').fill("8.000");
}
await Promise.all([
  sayfa.waitForURL(/\/faturalar\/\d+$/, { timeout: 20000 }),
  sayfa.click('button:has-text("Faturayı Kaydet")'),
]);
const faturaGovde = await govde();
kontrol("serbest vade kaydedildi", faturaGovde.includes(`${VADE_GUN} gün`), `${VADE_GUN} gün`);
await sayfa.screenshot({ path: `${cikti}-fatura.png`, fullPage: true });

// --- Cihaz detayı: arızalı işaretleme
await sayfa.goto(`${hedef}/cihazlar?ara=${imeiler[0]}`, { waitUntil: "networkidle" });
await sayfa.waitForURL(/\/cihazlar\/\d+$/, { timeout: 20000 });
const cihazYolu = new URL(sayfa.url()).pathname;
const depoAdi = (
    (await sayfa.locator("dt:has-text('Bulunduğu Depo') + dd").textContent()) ?? ""
  ).trim();
kontrol("test deposu belirlendi", depoAdi.length > 0, depoAdi);
kontrol("stoktaki cihazda arıza kartı var", (await sayfa.locator('button:has-text("Arızalı işaretle")').count()) > 0);
kontrol("tarihçede giriş hareketi var", (await govde()).includes("Stok Girişi"));

await sayfa.click('button:has-text("Arızalı işaretle")');
await sayfa.fill("#arizaNeden", "ekran değişimi gerekiyor");
await sayfa.click('button:has-text("Arızalı işaretle")');
await sayfa.waitForTimeout(1500);
await sayfa.goto(`${hedef}${cihazYolu}`, { waitUntil: "networkidle" });
kontrol("cihaz arızalı oldu", (await sayfa.locator('h1 ~ span:text-is("Arızalı")').count()) > 0);
kontrol("arızalı cihaz satışa açılabiliyor", (await sayfa.locator('button:has-text("Satışa aç")').count()) > 0);
await sayfa.screenshot({ path: `${cikti}-arizali.png`, fullPage: true });

await sayfa.goto(`${hedef}/cihazlar?durum=ARIZALI`, { waitUntil: "networkidle" });
kontrol("arızalı filtresi çalışıyor", (await govde()).includes(imeiler[0]));

// Servis dönüşü: stoğa geri al
await sayfa.goto(`${hedef}${cihazYolu}`, { waitUntil: "networkidle" });
await sayfa.fill("#stogaAciklama", "servisten geldi");
await sayfa.click('button:has-text("Satışa aç")');
await sayfa.waitForTimeout(1500);
await sayfa.goto(`${hedef}${cihazYolu}`, { waitUntil: "networkidle" });
kontrol("servis dönüşü stoğa döndü", (await sayfa.locator('h1 ~ span:text-is("Stokta")').count()) > 0);

// --- Üçüncü cihaz ikinci el alımdan girilir
await sayfa.goto(`${hedef}/alim`, { waitUntil: "networkidle" });
await sayfa.selectOption("#kategoriId", { label: "Cep Telefonu" });
await sayfa.selectOption("#magazaId", { label: depoAdi });
await sayfa.fill("#seriNo", imeiler[2]);
await sayfa.fill("#marka", "Nokia");
await sayfa.fill("#model", "Kucuk Eksik 3");
await sayfa.fill("#alisFiyati", "8.000,00");
await sayfa.fill("#yeniAd", `Kucuk Satici ${damga % 10000}`);
await Promise.all([
  sayfa.waitForURL(/\/cihazlar\/\d+$/, { timeout: 20000 }),
  sayfa.click('button:has-text("Alımı Kaydet")'),
]);
kontrol("üçüncü cihaz ikinci elden girildi", /\/cihazlar\/\d+$/.test(new URL(sayfa.url()).pathname));

// --- Sevkiyat: bir cihaz yolda kalsın
await sayfa.goto(`${hedef}/sevkiyat/yeni`, { waitUntil: "networkidle" });
await sayfa.selectOption("#kaynak", { label: depoAdi });
const hedefSecenekleri = await sayfa.locator("#hedef option").allTextContents();
const baskaDepo = hedefSecenekleri.find((o) => o.trim() && o.trim() !== depoAdi && !o.includes("Seçin"));
await sayfa.selectOption("#hedef", { label: baskaDepo });
await sayfa.fill("#okutmaKutusu", imeiler[2]);
await sayfa.press("#okutmaKutusu", "Enter");
await sayfa.waitForTimeout(1000);
await Promise.all([
  sayfa.waitForURL(/\/sevkiyat\/\d+$/, { timeout: 20000 }).catch(() => {}),
  sayfa.locator('button:has-text("Sevkiyatı Gönder")').click(),
]);
kontrol("sevkiyat gönderildi", /\/sevkiyat\/\d+$/.test(new URL(sayfa.url()).pathname), new URL(sayfa.url()).pathname);

// --- Sayım: sevkiyattaki cihaz listede görünmeli, eksik cihaz kayıp işlenmeli
await sayfa.goto(`${hedef}/sayim`, { waitUntil: "networkidle" });
const sayimFormu = sayfa.locator("form").filter({ has: sayfa.locator('select[name="magazaId"]') }).first();
// Seçenek metni "<depo> — N cihaz" biçiminde; değer üzerinden seçilir.
const depoSecenekleri = sayimFormu.locator('select[name="magazaId"] option');
let depoDegeri = "";
for (let i = 0; i < (await depoSecenekleri.count()); i++) {
  const secenek = depoSecenekleri.nth(i);
  const metin = ((await secenek.textContent()) ?? "").trim();
  if (metin.startsWith(depoAdi)) {
    depoDegeri = (await secenek.getAttribute("value")) ?? "";
    break;
  }
}
kontrol("sayım için depo seçeneği bulundu", depoDegeri !== "", depoAdi);
await sayimFormu.locator('select[name="magazaId"]').selectOption(depoDegeri);
await Promise.all([
  sayfa.waitForURL(/\/sayim\/\d+$/, { timeout: 20000 }).catch(() => {}),
  sayimFormu.locator('button[type="submit"]').click(),
]);
const sayimYolu = new URL(sayfa.url()).pathname;
kontrol("sayım başladı", /\/sayim\/\d+$/.test(sayimYolu), sayimYolu);

const sayimGovde = await govde();
kontrol("sevkiyattaki cihaz sayımda görünüyor", sayimGovde.includes("Sevkiyatta"));
await sayfa.screenshot({ path: `${cikti}-sayim.png`, fullPage: true });

// Bir cihazı okut, diğeri eksik kalsın
await sayfa.fill("#okutmaKutusu", imeiler[0]);
await sayfa.press("#okutmaKutusu", "Enter");
await sayfa.waitForTimeout(1200);

await sayfa.click('button:has-text("Sayımı Kapat")');
await sayfa.waitForTimeout(1800);
await sayfa.goto(`${hedef}${sayimYolu}`, { waitUntil: "networkidle" });
kontrol("sayım kapandı", (await govde()).includes("Tamamlandı"));

kontrol(
  "sayım farkı işleme düğmesi çıktı",
  (await sayfa.locator('button:has-text("Sayım farkını işle")').count()) > 0,
);
await sayfa.locator('label:has-text("kayıp olarak işle")').locator('input[type="checkbox"]').check();
await sayfa.click('button:has-text("Sayım farkını işle")');
await sayfa.waitForTimeout(1800);
await sayfa.goto(`${hedef}/cihazlar?durum=KAYIP`, { waitUntil: "networkidle" });
const kayipGovde = await govde();
kontrol("eksik cihaz kayıp işlendi", kayipGovde.includes(imeiler[1]), imeiler[1]);
await sayfa.screenshot({ path: `${cikti}-kayip.png`, fullPage: true });

await sayfa.goto(`${hedef}/cihazlar?ara=${imeiler[1]}`, { waitUntil: "networkidle" });
await sayfa.waitForURL(/\/cihazlar\/\d+$/, { timeout: 20000 });
kontrol("kayıp cihazda sayım farkı hareketi var", (await govde()).includes("Sayım Farkı"));
kontrol(
  "kayıp cihaz bulunursa satışa açılabiliyor",
  (await sayfa.locator('button:has-text("Satışa aç")').count()) > 0,
);

// --- Firma adı ayarı
await sayfa.goto(`${hedef}/ayarlar`, { waitUntil: "networkidle" });
kontrol("firma adı alanı var", (await sayfa.locator("#firmaAdi").count()) > 0);
const eskiFirma = await sayfa.locator("#firmaAdi").inputValue();
const yeniFirma = `Test Bayi ${damga % 10000}`;
await sayfa.fill("#firmaAdi", yeniFirma);
await sayfa.locator("#firmaAdi").locator("xpath=ancestor::form").locator('button[type="submit"]').click();
await sayfa.waitForTimeout(1500);
await sayfa.goto(`${hedef}/panel`, { waitUntil: "networkidle" });
kontrol("firma adı üst menüye yansıdı", (await govde()).includes(yeniFirma), yeniFirma);

// Eski adı geri koy
await sayfa.goto(`${hedef}/ayarlar`, { waitUntil: "networkidle" });
await sayfa.fill("#firmaAdi", eskiFirma);
await sayfa.locator("#firmaAdi").locator("xpath=ancestor::form").locator('button[type="submit"]').click();
await sayfa.waitForTimeout(1200);

// --- Excel dışa aktarma çalışıyor (kesme uyarısı sınır altında görünmez)
const indirme = sayfa.waitForEvent("download", { timeout: 20000 }).catch(() => null);
await sayfa.goto(`${hedef}/cihazlar`, { waitUntil: "networkidle" });
await sayfa.click('a:has-text("Excel")').catch(() => {});
const dosya = await indirme;
kontrol("cihaz listesi Excel'e aktarılıyor", dosya !== null, dosya ? await dosya.suggestedFilename() : "indirme yok");

console.log(hatalar.length ? `\nkonsol hataları:\n${hatalar.join("\n")}` : "\nkonsol hatası yok ✓");
await tarayici.close();

if (basarisiz > 0) {
  console.error(`\n${basarisiz} kontrol başarısız.`);
  process.exit(1);
}
console.log("\ntüm kontroller geçti.");
