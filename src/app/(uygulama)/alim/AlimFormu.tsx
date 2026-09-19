"use client";

import { useActionState, useMemo, useState } from "react";
import { GIRDI_SINIFI } from "@/bilesenler/Alan";
import { GonderDugmesi } from "@/bilesenler/Dugme";
import { kurusuTLYaz, tlyiKurusaCevir } from "@/lib/para";
import { ODEME_TIPI, ODEME_TIPI_ETIKET, type OdemeTipi } from "@/lib/sabitler";
import { musteriAra, type MusteriOzeti } from "../satis/eylemler";
import { ikinciElAl, type AlimDurumu } from "./eylemler";

const KUCUK_ETIKET = "mb-1 block text-xs font-medium text-slate-600";

export type KategoriSecenegi = {
  id: number;
  ad: string;
  seriNoZorunlu: boolean;
  altKategoriler: { id: number; ad: string }[];
};

export type MagazaSecenegi = { id: number; ad: string };

export function AlimFormu({
  kategoriler,
  magazalar,
  varsayilanMagazaId,
  bugun,
}: {
  kategoriler: KategoriSecenegi[];
  magazalar: MagazaSecenegi[];
  varsayilanMagazaId: number | null;
  bugun: string;
}) {
  const [durum, eylem] = useActionState<AlimDurumu, FormData>(ikinciElAl, {});

  const [magazaId, setMagazaId] = useState(varsayilanMagazaId ?? magazalar[0]?.id ?? 0);
  const [kategoriId, setKategoriId] = useState(kategoriler[0]?.id ?? 0);
  const [altKategoriId, setAltKategoriId] = useState<number | null>(null);
  const [marka, setMarka] = useState("");
  const [model, setModel] = useState("");
  const [renk, setRenk] = useState("");
  const [kapasite, setKapasite] = useState("");
  const [seriNo, setSeriNo] = useState("");
  const [barkod, setBarkod] = useState("");
  const [fiyat, setFiyat] = useState("");
  const [odemeTipi, setOdemeTipi] = useState<OdemeTipi>(ODEME_TIPI.NAKIT);
  const [alimTarihi, setAlimTarihi] = useState(bugun);
  const [not, setNot] = useState("");

  const [musteriSorgu, setMusteriSorgu] = useState("");
  const [sonuclar, setSonuclar] = useState<MusteriOzeti[]>([]);
  const [araniyor, setAraniyor] = useState(false);
  const [seciliMusteri, setSeciliMusteri] = useState<MusteriOzeti | null>(null);
  const [yeniAd, setYeniAd] = useState("");
  const [yeniTelefon, setYeniTelefon] = useState("");
  const [yeniTckn, setYeniTckn] = useState("");
  const [yeniAdres, setYeniAdres] = useState("");

  const kategori = useMemo(
    () => kategoriler.find((k) => k.id === kategoriId),
    [kategoriler, kategoriId],
  );
  const fiyatKurus = tlyiKurusaCevir(fiyat);

  const kaydedebilir =
    magazaId > 0 &&
    kategoriId > 0 &&
    marka.trim().length > 0 &&
    model.trim().length > 0 &&
    fiyatKurus !== null &&
    fiyatKurus > 0 &&
    (!kategori?.seriNoZorunlu || seriNo.trim().length > 0) &&
    (seciliMusteri !== null || yeniAd.trim().length > 0);

  async function musteriAramayiCalistir() {
    setAraniyor(true);
    try {
      setSonuclar(await musteriAra(musteriSorgu));
    } finally {
      setAraniyor(false);
    }
  }

  const veri = JSON.stringify({
    magazaId,
    kategoriId,
    altKategoriId,
    marka: marka.trim(),
    model: model.trim(),
    renk: renk.trim() || null,
    kapasite: kapasite.trim() || null,
    seriNo: seriNo.trim() || null,
    barkod: barkod.trim() || null,
    alisFiyatiKurus: fiyatKurus ?? 0,
    odemeTipi,
    alimTarihi,
    musteriId: seciliMusteri?.id ?? null,
    musteriAdSoyad: seciliMusteri ? null : yeniAd.trim() || null,
    musteriTelefon: seciliMusteri ? null : yeniTelefon.trim() || null,
    musteriTcknVkn: seciliMusteri ? null : yeniTckn.trim() || null,
    musteriAdres: seciliMusteri ? null : yeniAdres.trim() || null,
    not: not.trim() || null,
  });

  return (
    <form action={eylem} className="space-y-4">
      <input type="hidden" name="veri" value={veri} />

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Cihaz</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="magazaId" className={KUCUK_ETIKET}>
              Depo
            </label>
            <select
              id="magazaId"
              value={magazaId}
              onChange={(e) => setMagazaId(Number(e.target.value))}
              className={GIRDI_SINIFI}
            >
              {magazalar.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.ad}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="kategoriId" className={KUCUK_ETIKET}>
              Kategori
            </label>
            <select
              id="kategoriId"
              value={kategoriId}
              onChange={(e) => {
                setKategoriId(Number(e.target.value));
                setAltKategoriId(null);
              }}
              className={GIRDI_SINIFI}
            >
              {kategoriler.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.ad}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="altKategoriId" className={KUCUK_ETIKET}>
              Alt kategori
            </label>
            <select
              id="altKategoriId"
              value={altKategoriId ?? ""}
              onChange={(e) => setAltKategoriId(e.target.value ? Number(e.target.value) : null)}
              className={GIRDI_SINIFI}
            >
              <option value="">Seçin…</option>
              {(kategori?.altKategoriler ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.ad}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="seriNo" className={KUCUK_ETIKET}>
              Seri No / IMEI{kategori?.seriNoZorunlu ? " *" : ""}
            </label>
            <input
              id="seriNo"
              value={seriNo}
              onChange={(e) => setSeriNo(e.target.value)}
              maxLength={40}
              className={GIRDI_SINIFI}
            />
          </div>

          <div>
            <label htmlFor="marka" className={KUCUK_ETIKET}>
              Marka *
            </label>
            <input
              id="marka"
              value={marka}
              onChange={(e) => setMarka(e.target.value)}
              maxLength={60}
              className={GIRDI_SINIFI}
            />
          </div>

          <div>
            <label htmlFor="model" className={KUCUK_ETIKET}>
              Model *
            </label>
            <input
              id="model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              maxLength={80}
              className={GIRDI_SINIFI}
            />
          </div>

          <div>
            <label htmlFor="renk" className={KUCUK_ETIKET}>
              Renk
            </label>
            <input
              id="renk"
              value={renk}
              onChange={(e) => setRenk(e.target.value)}
              maxLength={40}
              className={GIRDI_SINIFI}
            />
          </div>

          <div>
            <label htmlFor="kapasite" className={KUCUK_ETIKET}>
              Kapasite
            </label>
            <input
              id="kapasite"
              value={kapasite}
              onChange={(e) => setKapasite(e.target.value)}
              maxLength={40}
              className={GIRDI_SINIFI}
            />
          </div>

          <div>
            <label htmlFor="barkod" className={KUCUK_ETIKET}>
              Barkod
            </label>
            <input
              id="barkod"
              value={barkod}
              onChange={(e) => setBarkod(e.target.value)}
              maxLength={40}
              className={GIRDI_SINIFI}
            />
          </div>

          <div>
            <label htmlFor="alisFiyati" className={KUCUK_ETIKET}>
              Ödenen tutar (TL) *
            </label>
            <input
              id="alisFiyati"
              inputMode="decimal"
              value={fiyat}
              onChange={(e) => setFiyat(e.target.value)}
              placeholder="0,00"
              className={GIRDI_SINIFI}
            />
          </div>

          <div>
            <label htmlFor="odemeTipi" className={KUCUK_ETIKET}>
              Ödeme tipi
            </label>
            <select
              id="odemeTipi"
              value={odemeTipi}
              onChange={(e) => setOdemeTipi(e.target.value as OdemeTipi)}
              className={GIRDI_SINIFI}
            >
              {Object.values(ODEME_TIPI).map((o) => (
                <option key={o} value={o}>
                  {ODEME_TIPI_ETIKET[o]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="alimTarihi" className={KUCUK_ETIKET}>
              Alım tarihi
            </label>
            <input
              id="alimTarihi"
              type="date"
              value={alimTarihi}
              onChange={(e) => setAlimTarihi(e.target.value)}
              max={bugun}
              className={GIRDI_SINIFI}
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-4">
            <label htmlFor="alimNotu" className={KUCUK_ETIKET}>
              Not (cihazın durumu, eksikler)
            </label>
            <input
              id="alimNotu"
              value={not}
              onChange={(e) => setNot(e.target.value)}
              maxLength={300}
              className={GIRDI_SINIFI}
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Satıcı</h2>

        <div className="mb-3">
          <label htmlFor="musteriSorgu" className={KUCUK_ETIKET}>
            Kayıtlı kişi ara (ad veya telefon)
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="musteriSorgu"
              value={musteriSorgu}
              onChange={(e) => setMusteriSorgu(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  musteriAramayiCalistir();
                }
              }}
              placeholder="En az 2 karakter"
              className={`min-w-0 flex-1 ${GIRDI_SINIFI}`}
            />
            <button
              type="button"
              onClick={musteriAramayiCalistir}
              className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {araniyor ? "Aranıyor…" : "Ara"}
            </button>
          </div>

          {sonuclar.length > 0 ? (
            <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
              {sonuclar.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSeciliMusteri(m);
                      setSonuclar([]);
                      setMusteriSorgu("");
                    }}
                    className="w-full px-3 py-2 text-left text-sm transition hover:bg-blue-50"
                  >
                    <span className="font-medium text-slate-800">{m.adSoyad}</span>
                    {m.telefon ? <span className="ml-2 text-slate-500">{m.telefon}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {seciliMusteri ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
            <div className="text-sm">
              <span className="font-medium text-emerald-900">{seciliMusteri.adSoyad}</span>
              {seciliMusteri.telefon ? (
                <span className="ml-2 text-emerald-800">{seciliMusteri.telefon}</span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setSeciliMusteri(null)}
              className="text-xs font-medium text-emerald-800 hover:underline"
            >
              Değiştir
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="yeniAd" className={KUCUK_ETIKET}>
                Ad Soyad *
              </label>
              <input
                id="yeniAd"
                value={yeniAd}
                onChange={(e) => setYeniAd(e.target.value)}
                maxLength={80}
                className={GIRDI_SINIFI}
              />
            </div>
            <div>
              <label htmlFor="yeniTelefon" className={KUCUK_ETIKET}>
                Telefon
              </label>
              <input
                id="yeniTelefon"
                value={yeniTelefon}
                onChange={(e) => setYeniTelefon(e.target.value)}
                maxLength={30}
                className={GIRDI_SINIFI}
              />
            </div>
            <div>
              <label htmlFor="yeniTckn" className={KUCUK_ETIKET}>
                TCKN / VKN
              </label>
              <input
                id="yeniTckn"
                value={yeniTckn}
                onChange={(e) => setYeniTckn(e.target.value)}
                maxLength={20}
                className={GIRDI_SINIFI}
              />
            </div>
            <div>
              <label htmlFor="yeniAdres" className={KUCUK_ETIKET}>
                Adres
              </label>
              <input
                id="yeniAdres"
                value={yeniAdres}
                onChange={(e) => setYeniAdres(e.target.value)}
                maxLength={200}
                className={GIRDI_SINIFI}
              />
            </div>
            <p className="text-xs text-slate-500 sm:col-span-2 lg:col-span-4">
              İkinci el alımda satıcının kimliği kayda geçer. Aynı telefonla kayıtlı kişi varsa
              yeniden oluşturulmaz.
            </p>
          </div>
        )}
      </section>

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg">
        <div className="text-sm text-slate-600">
          {fiyatKurus !== null && fiyatKurus > 0 ? (
            <>
              Ödenecek:{" "}
              <span className="font-semibold text-slate-900">{kurusuTLYaz(fiyatKurus)} TL</span>
            </>
          ) : (
            "Ödenen tutarı girin"
          )}
        </div>
        <GonderDugmesi tur="basari" bekleyenMetin="Kaydediliyor…" disabled={!kaydedebilir}>
          Alımı Kaydet
        </GonderDugmesi>
      </div>

      {durum.hata ? (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {durum.hata}
        </p>
      ) : null}
    </form>
  );
}
