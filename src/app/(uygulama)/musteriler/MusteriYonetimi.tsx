"use client";

import { useActionState, useState } from "react";
import { GIRDI_SINIFI } from "@/bilesenler/Alan";
import { GonderDugmesi } from "@/bilesenler/Dugme";
import { musteriDuzenle, musteriSil, type MusteriDurumu } from "./eylemler";

export type MusteriKunyesi = {
  id: number;
  adSoyad: string;
  telefon: string | null;
  tcknVkn: string | null;
  adres: string | null;
  not: string | null;
};

const KUCUK_ETIKET = "mb-1 block text-xs font-medium text-slate-600";

function Sonuc({ durum }: { durum: MusteriDurumu }) {
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

function DuzenlemeFormu({ musteri }: { musteri: MusteriKunyesi }) {
  const [durum, eylem] = useActionState<MusteriDurumu, FormData>(musteriDuzenle, {});
  const alanlar = [
    { ad: "adSoyad", etiket: "Ad Soyad", deger: musteri.adSoyad, uzunluk: 80 },
    { ad: "telefon", etiket: "Telefon", deger: musteri.telefon ?? "", uzunluk: 30 },
    { ad: "tcknVkn", etiket: "TCKN / VKN", deger: musteri.tcknVkn ?? "", uzunluk: 20 },
    { ad: "adres", etiket: "Adres", deger: musteri.adres ?? "", uzunluk: 200 },
    { ad: "not", etiket: "Not", deger: musteri.not ?? "", uzunluk: 300 },
  ];

  return (
    <form action={eylem}>
      <input type="hidden" name="id" value={musteri.id} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {alanlar.map((a) => (
          <div key={a.ad}>
            <label htmlFor={`${a.ad}-${musteri.id}`} className={KUCUK_ETIKET}>
              {a.etiket}
            </label>
            <input
              id={`${a.ad}-${musteri.id}`}
              name={a.ad}
              defaultValue={a.deger}
              maxLength={a.uzunluk}
              className={GIRDI_SINIFI}
            />
          </div>
        ))}
      </div>
      <div className="mt-2">
        <GonderDugmesi tur="ikincil" bekleyenMetin="Kaydediliyor…">
          Kaydet
        </GonderDugmesi>
      </div>
      <Sonuc durum={durum} />
    </form>
  );
}

/**
 * KVKK silme iki adımlıdır: onay kutusu işaretlenmeden düğme etkinleşmez.
 * İşlem geri alınamaz — bağlı satışı olan kayıt anonimleştirilir, olmayan silinir.
 */
function SilmeFormu({ musteri, islemSayisi }: { musteri: MusteriKunyesi; islemSayisi: number }) {
  const [durum, eylem] = useActionState<MusteriDurumu, FormData>(musteriSil, {});
  const [onay, setOnay] = useState(false);

  return (
    <form action={eylem} className="mt-3 border-t border-slate-100 pt-3">
      <input type="hidden" name="id" value={musteri.id} />
      <label className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
        <input
          type="checkbox"
          checked={onay}
          onChange={(e) => setOnay(e.target.checked)}
          className="h-4 w-4"
        />
        {islemSayisi > 0
          ? `Kimlik bilgilerini sil (${islemSayisi} işlem kaydı korunur, geri alınamaz)`
          : "Kaydı tamamen sil (geri alınamaz)"}
      </label>
      <div className="mt-2">
        <GonderDugmesi tur="tehlike" bekleyenMetin="Siliniyor…" disabled={!onay}>
          {islemSayisi > 0 ? "Kimlik bilgilerini sil" : "Kaydı sil"}
        </GonderDugmesi>
      </div>
      <Sonuc durum={durum} />
    </form>
  );
}

export function MusteriYonetimi({
  musteri,
  islemSayisi,
  silebilir,
}: {
  musteri: MusteriKunyesi;
  islemSayisi: number;
  silebilir: boolean;
}) {
  const [acik, setAcik] = useState(false);

  if (!acik) {
    return (
      <button
        type="button"
        onClick={() => setAcik(true)}
        className="mt-2 rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
      >
        Kaydı düzenle
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-700">Kayıt yönetimi</span>
        <button
          type="button"
          onClick={() => setAcik(false)}
          className="text-xs font-medium text-slate-500 hover:underline"
        >
          Kapat
        </button>
      </div>
      <DuzenlemeFormu musteri={musteri} />
      {silebilir ? <SilmeFormu musteri={musteri} islemSayisi={islemSayisi} /> : null}
    </div>
  );
}
