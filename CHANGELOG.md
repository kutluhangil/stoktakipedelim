# Değişiklik Günlüğü

En yeni kayıt en üstte.

## 2026-09-19

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
