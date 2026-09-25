import { Request, Response } from "express";
import Setting from "../models/Setting";
import Company from "../models/Company";

function normalizeUrl(value: string): string {
  return String(value || "").trim().replace(/\\/g, "/");
}

function getBackendPublicUrl(): string {
  const backendUrl =
    process.env.BACKEND_URL ||
    process.env.REACT_APP_BACKEND_URL ||
    process.env.FRONTEND_URL ||
    "";

  return String(backendUrl).replace(/\/+$/, "");
}

function buildPublicAssetUrl(value: string, companyId?: number | string): string {
  if (!value) return "";

  let raw = normalizeUrl(value);

  if (
    /^https?:\/\//i.test(raw) ||
    raw.startsWith("data:") ||
    raw.startsWith("blob:")
  ) {
    return raw;
  }

  const backendUrl = getBackendPublicUrl();

  const publicMarker = "/public/";
  const publicIndex = raw.lastIndexOf(publicMarker);

  if (publicIndex !== -1) {
    raw = raw.slice(publicIndex + publicMarker.length);
  }

  raw = raw.replace(/^\/+/, "").replace(/^public\//, "");

  if (companyId && !raw.startsWith(`company${companyId}/`)) {
    raw = `company${companyId}/${raw}`;
  }

  if (backendUrl) {
    return `${backendUrl}/public/${raw}`;
  }

  return `/public/${raw}`;
}

async function findSettingValue(key: string, companyId?: number): Promise<string> {
  try {
    if (companyId) {
      const companySetting = await Setting.findOne({
        where: {
          key,
          companyId
        } as any
      });

      if (companySetting?.value) {
        return companySetting.value;
      }
    }
  } catch (error) {
    // Compatibilidade com projetos onde Settings não possui companyId.
  }

  try {
    const setting = await Setting.findOne({
      where: {
        key
      }
    });

    return setting?.value || "";
  } catch (error) {
    return "";
  }
}

async function findCompanyName(companyId?: number): Promise<string> {
  if (!companyId) return "";

  try {
    const company = await Company.findByPk(companyId);

    return company?.name || "";
  } catch (error) {
    return "";
  }
}

export const showManifest = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const tenantIdQuery = req.query.tenantId || req.query.companyId;

  const companyId = tenantIdQuery
    ? Number(tenantIdQuery)
    : undefined;

  const safeCompanyId =
    companyId && !Number.isNaN(companyId) && companyId > 0
      ? companyId
      : undefined;

  const companyName = await findCompanyName(safeCompanyId);

  const appNameSetting =
    (await findSettingValue("appName", safeCompanyId)) ||
    companyName ||
    "Multizap Oficial";

  const pwaIconUpload = await findSettingValue("pwaIcon", safeCompanyId);
  const pwaIconUrl = await findSettingValue("pwaIconUrl", safeCompanyId);

  const appLogoFavicon = await findSettingValue("appLogoFavicon", safeCompanyId);
  const loginLogo = await findSettingValue("loginLogo", safeCompanyId);
  const loginLogoUrl = await findSettingValue("loginLogoUrl", safeCompanyId);

  const selectedIcon =
    pwaIconUpload ||
    pwaIconUrl ||
    appLogoFavicon ||
    loginLogo ||
    loginLogoUrl ||
    "";

  const iconUrl = selectedIcon
    ? buildPublicAssetUrl(selectedIcon, safeCompanyId)
    : "/android-chrome-512x512.png";

  const version = Date.now();

  res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  return res.json({
    short_name: appNameSetting,
    name: appNameSetting,
    description: "Sistema de atendimento multicanal",
    start_url: "/",
    scope: "/",
    id: safeCompanyId ? `/company-${safeCompanyId}` : "/",
    display: "standalone",
    theme_color: "#3b82f6",
    background_color: "#ffffff",
    orientation: "portrait-primary",
    categories: ["business", "productivity"],
    lang: "pt-BR",
    icons: [
      {
        src: `${iconUrl}${iconUrl.includes("?") ? "&" : "?"}v=${version}&size=192`,
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable"
      },
      {
        src: `${iconUrl}${iconUrl.includes("?") ? "&" : "?"}v=${version}&size=512`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable"
      }
    ]
  });
};

export default {
  showManifest
};