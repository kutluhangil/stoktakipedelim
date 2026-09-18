"use client";

import { useActionState, useState } from "react";
import { GIRDI_SINIFI } from "@/bilesenler/Alan";
import { GonderDugmesi } from "@/bilesenler/Dugme";
import { STOK_DURUM } from "@/lib/sabitler";
import { cihaziIptalEt, cihazIptaliniGeriAl, type CihazIptalDurumu } from "../eylemler";

function Sonuc({ durum }: { durum: CihazIptalDurumu }) {
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

/** İptal edilmiş kaydı stoğa geri döndürür. */
function GeriAlFormu({ cihazId }: { cihazId: number }) {
  const [durum, eylem] = useActionState<CihazIptalDurumu, FormData>(cihazIptaliniGeriAl, {});

  return (
    <form action={eylem}>
      <input type="hidden" name="cihazId" value={cihazId} />
      <GonderDugmesi tur="ikincil" bekleyenMetin="Geri alınıyor…">
        İptali geri al
      </GonderDugmesi>
      <p className="mt-1.5 text-xs text-slate-500">
        Cihaz bulunduğu depoda tekrar stokta görünür.
      </p>
      <Sonuc durum={durum} />
    </form>
  );
}

/**
 * İptal iki adımlıdır: neden yazılmadan buton görünmez.
 * Tek tıkla kayıt listeden düşmesin diye kasıtlı olarak sürtünme bırakıldı.
 */
function IptalFormu({ cihazId }: { cihazId: number }) {
  const [durum, eylem] = useActionState<CihazIptalDurumu, FormData>(cihaziIptalEt, {});
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
          Kaydı iptal et
        </button>
        <p className="mt-1.5 text-xs text-slate-500">
          Yanlış girilen kayıt için. Silinmez, listelerden ve stok değerinden düşer.
        </p>
      </div>
    );
  }

  return (
    <form action={eylem}>
      <input type="hidden" name="cihazId" value={cihazId} />
      <label htmlFor="neden" className="mb-1.5 block text-sm font-medium text-slate-700">
        İptal nedeni
      </label>
      <input
        id="neden"
        name="neden"
        value={neden}
        onChange={(e) => setNeden(e.target.value)}
        placeholder="Örn. fatura satırı yanlış girildi"
        className={GIRDI_SINIFI}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <GonderDugmesi tur="tehlike" bekleyenMetin="İptal ediliyor…" disabled={neden.trim().length < 3}>
          İptal et
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

export function YonetimDugmeleri({ cihazId, durum }: { cihazId: number; durum: string }) {
  return durum === STOK_DURUM.IPTAL ? (
    <GeriAlFormu cihazId={cihazId} />
  ) : (
    <IptalFormu cihazId={cihazId} />
  );
}
