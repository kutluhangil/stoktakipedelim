// Cihaz kaydı düzeltme ve iptal testi: yetki, kilitli durumlar, iptal/geri al,
// listeden düşme ve arama metninin güncellenmesi.
// Kullanım: npm run dev  &&  node betikler/cihaz-duzenle-dogrula.mjs
import { chromium } from "@playwright/test";

const hedef = process.env.HEDEF ?? "http://127.0.0.1:3000";
const cikti = process.env.CIKTI ?? "/tmp/cihaz-duzenle";
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

async function metniBekle(secici, parca) {
  const el = sayfa.locator(secici).filter({ hasText: parca }).first();
  await el.waitFor({ state: "visible", timeout: 15000 });
  return (await el.textContent())?.trim();
}

const imei = `3599${Date.now()}`.slice(0, 15);
// Çakışma testi için ikinci bir cihaz aynı faturada girilir.
const ikinciImei = `3598${Date.now() + 7}`.slice(0, 15);

await giris("admin");

// --- Test için tek cihazlık bir alış faturası gir
await sayfa.goto(`${hedef}/faturalar/yeni`, { waitUntil: "networkidle" });
await sayfa.selectOption("#tedarikciId", { index: 1 });
await sayfa.fill("#faturaNo", `DUZ-${Date.now()}`);
await sayfa.selectOption("#magazaId", { index: 1 });
await sayfa.fill("#okutma", imei);
await sayfa.press("#okutma", "Enter");
await sayfa.fill("#okutma", ikinciImei);
await sayfa.press("#okutma", "Enter");

for (let i = 0; i < 2; i++) {
  const kart = sayfa.locator("form > section").nth(2).locator("> div").nth(i + 1);
  await kart.locator("select").first().selectOption({ label: "Cep Telefonu" });
  await kart.locator("select").nth(1).selectOption({ label: "Sıfır" });
  const metinler = kart.locator('input[type="text"], input:not([type])');
  await metinler.nth(0).fill("Samsung");
  await metinler.nth(1).fill(`Galaxy Test ${i + 1}`);
  await metinler.nth(4).fill("Siyah");
  await kart.locator('input[inputmode="decimal"]').fill("10.000");
}

await Promise.all([
  sayfa.waitForURL(/\/faturalar\/\d+$/, { timeout: 20000 }),
  sayfa.click('button:has-text("Faturayı Kaydet")'),
]);

// Cihazın detay sayfasına IMEI aramasıyla git (tam eşleşme detaya yönlendirir)
await sayfa.goto(`${hedef}/cihazlar?ara=${imei}`, { waitUntil: "networkidle" });
await sayfa.waitForURL(/\/cihazlar\/\d+$/, { timeout: 20000 });
const cihazYolu = new URL(sayfa.url()).pathname;
const cihazId = Number(cihazYolu.split("/").pop());
kontrol("test cihazı oluştu", Number.isInteger(cihazId), `#${cihazId} ${imei}`);

// --- Yönetici düğmeleri görünüyor mu
kontrol(
  "yöneticide Düzenle düğmesi var",
  await sayfa.locator('a:has-text("Düzenle")').first().isVisible(),
);
kontrol(
  "yöneticide Kayıt Yönetimi kartı var",
  await sayfa.locator('text=Kaydı iptal et').first().isVisible(),
);
await sayfa.screenshot({ path: `${cikti}-detay-admin.png`, fullPage: true });

// --- Düzenleme: marka/model/renk değişir, arama metni de güncellenmeli
await sayfa.goto(`${hedef}${cihazYolu}/duzenle`, { waitUntil: "networkidle" });
await sayfa.fill("#marka", "Xiaomi");
await sayfa.fill("#model", "Redmi Kılıf Testi");
await sayfa.fill("#renk", "Mavi");
await sayfa.fill("#alisFiyati", "12.345,67");
await sayfa.screenshot({ path: `${cikti}-duzenleme-formu.png`, fullPage: true });
await Promise.all([
  sayfa.waitForURL(new RegExp(`${cihazYolu}$`), { timeout: 20000 }),
  sayfa.click('button:has-text("Değişiklikleri kaydet")'),
]);
const govde = (await sayfa.locator("body").textContent()) ?? "";
kontrol("düzenleme uygulandı", govde.includes("Xiaomi") && govde.includes("Mavi"));
kontrol("alış fiyatı güncellendi", govde.includes("12.345,67"));
kontrol(
  "tarihçeye düzeltme hareketi düştü",
  govde.includes("Kayıt düzeltildi"),
);

// --- Arama metni yeniden üretildi mi (Türkçe karakter duyarsız arama)
await sayfa.goto(`${hedef}/cihazlar?ara=KILIF`, { waitUntil: "networkidle" });
kontrol(
  "yeni model arama metnine işlendi",
  ((await sayfa.locator("body").textContent()) ?? "").includes(imei),
);

// --- Seri no zorunlu kategoride boşaltılamaz
await sayfa.goto(`${hedef}${cihazYolu}/duzenle`, { waitUntil: "networkidle" });
await sayfa.fill("#seriNo", "");
await sayfa.click('button:has-text("Değişiklikleri kaydet")');
kontrol(
  "seri no zorunlu kategoride boş bırakılamaz",
  Boolean(await metniBekle('[role="alert"]', "zorunlu")),
);

// --- Seri no başka bir cihazda kullanılıyorsa reddedilmeli
await sayfa.goto(`${hedef}${cihazYolu}/duzenle`, { waitUntil: "networkidle" });
await sayfa.fill("#seriNo", ikinciImei);
await sayfa.click('button:has-text("Değişiklikleri kaydet")');
kontrol(
  "başka cihazın seri numarası alınamaz",
  Boolean(await metniBekle('[role="alert"]', "başka bir cihazda kayıtlı")),
);

// --- Kendi seri numarasını koruyarak kaydetmek engellenmemeli (self-hariç tutma)
await sayfa.goto(`${hedef}${cihazYolu}/duzenle`, { waitUntil: "networkidle" });
await sayfa.fill("#seriNo", imei);
await sayfa.fill("#kapasite", "256 GB");
await Promise.all([
  sayfa.waitForURL(new RegExp(`${cihazYolu}$`), { timeout: 20000 }),
  sayfa.click('button:has-text("Değişiklikleri kaydet")'),
]);
kontrol(
  "kendi seri numarası çakışma saymıyor",
  ((await sayfa.locator("body").textContent()) ?? "").includes("256 GB"),
);

// --- İptal akışı
await sayfa.goto(`${hedef}${cihazYolu}`, { waitUntil: "networkidle" });
await sayfa.click('button:has-text("Kaydı iptal et")');
await sayfa.fill("#neden", "fatura satırı yanlış girildi");
await sayfa.click('button:has-text("İptal et")');
// Başarıda kart "geri al" durumuna döner; rozet de İptal olur.
await sayfa.locator('button:has-text("İptali geri al")').first().waitFor({
  state: "visible",
  timeout: 15000,
});
kontrol(
  "iptal uygulandı, rozet İptal oldu",
  ((await sayfa.locator("body").textContent()) ?? "").includes("İptal"),
);
await sayfa.screenshot({ path: `${cikti}-iptal-sonrasi.png`, fullPage: true });

// --- İptal edilen cihaz varsayılan listede görünmemeli
await sayfa.goto(`${hedef}/cihazlar`, { waitUntil: "networkidle" });
kontrol(
  "iptalli cihaz varsayılan listede yok",
  !((await sayfa.locator("body").textContent()) ?? "").includes(imei),
);

// --- Durum filtresi "İptal" ile görünmeli
await sayfa.goto(`${hedef}/cihazlar?durum=IPTAL`, { waitUntil: "networkidle" });
kontrol(
  "iptal filtresinde görünüyor",
  ((await sayfa.locator("body").textContent()) ?? "").includes(imei),
);

// --- İptalli cihaz düzenlenemez
await sayfa.goto(`${hedef}${cihazYolu}/duzenle`, { waitUntil: "networkidle" });
kontrol(
  "iptalli cihazda düzenleme kilitli",
  ((await sayfa.locator("body").textContent()) ?? "").includes("Önce iptali geri alın"),
);

// --- Geri alma
await sayfa.goto(`${hedef}${cihazYolu}`, { waitUntil: "networkidle" });
await sayfa.click('button:has-text("İptali geri al")');
// Geri alınca kart yeniden "iptal et" durumuna döner.
await sayfa.locator('button:has-text("Kaydı iptal et")').first().waitFor({
  state: "visible",
  timeout: 15000,
});
kontrol(
  "iptal geri alındı, cihaz stokta",
  ((await sayfa.locator("body").textContent()) ?? "").includes("Stokta"),
);

await sayfa.goto(`${hedef}/cihazlar`, { waitUntil: "networkidle" });
kontrol(
  "cihaz listeye döndü",
  ((await sayfa.locator("body").textContent()) ?? "").includes(imei),
);

// --- Personel bu işlemleri görmemeli ve sayfaya erişememeli
await giris("personel1");
await sayfa.goto(`${hedef}${cihazYolu}`, { waitUntil: "networkidle" });
kontrol(
  "personelde Düzenle düğmesi yok",
  (await sayfa.locator('a:has-text("Düzenle")').count()) === 0,
);
kontrol(
  "personelde Kayıt Yönetimi kartı yok",
  (await sayfa.locator('text=Kaydı iptal et').count()) === 0,
);

await sayfa.goto(`${hedef}${cihazYolu}/duzenle`, { waitUntil: "networkidle" });
kontrol(
  "personel düzenleme sayfasına giremiyor",
  new URL(sayfa.url()).pathname === "/panel",
  `yönlendirildi: ${new URL(sayfa.url()).pathname}`,
);

console.log(hatalar.length ? `\nkonsol hataları:\n${hatalar.join("\n")}` : "\nkonsol hatası yok ✓");
await tarayici.close();

if (basarisiz > 0) {
  console.error(`\n${basarisiz} kontrol başarısız.`);
  process.exit(1);
}
console.log("\ntüm kontroller geçti.");
