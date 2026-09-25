export const getContactAvatarUrl = (contact, companyId) => {
  const urlPicture = String(contact?.urlPicture || "").trim();
  const profilePicUrl = String(contact?.profilePicUrl || "").trim();

  if (urlPicture && urlPicture !== "nopicture.png") {
    if (/^https?:\/\//i.test(urlPicture)) {
      return urlPicture;
    }

    if (/^\/public\//i.test(urlPicture)) {
      return urlPicture;
    }

    if (/^public\//i.test(urlPicture)) {
      return `/${urlPicture.replace(/^\/+/, "")}`;
    }

    if (/^company\d+\//i.test(urlPicture)) {
      return `/public/${urlPicture.replace(/^\/+/, "")}`;
    }

    if (urlPicture.includes("/contacts/") || urlPicture.includes("/user/")) {
      return urlPicture.startsWith("/") ? urlPicture : `/${urlPicture}`;
    }

    return `/public/company${companyId}/contacts/${urlPicture.replace(/^\/+/, "")}`;
  }

  if (profilePicUrl && !profilePicUrl.includes("nopicture.png")) {
    return profilePicUrl;
  }

  return "";
};