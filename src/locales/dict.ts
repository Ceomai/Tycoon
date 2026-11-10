/** Sözlük biçimi (locales/*.ts üretilen dosyaları bunu kullanır; i18n.ts'i içe aktarmasınlar diye ayrı). */
export interface Dict { s: Record<string, string>; names?: Record<string, string>; }
