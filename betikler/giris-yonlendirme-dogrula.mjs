// Giriş sonrası dönüş adresi testi: `devam` parametresiyle dış siteye
// yönlendirme denemeleri reddedilmeli, site içi yollar korunmalı.
// Kullanım: npm run dev  &&  node betikler/giris-yonlendirme-dogrula.mjs
import { chromium } from "@playwright/test";

const hedef = process.env.HEDEF ?? "http://127.0.0.1:3000";
const SIFRE = "Stok2026!";

const tarayici = await chromium.launch(
  process.env.CHROME_YOLU ? { executablePath: process.env.CHROME_YOLU } : {},
);
const sayfa = await tarayici.newPage({ viewport: { width: 1400, height: 900 }, locale: "tr-TR" });

let basarisiz = 0;
function kontrol(baslik, kosul, ek = "") {
  if (!kosul) basarisiz += 1;
  console.log(`${kosul ? "✓" : "✗"} ${baslik}${ek ? ` — ${ek}` : ""}`);
}

async function girisDene(devam) {
  await sayfa.context().clearCookies();
  const adres = devam === null ? `${hedef}/giris` : `${hedef}/giris?devam=${encodeURIComponent(devam)}`;
  await sayfa.goto(adres, { waitUntil: "networkidle" });
  await sayfa.fill("#kullaniciAdi", "admin");
  await sayfa.fill("#sifre", SIFRE);
  await sayfa.click('button[type="submit"]');
  // Yönlendirme tamamlanana kadar bekle; dış siteye çıkış da bir URL değişimidir.
  await sayfa.waitForURL((u) => !u.pathname.startsWith("/giris"), { timeout: 20000 });
  return sayfa.url();
}

const disAdresler = [
  "//example.com/kimlik-dogrula",
  "///example.com",
  "/\\example.com",
  "http://example.com",
  "javascript:alert(1)",
];

for (const devam of disAdresler) {
  const url = await girisDene(devam);
  kontrol(`dış adres reddedildi: ${devam}`, url === `${hedef}/panel`, url);
}

const icAdres = await girisDene("/cihazlar?durum=STOKTA");
kontrol(
  "site içi dönüş yolu korunuyor",
  icAdres === `${hedef}/cihazlar?durum=STOKTA`,
  icAdres,
);

const varsayilan = await girisDene(null);
kontrol("devam yokken panele gidiyor", varsayilan === `${hedef}/panel`, varsayilan);

await tarayici.close();
console.log(basarisiz === 0 ? "\nTüm kontroller geçti." : `\n${basarisiz} kontrol başarısız.`);
process.exit(basarisiz === 0 ? 0 : 1);
