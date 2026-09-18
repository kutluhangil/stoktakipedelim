import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { STOK_DURUM, STOK_DURUM_ETIKET, type StokDurum } from "@/lib/sabitler";
import { adminSayfasi } from "@/lib/yetki";
import { CihazDuzenlemeFormu } from "./CihazDuzenlemeFormu";

export const metadata = { title: "Cihaz Düzenle — Stok Takip" };

/** Kaydı kilitleyen durumlar; gerekçesiyle birlikte. */
const KILITLI_DURUMLAR: Partial<Record<StokDurum, string>> = {
  [STOK_DURUM.SATILDI]:
    "Satılmış cihazın kaydı değiştirilemez; alış fiyatı değişirse geçmiş kâr raporu geriye dönük bozulur.",
  [STOK_DURUM.TRANSFERDE]:
    "Sevkiyattaki cihazın kaydı değiştirilemez; hedef mağazanın okuttuğu künye ile uyuşmaz hâle gelir.",
  [STOK_DURUM.IPTAL]: "İptal edilmiş cihaz düzenlenemez. Önce iptali geri alın.",
};

export default async function CihazDuzenleSayfasi({
  params,
}: PageProps<"/cihazlar/[id]/duzenle">) {
  await adminSayfasi();
  const { id } = await params;
  const cihazId = Number(id);
  if (!Number.isInteger(cihazId)) notFound();

  const [cihaz, kategoriler] = await Promise.all([
    prisma.stokKalemi.findUnique({
      where: { id: cihazId },
      select: {
        id: true,
        durum: true,
        kategoriId: true,
        altKategoriId: true,
        marka: true,
        model: true,
        renk: true,
        kapasite: true,
        seriNo: true,
        barkod: true,
        alisFiyatiKurus: true,
        not: true,
      },
    }),
    prisma.kategori.findMany({
      where: { aktif: true },
      orderBy: { sira: "asc" },
      select: {
        id: true,
        ad: true,
        seriNoZorunlu: true,
        altKategoriler: {
          where: { aktif: true },
          orderBy: { sira: "asc" },
          select: { id: true, ad: true },
        },
      },
    }),
  ]);

  if (!cihaz) notFound();

  const kilitNedeni = KILITLI_DURUMLAR[cihaz.durum as StokDurum];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Cihaz düzenle · {cihaz.marka} {cihaz.model}
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            #{cihaz.id}
            {cihaz.seriNo ? ` · ${cihaz.seriNo}` : ""} ·{" "}
            {STOK_DURUM_ETIKET[cihaz.durum as StokDurum] ?? cihaz.durum}
          </p>
        </div>
        <Link
          href={`/cihazlar/${cihaz.id}`}
          className="text-sm font-medium text-blue-700 hover:underline"
        >
          Cihaz detayına dön
        </Link>
      </div>

      {kilitNedeni ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-900">{kilitNedeni}</p>
        </div>
      ) : (
        <CihazDuzenlemeFormu cihaz={cihaz} kategoriler={kategoriler} />
      )}
    </div>
  );
}
