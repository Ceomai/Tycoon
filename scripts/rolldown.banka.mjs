// Banka simülasyonunu Node için tek dosyaya derler (npm run sim:banka); çıktı depo içinde .simcache/ (node_modules dışı)
export default { input: 'scripts/banka.sim.ts', platform: 'node', output: { file: '.simcache/banka-sim.mjs', format: 'esm' }, transform: { define: { 'import.meta.env': '{}', __PREVIEW__: 'true' } } };
