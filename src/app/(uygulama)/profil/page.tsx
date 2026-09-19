import { Kart } from "@/bilesenler/Kart";
import { prisma } from "@/lib/prisma";
import { ROL_ETIKET } from "@/lib/sabitler";
import { tarihSaatYaz } from "@/lib/tarih";
import { oturumGerekli } from "@/lib/yetki";
import { SifreFormu } from "./SifreFormu";

export const metadata = { title: "Hesabım — Stok Takip" };

export default async function ProfilSayfasi() {
  const oturum = await oturumGerekli();

  const kullanici = await prisma.kullanici.findUniqueOrThrow({
    where: { id: oturum.kullaniciId },
    select: { kullaniciAdi: true, adSoyad: true, sonGiris: true },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Hesabım</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Şifrenizi buradan değiştirebilirsiniz. Ad, rol ve mağaza bilgisini yalnız yönetici
          düzenler.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Kart baslik="Bilgiler">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Ad Soyad</dt>
              <dd className="font-medium text-slate-800">{kullanici.adSoyad}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Kullanıcı adı</dt>
              <dd className="font-medium text-slate-800">{kullanici.kullaniciAdi}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Rol</dt>
              <dd className="font-medium text-slate-800">{ROL_ETIKET[oturum.rol]}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Mağaza</dt>
              <dd className="font-medium text-slate-800">{oturum.magazaAdi ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Son giriş</dt>
              <dd className="font-medium text-slate-800">
                {tarihSaatYaz(kullanici.sonGiris) || "—"}
              </dd>
            </div>
          </dl>
        </Kart>

        <Kart baslik="Şifre Değiştir">
          <SifreFormu />
        </Kart>
      </div>
    </div>
  );
}
