import data from "./templatesMeta.json";

export const getTemplatesMetaTranslations = language =>
  data.entries.reduce((translations, entry) => {
    translations[entry.key] = entry[language];
    return translations;
  }, {});
