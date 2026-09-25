type AnyObject = Record<string, any>;

interface BuildVarsParams {
  contact?: AnyObject;
  ticket?: AnyObject;
  company?: AnyObject;
  whatsapp?: AnyObject;
  user?: AnyObject;
  queue?: AnyObject;
}

const removeAccents = (value = ""): string => {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

const normalizeKey = (value = ""): string => {
  const clean = removeAccents(String(value))
    .replace(/[{}]/g, "")
    .replace(/[^a-zA-Z0-9\s_]/g, " ")
    .trim();

  if (!clean) return "";

  const parts = clean.split(/\s+/).filter(Boolean);

  return parts
    .map((part, index) => {
      const lower = part.toLowerCase();
      if (index === 0) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");
};

const getFirstName = (name = ""): string => {
  return String(name).trim().split(/\s+/)[0] || "";
};

const getSafeValue = (value: any): string => {
  if (value === null || value === undefined) return "";
  return String(value);
};

export const buildFlowTemplateVariables = ({
  contact,
  ticket,
  company,
  whatsapp,
  user,
  queue
}: BuildVarsParams): Record<string, string> => {
  const contactData = contact || ticket?.contact || {};
  const ticketUser = user || ticket?.user || {};
  const ticketQueue = queue || ticket?.queue || {};
  const companyData = company || ticket?.company || {};
  const whatsappData = whatsapp || ticket?.whatsapp || {};

  const fullName = getSafeValue(contactData?.name);
  const firstName = getFirstName(fullName);

  const variables: Record<string, string> = {
    name: fullName,
    firstName,
    number: getSafeValue(contactData?.number),
    email: getSafeValue(contactData?.email),
    userName: getSafeValue(ticketUser?.name),
    queue: getSafeValue(ticketQueue?.name),
    companyName: getSafeValue(companyData?.name),
    whatsappName: getSafeValue(whatsappData?.name),
    protocol: getSafeValue(ticket?.protocol || ticket?.id || ""),
    ticketId: getSafeValue(ticket?.id || "")
  };

  const extraInfoList = Array.isArray(contactData?.extraInfo)
    ? contactData.extraInfo
    : Array.isArray(contactData?.contactCustomFields)
    ? contactData.contactCustomFields
    : [];

  for (const item of extraInfoList) {
    const rawKey = item?.name || item?.fieldName || "";
    const rawValue = item?.value || item?.fieldValue || "";

    const key = normalizeKey(rawKey);
    if (key) {
      variables[key] = getSafeValue(rawValue);
    }
  }

  return variables;
};

export const renderFlowTemplate = (
  content: string = "",
  variables: Record<string, string> = {}
): string => {
  let result = String(content || "");

  Object.entries(variables).forEach(([key, value]) => {
    const safeValue = getSafeValue(value);
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, "gi");
    result = result.replace(regex, safeValue);
  });

  return result;
};