-- CreateTable
CREATE TABLE "GirisDenemesi" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "kullaniciAdi" TEXT NOT NULL,
    "ip" TEXT,
    "basarili" BOOLEAN NOT NULL DEFAULT false,
    "tarih" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Kullanici" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "kullaniciAdi" TEXT NOT NULL,
    "adSoyad" TEXT NOT NULL,
    "sifreHash" TEXT NOT NULL,
    "rol" TEXT NOT NULL,
    "magazaId" INTEGER,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "sutunTercihi" TEXT,
    "oturumSurumu" INTEGER NOT NULL DEFAULT 1,
    "sonGiris" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Kullanici_magazaId_fkey" FOREIGN KEY ("magazaId") REFERENCES "Magaza" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Kullanici" ("adSoyad", "aktif", "createdAt", "id", "kullaniciAdi", "magazaId", "rol", "sifreHash", "sonGiris", "sutunTercihi") SELECT "adSoyad", "aktif", "createdAt", "id", "kullaniciAdi", "magazaId", "rol", "sifreHash", "sonGiris", "sutunTercihi" FROM "Kullanici";
DROP TABLE "Kullanici";
ALTER TABLE "new_Kullanici" RENAME TO "Kullanici";
CREATE UNIQUE INDEX "Kullanici_kullaniciAdi_key" ON "Kullanici"("kullaniciAdi");
CREATE INDEX "Kullanici_magazaId_idx" ON "Kullanici"("magazaId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "GirisDenemesi_kullaniciAdi_tarih_idx" ON "GirisDenemesi"("kullaniciAdi", "tarih");

-- CreateIndex
CREATE INDEX "GirisDenemesi_ip_tarih_idx" ON "GirisDenemesi"("ip", "tarih");

-- CreateIndex
CREATE INDEX "GirisDenemesi_tarih_idx" ON "GirisDenemesi"("tarih");
