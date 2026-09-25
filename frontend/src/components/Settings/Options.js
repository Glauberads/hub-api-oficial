import React, { useEffect, useState, useCallback } from "react";
import { subscribeToPush, unsubscribeFromPush, isPushSubscribed } from "../../services/pushNotification";
import Grid from "@material-ui/core/Grid";
import MenuItem from "@material-ui/core/MenuItem";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Select from "@material-ui/core/Select";
import FormHelperText from "@material-ui/core/FormHelperText";
import { Tab, Tabs, TextField, Button } from "@material-ui/core";
import useSettings from "../../hooks/useSettings";
import OnlyForSuperUser from "../OnlyForSuperUser";
import { toast } from "react-toastify";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import { grey, blue } from "@material-ui/core/colors";
import { i18n } from "../../translate/i18n";
import useCompanySettings from "../../hooks/useSettings/companySettings";
import { getBackendUrl } from "../../config";
import api from "../../services/api";
import { useCurrency } from "../../context/Currency/CurrencyContext";

// ─── Toggle Switch Component ─────────────────────────────────────────────────
function ToggleSetting({
  label,
  value,
  onChange,
  loading,
  trueValue = "enabled",
  falseValue = "disabled",
}) {
  const theme = useTheme();
  const isDark = theme.palette.type === "dark";
  const isOn = value === trueValue || value === true;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "10px 14px",
        borderRadius: 10,
        background: "transparent",
        border: isOn
          ? "1px solid rgba(255,255,255,0.1)"
          : "1px solid rgba(255,255,255,0.05)",
        boxShadow: "none",
        transition: "all 0.3s ease",
        cursor: loading ? "not-allowed" : "pointer",
        opacity: loading ? 0.7 : 1,
        minHeight: 74,
        justifyContent: "space-between",
        userSelect: "none",
      }}
      onClick={() => !loading && onChange(isOn ? falseValue : trueValue)}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: theme.palette.text.primary,
          letterSpacing: "0.5px",
          textTransform: "uppercase",
          lineHeight: 1.3,
        }}
      >
        {label}
      </span>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: theme.palette.text.secondary,
            letterSpacing: "1px",
          }}
        >
          {loading ? i18n.t("settingsSuite.common.updating") : isOn ? i18n.t("settingsSuite.common.enabled") : i18n.t("settingsSuite.common.disabled")}
        </span>
        <div
          style={{
            position: "relative",
            width: 42,
            height: 22,
            borderRadius: 11,
            background: isOn ? "linear-gradient(90deg, #444, #666)" : "#2d3748",
            border: isOn ? "1px solid #888" : "1px solid #4a5568",
            transition: "all 0.3s ease",
            boxShadow: "none",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 2,
              left: isOn ? 22 : 2,
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: isOn ? "#fff" : "#718096",
              transition: "left 0.25s cubic-bezier(.4,0,.2,1)",
              boxShadow: isOn ? "0 0 4px rgba(255,255,255,0.3)" : "none",
            }}
          />
        </div>
      </div>
    </div>
  );
}

const useStyles = makeStyles((theme) => ({
  container: {
    paddingTop: theme.spacing(4),
    paddingBottom: theme.spacing(4),
  },
  fixedHeightPaper: {
    padding: theme.spacing(2),
    display: "flex",
    overflow: "auto",
    flexDirection: "column",
    height: 240,
  },
  cardAvatar: {
    fontSize: "55px",
    color: grey[500],
    backgroundColor: theme.palette.background.paper,
    width: theme.spacing(7),
    height: theme.spacing(7),
  },
  cardTitle: {
    fontSize: "18px",
    color: blue[700],
  },
  cardSubtitle: {
    color: grey[600],
    fontSize: "14px",
  },
  alignRight: {
    textAlign: "right",
  },
  fullWidth: {
    width: "100%",
  },
  selectContainer: {
    width: "100%",
    textAlign: "left",
  },
  tab: {
    backgroundColor: theme.palette.type === "light" ? "#f2f2f2" : "#3c4043",
    borderRadius: 4,
    width: "100%",
    "& .MuiTabs-flexContainer": {
      justifyContent: "center",
    },
  },
}));

export default function Options(props) {
  const { oldSettings, settings, scheduleTypeChanged, user } = props;
  const classes = useStyles();
  const theme = useTheme();
  const { currency, setCurrency } = useCurrency();
  const [loadingCurrency, setLoadingCurrency] = useState(false);
  const [userRating, setUserRating] = useState("disabled");
  const [scheduleType, setScheduleType] = useState("disabled");
  const [chatBotType, setChatBotType] = useState("text");
  const [loadingUserRating, setLoadingUserRating] = useState(false);
  const [loadingScheduleType, setLoadingScheduleType] = useState(false);
  const [userCreation, setUserCreation] = useState("disabled");
  const [loadingUserCreation, setLoadingUserCreation] = useState(false);
  const [requireDocument, setRequireDocument] = useState("disabled");
  const [loadingRequireDocument, setLoadingRequireDocument] = useState(false);
  const [SendGreetingAccepted, setSendGreetingAccepted] = useState("enabled");
  const [loadingSendGreetingAccepted, setLoadingSendGreetingAccepted] = useState(false);
  const [UserRandom, setUserRandom] = useState("enabled");
  const [loadingUserRandom, setLoadingUserRandom] = useState(false);
  const [SettingsTransfTicket, setSettingsTransfTicket] = useState("enabled");
  const [loadingSettingsTransfTicket, setLoadingSettingsTransfTicket] = useState(false);
  const [AcceptCallWhatsapp, setAcceptCallWhatsapp] = useState("enabled");
  const [loadingAcceptCallWhatsapp, setLoadingAcceptCallWhatsapp] = useState(false);
  const [sendSignMessage, setSendSignMessage] = useState("enabled");
  const [loadingSendSignMessage, setLoadingSendSignMessage] = useState(false);
  const [sendGreetingMessageOneQueues, setSendGreetingMessageOneQueues] = useState("enabled");
  const [loadingSendGreetingMessageOneQueues, setLoadingSendGreetingMessageOneQueues] = useState(false);
  const [sendQueuePosition, setSendQueuePosition] = useState("enabled");
  const [loadingSendQueuePosition, setLoadingSendQueuePosition] = useState(false);
  const [sendFarewellWaitingTicket, setSendFarewellWaitingTicket] = useState("enabled");
  const [loadingSendFarewellWaitingTicket, setLoadingSendFarewellWaitingTicket] = useState(false);
  const [acceptAudioMessageContact, setAcceptAudioMessageContact] = useState("enabled");
  const [loadingAcceptAudioMessageContact, setLoadingAcceptAudioMessageContact] = useState(false);

  // IA Suggestions
  const [enableAiSuggestions, setEnableAiSuggestions] = useState("disabled");
  const [loadingEnableAiSuggestions, setLoadingEnableAiSuggestions] = useState(false);

  const [aiApiKey, setAiApiKey] = useState("");
  const [loadingAiApiKey, setLoadingAiApiKey] = useState(false);

  const [aiSuggestionModel, setAiSuggestionModel] = useState("gpt-4o-mini");
  const [loadingAiSuggestionModel, setLoadingAiSuggestionModel] = useState(false);

  const [aiSuggestionPrompt, setAiSuggestionPrompt] = useState("");
  const [loadingAiSuggestionPrompt, setLoadingAiSuggestionPrompt] = useState(false);

  const [aiSuggestionMessagesLimit, setAiSuggestionMessagesLimit] = useState("15");
  const [loadingAiSuggestionMessagesLimit, setLoadingAiSuggestionMessagesLimit] = useState(false);

  // PAYMENT METHODS
  const [eficlientidType, setEfiClientidType] = useState("");
  const [loadingEfiClientidType, setLoadingEfiClientidType] = useState(false);
  const [eficlientsecretType, setEfiClientsecretType] = useState("");
  const [loadingEfiClientsecretType, setLoadingEfiClientsecretType] = useState(false);
  const [efichavepixType, setEfiChavepixType] = useState("");
  const [loadingEfiChavepixType, setLoadingEfiChavepixType] = useState(false);

  // Estados do certificado Efí
  const [eficertificadoType, setEfiCertificadoType] = useState("");
  const [eficertificadopassType, setEfiCertificadoPassType] = useState("");
  const [loadingEfiCertificado, setLoadingEfiCertificado] = useState(false);
  const [loadingEfiCertificadoPass, setLoadingEfiCertificadoPass] = useState(false);

  const [mpaccesstokenType, setmpaccesstokenType] = useState("");
  const [loadingmpaccesstokenType, setLoadingmpaccesstokenType] = useState(false);
  const [stripeprivatekeyType, setstripeprivatekeyType] = useState("");
  const [loadingstripeprivatekeyType, setLoadingstripeprivatekeyType] = useState(false);
  const [asaastokenType, setasaastokenType] = useState("");
  const [loadingasaastokenType, setLoadingasaastokenType] = useState(false);

  // LGPD
  const [enableLGPD, setEnableLGPD] = useState("disabled");
  const [loadingEnableLGPD, setLoadingEnableLGPD] = useState(false);
  const [lgpdMessage, setLGPDMessage] = useState("");
  const [loadinglgpdMessage, setLoadingLGPDMessage] = useState(false);
  const [lgpdLink, setLGPDLink] = useState("");
  const [loadingLGPDLink, setLoadingLGPDLink] = useState(false);
  const [lgpdDeleteMessage, setLGPDDeleteMessage] = useState("disabled");
  const [loadingLGPDDeleteMessage, setLoadingLGPDDeleteMessage] = useState(false);
  const [lgpdConsent, setLGPDConsent] = useState("disabled");
  const [loadingLGPDConsent, setLoadingLGPDConsent] = useState(false);
  const [lgpdHideNumber, setLGPDHideNumber] = useState("disabled");
  const [loadingLGPDHideNumber, setLoadingLGPDHideNumber] = useState(false);

  // Tag obrigatoria
  const [requiredTag, setRequiredTag] = useState("enabled");
  const [loadingRequiredTag, setLoadingRequiredTag] = useState(false);

  // Fechar ticket ao transferir para outro setor
  const [closeTicketOnTransfer, setCloseTicketOnTransfer] = useState(false);
  const [loadingCloseTicketOnTransfer, setLoadingCloseTicketOnTransfer] = useState(false);

  // Status do ticket ao transferir com usuário
  const [transferredTicketStatus, setTransferredTicketStatus] = useState("open");
  const [loadingTransferredTicketStatus, setLoadingTransferredTicketStatus] = useState(false);

  // Usar carteira de clientes
  const [directTicketsToWallets, setDirectTicketsToWallets] = useState(false);
  const [loadingDirectTicketsToWallets, setLoadingDirectTicketsToWallets] = useState(false);

  // Sigla para inserir no copiar contatos
  const [copyContactPrefix, setCopyContactPrefix] = useState("");
  const [loadingCopyContactPrefix, setLoadingCopyContactPrefix] = useState(false);

  // E-mail SMTP - redefinição de senha
  const [mailHost, setMailHost] = useState("");
  const [mailPort, setMailPort] = useState("");
  const [mailSecure, setMailSecure] = useState("false");
  const [mailUser, setMailUser] = useState("");
  const [mailPass, setMailPass] = useState("");
  const [mailFrom, setMailFrom] = useState("");
  const [loadingMailSettings, setLoadingMailSettings] = useState(false);
  const [testMailTo, setTestMailTo] = useState("");
  const [loadingTestMail, setLoadingTestMail] = useState(false);

  // MENSAGENS CUSTOMIZADAS
  const [transferMessage, setTransferMessage] = useState("");
  const [loadingTransferMessage, setLoadingTransferMessage] = useState(false);
  const [greetingAcceptedMessage, setGreetingAcceptedMessage] = useState("");
  const [loadingGreetingAcceptedMessage, setLoadingGreetingAcceptedMessage] = useState(false);
  const [AcceptCallWhatsappMessage, setAcceptCallWhatsappMessage] = useState("");
  const [loadingAcceptCallWhatsappMessage, setLoadingAcceptCallWhatsappMessage] = useState(false);
  const [sendQueuePositionMessage, setSendQueuePositionMessage] = useState("");
  const [loadingSendQueuePositionMessage, setLoadingSendQueuePositionMessage] = useState(false);
  const [showNotificationPending, setShowNotificationPending] = useState(false);
  const [loadingShowNotificationPending, setLoadingShowNotificationPending] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [loadingPush, setLoadingPush] = useState(false);

  // Número de suporte
  const [supportNumber, setSupportNumber] = useState("");
  const [loadingSupportNumber, setLoadingSupportNumber] = useState(false);

  // Login / Branding
  const [loginWhatsappNumber, setLoginWhatsappNumber] = useState("");
  const [loadingLoginWhatsappNumber, setLoadingLoginWhatsappNumber] = useState(false);
  const [loginShowWhatsappButton, setLoginShowWhatsappButton] = useState("enabled");
  const [loadingLoginShowWhatsappButton, setLoadingLoginShowWhatsappButton] = useState(false);
  const [loginBannerMode, setLoginBannerMode] = useState("url");
  const [loadingLoginBannerMode, setLoadingLoginBannerMode] = useState(false);
  const [loginBannerImageUrl, setLoginBannerImageUrl] = useState("");
  const [loadingLoginBannerImageUrl, setLoadingLoginBannerImageUrl] = useState(false);
  const [loginBannerTitle, setLoginBannerTitle] = useState("");
  const [loadingLoginBannerTitle, setLoadingLoginBannerTitle] = useState(false);
  const [loginBannerSubtitle, setLoginBannerSubtitle] = useState("");
  const [loadingLoginBannerSubtitle, setLoadingLoginBannerSubtitle] = useState(false);
  const [loginBannerBadge1, setLoginBannerBadge1] = useState("");
  const [loadingLoginBannerBadge1, setLoadingLoginBannerBadge1] = useState(false);
  const [loginBannerBadge2, setLoginBannerBadge2] = useState("");
  const [loadingLoginBannerBadge2, setLoadingLoginBannerBadge2] = useState(false);
  const [loginBannerBadge3, setLoginBannerBadge3] = useState("");
  const [loadingLoginBannerBadge3, setLoadingLoginBannerBadge3] = useState(false);
  const [loginLogoUrl, setLoginLogoUrl] = useState("");
  const [loadingLoginLogoUrl, setLoadingLoginLogoUrl] = useState(false);
  const [loginLogoFileName, setLoginLogoFileName] = useState("");
  const [loadingLoginLogoFile, setLoadingLoginLogoFile] = useState(false);
  const [loginBannerImageFileName, setLoginBannerImageFileName] = useState("");
  const [loadingLoginBannerImageFile, setLoadingLoginBannerImageFile] = useState(false);


  // Meta / Facebook / Instagram
  const [metaAppId, setMetaAppId] = useState("");
  const [loadingMetaAppId, setLoadingMetaAppId] = useState(false);
  const [metaAppSecret, setMetaAppSecret] = useState("");
  const [loadingMetaAppSecret, setLoadingMetaAppSecret] = useState(false);
  const [metaEmbeddedSignupConfigId, setMetaEmbeddedSignupConfigId] = useState("");
  const [loadingMetaEmbeddedSignupConfigId, setLoadingMetaEmbeddedSignupConfigId] = useState(false);
  const [metaSdkVersion, setMetaSdkVersion] = useState("v25.0");
  const [loadingMetaSdkVersion, setLoadingMetaSdkVersion] = useState(false);
  const [metaRequireBusinessManagement, setMetaRequireBusinessManagement] = useState("true");
  const [loadingMetaRequireBusinessManagement, setLoadingMetaRequireBusinessManagement] = useState(false);

  const { update: updateUserCreation, uploadPublicFile } = useSettings();
  const { update: updateeficlientid } = useSettings();
  const { update: updateeficlientsecret } = useSettings();
  const { update: updateefichavepix } = useSettings();
  const { update: updatempaccesstoken } = useSettings();
  const { update: updatestripeprivatekey } = useSettings();
  const { update: updateasaastoken } = useSettings();
  const { update } = useCompanySettings();

  const isSuper = () => {
    return Boolean(user?.super);
  };

  const isAdmin = () => {
    return String(user?.profile || "").toLowerCase() === "admin";
  };

  const getCurrentCompanyId = () => {
    return Number(
      user?.companyId ||
      user?.company?.id ||
      localStorage.getItem("companyId") ||
      0
    );
  };

  const isMainCompany = () => {
    return getCurrentCompanyId() === 1;
  };

  const canManageBranding = () => {
    return isMainCompany() && (isSuper() || isAdmin());
  };

  const canManageMeta = () => {
    return isSuper() || isAdmin();
  };

  const sectionStyle = {
    background: theme.palette.type === "dark" ? "#303134" : "#f5f5f5",
    borderRadius: 10,
    padding: "20px 20px 16px",
    marginBottom: 20,
    border: `1px solid ${theme.palette.divider}`,
  };

  const sectionHeaderStyle = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 18,
  };

  const sectionTitleStyle = {
    fontSize: 13,
    fontWeight: 700,
    color: theme.palette.text.primary,
    letterSpacing: "1px",
    textTransform: "uppercase",
  };

  function extractUploadedFileValue(fileResponse) {
    if (!fileResponse) return "";
    if (typeof fileResponse === "string") {
      return fileResponse.trim();
    }
    if (typeof fileResponse === "object") {
      return (
        fileResponse.url ||
        fileResponse.path ||
        fileResponse.fileName ||
        fileResponse.filename ||
        fileResponse.name ||
        ""
      );
    }
    return "";
  }

  function buildPublicAssetUrl(value) {
    if (!value) return "";
    const backendUrl = getBackendUrl().replace(/\/+$/, "");
    let raw = String(value).trim().replace(/\\/g, "/");

    if (
      /^https?:\/\//i.test(raw) ||
      raw.startsWith("data:") ||
      raw.startsWith("blob:")
    ) {
      return raw;
    }

    const publicMarker = "/public/";
    const publicIndex = raw.lastIndexOf(publicMarker);
    if (publicIndex !== -1) {
      raw = raw.slice(publicIndex + publicMarker.length);
    }

    raw = raw.replace(/^\/+/, "").replace(/^public\//, "");

    const companyId =
      user?.companyId || user?.company?.id || localStorage.getItem("companyId");
    if (companyId && !raw.startsWith(`company${companyId}/`)) {
      raw = `company${companyId}/${raw}`;
    }

    return `${backendUrl}/public/${raw}`;
  }

  const loginLogoPreviewSrc = buildPublicAssetUrl(loginLogoFileName || loginLogoUrl);
  const loginBannerPreviewValue =
    loginBannerMode === "upload"
      ? loginBannerImageFileName || loginBannerImageUrl
      : loginBannerImageUrl;
  const loginBannerPreviewSrc = buildPublicAssetUrl(loginBannerPreviewValue);

  useEffect(() => {
    isPushSubscribed().then(setPushEnabled);
  }, []);

  const handleTogglePush = useCallback(async () => {
    setLoadingPush(true);
    try {
      if (pushEnabled) {
        const ok = await unsubscribeFromPush();
        if (ok) {
          setPushEnabled(false);
          toast.success("Notificações push desativadas");
        } else {
          toast.error("Erro ao desativar notificações push");
        }
      } else {
        const ok = await subscribeToPush();
        if (ok) {
          setPushEnabled(true);
          toast.success("Notificações push ativadas com sucesso!");
        } else {
          toast.error(
            "Não foi possível ativar as notificações push. Verifique as permissões do navegador."
          );
        }
      }
    } catch (err) {
      toast.error(err?.userMessage || "Erro ao alterar notificações push");
    }
    setLoadingPush(false);
  }, [pushEnabled]);

  useEffect(() => {
    if (Array.isArray(oldSettings) && oldSettings.length) {
      const userPar = oldSettings.find((s) => s.key === "userCreation");
      if (userPar) setUserCreation(userPar.value);

      const requireDocPar = oldSettings.find((s) => s.key === "requireDocument");
      if (requireDocPar) setRequireDocument(requireDocPar.value);

      const copyContactPrefixPar = oldSettings.find((s) => s.key === "copyContactPrefix");
      if (copyContactPrefixPar) {
        setCopyContactPrefix(copyContactPrefixPar.value);
      }

      const eficlientidTypePar = oldSettings.find((s) => s.key === "eficlientid");
      if (eficlientidTypePar) {
        setEfiClientidType(eficlientidTypePar.value);
      }

      const eficlientsecretTypePar = oldSettings.find((s) => s.key === "eficlientsecret");
      if (eficlientsecretTypePar) {
        setEfiClientsecretType(eficlientsecretTypePar.value);
      }

      const efichavepixTypePar = oldSettings.find((s) => s.key === "efichavepix");
      if (efichavepixTypePar) {
        setEfiChavepixType(efichavepixTypePar.value);
      }

      // Carregar certificado Efí
      const eficertificadoTypePar = oldSettings.find((s) => s.key === "eficertificado");
      if (eficertificadoTypePar) {
        setEfiCertificadoType(eficertificadoTypePar.value);
      }

      const eficertificadopassTypePar = oldSettings.find((s) => s.key === "eficertificadopass");
      if (eficertificadopassTypePar) {
        setEfiCertificadoPassType(eficertificadopassTypePar.value);
      }

      const mpaccesstokenTypePar = oldSettings.find((s) => s.key === "mpaccesstoken");
      if (mpaccesstokenTypePar) {
        setmpaccesstokenType(mpaccesstokenTypePar.value);
      }

      const stripeprivatekeyTypePar = oldSettings.find(
        (s) => s.key === "stripeprivatekey"
      );
      if (stripeprivatekeyTypePar) {
        setstripeprivatekeyType(stripeprivatekeyTypePar.value);
      }

      const asaastokenTypePar = oldSettings.find((s) => s.key === "asaastoken");
      if (asaastokenTypePar) {
        setasaastokenType(asaastokenTypePar.value);
      }

      const supportNumberPar = oldSettings.find((s) => s.key === "supportNumber");
      if (supportNumberPar) setSupportNumber(supportNumberPar.value);

      const currencyPar = oldSettings.find((s) => s.key === "currency");
      if (currencyPar) setCurrency(currencyPar.value);

      const mailHostPar = oldSettings.find((s) => s.key === "MAIL_HOST");
      if (mailHostPar) setMailHost(mailHostPar.value);

      const mailPortPar = oldSettings.find((s) => s.key === "MAIL_PORT");
      if (mailPortPar) setMailPort(mailPortPar.value);

      const mailSecurePar = oldSettings.find((s) => s.key === "MAIL_SECURE");
      if (mailSecurePar) setMailSecure(mailSecurePar.value);

      const mailUserPar = oldSettings.find((s) => s.key === "MAIL_USER");
      if (mailUserPar) setMailUser(mailUserPar.value);

      const mailPassPar = oldSettings.find((s) => s.key === "MAIL_PASS");
      if (mailPassPar) setMailPass(mailPassPar.value);

      const mailFromPar = oldSettings.find((s) => s.key === "MAIL_FROM");
      if (mailFromPar) setMailFrom(mailFromPar.value);

      // Login / Branding
      const loginWhatsappNumberPar = oldSettings.find(
        (s) => s.key === "loginWhatsappNumber"
      );
      if (loginWhatsappNumberPar) setLoginWhatsappNumber(loginWhatsappNumberPar.value);

      const loginShowWhatsappButtonPar = oldSettings.find(
        (s) => s.key === "loginShowWhatsappButton"
      );
      if (loginShowWhatsappButtonPar) {
        setLoginShowWhatsappButton(loginShowWhatsappButtonPar.value);
      }

      const loginBannerModePar = oldSettings.find((s) => s.key === "loginBannerMode");
      if (loginBannerModePar) setLoginBannerMode(loginBannerModePar.value);

      const loginBannerImageUrlPar = oldSettings.find((s) => s.key === "loginBannerImageUrl");
      if (loginBannerImageUrlPar) setLoginBannerImageUrl(loginBannerImageUrlPar.value);

      const loginBannerTitlePar = oldSettings.find((s) => s.key === "loginBannerTitle");
      if (loginBannerTitlePar) setLoginBannerTitle(loginBannerTitlePar.value);

      const loginBannerSubtitlePar = oldSettings.find((s) => s.key === "loginBannerSubtitle");
      if (loginBannerSubtitlePar) setLoginBannerSubtitle(loginBannerSubtitlePar.value);

      const loginBannerBadge1Par = oldSettings.find((s) => s.key === "loginBannerBadge1");
      if (loginBannerBadge1Par) setLoginBannerBadge1(loginBannerBadge1Par.value);

      const loginBannerBadge2Par = oldSettings.find((s) => s.key === "loginBannerBadge2");
      if (loginBannerBadge2Par) setLoginBannerBadge2(loginBannerBadge2Par.value);

      const loginBannerBadge3Par = oldSettings.find((s) => s.key === "loginBannerBadge3");
      if (loginBannerBadge3Par) setLoginBannerBadge3(loginBannerBadge3Par.value);

      const loginLogoUrlPar = oldSettings.find((s) => s.key === "loginLogoUrl");
      if (loginLogoUrlPar) setLoginLogoUrl(loginLogoUrlPar.value);

      const loginLogoPar = oldSettings.find((s) => s.key === "loginLogo");
      if (loginLogoPar) setLoginLogoFileName(loginLogoPar.value);

      const loginBannerImagePar = oldSettings.find((s) => s.key === "loginBannerImage");
      if (loginBannerImagePar) setLoginBannerImageFileName(loginBannerImagePar.value);

      // Meta / Facebook / Instagram
      const metaAppIdPar = oldSettings.find((s) => s.key === "metaAppId");
      if (metaAppIdPar) setMetaAppId(metaAppIdPar.value);

      const metaAppSecretPar = oldSettings.find((s) => s.key === "metaAppSecret");
      if (metaAppSecretPar) setMetaAppSecret(metaAppSecretPar.value);

      const metaEmbeddedSignupConfigIdPar = oldSettings.find(
        (s) => s.key === "metaEmbeddedSignupConfigId"
      );
      if (metaEmbeddedSignupConfigIdPar) {
        setMetaEmbeddedSignupConfigId(metaEmbeddedSignupConfigIdPar.value);
      }

      const metaSdkVersionPar = oldSettings.find((s) => s.key === "metaSdkVersion");
      if (metaSdkVersionPar) setMetaSdkVersion(metaSdkVersionPar.value || "v25.0");

      const metaRequireBusinessManagementPar = oldSettings.find(
        (s) => s.key === "metaRequireBusinessManagement"
      );
      if (metaRequireBusinessManagementPar) {
        setMetaRequireBusinessManagement(
          String(metaRequireBusinessManagementPar.value || "true").toLowerCase()
        );
      }

      // IA Suggestions
      const enableAiSuggestionsPar = oldSettings.find(
        s => s.key === "enableAiSuggestions"
      );

      if (enableAiSuggestionsPar) {
        setEnableAiSuggestions(enableAiSuggestionsPar.value);
      }

      const aiApiKeyPar = oldSettings.find(
        s => s.key === "aiApiKey"
      );

      if (aiApiKeyPar) {
        setAiApiKey(aiApiKeyPar.value);
      }

      const aiSuggestionModelPar = oldSettings.find(
        s => s.key === "aiSuggestionModel"
      );

      if (aiSuggestionModelPar) {
        setAiSuggestionModel(aiSuggestionModelPar.value);
      }

      const aiSuggestionPromptPar = oldSettings.find(
        s => s.key === "aiSuggestionPrompt"
      );

      if (aiSuggestionPromptPar) {
        setAiSuggestionPrompt(aiSuggestionPromptPar.value);
      }

      const aiSuggestionMessagesLimitPar = oldSettings.find(
        s => s.key === "aiSuggestionMessagesLimit"
      );

      if (aiSuggestionMessagesLimitPar) {
        setAiSuggestionMessagesLimit(aiSuggestionMessagesLimitPar.value);
      }
    }
  }, [oldSettings]);

  useEffect(() => {
    for (const [key, value] of Object.entries(settings)) {
      if (key === "userRating") setUserRating(value);
      if (key === "scheduleType") setScheduleType(value);
      if (key === "chatBotType") setChatBotType(value);
      if (key === "acceptCallWhatsapp") setAcceptCallWhatsapp(value);
      if (key === "userRandom") setUserRandom(value);
      if (key === "sendGreetingMessageOneQueues") setSendGreetingMessageOneQueues(value);
      if (key === "sendSignMessage") setSendSignMessage(value);
      if (key === "sendFarewellWaitingTicket") setSendFarewellWaitingTicket(value);
      if (key === "sendGreetingAccepted") setSendGreetingAccepted(value);
      if (key === "sendQueuePosition") setSendQueuePosition(value);
      if (key === "acceptAudioMessageContact") setAcceptAudioMessageContact(value);
      if (key === "enableLGPD") setEnableLGPD(value);
      if (key === "requiredTag") setRequiredTag(value);
      if (key === "lgpdDeleteMessage") setLGPDDeleteMessage(value);
      if (key === "lgpdHideNumber") setLGPDHideNumber(value);
      if (key === "lgpdConsent") setLGPDConsent(value);
      if (key === "lgpdMessage") setLGPDMessage(value);
      if (key === "sendMsgTransfTicket") setSettingsTransfTicket(value);
      if (key === "lgpdLink") setLGPDLink(value);
      if (key === "DirectTicketsToWallets") setDirectTicketsToWallets(value);
      if (key === "closeTicketOnTransfer") setCloseTicketOnTransfer(value);
      if (key === "transferredTicketStatus") setTransferredTicketStatus(value);
      if (key === "transferMessage") setTransferMessage(value);
      if (key === "greetingAcceptedMessage") setGreetingAcceptedMessage(value);
      if (key === "AcceptCallWhatsappMessage") setAcceptCallWhatsappMessage(value);
      if (key === "sendQueuePositionMessage") setSendQueuePositionMessage(value);
      if (key === "showNotificationPending") setShowNotificationPending(value);
      if (key === "copyContactPrefix") setCopyContactPrefix(value);
    }
  }, [settings]);

  async function handleChangeUserCreation(value) {
    setUserCreation(value);
    setLoadingUserCreation(true);
    await updateUserCreation({ key: "userCreation", value });
    setLoadingUserCreation(false);
  }

  async function handleChangeRequireDocument(value) {
    setRequireDocument(value);
    setLoadingRequireDocument(true);
    await updateUserCreation({ key: "requireDocument", value });
    setLoadingRequireDocument(false);
  }

  async function handleChangeEfiClientid(value) {
    setEfiClientidType(value);
    setLoadingEfiClientidType(true);
    await updateeficlientid({ key: "eficlientid", value });
    toast.success("Operação atualizada com sucesso.");
    setLoadingEfiClientidType(false);
  }

  async function handleChangeEfiClientsecret(value) {
    setEfiClientsecretType(value);
    setLoadingEfiClientsecretType(true);
    await updateeficlientsecret({ key: "eficlientsecret", value });
    toast.success("Operação atualizada com sucesso.");
    setLoadingEfiClientsecretType(false);
  }

  async function handleChangeEfiChavepix(value) {
    setEfiChavepixType(value);
    setLoadingEfiChavepixType(true);
    await updateefichavepix({ key: "efichavepix", value });
    toast.success("Operação atualizada com sucesso.");
    setLoadingEfiChavepixType(false);
  }

  // Handlers para certificado Efí
  async function handleUploadEfiCertificado(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".p12")) {
      toast.error("Envie um certificado no formato .p12");
      event.target.value = "";
      return;
    }

    setLoadingEfiCertificado(true);

    try {
      const response = await uploadPublicFile({
        settingKey: "eficertificado",
        file
      });

      const savedFileValue = extractUploadedFileValue(response);
      setEfiCertificadoType(savedFileValue || "");
      toast.success("Certificado Efí enviado com sucesso!");
    } catch (err) {
      toast.error("Erro ao enviar certificado Efí.");
    } finally {
      setLoadingEfiCertificado(false);
      event.target.value = "";
    }
  }

  async function handleChangeEfiCertificadoPass(value) {
    setEfiCertificadoPassType(value);
    setLoadingEfiCertificadoPass(true);
    await updateUserCreation({ key: "eficertificadopass", value });
    toast.success("Senha do certificado Efí atualizada.");
    setLoadingEfiCertificadoPass(false);
  }

  async function handleChangempaccesstoken(value) {
    setmpaccesstokenType(value);
    setLoadingmpaccesstokenType(true);
    await updatempaccesstoken({ key: "mpaccesstoken", value });
    toast.success("Operação atualizada com sucesso.");
    setLoadingmpaccesstokenType(false);
  }

  async function handleChangestripeprivatekey(value) {
    setstripeprivatekeyType(value);
    setLoadingstripeprivatekeyType(true);
    await updatestripeprivatekey({ key: "stripeprivatekey", value });
    toast.success("Operação atualizada com sucesso.");
    setLoadingstripeprivatekeyType(false);
  }

  async function handleChangeasaastoken(value) {
    setasaastokenType(value);
    setLoadingasaastokenType(true);
    await updateasaastoken({ key: "asaastoken", value });
    toast.success("Operação atualizada com sucesso.");
    setLoadingasaastokenType(false);
  }

  async function handleChangeUserRating(value) {
    setUserRating(value);
    setLoadingUserRating(true);
    await update({ column: "userRating", data: value });
    setLoadingUserRating(false);
  }

  async function handleScheduleType(value) {
    setScheduleType(value);
    setLoadingScheduleType(true);
    await update({ column: "scheduleType", data: value });
    setLoadingScheduleType(false);
    if (typeof scheduleTypeChanged === "function") {
      scheduleTypeChanged(value);
    }
  }

  async function handleCopyContactPrefix(value) {
    setCopyContactPrefix(value);
    setLoadingCopyContactPrefix(true);
    await update({ column: "copyContactPrefix", data: value });
    setLoadingCopyContactPrefix(false);
  }

  async function handleChatBotType(value) {
    setChatBotType(value);
    await update({ column: "chatBotType", data: value });
    if (typeof scheduleTypeChanged === "function") {
      setChatBotType(value);
    }
  }

  async function handleLGPDMessage(value) {
    setLGPDMessage(value);
    setLoadingLGPDMessage(true);
    await update({ column: "lgpdMessage", data: value });
    setLoadingLGPDMessage(false);
  }

  async function handletransferMessage(value) {
    setTransferMessage(value);
    setLoadingTransferMessage(true);
    await update({ column: "transferMessage", data: value });
    setLoadingTransferMessage(false);
  }

  async function handleGreetingAcceptedMessage(value) {
    setGreetingAcceptedMessage(value);
    setLoadingGreetingAcceptedMessage(true);
    await update({ column: "greetingAcceptedMessage", data: value });
    setLoadingGreetingAcceptedMessage(false);
  }

  async function handleAcceptCallWhatsappMessage(value) {
    setAcceptCallWhatsappMessage(value);
    setLoadingAcceptCallWhatsappMessage(true);
    await update({ column: "AcceptCallWhatsappMessage", data: value });
    setLoadingAcceptCallWhatsappMessage(false);
  }

  async function handlesendQueuePositionMessage(value) {
    setSendQueuePositionMessage(value);
    setLoadingSendQueuePositionMessage(true);
    await update({ column: "sendQueuePositionMessage", data: value });
    setLoadingSendQueuePositionMessage(false);
  }

  async function handleShowNotificationPending(value) {
    setShowNotificationPending(value);
    setLoadingShowNotificationPending(true);
    await update({ column: "showNotificationPending", data: value });
    setLoadingShowNotificationPending(false);
  }

  async function handleLGPDLink(value) {
    setLGPDLink(value);
    setLoadingLGPDLink(true);
    await update({ column: "lgpdLink", data: value });
    setLoadingLGPDLink(false);
  }

  async function handleLGPDDeleteMessage(value) {
    setLGPDDeleteMessage(value);
    setLoadingLGPDDeleteMessage(true);
    await update({ column: "lgpdDeleteMessage", data: value });
    setLoadingLGPDDeleteMessage(false);
  }

  async function handleLGPDConsent(value) {
    setLGPDConsent(value);
    setLoadingLGPDConsent(true);
    await update({ column: "lgpdConsent", data: value });
    setLoadingLGPDConsent(false);
  }

  async function handleLGPDHideNumber(value) {
    setLGPDHideNumber(value);
    setLoadingLGPDHideNumber(true);
    await update({ column: "lgpdHideNumber", data: value });
    setLoadingLGPDHideNumber(false);
  }

  async function handleSendGreetingAccepted(value) {
    setSendGreetingAccepted(value);
    setLoadingSendGreetingAccepted(true);
    await update({ column: "sendGreetingAccepted", data: value });
    setLoadingSendGreetingAccepted(false);
  }

  async function handleUserRandom(value) {
    setUserRandom(value);
    setLoadingUserRandom(true);
    await update({ column: "userRandom", data: value });
    setLoadingUserRandom(false);
  }

  async function handleSettingsTransfTicket(value) {
    setSettingsTransfTicket(value);
    setLoadingSettingsTransfTicket(true);
    await update({ column: "sendMsgTransfTicket", data: value });
    setLoadingSettingsTransfTicket(false);
  }

  async function handleAcceptCallWhatsapp(value) {
    setAcceptCallWhatsapp(value);
    setLoadingAcceptCallWhatsapp(true);
    await update({ column: "acceptCallWhatsapp", data: value });
    setLoadingAcceptCallWhatsapp(false);
  }

  async function handleSendSignMessage(value) {
    setSendSignMessage(value);
    setLoadingSendSignMessage(true);
    await update({ column: "sendSignMessage", data: value });
    localStorage.setItem("sendSignMessage", value === "enabled" ? true : false);
    setLoadingSendSignMessage(false);
  }

  async function handleSendGreetingMessageOneQueues(value) {
    setSendGreetingMessageOneQueues(value);
    setLoadingSendGreetingMessageOneQueues(true);
    await update({ column: "sendGreetingMessageOneQueues", data: value });
    setLoadingSendGreetingMessageOneQueues(false);
  }

  async function handleSendQueuePosition(value) {
    setSendQueuePosition(value);
    setLoadingSendQueuePosition(true);
    await update({ column: "sendQueuePosition", data: value });
    setLoadingSendQueuePosition(false);
  }

  async function handleSendFarewellWaitingTicket(value) {
    setSendFarewellWaitingTicket(value);
    setLoadingSendFarewellWaitingTicket(true);
    await update({ column: "sendFarewellWaitingTicket", data: value });
    setLoadingSendFarewellWaitingTicket(false);
  }

  async function handleAcceptAudioMessageContact(value) {
    setAcceptAudioMessageContact(value);
    setLoadingAcceptAudioMessageContact(true);
    await update({ column: "acceptAudioMessageContact", data: value });
    setLoadingAcceptAudioMessageContact(false);
  }

  async function handleEnableLGPD(value) {
    setEnableLGPD(value);
    setLoadingEnableLGPD(true);
    await update({ column: "enableLGPD", data: value });
    setLoadingEnableLGPD(false);
  }

  async function handleRequiredTag(value) {
    setRequiredTag(value);
    setLoadingRequiredTag(true);
    await update({ column: "requiredTag", data: value });
    setLoadingRequiredTag(false);
  }

  async function handleCloseTicketOnTransfer(value) {
    setCloseTicketOnTransfer(value);
    setLoadingCloseTicketOnTransfer(true);
    await update({ column: "closeTicketOnTransfer", data: value });
    setLoadingCloseTicketOnTransfer(false);
  }

  async function handleTransferredTicketStatus(value) {
    setTransferredTicketStatus(value);
    setLoadingTransferredTicketStatus(true);
    await update({ column: "transferredTicketStatus", data: value });
    setLoadingTransferredTicketStatus(false);
  }

  async function handleSupportNumber(value) {
    setSupportNumber(value);
    setLoadingSupportNumber(true);
    await updateUserCreation({ key: "supportNumber", value });
    toast.success("Número de suporte atualizado!");
    setLoadingSupportNumber(false);
  }

  async function handleCurrency(value) {
    setLoadingCurrency(true);
    try {
      await updateUserCreation({ key: "currency", value });
      setCurrency(value);
      toast.success(i18n.t("settingsSuite.options.currencyUpdated"));
    } finally {
      setLoadingCurrency(false);
    }
  }

  async function handleDirectTicketsToWallets(value) {
    setDirectTicketsToWallets(value);
    setLoadingDirectTicketsToWallets(true);
    await update({ column: "DirectTicketsToWallets", data: value });
    setLoadingDirectTicketsToWallets(false);
  }

  // IA Suggestions Handlers
  async function handleEnableAiSuggestions(value) {
    setEnableAiSuggestions(value);
    setLoadingEnableAiSuggestions(true);

    await updateUserCreation({
      key: "enableAiSuggestions",
      value
    });

    setLoadingEnableAiSuggestions(false);
  }

  async function handleAiApiKey(value) {
    setAiApiKey(value);
    setLoadingAiApiKey(true);

    await updateUserCreation({
      key: "aiApiKey",
      value
    });

    setLoadingAiApiKey(false);
  }

  async function handleAiSuggestionModel(value) {
    setAiSuggestionModel(value);
    setLoadingAiSuggestionModel(true);

    await updateUserCreation({
      key: "aiSuggestionModel",
      value
    });

    setLoadingAiSuggestionModel(false);
  }

  async function handleAiSuggestionPrompt(value) {
    setAiSuggestionPrompt(value);
    setLoadingAiSuggestionPrompt(true);

    await updateUserCreation({
      key: "aiSuggestionPrompt",
      value
    });

    setLoadingAiSuggestionPrompt(false);
  }

  async function handleAiSuggestionMessagesLimit(value) {
    setAiSuggestionMessagesLimit(value);
    setLoadingAiSuggestionMessagesLimit(true);

    await updateUserCreation({
      key: "aiSuggestionMessagesLimit",
      value
    });

    setLoadingAiSuggestionMessagesLimit(false);
  }

  async function handleSaveMailSettings() {
    setLoadingMailSettings(true);
    try {
      await updateUserCreation({ key: "MAIL_HOST", value: mailHost || "" });
      await updateUserCreation({ key: "MAIL_PORT", value: mailPort || "" });
      await updateUserCreation({ key: "MAIL_SECURE", value: mailSecure || "false" });
      await updateUserCreation({ key: "MAIL_USER", value: mailUser || "" });
      await updateUserCreation({ key: "MAIL_PASS", value: mailPass || "" });
      await updateUserCreation({ key: "MAIL_FROM", value: mailFrom || "" });
      toast.success("Configurações de e-mail salvas com sucesso!");
    } catch (err) {
      toast.error("Erro ao salvar configurações de e-mail.");
    } finally {
      setLoadingMailSettings(false);
    }
  }

  async function handleSendTestMail() {
    const targetEmail = (testMailTo || mailUser || "").trim();

    if (!targetEmail) {
      toast.error("Informe o e-mail de destino para teste.");
      return;
    }

    setLoadingTestMail(true);
    try {
      await api.post("/settings/test-email", {
        to: targetEmail,
        mailHost,
        mailPort,
        mailSecure,
        mailUser,
        mailPass,
        mailFrom
      });

      toast.success(`E-mail de teste enviado com sucesso para ${targetEmail}!`);
    } catch (err) {
      toast.error("Erro ao enviar e-mail de teste.");
    } finally {
      setLoadingTestMail(false);
    }
  }

  // Login / Branding Handlers
  async function handleLoginWhatsappNumber(value) {
    setLoginWhatsappNumber(value);
    setLoadingLoginWhatsappNumber(true);
    await updateUserCreation({ key: "loginWhatsappNumber", value });
    setLoadingLoginWhatsappNumber(false);
  }

  async function handleLoginShowWhatsappButton(value) {
    setLoginShowWhatsappButton(value);
    setLoadingLoginShowWhatsappButton(true);
    await updateUserCreation({ key: "loginShowWhatsappButton", value });
    setLoadingLoginShowWhatsappButton(false);
  }

  async function handleLoginBannerMode(value) {
    setLoginBannerMode(value);
    setLoadingLoginBannerMode(true);
    await updateUserCreation({ key: "loginBannerMode", value });
    setLoadingLoginBannerMode(false);
  }

  async function handleLoginBannerImageUrl(value) {
    setLoginBannerImageUrl(value);
    setLoadingLoginBannerImageUrl(true);
    await updateUserCreation({ key: "loginBannerImageUrl", value });
    setLoadingLoginBannerImageUrl(false);
  }

  async function handleLoginBannerTitle(value) {
    setLoginBannerTitle(value);
    setLoadingLoginBannerTitle(true);
    await updateUserCreation({ key: "loginBannerTitle", value });
    setLoadingLoginBannerTitle(false);
  }

  async function handleLoginBannerSubtitle(value) {
    setLoginBannerSubtitle(value);
    setLoadingLoginBannerSubtitle(true);
    await updateUserCreation({ key: "loginBannerSubtitle", value });
    setLoadingLoginBannerSubtitle(false);
  }

  async function handleLoginBannerBadge1(value) {
    setLoginBannerBadge1(value);
    setLoadingLoginBannerBadge1(true);
    await updateUserCreation({ key: "loginBannerBadge1", value });
    setLoadingLoginBannerBadge1(false);
  }

  async function handleLoginBannerBadge2(value) {
    setLoginBannerBadge2(value);
    setLoadingLoginBannerBadge2(true);
    await updateUserCreation({ key: "loginBannerBadge2", value });
    setLoadingLoginBannerBadge2(false);
  }

  async function handleLoginBannerBadge3(value) {
    setLoginBannerBadge3(value);
    setLoadingLoginBannerBadge3(true);
    await updateUserCreation({ key: "loginBannerBadge3", value });
    setLoadingLoginBannerBadge3(false);
  }

  async function handleLoginLogoUrl(value) {
    setLoginLogoUrl(value);
    setLoadingLoginLogoUrl(true);
    await updateUserCreation({ key: "loginLogoUrl", value });
    setLoadingLoginLogoUrl(false);
  }

  async function handleUploadLoginLogo(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    setLoadingLoginLogoFile(true);
    try {
      const response = await uploadPublicFile({ settingKey: "loginLogo", file });
      const savedFileValue = extractUploadedFileValue(response);
      setLoginLogoFileName(savedFileValue || "");
      toast.success("Logo da tela de login enviada com sucesso!");
    } catch (err) {
      toast.error("Erro ao enviar logo da tela de login.");
    } finally {
      setLoadingLoginLogoFile(false);
      event.target.value = "";
    }
  }

  async function handleRemoveLoginLogoUpload() {
    setLoadingLoginLogoFile(true);
    try {
      await updateUserCreation({ key: "loginLogo", value: "" });
      setLoginLogoFileName("");
      toast.success("Logo enviada removida com sucesso!");
    } catch (err) {
      toast.error("Erro ao remover logo enviada.");
    } finally {
      setLoadingLoginLogoFile(false);
    }
  }

  async function handleUploadLoginBanner(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    setLoadingLoginBannerImageFile(true);
    try {
      const response = await uploadPublicFile({ settingKey: "loginBannerImage", file });
      const savedFileValue = extractUploadedFileValue(response);
      setLoginBannerImageFileName(savedFileValue || "");
      setLoginBannerMode("upload");
      await updateUserCreation({ key: "loginBannerMode", value: "upload" });
      toast.success("Banner da tela de login enviado com sucesso!");
    } catch (err) {
      toast.error("Erro ao enviar banner da tela de login.");
    } finally {
      setLoadingLoginBannerImageFile(false);
      event.target.value = "";
    }
  }

  async function handleRemoveLoginBannerUpload() {
    setLoadingLoginBannerImageFile(true);
    try {
      await updateUserCreation({ key: "loginBannerImage", value: "" });
      setLoginBannerImageFileName("");
      toast.success("Banner enviado removido com sucesso!");
    } catch (err) {
      toast.error("Erro ao remover banner enviado.");
    } finally {
      setLoadingLoginBannerImageFile(false);
    }
  }

  // Meta / Facebook / Instagram Handlers
  async function handleMetaAppId(value) {
    setMetaAppId(value);
    setLoadingMetaAppId(true);
    await updateUserCreation({ key: "metaAppId", value });
    setLoadingMetaAppId(false);
  }

  async function handleMetaAppSecret(value) {
    setMetaAppSecret(value);
    setLoadingMetaAppSecret(true);
    await updateUserCreation({ key: "metaAppSecret", value });
    setLoadingMetaAppSecret(false);
  }

  async function handleMetaEmbeddedSignupConfigId(value) {
    setMetaEmbeddedSignupConfigId(value);
    setLoadingMetaEmbeddedSignupConfigId(true);
    await updateUserCreation({ key: "metaEmbeddedSignupConfigId", value });
    setLoadingMetaEmbeddedSignupConfigId(false);
  }

  async function handleMetaSdkVersion(value) {
    setMetaSdkVersion(value);
    setLoadingMetaSdkVersion(true);
    await updateUserCreation({ key: "metaSdkVersion", value });
    setLoadingMetaSdkVersion(false);
  }

  async function handleMetaRequireBusinessManagement(value) {
    setMetaRequireBusinessManagement(value);
    setLoadingMetaRequireBusinessManagement(true);
    await updateUserCreation({ key: "metaRequireBusinessManagement", value });
    setLoadingMetaRequireBusinessManagement(false);
  }

  return (
    <>
      {/* ── Seção: Tela de Login / Branding ── */}
      {canManageBranding() ? (
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>
            <div
              style={{
                width: 4,
                height: 20,
                background: "linear-gradient(180deg, #2563eb 0%, #10b981 100%)",
                borderRadius: 2,
              }}
            />
            <span style={sectionTitleStyle}>{i18n.t("settingsSuite.branding.section")}</span>
          </div>
          <div
            style={{
              marginBottom: 18,
              padding: "14px 16px",
              borderRadius: 12,
              background:
                "linear-gradient(135deg, rgba(37,99,235,0.06) 0%, rgba(16,185,129,0.06) 100%)",
              border: "1px solid rgba(37,99,235,0.10)",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: theme.palette.text.primary, marginBottom: 4 }}>
              {i18n.t("settingsSuite.branding.title")}
            </div>
            <div style={{ fontSize: 12, color: theme.palette.text.secondary, lineHeight: 1.6 }}>
              {i18n.t("settingsSuite.branding.help")}
            </div>
          </div>

          <div
            style={{
              background: theme.palette.background.paper,
              borderRadius: 12,
              border: "1px solid #dde3ea",
              overflow: "hidden",
              marginBottom: 20,
            }}
          >
            <div
              style={{
                padding: "12px 14px",
                borderBottom: "1px solid #edf1f5",
                background: theme.palette.action.hover,
                fontSize: 12,
                fontWeight: 700,
                color: theme.palette.text.primary,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              {i18n.t("settingsSuite.branding.smtp")}
            </div>
            <div style={{ padding: 14 }}>
              <Grid spacing={2} container>
                <Grid xs={12} md={6} item>
                  <TextField
                    fullWidth
                    variant="outlined"
                    label="Host"
                    value={mailHost}
                    onChange={(e) => setMailHost(e.target.value)}
                    placeholder="smtp.gmail.com"
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid xs={12} md={3} item>
                  <TextField
                    fullWidth
                    variant="outlined"
                    label={i18n.t("settingsSuite.branding.port")}
                    value={mailPort}
                    onChange={(e) => setMailPort(e.target.value)}
                    placeholder="587"
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid xs={12} md={3} item>
                  <TextField
                    fullWidth
                    variant="outlined"
                    label={i18n.t("settingsSuite.branding.secure")}
                    value={mailSecure}
                    onChange={(e) => setMailSecure(e.target.value)}
                    placeholder="false"
                    helperText={i18n.t("settingsSuite.branding.secureHelp")}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid xs={12} md={6} item>
                  <TextField
                    fullWidth
                    variant="outlined"
                    label={i18n.t("contactListItems.table.email")}
                    value={mailUser}
                    onChange={(e) => setMailUser(e.target.value)}
                    placeholder="seuemail@gmail.com"
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid xs={12} md={6} item>
                  <TextField
                    fullWidth
                    type="password"
                    variant="outlined"
                    label={i18n.t("settingsSuite.branding.appPassword")}
                    value={mailPass}
                    onChange={(e) => setMailPass(e.target.value)}
                    placeholder="••••••••••••"
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid xs={12} item>
                  <TextField
                    fullWidth
                    variant="outlined"
                    label={i18n.t("settingsSuite.branding.sender")}
                    value={mailFrom}
                    onChange={(e) => setMailFrom(e.target.value)}
                    placeholder="Redefinição de senha <seuemail@gmail.com>"
                    helperText={i18n.t("settingsSuite.branding.senderExample")}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid xs={12} md={6} item>
                  <TextField
                    fullWidth
                    variant="outlined"
                    label={i18n.t("settingsSuite.branding.testEmail")}
                    value={testMailTo}
                    onChange={(e) => setTestMailTo(e.target.value)}
                    placeholder="teste@dominio.com"
                    helperText={i18n.t("settingsSuite.branding.testEmailHelp")}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>

                <Grid xs={12} md={6} item>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      alignItems: "center",
                      gap: 10,
                      height: "100%"
                    }}
                  >
                    <Button
                      variant="outlined"
                      color="primary"
                      onClick={handleSendTestMail}
                      disabled={loadingTestMail || loadingMailSettings}
                    >
                      {loadingTestMail ? i18n.t("settingsSuite.common.sending") : i18n.t("settingsSuite.common.sendTest")}
                    </Button>

                    <Button
                      variant="contained"
                      color="primary"
                      onClick={handleSaveMailSettings}
                      disabled={loadingMailSettings || loadingTestMail}
                    >
                      {loadingMailSettings ? i18n.t("settingsSuite.common.saving") : i18n.t("settingsSuite.common.save")}
                    </Button>
                  </div>
                </Grid>
              </Grid>
            </div>
          </div>

          <Grid spacing={2} container>
            <Grid xs={12} sm={6} md={4} item>
              <ToggleSetting
                label={i18n.t("settingsSuite.branding.whatsappLogin")}
                value={loginShowWhatsappButton}
                onChange={handleLoginShowWhatsappButton}
                loading={loadingLoginShowWhatsappButton}
              />
            </Grid>
            <Grid xs={12} sm={6} md={4} item>
              <FormControl
                className={classes.selectContainer}
                style={{
                  background: theme.palette.background.paper,
                  borderRadius: 10,
                  padding: "10px 14px",
                  border: "1px solid #d9dde3",
                }}
              >
                <InputLabel
                  id="loginBannerMode-label"
                  style={{
                    color: theme.palette.text.primary,
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.5px",
                    textTransform: "uppercase",
                    top: 10,
                    left: 14,
                  }}
                >
                  {i18n.t("settingsSuite.branding.bannerMode")}
                </InputLabel>
                <Select
                  labelId="loginBannerMode-label"
                  value={loginBannerMode}
                  onChange={(e) => handleLoginBannerMode(e.target.value)}
                  style={{ color: theme.palette.text.primary, marginTop: 24 }}
                  disableUnderline
                >
                  <MenuItem value={"url"}>{i18n.t("settingsSuite.branding.imageUrl")}</MenuItem>
                  <MenuItem value={"upload"}>{i18n.t("settingsSuite.branding.internalUpload")}</MenuItem>
                </Select>
                <FormHelperText style={{ color: theme.palette.text.secondary, fontSize: 10 }}>
                  {loadingLoginBannerMode
                    ? i18n.t("settings.settings.options.updating")
                    : "Escolha entre usar URL ou arquivo enviado"}
                </FormHelperText>
              </FormControl>
            </Grid>
            <Grid xs={12} sm={6} md={4} item>
              <FormControl className={classes.selectContainer}>
                <TextField
                  id="loginWhatsappNumber"
                  name="loginWhatsappNumber"
                  margin="dense"
                  label={i18n.t("settingsSuite.branding.whatsappNumber")}
                  variant="outlined"
                  value={loginWhatsappNumber}
                  placeholder="Ex: 5541999998888"
                  onChange={(e) => setLoginWhatsappNumber(e.target.value.replace(/\D/g, ""))}
                  onBlur={() => handleLoginWhatsappNumber(loginWhatsappNumber)}
                  InputLabelProps={{ shrink: true }}
                />
                <FormHelperText>
                  {loadingLoginWhatsappNumber && "Atualizando..."}
                </FormHelperText>
              </FormControl>
            </Grid>

            <Grid xs={12} sm={12} md={12} item>
              <div
                style={{
                  background: theme.palette.background.paper,
                  borderRadius: 12,
                  border: "1px solid #dde3ea",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "12px 14px",
                    borderBottom: "1px solid #edf1f5",
                    background: theme.palette.action.hover,
                    fontSize: 12,
                    fontWeight: 700,
                    color: theme.palette.text.primary,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  {i18n.t("settingsSuite.branding.loginLogo")}
                </div>
                <div style={{ padding: 14 }}>
                  <Grid spacing={2} container>
                    <Grid xs={12} md={7} item>
                      <FormControl className={classes.selectContainer}>
                        <TextField
                          id="loginLogoUrl"
                          name="loginLogoUrl"
                          margin="dense"
                          label={i18n.t("settingsSuite.branding.logoUrl")}
                          variant="outlined"
                          value={loginLogoUrl}
                          placeholder="https://seudominio.com/imagem/logo.png"
                          onChange={(e) => setLoginLogoUrl(e.target.value)}
                          onBlur={() => handleLoginLogoUrl(loginLogoUrl)}
                          InputLabelProps={{ shrink: true }}
                        />
                        <FormHelperText>
                          {loadingLoginLogoUrl && "Atualizando..."}
                        </FormHelperText>
                      </FormControl>
                      <div
                        style={{
                          marginTop: 14,
                          padding: 14,
                          borderRadius: 10,
                          border: "1px dashed #cbd5e1",
                          background: theme.palette.action.hover,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: theme.palette.text.secondary,
                            marginBottom: 10,
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                          }}
                        >
                          {i18n.t("settingsSuite.branding.logoUpload")}
                        </div>
                        <input
                          accept="image/*"
                          id="loginLogoUploadInput"
                          type="file"
                          style={{ display: "none" }}
                          onChange={handleUploadLoginLogo}
                        />
                        <div
                          style={{
                            display: "flex",
                            gap: 10,
                            flexWrap: "wrap",
                            alignItems: "center",
                          }}
                        >
                          <label htmlFor="loginLogoUploadInput">
                            <Button
                              component="span"
                              variant="contained"
                              color="primary"
                              disabled={loadingLoginLogoFile}
                            >
                              {loadingLoginLogoFile ? i18n.t("settingsSuite.common.sending") : i18n.t("settingsSuite.branding.sendLogo")}
                            </Button>
                          </label>
                          {!!loginLogoFileName && (
                            <Button
                              variant="outlined"
                              color="secondary"
                              onClick={handleRemoveLoginLogoUpload}
                              disabled={loadingLoginLogoFile}
                            >
                              {i18n.t("settingsSuite.branding.removeUpload")}
                            </Button>
                          )}
                        </div>
                        <div
                          style={{ fontSize: 11, color: theme.palette.text.secondary, marginTop: 10, lineHeight: 1.5 }}
                        >
                          {i18n.t("settingsSuite.branding.logoPriority")}
                        </div>
                      </div>
                    </Grid>
                    <Grid xs={12} md={5} item>
                      <div
                        style={{
                          height: "100%",
                          minHeight: 180,
                          borderRadius: 12,
                          border: "1px solid #e5e7eb",
                          background: theme.palette.type === "dark"
                            ? "linear-gradient(180deg, #303134 0%, #35383b 100%)"
                            : "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: 16,
                          boxSizing: "border-box",
                        }}
                      >
                        {loginLogoPreviewSrc ? (
                          <div style={{ textAlign: "center", width: "100%" }}>
                            <img
                              src={loginLogoPreviewSrc}
                              alt="Preview Logo Login"
                              style={{
                                maxWidth: "100%",
                                maxHeight: 90,
                                objectFit: "contain",
                                display: "block",
                                margin: "0 auto",
                              }}
                            />
                            <div style={{ fontSize: 11, color: theme.palette.text.secondary, marginTop: 10 }}>
                              {i18n.t("settingsSuite.branding.logoPreview")}
                            </div>
                          </div>
                        ) : (
                          <div style={{ textAlign: "center", fontSize: 12, color: theme.palette.text.secondary }}>
                            {i18n.t("settingsSuite.branding.noLogo")}
                          </div>
                        )}
                      </div>
                    </Grid>
                  </Grid>
                </div>
              </div>
            </Grid>

            <Grid xs={12} sm={12} md={12} item>
              <div
                style={{
                  background: theme.palette.background.paper,
                  borderRadius: 12,
                  border: "1px solid #dde3ea",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "12px 14px",
                    borderBottom: "1px solid #edf1f5",
                    background: theme.palette.action.hover,
                    fontSize: 12,
                    fontWeight: 700,
                    color: theme.palette.text.primary,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  {i18n.t("settingsSuite.branding.loginBanner")}
                </div>
                <div style={{ padding: 14 }}>
                  <Grid spacing={2} container>
                    <Grid xs={12} md={7} item>
                      <FormControl className={classes.selectContainer}>
                        <TextField
                          id="loginBannerImageUrl"
                          name="loginBannerImageUrl"
                          margin="dense"
                          label={i18n.t("settingsSuite.branding.bannerUrl")}
                          variant="outlined"
                          value={loginBannerImageUrl}
                          placeholder="https://seudominio.com/imagem/banner.jpg"
                          onChange={(e) => setLoginBannerImageUrl(e.target.value)}
                          onBlur={() => handleLoginBannerImageUrl(loginBannerImageUrl)}
                          InputLabelProps={{ shrink: true }}
                        />
                        <FormHelperText>
                          {loadingLoginBannerImageUrl && "Atualizando..."}
                        </FormHelperText>
                      </FormControl>
                      <div
                        style={{
                          marginTop: 14,
                          padding: 14,
                          borderRadius: 10,
                          border: "1px dashed #cbd5e1",
                          background: theme.palette.action.hover,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: theme.palette.text.secondary,
                            marginBottom: 10,
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                          }}
                        >
                          {i18n.t("settingsSuite.branding.bannerUpload")}
                        </div>
                        <input
                          accept="image/*"
                          id="loginBannerUploadInput"
                          type="file"
                          style={{ display: "none" }}
                          onChange={handleUploadLoginBanner}
                        />
                        <div
                          style={{
                            display: "flex",
                            gap: 10,
                            flexWrap: "wrap",
                            alignItems: "center",
                          }}
                        >
                          <label htmlFor="loginBannerUploadInput">
                            <Button
                              component="span"
                              variant="contained"
                              color="primary"
                              disabled={loadingLoginBannerImageFile}
                            >
                              {loadingLoginBannerImageFile ? i18n.t("settingsSuite.common.sending") : i18n.t("settingsSuite.branding.sendBanner")}
                            </Button>
                          </label>
                          {!!loginBannerImageFileName && (
                            <Button
                              variant="outlined"
                              color="secondary"
                              onClick={handleRemoveLoginBannerUpload}
                              disabled={loadingLoginBannerImageFile}
                            >
                              {i18n.t("settingsSuite.branding.removeUpload")}
                            </Button>
                          )}
                        </div>
                        <div
                          style={{ fontSize: 11, color: theme.palette.text.secondary, marginTop: 10, lineHeight: 1.5 }}
                        >
                          {i18n.t("settingsSuite.branding.bannerInternalHelp")}
                        </div>
                      </div>
                    </Grid>
                    <Grid xs={12} md={5} item>
                      <div
                        style={{
                          height: "100%",
                          minHeight: 200,
                          borderRadius: 12,
                          border: "1px solid #e5e7eb",
                          background: theme.palette.type === "dark"
                            ? "linear-gradient(180deg, #303134 0%, #35383b 100%)"
                            : "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: 12,
                          boxSizing: "border-box",
                        }}
                      >
                        {loginBannerPreviewSrc ? (
                          <div style={{ textAlign: "center", width: "100%" }}>
                            <img
                              src={loginBannerPreviewSrc}
                              alt="Preview Banner Login"
                              style={{
                                width: "100%",
                                maxHeight: 180,
                                objectFit: "cover",
                                display: "block",
                                margin: "0 auto",
                                borderRadius: 10,
                              }}
                            />
                            <div style={{ fontSize: 11, color: theme.palette.text.secondary, marginTop: 10 }}>
                              {i18n.t("settingsSuite.branding.bannerPreview")}
                            </div>
                          </div>
                        ) : (
                          <div style={{ textAlign: "center", fontSize: 12, color: theme.palette.text.secondary }}>
                            {i18n.t("settingsSuite.branding.noBanner")}
                          </div>
                        )}
                      </div>
                    </Grid>
                  </Grid>
                </div>
              </div>
            </Grid>

            <Grid xs={12} sm={12} md={12} item>
              <FormControl className={classes.selectContainer}>
                <TextField
                  id="loginBannerTitle"
                  name="loginBannerTitle"
                  margin="dense"
                  label={i18n.t("settingsSuite.branding.bannerTitle")}
                  variant="outlined"
                  value={loginBannerTitle}
                  onChange={(e) => setLoginBannerTitle(e.target.value)}
                  onBlur={() => handleLoginBannerTitle(loginBannerTitle)}
                  InputLabelProps={{ shrink: true }}
                />
                <FormHelperText>
                  {loadingLoginBannerTitle && "Atualizando..."}
                </FormHelperText>
              </FormControl>
            </Grid>

            <Grid xs={12} sm={12} md={12} item>
              <FormControl className={classes.selectContainer}>
                <TextField
                  id="loginBannerSubtitle"
                  name="loginBannerSubtitle"
                  margin="dense"
                  label={i18n.t("settingsSuite.branding.bannerSubtitle")}
                  variant="outlined"
                  multiline
                  rows={3}
                  value={loginBannerSubtitle}
                  onChange={(e) => setLoginBannerSubtitle(e.target.value)}
                  onBlur={() => handleLoginBannerSubtitle(loginBannerSubtitle)}
                  InputLabelProps={{ shrink: true }}
                />
                <FormHelperText>
                  {loadingLoginBannerSubtitle && "Atualizando..."}
                </FormHelperText>
              </FormControl>
            </Grid>

            <Grid xs={12} sm={4} md={4} item>
              <FormControl className={classes.selectContainer}>
                <TextField
                  id="loginBannerBadge1"
                  name="loginBannerBadge1"
                  margin="dense"
                  label="Badge 1"
                  variant="outlined"
                  value={loginBannerBadge1}
                  onChange={(e) => setLoginBannerBadge1(e.target.value)}
                  onBlur={() => handleLoginBannerBadge1(loginBannerBadge1)}
                  InputLabelProps={{ shrink: true }}
                />
                <FormHelperText>
                  {loadingLoginBannerBadge1 && "Atualizando..."}
                </FormHelperText>
              </FormControl>
            </Grid>

            <Grid xs={12} sm={4} md={4} item>
              <FormControl className={classes.selectContainer}>
                <TextField
                  id="loginBannerBadge2"
                  name="loginBannerBadge2"
                  margin="dense"
                  label="Badge 2"
                  variant="outlined"
                  value={loginBannerBadge2}
                  onChange={(e) => setLoginBannerBadge2(e.target.value)}
                  onBlur={() => handleLoginBannerBadge2(loginBannerBadge2)}
                  InputLabelProps={{ shrink: true }}
                />
                <FormHelperText>
                  {loadingLoginBannerBadge2 && "Atualizando..."}
                </FormHelperText>
              </FormControl>
            </Grid>

            <Grid xs={12} sm={4} md={4} item>
              <FormControl className={classes.selectContainer}>
                <TextField
                  id="loginBannerBadge3"
                  name="loginBannerBadge3"
                  margin="dense"
                  label="Badge 3"
                  variant="outlined"
                  value={loginBannerBadge3}
                  onChange={(e) => setLoginBannerBadge3(e.target.value)}
                  onBlur={() => handleLoginBannerBadge3(loginBannerBadge3)}
                  InputLabelProps={{ shrink: true }}
                />
                <FormHelperText>
                  {loadingLoginBannerBadge3 && "Atualizando..."}
                </FormHelperText>
              </FormControl>
            </Grid>
          </Grid>
        </div>
      ) : null}

      {/* ── Seção: Integração Meta ── */}
      {canManageMeta() ? (
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>
            <div
              style={{
                width: 4,
                height: 20,
                background: "linear-gradient(180deg, #1877f2 0%, #e1306c 100%)",
                borderRadius: 2,
              }}
            />
            <span style={sectionTitleStyle}>{i18n.t("settingsSuite.meta.section")}</span>
          </div>
          <div
            style={{
              marginBottom: 18,
              padding: "14px 16px",
              borderRadius: 12,
              background:
                "linear-gradient(135deg, rgba(24,119,242,0.06) 0%, rgba(225,48,108,0.06) 100%)",
              border: "1px solid rgba(24,119,242,0.10)",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: theme.palette.text.primary, marginBottom: 4 }}>
              {i18n.t("settingsSuite.meta.title")}
            </div>
            <div style={{ fontSize: 12, color: theme.palette.text.secondary, lineHeight: 1.6 }}>
              {i18n.t("settingsSuite.meta.help")}
            </div>
          </div>
          <Grid spacing={2} container>
            <Grid xs={12} md={6} item>
              <FormControl className={classes.selectContainer}>
                <TextField
                  id="metaAppId"
                  name="metaAppId"
                  margin="dense"
                  label="Meta App ID"
                  variant="outlined"
                  value={metaAppId}
                  placeholder="Ex: 123456789012345"
                  onChange={(e) => setMetaAppId(e.target.value)}
                  onBlur={() => handleMetaAppId(metaAppId)}
                  InputLabelProps={{ shrink: true }}
                />
                <FormHelperText>
                  {loadingMetaAppId
                    ? i18n.t("settings.settings.options.updating")
                    : i18n.t("settingsSuite.meta.appIdHelp")}
                </FormHelperText>
              </FormControl>
            </Grid>

            <Grid xs={12} md={6} item>
              <FormControl className={classes.selectContainer}>
                <TextField
                  id="metaAppSecret"
                  name="metaAppSecret"
                  type="password"
                  margin="dense"
                  label="Meta App Secret"
                  variant="outlined"
                  value={metaAppSecret}
                  placeholder="Informe o App Secret"
                  onChange={(e) => setMetaAppSecret(e.target.value)}
                  onBlur={() => handleMetaAppSecret(metaAppSecret)}
                  InputLabelProps={{ shrink: true }}
                />
                <FormHelperText>
                  {loadingMetaAppSecret
                    ? i18n.t("settings.settings.options.updating")
                    : i18n.t("settingsSuite.meta.appSecretHelp")}
                </FormHelperText>
              </FormControl>
            </Grid>

            <Grid xs={12} md={6} item>
              <FormControl className={classes.selectContainer}>
                <TextField
                  id="metaSdkVersion"
                  name="metaSdkVersion"
                  margin="dense"
                  label={i18n.t("settingsSuite.meta.sdkVersion")}
                  variant="outlined"
                  value={metaSdkVersion}
                  placeholder="v25.0"
                  onChange={(e) => setMetaSdkVersion(e.target.value)}
                  onBlur={() => handleMetaSdkVersion(metaSdkVersion)}
                  InputLabelProps={{ shrink: true }}
                />
                <FormHelperText>
                  {loadingMetaSdkVersion ? i18n.t("settings.settings.options.updating") : "Exemplo: v25.0"}
                </FormHelperText>
              </FormControl>
            </Grid>

            <Grid xs={12} md={6} item>
              <FormControl className={classes.selectContainer}>
                <TextField
                  id="metaEmbeddedSignupConfigId"
                  name="metaEmbeddedSignupConfigId"
                  margin="dense"
                  label={i18n.t("settingsSuite.meta.embeddedSignupConfigId")}
                  variant="outlined"
                  value={metaEmbeddedSignupConfigId}
                  placeholder="Ex: 123456789012345"
                  onChange={(e) => setMetaEmbeddedSignupConfigId(e.target.value)}
                  onBlur={() =>
                    handleMetaEmbeddedSignupConfigId(metaEmbeddedSignupConfigId)
                  }
                  InputLabelProps={{ shrink: true }}
                />
                <FormHelperText>
                  {loadingMetaEmbeddedSignupConfigId
                    ? i18n.t("settings.settings.options.updating")
                    : i18n.t("settingsSuite.meta.embeddedSignupConfigIdHelp")}
                </FormHelperText>
              </FormControl>
            </Grid>

            <Grid xs={12} sm={6} md={4} item>
              <ToggleSetting
                label={i18n.t("settingsSuite.meta.permission")}
                value={metaRequireBusinessManagement}
                onChange={handleMetaRequireBusinessManagement}
                loading={loadingMetaRequireBusinessManagement}
                trueValue="true"
                falseValue="false"
              />
            </Grid>
          </Grid>
        </div>
      ) : null}

      {/* ── Seção: Configurações Gerais ── */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <div style={{ width: 4, height: 20, background: "#555555", borderRadius: 2 }} />
          <span style={sectionTitleStyle}>{i18n.t("whitelabel.sections.general")}</span>
        </div>
        <Grid spacing={2} container>
          <Grid xs={12} sm={6} md={4} item>
            <FormControl variant="outlined" size="small" className={classes.selectContainer}>
              <InputLabel>{i18n.t("settingsSuite.options.currency")}</InputLabel>
              <Select
                value={currency}
                onChange={(event) => handleCurrency(event.target.value)}
                label={i18n.t("settingsSuite.options.currency")}
                disabled={loadingCurrency}
              >
                <MenuItem value="BRL">BRL — Real brasileiro (R$)</MenuItem>
                <MenuItem value="COP">COP — Peso colombiano ($)</MenuItem>
                <MenuItem value="USD">USD — Dólar americano (US$)</MenuItem>
              </Select>
              <FormHelperText>{i18n.t("settingsSuite.options.currencyHelp")}</FormHelperText>
            </FormControl>
          </Grid>
          {isSuper() ? (
            <Grid xs={12} sm={6} md={4} item>
              <ToggleSetting
                label={i18n.t("settings.settings.options.creationCompanyUser")}
                value={userCreation}
                onChange={handleChangeUserCreation}
                loading={loadingUserCreation}
              />
            </Grid>
          ) : null}
          <Grid xs={12} sm={6} md={4} item>
            <ToggleSetting
              label={i18n.t("settings.settings.options.evaluations")}
              value={userRating}
              onChange={handleChangeUserRating}
              loading={loadingUserRating}
            />
          </Grid>
          <Grid xs={12} sm={6} md={4} item>
            <ToggleSetting
              label={i18n.t("settings.settings.options.sendGreetingAccepted")}
              value={SendGreetingAccepted}
              onChange={handleSendGreetingAccepted}
              loading={loadingSendGreetingAccepted}
            />
          </Grid>
          <Grid xs={12} sm={6} md={4} item>
            <ToggleSetting
              label={i18n.t("settings.settings.options.userRandom")}
              value={UserRandom}
              onChange={handleUserRandom}
              loading={loadingUserRandom}
            />
          </Grid>
          <Grid xs={12} sm={6} md={4} item>
            <ToggleSetting
              label={i18n.t("settings.settings.options.sendMsgTransfTicket")}
              value={SettingsTransfTicket}
              onChange={handleSettingsTransfTicket}
              loading={loadingSettingsTransfTicket}
            />
          </Grid>
          <Grid xs={12} sm={6} md={4} item>
            <ToggleSetting
              label={i18n.t("settings.settings.options.acceptCallWhatsapp")}
              value={AcceptCallWhatsapp}
              onChange={handleAcceptCallWhatsapp}
              loading={loadingAcceptCallWhatsapp}
            />
          </Grid>
          <Grid xs={12} sm={6} md={4} item>
            <ToggleSetting
              label={i18n.t("settings.settings.options.sendSignMessage")}
              value={sendSignMessage}
              onChange={handleSendSignMessage}
              loading={loadingSendSignMessage}
            />
          </Grid>
          <Grid xs={12} sm={6} md={4} item>
            <ToggleSetting
              label={i18n.t("settings.settings.options.sendGreetingMessageOneQueues")}
              value={sendGreetingMessageOneQueues}
              onChange={handleSendGreetingMessageOneQueues}
              loading={loadingSendGreetingMessageOneQueues}
            />
          </Grid>
          <Grid xs={12} sm={6} md={4} item>
            <ToggleSetting
              label={i18n.t("settings.settings.options.sendQueuePosition")}
              value={sendQueuePosition}
              onChange={handleSendQueuePosition}
              loading={loadingSendQueuePosition}
            />
          </Grid>
          <Grid xs={12} sm={6} md={4} item>
            <ToggleSetting
              label={i18n.t("settings.settings.options.sendFarewellWaitingTicket")}
              value={sendFarewellWaitingTicket}
              onChange={handleSendFarewellWaitingTicket}
              loading={loadingSendFarewellWaitingTicket}
            />
          </Grid>
          <Grid xs={12} sm={6} md={4} item>
            <ToggleSetting
              label={i18n.t("settings.settings.options.acceptAudioMessageContact")}
              value={acceptAudioMessageContact}
              onChange={handleAcceptAudioMessageContact}
              loading={loadingAcceptAudioMessageContact}
            />
          </Grid>
          <Grid xs={12} sm={6} md={4} item>
            <ToggleSetting
              label={i18n.t("settings.settings.options.enableLGPD")}
              value={enableLGPD}
              onChange={handleEnableLGPD}
              loading={loadingEnableLGPD}
            />
          </Grid>
          <Grid xs={12} sm={6} md={4} item>
            <ToggleSetting
              label={i18n.t("settings.settings.options.requiredTag")}
              value={requiredTag}
              onChange={handleRequiredTag}
              loading={loadingRequiredTag}
            />
          </Grid>
          <Grid xs={12} sm={6} md={4} item>
            <ToggleSetting
              label={i18n.t("settings.settings.options.closeTicketOnTransfer")}
              value={closeTicketOnTransfer}
              onChange={handleCloseTicketOnTransfer}
              loading={loadingCloseTicketOnTransfer}
              trueValue={true}
              falseValue={false}
            />
          </Grid>
          <Grid xs={12} sm={6} md={4} item>
            <ToggleSetting
              label={i18n.t("settings.settings.options.showNotificationPending")}
              value={showNotificationPending}
              onChange={handleShowNotificationPending}
              loading={loadingShowNotificationPending}
              trueValue={true}
              falseValue={false}
            />
          </Grid>
          <Grid xs={12} sm={6} md={4} item>
            <ToggleSetting
              label={i18n.t("settings.settings.options.DirectTicketsToWallets")}
              value={directTicketsToWallets}
              onChange={handleDirectTicketsToWallets}
              loading={loadingDirectTicketsToWallets}
              trueValue={true}
              falseValue={false}
            />
          </Grid>
          {isSuper() ? (
            <Grid xs={12} sm={6} md={4} item>
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: theme.palette.background.paper,
                  border: "1px solid #cccccc",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: theme.palette.text.primary,
                    letterSpacing: "0.5px",
                    textTransform: "uppercase",
                    lineHeight: 1.3,
                    display: "block",
                    marginBottom: 8,
                  }}
                >
                  📞 {i18n.t("settingsSuite.options.supportNumber")}
                </span>
                <TextField
                  size="small"
                  variant="outlined"
                  fullWidth
                  placeholder="Ex: 5511999998888"
                  value={supportNumber}
                  onChange={(e) => setSupportNumber(e.target.value.replace(/\D/g, ""))}
                  onBlur={() => handleSupportNumber(supportNumber)}
                  disabled={loadingSupportNumber}
                  helperText={i18n.t("settingsSuite.options.supportHelp")}
                  inputProps={{ maxLength: 15 }}
                />
              </div>
            </Grid>
          ) : null}
        </Grid>
      </div>

      {/* ── Seção: IA Sugestão de Respostas ── */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <div
            style={{
              width: 4,
              height: 20,
              background: "linear-gradient(180deg, #7c3aed 0%, #2563eb 100%)",
              borderRadius: 2,
            }}
          />

          <span style={sectionTitleStyle}>
            {i18n.t("settingsSuite.options.aiSection")}
          </span>
        </div>

        <Grid spacing={2} container>

          <Grid xs={12} sm={6} md={4} item>
            <ToggleSetting
              label={i18n.t("settingsSuite.options.enableSuggestions")}
              value={enableAiSuggestions}
              onChange={handleEnableAiSuggestions}
              loading={loadingEnableAiSuggestions}
            />
          </Grid>

          <Grid xs={12} md={12} item>
            <FormControl className={classes.selectContainer}>
              <TextField
                id="aiApiKey"
                name="aiApiKey"
                type="password"
                margin="dense"
                label={i18n.t("settingsSuite.options.openAiKey")}
                variant="outlined"
                value={aiApiKey}
                onChange={(e) => setAiApiKey(e.target.value)}
                onBlur={() => handleAiApiKey(aiApiKey)}
                InputLabelProps={{ shrink: true }}
              />

              <FormHelperText>
                {loadingAiApiKey
                  ? i18n.t("settings.settings.options.updating")
                  : i18n.t("settingsSuite.aiHelp.apiKeySaved")}
              </FormHelperText>
            </FormControl>
          </Grid>

          <Grid xs={12} sm={6} md={4} item>
            <FormControl className={classes.selectContainer}>
              <TextField
                id="aiSuggestionModel"
                name="aiSuggestionModel"
                margin="dense"
                label={i18n.t("settingsSuite.options.aiModel")}
                variant="outlined"
                value={aiSuggestionModel}
                onChange={(e) => setAiSuggestionModel(e.target.value)}
                onBlur={() =>
                  handleAiSuggestionModel(aiSuggestionModel)
                }
                InputLabelProps={{ shrink: true }}
              />

              <FormHelperText>
                {i18n.t("settingsSuite.aiHelp.modelExample")}
              </FormHelperText>
            </FormControl>
          </Grid>

          <Grid xs={12} sm={6} md={4} item>
            <FormControl className={classes.selectContainer}>
              <TextField
                id="aiSuggestionMessagesLimit"
                name="aiSuggestionMessagesLimit"
                margin="dense"
                type="number"
                label={i18n.t("settingsSuite.options.analyzedMessages")}
                variant="outlined"
                value={aiSuggestionMessagesLimit}
                onChange={(e) =>
                  setAiSuggestionMessagesLimit(e.target.value)
                }
                onBlur={() =>
                  handleAiSuggestionMessagesLimit(
                    aiSuggestionMessagesLimit
                  )
                }
                InputLabelProps={{ shrink: true }}
              />

              <FormHelperText>
                {i18n.t("settingsSuite.aiHelp.recommendedRange")}
              </FormHelperText>
            </FormControl>
          </Grid>

          <Grid xs={12} item>
            <FormControl className={classes.selectContainer}>
              <TextField
                id="aiSuggestionPrompt"
                name="aiSuggestionPrompt"
                margin="dense"
                multiline
                rows={5}
                label={i18n.t("settingsSuite.options.aiPrompt")}
                variant="outlined"
                value={aiSuggestionPrompt}
                onChange={(e) =>
                  setAiSuggestionPrompt(e.target.value)
                }
                onBlur={() =>
                  handleAiSuggestionPrompt(
                    aiSuggestionPrompt
                  )
                }
                InputLabelProps={{ shrink: true }}
              />

              <FormHelperText>
                {i18n.t("settingsSuite.aiHelp.promptHelp")}
              </FormHelperText>
            </FormControl>
          </Grid>

        </Grid>
      </div>

      {/* ── Seção: Agendamento e Bot ── */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <div style={{ width: 4, height: 20, background: "#555555", borderRadius: 2 }} />
          <span style={sectionTitleStyle}>{i18n.t("settingsSuite.options.scheduleBot")}</span>
        </div>
        <Grid spacing={2} container>
          <Grid xs={12} sm={6} md={4} item>
            <FormControl
              className={classes.selectContainer}
              style={{
                background: theme.palette.background.paper,
                borderRadius: 8,
                padding: "10px 14px",
                border: "1px solid #cccccc",
              }}
            >
              <InputLabel
                id="schedule-type-label"
                style={{
                  color: theme.palette.text.primary,
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.5px",
                  textTransform: "uppercase",
                  top: 10,
                  left: 14,
                }}
              >
                {i18n.t("settings.settings.options.officeScheduling")}
              </InputLabel>
              <Select
                labelId="schedule-type-label"
                value={scheduleType}
                onChange={async (e) => {
                  handleScheduleType(e.target.value);
                }}
                style={{ color: theme.palette.text.primary, marginTop: 24 }}
                disableUnderline
              >
                <MenuItem value={"disabled"}>{i18n.t("settings.settings.options.disabled")}</MenuItem>
                <MenuItem value={"queue"}>{i18n.t("settings.settings.options.queueManagement")}</MenuItem>
                <MenuItem value={"company"}>{i18n.t("settings.settings.options.companyManagement")}</MenuItem>
                <MenuItem value={"connection"}>
                  {i18n.t("settings.settings.options.connectionManagement")}
                </MenuItem>
              </Select>
              <FormHelperText style={{ color: theme.palette.text.secondary, fontSize: 10 }}>
                {loadingScheduleType && i18n.t("settings.settings.options.updating")}
              </FormHelperText>
            </FormControl>
          </Grid>
          <Grid xs={12} sm={6} md={4} item>
            <FormControl
              className={classes.selectContainer}
              style={{
                background: theme.palette.background.paper,
                borderRadius: 8,
                padding: "10px 14px",
                border: "1px solid #cccccc",
              }}
            >
              <InputLabel
                id="chatbot-type-label"
                style={{
                  color: theme.palette.text.primary,
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.5px",
                  textTransform: "uppercase",
                  top: 10,
                  left: 14,
                }}
              >
                {i18n.t("settings.settings.options.chatBotType")}
              </InputLabel>
              <Select
                labelId="chatbot-type-label"
                value={chatBotType}
                onChange={async (e) => {
                  handleChatBotType(e.target.value);
                }}
                style={{ color: theme.palette.text.primary, marginTop: 24 }}
                disableUnderline
              >
                <MenuItem value={"text"}>{i18n.t("queueModal.bot.text")}</MenuItem>
              </Select>
              <FormHelperText style={{ color: theme.palette.text.secondary, fontSize: 10 }}>
                {loadingScheduleType && i18n.t("settings.settings.options.updating")}
              </FormHelperText>
            </FormControl>
          </Grid>
          <Grid xs={12} sm={6} md={4} item>
            <FormControl
              className={classes.selectContainer}
              style={{
                background: theme.palette.background.paper,
                borderRadius: 8,
                padding: "10px 14px",
                border: "1px solid #cccccc",
              }}
            >
              <InputLabel
                id="transferredTicketStatus-label"
                style={{
                  color: theme.palette.text.primary,
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.5px",
                  textTransform: "uppercase",
                  top: 10,
                  left: 14,
                }}
              >
                {i18n.t("settings.settings.options.transferredTicketStatus")}
              </InputLabel>
              <Select
                labelId="transferredTicketStatus-label"
                value={transferredTicketStatus}
                onChange={async (e) => {
                  handleTransferredTicketStatus(e.target.value);
                }}
                style={{ color: theme.palette.text.primary, marginTop: 24 }}
                disableUnderline
              >
                <MenuItem value={"open"}>{i18n.t("settings.settings.options.open")}</MenuItem>
                <MenuItem value={"pending"}>{i18n.t("settings.settings.options.pending")}</MenuItem>
              </Select>
              <FormHelperText style={{ color: theme.palette.text.secondary, fontSize: 10 }}>
                {loadingTransferredTicketStatus && i18n.t("settings.settings.options.updating")}
              </FormHelperText>
            </FormControl>
          </Grid>
        </Grid>
      </div>

      {/* ── Seção: Cadastro de Empresas (apenas super admin) ── */}
      <OnlyForSuperUser
        user={user}
        yes={() => (
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              <div style={{ width: 4, height: 20, background: "#555555", borderRadius: 2 }} />
              <span style={sectionTitleStyle}>{i18n.t("settingsSuite.options.companyRegistration")}</span>
            </div>
            <Grid spacing={2} container>
              <Grid xs={12} sm={6} md={4} item>
                <ToggleSetting
                  label={i18n.t("settingsSuite.options.requireDocument")}
                  value={requireDocument}
                  onChange={handleChangeRequireDocument}
                  loading={loadingRequireDocument}
                />
              </Grid>
            </Grid>
          </div>
        )}
      />

      {/* ── Seção: Notificações Push (apenas super admin) ── */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <div style={{ width: 4, height: 20, background: "#555555", borderRadius: 2 }} />
          <span style={sectionTitleStyle}>{i18n.t("settingsSuite.options.push")}</span>
        </div>
        <Grid spacing={2} container alignItems="center">
          <Grid xs={12} sm={6} md={4} item>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                padding: "10px 14px",
                borderRadius: 10,
                background: "transparent",
                border: pushEnabled
                  ? "1px solid rgba(76,175,80,0.3)"
                  : "1px solid rgba(255,255,255,0.05)",
                minHeight: 74,
                justifyContent: "space-between",
                userSelect: "none",
                cursor: loadingPush ? "not-allowed" : "pointer",
                opacity: loadingPush ? 0.7 : 1,
                transition: "all 0.3s ease",
              }}
              onClick={handleTogglePush}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: theme.palette.text.primary,
                  letterSpacing: "0.5px",
                  textTransform: "uppercase",
                  lineHeight: 1.3,
                }}
              >
                {loadingPush
                  ? "Processando..."
                  : pushEnabled
                    ? "🔔 Push Ativado"
                    : "🔕 Push Desativado"}
              </span>
              <div
                style={{
                  width: 40,
                  height: 22,
                  borderRadius: 11,
                  background: pushEnabled ? "#4caf50" : "#ccc",
                  position: "relative",
                  transition: "background 0.3s ease",
                }}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "#fff",
                    position: "absolute",
                    top: 2,
                    left: pushEnabled ? 20 : 2,
                    transition: "left 0.3s ease",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }}
                />
              </div>
            </div>
          </Grid>
          <Grid xs={12} sm={6} md={8} item>
            <span style={{ fontSize: 12, color: theme.palette.text.secondary }}>
              {i18n.t("settingsSuite.options.pushHelp")}
            </span>
          </Grid>
        </Grid>
      </div>
      <br />

      {/* CONFIGURAÇÃO SIGLA PARA CÓPIA DE CONTATOS */}
      <Grid spacing={3} container style={{ marginBottom: 10 }}>
        <Tabs
          indicatorColor="primary"
          textColor="primary"
          scrollButtons="on"
          variant="scrollable"
          className={classes.tab}
          style={{ marginBottom: 20, marginTop: 20 }}
        >
          <Tab label={i18n.t("settingsSuite.options.copyPrefix")} />
        </Tabs>
        <Grid xs={12} sm={6} md={6} item>
          <FormControl className={classes.selectContainer}>
            <TextField
              id="copyContactPrefix"
              name="copyContactPrefix"
              margin="dense"
              label={i18n.t("settings.settings.options.copyContactPrefix")}
              variant="outlined"
              value={copyContactPrefix}
              placeholder={i18n.t("settings.settings.options.copyContactPrefixPlaceholder")}
              onChange={async (e) => {
                handleCopyContactPrefix(e.target.value);
              }}
              InputLabelProps={{ shrink: true }}
            />
            <FormHelperText>
              {loadingCopyContactPrefix && i18n.t("settings.settings.options.updating")}
            </FormHelperText>
          </FormControl>
        </Grid>
      </Grid>

      {/*-----------------LGPD-----------------*/}
      {enableLGPD === "enabled" && (
        <>
          <Grid spacing={3} container style={{ marginBottom: 10 }}>
            <Tabs
              value={0}
              indicatorColor="primary"
              textColor="primary"
              scrollButtons="on"
              variant="scrollable"
              className={classes.tab}
            >
              <Tab label={i18n.t("settings.settings.LGPD.title")} />
            </Tabs>
          </Grid>
          <Grid spacing={1} container>
            <Grid xs={12} sm={6} md={12} item>
              <FormControl className={classes.selectContainer}>
                <TextField
                  id="lgpdMessage"
                  name="lgpdMessage"
                  margin="dense"
                  multiline
                  rows={3}
                  label={i18n.t("settings.settings.LGPD.welcome")}
                  variant="outlined"
                  value={lgpdMessage}
                  onChange={async (e) => {
                    handleLGPDMessage(e.target.value);
                  }}
                />
                <FormHelperText>
                  {loadinglgpdMessage && i18n.t("settings.settings.options.updating")}
                </FormHelperText>
              </FormControl>
            </Grid>
            <Grid xs={12} sm={6} md={12} item>
              <FormControl className={classes.selectContainer}>
                <TextField
                  id="lgpdLink"
                  name="lgpdLink"
                  margin="dense"
                  label={i18n.t("settings.settings.LGPD.linkLGPD")}
                  variant="outlined"
                  value={lgpdLink}
                  onChange={async (e) => {
                    handleLGPDLink(e.target.value);
                  }}
                />
                <FormHelperText>
                  {loadingLGPDLink && i18n.t("settings.settings.options.updating")}
                </FormHelperText>
              </FormControl>
            </Grid>
            <Grid xs={12} sm={6} md={4} item>
              <FormControl className={classes.selectContainer}>
                <InputLabel id="lgpdDeleteMessage-label">
                  {i18n.t("settings.settings.LGPD.obfuscateMessageDelete")}
                </InputLabel>
                <Select
                  labelId="lgpdDeleteMessage-label"
                  value={lgpdDeleteMessage}
                  onChange={async (e) => {
                    handleLGPDDeleteMessage(e.target.value);
                  }}
                >
                  <MenuItem value={"disabled"}>{i18n.t("settings.settings.LGPD.disabled")}</MenuItem>
                  <MenuItem value={"enabled"}>{i18n.t("settings.settings.LGPD.enabled")}</MenuItem>
                </Select>
                <FormHelperText>
                  {loadingLGPDDeleteMessage && i18n.t("settings.settings.options.updating")}
                </FormHelperText>
              </FormControl>
            </Grid>
            <Grid xs={12} sm={6} md={4} item>
              <FormControl className={classes.selectContainer}>
                <InputLabel id="lgpdConsent-label">
                  {i18n.t("settings.settings.LGPD.alwaysConsent")}
                </InputLabel>
                <Select
                  labelId="lgpdConsent-label"
                  value={lgpdConsent}
                  onChange={async (e) => {
                    handleLGPDConsent(e.target.value);
                  }}
                >
                  <MenuItem value={"disabled"}>{i18n.t("settings.settings.LGPD.disabled")}</MenuItem>
                  <MenuItem value={"enabled"}>{i18n.t("settings.settings.LGPD.enabled")}</MenuItem>
                </Select>
                <FormHelperText>
                  {loadingLGPDConsent && i18n.t("settings.settings.options.updating")}
                </FormHelperText>
              </FormControl>
            </Grid>
            <Grid xs={12} sm={6} md={4} item>
              <FormControl className={classes.selectContainer}>
                <InputLabel id="lgpdHideNumber-label">
                  {i18n.t("settings.settings.LGPD.obfuscatePhoneUser")}
                </InputLabel>
                <Select
                  labelId="lgpdHideNumber-label"
                  value={lgpdHideNumber}
                  onChange={async (e) => {
                    handleLGPDHideNumber(e.target.value);
                  }}
                >
                  <MenuItem value={"disabled"}>{i18n.t("settings.settings.LGPD.disabled")}</MenuItem>
                  <MenuItem value={"enabled"}>{i18n.t("settings.settings.LGPD.enabled")}</MenuItem>
                </Select>
                <FormHelperText>
                  {loadingLGPDHideNumber && i18n.t("settings.settings.options.updating")}
                </FormHelperText>
              </FormControl>
            </Grid>
          </Grid>
        </>
      )}

      <Grid spacing={3} container>
        {isSuper() ? (
          <Tabs
            indicatorColor="primary"
            textColor="primary"
            scrollButtons="on"
            variant="scrollable"
            className={classes.tab}
            style={{ marginBottom: 20, marginTop: 20 }}
          >
            <Tab label={i18n.t("settingsSuite.options.efi")} />
          </Tabs>
        ) : null}
      </Grid>
      <Grid spacing={3} container style={{ marginBottom: 10 }}>
        <Grid xs={12} sm={6} md={6} item>
          {isSuper() ? (
            <FormControl className={classes.selectContainer}>
              <TextField
                id="eficlientid"
                name="eficlientid"
                margin="dense"
                label="Client ID"
                variant="outlined"
                value={eficlientidType}
                onChange={async (e) => {
                  handleChangeEfiClientid(e.target.value);
                }}
              />
              <FormHelperText>
                {loadingEfiClientidType && "Atualizando..."}
              </FormHelperText>
            </FormControl>
          ) : null}
        </Grid>
        <Grid xs={12} sm={6} md={6} item>
          {isSuper() ? (
            <FormControl className={classes.selectContainer}>
              <TextField
                id="eficlientsecret"
                name="eficlientsecret"
                margin="dense"
                label="Client Secret"
                variant="outlined"
                value={eficlientsecretType}
                onChange={async (e) => {
                  handleChangeEfiClientsecret(e.target.value);
                }}
              />
              <FormHelperText>
                {loadingEfiClientsecretType && "Atualizando..."}
              </FormHelperText>
            </FormControl>
          ) : null}
        </Grid>
        <Grid xs={12} sm={12} md={12} item>
          {isSuper() ? (
            <FormControl className={classes.selectContainer}>
              <TextField
                id="efichavepix"
                name="efichavepix"
                margin="dense"
                label="Chave PIX"
                variant="outlined"
                value={efichavepixType}
                onChange={async (e) => {
                  handleChangeEfiChavepix(e.target.value);
                }}
              />
              <FormHelperText>
                {loadingEfiChavepixType && "Atualizando..."}
              </FormHelperText>
            </FormControl>
          ) : null}
        </Grid>

        {/* Campo para upload do certificado Efí */}
        <Grid xs={12} sm={12} md={12} item>
          {isSuper() ? (
            <FormControl className={classes.selectContainer}>
              <input
                accept=".p12"
                id="eficertificado"
                type="file"
                style={{ display: "none" }}
                onChange={handleUploadEfiCertificado}
              />

              <label htmlFor="eficertificado">
                <Button
                  component="span"
                  variant="contained"
                  color="primary"
                  disabled={loadingEfiCertificado}
                >
                  {loadingEfiCertificado ? i18n.t("settingsSuite.common.sending") : i18n.t("settingsSuite.options.sendCertificate")}
                </Button>
              </label>

              <FormHelperText>
                {eficertificadoType
                  ? `Certificado atual: ${eficertificadoType}`
                  : i18n.t("settingsSuite.options.noCertificate")}
              </FormHelperText>
            </FormControl>
          ) : null}
        </Grid>

        {/* Campo para senha do certificado Efí */}
        <Grid xs={12} sm={12} md={12} item>
          {isSuper() ? (
            <FormControl className={classes.selectContainer}>
              <TextField
                id="eficertificadopass"
                name="eficertificadopass"
                margin="dense"
                type="password"
                label={i18n.t("settingsSuite.options.certificatePassword")}
                variant="outlined"
                value={eficertificadopassType}
                onChange={(e) => setEfiCertificadoPassType(e.target.value)}
                onBlur={() => handleChangeEfiCertificadoPass(eficertificadopassType)}
              />
              <FormHelperText>
                {loadingEfiCertificadoPass && "Atualizando..."}
              </FormHelperText>
            </FormControl>
          ) : null}
        </Grid>
      </Grid>

      <Grid spacing={3} container>
        {isSuper() ? (
          <Tabs
            indicatorColor="primary"
            textColor="primary"
            scrollButtons="on"
            variant="scrollable"
            className={classes.tab}
            style={{ marginBottom: 20, marginTop: 20 }}
          >
            <Tab label="Mercado Pago" />
          </Tabs>
        ) : null}
      </Grid>
      <Grid spacing={3} container style={{ marginBottom: 10 }}>
        <Grid xs={12} sm={12} md={12} item>
          {isSuper() ? (
            <FormControl className={classes.selectContainer}>
              <TextField
                id="mpaccesstoken"
                name="mpaccesstoken"
                margin="dense"
                label="Access Token"
                variant="outlined"
                value={mpaccesstokenType}
                onChange={async (e) => {
                  handleChangempaccesstoken(e.target.value);
                }}
              />
              <FormHelperText>
                {loadingmpaccesstokenType && "Atualizando..."}
              </FormHelperText>
            </FormControl>
          ) : null}
        </Grid>
      </Grid>

      <Grid spacing={3} container>
        {isSuper() ? (
          <Tabs
            indicatorColor="primary"
            textColor="primary"
            scrollButtons="on"
            variant="scrollable"
            className={classes.tab}
            style={{ marginBottom: 20, marginTop: 20 }}
          >
            <Tab label="Stripe" />
          </Tabs>
        ) : null}
      </Grid>
      <Grid spacing={3} container style={{ marginBottom: 10 }}>
        <Grid xs={12} sm={12} md={12} item>
          {isSuper() ? (
            <FormControl className={classes.selectContainer}>
              <TextField
                id="stripeprivatekey"
                name="stripeprivatekey"
                margin="dense"
                label="Stripe Private Key"
                variant="outlined"
                value={stripeprivatekeyType}
                onChange={async (e) => {
                  handleChangestripeprivatekey(e.target.value);
                }}
              />
              <FormHelperText>
                {loadingstripeprivatekeyType && "Atualizando..."}
              </FormHelperText>
            </FormControl>
          ) : null}
        </Grid>
      </Grid>

      <Grid spacing={3} container>
        {isSuper() ? (
          <Tabs
            indicatorColor="primary"
            textColor="primary"
            scrollButtons="on"
            variant="scrollable"
            className={classes.tab}
            style={{ marginBottom: 20, marginTop: 20 }}
          >
            <Tab label="ASAAS" />
          </Tabs>
        ) : null}
      </Grid>
      <Grid spacing={3} container style={{ marginBottom: 10 }}>
        <Grid xs={12} sm={12} md={12} item>
          {isSuper() ? (
            <FormControl className={classes.selectContainer}>
              <TextField
                id="asaastoken"
                name="asaastoken"
                margin="dense"
                label="Token Asaas"
                variant="outlined"
                value={asaastokenType}
                onChange={async (e) => {
                  handleChangeasaastoken(e.target.value);
                }}
              />
              <FormHelperText>
                {loadingasaastokenType && "Atualizando..."}
              </FormHelperText>
            </FormControl>
          ) : null}
        </Grid>
      </Grid>

      <Grid spacing={3} container style={{ marginBottom: 10 }}>
        <Grid xs={12} sm={6} md={6} item>
          <FormControl className={classes.selectContainer}>
            <TextField
              id="transferMessage"
              name="transferMessage"
              margin="dense"
              multiline
              rows={3}
              label={i18n.t("settings.settings.customMessages.transferMessage")}
              variant="outlined"
              value={transferMessage}
              required={SettingsTransfTicket === "enabled"}
              onChange={async (e) => {
                handletransferMessage(e.target.value);
              }}
            />
            <FormHelperText>
              {loadingTransferMessage && i18n.t("settings.settings.options.updating")}
            </FormHelperText>
          </FormControl>
        </Grid>
        <Grid xs={12} sm={6} md={6} item>
          <FormControl className={classes.selectContainer}>
            <TextField
              id="greetingAcceptedMessage"
              name="greetingAcceptedMessage"
              margin="dense"
              multiline
              rows={3}
              label={i18n.t("settings.settings.customMessages.greetingAcceptedMessage")}
              variant="outlined"
              value={greetingAcceptedMessage}
              required={SendGreetingAccepted === "enabled"}
              onChange={async (e) => {
                handleGreetingAcceptedMessage(e.target.value);
              }}
            />
            <FormHelperText>
              {loadingGreetingAcceptedMessage && i18n.t("settings.settings.options.updating")}
            </FormHelperText>
          </FormControl>
        </Grid>
        <Grid xs={12} sm={6} md={6} item>
          <FormControl className={classes.selectContainer}>
            <TextField
              id="AcceptCallWhatsappMessage"
              name="AcceptCallWhatsappMessage"
              margin="dense"
              multiline
              rows={3}
              label={i18n.t("settings.settings.customMessages.AcceptCallWhatsappMessage")}
              variant="outlined"
              required={AcceptCallWhatsapp === "disabled"}
              value={AcceptCallWhatsappMessage}
              onChange={async (e) => {
                handleAcceptCallWhatsappMessage(e.target.value);
              }}
            />
            <FormHelperText>
              {loadingAcceptCallWhatsappMessage && i18n.t("settings.settings.options.updating")}
            </FormHelperText>
          </FormControl>
        </Grid>
        <Grid xs={12} sm={6} md={6} item>
          <FormControl className={classes.selectContainer}>
            <TextField
              id="sendQueuePositionMessage"
              name="sendQueuePositionMessage"
              margin="dense"
              multiline
              required={sendQueuePosition === "enabled"}
              rows={3}
              label={i18n.t("settings.settings.customMessages.sendQueuePositionMessage")}
              variant="outlined"
              value={sendQueuePositionMessage}
              onChange={async (e) => {
                handlesendQueuePositionMessage(e.target.value);
              }}
            />
            <FormHelperText>
              {loadingSendQueuePositionMessage && i18n.t("settings.settings.options.updating")}
            </FormHelperText>
          </FormControl>
        </Grid>
      </Grid>
    </>
  );
}
