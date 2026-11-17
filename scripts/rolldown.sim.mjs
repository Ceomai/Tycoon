// Simülasyonu Node için tek dosyaya derler (npm run sim)
export default {
  input: 'scripts/sim.ts',
  platform: 'node',
  output: { file: '.simcache/tapu-sim.mjs', format: 'esm' },
  transform: { define: { 'import.meta.env': '{}', __PREVIEW__: 'true' } },
};
