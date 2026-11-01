// dist-preview/index.html (tek dosya) → dist-preview/tapu.html (Claude artifact sayfası biçimi)
// Artifact sayfası belge iskeletini kendisi ekler: burada yalnızca başlık, stiller, gövde ve betik kalır.
import { readFileSync, writeFileSync } from 'node:fs';
const src = readFileSync('dist-preview/index.html', 'utf8');
// betikler önce ayrılır (içlerindeki "<style>" metinleri stil sanılmasın)
const scripts = [];
const rest = src.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, m => { scripts.push(m); return ''; });
const styles = [...rest.matchAll(/<style[\s\S]*?<\/style>/g)].map(m => m[0]).join('\n');
const body = (rest.match(/<body[^>]*>([\s\S]*)<\/body>/) || [, ''])[1];
const out = [
  '<title>Tapu</title>',
  '<meta name="claude:viewport-fit-sides" content="cover">',
  styles,
  body.trim(),
  ...scripts,
].join('\n');
writeFileSync('dist-preview/tapu.html', out);
console.log('dist-preview/tapu.html', (out.length / 1024).toFixed(0) + ' kB');
