import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // @grid-up/shared bir workspace/symlink paketi oldugu icin Vite onu
    // varsayilan olarak pre-bundle etmez; bu da CommonJS `export *`
    // re-export'larinin (RiskLevel, SensorType, ...) tarayicida named
    // export olarak gorunmemesine yol acar. Explicit include ile esbuild
    // bu paketi tam olarak bundle'lar ve interop dogru calisir.
    include: ['@grid-up/shared'],
  },
})
