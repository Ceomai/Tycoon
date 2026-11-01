/* Kaydı yazma: yerel (hemen) + bulut (seyrek, Cloud tarafından) */
import { S } from '../state';
import { writeSave, writeSaveSync } from '../storage';
import { Time } from '../time';

export let dirty = false;
export function persist() { S.savedAt = Time.now(); dirty = true; void writeSave(S); }
export function persistSync() { S.savedAt = Time.now(); writeSaveSync(S); }
export function clearDirty() { dirty = false; }
