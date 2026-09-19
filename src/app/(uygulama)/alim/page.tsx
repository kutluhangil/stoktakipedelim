import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { inputTarih } from "@/lib/tarih";
import { adminMi, ikinciElAlabilirMi, oturumGerekli } from "@/lib/yetki";
import { AlimFormu } from "./AlimFormu";

export const metadata = { title: "İkinci El Alım — Stok Takip" };

export default async function AlimSayfasi() {
  const oturum = await oturumGerekli();
  if (!ikinciElAlabilirMi(oturum)) redirect("/panel");

  const [kategoriler, magazalar] = await Promise.all([
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
    prisma.magaza.findMany({
      // Sorumlu yalnız kendi deposuna alım yapabilir; yönetici hepsine.
      where: adminMi(oturum) ? { aktif: true } : { aktif: true, id: oturum.magazaId ?? -1 },
      orderBy: { kod: "asc" },
      select: { id: true, ad: true },
    }),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">İkinci El Alım</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Tezgâhtan alınan cihaz doğrudan stoğa girer. Alış faturası ve tedarikçi yoktur, bu
          yüzden vade raporuna girmez; kimden alındığı cihaz detayında görünür.
        </p>
      </div>

      {magazalar.length === 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Alım yapılabilecek aktif bir depo yok.
        </p>
      ) : (
        <AlimFormu
          kategoriler={kategoriler}
          magazalar={magazalar}
          varsayilanMagazaId={oturum.magazaId}
          bugun={inputTarih(new Date())}
        />
      )}
    </div>
  );
}
