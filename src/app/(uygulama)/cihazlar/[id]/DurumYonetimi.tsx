"use client";

import { useActionState, useState } from "react";
import { GIRDI_SINIFI } from "@/bilesenler/Alan";
import { GonderDugmesi } from "@/bilesenler/Dugme";
import { cihaziArizaliYap, cihaziStogaAl, type StogaAlmaDurumu } from "../eylemler";

function Sonuc({ durum }: { durum: StogaAlmaDurumu }) {
  if (durum.hata) {
    return (
      <p role="alert" className="mt-2 text-sm text-red-600">
        {durum.hata}
      </p>
    );
  }
  if (durum.basari) {
    return (
      <p role="status" className="mt-2 text-sm font-medium text-emerald-700">
        {durum.basari}
      </p>
    );
  }
  return null;
}

/** İade/arıza/kayıp kontrolü biten cihazı tekrar satılabilir hâle getirir. */
export function StogaAlFormu({ cihazId }: { cihazId: number }) {
  const [durum, eylem] = useActionState<StogaAlmaDurumu, FormData>(cihaziStogaAl, {});

  return (
    <form action={eylem} className="space-y-3">
      <input type="hidden" name="cihazId" value={cihazId} />
      <div>
        <label htmlFor="stogaAciklama" className="mb-1.5 block text-sm font-medium text-slate-700">
          Açıklama (isteğe bağlı)
        </label>
        <input
          id="stogaAciklama"
          name="aciklama"
          placeholder="Örn. kontrol edildi, sorun yok"
          className={GIRDI_SINIFI}
        />
      </div>
      <GonderDugmesi tur="basari" bekleyenMetin="Açılıyor…">
        Satışa aç
      </GonderDugmesi>
      <p className="text-xs text-slate-500">
        Cihaz bulunduğu depoda stokta görünür ve satış ekranından okutulabilir.
      </p>
      <Sonuc durum={durum} />
    </form>
  );
}

/** Stoktaki cihazı arızalı işaretler; neden yazılmadan düğme etkinleşmez. */
export function ArizaFormu({ cihazId }: { cihazId: number }) {
  const [durum, eylem] = useActionState<StogaAlmaDurumu, FormData>(cihaziArizaliYap, {});
  const [acik, setAcik] = useState(false);
  const [neden, setNeden] = useState("");

  if (!acik) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setAcik(true)}
          className="rounded-lg border border-red-300 bg-white px-3.5 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50"
        >
          Arızalı işaretle
        </button>
        <p className="mt-1.5 text-xs text-slate-500">
          Cihaz stok değerinden ve satıştan düşer; servis dönüşünde satışa açılır.
        </p>
      </div>
    );
  }

  return (
    <form action={eylem}>
      <input type="hidden" name="cihazId" value={cihazId} />
      <label htmlFor="arizaNeden" className="mb-1.5 block text-sm font-medium text-slate-700">
        Arıza nedeni
      </label>
      <input
        id="arizaNeden"
        name="neden"
        value={neden}
        onChange={(e) => setNeden(e.target.value)}
        placeholder="Örn. ekran değişimi gerekiyor"
        className={GIRDI_SINIFI}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <GonderDugmesi tur="tehlike" bekleyenMetin="İşaretleniyor…" disabled={neden.trim().length < 3}>
          Arızalı işaretle
        </GonderDugmesi>
        <button
          type="button"
          onClick={() => setAcik(false)}
          className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Vazgeç
        </button>
      </div>
      <Sonuc durum={durum} />
    </form>
  );
}
