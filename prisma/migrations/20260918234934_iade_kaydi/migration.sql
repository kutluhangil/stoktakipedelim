-- CreateTable
CREATE TABLE "Iade" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "stokKalemiId" INTEGER NOT NULL,
    "musteriId" INTEGER,
    "magazaId" INTEGER NOT NULL,
    "satisTarihi" DATETIME NOT NULL,
    "satisFiyatiKurus" INTEGER NOT NULL,
    "alisFiyatiKurus" INTEGER NOT NULL,
    "satanKullaniciId" INTEGER,
    "odemeTipi" TEXT,
    "iadeTarihi" DATETIME NOT NULL,
    "neden" TEXT NOT NULL,
    "sonucDurum" TEXT NOT NULL,
    "alanKullaniciId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Iade_stokKalemiId_fkey" FOREIGN KEY ("stokKalemiId") REFERENCES "StokKalemi" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Iade_musteriId_fkey" FOREIGN KEY ("musteriId") REFERENCES "Musteri" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Iade_magazaId_fkey" FOREIGN KEY ("magazaId") REFERENCES "Magaza" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Iade_satanKullaniciId_fkey" FOREIGN KEY ("satanKullaniciId") REFERENCES "Kullanici" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Iade_alanKullaniciId_fkey" FOREIGN KEY ("alanKullaniciId") REFERENCES "Kullanici" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Iade_iadeTarihi_idx" ON "Iade"("iadeTarihi");

-- CreateIndex
CREATE INDEX "Iade_musteriId_idx" ON "Iade"("musteriId");

-- CreateIndex
CREATE INDEX "Iade_stokKalemiId_idx" ON "Iade"("stokKalemiId");
