# Değişiklik Günlüğü

En yeni kayıt en üstte.

## 2026-09-19

- Sayım farkı işlenebiliyor: tamamlanmış sayımda eksik çıkan cihazlar tek işlemle `KAYIP`
  durumuna alınıyor, her biri `SAYIM_FARK` hareketi bırakıyor ve stok değerinden düşüyor.
  Cihaz sonradan bulunursa "Satışa aç" ile geri döner. Yeni `KAYIP` stok durumu, rozeti ve
  liste filtresi eklendi.
- Sayım artık sevkiyattaki cihazları da listeliyor: gönderilmiş ama kabul edilmemiş cihaz
  "Sevkiyatta (depoda olmamalı)" sonucuyla sayım kağıdında görünüyor — önceden iki mağazanın
  da sayımından düşüyordu.
- Stoktaki cihaz "Arızalı işaretle" ile servise alınabiliyor; arızalı, iade ve kayıp
  durumlarının hepsi "Satışa aç" ile stoğa dönüyor.
- Vade artık 0/21/45'e sabit değil: serbest gün girişi (0–365) kabul ediliyor, sık
  kullanılanlar (0, 21, 30, 45, 60, 90) öneri listesinde.
- Firma adı ayarlar ekranından değiştirilebiliyor; üst menü ve rapor başlıkları anında
  güncelleniyor (önceden yalnız seed yazıyordu).
- Cihaz listesi Excel aktarımı 20.000 satırda sessizce kesilmiyor: dosyanın başlığına ve
  `EXCEL_AKTAR` loguna kesme uyarısı yazılıyor.
- Stok girişi hareketi fatura tarihinin yerel gün başına yazılıyor; aynı gün yapılan
  düzeltmeler tarihçede girişten önce görünmüyor.
- `betikler/kucuk-eksikler-dogrula.mjs`: uçtan uca test (22 kontrol).
- KVKK: müşteri kaydı düzeltilebiliyor ve silinebiliyor (müşteriler ekranı → "Kaydı düzenle").
  Düzeltme yönetici ve mağaza sorumlusunda; silme yalnız yöneticide. Bağlı satış/iade/ikinci
  el alımı olan kayıtta kimlik bilgileri temizlenip kayıt anonimleştirilir (ticari kayıt
  korunur), bağlı işlemi olmayan kayıt tamamen silinir. Her iki işlemde cihazların
  `aramaMetni` alanı tazelenir; eski ad arama kutusunda bulunmaya devam etmez.
  `MUSTERI_DUZENLE` / `MUSTERI_SIL` logları düşer.
- Güvenlik/KVKK: yedek dosyaları artık AES-256-GCM ile şifreleniyor
  (`YEDEK_SIFRELEME_ANAHTARI`, `openssl rand -hex 32`). Anahtar tanımlı değilse yedek
  alınmaz — müşteri adı, telefonu, TCKN ve adresi düz SQLite olarak buluta çıkmasın diye
  sessiz geri düşüş bilerek yok. Dosya adı `.db.gz.enc`; `npm run yedek:coz -- <dosya>`
  ile açılır. Yedekleme ekranı şifreleme durumunu gösteriyor ve anahtar yoksa uyarıyor.
- `src/lib/sifreliYedek.ts` + `sifreliYedek.test.ts`: şifreleme/çözme, yanlış anahtar,
  kurcalanmış dosya ve düz metin sızıntısı kontrolleri (7 birim testi).
  `betikler/musteri-kvkk-dogrula.mjs`: uçtan uca test (17 kontrol).
- `musteriDuzenleyebilirMi` yetki kuralı + birim testi.
- İkinci el alım akışı eklendi (`/alim`, "İkinci El" menüsü): tezgâhtan alınan cihaz
  doğrudan stoğa girer. Alış faturası ve tedarikçi olmadığı için vade raporuna girmez;
  kimden, kaça, hangi ödemeyle alındığı yeni `IkinciElAlim` tablosunda durur ve cihaz
  detayında "Kaynak" satırında görünür. Yetki: yönetici ve mağaza sorumlusu (sorumlu yalnız
  kendi deposuna). Seri no zorunluluğu ve seri no tekilliği fatura akışındaki kurallarla aynı.
- Satıcı müşteri kaydına bağlanıyor; müşteriler ekranında "N ikinci el satışı" olarak
  görünüyor. `StokKalemi.musteriId` satış alıcısına ayrıldığı için satıcıyla karışmıyor.
- Raporlara "İkinci El Alımlar" tablosu ve "İkinci El Alım" özet kartı eklendi; Excel rapor
  paketine "İkinci El Alımlar" sayfası ve özete alım satırı geldi.
- Veritabanı: `IkinciElAlim` tablosu (`prisma/migrations/20260919030359_ikinci_el_alim`).
- `ikinciElAlabilirMi` yetki kuralı + 2 birim testi;
  `betikler/ikinci-el-dogrula.mjs`: uçtan uca test (22 kontrol).
- Güvenlik: oturum jetonu artık her istekte veritabanıyla doğrulanıyor. Rol, mağaza ve
  aktiflik kullanıcı kaydından okunuyor — yetki düşürme, mağaza değiştirme ve pasife alma
  jetonun 12 saati dolmadan geçerli oluyor. `Kullanici.oturumSurumu` eklendi; şifre
  değişimi, yöneticinin şifre sıfırlaması ve "Tüm Oturumları Kapat" bu sürümü artırarak
  açık jetonları anında geçersizleştiriyor.
- `/cikis` route handler'ı eklendi: geçersiz oturumda çerez temizlenip giriş ekranına
  dönülüyor. Doğrudan `/giris`e yönlendirmek proxy ile döngü kuruyordu.
- Güvenlik: kullanıcı kendi şifresini değiştirebiliyor (`/profil` → "Hesabım"). Mevcut
  şifre sorulur, yeni şifre en az 8 karakter, değişimde diğer cihazlardaki oturumlar
  kapanır, işlem `SIFRE_DEGISTIR` logu bırakır. Artık yöneticinin herkesin şifresini
  bilmesi gerekmiyor; "kim yaptı" logları savunulabilir hâle geldi.
- Güvenlik: giriş denemesi sınırı sunucuda uygulanıyor. Aynı kullanıcı adına 15 dakikada
  5, aynı IP'den 20 başarısız denemeden sonra giriş kilitleniyor; kilit tetiklendiğinde
  `GIRIS_KILIT` logu düşüyor. Denemeler yeni `GirisDenemesi` tablosunda tutuluyor,
  başarılı girişte sayaç sıfırlanıyor ve 7 günden eski kayıtlar budanıyor.
- Yönetici kullanıcı kartına "Tüm Oturumları Kapat" düğmesi eklendi.
- Veritabanı: `Kullanici.oturumSurumu` ve `GirisDenemesi`
  (`prisma/migrations/20260919001702_oturum_surumu_ve_giris_denemesi`).
- `src/lib/girisSinir.ts` + `girisSinir.test.ts`: kilit penceresi hesabı (8 birim testi).
  `betikler/oturum-guvenlik-dogrula.mjs`: uçtan uca test (24 kontrol).
- Satış iadesi akışı eklendi: satılmış cihazın detayında "İade al" — neden, iade tarihi
  ve cihazın yeni durumu (Stokta / İade / Arızalı) girilir. Satış `StokKalemi` üzerinden
  temizlenir, böylece ciro, kâr ve satış raporlarından düşer; satışın fotoğrafı (müşteri,
  tarih, tutar, ödeme tipi, o günkü maliyet) yeni `Iade` tablosunda saklanır. İşlem
  `IADE` stok hareketi ve `SATIS_IADE` logu bırakır. Yetki satışla aynı: cihazın
  bulunduğu mağazada işlem yapabilen herkes. Yanlış girilmiş kaydı silen `IPTAL` ayrı
  akış olarak duruyor.
- İade/arıza kontrolü biten cihaz için "Satışa aç" eklendi (`cihaziStogaAl`): `IADE` ve
  `ARIZALI` artık çıkışsız durum değil, cihaz stoğa dönüp tekrar satılabiliyor.
- Cihaz detayında "İade Geçmişi" kartı; müşteriler ekranında iade edilen cihazlar ayrı
  rozetle listeleniyor (satış silindiği için satın alınanlar listesinden düşüyor).
- Raporlara "Alınan İadeler" tablosu ve "Aralıktaki İade" özet kartı eklendi; Excel rapor
  paketine "İadeler" sayfası ve özete iade satırı geldi.
- Cihaz listesi durum filtresine "İade" ve "Arızalı" seçenekleri eklendi.
- Veritabanı: `Iade` tablosu (`prisma/migrations/20260918234934_iade_kaydi`).
- `src/lib/iade.ts` + `src/lib/iade.test.ts`: iade tarihi ve sonuç durumu kuralları
  (8 birim testi). `betikler/iade-dogrula.mjs`: uçtan uca tarayıcı testi (20 kontrol).
- Güvenlik: giriş ekranındaki açık yönlendirme (open redirect) kapatıldı. `devam`
  parametresi artık `src/lib/yonlendirme.ts` içindeki `guvenliDonusYolu` ile
  doğrulanıyor; `//example.com`, `/\example.com`, mutlak adres, `javascript:` ve
  kontrol karakteri içeren değerler `/panel`e düşer, site içi yollar korunur.
- `betikler/giris-yonlendirme-dogrula.mjs`: giriş sonrası yönlendirme için uçtan
  uca tarayıcı testi (5 dış adres denemesi + site içi yol + varsayılan).
- Cihaz detayına yönetici için "Kayıt Yönetimi" eklendi: yanlış girilen kayıt kalıcı
  silinmek yerine `IPTAL` durumuna alınır, listelerden ve stok değerinden düşer,
  tarihçe korunur ve geri alınabilir.
- Cihaz kaydı düzeltme ekranı eklendi (`/cihazlar/[id]/duzenle`, yalnız yönetici):
  künye ve alış fiyatı düzeltilebilir; satılmış veya sevkiyattaki cihazda form kilitli.
  Değişiklik `DUZELTME` hareketi ve `STOK_DUZENLE` logu bırakır, arama metnini tazeler.
- `betikler/cihaz-duzenle-dogrula.mjs`: düzeltme, seri no çakışması ve iptal/geri al
  akışları için uçtan uca tarayıcı testi.
- `package.json` içine `allowScripts` eklendi: npm 12 install script'leri varsayılan
  engellediği için `@prisma/adapter-better-sqlite3`'ün bağlı olduğu `better-sqlite3@12`
  derlenmeden kalıyor ve tüm veritabanı sorguları çalışma anında düşüyordu.
- `src/lib/vade.test.ts` saat diliminden bağımsız hâle getirildi; test yerel gün kurup
  yerel gün karşılaştırıyor (önceden UTC'ye çevirdiği için Türkiye saatinde düşüyordu).
