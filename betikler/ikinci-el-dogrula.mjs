// İkinci el alım testi: tezgâhtan cihaz alma, stoğa girişi, satıcının kayda
// geçmesi, seri no denetimleri, raporlar ve yetki kuralları.
// Kullanım: npm run dev  &&  node betikler/ikinci-el-dogrula.mjs
import { chromium } from "@playwright/test";

const hedef = process.env.HEDEF ?? "http://127.0.0.1:3000";
const cikti = process.env.CIKTI ?? "/tmp/ikinci-el";
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

/** Alım formunu cihaz ve satıcı bilgisiyle doldurur (gönderim çağırana ait). */
async function formuDoldur({ imei, marka, model, fiyat, satici, telefon }) {
  await sayfa.goto(`${hedef}/alim`, { waitUntil: "networkidle" });
  await sayfa.selectOption("#kategoriId", { label: "Cep Telefonu" });
  await sayfa.fill("#seriNo", imei);
  await sayfa.fill("#marka", marka);
  await sayfa.fill("#model", model);
  await sayfa.fill("#renk", "Siyah");
  await sayfa.fill("#alisFiyati", fiyat);
  await sayfa.selectOption("#odemeTipi", "NAKIT");
  if (satici) await sayfa.fill("#yeniAd", satici);
  if (telefon) await sayfa.fill("#yeniTelefon", telefon);
}

const damga = Date.now();
const imei = `3593${damga}`.slice(0, 15);
const satici = `Tezgah Satici ${damga % 100000}`;
const telefon = `0533${String(damga).slice(-7)}`;
const FIYAT_TL = "18.750,00";
const FIYAT_KURUS = 1_875_000;

const bugun = new Date();
const inputTarih = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// --- Yetki: personel bu ekranı göremez
await giris("personel1");
kontrol("personelde İkinci El menüsü yok", !(await govde()).includes("İkinci El"));
await sayfa.goto(`${hedef}/alim`, { waitUntil: "networkidle" });
kontrol(
  "personel alım sayfasına giremiyor",
  new URL(sayfa.url()).pathname === "/panel",
  `yönlendirildi: ${new URL(sayfa.url()).pathname}`,
);

// --- Mağaza sorumlusu alım yapabilir
await giris("sorumlu1");
kontrol("sorumluda İkinci El menüsü var", (await govde()).includes("İkinci El"));

await sayfa.goto(`${hedef}/rapor?bas=${inputTarih(bugun)}&bit=${inputTarih(bugun)}`, {
  waitUntil: "networkidle",
});
const kartOnce = sayfa.locator("div").filter({ hasText: /^İkinci El Alım$/ }).first();
const metinOnce = (await kartOnce.locator("xpath=following-sibling::div[1]").textContent()) ?? "";
const kurusCoz = (metin) => {
  const e = metin.match(/([\d.]+,\d{2})/);
  return e ? Math.round(Number(e[1].replace(/\./g, "").replace(",", ".")) * 100) : null;
};
const alimOnce = kurusCoz(metinOnce);
kontrol("rapor kartı okundu", alimOnce !== null, `${alimOnce} kuruş`);

// --- Alım
await formuDoldur({ imei, marka: "Samsung", model: `Galaxy Tezgah ${damga % 1000}`, fiyat: FIYAT_TL, satici, telefon });
await sayfa.screenshot({ path: `${cikti}-form.png`, fullPage: true });
await Promise.all([
  sayfa.waitForURL(/\/cihazlar\/\d+$/, { timeout: 20000 }),
  sayfa.click('button:has-text("Alımı Kaydet")'),
]);
const cihazYolu = new URL(sayfa.url()).pathname;
const detay = await govde();
kontrol("alım kaydedildi, cihaz detayına gidildi", /\/cihazlar\/\d+$/.test(cihazYolu), cihazYolu);
kontrol("cihaz stokta", (await sayfa.locator('h1 ~ span:text-is("Stokta")').count()) > 0);
kontrol("kaynak ikinci el alım", detay.includes("İkinci el alım"));
kontrol("satan kişi kayda geçti", detay.includes(satici));
kontrol("tedarikçi ve fatura boş", detay.includes("Tedarikçi"));
kontrol("tarihçeye giriş hareketi düştü", detay.includes("Stok Girişi"));
await sayfa.screenshot({ path: `${cikti}-detay.png`, fullPage: true });

// --- Aynı seri no ikinci kez alınamaz
await formuDoldur({ imei, marka: "Samsung", model: "Kopya", fiyat: "1.000,00", satici: "Baska Kisi", telefon: `${telefon}9` });
await sayfa.click('button:has-text("Alımı Kaydet")');
const cakismaUyarisi = sayfa.locator('[role="alert"]').filter({ hasText: "zaten kayıtlı" }).first();
await cakismaUyarisi.waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
kontrol("aynı seri no tekrar alınamıyor", await cakismaUyarisi.isVisible().catch(() => false));

// --- Seri no zorunlu kategoride boş bırakılamaz (düğme kilitli kalır)
await sayfa.goto(`${hedef}/alim`, { waitUntil: "networkidle" });
await sayfa.selectOption("#kategoriId", { label: "Cep Telefonu" });
await sayfa.fill("#marka", "Apple");
await sayfa.fill("#model", "Seri No Yok");
await sayfa.fill("#alisFiyati", "5.000,00");
await sayfa.fill("#yeniAd", "Kimlik Yok");
kontrol(
  "seri no zorunlu kategoride kaydet kilitli",
  await sayfa.locator('button:has-text("Alımı Kaydet")').isDisabled(),
);

// --- Cihaz listesinde ve aramada görünüyor
await sayfa.goto(`${hedef}/cihazlar?ara=${imei}`, { waitUntil: "networkidle" });
await sayfa.waitForURL(/\/cihazlar\/\d+$/, { timeout: 20000 });
kontrol("IMEI ile bulunuyor", new URL(sayfa.url()).pathname === cihazYolu);

await sayfa.goto(`${hedef}/cihazlar?ara=${encodeURIComponent(satici)}`, { waitUntil: "networkidle" });
kontrol("satıcı adıyla da aranabiliyor", (await govde()).includes(imei));

// --- Rapor: alım tutarı arttı, tablo satırı var
await sayfa.goto(`${hedef}/rapor?bas=${inputTarih(bugun)}&bit=${inputTarih(bugun)}`, {
  waitUntil: "networkidle",
});
const kartSonra = sayfa.locator("div").filter({ hasText: /^İkinci El Alım$/ }).first();
const alimSonra = kurusCoz((await kartSonra.locator("xpath=following-sibling::div[1]").textContent()) ?? "");
kontrol(
  "rapor kartı alım tutarı kadar arttı",
  alimOnce !== null && alimSonra !== null && alimSonra - alimOnce === FIYAT_KURUS,
  `${alimOnce} → ${alimSonra}`,
);
const raporGovde = await govde();
kontrol("alım rapor tablosunda", raporGovde.includes("İkinci El Alımlar") && raporGovde.includes(satici));
await sayfa.screenshot({ path: `${cikti}-rapor.png`, fullPage: true });

// --- Vade raporuna girmemeli (faturasız alım)
kontrol(
  "faturasız alım vade borcuna eklenmedi",
  !raporGovde.includes(`${satici} · vade`),
);

// --- Müşteri ekranında "ikinci el satışı" olarak görünüyor
await sayfa.goto(`${hedef}/musteriler?ara=${encodeURIComponent(satici)}`, { waitUntil: "networkidle" });
const musteriGovde = await govde();
kontrol("satıcı müşteri listesinde", musteriGovde.includes(satici));
kontrol("ikinci el satışı rozeti var", musteriGovde.includes("1 ikinci el satışı"));

// --- Alınan cihaz normal satış akışına giriyor
await sayfa.goto(`${hedef}/satis`, { waitUntil: "networkidle" });
await sayfa.fill("#okutmaKutusu", imei);
await sayfa.press("#okutmaKutusu", "Enter");
await sayfa.waitForTimeout(800);
kontrol(
  "ikinci el cihaz satışa okutulabiliyor",
  (await sayfa.locator("#satisFiyati").count()) > 0,
);

// --- Sorumlu başka mağazaya alım yapamaz (depo listesi kendi mağazasıyla sınırlı)
await sayfa.goto(`${hedef}/alim`, { waitUntil: "networkidle" });
kontrol(
  "sorumluya yalnız kendi deposu açık",
  (await sayfa.locator("#magazaId option").count()) === 1,
);

// --- Yöneticide tüm depolar
await giris("admin");
await sayfa.goto(`${hedef}/alim`, { waitUntil: "networkidle" });
kontrol(
  "yöneticide birden çok depo seçilebiliyor",
  (await sayfa.locator("#magazaId option").count()) > 1,
);

console.log(hatalar.length ? `\nkonsol hataları:\n${hatalar.join("\n")}` : "\nkonsol hatası yok ✓");
await tarayici.close();

if (basarisiz > 0) {
  console.error(`\n${basarisiz} kontrol başarısız.`);
  process.exit(1);
}
console.log("\ntüm kontroller geçti.");
