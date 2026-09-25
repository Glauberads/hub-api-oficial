import data from "./analytics.json";

export const getAnalyticsTranslations = language =>
  data.entries.reduce((translations, entry) => {
    const path = entry.key.split(".");
    let target = translations;

    path.forEach((part, index) => {
      if (index === path.length - 1) {
        target[part] = entry[language];
      } else {
        target = target[part] || (target[part] = {});
      }
    });

    return translations;
  }, {});
