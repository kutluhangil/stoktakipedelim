// Şifreli yedeği açar: stok-yedek-*.db.gz.enc -> .db
// Kullanım: npm run yedek:coz -- <dosya.db.gz.enc> [hedef.db]
import { createReadStream, createWriteStream } from "node:fs";
import { rm, stat } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import "dotenv/config";
import { dosyayiCoz, yedekAnahtariniOku } from "../src/lib/sifreliYedek";

const [kaynak, hedefArg] = process.argv.slice(2);

if (!kaynak) {
  console.error(
    "Kullanım: npm run yedek:coz -- <stok-yedek-....db.gz.enc> [hedef.db]\n" +
      "Anahtar .env içindeki YEDEK_SIFRELEME_ANAHTARI'ndan okunur.",
  );
  process.exit(1);
}

const anahtar = yedekAnahtariniOku();
const hedef = hedefArg ?? path.basename(kaynak).replace(/\.db\.gz\.enc$/, ".db");
const araGzip = `${hedef}.gz`;

await dosyayiCoz(kaynak, araGzip, anahtar);
await pipeline(createReadStream(araGzip), createGunzip(), createWriteStream(hedef));
await rm(araGzip, { force: true });

const boyut = (await stat(hedef)).size;
console.log(`Çözüldü: ${hedef} (${(boyut / 1024 / 1024).toFixed(2)} MB)`);
console.log("SQLite dosyası olarak açılabilir: sqlite3 " + hedef);

