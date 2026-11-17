/* =========================================================
   TEK SEKME (yalnız web) — oyun aynı anda yalnız bir sekmede etkindir.
   Neden: her sekme kendi canlı durumunu periyodik olarak aynı kayda yazar; iki sekmede aynı bölge açıkken banka aktarımının
   gönderen tarafı (kasadan düşen para) eski durumla ezilip para çoğalabiliyordu. Birleştirme yerine kilit:
   - navigator.locks varsa: "tapu-oyun" kilidi. Kilidi tutan sekme etkin; ikinci sekme bekleme ekranı gösterir.
     "Burada devam et" kilidi çalar (steal): eski sekmenin isteği AbortError ile düşer → eski sekme durur.
   - yoksa: localStorage kalp atışı ("tapu-tab": {id, at}); etkin sekme 2 sn'de bir yazar, 6 sn eskiyen kayıt sahipsiz sayılır;
     devralan anahtarı kendi kimliğiyle yazar, eski sekme storage olayından (ya da sonraki atışından) anlar.
   - Devir: yeni sekme "take" iletisi yollar (BroadcastChannel, yoksa localStorage iletisi); eski sekme son durumunu yazar,
     kayıtları durdurur ve "rel" ile yanıtlar. Yeni sekme yanıtı (en çok TAKE_WAIT) bekleyip kaydı yeniden okur.
   - Ek güvenlik: etkin sekme kendi kayıt anahtarına başka oturumun yazdığını görürse (storage olayı, kayıttaki oturum kimliği
     farklı) birleştirmeden yazmayı keser ve sayfayı yeniler (main.ts).
   Telefonda (Capacitor) kullanılmaz: tek oturum. Ortam enjekte edilebilir (birim testleri iki sekmeyi taklit eder).
   ========================================================= */

export const TAB_LOCK = 'tapu-oyun', TAB_KEY = 'tapu-tab', TAB_MSG = 'tapu-tab-msg';
export const BEAT_MS = 2000, STALE_MS = 6000, WAIT_MS = 1200, TAKE_WAIT = 1500;

type Msg = { t: 'take' | 'rel'; id: string; n?: string };
export interface TabEnv {
  /** navigator.locks (yoksa null) */
  locks: { request: (name: string, opts: any, cb: (lock: unknown) => any) => Promise<unknown> } | null;
  /** BroadcastChannel üreticisi (yoksa null) */
  channel: ((name: string) => { postMessage: (m: unknown) => void; onmessage: ((e: { data: any }) => void) | null; close?: () => void }) | null;
  /** localStorage (yoksa null) */
  store: { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void; removeItem: (k: string) => void } | null;
  /** storage olayı dinleyicisi (başka sekmenin yazdığı anahtar ve yeni değeri) */
  onStorage: (f: (key: string | null, value: string | null) => void) => void;
  now: () => number;
  setTimeout: (f: () => void, ms: number) => unknown;
  clearTimeout: (h: unknown) => void;
  setInterval: (f: () => void, ms: number) => unknown;
  clearInterval: (h: unknown) => void;
}
export interface TabGuard {
  readonly id: string;
  /** Oyun bu sekmede başlayabilir mi (kilit alındı / koordinasyon yok). */
  acquire(): Promise<boolean>;
  /** "Burada devam et": diğer sekmeyi durdurur, onun son yazmasını bekler. */
  takeover(): Promise<void>;
  /** Etkinlik başka sekmeye geçince (bir kez) çağrılır; dönen söz bitince diğer sekmeye "rel" gider. */
  onLost(f: () => void | Promise<void>): void;
  /** Sayfa kapanırken: kalp atışı anahtarını bırakır (yeniden yüklemede sahipsiz görünür). */
  release(): void;
  readonly active: boolean;
}

const rnd = () => Math.random().toString(36).slice(2, 10);

export function createTabGuard(env: TabEnv, id = Date.now().toString(36) + rnd()): TabGuard {
  let state: 'idle' | 'active' | 'lost' = 'idle';
  let lostCb: () => void | Promise<void> = () => {};
  let holdRelease: (() => void) | null = null, beat: unknown = 0;
  const relWait = new Set<() => void>();

  /* ---------- iletiler ---------- */
  let ch: ReturnType<NonNullable<TabEnv['channel']>> | null = null;
  try { ch = env.channel ? env.channel(TAB_MSG) : null; } catch { ch = null; }
  const send = (m: Msg) => {
    try { if (ch) ch.postMessage(m); else if (env.store) env.store.setItem(TAB_MSG, JSON.stringify({ ...m, n: rnd() })); } catch { /* yok */ }
  };
  const onMsg = (m: any) => {
    if (!m || typeof m !== 'object' || m.id === id) return;
    if (m.t === 'take') void lose();
    else if (m.t === 'rel') { for (const f of [...relWait]) f(); }
  };
  if (ch) ch.onmessage = e => onMsg(e && e.data);
  env.onStorage((key, value) => {
    if (key === TAB_MSG && !ch && value) { try { onMsg(JSON.parse(value)); } catch { /* yok */ } }
    else if (key === TAB_KEY && !env.locks && state === 'active') { const o = readKey(value); if (!o || o.id !== id) void lose(); }
  });

  /* ---------- kalp atışı (navigator.locks yoksa) ---------- */
  function readKey(raw: string | null | undefined): { id: string; at: number } | null {
    try { const o = raw ? JSON.parse(raw) : null; return o && typeof o.id === 'string' && Number.isFinite(+o.at) ? { id: o.id, at: +o.at } : null; } catch { return null; }
  }
  const writeKey = () => { try { env.store!.setItem(TAB_KEY, JSON.stringify({ id, at: env.now() })); } catch { /* yok */ } };
  const curKey = () => { try { return readKey(env.store!.getItem(TAB_KEY)); } catch { return null; } };
  function startBeat() {
    writeKey();
    beat = env.setInterval(() => {
      if (state !== 'active') return;
      const k = curKey();
      if (k && k.id !== id && env.now() - k.at < STALE_MS) { void lose(); return; }
      writeKey();
    }, BEAT_MS);
  }

  /* ---------- navigator.locks ---------- */
  /** Kilit isteği: verilince true; opts.signal ile vazgeçilirse false. Kilit çalınınca (AbortError) etkinlik kaybedilir. */
  function hold(opts: any): Promise<boolean> {
    return new Promise<boolean>(res => {
      let granted = false;
      env.locks!.request(TAB_LOCK, opts, lock => {
        if (!lock) { res(false); return undefined; }
        granted = true; state = 'active'; res(true);
        return new Promise<void>(r => { holdRelease = r; });
      }).then(() => { /* bırakıldı */ }, () => { if (granted) void lose(); else res(false); });
    });
  }

  async function lose() {
    if (state !== 'active') return;
    state = 'lost';
    if (beat) { env.clearInterval(beat); beat = 0; }
    try { await lostCb(); } catch { /* yine de bırak */ }
    if (holdRelease) { holdRelease(); holdRelease = null; }
    send({ t: 'rel', id });
  }

  return {
    id,
    get active() { return state === 'active'; },
    onLost(f) { lostCb = f; },
    async acquire() {
      if (env.locks) {
        try {
          // önceki sayfa (yeniden yükleme) kilidi bırakıyor olabilir: kısa süre beklenir
          const ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
          const h = ac ? env.setTimeout(() => ac.abort(), WAIT_MS) : 0;
          const ok = await hold(ac ? { signal: ac.signal } : { ifAvailable: true });
          if (h) env.clearTimeout(h);
          return ok;
        } catch { state = 'active'; return true; } // kilit kullanılamıyor (ör. yalıtılmış çerçeve): koordinasyon yok
      }
      if (env.store) {
        const k = curKey();
        if (k && k.id !== id && env.now() - k.at < STALE_MS) return false;
        state = 'active'; startBeat(); return true;
      }
      state = 'active'; return true;
    },
    async takeover() {
      const rel = new Promise<void>(res => { const f = () => { relWait.delete(f); res(); }; relWait.add(f); env.setTimeout(f, TAKE_WAIT); });
      if (env.locks) { try { await hold({ steal: true }); } catch { state = 'active'; } }
      else { state = 'active'; if (env.store) startBeat(); }
      send({ t: 'take', id });
      await rel;
    },
    release() {
      if (!env.locks && env.store && state === 'active') { const k = curKey(); if (k && k.id === id) { try { env.store.removeItem(TAB_KEY); } catch { /* yok */ } } }
    },
  };
}

/** Tarayıcı ortamı (navigator.locks, BroadcastChannel, localStorage, storage olayı). */
export function browserTabEnv(): TabEnv {
  let store: TabEnv['store'] = null;
  try { store = typeof localStorage !== 'undefined' ? localStorage : null; if (store) store.getItem(TAB_KEY); } catch { store = null; }
  const nav: any = typeof navigator !== 'undefined' ? navigator : null;
  return {
    locks: nav && nav.locks && typeof nav.locks.request === 'function' ? nav.locks : null,
    channel: typeof BroadcastChannel !== 'undefined' ? (n => new BroadcastChannel(n) as any) : null,
    store,
    onStorage: f => { try { window.addEventListener('storage', e => f(e.key, e.newValue)); } catch { /* yok */ } },
    now: () => Date.now(),
    setTimeout: (f, ms) => setTimeout(f, ms), clearTimeout: h => clearTimeout(h as any),
    setInterval: (f, ms) => setInterval(f, ms), clearInterval: h => clearInterval(h as any),
  };
}

/** Kayıt anahtarına başka oturumun yazması (storage olayı): değer yoksa (silindi) ya da kayıttaki oturum kimliği (w) farklıysa. */
export function foreignWrite(value: string | null, sid: string): boolean {
  if (value == null) return true;
  try { const o = JSON.parse(value); return !o || typeof o !== 'object' || o.w !== sid; } catch { return true; }
}
