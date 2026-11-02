// i18n anahtarlarını toplar: src altındaki t('…') ve tk('…') tek tırnaklı metinler + şehir/semt adları.
// Kullanım: node scripts/i18n-extract.mjs            → scripts/i18n-keys.json yazar, eksik çevirileri listeler
//           node scripts/i18n-extract.mjs --check    → eksik çeviri varsa çıkış kodu 1 (CI/test için)
import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const files = []; (function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) { if (f !== 'locales') walk(p); } else if (/\.ts$/.test(f)) files.push(p); } })(path.join(root, 'src'));
const re = /\bt[k]?\(\s*'((?:[^'\\]|\\.)*)'/g;
const keys = new Map();
for (const f of files) { const s = fs.readFileSync(f, 'utf8'); let m; while ((m = re.exec(s))) { const k = m[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\'); if (!keys.has(k)) keys.set(k, path.relative(root, f)); } }
// özel adlar: config.ts › CITIES (n ve semt n)
const cfg = fs.readFileSync(path.join(root, 'src/config.ts'), 'utf8');
const names = new Set(); for (const m of cfg.matchAll(/\bn: '([^']+)'/g)) names.add(m[1]);
const out = { keys: [...keys.keys()].sort(), from: Object.fromEntries(keys), names: [...names].sort() };
fs.writeFileSync(path.join(root, 'scripts/i18n-keys.json'), JSON.stringify(out, null, 1));
// eksik çeviriler
let missing = 0;
for (const l of ['en', 'de', 'ja']) {
  const src = fs.readFileSync(path.join(root, `src/locales/${l}.ts`), 'utf8');
  const has = new Set(); for (const m of src.matchAll(/^\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")\s*:/gm)) has.add(eval(m[1]));
  const miss = out.keys.filter(k => !has.has(k));
  missing += miss.length; console.log(`${l}: ${out.keys.length - miss.length}/${out.keys.length} çevrili${miss.length ? ' · eksik ' + miss.length : ''}`);
  if (miss.length && process.argv.includes('-v')) console.log('  ' + miss.slice(0, 30).join('\n  '));
}
console.log(`anahtar: ${out.keys.length} · özel ad: ${out.names.length}`);
if (process.argv.includes('--check') && missing) process.exit(1);
