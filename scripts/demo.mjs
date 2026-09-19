// AŞAMA 8: `npm run demo:normal` / `npm run demo:critical` için yardımcı script.
//
// Bu script apps/simulator/.env dosyasını DEĞİŞTİRMEZ; sadece bu process'e
// özel SIMULATION_SCENARIO / TARGET_PANEL_CODE ortam değişkenlerini geçici
// olarak set edip `npm run dev:simulator`'ı bu ortamla başlatır. dotenv
// (apps/simulator/src/index.ts -> 'dotenv/config') zaten mevcut olan process
// ortam değişkenlerinin üzerine yazmaz (default davranış), bu yüzden burada
// verilen değerler .env dosyasındakileri geçici olarak ezer.
//
// Windows/macOS/Linux'ta aynı şekilde çalışır (cross-env gibi ek bir
// dependency gerektirmez; process.env üzerinden Node'un kendi child_process
// API'si kullanılır).
//
// Kullanım:
//   node scripts/demo.mjs NORMAL
//   node scripts/demo.mjs COMBINED_FAILURE PANO-003

import { spawn } from 'node:child_process';

const [, , scenario, targetPanelCode] = process.argv;

if (!scenario) {
  console.error('Usage: node scripts/demo.mjs <SCENARIO> [TARGET_PANEL_CODE]');
  process.exit(1);
}

const env = { ...process.env, SIMULATION_SCENARIO: scenario };
if (targetPanelCode) {
  env.TARGET_PANEL_CODE = targetPanelCode;
}

console.log(
  `[demo] Starting simulator with SIMULATION_SCENARIO=${scenario}` +
    (targetPanelCode ? ` TARGET_PANEL_CODE=${targetPanelCode}` : ' (all panels)'),
);
console.log('[demo] apps/simulator/.env is not modified; this only overrides the environment for this run.');
console.log('[demo] Press Ctrl+C to stop.\n');

// Not: Windows'ta `npm` gercekte bir .cmd dosyasidir; dogrudan spawn edilemez,
// bu yuzden shell:true kullanilir (args sabit/literal oldugu icin guvenlidir).
const child = spawn('npm', ['run', 'dev:simulator'], {
  stdio: 'inherit',
  env,
  shell: true,
});

child.on('exit', (code) => process.exit(code ?? 0));
