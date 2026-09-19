"use client";

import { useActionState } from "react";
import { GIRDI_SINIFI } from "@/bilesenler/Alan";
import { GonderDugmesi } from "@/bilesenler/Dugme";
import { kendiSifreniDegistir, type SifreDurumu } from "./eylemler";

const ALANLAR = [
  { ad: "mevcutSifre", etiket: "Mevcut şifre", otomatik: "current-password" },
  { ad: "yeniSifre", etiket: "Yeni şifre", otomatik: "new-password" },
  { ad: "yeniSifreTekrar", etiket: "Yeni şifre (tekrar)", otomatik: "new-password" },
] as const;

export function SifreFormu() {
  const [durum, eylem] = useActionState<SifreDurumu, FormData>(kendiSifreniDegistir, {});

  return (
    <form action={eylem} className="max-w-sm space-y-3">
      {ALANLAR.map((alan) => (
        <div key={alan.ad}>
          <label htmlFor={alan.ad} className="mb-1.5 block text-sm font-medium text-slate-700">
            {alan.etiket}
          </label>
          <input
            id={alan.ad}
            name={alan.ad}
            type="password"
            autoComplete={alan.otomatik}
            required
            className={GIRDI_SINIFI}
          />
        </div>
      ))}

      <p className="text-xs text-slate-500">
        Yeni şifre en az 8 karakter olmalı. Değişiklikten sonra diğer cihazlardaki oturumlar
        kapanır.
      </p>

      <GonderDugmesi bekleyenMetin="Değiştiriliyor…">Şifreyi değiştir</GonderDugmesi>

      {durum.hata ? (
        <p role="alert" className="text-sm text-red-600">
          {durum.hata}
        </p>
      ) : null}
      {durum.basari ? (
        <p role="status" className="text-sm font-medium text-emerald-700">
          {durum.basari}
        </p>
      ) : null}
    </form>
  );
}
