export interface Language {
  /** BCP 47 tag, e.g. "pt-BR". */
  code: string;
  /** ISO 639-2/T code that MP4 files store, e.g. "por". */
  iso3: string;
  name: string;
}

const LANGUAGES: (Language & { match: RegExp })[] = [
  { code: "pt-BR", iso3: "por", name: "Portuguese (Brazil)", match: /brazil/i },
  { code: "es-419", iso3: "spa", name: "Spanish (Latin America)", match: /latin/i },
  { code: "en", iso3: "eng", name: "English", match: /english/i },
  { code: "vi", iso3: "vie", name: "Vietnamese", match: /vietnam|tiếng việt/i },
  { code: "ar", iso3: "ara", name: "Arabic", match: /arabic/i },
  { code: "fr", iso3: "fra", name: "French", match: /french|français/i },
  { code: "de", iso3: "deu", name: "German", match: /german|deutsch/i },
  { code: "it", iso3: "ita", name: "Italian", match: /italian/i },
  { code: "pt", iso3: "por", name: "Portuguese", match: /portug/i },
  { code: "ru", iso3: "rus", name: "Russian", match: /russian/i },
  { code: "es", iso3: "spa", name: "Spanish", match: /spanish|español/i },
  { code: "id", iso3: "ind", name: "Indonesian", match: /indonesia/i },
  { code: "ms", iso3: "msa", name: "Malay", match: /malay/i },
  { code: "th", iso3: "tha", name: "Thai", match: /thai/i },
  { code: "zh", iso3: "zho", name: "Chinese", match: /chinese/i },
  { code: "ja", iso3: "jpn", name: "Japanese", match: /japanese/i },
  { code: "ko", iso3: "kor", name: "Korean", match: /korean/i },
  { code: "tr", iso3: "tur", name: "Turkish", match: /turkish/i },
  { code: "pl", iso3: "pol", name: "Polish", match: /polish/i },
  { code: "hi", iso3: "hin", name: "Hindi", match: /hindi/i },
  { code: "nl", iso3: "nld", name: "Dutch", match: /dutch/i },
];

/** Subtitle labels are more reliable than the sites' language codes (Zoko marks every track "en"). */
export function languageFromLabel(label: string): Language | undefined {
  const found = LANGUAGES.find((language) => language.match.test(label));
  return found && { code: found.code, iso3: found.iso3, name: found.name };
}

export function languageByCode(code: string): Language {
  const found = LANGUAGES.find((language) => language.code === code);
  return found ? { code: found.code, iso3: found.iso3, name: found.name } : { code, iso3: "und", name: code };
}

export const commonSubtitleLanguages: Language[] = LANGUAGES.map(({ code, iso3, name }) => ({ code, iso3, name }));
