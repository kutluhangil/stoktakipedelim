-- CreateTable
CREATE TABLE "IkinciElAlim" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "stokKalemiId" INTEGER NOT NULL,
    "musteriId" INTEGER NOT NULL,
    "magazaId" INTEGER NOT NULL,
    "alisFiyatiKurus" INTEGER NOT NULL,
    "odemeTipi" TEXT NOT NULL,
    "alimTarihi" DATETIME NOT NULL,
    "not" TEXT,
    "alanKullaniciId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IkinciElAlim_stokKalemiId_fkey" FOREIGN KEY ("stokKalemiId") REFERENCES "StokKalemi" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "IkinciElAlim_musteriId_fkey" FOREIGN KEY ("musteriId") REFERENCES "Musteri" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "IkinciElAlim_magazaId_fkey" FOREIGN KEY ("magazaId") REFERENCES "Magaza" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "IkinciElAlim_alanKullaniciId_fkey" FOREIGN KEY ("alanKullaniciId") REFERENCES "Kullanici" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "IkinciElAlim_stokKalemiId_key" ON "IkinciElAlim"("stokKalemiId");

-- CreateIndex
CREATE INDEX "IkinciElAlim_alimTarihi_idx" ON "IkinciElAlim"("alimTarihi");

-- CreateIndex
CREATE INDEX "IkinciElAlim_musteriId_idx" ON "IkinciElAlim"("musteriId");
