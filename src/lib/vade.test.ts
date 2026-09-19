import assert from "node:assert/strict";
import { test } from "node:test";
import { VADE_ETIKET, VADE_SECENEKLERI, vadeEtiketi } from "./sabitler";
import { inputTarih } from "./tarih";
import { vadeDurumu, vadeTarihiHesapla } from "./vade";

/**
 * Tarih metnini YEREL gece yarısı olarak kurar.
 *
 * `new Date("2026-06-10")` metni UTC sayar; saat dilimi UTC'nin gerisindeyse
 * yerel gün bir geri kayar. Vade hesabı (src/lib/tarih.ts) tamamen yerel gün
 * üzerinden çalıştığı için testin de yerel gün kurması gerekir.
 */
function yerelTarih(metin: string): Date {
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(metin) ? `${metin}T00:00:00` : metin);
}

const BUGUN = yerelTarih("2026-06-15T10:00:00");

function fatura(vadeGun: number, vadeTarihi: string | null, vadeOdendi = false) {
  return { vadeGun, vadeTarihi: vadeTarihi ? yerelTarih(vadeTarihi) : null, vadeOdendi };
}

test("vadeTarihiHesapla — fatura tarihine vade günü eklenir", () => {
  // Karşılaştırma yerel gün üzerinden; toISOString() saat dilimine göre kayar.
  assert.equal(inputTarih(vadeTarihiHesapla(yerelTarih("2026-06-01"), 21)), "2026-06-22");
  assert.equal(inputTarih(vadeTarihiHesapla(yerelTarih("2026-06-01"), 45)), "2026-07-16");
});

test("vadeTarihiHesapla — vadesiz faturada null", () => {
  assert.equal(vadeTarihiHesapla(yerelTarih("2026-06-01"), 0), null);
});

test("vadesiz fatura YOK durumunda, satır boyanmaz", () => {
  const v = vadeDurumu(fatura(0, null), BUGUN);
  assert.equal(v.durum, "YOK");
  assert.equal(v.satirSinifi, "");
});

test("faturası olmayan cihaz YOK durumunda", () => {
  assert.equal(vadeDurumu(null, BUGUN).durum, "YOK");
  assert.equal(vadeDurumu(undefined, BUGUN).durum, "YOK");
});

test("vadesi geçmiş ve ödenmemiş fatura kırmızı", () => {
  const v = vadeDurumu(fatura(21, "2026-06-10"), BUGUN);
  assert.equal(v.durum, "GECTI");
  assert.equal(v.kalanGun, -5);
  assert.match(v.satirSinifi, /bg-red-50/);
  assert.equal(v.etiket, "5 gün geçti");
});

test("7 gün veya az kalan vade sarı", () => {
  const v = vadeDurumu(fatura(21, "2026-06-20"), BUGUN);
  assert.equal(v.durum, "YAKLASIYOR");
  assert.equal(v.kalanGun, 5);
  assert.match(v.satirSinifi, /bg-amber-50/);
});

test("tam 7 gün kala hâlâ sarı, 8 gün kala normal", () => {
  assert.equal(vadeDurumu(fatura(21, "2026-06-22"), BUGUN).durum, "YAKLASIYOR");
  assert.equal(vadeDurumu(fatura(21, "2026-06-23"), BUGUN).durum, "NORMAL");
});

test("vadesi bugün dolan fatura sarı ve 'Bugün' yazar", () => {
  const v = vadeDurumu(fatura(21, "2026-06-15T23:00:00"), BUGUN);
  assert.equal(v.durum, "YAKLASIYOR");
  assert.equal(v.etiket, "Bugün");
});

test("ödenmiş fatura vadesi geçse bile boyanmaz", () => {
  const v = vadeDurumu(fatura(45, "2026-01-01", true), BUGUN);
  assert.equal(v.durum, "ODENDI");
  assert.equal(v.satirSinifi, "");
  assert.equal(v.etiket, "Ödendi");
});

test("gün sınırı saat bileşeninden etkilenmez", () => {
  // Vade bugün 00:05'te dolmuş görünse de gün farkı sıfırdır, geçmiş sayılmaz.
  const v = vadeDurumu(fatura(21, "2026-06-15T00:05:00"), new Date("2026-06-15T23:50:00"));
  assert.equal(v.durum, "YAKLASIYOR");
  assert.equal(v.kalanGun, 0);
});

test("vadeEtiketi — serbest gün sayısı da etiketlenir", () => {
  assert.equal(vadeEtiketi(0), "Vadesiz");
  assert.equal(vadeEtiketi(21), "21 gün");
  assert.equal(vadeEtiketi(37), "37 gün");
  assert.equal(vadeEtiketi(365), "365 gün");
});

test("VADE_ETIKET — hızlı seçim değerlerini kapsar", () => {
  for (const gun of VADE_SECENEKLERI) {
    assert.equal(VADE_ETIKET[gun], vadeEtiketi(gun));
  }
});
