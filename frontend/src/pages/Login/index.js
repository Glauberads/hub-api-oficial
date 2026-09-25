import React, { useState, useContext, useEffect } from "react";
import "./pwa-mobile.css";
import { Link as RouterLink, useHistory } from "react-router-dom";
import Button from "@material-ui/core/Button";
import CssBaseline from "@material-ui/core/CssBaseline";
import TextField from "@material-ui/core/TextField";
import Typography from "@material-ui/core/Typography";
import { makeStyles } from "@material-ui/core/styles";
import IconButton from "@material-ui/core/IconButton";
import Visibility from "@material-ui/icons/Visibility";
import VisibilityOff from "@material-ui/icons/VisibilityOff";
import WhatsAppIcon from "@material-ui/icons/WhatsApp";
import InputAdornment from "@material-ui/core/InputAdornment";
import CircularProgress from "@material-ui/core/CircularProgress";
import { toast } from "react-toastify";
import { getBackendUrl } from "../../config";
import packageJson from "../../../package.json";

import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";
import ColorModeContext from "../../layout/themeContext";
import useSettings from "../../hooks/useSettings";
import { openApi } from "../../services/api";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  root: {
    width: "100vw",
    height: "100vh",
    display: "flex",
    overflow: "hidden",
    position: "relative",
    background: "linear-gradient(135deg, #f6f8fb 0%, #e5ebf1 100%)",
    [theme.breakpoints.down("md")]: {
      flexDirection: "column"
    }
  },

  leftSide: {
    width: "58%",
    minWidth: 0,
    height: "100%",
    position: "relative",
    display: "flex",
    alignItems: "stretch",
    justifyContent: "center",
    padding: "28px",
    boxSizing: "border-box",
    [theme.breakpoints.down("md")]: {
      width: "100%",
      height: "34%",
      paddingBottom: "14px"
    },
    [theme.breakpoints.down("sm")]: {
      height: "240px",
      padding: "14px"
    }
  },

  bannerShell: {
    width: "100%",
    height: "100%",
    position: "relative",
    borderRadius: "28px",
    overflow: "hidden",
    background: "#ffffff",
    boxShadow: "0 20px 40px rgba(0,0,0,0.06)",
    display: "flex",
    alignItems: "stretch",
    justifyContent: "stretch"
  },

  bannerImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: "center",
    display: "block"
  },

  bannerTitle: {
    fontSize: 42,
    lineHeight: 1.05,
    fontWeight: 800,
    color: "#ffffff",
    letterSpacing: "-0.02em",
    marginBottom: 14,
    textShadow: "0 8px 30px rgba(0,0,0,0.28)",
    [theme.breakpoints.down("lg")]: { fontSize: 34 },
    [theme.breakpoints.down("sm")]: { fontSize: 24 }
  },

  bannerText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 15,
    lineHeight: 1.6,
    maxWidth: 560,
    [theme.breakpoints.down("sm")]: { fontSize: 13 }
  },

  brandChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 14px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.2)",
    border: "1px solid rgba(255,255,255,0.3)",
    color: "#ffffff",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 0.4,
    backdropFilter: "blur(10px)"
  },

  bannerBadge: {
    padding: "9px 12px",
    borderRadius: 12,
    background: "rgba(255,255,255,0.2)",
    border: "1px solid rgba(255,255,255,0.2)",
    color: "#ffffff",
    fontSize: 12,
    fontWeight: 600,
    backdropFilter: "blur(10px)"
  },

  bannerFallback: {
    width: "100%",
    height: "100%",
    position: "relative",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    padding: "40px",
    boxSizing: "border-box",
    background: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
    "& $bannerTitle": { color: "#0f172a", textShadow: "none" },
    "& $bannerText": { color: "#475569" },
    "& $brandChip": { background: "#ffffff", border: "1px solid #cbd5e1", color: "#1e293b" },
    "& $bannerBadge": { background: "#ffffff", border: "1px solid #cbd5e1", color: "#475569" },
    [theme.breakpoints.down("sm")]: { padding: "22px" }
  },

  bannerOverlay: {
    position: "absolute",
    inset: 0,
    background: "linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.45) 100%)",
    zIndex: 1
  },

  bannerContent: {
    position: "absolute",
    inset: 0,
    zIndex: 2,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    padding: "34px",
    boxSizing: "border-box",
    [theme.breakpoints.down("sm")]: { padding: "20px" }
  },

  bannerTopRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16
  },

  bannerBottom: {
    maxWidth: "680px"
  },

  bannerBadges: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 22
  },

  rightSide: {
    width: "42%",
    minWidth: 0,
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "28px",
    boxSizing: "border-box",
    position: "relative",
    [theme.breakpoints.down("md")]: {
      width: "100%",
      height: "66%",
      paddingTop: 0
    },
    [theme.breakpoints.down("sm")]: {
      height: "calc(100% - 240px)",
      padding: "14px"
    }
  },

  formSide: {
    width: "100%",
    maxWidth: "470px",
    minWidth: 0,
    maxHeight: "calc(100vh - 56px)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "#ffffff",
    padding: "34px 30px",
    boxSizing: "border-box",
    overflow: "hidden",
    position: "relative",
    borderRadius: "26px",
    zIndex: 2,
    border: "1px solid #ffffff",
    boxShadow: "0 10px 40px rgba(0,0,0,0.05)",
    [theme.breakpoints.down("sm")]: {
      maxWidth: "100%",
      maxHeight: "100%",
      padding: "26px 20px",
      borderRadius: "22px"
    }
  },

  formGlow: {
    position: "absolute",
    width: 220,
    height: 220,
    top: -90,
    right: -90,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(59,130,246,0.08), transparent 70%)",
    pointerEvents: "none"
  },

  formGlow2: {
    position: "absolute",
    width: 180,
    height: 180,
    bottom: -70,
    left: -60,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(34,197,94,0.06), transparent 70%)",
    pointerEvents: "none"
  },

  formContent: {
    width: "100%",
    maxWidth: "360px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    position: "relative",
    zIndex: 2
  },

  logoWrap: {
    width: "100%",
    display: "flex",
    justifyContent: "center",
    marginBottom: 20
  },

  logoImg: {
    maxWidth: "210px",
    maxHeight: "64px",
    display: "block",
    objectFit: "contain"
  },

  formTitle: {
    width: "100%",
    textAlign: "center",
    fontSize: 28,
    fontWeight: 800,
    color: "#1e293b",
    marginBottom: 6,
    letterSpacing: "-0.02em"
  },

  subtitle: {
    fontSize: "13px",
    color: "#64748b",
    marginBottom: "22px",
    textAlign: "center",
    lineHeight: 1.6
  },

  tabsWrapper: {
    display: "flex",
    backgroundColor: "#f1f5f9",
    borderRadius: "12px",
    padding: "4px",
    width: "100%",
    marginBottom: "20px",
    border: "1px solid #e2e8f0"
  },

  tab: {
    flex: 1,
    padding: "10px 0",
    border: "none",
    background: "transparent",
    borderRadius: "10px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
    color: "#64748b",
    transition: "all 0.2s ease"
  },

  tabActive: {
    background: "#ffffff",
    color: "#0f172a",
    boxShadow: "0 2px 6px rgba(0,0,0,0.05)"
  },

  inputLabel: {
    fontSize: "13px",
    fontWeight: 700,
    color: "#475569",
    marginBottom: "6px",
    display: "block",
    textAlign: "left",
    width: "100%"
  },

  textField: {
    marginBottom: "14px",
    "& .MuiOutlinedInput-root": {
      borderRadius: "10px",
      fontSize: "14px",
      backgroundColor: "#ffffff",
      color: "#1e293b",
      transition: "all 0.2s ease",
      "& fieldset": {
        borderColor: "#cbd5e1"
      },
      "&:hover fieldset": {
        borderColor: "#94a3b8"
      },
      "&.Mui-focused": {
        backgroundColor: "#ffffff"
      },
      "&.Mui-focused fieldset": {
        borderColor: theme.palette.primary.main,
        borderWidth: "1.5px",
        boxShadow: `0 0 0 3px ${theme.palette.primary.main}1A`
      }
    },
    "& .MuiInputBase-input": {
      color: "#1e293b",
      "&::placeholder": {
        color: "#94a3b8",
        opacity: 1
      }
    }
  },

  emailNotConfirmedBox: {
    width: "100%",
    marginBottom: 14,
    padding: "14px",
    borderRadius: "12px",
    background: "#fff7ed",
    border: "1px solid #fdba74",
    boxSizing: "border-box"
  },

  emailNotConfirmedTitle: {
    fontSize: 14,
    fontWeight: 800,
    color: "#9a3412",
    marginBottom: 6
  },

  emailNotConfirmedText: {
    fontSize: 13,
    color: "#7c2d12",
    lineHeight: 1.6,
    marginBottom: 12
  },

  resendButton: {
    width: "100%",
    marginTop: 10,
    borderRadius: "10px",
    textTransform: "none",
    fontWeight: 700
  },

  verifyButton: {
    width: "100%",
    padding: "12px 0",
    borderRadius: "10px",
    fontSize: "14px",
    fontWeight: 800,
    textTransform: "none",
    marginTop: 4
  },

  submitButton: {
    width: "100%",
    padding: "13px 0",
    borderRadius: "10px",
    fontSize: "15px",
    fontWeight: 800,
    textTransform: "none",
    color: "#fff",
    background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${
      theme.palette.primary.dark || theme.palette.primary.main
    })`,
    boxShadow: `0 8px 20px ${theme.palette.primary.main}35`,
    border: "none",
    marginTop: "10px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    "&:hover": {
      opacity: 0.95,
      transform: "translateY(-1px)",
      boxShadow: `0 12px 24px ${theme.palette.primary.main}45`
    }
  },

  forgotPasswordWrap: {
    width: "100%",
    textAlign: "right",
    marginBottom: 12
  },

  forgotPasswordLink: {
    color: theme.palette.primary.main,
    fontSize: 13,
    textDecoration: "none",
    fontWeight: 700,
    "&:hover": {
      textDecoration: "underline"
    }
  },

  supportRow: {
    width: "100%",
    marginTop: 18,
    paddingTop: 16,
    borderTop: "1px solid #f1f5f9",
    display: "flex",
    justifyContent: "center",
    gap: 8,
    flexWrap: "wrap",
    color: "#64748b",
    fontSize: 12
  },

  supportHighlight: {
    color: "#0f172a",
    fontWeight: 700
  },

  footer: {
    marginTop: "22px",
    textAlign: "center",
    fontSize: "12px",
    color: "#94a3b8",
    width: "100%",
    lineHeight: 1.7
  },

  whatsappButton: {
    position: "fixed",
    right: "24px",
    bottom: "24px",
    width: "58px",
    height: "58px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #25D366 0%, #128C7E 100%)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    boxShadow: "0 12px 28px rgba(18, 140, 126, 0.40)",
    zIndex: 30,
    transition: "all 0.2s ease",
    "&:hover": {
      transform: "translateY(-2px) scale(1.03)",
      boxShadow: "0 16px 34px rgba(18, 140, 126, 0.52)"
    },
    [theme.breakpoints.down("sm")]: {
      right: "16px",
      bottom: "16px",
      width: "54px",
      height: "54px"
    }
  },

  whatsappIcon: {
    fontSize: "30px",
    [theme.breakpoints.down("sm")]: {
      fontSize: "28px"
    }
  }
}));

const getLoginAssetVersion = () => {
  const storageKey = "loginAssetVersion";
  const savedVersion = sessionStorage.getItem(storageKey);

  if (savedVersion) {
    return savedVersion;
  }

  const newVersion = String(Date.now());
  sessionStorage.setItem(storageKey, newVersion);

  return newVersion;
};

const Login = () => {
  const classes = useStyles();
  const history = useHistory();
  const { colorMode } = useContext(ColorModeContext);
  const { appName, appLogoDark, appLogoLight, mode } = colorMode;
  const [user, setUser] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [allowSignup, setAllowSignup] = useState(false);
  const { getPublicSetting } = useSettings();
  const { handleLogin } = useContext(AuthContext);
  const [emailNotConfirmed, setEmailNotConfirmed] = useState(false);
  const [resendingCode, setResendingCode] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [verifyingCode, setVerifyingCode] = useState(false);

  const [uploadedBackgroundBannerUrl, setUploadedBackgroundBannerUrl] = useState("");
  const [uploadedLoginBannerUrl, setUploadedLoginBannerUrl] = useState("");
  const [loginBannerExternalUrl, setLoginBannerExternalUrl] = useState("");
  const [loginBannerMode, setLoginBannerMode] = useState("upload");

  const [loginBannerTitle, setLoginBannerTitle] = useState(" ");
  const [loginBannerSubtitle, setLoginBannerSubtitle] = useState(
    i18n.t("publicAccess.banner.defaultSubtitle")
  );
  const [loginBannerBadge1, setLoginBannerBadge1] = useState(i18n.t("publicAccess.banner.badge1"));
  const [loginBannerBadge2, setLoginBannerBadge2] = useState(i18n.t("publicAccess.banner.badge2"));
  const [loginBannerBadge3, setLoginBannerBadge3] = useState(i18n.t("publicAccess.banner.badge3"));

  const [loginLogoUploadUrl, setLoginLogoUploadUrl] = useState("");
  const [loginLogoExternalUrl, setLoginLogoExternalUrl] = useState("");

  const [loginWhatsappNumber, setLoginWhatsappNumber] = useState("5541992098329");
  const [loginShowWhatsappButton, setLoginShowWhatsappButton] = useState(true);

  const [assetVersion] = useState(getLoginAssetVersion);
  const [bannerLoadError, setBannerLoadError] = useState(false);
  const [logoLoadError, setLogoLoadError] = useState(false);

  const getCompanyIdFromUrl = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const companyId = urlParams.get("companyId");
    return companyId ? parseInt(companyId, 10) : null;
  };

  const appendAssetVersion = (value, version) => {
    if (!value || String(value).startsWith("data:")) return value;
    const separator = String(value).includes("?") ? "&" : "?";
    return `${value}${separator}v=${version}`;
  };

  const buildPublicAssetUrl = (value, companyIdFromParam = null) => {
    if (!value) return "";

    if (/^https?:\/\//i.test(value) || value.startsWith("data:")) {
      return String(value).trim();
    }

    let raw = String(value).trim().replace(/\\/g, "/");

    const publicMarker = "/public/";
    const publicIndex = raw.lastIndexOf(publicMarker);

    if (publicIndex !== -1) {
      raw = raw.slice(publicIndex + publicMarker.length);
    }

    raw = raw.replace(/^\/+/, "").replace(/^public\//, "");

    const companyId = companyIdFromParam || getCompanyIdFromUrl() || 1;

    if (!/^company\d+\//i.test(raw)) {
      raw = `company${companyId}/${raw}`;
    }

    return `${getBackendUrl()}/public/${raw}`;
  };

  const sanitizeWhatsappNumber = (value) => {
    if (!value) return "";
    return String(value).replace(/\D/g, "");
  };

  const getErrorMessage = error => {
    return (
      error?.response?.data?.error ||
      error?.response?.data?.message ||
      error?.message ||
      ""
    );
  };

  useEffect(() => {
    let isMounted = true;

    const loadSettings = async () => {
      const companyId = getCompanyIdFromUrl();

      if (isMounted) {
        setBannerLoadError(false);
        setLogoLoadError(false);
      }

      try {
        const data = await getPublicSetting("userCreation", companyId);
        if (isMounted) {
          setAllowSignup(data === "enabled");
        }
      } catch (_) {}

      try {
        const bgKey =
          mode === "light" ? "appLogoBackgroundLight" : "appLogoBackgroundDark";
        const bg = await getPublicSetting(bgKey, companyId);

        if (isMounted) {
          setUploadedBackgroundBannerUrl(bg ? buildPublicAssetUrl(bg, companyId) : "");
        }
      } catch (_) {
        if (isMounted) setUploadedBackgroundBannerUrl("");
      }

      try {
        const value = await getPublicSetting("loginBannerImage", companyId);

        if (isMounted) {
          setUploadedLoginBannerUrl(value ? buildPublicAssetUrl(value, companyId) : "");
        }
      } catch (_) {
        if (isMounted) setUploadedLoginBannerUrl("");
      }

      try {
        const value = await getPublicSetting("loginBannerImageUrl", companyId);
        if (isMounted) {
          setLoginBannerExternalUrl(value ? String(value).trim() : "");
        }
      } catch (_) {
        if (isMounted) setLoginBannerExternalUrl("");
      }

      try {
        const value = await getPublicSetting("loginBannerMode", companyId);
        if (isMounted) {
          setLoginBannerMode(value || "upload");
        }
      } catch (_) {
        if (isMounted) setLoginBannerMode("upload");
      }

      try {
        const value = await getPublicSetting("loginBannerTitle", companyId);
        if (isMounted) {
          setLoginBannerTitle(value || " ");
        }
      } catch (_) {}

      try {
        const value = await getPublicSetting("loginBannerSubtitle", companyId);
        if (isMounted) {
          setLoginBannerSubtitle(
            value ||
              i18n.t("publicAccess.banner.defaultSubtitle")
          );
        }
      } catch (_) {}

      try {
        const value = await getPublicSetting("loginBannerBadge1", companyId);
        if (isMounted) {
          setLoginBannerBadge1(value || i18n.t("publicAccess.banner.badge1"));
        }
      } catch (_) {}

      try {
        const value = await getPublicSetting("loginBannerBadge2", companyId);
        if (isMounted) {
          setLoginBannerBadge2(value || i18n.t("publicAccess.banner.badge2"));
        }
      } catch (_) {}

      try {
        const value = await getPublicSetting("loginBannerBadge3", companyId);
        if (isMounted) {
          setLoginBannerBadge3(value || i18n.t("publicAccess.banner.badge3"));
        }
      } catch (_) {}

      try {
        const value = await getPublicSetting("loginLogo", companyId);
        if (isMounted) {
          setLoginLogoUploadUrl(value ? buildPublicAssetUrl(value, companyId) : "");
        }
      } catch (_) {
        if (isMounted) setLoginLogoUploadUrl("");
      }

      try {
        const value = await getPublicSetting("loginLogoUrl", companyId);
        if (isMounted) {
          setLoginLogoExternalUrl(value ? buildPublicAssetUrl(value, companyId) : "");
        }
      } catch (_) {
        if (isMounted) setLoginLogoExternalUrl("");
      }

      try {
        const value = await getPublicSetting("loginWhatsappNumber", companyId);
        if (isMounted && value) {
          setLoginWhatsappNumber(sanitizeWhatsappNumber(value));
        }
      } catch (_) {}

      try {
        const value = await getPublicSetting("loginShowWhatsappButton", companyId);
        if (!isMounted) return;

        if (value === "disabled" || value === "false" || value === "0") {
          setLoginShowWhatsappButton(false);
          return;
        }

        setLoginShowWhatsappButton(true);
      } catch (_) {
        if (isMounted) setLoginShowWhatsappButton(true);
      }
    };

    loadSettings();

    return () => {
      isMounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const handleChangeInput = (e) => {
    setUser({ ...user, [e.target.name]: e.target.value });

    if (emailNotConfirmed && e.target.name === "email") {
      setEmailNotConfirmed(false);
      setVerificationCode("");
    }
  };

  const handleResendVerificationCode = async () => {
    if (!user.email || !String(user.email).trim()) {
      toast.error(i18n.t("publicAccess.login.emailRequiredResend"));
      return;
    }

    setResendingCode(true);

    try {
      await openApi.post("/auth/resend-verification-code", {
        email: user.email
      });

      toast.success(i18n.t("publicAccess.login.codeResent"));
    } catch (err) {
      toastError(err);
    } finally {
      setResendingCode(false);
    }
  };

  const handleVerifyEmailCode = async () => {
    if (!user.email || !String(user.email).trim()) {
      toast.error(i18n.t("publicAccess.login.emailRequired"));
      return;
    }

    if (!verificationCode || !String(verificationCode).trim()) {
      toast.error(i18n.t("publicAccess.login.codeRequired"));
      return;
    }

    setVerifyingCode(true);

    try {
      await openApi.post("/auth/verify-email", {
        email: user.email,
        code: String(verificationCode).trim()
      });

      toast.success(i18n.t("publicAccess.login.emailConfirmed"));

      setEmailNotConfirmed(false);
      setVerificationCode("");

      await handleLogin(user);
    } catch (err) {
      toastError(err);
    } finally {
      setVerifyingCode(false);
    }
  };

  const handlSubmit = async (e) => {
    e.preventDefault();
    setEmailNotConfirmed(false);

    try {
      await handleLogin(user);
    } catch (err) {
      const errorMessage = getErrorMessage(err);

      if (errorMessage === "ERR_EMAIL_NOT_CONFIRMED") {
        setEmailNotConfirmed(true);
        toast.error(i18n.t("publicAccess.login.emailUnconfirmed"));
        return;
      }

      toastError(err);
    }
  };

  const defaultLogoToShow = appLogoDark || appLogoLight;

  const uploadedBannerUrl = uploadedLoginBannerUrl || uploadedBackgroundBannerUrl;

  const primaryBannerRaw =
    loginBannerMode === "url"
      ? loginBannerExternalUrl || uploadedBannerUrl
      : uploadedBannerUrl || loginBannerExternalUrl;

  const secondaryBannerRaw =
    loginBannerMode === "url"
      ? uploadedBannerUrl
      : loginBannerExternalUrl;

  const bannerUrlToShow =
    bannerLoadError && secondaryBannerRaw && secondaryBannerRaw !== primaryBannerRaw
      ? secondaryBannerRaw
      : primaryBannerRaw;

  const finalBannerUrl = bannerUrlToShow
    ? appendAssetVersion(bannerUrlToShow, assetVersion)
    : "";

  const primaryLogoRaw =
    loginLogoUploadUrl || loginLogoExternalUrl || defaultLogoToShow;

  const fallbackLogoRaw = defaultLogoToShow || "";

  const logoUrlToShow =
    logoLoadError && fallbackLogoRaw && fallbackLogoRaw !== primaryLogoRaw
      ? fallbackLogoRaw
      : primaryLogoRaw;

  const finalLogoToShow = logoUrlToShow
    ? appendAssetVersion(logoUrlToShow, assetVersion)
    : "";

  const finalWhatsappNumber = sanitizeWhatsappNumber(loginWhatsappNumber);

  return (
    <>
      <div className={`${classes.root} public-auth-root`}>
        <CssBaseline />

        <div className={`${classes.leftSide} public-auth-left`}>
          <div className={`${classes.bannerShell} public-auth-banner`}>
            {!!finalBannerUrl ? (
              <>
                <img
                  key={finalBannerUrl}
                  src={finalBannerUrl}
                  alt="banner"
                  className={classes.bannerImage}
                  onError={() => {
                    if (!bannerLoadError && secondaryBannerRaw && secondaryBannerRaw !== primaryBannerRaw) {
                      setBannerLoadError(true);
                      return;
                    }

                    setBannerLoadError(true);
                  }}
                />
                <div className={classes.bannerOverlay} />

                <div className={`${classes.bannerContent} public-auth-banner-content`}>
                  <div className={classes.bannerTopRow}>
                    <div className={classes.brandChip}>
                      {appName || i18n.t("publicAccess.common.product")}
                    </div>
                  </div>

                  <div className={classes.bannerBottom}>
                    <Typography className={`${classes.bannerTitle} public-auth-banner-title`}>
                      {loginBannerTitle}
                    </Typography>

                    <Typography className={`${classes.bannerText} public-auth-banner-text`}>
                      {loginBannerSubtitle}
                    </Typography>

                    <div className={`${classes.bannerBadges} public-auth-banner-badges`}>
                      {!!loginBannerBadge1 && (
                        <div className={classes.bannerBadge}>
                          {loginBannerBadge1}
                        </div>
                      )}
                      {!!loginBannerBadge2 && (
                        <div className={classes.bannerBadge}>
                          {loginBannerBadge2}
                        </div>
                      )}
                      {!!loginBannerBadge3 && (
                        <div className={classes.bannerBadge}>
                          {loginBannerBadge3}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className={`${classes.bannerFallback} public-auth-banner-content`}>
                <div>
                  <div className={classes.brandChip}>
                    {appName || i18n.t("publicAccess.common.product")}
                  </div>
                </div>

                <div>
                  <Typography className={`${classes.bannerTitle} public-auth-banner-title`}>
                    {loginBannerTitle ||
                      i18n.t("publicAccess.banner.fallbackTitle")}
                  </Typography>

                  <Typography className={`${classes.bannerText} public-auth-banner-text`}>
                    {loginBannerSubtitle ||
                      i18n.t("publicAccess.banner.loginFallback")}
                  </Typography>

                  <div className={`${classes.bannerBadges} public-auth-banner-badges`}>
                    {!!loginBannerBadge1 && (
                      <div className={classes.bannerBadge}>
                        {loginBannerBadge1}
                      </div>
                    )}
                    {!!loginBannerBadge2 && (
                      <div className={classes.bannerBadge}>
                        {loginBannerBadge2}
                      </div>
                    )}
                    {!!loginBannerBadge3 && (
                      <div className={classes.bannerBadge}>
                        {loginBannerBadge3}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={`${classes.rightSide} public-auth-right`}>
          <div className={`${classes.formSide} public-auth-card`}>
            <div className={classes.formGlow} />
            <div className={classes.formGlow2} />

            <div className={`${classes.formContent} public-auth-content`}>
              <div className={`${classes.logoWrap} public-auth-logo`}>
                {!!finalLogoToShow && (
                  <img
                    key={finalLogoToShow}
                    className={classes.logoImg}
                    src={finalLogoToShow}
                    alt={appName || i18n.t("publicAccess.common.logo")}
                    onError={() => {
                      if (!logoLoadError && fallbackLogoRaw && fallbackLogoRaw !== primaryLogoRaw) {
                        setLogoLoadError(true);
                        return;
                      }

                      setLogoLoadError(true);
                    }}
                  />
                )}
              </div>

              <Typography className={`${classes.formTitle} public-auth-title`}>
                {i18n.t("publicAccess.login.title")}
              </Typography>

              <Typography className={`${classes.subtitle} public-auth-subtitle`}>
                {i18n.t("publicAccess.login.subtitle")}
              </Typography>

              <div className={`${classes.tabsWrapper} public-auth-tabs`}>
                <button
                  type="button"
                  className={`${classes.tab} ${classes.tabActive}`}
                >
                  {i18n.t("publicAccess.login.tab")}
                </button>

                {allowSignup && (
                  <button
                    type="button"
                    className={classes.tab}
                    onClick={() => history.push("/signup")}
                  >
                    {i18n.t("publicAccess.login.signupTab")}
                  </button>
                )}
              </div>

              {emailNotConfirmed && (
                <div className={classes.emailNotConfirmedBox}>
                  <Typography className={classes.emailNotConfirmedTitle}>
                    {i18n.t("publicAccess.login.unconfirmedTitle")}
                  </Typography>

                  <Typography className={classes.emailNotConfirmedText}>
                    {i18n.t("publicAccess.login.unconfirmedText", { email: user.email })}
                  </Typography>

                  <label className={classes.inputLabel}>{i18n.t("publicAccess.login.codeLabel")}</label>
                  <TextField
                    variant="outlined"
                    fullWidth
                    size="small"
                    placeholder={i18n.t("publicAccess.login.codePlaceholder")}
                    value={verificationCode}
                    onChange={e => setVerificationCode(e.target.value)}
                    className={classes.textField}
                  />

                  <Button
                    variant="contained"
                    color="primary"
                    fullWidth
                    className={classes.verifyButton}
                    onClick={handleVerifyEmailCode}
                    disabled={verifyingCode}
                  >
                    {verifyingCode ? (
                      <CircularProgress size={20} color="inherit" />
                    ) : (
                      i18n.t("publicAccess.login.confirmCode")
                    )}
                  </Button>

                  <Button
                    variant="outlined"
                    color="primary"
                    fullWidth
                    className={classes.resendButton}
                    onClick={handleResendVerificationCode}
                    disabled={resendingCode || verifyingCode}
                  >
                    {resendingCode ? i18n.t("publicAccess.login.resending") : i18n.t("publicAccess.login.resendCode")}
                  </Button>
                </div>
              )}

              <form noValidate onSubmit={handlSubmit} style={{ width: "100%" }}>
                <label className={classes.inputLabel}>
                  {i18n.t("publicAccess.login.email")}
                </label>

                <TextField
                  variant="outlined"
                  required
                  fullWidth
                  id="email"
                  placeholder={i18n.t("publicAccess.login.emailPlaceholder")}
                  name="email"
                  value={user.email}
                  onChange={handleChangeInput}
                  autoComplete="email"
                  autoFocus
                  size="small"
                  className={classes.textField}
                />

                <label className={classes.inputLabel}>
                  {i18n.t("publicAccess.login.password")}
                </label>

                <TextField
                  variant="outlined"
                  required
                  fullWidth
                  name="password"
                  placeholder={i18n.t("publicAccess.login.passwordPlaceholder")}
                  type={showPassword ? "text" : "password"}
                  id="password"
                  value={user.password}
                  onChange={handleChangeInput}
                  autoComplete="current-password"
                  size="small"
                  className={classes.textField}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword((s) => !s)}
                          edge="end"
                          size="small"
                          style={{ color: "#9ca3af" }}
                        >
                          {showPassword ? (
                            <VisibilityOff fontSize="small" />
                          ) : (
                            <Visibility fontSize="small" />
                          )}
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />

                <div className={classes.forgotPasswordWrap}>
                  <RouterLink
                    to="/forgot-password"
                    className={classes.forgotPasswordLink}
                  >
                    {i18n.t("publicAccess.login.forgot")}
                  </RouterLink>
                </div>

                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  color="primary"
                  className={classes.submitButton}
                >
                  {i18n.t("publicAccess.login.submit")}
                </Button>
              </form>

              <div className={`${classes.supportRow} public-auth-support`}>
                <span>{i18n.t("publicAccess.login.secure")}</span>
                <span>•</span>
                <span className={classes.supportHighlight}>
                  {appName || i18n.t("publicAccess.common.system")}
                </span>
                <span>•</span>
                <span>{i18n.t("publicAccess.login.support")}</span>
              </div>

              <div className={`${classes.footer} public-auth-footer`}>
                © {new Date().getFullYear()} {appName || i18n.t("publicAccess.common.system")}. {i18n.t("publicAccess.common.rights")}
                <br />
              </div>
            </div>
          </div>
        </div>

        {loginShowWhatsappButton && !!finalWhatsappNumber && (
          <a
            href={`https://wa.me/${finalWhatsappNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`${classes.whatsappButton} public-auth-whatsapp`}
            aria-label={i18n.t("publicAccess.login.whatsappAria")}
            title={i18n.t("publicAccess.login.whatsappTitle")}
          >
            <WhatsAppIcon className={classes.whatsappIcon} />
          </a>
        )}
      </div>
    </>
  );
};

export default Login;
