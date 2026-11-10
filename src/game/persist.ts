/* Kaydı yazma: yerel (hemen) + bulut (seyrek, Cloud tarafından) */
import { S } from '../state';
import { writeSave, writeSaveSync, flushSaves, onSaveFail } from '../storage';
import { Time } from '../time';
import { syncEnt } from '../prefs';
import { toast } from '../ui/modal';
import { t } from '../i18n';

onSaveFail(() => toast(t('Kayıt yapılamadı: cihaz depolaması dolu')));

export let dirty = false;
/** Şehir seçilmeden (ilk açılış seçimleri bitmeden) kayıt yazılmaz: yarım kalan kurulum sonraki açılışı bozmasın. */
export function persist() { syncEnt(S); if (!S.city) return; S.savedAt = Time.now(); dirty = true; void writeSave(S); }
export function persistSync() { if (!S.city) return; S.savedAt = Time.now(); writeSaveSync(S); }
/** Kaydı yazar ve diske inene kadar bekler (sayfa yenilemeden önce). */
export async function persistNow(): Promise<void> {
  syncEnt(S);
  if (S.city) { S.savedAt = Time.now(); dirty = true; await writeSave(S); }
  await flushSaves();
}
export function clearDirty() { dirty = false; }
