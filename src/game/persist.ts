/* Kaydı yazma: yerel (hemen) + bulut (seyrek, Cloud tarafından) */
import { S } from '../state';
import { totalRate } from '../economy';
import { writeSave, writeSaveSync, flushSaves, onSaveFail } from '../storage';
import { Time } from '../time';
import { syncEnt } from '../prefs';
import { toast } from '../ui/modal';
import { t } from '../i18n';

onSaveFail(() => toast(t('Kayıt yapılamadı: cihaz depolaması dolu')));

export let dirty = false;
/** Şehir seçilmeden (ilk açılış seçimleri bitmeden) kayıt yazılmaz: yarım kalan kurulum sonraki açılışı bozmasın. */
/** Bankanın günlük hakkı ve bilanço için son taban kira (2x'siz) kayda yazılır: diğer bölgeler bu bölgeyi yüklemeden okur. */
const snapRate = () => { if (S.bank) { const r = totalRate(false); if (Number.isFinite(r)) S.bank.rate = r; } };
export function persist() { syncEnt(S); if (!S.city) return; snapRate(); S.savedAt = Time.now(); dirty = true; void writeSave(S); }
export function persistSync() { if (!S.city) return; snapRate(); S.savedAt = Time.now(); writeSaveSync(S); }
/** Kaydı yazar ve diske inene kadar bekler (sayfa yenilemeden önce). Dönen: bu durum diske yazıldı mı (şehir yoksa yazılacak bir şey yok: true). */
export async function persistNow(): Promise<boolean> {
  syncEnt(S);
  let ok = true;
  if (S.city) { snapRate(); S.savedAt = Time.now(); dirty = true; ok = await writeSave(S); }
  await flushSaves();
  return ok;
}
export function clearDirty() { dirty = false; }
