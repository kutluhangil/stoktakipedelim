import { IADE_SONUCLARI, type IadeSonucu } from "./sabitler";
import { gunBasi, gunSonu } from "./tarih";

/**
 * İade kuralları — saf karar fonksiyonları.
 *
 * Bu dosya bilerek "server-only" değildir: Server Action bunları çağırır ama
 * kurallar veritabanından bağımsız test edilebilir olmalıdır.
 */

export function iadeSonucuMu(deger: unknown): deger is IadeSonucu {
  return typeof deger === "string" && (IADE_SONUCLARI as readonly string[]).includes(deger);
}

export type IadeTarihiGirdisi = {
  satisTarihi: Date;
  iadeTarihi: Date;
  bugun: Date;
};

/**
 * İade tarihi satıştan önce olamaz ve geleceğe yazılamaz.
 *
 * Satıştan önceki bir iade tarihi ciro raporunu tutarsız yapar; ileri tarihli
 * iade ise henüz olmamış bir olayı kaydeder. Karşılaştırma gün bazındadır:
 * aynı gün içinde satılıp iade edilen cihaz (saat farkına bakılmaksızın) geçerli.
 */
export function iadeTarihiHatasi({
  satisTarihi,
  iadeTarihi,
  bugun,
}: IadeTarihiGirdisi): string | null {
  if (Number.isNaN(iadeTarihi.getTime())) return "İade tarihi geçersiz.";
  if (iadeTarihi < gunBasi(satisTarihi)) return "İade tarihi satış tarihinden önce olamaz.";
  if (iadeTarihi > gunSonu(bugun)) return "İade tarihi ileri tarihli olamaz.";
  return null;
}
