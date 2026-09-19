import { NextResponse, type NextRequest } from "next/server";
import { logYaz } from "@/lib/log";
import { OTURUM_CEREZI, oturumuOku } from "@/lib/oturum";
import { LOG_ISLEM } from "@/lib/sabitler";

/**
 * Oturum çerezini siler ve giriş ekranına yollar.
 *
 * Geçersizleşmiş jetonun (pasife alınan hesap, iptal edilen oturum) tek çıkış
 * yolu: sayfa render'ı sırasında çerez silinemediği için yönlendirme buraya
 * yapılır, çerezi Route Handler temizler.
 */
export async function GET(istek: NextRequest) {
  const oturum = await oturumuOku();
  if (oturum) {
    await logYaz(oturum, { islem: LOG_ISLEM.CIKIS_YAP });
  }

  const hedef = new URL("/giris", istek.url);
  const yanit = NextResponse.redirect(hedef);
  yanit.cookies.delete(OTURUM_CEREZI);
  return yanit;
}
