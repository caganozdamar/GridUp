import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Tum dosyalar TEK gercek veritabanini paylasir ve bazi testler global
    // sayaclari (ornegin /metrics/operations) dogrudan DB sayimiyla karsilastirir.
    // Dosyalar paralel calisirsa baska bir dosyanin yazdigi satirlar bu
    // karsilastirmalari (ve /notifications listesini) rastgele bozar; bu yuzden
    // dosyalar sirayla calistirilir.
    fileParallelism: false,
    // Susan modul zamanlayicisi testlerde kapali: gercek demo panolarinda alarm
    // acmasin. Testler ModuleHealthService.checkOnce'i dogrudan cagirir.
    env: { MODULE_OFFLINE_CHECK_INTERVAL_MS: '0' },
  },
});
