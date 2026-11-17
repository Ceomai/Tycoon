// Tüm dayanıklılık senaryolarını sırayla çalıştırır ve out/ozet.json yazar.  node run.cjs [A_gün=21]
const { execFileSync } = require('child_process'), fs = require('fs'), path = require('path');
const days = process.argv[2] || '21', out = {};
for (const [k, f, a] of [['A', 'a_sadik.cjs', [days]], ['B', 'b_cokulke.cjs', []], ['C', 'c_holding.cjs', []], ['D', 'd_saat.cjs', []], ['E', 'e_ekran.cjs', []]]) {
  const t = Date.now(); let ok = true;
  try { execFileSync(process.execPath, [path.join(__dirname, f), ...a], { stdio: 'inherit' }); } catch { ok = false; }
  const j = path.join(__dirname, 'out', k.toLowerCase() + '.json'); const r = fs.existsSync(j) ? JSON.parse(fs.readFileSync(j, 'utf8')) : {};
  out[k] = { ran: ok, sec: Math.round((Date.now() - t) / 1000), pass: (r.results || []).filter(x => x.pass).length, total: (r.results || []).length, issues: (r.issues || []).length };
}
fs.writeFileSync(path.join(__dirname, 'out', 'ozet.json'), JSON.stringify(out, null, 1)); console.log(out);
