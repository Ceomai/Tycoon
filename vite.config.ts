import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// "app"   : Capacitor için www/ (parçalı, Firebase dahil)
// "preview": artifact/paylaşım önizlemesi için tek dosya (Firebase hariç, reklam ve satın alma simülasyonlu)
export default defineConfig(({ mode }) => {
  const preview = mode === 'preview';
  return {
    base: './',
    define: { __PREVIEW__: JSON.stringify(preview) },
    plugins: preview ? [viteSingleFile()] : [],
    build: {
      outDir: preview ? 'dist-preview' : 'www',
      emptyOutDir: true,
      target: 'es2020',
      assetsInlineLimit: preview ? 100_000_000 : 4096,
      chunkSizeWarningLimit: 800, // ana paket ~710 kB (ihale: 74 yapı çizimi, 15 rakip portresi, 4 dil)
    },
    test: { include: ['tests/unit/**/*.test.ts'], environment: 'node' },
  };
});
