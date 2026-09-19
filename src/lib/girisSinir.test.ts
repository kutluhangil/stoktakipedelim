import assert from "node:assert/strict";
import { test } from "node:test";
import {
  IP_DENEME_SINIRI,
  KULLANICI_DENEME_SINIRI,
  PENCERE_DK,
  kilitKalanSaniye,
  kilitMesaji,
} from "./girisSinir";

const SIMDI = new Date("2026-06-15T12:00:00");

/** `dakika` dakika önceye tarih üretir. */
function onceki(dakika: number): Date {
  return new Date(SIMDI.getTime() - dakika * 60_000);
}

test("kilitKalanSaniye — sınırın altında kilit yok", () => {
  const denemeler = [onceki(1), onceki(2), onceki(3), onceki(4)];
  assert.equal(kilitKalanSaniye(denemeler, KULLANICI_DENEME_SINIRI, SIMDI), 0);
});

test("kilitKalanSaniye — sınıra ulaşınca pencere sonuna kadar kilitli", () => {
  const denemeler = [onceki(5), onceki(4), onceki(3), onceki(2), onceki(1)];
  // Kilidi açan deneme 5 dakika önce; 15 dakikalık pencereden düşmesine 10 dakika var.
  assert.equal(kilitKalanSaniye(denemeler, KULLANICI_DENEME_SINIRI, SIMDI), 10 * 60);
});

test("kilitKalanSaniye — pencereden düşen denemeler sayılmaz", () => {
  const denemeler = [onceki(60), onceki(40), onceki(20), onceki(16), onceki(1)];
  assert.equal(kilitKalanSaniye(denemeler, KULLANICI_DENEME_SINIRI, SIMDI), 0);
});

test("kilitKalanSaniye — yeni deneme kilidi uzatır", () => {
  const eski = [onceki(14), onceki(13), onceki(12), onceki(11), onceki(10)];
  assert.equal(kilitKalanSaniye(eski, KULLANICI_DENEME_SINIRI, SIMDI), 60);

  const yeniDenemeyle = [...eski, onceki(0)];
  // Artık kilidi açan deneme 13 dakika öncesi; 2 dakika kaldı.
  assert.equal(kilitKalanSaniye(yeniDenemeyle, KULLANICI_DENEME_SINIRI, SIMDI), 2 * 60);
});

test("kilitKalanSaniye — pencere tam dolduğunda kilit kalkar", () => {
  const denemeler = Array.from({ length: KULLANICI_DENEME_SINIRI }, () => onceki(PENCERE_DK));
  assert.equal(kilitKalanSaniye(denemeler, KULLANICI_DENEME_SINIRI, SIMDI), 0);
});

test("kilitKalanSaniye — IP sınırı kullanıcı sınırından yüksek", () => {
  const denemeler = Array.from({ length: 10 }, (_, i) => onceki(i + 1));
  assert.equal(kilitKalanSaniye(denemeler, IP_DENEME_SINIRI, SIMDI), 0);
  assert.ok(kilitKalanSaniye(denemeler, KULLANICI_DENEME_SINIRI, SIMDI) > 0);
});

test("kilitKalanSaniye — deneme yoksa kilit yok", () => {
  assert.equal(kilitKalanSaniye([], KULLANICI_DENEME_SINIRI, SIMDI), 0);
});

test("kilitMesaji — kalan süre dakikaya yuvarlanır", () => {
  assert.equal(kilitMesaji(1), "Çok fazla hatalı giriş denemesi. 1 dakika sonra tekrar deneyin.");
  assert.equal(kilitMesaji(600), "Çok fazla hatalı giriş denemesi. 10 dakika sonra tekrar deneyin.");
  assert.equal(kilitMesaji(601), "Çok fazla hatalı giriş denemesi. 11 dakika sonra tekrar deneyin.");
});
