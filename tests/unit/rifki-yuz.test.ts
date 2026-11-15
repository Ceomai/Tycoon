// Rıfkı Abi'nin yüzü (B · Çizgi film): ipucu → ifade eşlemesi, her ifade geçerli SVG, hareketi azalt açıkken animasyon yok.
import { describe, it, expect, vi } from 'vitest';
// @ts-ignore: düğüm türleri bu projede yüklü değil; yalnızca vitest (Node) altında çalışır
import fs from 'node:fs';
import { rifkiFace, moodOf, faceIn, MOODS, TIP_MOOD } from '../../src/ui/rifkiFace';

describe('Rıfkı Abi yüzü', () => {
  it('ipucu kimliği → ifade', () => {
    expect(moodOf('full')).toBe('warn');
    for (const id of ['save2x', 'kapora', 'goal', 'boost', 'pair', 'empty']) expect(moodOf(id)).toBe('think');
    expect(moodOf('task')).toBe('party');
    expect(moodOf('ozel')).toBe('wow'); expect(moodOf('ob')).toBe('wow');
    expect(moodOf('bilinmeyen')).toBe('happy');
    for (const m of Object.values(TIP_MOOD)) expect(MOODS).toContain(m);
  });
  it('rifki.ts\'teki her ipucu kimliği tabloda (yeni ipucu eklenirse ifadesi düşünülsün)', () => {
    const src = fs.readFileSync('src/game/rifki.ts', 'utf8');
    const ids = [...src.matchAll(/\{ id: '(\w+)'/g)].map(m => m[1]);
    expect(ids.length).toBeGreaterThanOrEqual(10);
    for (const id of ids) expect(Object.keys(TIP_MOOD)).toContain(id);
  });
  it('her ifade geçerli, birbirinden farklı bir SVG üretir', () => {
    const seen = new Set<string>();
    for (const m of MOODS) {
      const s = rifkiFace(m);
      expect(s.startsWith('<svg') && s.endsWith('</svg>')).toBe(true);
      expect(s).toContain(`data-mood="${m}"`);
      expect(s).toContain('viewBox="0 0 120 140"');
      expect(s).not.toMatch(/NaN|undefined/);
      // etiketler iyi biçimli: kendini kapatmayan her etiket aynı adla, doğru sırada kapanır
      const st: string[] = [];
      for (const [, cl, name, self] of s.matchAll(/<(\/?)([a-z]+)\b[^>]*?(\/?)>/g)) {
        if (cl) expect(st.pop()).toBe(name); else if (!self) st.push(name);
      }
      expect(st).toEqual([]);
      expect(s).toContain('fill="var(--rk-card)"'); // kart temaya uyar
      expect(s).toContain('#3d6b8a'); expect(s).toContain('#efd8b3'); // ceket, ten
      seen.add(s);
    }
    expect(seen.size).toBe(MOODS.length);
    expect(rifkiFace('happy', false)).not.toContain('--rk-card');
    expect(rifkiFace('party')).not.toContain('rk-eyes'); // kapalı (gülen) gözler kırpılmaz
  });
  it('hareketi azalt açıkken zıplama oynamaz; kapalıyken oynar', () => {
    const el = { animate: vi.fn(() => ({ cancel() {}, onfinish: null, oncancel: null })) } as any;
    expect(faceIn(el, true)).toBeNull(); expect(el.animate).not.toHaveBeenCalled();
    expect(faceIn(el, false)).not.toBeNull(); expect(el.animate).toHaveBeenCalledTimes(1);
    const [frames] = el.animate.mock.calls[0];
    expect(frames.every((k: Keyframe) => Object.keys(k).every(p => p === 'transform' || p === 'opacity' || p === 'offset'))).toBe(true);
  });
});
