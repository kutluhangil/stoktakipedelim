import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { SIHIR, dosyayiCoz, dosyayiSifrele, yedekAnahtariniOku } from "./sifreliYedek";

const ANAHTAR = randomBytes(32);
const ICERIK = Buffer.concat([Buffer.from("müşteri: 12345678901 · 0532 111 22 33\n"), randomBytes(50_000)]);

async function geciciKlasor() {
  return mkdtemp(path.join(tmpdir(), "yedek-test-"));
}

test("yedekAnahtariniOku — 64 hex karakter kabul edilir", () => {
  const hex = randomBytes(32).toString("hex");
  assert.equal(yedekAnahtariniOku(hex).length, 32);
  assert.equal(yedekAnahtariniOku(` ${hex} `).toString("hex"), hex);
});

test("yedekAnahtariniOku — eksik veya hatalı anahtar açık hata verir", () => {
  assert.throws(() => yedekAnahtariniOku(undefined), /tanımlı değil/);
  assert.throws(() => yedekAnahtariniOku(""), /tanımlı değil/);
  assert.throws(() => yedekAnahtariniOku("kisa"), /64 hex karakter olmalı/);
  assert.throws(() => yedekAnahtariniOku("z".repeat(64)), /64 hex karakter olmalı/);
});

test("şifrele/çöz — içerik bire bir geri gelir", async () => {
  const klasor = await geciciKlasor();
  try {
    const duz = path.join(klasor, "duz.bin");
    const sifreli = path.join(klasor, "sifreli.enc");
    const geri = path.join(klasor, "geri.bin");
    await writeFile(duz, ICERIK);

    const boyut = await dosyayiSifrele(duz, sifreli, ANAHTAR);
    assert.ok(boyut > ICERIK.length, "şifreli dosya başlık ve etiket kadar büyük olmalı");

    await dosyayiCoz(sifreli, geri, ANAHTAR);
    assert.deepEqual(await readFile(geri), ICERIK);
  } finally {
    await rm(klasor, { recursive: true, force: true });
  }
});

test("şifreli dosyada düz metin kalmıyor", async () => {
  const klasor = await geciciKlasor();
  try {
    const duz = path.join(klasor, "duz.bin");
    const sifreli = path.join(klasor, "sifreli.enc");
    await writeFile(duz, ICERIK);
    await dosyayiSifrele(duz, sifreli, ANAHTAR);

    const ham = await readFile(sifreli);
    assert.ok(ham.subarray(0, SIHIR.length).equals(SIHIR), "imza başta durmalı");
    assert.equal(ham.includes(Buffer.from("12345678901")), false);
    assert.equal(ham.includes(Buffer.from("0532 111 22 33")), false);
  } finally {
    await rm(klasor, { recursive: true, force: true });
  }
});

test("yanlış anahtarla çözme hata verir", async () => {
  const klasor = await geciciKlasor();
  try {
    const duz = path.join(klasor, "duz.bin");
    const sifreli = path.join(klasor, "sifreli.enc");
    await writeFile(duz, ICERIK);
    await dosyayiSifrele(duz, sifreli, ANAHTAR);

    await assert.rejects(dosyayiCoz(sifreli, path.join(klasor, "geri.bin"), randomBytes(32)));
  } finally {
    await rm(klasor, { recursive: true, force: true });
  }
});

test("dosya kurcalanmışsa çözme hata verir", async () => {
  const klasor = await geciciKlasor();
  try {
    const duz = path.join(klasor, "duz.bin");
    const sifreli = path.join(klasor, "sifreli.enc");
    await writeFile(duz, ICERIK);
    await dosyayiSifrele(duz, sifreli, ANAHTAR);

    const ham = await readFile(sifreli);
    ham[ham.length - 40] ^= 0xff;
    await writeFile(sifreli, ham);

    await assert.rejects(dosyayiCoz(sifreli, path.join(klasor, "geri.bin"), ANAHTAR));
  } finally {
    await rm(klasor, { recursive: true, force: true });
  }
});

test("şifreli yedek olmayan dosya reddedilir", async () => {
  const klasor = await geciciKlasor();
  try {
    const sahte = path.join(klasor, "sahte.enc");
    await writeFile(sahte, randomBytes(200));
    await assert.rejects(
      dosyayiCoz(sahte, path.join(klasor, "geri.bin"), ANAHTAR),
      /imza uyuşmuyor/,
    );
  } finally {
    await rm(klasor, { recursive: true, force: true });
  }
});
