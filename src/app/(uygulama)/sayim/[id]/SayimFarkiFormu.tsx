"use client";

import { useActionState, useState } from "react";
import { GonderDugmesi } from "@/bilesenler/Dugme";
import { sayimFarkiniIsle, type SayimFarkiDurumu } from "../eylemler";

/**
 * Eksik çıkan cihazları kayıp olarak işler. Onay kutusu olmadan düğme
 * etkinleşmez: işlem cihazları stok değerinden düşürür.
 */
export function SayimFarkiFormu({ sayimId, eksikAdedi }: { sayimId: number; eksikAdedi: number }) {
  const [durum, eylem] = useActionState<SayimFarkiDurumu, FormData>(sayimFarkiniIsle, {});
  const [onay, setOnay] = useState(false);

  return (
    <form action={eylem} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <input type="hidden" name="sayimId" value={sayimId} />
      <p className="text-sm text-amber-900">
        Sayımda <strong>{eksikAdedi} cihaz</strong> bulunamadı. Kayıp olarak işlenene kadar stok
        adedinde ve stok değerinde görünmeye devam ederler.
      </p>
      <label className="mt-2 flex flex-wrap items-center gap-2 text-xs text-amber-900">
        <input
          type="checkbox"
          checked={onay}
          onChange={(e) => setOnay(e.target.checked)}
          className="h-4 w-4"
        />
        Eksik cihazları kayıp olarak işle (sonradan bulunursa &quot;Satışa aç&quot; ile döner)
      </label>
      <div className="mt-2">
        <GonderDugmesi tur="tehlike" bekleyenMetin="İşleniyor…" disabled={!onay}>
          Sayım farkını işle
        </GonderDugmesi>
      </div>
      {durum.hata ? (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {durum.hata}
        </p>
      ) : null}
      {durum.basari ? (
        <p role="status" className="mt-2 text-sm font-medium text-emerald-800">
          {durum.basari}
        </p>
      ) : null}
    </form>
  );
}
