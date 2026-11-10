// Çeviri JSON'larından (scripts/i18n/{en,de,ja}.json: { "Türkçe anahtar": "çeviri" }) ve scripts/names.json'dan
// src/locales/{en,de,ja}.ts dosyalarını üretir. Kullanım: node scripts/i18n-build.mjs
import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const names = JSON.parse(fs.readFileSync(path.join(root, 'scripts/names.json'), 'utf8'));
const keys = JSON.parse(fs.readFileSync(path.join(root, 'scripts/i18n-keys.json'), 'utf8')).keys;
const q = s => JSON.stringify(s);
for (const l of ['en', 'de', 'ja']) {
  const f = path.join(root, `scripts/i18n/${l}.json`);
  const ex = path.join(root, 'scripts/i18n/extra.json');
  const tr = { ...(fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {}), ...(fs.existsSync(ex) ? JSON.parse(fs.readFileSync(ex, 'utf8'))[l] || {} : {}) };
  const used = keys.filter(k => tr[k]);
  const U = l.toUpperCase();
  const body = `import type { Dict } from './dict';\n/* Otomatik üretildi: node scripts/i18n-build.mjs (kaynak: scripts/i18n/${l}.json, scripts/names.json). Elle düzenlemeyin. */\nexport const ${U}: Dict = {\n  s: {\n${used.map(k => `    ${q(k)}: ${q(tr[k])},`).join('\n')}\n  },\n  names: ${JSON.stringify(names[l] || {})},\n};\n`;
  fs.writeFileSync(path.join(root, `src/locales/${l}.ts`), body);
  console.log(`${l}: ${used.length}/${keys.length} anahtar`);
}
