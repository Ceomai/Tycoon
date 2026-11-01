/* =========================================================
   GÜVENİLİR ZAMAN — cihaz saati değiştirilerek yapılan hileye karşı
   - İnternet varsa sunucu saatiyle fark (offset) ölçülür; oyun saati = cihaz + fark.
   - Saat geri alınırsa (en son görülen zamandan geriye) oyun o boşluğu saymaz.
   - Çevrimdışı ileri alma: yokken kazanç zaten en fazla 3 saatle sınırlı; sıralama
     kazancı ayrıca sunucuda zamana göre doğrulanır.
   ========================================================= */
export const Time = {
  offset: 0,
  synced: false,
  now(): number { return Date.now() + this.offset; },
  setServer(serverMs: number, sentAt: number, receivedAt: number) {
    const mid = (sentAt + receivedAt) / 2;
    this.offset = serverMs - mid;
    this.synced = true;
  },
};

/** Saat geri alındı mı? Alındıysa güvenilir "şimdi" olarak son görülen zamanı döner. */
export function guardRollback(maxSeen: number, now: number, toleranceMs = 5 * 60e3): { now: number; rolledBack: boolean } {
  if (now < maxSeen - toleranceMs) return { now: maxSeen, rolledBack: true };
  return { now, rolledBack: false };
}
