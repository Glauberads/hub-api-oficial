import Setting from "../../models/Setting";

interface Request {
  key: string;
  companyId?: number;
}

const publicSettingsKeys = [
  "userCreation",
  "requireDocument",
  "primaryColorLight",
  "primaryColorDark",
  "appLogoLight",
  "appLogoDark",
  "appLogoFavicon",
  "appName",
  "enabledLanguages",
  "appLogoBackgroundLight",
  "appLogoBackgroundDark",

  // Login / branding
  "loginWhatsappNumber",
  "loginShowWhatsappButton",
  "loginBannerMode",
  "loginBannerImage",
  "loginBannerImageUrl",
  "loginBannerTitle",
  "loginBannerSubtitle",
  "loginBannerBadge1",
  "loginBannerBadge2",
  "loginBannerBadge3",
  "loginLogo",
  "loginLogoUrl"
];

const GetPublicSettingService = async ({
  key,
  companyId
}: Request): Promise<string | undefined | null> => {
  if (!publicSettingsKeys.includes(key)) {
    return null;
  }

  const targetCompanyId = companyId || 1;

  const setting = await Setting.findOne({
    where: {
      companyId: targetCompanyId,
      key
    }
  });

  return setting?.value;
};

export default GetPublicSettingService;