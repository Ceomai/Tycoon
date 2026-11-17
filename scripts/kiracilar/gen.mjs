// Kiracı karakterleri üreticisi: node scripts/kiracilar/gen.mjs (npm run kiracilar)
// Kaynak: scripts/kiracilar/data.mjs (90 karakter + 10 trait, Türkçe metin ve en/de/ja çevirileri).
// Çıktı:  src/game/tenantChars.data.ts  — metinler tk('…') ile (i18n-extract.mjs JSON görmez; TS'teki tk() anahtarlarını toplar)
//         scripts/i18n/extra.json        — meslek, söz, trait adı/açıklaması çevirileri (en/de/ja) birleştirilir
//         scripts/names.json             — Japonca ad yazımları (ja) birleştirilir
// Kısıtlar burada da denetlenir (bozuk veri yazılmaz); aynıları tests/unit/kiraci-karakter.test.ts'te üretilmiş veriye uygulanır.
// Sonra: npm run i18n
import fs from 'node:fs'; import path from 'node:path';
import { TRAITS, ROWS, JA_NAMES } from './data.mjs';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');

const CITY_COUNTRY = { ist: 'tr', izm: 'tr', ank: 'tr', nyc: 'us', la: 'us', chi: 'us', lon: 'uk', man: 'uk', edi: 'uk', muc: 'de', ber: 'de', ham: 'de', tyo: 'jp', osa: 'jp', kyo: 'jp' };
const RENTS = { ogrenci: ['ev'], aile: ['ev'], sanatci: ['ev', 'kafe'], yazilimci: ['ofis', 'ev'], emekli: ['ev'], esnaf: ['dukkan', 'kafe'] };
// game/tenants.ts ARCH[a].wishes ile aynı olmalı (birim testi denetler)
const BASE = {
  ogrenci: [['nb', 3, 'kafe'], ['lvl', 1], ['new', 1, 'ev']],
  aile: [['nb', 3, 'dukkan'], ['lvl', 2], ['new', 1, 'ev']],
  sanatci: [['lvl', 2], ['new', 2, 'ev']],
  yazilimci: [['nb', 3, 'kafe'], ['lvl', 1], ['new', 1, 'ofis']],
  emekli: [['new', 2, 'ev'], ['nb', 1.5, 'kafe'], ['quiet', 0.5]],
  esnaf: [['nb', 3], ['nb', 1, 'dukkan'], ['new', 1, 'dukkan']],
};
// geç oyun (dolu/olgun semt) istekleri: game/tenants.ts ARCH[a].late ile aynı olmalı (birim testi denetler); toplam her tipte 4
const LATE = {
  ogrenci: [['paint', 1.5], ['renov', 1], ['proj', 1], ['kose', 0.5]],
  aile: [['proj', 1.5], ['renov', 1], ['paint', 1], ['kose', 0.5]],
  sanatci: [['paint', 2], ['renov', 1], ['proj', 0.5], ['kose', 0.5]],
  yazilimci: [['proj', 1.5], ['renov', 1], ['paint', 1], ['kose', 0.5]],
  emekli: [['renov', 1.5], ['paint', 1], ['proj', 0.5], ['kose', 1]],
  esnaf: [['kose', 2], ['proj', 1], ['renov', 0.5], ['paint', 0.5]],
};
const sum = l => l.reduce((s, w) => s + w[1], 0);
const r2 = v => Math.round(v * 100) / 100;

const err = [], chars = [], tr = { en: {}, de: {}, ja: {} };
const addT = m => { for (const l of ['en', 'de', 'ja']) { if (tr[l][m.tr] && tr[l][m.tr] !== m[l]) err.push(`çeviri çakışması: ${m.tr}`); tr[l][m.tr] = m[l]; } };

for (const [city, a, n, fam, job, trait, q, look, extra] of ROWS) {
  const T = TRAITS[trait]; if (!T) { err.push(`trait yok: ${trait}`); continue; }
  let w = [...BASE[a], ...(extra || [])].map(x => [...x]);
  for (const x of w) { const m = T.wish[x[0]]; if (m && x[0] !== 'quiet') x[1] *= m; }
  if (T.wish.quiet) {
    if (!RENTS[a].includes('ev')) err.push(`${city}.${a}: huzurlu ama ev kiralamaz`);
    const qq = w.find(x => x[0] === 'quiet'); if (qq) qq[1] *= T.wish.quiet; else w.push(['quiet', 0.5]); // var olanı ×1,5, yoksa seyrek 0,5
  }
  const k = sum(BASE[a]) / sum(w); w = w.map(x => (x[2] ? [x[0], r2(x[1] * k), x[2]] : [x[0], r2(x[1] * k)]));
  // geç oyun havuzu: tipin havuzu × kişiliğin late çarpanları, toplam tipinkine eşit
  let late = LATE[a].map(x => [x[0], x[1] * ((T.late || {})[x[0]] || 1)]);
  const kl = sum(LATE[a]) / sum(late); late = late.map(x => [x[0], r2(x[1] * kl)]);
  const quietShare = (w.find(x => x[0] === 'quiet') || [0, 0])[1] / sum(w);
  if (quietShare > 0.2) err.push(`${city}.${a}: sessiz komşu payı %${Math.round(quietShare * 100)} (seyrek kalmalı)`);
  if (job.tr.length > 40) err.push(`${city}.${a}: meslek uzun (${job.tr.length})`);
  chars.push({ id: `${city}.${a}`, city, country: CITY_COUNTRY[city], a, n, ...(fam ? { fam: true } : {}), r: job.tr, q: q.tr, trait, wishes: w, late, ...(T.wish.sea ? { sea: T.wish.sea } : {}), look });
  addT(job); addT(q);
}
const by = f => chars.reduce((m, c) => ((m[f(c)] ||= []).push(c), m), {});
for (const [city, L] of Object.entries(by(c => c.city))) {
  if (L.length !== 6 || new Set(L.map(c => c.a)).size !== 6) err.push(`${city}: 6 tip değil`);
  if (new Set(L.map(c => c.trait)).size !== 6) err.push(`${city}: trait tekrarı ${L.map(c => c.trait)}`);
}
for (const [k, L] of Object.entries(by(c => c.country + '.' + c.a))) if (new Set(L.map(c => c.trait)).size !== L.length) err.push(`${k}: ülke içinde aynı tip aynı trait`);
for (const [k, L] of Object.entries(by(c => c.city + '.' + c.n))) if (L.length > 1) err.push(`${k}: şehir içinde ad tekrarı`);
if (chars.length !== 90) err.push('90 değil: ' + chars.length);
for (const [k, L] of Object.entries(by(c => JSON.stringify(c.look)))) if (L.length > 1) err.push(`aynı portre: ${L.map(c => c.id)}`);

// trait'ler: kira bonusu × süre, temel (%50 × 60 dk) ±%5 içinde
const traits = {};
for (const [id, T] of Object.entries(TRAITS)) {
  const pct = T.p ?? Math.round(50 * T.bm), min = T.m ?? Math.round(60 / T.bm), prod = pct * min / (50 * 60);
  if (Math.abs(prod - 1) > 0.05) err.push(`${id}: bonus×süre ${prod}`);
  for (const k of Object.keys(T.late || {})) if (!['proj', 'kose', 'paint', 'renov'].includes(k)) err.push(`${id}: bilinmeyen geç istek ${k}`);
  traits[id] = { pct, min, wish: T.wish, late: T.late || {}, ...(T.rare ? { rare: true } : {}), n: T.n.tr, d: T.d.tr };
  addT(T.n); addT(T.d);
}
if (err.length) { console.error('HATA\n' + err.join('\n')); process.exit(1); }

// ---- TS veri dosyası ----
const q = s => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
const lit = v => (typeof v === 'string' ? q(v) : Array.isArray(v) ? '[' + v.map(lit).join(', ') + ']'
  : v && typeof v === 'object' ? (!Object.keys(v).length ? '{}' : '{ ' + Object.entries(v).map(([k, x]) => `${/^[a-z_]\w*$/i.test(k) ? k : q(k)}: ${lit(x)}`).join(', ') + ' }') : String(v));
let ts = `/* Otomatik üretildi: node scripts/kiracilar/gen.mjs (kaynak: scripts/kiracilar/data.mjs). Elle düzenlemeyin.
   90 kiracı karakteri (15 şehir × 6 temel tip) ve 10 kişilik (trait). Metinler Türkçe kaynak, tk() ile i18n anahtarı olur. */
import { tk } from '../i18n';
import type { TChar, TTrait, TraitId } from './tenantChars';

export const TRAITS: Record<TraitId, TTrait> = {
`;
for (const [id, T] of Object.entries(traits)) ts += `  ${id}: { pct: ${T.pct}, min: ${T.min}, wish: ${lit(T.wish)}, late: ${lit(T.late)},${T.rare ? ' rare: true,' : ''} n: tk(${q(T.n)}), d: tk(${q(T.d)}) },\n`;
ts += `};\n\nexport const CHARS: TChar[] = [\n`;
for (const c of chars) {
  ts += `  { id: ${q(c.id)}, city: ${q(c.city)}, country: ${q(c.country)}, a: ${q(c.a)}, n: ${q(c.n)},${c.fam ? ' fam: true,' : ''} trait: ${q(c.trait)},${c.sea ? ` sea: ${c.sea},` : ''}\n`
    + `    r: tk(${q(c.r)}),\n    q: tk(${q(c.q)}),\n    wishes: ${lit(c.wishes)}, late: ${lit(c.late)},\n    look: ${lit(c.look)} },\n`;
}
ts += '];\n';
fs.writeFileSync(path.join(root, 'src/game/tenantChars.data.ts'), ts);

// ---- çeviriler ve Japonca adlar (var olanın üstüne birleştirilir; sıra korunur) ----
const exF = path.join(root, 'scripts/i18n/extra.json'), ex = JSON.parse(fs.readFileSync(exF, 'utf8'));
let added = 0; for (const l of ['en', 'de', 'ja']) for (const [k, v] of Object.entries(tr[l])) { if (ex[l][k] !== v) { if (!(k in ex[l])) added++; ex[l][k] = v; } }
fs.writeFileSync(exF, JSON.stringify(ex, null, 1));
const nF = path.join(root, 'scripts/names.json'), nmTxt = fs.readFileSync(nF, 'utf8'), names = JSON.parse(nmTxt);
let nAdd = 0; for (const [k, v] of Object.entries(JA_NAMES)) if (names.ja[k] !== v) { names.ja[k] = v; nAdd++; }
if (nAdd) fs.writeFileSync(nF, '{\n' + Object.entries(names).map(([l, o]) => ` ${JSON.stringify(l)}: ${JSON.stringify(o)}`).join(',\n') + '\n}\n');

const cnt = {}; for (const c of chars) cnt[c.trait] = (cnt[c.trait] || 0) + 1;
console.log(`tamam: ${chars.length} karakter · ${Object.keys(tr.en).length} metin (${added} yeni çeviri) · ${nAdd} yeni ja ad · trait sayıları`, cnt);
