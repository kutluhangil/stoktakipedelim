"use client";

import { useActionState, useState } from "react";
import { GIRDI_SINIFI } from "@/bilesenler/Alan";
import { GonderDugmesi } from "@/bilesenler/Dugme";
import {
  IADE_SONUCLARI,
  IADE_SONUC_ACIKLAMA,
  STOK_DURUM,
  STOK_DURUM_ETIKET,
} from "@/lib/sabitler";
import { satisIadeAl, type IadeDurumu } from "../../satis/eylemler";

/**
 * İade iki adımlıdır: neden yazılmadan gönder düğmesi etkin olmaz.
 * Satış geri alındığında ciro ve kâr raporları değiştiği için kasıtlı sürtünme.
 */
export function IadeFormu({ cihazId, bugun }: { cihazId: number; bugun: string }) {
  const [durum, eylem] = useActionState<IadeDurumu, FormData>(satisIadeAl, {});
  const [acik, setAcik] = useState(false);
  const [neden, setNeden] = useState("");

  if (durum.basari) {
    return (
      <p role="status" className="text-sm font-medium text-emerald-700">
        {durum.basari}
      </p>
    );
  }

  if (!acik) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setAcik(true)}
          className="rounded-lg border border-amber-300 bg-white px-3.5 py-2 text-sm font-medium text-amber-800 transition hover:bg-amber-50"
        >
          İade al
        </button>
        <p className="mt-1.5 text-xs text-slate-500">
          Müşteri cihazı geri getirdiyse. Satış ciro ve kâr raporlarından düşer, cihaz depoya
          geri girer.
        </p>
      </div>
    );
  }

  return (
    <form action={eylem} className="space-y-3">
      <input type="hidden" name="cihazId" value={cihazId} />

      <div>
        <label htmlFor="iadeNeden" className="mb-1.5 block text-sm font-medium text-slate-700">
          İade nedeni
        </label>
        <input
          id="iadeNeden"
          name="neden"
          value={neden}
          onChange={(e) => setNeden(e.target.value)}
          placeholder="Örn. 14 gün cayma hakkı"
          className={GIRDI_SINIFI}
        />
      </div>

      <div>
        <label htmlFor="iadeTarihi" className="mb-1.5 block text-sm font-medium text-slate-700">
          İade tarihi
        </label>
        <input
          id="iadeTarihi"
          name="iadeTarihi"
          type="date"
          defaultValue={bugun}
          max={bugun}
          className={GIRDI_SINIFI}
        />
      </div>

      <div>
        <label htmlFor="sonucDurum" className="mb-1.5 block text-sm font-medium text-slate-700">
          Cihazın yeni durumu
        </label>
        <select
          id="sonucDurum"
          name="sonucDurum"
          defaultValue={STOK_DURUM.IADE}
          className={GIRDI_SINIFI}
        >
          {IADE_SONUCLARI.map((d) => (
            <option key={d} value={d}>
              {STOK_DURUM_ETIKET[d]} — {IADE_SONUC_ACIKLAMA[d]}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">
          Yalnız &quot;Stokta&quot; seçilirse cihaz tekrar satılabilir hâle gelir.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <GonderDugmesi
          tur="tehlike"
          bekleyenMetin="İade alınıyor…"
          disabled={neden.trim().length < 3}
        >
          İadeyi kaydet
        </GonderDugmesi>
        <button
          type="button"
          onClick={() => setAcik(false)}
          className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Vazgeç
        </button>
      </div>

      {durum.hata ? (
        <p role="alert" className="text-sm text-red-600">
          {durum.hata}
        </p>
      ) : null}
    </form>
  );
}
