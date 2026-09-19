# Yapılanlar ve Sıradaki İşler

Bu dosya, kod incelemesinden çıkan iş listesinin canlı takibidir. Tamamlanan her
madde dosyalarıyla birlikte buraya yazılır; ayrıntılı tarihli kayıt
[CHANGELOG.md](CHANGELOG.md) içindedir. Faz durumları [PLAN.md](PLAN.md)'de.

## Tamamlananlar

### 1. Açık yönlendirme (open redirect) — 2026-09-19 ✅

Giriş sonrası dönüş adresi doğrulanmıyordu: `redirect(devam.startsWith("/") ? ...)`
kontrolü `//example.com` gibi protokol-göreli adresleri site içi sanıyordu.
Saldırgan personele `/giris?devam=//example.com/kimlik-dogrula` linkini atıp,
personel gerçek sisteme giriş yaptıktan sonra sahte sayfaya düşürebiliyordu.

- `src/lib/yonlendirme.ts` — `guvenliDonusYolu()`: yalnız tek `/` ile başlayan,
  ikinci karakteri `/` veya `\` olmayan, kontrol karakteri içermeyen yolları
  kabul eder; gerisi varsayılana (`/panel`) düşer.
- `src/app/giris/eylemler.ts` — `girisYap` yönlendirmesi bu yardımcıdan geçiyor.
- `src/app/giris/page.tsx` — dış adres forma hiç girmesin diye `devam` sayfa
  tarafında da süzülüyor.
- `src/lib/yonlendirme.test.ts` — 5 birim testi (site içi, protokol-göreli,
  mutlak/şema, kontrol karakteri, boş girdi).
- `betikler/giris-yonlendirme-dogrula.mjs` — uçtan uca tarayıcı testi: 5 dış
  adres denemesi `/panel`e düşüyor, `/cihazlar?durum=STOKTA` korunuyor.

Doğrulama: `npm test` 58/58, `npm run typecheck` ve `npm run lint` temiz,
`npm run build` başarılı, e2e betiği 7/7 geçti.

### 2. Satış iptali / iade akışı — 2026-09-19 ✅

`SATILDI` tek yönlü kapıydı: müşteri cihazı geri getirdiğinde sistemde yapılacak bir şey
yoktu, `IADE` durumu tanımlıydı ama hiçbir ekrandan atanamıyordu.

Kurulan model: iade alındığında satış `StokKalemi` üzerinden **silinir** (durum ve tüm
satış alanları sıfırlanır). Ciro, kâr, mağaza ve kullanıcı satış raporlarının hepsi
`durum = SATILDI` üzerinden çalıştığı için satış böylece kendiliğinden raporlardan düşer —
raporlara ayrıca "iadeyi çıkar" mantığı eklemek gerekmedi. Silinen satışın fotoğrafı
(müşteri, tarih, tutar, ödeme tipi, o günkü alış fiyatı) yeni `Iade` tablosunda durur;
müşteri tarihçesi ve iade raporu bu tablodan beslenir.

- `prisma/schema.prisma` + `migrations/20260918234934_iade_kaydi` — `Iade` tablosu.
- `src/lib/sabitler.ts` — `IADE_SONUCLARI`, `IADE_SONUC_ACIKLAMA`, `LOG_ISLEM.SATIS_IADE`.
- `src/lib/iade.ts` — iade tarihi ve sonuç durumu kuralları (saf fonksiyonlar),
  `src/lib/iade.test.ts` 8 birim testi.
- `src/app/(uygulama)/satis/eylemler.ts` → `satisIadeAl`: `Iade` kaydı + `IADE` stok
  hareketi + `SATIS_IADE` logu, tek transaction. Yetki satışla aynı (kendi mağazan).
- `src/app/(uygulama)/cihazlar/eylemler.ts` → `cihaziStogaAl`: kontrolü biten
  `IADE`/`ARIZALI` cihazı stoğa döndürür — yoksa iade durumu çıkışsız kalıyordu.
- `cihazlar/[id]/IadeFormu.tsx`, `StogaAlFormu.tsx`, detay sayfasında "İade",
  "Satışa Açma" ve "İade Geçmişi" kartları.
- `musteriler/page.tsx` — iade edilen cihazlar ayrı rozetle tarihçede.
- `lib/raporlar.ts` → `iadeRaporu`, `rapor/page.tsx` "Alınan İadeler" tablosu +
  "Aralıktaki İade" kartı, `rapor/excel/route.ts` "İadeler" sayfası.
- `bilesenler/FiltreCubugu.tsx` — durum filtresine İade ve Arızalı.
- `betikler/iade-dogrula.mjs` — uçtan uca test: satış → iade → cironun tam satış tutarı
  kadar düşmesi → müşteri tarihçesi → satışa açma → tekrar satılabilirlik → tarih ve
  mağaza yetkisi kuralları.

Doğrulama: `npm test` 66/66, `typecheck` ve `lint` temiz, `build` başarılı,
`iade-dogrula.mjs` 20/20, `cihaz-duzenle-dogrula.mjs` ve `giris-yonlendirme-dogrula.mjs`
gerilemesiz geçti.

### 3. Oturum iptali + şifre yönetimi + giriş sınırı — 2026-09-19 ✅

Üç ayrı boşluk tek fazda kapandı.

**Oturum iptali.** Rol ve mağaza jetonun içinde 12 saat donuyordu: personeli pasife alsan
da jeton dolana kadar eski yetkiyle geziyordu. Artık `oturumuDogrula()` her istekte
kullanıcı kaydını okuyor; rol, mağaza ve aktiflik oradan geliyor, jeton yalnız kimlik
taşıyor. Jetonu ele geçirilmiş bir hesabı kapatmak için `Kullanici.oturumSurumu` eklendi —
şifre değişimi, yöneticinin sıfırlaması ve "Tüm Oturumları Kapat" sürümü artırıyor,
eski jetonlar anında düşüyor. Geçersiz oturum `/cikis` ucuna yollanıyor: sayfa render'ı
sırasında çerez silinemediği için temizliği Route Handler yapıyor (doğrudan `/giris`e
yollamak proxy ile sonsuz döngü kuruyordu).

**Kendi şifresini değiştirme.** `/profil` ("Hesabım") ekranı: mevcut şifre + yeni şifre
(en az 8 karakter) + tekrar. Mevcut şifre sorulması, çerezi ele geçiren birinin hesabı
kalıcı almasını engelliyor. Değişimde diğer cihazlar düşüyor, bu cihazın çerezi yeni
sürümle tazeleniyor.

**Giriş denemesi sınırı.** Sunucuda: aynı kullanıcı adına 15 dakikada 5, aynı IP'den 20
başarısız deneme kilitliyor. İki ayrı sınırın sebebi: kullanıcı sınırı hesabı korur,
IP sınırı farklı kullanıcı adlarını tarayan saldırıyı yavaşlatır.

- `prisma/schema.prisma` + `migrations/20260919001702_oturum_surumu_ve_giris_denemesi`
- `src/lib/oturum.ts` — jetona `oturumSurumu`; sürümsüz eski jeton geçersiz.
- `src/lib/yetki.ts` — `oturumuDogrula()`, `oturumGerekli`/`oturumZorunlu` bunu kullanıyor.
- `src/app/cikis/route.ts` — çerez temizleyen çıkış ucu.
- `src/lib/girisSinir.ts` + `girisSinir.test.ts` — kilit penceresi hesabı, 8 birim testi.
- `src/app/giris/eylemler.ts` — kilit denetimi, deneme kaydı, sayaç sıfırlama ve budama.
- `src/app/(uygulama)/profil/` — Hesabım sayfası ve `kendiSifreniDegistir`.
- `src/app/(uygulama)/ayarlar/eylemler.ts` — `oturumlariKapat`, `sifreSifirla` sürüm artırır.
- `src/bilesenler/UstMenu.tsx` — kullanıcı bilgisi artık `/profil` bağlantısı.
- `betikler/oturum-guvenlik-dogrula.mjs` — 24 kontrol: rol yükseltme/düşürmenin anında
  etkisi, pasife alma, oturum iptali, şifre değişimi + diğer cihazın düşmesi, eski şifrenin
  geçersizleşmesi, 5 denemede kilit, kilidin doğru şifreyi de reddetmesi, diğer kullanıcının
  etkilenmemesi, kilidin loglanması.

Doğrulama: `npm test` 74/74, `typecheck` ve `lint` temiz, `build` başarılı,
`oturum-guvenlik-dogrula.mjs` 24/24; `iade-dogrula.mjs` ve `cihaz-duzenle-dogrula.mjs`
gerilemesiz geçti.

### 4. İkinci el alım (tezgâhtan cihaz alma) — 2026-09-19 ✅

Stok girişinin tek yolu tedarikçi + alış faturasıydı (`AlisFaturasi.tedarikciId` zorunlu),
oysa bayide günlük iş müşteriden cihaz almak. `/alim` ekranı bu yolu açıyor: cihaz künyesi,
ödenen tutar, ödeme tipi ve satıcı bilgisiyle doğrudan `StokKalemi` oluşuyor — fatura ve
tedarikçi boş kalıyor, böylece vade raporuna da girmiyor.

Satıcı `Musteri` kaydına bağlanıyor ama `StokKalemi.musteriId` alanına yazılmıyor: o alan
satışın alıcısına ait, ikinci el cihaz satıldığında üzerine yazılırdı. Alım bilgisi ayrı
`IkinciElAlim` kaydında duruyor (iade akışındaki `Iade` tablosuyla aynı yaklaşım).

Yetki fatura girişinden ayrıldı: alım tezgâhta olan bir iş, sorumlunun beklemesi işi
durdurur; yine de kasadan para çıktığı için personele kapalı (`ikinciElAlabilirMi`).
Sorumluya yalnız kendi deposu açık, yöneticiye hepsi.

- `prisma/schema.prisma` + `migrations/20260919030359_ikinci_el_alim`
- `src/lib/yetkiKurallari.ts` — `ikinciElAlabilirMi` (+2 birim testi),
  `src/lib/yetki.ts` — `ikinciElZorunlu`.
- `src/app/(uygulama)/alim/` — sayfa, form ve `ikinciElAl` eylemi.
- `cihazlar/[id]/page.tsx` — "Kaynak", satan kişi, ödeme tipi ve alımı yapan satırları.
- `musteriler/page.tsx` — "N ikinci el satışı".
- `lib/raporlar.ts` → `ikinciElRaporu`, rapor ekranı ve Excel paketi.
- `betikler/ikinci-el-dogrula.mjs` — 22 kontrol: yetki, alım, seri no çakışması ve
  zorunluluğu, arama, rapor kartının alım tutarı kadar artması, vade raporuna girmemesi,
  müşteri tarihçesi, alınan cihazın satışa okutulabilmesi, depo kapsamı.

Doğrulama: `npm test` 76/76, `typecheck` ve `lint` temiz, `build` başarılı,
`ikinci-el-dogrula.mjs` 22/22.

### 5. Müşteri düzenleme + yedek şifreleme (KVKK) — 2026-09-19 ✅

**Müşteri düzenleme/silme.** Müşteriler ekranı salt aramaydı: yanlış girilmiş telefon ya da
TCKN düzeltilemiyor, kayıt silinemiyordu — KVKK'daki düzeltme ve silme hakkı karşılıksızdı.
Artık her kayıtta "Kaydı düzenle" var.

Silme iki yola ayrıldı: bağlı satış, iade veya ikinci el alımı olan müşteri **silinemez**,
kimlik bilgileri temizlenip kayıt anonimleştirilir (`Silinmiş Müşteri #id`) — ticari kayıt
ve fatura izi kopmaz. Hiçbir işleme bağlı olmayan kayıt tamamen silinir. İki işlem de
cihazların `aramaMetni` alanını tazeliyor; bu alan satış anında müşteri adı ve telefonunu
da içerdiği için, tazelenmezse eski ad arama kutusunda bulunmaya devam ederdi.

Düzeltme yönetici ve mağaza sorumlusunda (yanlış telefon tezgâhta fark edilir), geri
alınamaz silme yalnız yöneticide.

**Yedek şifreleme.** `gziple` sadece sıkıştırıyordu: TCKN, telefon ve adres dahil tüm
müşteri verisi düz SQLite olarak kişisel Google Drive'a gidiyordu. Yedek artık gzip'ten
sonra AES-256-GCM ile şifreleniyor (`<sihir><iv><şifreli veri><etiket>` biçimi; etiket
akışın sonunda üretildiği için sonda). Anahtar yoksa yedek alınmaz — sessiz bir geri düşüş
bilerek konmadı. Yedeği geri açmak `npm run yedek:coz -- <dosya.db.gz.enc>` ile tek adım.

- `src/lib/sifreliYedek.ts` + `sifreliYedek.test.ts` — 7 birim testi (gidiş-dönüş,
  düz metin sızıntısı yok, yanlış anahtar, kurcalanmış dosya, hatalı anahtar biçimi).
- `src/lib/yedek.ts` — şifreleme adımı, `.db.gz.enc` uzantısı, `sifrelemeHazirMi()`.
- `betikler/yedek-coz.mts` + `npm run yedek:coz` — geri açma.
- `ayarlar/yedekleme` — şifreleme rozeti, anahtar yoksa kırmızı uyarı, kurulum ve geri
  açma adımları.
- `src/app/(uygulama)/musteriler/eylemler.ts` — `musteriDuzenle`, `musteriSil`.
- `musteriler/MusteriYonetimi.tsx` — düzenleme formu ve onay kutulu silme.
- `musteriDuzenleyebilirMi` yetki kuralı (+1 birim testi), `musteriZorunlu`.
- `betikler/musteri-kvkk-dogrula.mjs` — 17 kontrol: yetki katmanları, düzeltmenin cihaz
  aramasına ve detayına yansıması, anonimleştirme, satış kaydının korunması, eski adın
  aramadan düşmesi, yedek şifreleme durumu.

Doğrulama: `npm test` 84/84, `typecheck` ve `lint` temiz, `build` başarılı,
`musteri-kvkk-dogrula.mjs` 17/17. Şifreli yedek gerçek veritabanıyla da sınandı:
`npm run yedek:coz` ile çözülen dosya SQLite olarak açıldı (12 müşteri, 25 cihaz),
şifreli dosyada tablo adı dahil düz metin bulunmadı.

### 6. Küçük eksikler — 2026-09-19 ✅

- **Sayım farkı.** `SAYIM_FARK` hareket tipi tanımlıydı, hiç yazılmıyordu: sayım "3 cihaz
  eksik" deyip bırakıyor, eksik cihazlar stok adedinde ve değerinde durmaya devam ediyordu.
  Yeni `KAYIP` durumu ve tamamlanmış sayımda "Sayım farkını işle" eylemi (yalnız yönetici)
  bunu kapattı. Sayımdan sonra satılmış veya sevk edilmiş cihaza dokunulmaz; bulunan cihaz
  "Satışa aç" ile döner.
- **Sevkiyattaki cihaz sayımda.** Sayım başlarken yalnız `STOKTA` cihazlar fotoğraflanıyordu;
  yolda olan cihaz ne kaynak ne hedef mağazanın sayımına giriyordu. Artık kaynak mağazanın
  sayımına `beklenen: false` + `SEVKIYATTA` sonucuyla ekleniyor: sayılması beklenmiyor ama
  listede görünüyor.
- **Arızalı atama.** `ARIZALI` hiçbir ekrandan atanamıyordu. Cihaz detayına "Arızalı işaretle"
  eklendi (neden zorunlu); servis dönüşü "Satışa aç" ile stoğa döner.
- **Serbest vade.** Vade 0/21/45'e sabitti, tedarikçi 30/60/90 da veriyor. Artık 0–365 arası
  serbest gün; sık kullanılanlar öneri listesinde. `VADE_ETIKET` sabit haritası yerine
  `vadeEtiketi()` (+2 birim testi).
- **Firma adı.** `Ayar` tablosundaki `firma_adi` yalnız seed'den geliyordu; ayarlar ekranına
  düzenleme formu eklendi, kaydedince düzen (layout) tazeleniyor.
- **Excel kesme uyarısı.** 20.000 satır sınırı sessizdi. Sınırın bir fazlası çekilip kesme
  olup olmadığı anlaşılıyor; kesilmişse dosya başlığında ve `EXCEL_AKTAR` logunda uyarı var.
- **Hareket sıralaması.** Stok girişi hareketi fatura tarihinin yerel gün başına yazılıyor
  (form değeri UTC gece yarısı geliyordu), böylece aynı gün yapılan düzeltmeler tarihçede
  girişin önüne geçmiyor.

Dosyalar: `src/lib/sabitler.ts` (`KAYIP`, `STOGA_DONEBILEN`, `SAYIM_SONUC.SEVKIYATTA`,
`vadeEtiketi`, `VADE_EN_FAZLA_GUN`), `sayim/eylemler.ts` (`sayimFarkiniIsle`, sevkiyat
fotoğrafı), `sayim/[id]/SayimFarkiFormu.tsx`, `cihazlar/eylemler.ts` (`cihaziArizaliYap`),
`cihazlar/[id]/DurumYonetimi.tsx`, `faturalar/eylemler.ts` + `dogrulama.ts` +
`yeni/FaturaFormu.tsx`, `ayarlar/eylemler.ts` (`firmaAdiKaydet`) + `ayarlar/page.tsx`,
`cihazlar/excel/route.ts`, `bilesenler/Rozet.tsx`, `bilesenler/FiltreCubugu.tsx`.

Doğrulama: `npm test` 86/86, `typecheck` ve `lint` temiz, `build` başarılı,
`kucuk-eksikler-dogrula.mjs` 22/22; diğer beş e2e betiği gerilemesiz geçti.

### Önceki oturumda eklenenler (Kutluhan) — 2026-09-19

- Cihaz kaydı düzeltme ekranı (`/cihazlar/[id]/duzenle`, yalnız yönetici):
  künye ve alış fiyatı düzeltilir, satılmış/sevkiyattaki cihazda form kilitli,
  `DUZELTME` hareketi + `STOK_DUZENLE` logu bırakır, arama metnini tazeler.
- Cihaz detayında "Kayıt Yönetimi": yanlış kayıt kalıcı silinmez, `IPTAL`
  durumuna alınır — listelerden ve stok değerinden düşer, tarihçe korunur,
  geri alınabilir.
- `betikler/cihaz-duzenle-dogrula.mjs`: düzeltme, seri no çakışması, iptal/geri
  al akışları için uçtan uca test.
- `package.json` → `allowScripts`: npm 12 install script'lerini engellediği için
  `better-sqlite3@12` derlenmiyordu, tüm veritabanı sorguları çalışma anında
  düşüyordu.
- `src/lib/vade.test.ts` saat diliminden bağımsız hâle getirildi.

## Sıradaki işler (öncelik sırasıyla)

### 7. Henüz başlanmayan büyük özellikler

Kod incelemesindeki küçük eksikler kapandı; aşağıdakiler her biri ayrı birer faz olacak
kapsamda, bu turda kasıtlı olarak ele alınmadı:

- Taksit / kısmi tahsilat takibi
- Tedarikçi cari hesabı (bakiye, ödeme geçmişi)
- Fiş ve garanti belgesi çıktısı
- IMEI barkod etiketi basımı
- KDV alanı ve KDV'li fiyat hesabı
