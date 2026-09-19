import assert from "node:assert/strict";
import { test } from "node:test";
import { guvenliDonusYolu } from "./yonlendirme";

test("guvenliDonusYolu — site içi yollar olduğu gibi döner", () => {
  assert.equal(guvenliDonusYolu("/cihazlar"), "/cihazlar");
  assert.equal(
    guvenliDonusYolu("/cihazlar?durum=STOKTA&sayfa=2"),
    "/cihazlar?durum=STOKTA&sayfa=2",
  );
  assert.equal(guvenliDonusYolu("/sayim/12#satir-3"), "/sayim/12#satir-3");
});

test("guvenliDonusYolu — protokol-göreli dış adres reddedilir", () => {
  // "//example.com" tarayıcıda http://example.com olarak çözülür.
  assert.equal(guvenliDonusYolu("//example.com/kimlik-dogrula"), "/panel");
  assert.equal(guvenliDonusYolu("///example.com"), "/panel");
  assert.equal(guvenliDonusYolu("/\\example.com"), "/panel");
});

test("guvenliDonusYolu — mutlak adres ve şema reddedilir", () => {
  assert.equal(guvenliDonusYolu("http://example.com"), "/panel");
  assert.equal(guvenliDonusYolu("javascript:alert(1)"), "/panel");
  assert.equal(guvenliDonusYolu("cihazlar"), "/panel");
});

test("guvenliDonusYolu — kontrol karakteri içeren yol reddedilir", () => {
  assert.equal(guvenliDonusYolu("/panel\nLocation: http://example.com"), "/panel");
  assert.equal(guvenliDonusYolu("/panel\r\n"), "/panel");
});

test("guvenliDonusYolu — boş girdi varsayılana düşer", () => {
  assert.equal(guvenliDonusYolu(""), "/panel");
  assert.equal(guvenliDonusYolu(null), "/panel");
  assert.equal(guvenliDonusYolu(undefined), "/panel");
  assert.equal(guvenliDonusYolu("", "/giris"), "/giris");
});
