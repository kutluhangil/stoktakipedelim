import { logYaz } from "@/lib/log";
import {
  CIHAZ_ICERIK,
  filtredenWhere,
  filtreyiCoz,
} from "@/lib/cihazFiltre";
import { excelBasliklari, excelUret, kurusuExcelSayisi } from "@/lib/excel";
import { oturumuOku } from "@/lib/oturum";
import { prisma } from "@/lib/prisma";
import { LOG_ISLEM } from "@/lib/sabitler";
import {
  SUTUNLAR,
  beklemeGunu,
  karKurus,
  sutunTercihiniCoz,
  sutunlariSirala,
  type SutunAnahtari,
} from "@/lib/sutunlar";

/** Excel'de metin yerine sayı yazılacak sütunlar — hücrede toplam alınabilsin diye. */
const PARASAL = new Set<SutunAnahtari>(["alisFiyati", "satisFiyati", "kar"]);

/** Cihaz listesini o anki filtre ve seçili sütunlarla Excel olarak indirir. */
/** Tek dosyada makul üst sınır; aşılırsa kullanıcıya uyarı yazılır. */
const EXCEL_SATIR_SINIRI = 20_000;

export async function GET(istek: Request) {
  const oturum = await oturumuOku();
  if (!oturum) return new Response("Oturum gerekli.", { status: 401 });

  const url = new URL(istek.url);
  const params = Object.fromEntries(url.searchParams.entries());
  const filtre = filtreyiCoz(params);
  const bugun = new Date();
  const where = filtredenWhere(filtre, bugun);

  const [kullanici, tumSatirlar] = await Promise.all([
    prisma.kullanici.findUnique({
      where: { id: oturum.kullaniciId },
      select: { sutunTercihi: true },
    }),
    prisma.stokKalemi.findMany({
      where,
      include: CIHAZ_ICERIK,
      orderBy: [{ girisTarihi: "desc" }, { id: "desc" }],
      // Sınırın bir fazlası çekilir: kesme olup olmadığı böyle anlaşılır.
      take: EXCEL_SATIR_SINIRI + 1,
    }),
  ]);

  // Kesme sessizce olmamalı: fazladan çekilen satır atılır, dosyada ve logda
  // eksik veri uyarısı görünür.
  const kesildi = tumSatirlar.length > EXCEL_SATIR_SINIRI;
  const satirlar = kesildi ? tumSatirlar.slice(0, EXCEL_SATIR_SINIRI) : tumSatirlar;

  const sutunlar = sutunlariSirala(sutunTercihiniCoz(kullanici?.sutunTercihi));

  const veriSatirlari = satirlar.map((satir) =>
    sutunlar.map((anahtar) => {
      if (PARASAL.has(anahtar)) {
        if (anahtar === "alisFiyati") return kurusuExcelSayisi(satir.alisFiyatiKurus);
        if (anahtar === "satisFiyati") return kurusuExcelSayisi(satir.satisFiyatiKurus);
        return kurusuExcelSayisi(karKurus(satir));
      }
      if (anahtar === "bekleme") return beklemeGunu(satir, bugun);
      return SUTUNLAR[anahtar].metin(satir, bugun);
    }),
  );

  const filtreOzeti: string[] = [];
  if (filtre.durum) filtreOzeti.push(`Durum: ${filtre.durum}`);
  if (filtre.magazaId) filtreOzeti.push(`Depo no: ${filtre.magazaId}`);
  if (filtre.kategoriId) filtreOzeti.push(`Kategori no: ${filtre.kategoriId}`);
  if (filtre.vade) filtreOzeti.push(`Vade: ${filtre.vade}`);
  if (filtre.ara) filtreOzeti.push(`Arama: ${filtre.ara}`);

  const toplamAlis = satirlar.reduce((t, s) => t + s.alisFiyatiKurus, 0);

  const dosya = await excelUret([
    {
      ad: "Cihazlar",
      ustBilgiler: [
        `Cihaz Listesi — ${satirlar.length} kayıt`,
        `Toplam alış değeri: ${(toplamAlis / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL`,
        filtreOzeti.length ? `Filtreler — ${filtreOzeti.join(" · ")}` : "Filtre uygulanmadı",
        ...(kesildi
          ? [
              `UYARI: Liste ${EXCEL_SATIR_SINIRI.toLocaleString("tr-TR")} satırda kesildi. Kalan kayıtlar bu dosyada YOK; filtreyi daraltıp tekrar aktarın.`,
            ]
          : []),
      ],
      sutunlar: sutunlar.map((a) => ({
        baslik: SUTUNLAR[a].baslik,
        sayisal: PARASAL.has(a),
        genislik: a === "seriNo" || a === "barkod" ? 20 : undefined,
      })),
      satirlar: veriSatirlari,
    },
  ]);

  await logYaz(oturum, {
    islem: LOG_ISLEM.EXCEL_AKTAR,
    hedefTip: "StokKalemi",
    detay: `${satirlar.length} cihaz · ${sutunlar.length} sütun${
      kesildi ? ` · ${EXCEL_SATIR_SINIRI} satır sınırında kesildi` : ""
    }`,
  });

  const damga = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return new Response(new Uint8Array(dosya), {
    headers: excelBasliklari(`cihazlar-${damga}.xlsx`),
  });
}
