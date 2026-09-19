// Oturum güvenliği testi: jeton iptali, rol/mağaza değişiminin anında etkisi,
// kendi şifresini değiştirme ve giriş denemesi sınırı.
// Kullanım: npm run dev  &&  node betikler/oturum-guvenlik-dogrula.mjs
import { chromium } from "@playwright/test";

const hedef = process.env.HEDEF ?? "http://127.0.0.1:3000";
const cikti = process.env.CIKTI ?? "/tmp/oturum";
const SIFRE = "Stok2026!";

const tarayici = await chromium.launch(
  process.env.CHROME_YOLU ? { executablePath: process.env.CHROME_YOLU } : {},
);

const hatalar = [];
let basarisiz = 0;
function kontrol(baslik, kosul, ek = "") {
  if (!kosul) basarisiz += 1;
  console.log(`${kosul ? "✓" : "✗"} ${baslik}${ek ? ` — ${ek}` : ""}`);
}

/** Her oturum ayrı tarayıcı bağlamında; çerezler birbirine karışmasın. */
async function yeniSayfa() {
  const baglam = await tarayici.newContext({ viewport: { width: 1500, height: 950 }, locale: "tr-TR" });
  const s = await baglam.newPage();
  s.on("console", (m) => { if (m.type() === "error") hatalar.push(m.text()); });
  s.on("pageerror", (e) => hatalar.push(String(e)));
  return s;
}

async function giris(s, kullanici, sifre = SIFRE) {
  await s.goto(`${hedef}/giris`, { waitUntil: "networkidle" });
  await s.fill("#kullaniciAdi", kullanici);
  await s.fill("#sifre", sifre);
  await s.click('button[type="submit"]');
  // Server Action yönlendirmesi networkidle'dan sonra tamamlanıyor: ya panele
  // gidilir ya da formun kendi hata kutusu belirir. Hata kutusu form içine
  // sınırlandırıldı; Next geliştirme katmanının kendi role="alert" öğesi
  // yarışı erken bitiriyordu.
  await Promise.race([
    s.waitForURL("**/panel", { timeout: 15000 }).catch(() => {}),
    s
      .locator('form [role="alert"]')
      .first()
      .waitFor({ state: "visible", timeout: 15000 })
      .catch(() => {}),
  ]);
  return new URL(s.url()).pathname;
}

async function govde(s) {
  return (await s.locator("body").textContent()) ?? "";
}

/** Sunucu eylemi tamamlanana kadar metnin sayfada belirmesini bekler. */
async function metniBekle(s, parca) {
  const el = s.locator("body").filter({ hasText: parca }).first();
  await el.waitFor({ state: "attached", timeout: 15000 }).catch(() => {});
  return (await govde(s)).includes(parca);
}

const damga = Date.now();
const testKullanici = `test${damga % 1000000}`;
const YENI_SIFRE = `Yeni${damga % 100000}!Ab`;

// --- Yönetici test kullanıcısı açar
const admin = await yeniSayfa();
kontrol("yönetici girişi", (await giris(admin, "admin")) === "/panel");

await admin.goto(`${hedef}/ayarlar/kullanicilar`, { waitUntil: "networkidle" });
// Ekleme formu, güncelleme formlarından ayrışsın diye kendi "sifre" alanıyla seçilir.
const ekleFormu = admin
  .locator("form")
  .filter({ has: admin.locator('input[name="sifre"]') })
  .first();
await ekleFormu.locator('input[name="kullaniciAdi"]').fill(testKullanici);
await ekleFormu.locator('input[name="adSoyad"]').fill(`Oturum Testi ${damga % 1000}`);
await ekleFormu.locator('select[name="rol"]').selectOption("MAGAZA_PERSONELI");
await ekleFormu.locator('select[name="magazaId"]').selectOption({ index: 1 });
await ekleFormu.locator('input[name="sifre"]').fill(SIFRE);
await ekleFormu.locator('button[type="submit"]').click();
await admin.waitForLoadState("networkidle");
// Kullanıcı adı listede metin değil form alanı olarak duruyor; değerine bakılır.
const eklendi = await admin
  .locator(`input[name="kullaniciAdi"][value="${testKullanici}"]`)
  .first()
  .waitFor({ state: "attached", timeout: 15000 })
  .then(() => true)
  .catch(() => false);
kontrol("test kullanıcısı eklendi", eklendi, testKullanici);

/** Test kullanıcısının güncelleme formunu döner (kullanıcı adı alanıyla eşleşir). */
async function guncellemeFormu(s) {
  await s.goto(`${hedef}/ayarlar/kullanicilar`, { waitUntil: "networkidle" });
  return s
    .locator("form")
    .filter({ has: s.locator(`input[name="kullaniciAdi"][value="${testKullanici}"]`) })
    .first();
}

/** Test kullanıcısının kartındaki, metni verilen düğmeyi taşıyan formu döner. */
async function kullaniciFormu(s, dugmeMetni) {
  const guncelle = await guncellemeFormu(s);
  const id = await guncelle.locator('input[name="id"]').inputValue();
  return s
    .locator(`form:has(input[name="id"][value="${id}"])`)
    .filter({ has: s.locator(`button:has-text("${dugmeMetni}")`) })
    .first();
}

// --- Personel giriş yapar
const personel = await yeniSayfa();
kontrol("test kullanıcısı giriş yaptı", (await giris(personel, testKullanici)) === "/panel");
kontrol(
  "personelde Ayarlar menüsü yok",
  !(await govde(personel)).includes("Ayarlar"),
);

// --- Yönetici rolü yükseltir: açık oturum jeton dolmadan yeni yetkiyi görmeli
const guncelle1 = await guncellemeFormu(admin);
await guncelle1.locator('select[name="rol"]').selectOption("ADMIN");
await guncelle1.locator('button[type="submit"]').click();
await admin.waitForLoadState("networkidle");

await personel.goto(`${hedef}/panel`, { waitUntil: "networkidle" });
kontrol(
  "rol yükseltmesi açık oturuma anında yansıdı",
  (await govde(personel)).includes("Ayarlar"),
);

// --- Rol geri düşürülür
const guncelle2 = await guncellemeFormu(admin);
await guncelle2.locator('select[name="rol"]').selectOption("MAGAZA_PERSONELI");
await guncelle2.locator('select[name="magazaId"]').selectOption({ index: 1 });
await guncelle2.locator('button[type="submit"]').click();
await admin.waitForLoadState("networkidle");

await personel.goto(`${hedef}/ayarlar`, { waitUntil: "networkidle" });
kontrol(
  "rol düşürmesi de anında geçerli",
  new URL(personel.url()).pathname === "/panel",
  `yönlendirildi: ${new URL(personel.url()).pathname}`,
);

// --- Yönetici tüm oturumları kapatır
const oturumFormu = await kullaniciFormu(admin, "Tüm Oturumları Kapat");
await oturumFormu.locator('button:has-text("Tüm Oturumları Kapat")').click();
await admin.waitForLoadState("networkidle");
kontrol("oturum iptali uygulandı", await metniBekle(admin, "tüm cihazlardan çıkarıldı"));

await personel.goto(`${hedef}/panel`, { waitUntil: "networkidle" });
kontrol(
  "iptal edilen jetonla panele girilemiyor",
  new URL(personel.url()).pathname === "/giris",
  `yönlendirildi: ${new URL(personel.url()).pathname}`,
);
kontrol(
  "geçersiz çerez temizlendi (yönlendirme döngüsü yok)",
  (await govde(personel)).includes("Giriş"),
);
await personel.screenshot({ path: `${cikti}-iptal-sonrasi.png`, fullPage: true });

// --- Pasife alınan hesap
const personel2 = await yeniSayfa();
kontrol("kullanıcı tekrar giriş yapabiliyor", (await giris(personel2, testKullanici)) === "/panel");

const guncelle4 = await guncellemeFormu(admin);
await guncelle4.locator('input[name="aktif"]').uncheck();
await guncelle4.locator('button[type="submit"]').click();
await admin.waitForLoadState("networkidle");

await personel2.goto(`${hedef}/cihazlar`, { waitUntil: "networkidle" });
kontrol(
  "pasife alınan hesabın oturumu anında düşüyor",
  new URL(personel2.url()).pathname === "/giris",
);

// Tekrar aktif et
const guncelle5 = await guncellemeFormu(admin);
await guncelle5.locator('input[name="aktif"]').check();
await guncelle5.locator('button[type="submit"]').click();
await admin.waitForLoadState("networkidle");

// --- Kendi şifresini değiştirme
const personel3 = await yeniSayfa();
await giris(personel3, testKullanici);
await personel3.goto(`${hedef}/profil`, { waitUntil: "networkidle" });
kontrol("hesabım sayfası açılıyor", (await govde(personel3)).includes("Şifre Değiştir"));

await personel3.fill("#mevcutSifre", "yanlis-sifre");
await personel3.fill("#yeniSifre", YENI_SIFRE);
await personel3.fill("#yeniSifreTekrar", YENI_SIFRE);
await personel3.click('button:has-text("Şifreyi değiştir")');
await personel3.locator('[role="alert"]').filter({ hasText: "Mevcut şifre hatalı" }).first()
  .waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
kontrol(
  "mevcut şifre doğrulanıyor",
  await personel3.locator('[role="alert"]').filter({ hasText: "Mevcut şifre hatalı" }).first()
    .isVisible().catch(() => false),
);

await personel3.fill("#mevcutSifre", SIFRE);
await personel3.fill("#yeniSifre", YENI_SIFRE);
await personel3.fill("#yeniSifreTekrar", `${YENI_SIFRE}x`);
await personel3.click('button:has-text("Şifreyi değiştir")');
await personel3.locator('[role="alert"]').filter({ hasText: "tekrarı uyuşmuyor" }).first()
  .waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
kontrol(
  "şifre tekrarı denetleniyor",
  await personel3.locator('[role="alert"]').filter({ hasText: "tekrarı uyuşmuyor" }).first()
    .isVisible().catch(() => false),
);

// Başka bir cihazda açık ikinci oturum — şifre değişince düşmeli
const digerCihaz = await yeniSayfa();
await giris(digerCihaz, testKullanici);

await personel3.fill("#mevcutSifre", SIFRE);
await personel3.fill("#yeniSifre", YENI_SIFRE);
await personel3.fill("#yeniSifreTekrar", YENI_SIFRE);
await personel3.click('button:has-text("Şifreyi değiştir")');
await personel3.locator('[role="status"]').filter({ hasText: "Şifreniz değiştirildi" }).first()
  .waitFor({ state: "visible", timeout: 15000 });
kontrol("şifre değiştirildi", true);
await personel3.screenshot({ path: `${cikti}-sifre-degisti.png`, fullPage: true });

await personel3.goto(`${hedef}/panel`, { waitUntil: "networkidle" });
kontrol(
  "şifreyi değiştiren cihaz açık kalıyor",
  new URL(personel3.url()).pathname === "/panel",
);

await digerCihaz.goto(`${hedef}/panel`, { waitUntil: "networkidle" });
kontrol(
  "diğer cihazın oturumu kapandı",
  new URL(digerCihaz.url()).pathname === "/giris",
);

const eskiSifreyle = await yeniSayfa();
await giris(eskiSifreyle, testKullanici, SIFRE);
kontrol("eski şifre artık geçersiz", new URL(eskiSifreyle.url()).pathname === "/giris");
kontrol("yeni şifre geçerli", (await giris(eskiSifreyle, testKullanici, YENI_SIFRE)) === "/panel");

// --- Giriş denemesi sınırı (5 hatalı deneme → kilit)
const saldirgan = await yeniSayfa();
let kilitMesaji = "";
for (let i = 1; i <= 6; i++) {
  await giris(saldirgan, testKullanici, `hatali-${i}`);
  const uyari = await saldirgan.locator('[role="alert"]').first().textContent().catch(() => "");
  if ((uyari ?? "").includes("Çok fazla hatalı")) {
    kilitMesaji = uyari.trim();
    kontrol("giriş sınırı devreye girdi", true, `${i}. denemede`);
    break;
  }
}
kontrol("kilit mesajı gösteriliyor", kilitMesaji.includes("dakika sonra"), kilitMesaji);

// Kilit doğru şifreyi de reddetmeli
await giris(saldirgan, testKullanici, YENI_SIFRE);
kontrol(
  "kilitliyken doğru şifre de kabul edilmiyor",
  new URL(saldirgan.url()).pathname === "/giris",
);
await saldirgan.screenshot({ path: `${cikti}-kilit.png`, fullPage: true });

// Başka kullanıcı etkilenmemeli
const baskasi = await yeniSayfa();
kontrol("kilit diğer kullanıcıları etkilemiyor", (await giris(baskasi, "admin")) === "/panel");

// Kilit yöneticinin log ekranına düştü mü
await admin.goto(`${hedef}/ayarlar/loglar?islem=GIRIS_KILIT`, { waitUntil: "networkidle" });
kontrol("kilit loglandı", (await govde(admin)).includes(testKullanici));

console.log(hatalar.length ? `\nkonsol hataları:\n${hatalar.join("\n")}` : "\nkonsol hatası yok ✓");
await tarayici.close();

if (basarisiz > 0) {
  console.error(`\n${basarisiz} kontrol başarısız.`);
  process.exit(1);
}
console.log("\ntüm kontroller geçti.");
