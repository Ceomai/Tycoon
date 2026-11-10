// Adım 4: anlamsal titreşim API'si (buzz.light/success/error/select), tik başına en fazla bir titreşim, ayar kapalıyken sessiz.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const h = vi.hoisted(() => ({ impact: vi.fn(async () => {}), notification: vi.fn(async () => {}), selStart: vi.fn(async () => {}), selChanged: vi.fn(async () => {}), selEnd: vi.fn(async () => {}), native: { v: true } }));
vi.mock('@capacitor/core', async orig => {
  const a: any = await orig();
  return { ...a, Capacitor: { ...a.Capacitor, isNativePlatform: () => h.native.v, getPlatform: () => 'android' } };
});
vi.mock('@capacitor/haptics', () => ({
  Haptics: { impact: h.impact, notification: h.notification, selectionStart: h.selStart, selectionChanged: h.selChanged, selectionEnd: h.selEnd },
  ImpactStyle: { Medium: 'MEDIUM', Light: 'LIGHT' }, NotificationType: { Success: 'SUCCESS', Error: 'ERROR' },
}));

import { buzz } from '../../src/sound';
import { newState, setS, S } from '../../src/state';

let t = 1e6;
beforeEach(() => { setS(newState(0, 'x')); h.native.v = true; for (const f of [h.impact, h.notification, h.selStart, h.selChanged, h.selEnd]) f.mockClear(); t += 1e4; vi.spyOn(performance, 'now').mockImplementation(() => t); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const later = () => { t += 300; };

describe('Anlamsal titreşim', () => {
  it('telefonda: light/medium → impact, success/error → notification, select → seçim geri bildirimi', async () => {
    buzz.light(); expect(h.impact).toHaveBeenLastCalledWith({ style: 'LIGHT' }); later();
    buzz.medium(); expect(h.impact).toHaveBeenLastCalledWith({ style: 'MEDIUM' }); later();
    buzz.success(); expect(h.notification).toHaveBeenLastCalledWith({ type: 'SUCCESS' }); later();
    buzz.error(); expect(h.notification).toHaveBeenLastCalledWith({ type: 'ERROR' }); later();
    buzz.select(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(h.selStart).toHaveBeenCalledTimes(1); expect(h.selChanged).toHaveBeenCalledTimes(1);
  });
  it('aynı tikte (250 ms) en fazla bir titreşim; hata her zaman geçer', () => {
    buzz.light(); buzz.success(); buzz(30);
    expect(h.impact).toHaveBeenCalledTimes(1); expect(h.notification).toHaveBeenCalledTimes(0);
    buzz.error(); expect(h.notification).toHaveBeenCalledTimes(1);
    later(); buzz.success(); expect(h.notification).toHaveBeenCalledTimes(2);
  });
  it('ayar kapalıyken hiçbiri titreştirmez', () => {
    S.vib = false;
    for (const f of [buzz.light, buzz.medium, buzz.success, buzz.error, buzz.select]) { f(); later(); }
    expect(h.impact).not.toHaveBeenCalled(); expect(h.notification).not.toHaveBeenCalled(); expect(h.selStart).not.toHaveBeenCalled();
  });
  it('web: navigator.vibrate en az 10 ms (desenler)', () => {
    h.native.v = false; const v = vi.fn(() => true); vi.stubGlobal('navigator', { vibrate: v });
    buzz.select(); later(); buzz.light(); later(); buzz.success(); later(); buzz.error();
    expect(v.mock.calls.map(c => (c as any[])[0])).toEqual([10, 12, [14, 60, 24], [30, 50, 30]]);
    const all = v.mock.calls.flatMap(c => [].concat((c as any[])[0])); expect(Math.min(...all)).toBeGreaterThanOrEqual(10);
  });
});
