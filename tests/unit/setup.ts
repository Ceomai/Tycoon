// Birim testleri: dil sözlükleri uygulamada ayrı parça olarak (loadLang) yüklenir; testler setLang'i eşzamanlı kullandığı için
// hepsi önceden kaydedilir.
import { registerDict } from '../../src/i18n';
import { EN } from '../../src/locales/en';
import { DE } from '../../src/locales/de';
import { JA } from '../../src/locales/ja';
registerDict('en', EN); registerDict('de', DE); registerDict('ja', JA);
