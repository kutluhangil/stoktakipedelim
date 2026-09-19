"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Alan, GIRDI_SINIFI } from "@/bilesenler/Alan";
import { GonderDugmesi } from "@/bilesenler/Dugme";
import { kurusuTLYaz, tlyiKurusaCevir } from "@/lib/para";
import { cihazDuzenle, type CihazDuzenlemeDurumu } from "../../eylemler";

export type KategoriSecimi = {
  id: number;
  ad: string;
  seriNoZorunlu: boolean;
  altKategoriler: { id: number; ad: string }[];
};

export type DuzenlenenCihaz = {
  id: number;
  kategoriId: number;
  altKategoriId: number | null;
  marka: string;
  model: string;
  renk: string | null;
  kapasite: string | null;
  seriNo: string | null;
  barkod: string | null;
  alisFiyatiKurus: number;
  not: string | null;
};

export function CihazDuzenlemeFormu({
  cihaz,
  kategoriler,
}: {
  cihaz: DuzenlenenCihaz;
  kategoriler: KategoriSecimi[];
}) {
  const [durum, eylem] = useActionState<CihazDuzenlemeDurumu, FormData>(cihazDuzenle, {});

  const [kategoriId, setKategoriId] = useState(String(cihaz.kategoriId));
  const [altKategoriId, setAltKategoriId] = useState(
    cihaz.altKategoriId ? String(cihaz.altKategoriId) : "",
  );

  const secilenKategori = kategoriler.find((k) => String(k.id) === kategoriId);
  const seriNoGerekli = secilenKategori?.seriNoZorunlu ?? false;

  function veriyiHazirla(form: FormData): FormData {
    const yuk = {
      cihazId: cihaz.id,
      kategoriId: Number(form.get("kategoriId")) || 0,
      altKategoriId: Number(form.get("altKategoriId")) || null,
      marka: String(form.get("marka") ?? ""),
      model: String(form.get("model") ?? ""),
      renk: String(form.get("renk") ?? "").trim() || null,
      kapasite: String(form.get("kapasite") ?? "").trim() || null,
      seriNo: String(form.get("seriNo") ?? "").trim() || null,
      barkod: String(form.get("barkod") ?? "").trim() || null,
      alisFiyatiKurus: tlyiKurusaCevir(String(form.get("alisFiyati") ?? "")) ?? 0,
      not: String(form.get("not") ?? "").trim() || null,
    };

    const yeni = new FormData();
    yeni.set("veri", JSON.stringify(yuk));
    return yeni;
  }

  return (
    <form action={(form) => eylem(veriyiHazirla(form))} className="space-y-5">
      {durum.hata ? (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-medium text-red-800">{durum.hata}</p>
          {durum.alanHatalari?.length ? (
            <ul className="mt-2 list-inside list-disc space-y-0.5 text-sm text-red-700">
              {durum.alanHatalari.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Alan etiket="Kategori" htmlFor="kategoriId" gerekli>
            <select
              id="kategoriId"
              name="kategoriId"
              value={kategoriId}
              onChange={(e) => {
                setKategoriId(e.target.value);
                // Alt kategori önceki kategoriye aitti; seçim sıfırlanır.
                setAltKategoriId("");
              }}
              className={GIRDI_SINIFI}
            >
              {kategoriler.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.ad}
                </option>
              ))}
            </select>
          </Alan>

          <Alan etiket="Alt kategori" htmlFor="altKategoriId">
            <select
              id="altKategoriId"
              name="altKategoriId"
              value={altKategoriId}
              onChange={(e) => setAltKategoriId(e.target.value)}
              className={GIRDI_SINIFI}
            >
              <option value="">—</option>
              {secilenKategori?.altKategoriler.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.ad}
                </option>
              ))}
            </select>
          </Alan>

          <Alan
            etiket="Alış fiyatı (TL)"
            htmlFor="alisFiyati"
            ipucu="Kâr hesabı bu tutara göre yapılır."
          >
            <input
              id="alisFiyati"
              name="alisFiyati"
              defaultValue={kurusuTLYaz(cihaz.alisFiyatiKurus)}
              inputMode="decimal"
              className={GIRDI_SINIFI}
            />
          </Alan>

          <Alan etiket="Marka" htmlFor="marka" gerekli>
            <input id="marka" name="marka" defaultValue={cihaz.marka} className={GIRDI_SINIFI} />
          </Alan>

          <Alan etiket="Model" htmlFor="model" gerekli>
            <input id="model" name="model" defaultValue={cihaz.model} className={GIRDI_SINIFI} />
          </Alan>

          <Alan etiket="Renk" htmlFor="renk">
            <input
              id="renk"
              name="renk"
              defaultValue={cihaz.renk ?? ""}
              className={GIRDI_SINIFI}
            />
          </Alan>

          <Alan etiket="Kapasite" htmlFor="kapasite">
            <input
              id="kapasite"
              name="kapasite"
              defaultValue={cihaz.kapasite ?? ""}
              className={GIRDI_SINIFI}
            />
          </Alan>

          <Alan
            etiket="Seri no / IMEI"
            htmlFor="seriNo"
            gerekli={seriNoGerekli}
            ipucu={
              seriNoGerekli
                ? "Bu kategoride zorunlu; sistemde tekil olmalı."
                : "Bu kategoride opsiyonel."
            }
          >
            <input
              id="seriNo"
              name="seriNo"
              defaultValue={cihaz.seriNo ?? ""}
              className={GIRDI_SINIFI}
            />
          </Alan>

          <Alan etiket="Barkod" htmlFor="barkod">
            <input
              id="barkod"
              name="barkod"
              defaultValue={cihaz.barkod ?? ""}
              className={GIRDI_SINIFI}
            />
          </Alan>
        </div>

        <Alan etiket="Not" htmlFor="not" className="mt-4">
          <textarea
            id="not"
            name="not"
            rows={2}
            defaultValue={cihaz.not ?? ""}
            className={GIRDI_SINIFI}
          />
        </Alan>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <GonderDugmesi bekleyenMetin="Kaydediliyor…">Değişiklikleri kaydet</GonderDugmesi>
        <Link
          href={`/cihazlar/${cihaz.id}`}
          className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Vazgeç
        </Link>
      </div>
    </form>
  );
}
