// Simülasyonu Node için tek dosyaya derler (npm run sim)
export default {
  input: 'scripts/sim.ts',
  platform: 'node',
  output: { file: 'node_modules/.cache/tapu-sim.mjs', format: 'esm' },
  transform: { define: { 'import.meta.env': '{}', __PREVIEW__: 'true' } },
};
