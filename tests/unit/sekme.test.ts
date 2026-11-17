// Tek sekme kilidi (src/tabs.ts): iki sekme taklit edilir (ortak depolama, storage olayı, BroadcastChannel, navigator.locks).
// İkinci sekme oyunu başlatamaz; "Burada devam et" ilk sekmeyi durdurur (son yazmasını bekler); kalp atışı yedeği de aynı.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTabGuard, foreignWrite, TabEnv, STALE_MS, BEAT_MS, TAB_KEY } from '../../src/tabs';

/** navigator.locks taklidi: ifAvailable, signal (vazgeçme), steal. */
class FakeLocks {
  holder: { reject: (e: unknown) => void } | null = null;
  queue: { grant: () => void }[] = [];
  request(_n: string, opts: any, cb: (l: unknown) => any): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const grant = () => {
        const h = { reject }; this.holder = h;
        Promise.resolve(cb({})).then(v => { if (this.holder === h) { this.holder = null; this.queue.shift()?.grant(); } resolve(v); }, reject);
      };
      if (opts.steal) { const old = this.holder; this.holder = null; if (old) old.reject(Object.assign(new Error('stolen'), { name: 'AbortError' })); grant(); return; }
      if (!this.holder) { grant(); return; }
      if (opts.ifAvailable) { Promise.resolve(cb(null)).then(resolve); return; }
      const w = { grant }; this.queue.push(w);
      if (opts.signal) opts.signal.addEventListener('abort', () => { this.queue = this.queue.filter(x => x !== w); reject(Object.assign(new Error('abort'), { name: 'AbortError' })); });
    });
  }
}
/** Ortak "tarayıcı": localStorage + storage olayı (yalnız diğer sekmelere) + BroadcastChannel (yalnız diğer sekmelere). */
function world(opts: { locks: boolean; channel: boolean }) {
  const data = new Map<string, string>(), tabs: { ls: ((k: string | null, v: string | null) => void)[]; chans: any[] }[] = [];
  const locks = opts.locks ? new FakeLocks() : null;
  function env(): TabEnv {
    const me = { ls: [] as ((k: string | null, v: string | null) => void)[], chans: [] as any[] }; tabs.push(me);
    const others = () => tabs.filter(t => t !== me);
    return {
      locks: locks as any,
      channel: opts.channel ? (() => { const c: any = { onmessage: null, postMessage: (m: unknown) => { for (const t of others()) for (const x of t.chans) queueMicrotask(() => x.onmessage && x.onmessage({ data: m })); } }; me.chans.push(c); return c; }) : null,
      store: {
        getItem: k => (data.has(k) ? data.get(k)! : null),
        setItem: (k, v) => { data.set(k, v); for (const t of others()) for (const f of t.ls) queueMicrotask(() => f(k, v)); },
        removeItem: k => { data.delete(k); for (const t of others()) for (const f of t.ls) queueMicrotask(() => f(k, null)); },
      },
      onStorage: f => { me.ls.push(f); },
      now: () => Date.now(),
      setTimeout: (f, ms) => setTimeout(f, ms), clearTimeout: h => clearTimeout(h as any),
      setInterval: (f, ms) => setInterval(f, ms), clearInterval: h => clearInterval(h as any),
    };
  }
  return { env, data };
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

async function scenario(w: ReturnType<typeof world>) {
  const A = createTabGuard(w.env(), 'A'), B = createTabGuard(w.env(), 'B');
  const log: string[] = [];
  A.onLost(async () => { log.push('A:son-yazma'); });
  B.onLost(() => { log.push('B:kayıp'); });
  const pa = A.acquire(); await vi.advanceTimersByTimeAsync(10); expect(await pa).toBe(true);
  const pb = B.acquire(); await vi.advanceTimersByTimeAsync(5000); expect(await pb).toBe(false); // ikinci sekme beklemede
  expect(A.active).toBe(true); expect(B.active).toBe(false);
  await vi.advanceTimersByTimeAsync(STALE_MS * 2);           // A çalışmaya devam ederken B hâlâ alamaz
  expect(A.active).toBe(true);
  const pt = B.takeover(); await vi.advanceTimersByTimeAsync(50); await pt;
  expect(log).toEqual(['A:son-yazma']);                      // A durdu, son yazmasını yaptı
  expect(A.active).toBe(false); expect(B.active).toBe(true);
  await vi.advanceTimersByTimeAsync(BEAT_MS * 4);
  expect(A.active).toBe(false); expect(B.active).toBe(true); // geri almaz
  return { A, B, log };
}

describe('tek sekme kilidi', () => {
  it('navigator.locks + BroadcastChannel', async () => { await scenario(world({ locks: true, channel: true })); });
  it('navigator.locks, BroadcastChannel yok (localStorage iletisi)', async () => { await scenario(world({ locks: true, channel: false })); });
  it('yedek: localStorage kalp atışı (+ BroadcastChannel)', async () => { await scenario(world({ locks: false, channel: true })); });
  it('yedek: yalnız localStorage (kalp atışı + ileti)', async () => { await scenario(world({ locks: false, channel: false })); });
  it('kalp atışı: kapanan sekme anahtarı bırakır, kapanmadan düşen sekmenin anahtarı eskiyince alınır', async () => {
    const w = world({ locks: false, channel: false });
    const A = createTabGuard(w.env(), 'A'); expect(await A.acquire()).toBe(true);
    A.release(); expect(w.data.has(TAB_KEY)).toBe(false);
    const B = createTabGuard(w.env(), 'B'); expect(await B.acquire()).toBe(true);
    const C = createTabGuard(w.env(), 'C'); expect(await C.acquire()).toBe(false);
    w.data.set(TAB_KEY, JSON.stringify({ id: 'olu', at: Date.now() - STALE_MS - 1 }));
    const D = createTabGuard(w.env(), 'D'); expect(await D.acquire()).toBe(true);
  });
  it('kilit kullanılamıyorsa (yalıtılmış çerçeve) oyun yine açılır', async () => {
    const env = world({ locks: true, channel: true }).env(); env.locks = { request: () => { throw new Error('SecurityError'); } };
    const A = createTabGuard(env, 'A'); expect(await A.acquire()).toBe(true);
  });
  it('yabancı yazma: oturum kimliği farklı, kimliksiz ya da silinmiş kayıt', () => {
    expect(foreignWrite(JSON.stringify({ c: 'x', j: '{}', w: 'S1' }), 'S1')).toBe(false);
    expect(foreignWrite(JSON.stringify({ c: 'x', j: '{}', w: 'S2' }), 'S1')).toBe(true);
    expect(foreignWrite(JSON.stringify({ c: 'x', j: '{}' }), 'S1')).toBe(true);
    expect(foreignWrite(null, 'S1')).toBe(true);
  });
});
