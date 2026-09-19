// Satış iadesi akışı testi: iade alma, satışın raporlardan düşmesi, müşteri
// tarihçesinde görünmesi, tekrar satışa açma, tarih ve yetki kuralları.
// Kullanım: npm run dev  &&  node betikler/iade-dogrula.mjs
import { chromium } from "@playwright/test";

const hedef = process.env.HEDEF ?? "http://127.0.0.1:3000";
const cikti = process.env.CIKTI ?? "/tmp/iade";
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

/** Satış ekranında kod okutur, geri bildirim metnini döndürür. */
async function satisOkut(kod) {
  await sayfa.fill("#okutmaKutusu", kod);
  await sayfa.press("#okutmaKutusu", "Enter");
  await sayfa.waitForTimeout(800);
  const kap = sayfa.locator("#okutmaKutusu").locator("xpath=ancestor::div[2]");
  return (await kap.textContent())?.trim();
}

/** Rapor ekranındaki bir sayı kartının değerini kuruş olarak okur. */
async function kartKurus(etiket) {
  const baslik = sayfa.locator("div").filter({ hasText: new RegExp("^" + etiket + "$") }).first();
  const metin = (await baslik.locator("xpath=following-sibling::div[1]").textContent()) ?? "";
  const eslesme = metin.match(/(-?[\d.]+,\d{2})/);
  if (!eslesme) return null;
  const negatif = eslesme[1].startsWith("-");
  const sayi = Math.round(
    Number(eslesme[1].replace("-", "").replace(/\./g, "").replace(",", ".")) * 100,
  );
  return negatif ? -sayi : sayi;
}

const damga = Date.now();
const imeiA = `3591${damga}`.slice(0, 15);
const imeiB = `3592${damga + 11}`.slice(0, 15);
const musteriAdi = `Iade Testi ${damga % 100000}`;
const telefon = `0532${String(damga).slice(-7)}`;
const SATIS_TL = "33.333,33";
const SATIS_KURUS = 3_333_333;
const ALIS_KURUS = 2_000_000;

const bugun = new Date();
const inputTarih = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dun = new Date(bugun);
dun.setDate(dun.getDate() - 1);

await giris("admin");

// --- Test cihazları: iki kalemlik alış faturası (1 Nolu Mağaza'ya)
await sayfa.goto(`${hedef}/faturalar/yeni`, { waitUntil: "networkidle" });
await sayfa.selectOption("#tedarikciId", { index: 1 });
await sayfa.fill("#faturaNo", `IADE-${damga}`);
await sayfa.selectOption("#magazaId", { index: 1 });
for (const kod of [imeiA, imeiB]) {
  await sayfa.fill("#okutma", kod);
  await sayfa.press("#okutma", "Enter");
}
for (let i = 0; i < 2; i++) {
  const kart = sayfa.locator("form > section").nth(2).locator("> div").nth(i + 1);
  await kart.locator("select").first().selectOption({ label: "Cep Telefonu" });
  await kart.locator("select").nth(1).selectOption({ label: "Sıfır" });
  const metinler = kart.locator('input[type="text"], input:not([type])');
  await metinler.nth(0).fill("Apple");
  await metinler.nth(1).fill(`iPhone İade ${i + 1}`);
  await metinler.nth(4).fill("Siyah");
  await kart.locator('input[inputmode="decimal"]').fill("20.000");
}
await Promise.all([
  sayfa.waitForURL(/\/faturalar\/\d+$/, { timeout: 20000 }),
  sayfa.click('button:has-text("Faturayı Kaydet")'),
]);

// --- Satış: A cihazı müşteriye satılır
await sayfa.goto(`${hedef}/satis`, { waitUntil: "networkidle" });
await satisOkut(imeiA);
await sayfa.fill("#satisFiyati", SATIS_TL);
await sayfa.selectOption("#odemeTipi", "NAKIT");
await sayfa.fill("#yeniAd", musteriAdi);
await sayfa.fill("#yeniTelefon", telefon);
await Promise.all([
  sayfa.waitForURL(/\/cihazlar\/\d+$/, { timeout: 20000 }),
  sayfa.click('button:has-text("Satışı Kaydet")'),
]);
const cihazYoluA = new URL(sayfa.url()).pathname;
kontrol("A cihazı satıldı", (await govde()).includes("Satıldı"), cihazYoluA);

// --- İade öncesi ciro (yalnız bugünün aralığı)
const raporSorgu = `?bas=${inputTarih(bugun)}&bit=${inputTarih(bugun)}`;
await sayfa.goto(`${hedef}/rapor${raporSorgu}`, { waitUntil: "networkidle" });
const ciroOnce = await kartKurus("Aralıktaki Satış");
const karOnce = await kartKurus("Aralıktaki Kâr");
kontrol("iade öncesi ciro okundu", ciroOnce !== null && karOnce !== null, `${ciroOnce} kuruş`);

// --- İade formu: satılmış cihazda görünür
await sayfa.goto(`${hedef}${cihazYoluA}`, { waitUntil: "networkidle" });
kontrol(
  "satılmış cihazda İade al düğmesi var",
  await sayfa.locator('button:has-text("İade al")').first().isVisible(),
);
await sayfa.screenshot({ path: `${cikti}-satilmis-detay.png`, fullPage: true });

// --- Satıştan önceki tarih reddedilmeli
await sayfa.click('button:has-text("İade al")');
await sayfa.fill("#iadeNeden", "14 gün cayma hakkı");
await sayfa.fill("#iadeTarihi", inputTarih(dun));
await sayfa.selectOption("#sonucDurum", "IADE");
await sayfa.click('button:has-text("İadeyi kaydet")');
const tarihUyarisi = sayfa
  .locator('[role="alert"]')
  .filter({ hasText: "satış tarihinden önce" })
  .first();
await tarihUyarisi.waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
kontrol("satıştan önceki iade tarihi reddedildi", await tarihUyarisi.isVisible().catch(() => false));

// --- Geçerli iade
await sayfa.fill("#iadeTarihi", inputTarih(bugun));
await sayfa.click('button:has-text("İadeyi kaydet")');
// Başarıda cihaz SATILDI olmaktan çıkar; sayfa yeniden render olur ve form kalkar.
await sayfa
  .locator('button:has-text("İadeyi kaydet")')
  .waitFor({ state: "detached", timeout: 20000 });

await sayfa.goto(`${hedef}${cihazYoluA}`, { waitUntil: "networkidle" });
const detay = await govde();
kontrol("iade kaydedildi", (await sayfa.locator('button:has-text("İade al")').count()) === 0);
await sayfa.screenshot({ path: `${cikti}-iade-sonrasi.png`, fullPage: true });
kontrol(
  "cihaz İade durumunda",
  (await sayfa.locator('h1 ~ span:text-is("İade")').count()) > 0 && !detay.includes("Satıldı"),
);
kontrol("satış kartı kalktı", !detay.includes("Satış ve Müşteri Bilgileri"));
kontrol("iade geçmişi kartı var", detay.includes("İade Geçmişi") && detay.includes(musteriAdi));
kontrol("tarihçeye iade hareketi düştü", detay.includes("iade etti"));

// --- Ciro ve kâr raporlardan düştü
await sayfa.goto(`${hedef}/rapor${raporSorgu}`, { waitUntil: "networkidle" });
const ciroSonra = await kartKurus("Aralıktaki Satış");
const karSonra = await kartKurus("Aralıktaki Kâr");
kontrol(
  "ciro satış tutarı kadar düştü",
  ciroOnce !== null && ciroSonra !== null && ciroOnce - ciroSonra === SATIS_KURUS,
  `${ciroOnce} → ${ciroSonra}`,
);
kontrol(
  "kâr da düştü",
  karOnce !== null && karSonra !== null && karOnce - karSonra === SATIS_KURUS - ALIS_KURUS,
  `${karOnce} → ${karSonra}`,
);
const raporGovde = await govde();
kontrol(
  "iade raporda listeleniyor",
  raporGovde.includes("Alınan İadeler") && raporGovde.includes(musteriAdi),
);
await sayfa.screenshot({ path: `${cikti}-rapor.png`, fullPage: true });

// --- Müşteri tarihçesi
await sayfa.goto(`${hedef}/musteriler?ara=${encodeURIComponent(musteriAdi)}`, {
  waitUntil: "networkidle",
});
const musteriGovde = await govde();
kontrol(
  "müşteri tarihçesinde iade görünüyor",
  musteriGovde.includes(musteriAdi) && musteriGovde.includes("1 iade"),
);
kontrol("iade edilen cihaz satın alınanlarda sayılmıyor", musteriGovde.includes("0 cihaz"));
await sayfa.screenshot({ path: `${cikti}-musteri.png`, fullPage: true });

// --- Liste filtresi
await sayfa.goto(`${hedef}/cihazlar?durum=IADE`, { waitUntil: "networkidle" });
kontrol("İade filtresinde görünüyor", (await govde()).includes(imeiA));

// --- İade durumundaki cihaz satılamaz
await sayfa.goto(`${hedef}/satis`, { waitUntil: "networkidle" });
const okutmaSonucu = await satisOkut(imeiA);
kontrol(
  "iade durumundaki cihaz satışa okutulamıyor",
  (okutmaSonucu ?? "").includes("satışa uygun değil"),
  okutmaSonucu,
);

// --- Satışa açma
await sayfa.goto(`${hedef}${cihazYoluA}`, { waitUntil: "networkidle" });
await sayfa.fill("#stogaAciklama", "kontrol edildi, sorun yok");
await sayfa.click('button:has-text("Satışa aç")');
await sayfa.locator('button:has-text("Satışa aç")').waitFor({ state: "detached", timeout: 20000 });
await sayfa.goto(`${hedef}${cihazYoluA}`, { waitUntil: "networkidle" });
kontrol("cihaz satışa açıldı", (await sayfa.locator('h1 ~ span:text-is("Stokta")').count()) > 0);

await sayfa.goto(`${hedef}/satis`, { waitUntil: "networkidle" });
const ikinciOkutma = await satisOkut(imeiA);
kontrol(
  "satışa açılan cihaz tekrar okutulabiliyor",
  !(ikinciOkutma ?? "").includes("uygun değil"),
  ikinciOkutma,
);

// --- B cihazı: yetki kontrolü için satılır
await sayfa.goto(`${hedef}/satis`, { waitUntil: "networkidle" });
await satisOkut(imeiB);
await sayfa.fill("#satisFiyati", "25.000,00");
await sayfa.selectOption("#odemeTipi", "NAKIT");
await sayfa.fill("#yeniAd", `${musteriAdi} B`);
await sayfa.fill("#yeniTelefon", `${telefon}9`);
await Promise.all([
  sayfa.waitForURL(/\/cihazlar\/\d+$/, { timeout: 20000 }),
  sayfa.click('button:has-text("Satışı Kaydet")'),
]);
const cihazYoluB = new URL(sayfa.url()).pathname;

await giris("personel2");
await sayfa.goto(`${hedef}${cihazYoluB}`, { waitUntil: "networkidle" });
kontrol(
  "başka mağazanın personeli iade alamıyor",
  (await sayfa.locator('button:has-text("İade al")').count()) === 0,
);

await giris("personel1");
await sayfa.goto(`${hedef}${cihazYoluB}`, { waitUntil: "networkidle" });
kontrol(
  "kendi mağazasının personeli iade alabiliyor",
  await sayfa.locator('button:has-text("İade al")').first().isVisible(),
);

console.log(hatalar.length ? `\nkonsol hataları:\n${hatalar.join("\n")}` : "\nkonsol hatası yok ✓");
await tarayici.close();

if (basarisiz > 0) {
  console.error(`\n${basarisiz} kontrol başarısız.`);
  process.exit(1);
}
console.log("\ntüm kontroller geçti.");
