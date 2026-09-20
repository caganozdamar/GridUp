// Alarm yasam dongusu politikasi. Ortam degiskenleri her cagrida okunur ki
// testler degeri degistirebilsin (bkz. notifications.config.ts ile ayni desen).

function nonNegativeInt(raw: string | undefined, fallback: number): number {
  const value = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function alarmPolicy() {
  return {
    // Risk normale dondukten sonra alarmin cozulmesi icin arka arkaya kac
    // analizin normal cikmasi gerektigi (2 sn'lik tick'te 5 tick ~ 10 sn).
    // Esik civarinda gidip gelen bir skor alarmi acip kapatmaz.
    resolveAfterTicks: Math.max(1, nonNegativeInt(process.env.ALARM_RESOLVE_AFTER_TICKS, 5)),

    // Panonun HICBIR sensorunden bu kadar suredir (ms) veri gelmediyse
    // MODULE_OFFLINE alarmi acilir. Veri sagligi rozetindeki 10 sn'lik "stale"
    // esiginden bilerek daha uzundur: kisa bir ag kesintisi alarm uretmesin.
    moduleOfflineAfterMs: nonNegativeInt(process.env.MODULE_OFFLINE_AFTER_MS, 60_000),

    // Susan modul kontrolunun calisma araligi (ms). 0 = kontrol kapali.
    moduleOfflineCheckIntervalMs: nonNegativeInt(process.env.MODULE_OFFLINE_CHECK_INTERVAL_MS, 15_000),
  };
}
