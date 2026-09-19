import assert from "node:assert/strict";
import { test } from "node:test";
import { iadeSonucuMu, iadeTarihiHatasi } from "./iade";
import { STOK_DURUM } from "./sabitler";

/** Tarih metnini YEREL gece yarısı olarak kurar (bkz. vade.test.ts). */
function yerelTarih(metin: string): Date {
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(metin) ? `${metin}T00:00:00` : metin);
}

const BUGUN = yerelTarih("2026-06-15T10:00:00");

test("iadeSonucuMu — yalnız stokta, iade ve arızalı kabul edilir", () => {
  assert.equal(iadeSonucuMu(STOK_DURUM.STOKTA), true);
  assert.equal(iadeSonucuMu(STOK_DURUM.IADE), true);
  assert.equal(iadeSonucuMu(STOK_DURUM.ARIZALI), true);
});

test("iadeSonucuMu — satılmış, transferde, iptal ve çöp değerler reddedilir", () => {
  assert.equal(iadeSonucuMu(STOK_DURUM.SATILDI), false);
  assert.equal(iadeSonucuMu(STOK_DURUM.TRANSFERDE), false);
  assert.equal(iadeSonucuMu(STOK_DURUM.IPTAL), false);
  assert.equal(iadeSonucuMu("stokta"), false);
  assert.equal(iadeSonucuMu(null), false);
  assert.equal(iadeSonucuMu(undefined), false);
});

test("iadeTarihiHatasi — satış ile bugün arasındaki tarih geçerli", () => {
  assert.equal(
    iadeTarihiHatasi({
      satisTarihi: yerelTarih("2026-06-01"),
      iadeTarihi: yerelTarih("2026-06-10"),
      bugun: BUGUN,
    }),
    null,
  );
});

test("iadeTarihiHatasi — aynı gün satılıp iade edilen cihaz geçerli", () => {
  // Satış öğleden sonra, iade kaydı o günün gece yarısı olarak geliyor.
  assert.equal(
    iadeTarihiHatasi({
      satisTarihi: yerelTarih("2026-06-15T16:40:00"),
      iadeTarihi: yerelTarih("2026-06-15"),
      bugun: BUGUN,
    }),
    null,
  );
});

test("iadeTarihiHatasi — satıştan önceki tarih reddedilir", () => {
  assert.equal(
    iadeTarihiHatasi({
      satisTarihi: yerelTarih("2026-06-10"),
      iadeTarihi: yerelTarih("2026-06-09"),
      bugun: BUGUN,
    }),
    "İade tarihi satış tarihinden önce olamaz.",
  );
});

test("iadeTarihiHatasi — ileri tarihli iade reddedilir", () => {
  assert.equal(
    iadeTarihiHatasi({
      satisTarihi: yerelTarih("2026-06-01"),
      iadeTarihi: yerelTarih("2026-06-16"),
      bugun: BUGUN,
    }),
    "İade tarihi ileri tarihli olamaz.",
  );
});

test("iadeTarihiHatasi — bugünün ilerleyen saati hâlâ bugündür", () => {
  assert.equal(
    iadeTarihiHatasi({
      satisTarihi: yerelTarih("2026-06-01"),
      iadeTarihi: yerelTarih("2026-06-15T23:30:00"),
      bugun: BUGUN,
    }),
    null,
  );
});

test("iadeTarihiHatasi — geçersiz tarih ayrı mesaj verir", () => {
  assert.equal(
    iadeTarihiHatasi({
      satisTarihi: yerelTarih("2026-06-01"),
      iadeTarihi: new Date("olmayan tarih"),
      bugun: BUGUN,
    }),
    "İade tarihi geçersiz.",
  );
});
