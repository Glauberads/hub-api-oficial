import data from "./adminOps.json";

export const getAdminOpsTranslations = language =>
  data.entries.reduce((translations, entry) => {
    const path = entry.key.split(".");
    let target = translations;
    path.forEach((part, index) => {
      if (index === path.length - 1) target[part] = entry[language];
      else target = target[part] || (target[part] = {});
    });
    return translations;
  }, {});

export const registerAdminOpsTranslations = i18n => {
  ["pt", "en", "es"].forEach(language => {
    i18n.addResourceBundle(
      language,
      "translations",
      { adminOps: getAdminOpsTranslations(language) },
      true,
      true
    );
  });
};
