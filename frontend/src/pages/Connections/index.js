import TelegramIcon from "../../components/TelegramIcon";
import React, {
  useState,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from "react";
import { toast } from "react-toastify";
import { add, format, parseISO } from "date-fns";

import Menu from "@material-ui/core/Menu";
import MenuItem from "@material-ui/core/MenuItem";
import PopupState, { bindTrigger, bindMenu } from "material-ui-popup-state";
// import { SocketContext } from "../../context/Socket/SocketContext";
import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import {
  Button,
  TableBody,
  TableRow,
  TableCell,
  IconButton,
  Table,
  TableHead,
  Paper,
  Tooltip,
  Typography,
  CircularProgress,
  Box,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem as MuiMenuItem,
  FormControl,
  InputLabel,
  Switch,
  Chip,
  Grid,
} from "@material-ui/core";
import {
  Edit,
  CheckCircle,
  SignalCellularConnectedNoInternet2Bar,
  SignalCellularConnectedNoInternet0Bar,
  SignalCellular4Bar,
  CropFree,
  DeleteOutline,
  Facebook,
  Instagram,
  WhatsApp,
  Sync,
} from "@material-ui/icons";
import WebhookIcon from "@mui/icons-material/Webhook";
import SubjectIcon from "@material-ui/icons/Subject";
import HealingIcon from "@material-ui/icons/Healing";
import FacebookLogin from "react-facebook-login/dist/facebook-login-render-props";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";
import TableRowSkeleton from "../../components/TableRowSkeleton";

import api from "../../services/api";
import useSettings from "../../hooks/useSettings";
import WhatsAppModal from "../../components/WhatsAppModal";
import OfficialEmbeddedSignupModal from "../../components/OfficialEmbeddedSignupModal";
import OfficialOnboardingLogsModal from "../../components/OfficialOnboardingLogsModal";
import OfficialConnectionDiagnosticsModal from "../../components/OfficialConnectionDiagnosticsModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import QrcodeModal from "../../components/QrcodeModal";
import PairingCodeModal from "../../components/PairingCodeModal";
import { i18n } from "../../translate/i18n";

import { WhatsAppsContext } from "../../context/WhatsApp/WhatsAppsContext";
import toastError from "../../errors/toastError";
import formatSerializedId from "../../utils/formatSerializedId";
import { AuthContext } from "../../context/Auth/AuthContext";
import usePlans from "../../hooks/usePlans";
import { useHistory } from "react-router-dom/cjs/react-router-dom.min";
import ForbiddenPage from "../../components/ForbiddenPage";
import { Can } from "../../components/Can";

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.padding,
    overflowY: "scroll",
    ...theme.scrollbarStyles,
    background: "transparent",
    border: "none",
  },
  customTableCell: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  tooltip: {
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(30,30,40,0.95)"
        : "#fff",
    color: theme.palette.text.primary,
    fontSize: theme.typography.pxToRem(13),
    border: `1px solid ${theme.palette.divider}`,
    maxWidth: 450,
    borderRadius: 10,
    boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
    padding: "8px 12px",
  },
  tooltipPopper: {
    textAlign: "center",
  },
  buttonProgress: {
    color: "#25d366",
  },
  connectionCard: {
    borderRadius: 16,
    border: `1px solid ${
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.08)"
        : "rgba(0,0,0,0.06)"
    }`,
    overflow: "hidden",
    transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
    background:
      theme.palette.type === "dark"
        ? "linear-gradient(145deg, rgba(30,30,45,0.9), rgba(20,20,35,0.95))"
        : "linear-gradient(145deg, #ffffff, #fafbfc)",
    "&:hover": {
      transform: "translateY(-2px)",
      boxShadow:
        theme.palette.type === "dark"
          ? "0 12px 40px rgba(0,0,0,0.4)"
          : "0 12px 40px rgba(0,0,0,0.1)",
      borderColor:
        theme.palette.type === "dark"
          ? "rgba(255,255,255,0.12)"
          : "rgba(0,0,0,0.1)",
    },
  },
  cardHeader: {
    padding: "16px 20px 12px",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  cardHeaderLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  channelIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background:
      theme.palette.type === "dark"
        ? "rgba(37,211,102,0.12)"
        : "rgba(37,211,102,0.08)",
    flexShrink: 0,
  },
  cardName: {
    fontWeight: 700,
    fontSize: 15,
    letterSpacing: "-0.01em",
    color: theme.palette.text.primary,
  },
  cardNumber: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    marginTop: 1,
  },
  officialBadge: {
    background: "linear-gradient(135deg, #25d366, #128c7e)",
    color: "#fff",
    fontSize: 10,
    fontWeight: 700,
    height: 22,
    borderRadius: 6,
    letterSpacing: "0.5px",
  },
  normalBadge: {
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.08)"
        : "#f0f0f0",
    color: theme.palette.type === "dark" ? "#aaa" : "#666",
    fontSize: 10,
    fontWeight: 600,
    height: 22,
    borderRadius: 6,
  },
  pairingBadge: {
    background: "linear-gradient(135deg, #7c3aed, #5b21b6)",
    color: "#fff",
    fontSize: 10,
    fontWeight: 700,
    height: 22,
    borderRadius: 6,
  },
  qrBadge: {
    background: "linear-gradient(135deg, #0ea5e9, #0284c7)",
    color: "#fff",
    fontSize: 10,
    fontWeight: 700,
    height: 22,
    borderRadius: 6,
  },
  cardBody: {
    padding: "0 20px 16px",
  },
  statusRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    padding: "8px 12px",
    borderRadius: 10,
    background:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.03)"
        : "rgba(0,0,0,0.02)",
  },
  statsRow: {
    display: "flex",
    gap: 10,
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    borderRadius: 12,
    padding: "12px 14px",
    textAlign: "center",
    background:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.04)"
        : "linear-gradient(135deg, #f8f9fb, #f1f3f5)",
    border: `1px solid ${
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.06)"
        : "rgba(0,0,0,0.04)"
    }`,
    transition: "all 0.2s ease",
    "&:hover": {
      background:
        theme.palette.type === "dark"
          ? "rgba(255,255,255,0.06)"
          : "linear-gradient(135deg, #f1f3f5, #e8ecf0)",
    },
  },
  statValue: {
    fontWeight: 800,
    fontSize: 22,
    color: theme.palette.text.primary,
    lineHeight: 1.2,
  },
  statLabel: {
    fontSize: 10,
    color: theme.palette.text.secondary,
    textTransform: "uppercase",
    fontWeight: 600,
    letterSpacing: "0.5px",
    marginTop: 2,
  },
  limitBox: {
    background:
      theme.palette.type === "dark"
        ? "linear-gradient(135deg, rgba(230,81,0,0.1), rgba(255,152,0,0.08))"
        : "linear-gradient(135deg, #fff8e1, #fff3e0)",
    borderRadius: 10,
    padding: "8px 14px",
    marginBottom: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    border: `1px solid ${
      theme.palette.type === "dark"
        ? "rgba(255,152,0,0.2)"
        : "rgba(230,81,0,0.12)"
    }`,
  },
  limitLabel: {
    fontSize: 11,
    color: theme.palette.type === "dark" ? "#ffb74d" : "#e65100",
    fontWeight: 500,
  },
  limitValue: {
    fontSize: 13,
    fontWeight: 700,
    color: theme.palette.type === "dark" ? "#ffb74d" : "#e65100",
  },
  cardFooter: {
    padding: "10px 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderTop: `1px solid ${
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.06)"
        : "rgba(0,0,0,0.05)"
    }`,
    background:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.02)"
        : "rgba(0,0,0,0.01)",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    display: "inline-block",
    marginRight: 8,
    boxShadow: "0 0 6px currentColor",
  },
  statusText: {
    fontSize: 12,
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    textTransform: "uppercase",
    letterSpacing: "0.3px",
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 4,
    display: "inline-block",
    marginLeft: 8,
    border: `2px solid ${
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.1)"
        : "rgba(0,0,0,0.08)"
    }`,
  },
  lastUpdate: {
    fontSize: 11,
    color: theme.palette.text.secondary,
    fontWeight: 500,
  },
  actionButton: {
    borderRadius: 8,
    textTransform: "none",
    fontWeight: 600,
    fontSize: 12,
    padding: "5px 14px",
    letterSpacing: "0.2px",
  },
  disconnectButton: {
    borderRadius: 8,
    textTransform: "none",
    fontWeight: 600,
    fontSize: 12,
    padding: "5px 14px",
    color: "#ef4444",
    borderColor: "#ef4444",
    "&:hover": {
      backgroundColor: "rgba(239,68,68,0.08)",
      borderColor: "#dc2626",
    },
  },
  footerIconButton: {
    borderRadius: 8,
    padding: 6,
    transition: "all 0.2s ease",
    "&:hover": {
      backgroundColor:
        theme.palette.type === "dark"
          ? "rgba(255,255,255,0.08)"
          : "rgba(0,0,0,0.06)",
    },
  },
  modernDialog: {
    "& .MuiDialog-paper": {
      borderRadius: 16,
      overflow: "hidden",
    },
  },
  modernDialogTitle: {
    fontWeight: 700,
    fontSize: 18,
    padding: "20px 24px 12px",
  },
  modernDialogContent: {
    padding: "8px 24px 20px",
  },
  modernDialogActions: {
    padding: "12px 24px 20px",
    gap: 8,
  },
  modernCancelButton: {
    borderRadius: 10,
    textTransform: "none",
    fontWeight: 600,
    padding: "8px 20px",
  },
  modernConfirmButton: {
    borderRadius: 10,
    textTransform: "none",
    fontWeight: 600,
    padding: "8px 20px",
    background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
    color: "#fff",
    boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
    "&:hover": {
      boxShadow: "0 6px 20px rgba(0,0,0,0.2)",
    },
  },
}));

function CircularProgressWithLabel(props) {

return (
    <Box position="relative" display="inline-flex">
      <CircularProgress variant="determinate" {...props} />
      <Box
        top={0}
        left={0}
        bottom={0}
        right={0}
        position="absolute"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Typography
          variant="caption"
          component="div"
          color="textSecondary"
        >{`${Math.round(props.value)}%`}</Typography>
      </Box>
    </Box>
  );
}

const CustomToolTip = ({ title, content, children }) => {
  const classes = useStyles();

  return (
    <Tooltip
      arrow
      classes={{
        tooltip: classes.tooltip,
        popper: classes.tooltipPopper,
      }}
      title={
        <React.Fragment>
          <Typography gutterBottom color="inherit">
            {title}
          </Typography>
          {content && <Typography>{content}</Typography>}
        </React.Fragment>
      }
    >
      {children}
    </Tooltip>
  );
};

const IconChannel = (channel) => {
  switch (channel) {
    case "facebook":
      return <Facebook style={{ color: "#3b5998" }} />;
    case "instagram":
      return <Instagram style={{ color: "#e1306c" }} />;
    case "whatsapp":
      return <WhatsApp style={{ color: "#25d366" }} />;
    case "whatsapp_oficial":
      return <WhatsApp style={{ color: "#25d366" }} />;
    case "telegram":
      return <TelegramIcon size={28} />;
    default:
      return "error";
  }
};

const normalizeMetaVersion = (value) => {
  const raw = String(value || "").trim();

  if (!raw) return "20.0";

  const cleaned = raw.replace(/^v/i, "");

  if (!/^\d+\.\d+$/.test(cleaned)) {
    return "20.0";
  }

  const majorVersion = parseInt(cleaned.split(".")[0], 10);

  if (majorVersion >= 20 && majorVersion <= 25) {
    return cleaned;
  }

  return "20.0";
};

const Connections = () => {
  const classes = useStyles();
  const { whatsApps, loading, refetch } = useContext(WhatsAppsContext);
  const [pairingConnections, setPairingConnections] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("pairingCodeConnections") || "[]"
      );
    } catch (_) {
      return [];
    }
  });
  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);
  const [officialEmbeddedSignupModalOpen, setOfficialEmbeddedSignupModalOpen] =
    useState(false);
  const [officialLogsModalOpen, setOfficialLogsModalOpen] = useState(false);
  const [selectedOfficialLogConnection, setSelectedOfficialLogConnection] =
    useState(null);
  const [officialDiagnosticsModalOpen, setOfficialDiagnosticsModalOpen] =
    useState(false);
  const [selectedOfficialDiagnosticsConnection, setSelectedOfficialDiagnosticsConnection] =
    useState(null);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [pairingCodeModalOpen, setPairingCodeModalOpen] = useState(false);
  const [selectedWhatsApp, setSelectedWhatsApp] = useState(null);
  const [channel, setChannel] = useState("whatsapp");
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const history = useHistory();
  const confirmationModalInitialState = {
    action: "",
    title: "",
    message: "",
    whatsAppId: "",
    open: false,
  };
  const [confirmModalInfo, setConfirmModalInfo] = useState(
    confirmationModalInitialState
  );
  const [planConfig, setPlanConfig] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [sourceConnection, setSourceConnection] = useState("");
  const [targetConnection, setTargetConnection] = useState("");
  const [preDeleteModalOpen, setPreDeleteModalOpen] = useState(false);
  const [whatsAppToDelete, setWhatsAppToDelete] = useState(null);
  const [transferProgressModalOpen, setTransferProgressModalOpen] =
    useState(false);
  const [transferProgress, setTransferProgress] = useState({
    current: 0,
    total: 0,
    percentage: 0,
  });
  const [metaConfig, setMetaConfig] = useState({
    appId: "",
    sdkVersion: "20.0",
    requireBusinessManagement: true,
    loading: true,
  });
  const facebookRenderPropsRef = useRef(null);
  const instagramRenderPropsRef = useRef(null);
  const [metaSdkReady, setMetaSdkReady] = useState(false);
  const [facebookProcessing, setFacebookProcessing] = useState(false);
  const [instagramProcessing, setInstagramProcessing] = useState(false);
  const { user, socket } = useContext(AuthContext);
  const companyId = user.companyId;
  const { getPlanCompany } = usePlans();
  const { getAll: getAllSettings, get: getSetting } = useSettings();
  const [supportNumber, setSupportNumber] = useState(
    process.env.REACT_APP_NUMBER_SUPPORT || ""
  );

  useEffect(() => {
    let isMounted = true;

    async function loadInitialData() {
      try {
        const [settings, planConfigs] = await Promise.all([
          getAllSettings(),
          getPlanCompany(undefined, companyId),
        ]);

        if (!isMounted) return;

        setPlanConfig(planConfigs);

        if (Array.isArray(settings)) {
          const getValue = (key, fallback = "") => {
            const found = settings.find((item) => item.key === key);
            return found?.value ?? fallback;
          };

          const support = getValue("supportNumber", "");
          if (support) {
            setSupportNumber(support);
          } else {
            try {
              const globalSetting = await getSetting("supportNumber");
              if (isMounted && globalSetting?.value) {
                setSupportNumber(globalSetting.value);
              }
            } catch (_) {}
          }

          const version = normalizeMetaVersion(
            getValue("metaSdkVersion", "20.0")
          );
          console.log("[META] Versão normalizada:", version);

          setMetaConfig({
            appId: getValue("metaAppId", ""),
            sdkVersion: version,
            requireBusinessManagement:
              String(
                getValue("metaRequireBusinessManagement", "true")
              ).toLowerCase() === "true",
            loading: false,
          });
        } else {
          setMetaConfig((prev) => ({
            ...prev,
            sdkVersion: "20.0",
            loading: false,
          }));
        }
      } catch (error) {
        if (!isMounted) return;

        setMetaConfig((prev) => ({
          ...prev,
          sdkVersion: "20.0",
          loading: false,
        }));
      }
    }

    loadInitialData();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  useEffect(() => {
    if (!metaConfig.appId || metaConfig.loading) {
      setMetaSdkReady(false);
      return;
    }

    const checkSdkLoaded = () => {
      const isFbLoaded = typeof window !== "undefined" && window.FB;
      const hasFacebookProps = !!facebookRenderPropsRef.current;
      const hasInstagramProps = !!instagramRenderPropsRef.current;

      if (isFbLoaded && hasFacebookProps && hasInstagramProps) {
        console.log("[META] SDK carregado com sucesso!");
        setMetaSdkReady(true);
        return true;
      }
      return false;
    };

    if (checkSdkLoaded()) {
      return;
    }

    let attempts = 0;
    const maxAttempts = 60;
    const interval = setInterval(() => {
      attempts++;

      if (checkSdkLoaded()) {
        clearInterval(interval);
        return;
      }

      if (attempts >= maxAttempts) {
        console.warn("[META] Timeout no carregamento do SDK após 30 segundos");
        clearInterval(interval);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [metaConfig.appId, metaConfig.loading]);

  const handleMetaResponse = async (response, addInstagram = false) => {
    if (addInstagram) {
      setInstagramProcessing(false);
    } else {
      setFacebookProcessing(false);
    }

    if (
      !response ||
      response.status === "unknown" ||
      !response.accessToken ||
      !response.id
    ) {
      toast.warn(i18n.t("connectionSuite.list.metaLoginCancelled"));
      return;
    }

    const { accessToken, id } = response;

    try {
      await api.post("/facebook", {
        addInstagram,
        facebookUserId: id,
        facebookUserToken: accessToken,
      });

      toast.success(i18n.t("i18nFix.facebookConnectionSuccess"));

      if (refetch) {
        setTimeout(() => refetch(), 800);
      }
    } catch (error) {
      toastError(error);
    }
  };

  const responseFacebook = (response) => {
    handleMetaResponse(response, false);
  };

  const responseInstagram = (response) => {
    handleMetaResponse(response, true);
  };

  const handleMetaLoginClick = (event, type, popupState) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    if (!metaConfig.appId) {
      toast.error(i18n.t("connectionSuite.list.metaAppIdMissing"));
      return;
    }

    if (metaConfig.loading) {
      toast.warn(i18n.t("connectionSuite.list.metaSettingsLoading"));
      return;
    }

    const renderProps =
      type === "instagram"
        ? instagramRenderPropsRef.current
        : facebookRenderPropsRef.current;

    if (!renderProps) {
      toast.warn(
        i18n.t("connectionSuite.list.metaStarting")
      );
      return;
    }

    if (renderProps?.isProcessing || renderProps?.isDisabled) {
      return;
    }

    if (!metaSdkReady) {
      toast.warn(
        i18n.t("connectionSuite.list.metaSdkLoading")
      );
      return;
    }

    if (typeof window === "undefined" || !window.FB) {
      toast.warn(i18n.t("connectionSuite.list.metaSdkUnavailable"));
      return;
    }

    if (type === "instagram") {
      setInstagramProcessing(true);
    } else {
      setFacebookProcessing(true);
    }

    renderProps.onClick(event);

    if (popupState?.close) {
      popupState.close();
    }
  };

  useEffect(() => {}, [whatsApps]);

  const handleStartWhatsAppSession = async (whatsAppId) => {
    try {
      await api.post(`/whatsappsession/${whatsAppId}`);
    } catch (err) {
      toastError(err);
    }
  };

  const handleRequestNewQrCode = async (whatsAppId) => {
    try {
      await api.put(`/whatsappsession/${whatsAppId}`);
    } catch (err) {
      toastError(err);
    }
  };

  const handleOpenWhatsAppModal = (channel) => {
    setChannel(channel);
    setSelectedWhatsApp(null);
    setWhatsAppModalOpen(true);
  };

  const handleCloseWhatsAppModal = useCallback(() => {
    setWhatsAppModalOpen(false);
    setSelectedWhatsApp(null);
    if (refetch) {
      setTimeout(() => refetch(), 500);
    }
  }, [setSelectedWhatsApp, setWhatsAppModalOpen, refetch]);

  const handleOpenOfficialEmbeddedSignupModal = useCallback(() => {
    setSelectedWhatsApp(null);
    setOfficialEmbeddedSignupModalOpen(true);
  }, []);

  const handleCloseOfficialEmbeddedSignupModal = useCallback(() => {
    setOfficialEmbeddedSignupModalOpen(false);
    if (refetch) {
      setTimeout(() => refetch(), 500);
    }
  }, [refetch]);

  const handleOfficialEmbeddedSignupSaved = useCallback(() => {
    setOfficialEmbeddedSignupModalOpen(false);
    if (refetch) {
      setTimeout(() => refetch(), 800);
    }
  }, [refetch]);

  const handleOpenOfficialLogsModal = useCallback((whatsApp) => {
    setSelectedOfficialLogConnection(whatsApp);
    setOfficialLogsModalOpen(true);
  }, []);

  const handleCloseOfficialLogsModal = useCallback(() => {
    setOfficialLogsModalOpen(false);
    setSelectedOfficialLogConnection(null);
  }, []);

  const handleOpenOfficialDiagnosticsModal = useCallback((whatsApp) => {
    setSelectedOfficialDiagnosticsConnection(whatsApp);
    setOfficialDiagnosticsModalOpen(true);
  }, []);

  const handleCloseOfficialDiagnosticsModal = useCallback(() => {
    setOfficialDiagnosticsModalOpen(false);
    setSelectedOfficialDiagnosticsConnection(null);
  }, []);

  const handleOpenQrModal = (whatsApp) => {
    setSelectedWhatsApp(whatsApp);
    setQrModalOpen(true);
  };

  const handleCloseQrModal = useCallback(() => {
    setSelectedWhatsApp(null);
    setQrModalOpen(false);
  }, [setQrModalOpen, setSelectedWhatsApp]);

  const handleOpenPairingCodeModal = (whatsApp) => {
    setSelectedWhatsApp(whatsApp);
    setPairingCodeModalOpen(true);
  };

  const handleClosePairingCodeModal = useCallback(() => {
    setSelectedWhatsApp(null);
    setPairingCodeModalOpen(false);
  }, []);

  const handleEditWhatsApp = (whatsApp) => {
    setChannel(whatsApp.channel);
    setSelectedWhatsApp(whatsApp);
    setWhatsAppModalOpen(true);
  };

  const handleSyncTemplates = async (whatsAppId) => {
    await api.get(`/whatsapp/sync-templates/${whatsAppId}`);
  };

  const handleToggleReceiveComments = async (whatsApp) => {
    try {
      const newValue = !whatsApp.receiveComments;
      await api.put(`/whatsapp/${whatsApp.id}`, {
        receiveComments: newValue,
      });
      toast.success(
        newValue
          ? i18n.t("connections.receiveComments.enabled")
          : i18n.t("connections.receiveComments.disabled")
      );
    } catch (err) {
      toastError(err);
    }
  };

  const handleCopyWebhook = (url) => {
    navigator.clipboard.writeText(url);
  };

  const openInNewTab = (url) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleOpenConfirmationModal = (action, whatsAppId) => {
    if (action === "disconnect") {
      setConfirmModalInfo({
        action: action,
        title: i18n.t("connections.confirmationModal.disconnectTitle"),
        message: i18n.t("connections.confirmationModal.disconnectMessage"),
        whatsAppId: whatsAppId,
      });
    }

    if (action === "delete") {
      setConfirmModalInfo({
        action: action,
        title: i18n.t("connections.confirmationModal.deleteTitle"),
        message: i18n.t("connections.confirmationModal.deleteMessage"),
        whatsAppId: whatsAppId,
      });
    }

    setConfirmModalOpen(true);
  };

  const handleSubmitConfirmationModal = async () => {
    if (confirmModalInfo.action === "disconnect") {
      try {
        await api.delete(`/whatsappsession/${confirmModalInfo.whatsAppId}`);
      } catch (err) {
        toastError(err);
      }
    }

    if (confirmModalInfo.action === "delete") {
      try {
        await api.delete(`/whatsapp/${confirmModalInfo.whatsAppId}`);
        toast.success(i18n.t("connections.toasts.deleted"));
      } catch (err) {
        toastError(err);
      }
    }

    setConfirmModalInfo(confirmationModalInitialState);
  };

  const renderActionButtons = (whatsApp) => {
    return (
      <Box display="flex" flexWrap="wrap" style={{ gap: 6 }}>
        {whatsApp.channel === "whatsapp" && whatsApp.status === "qrcode" && (
          <Can
            role={
              user.profile === "user" && user.allowConnections === "enabled"
                ? "admin"
                : user.profile
            }
            perform="connections-page:addConnection"
            yes={() => (
              <>
                <Button
                  size="small"
                  variant="contained"
                  color="primary"
                  className={classes.actionButton}
                  onClick={() => handleOpenQrModal(whatsApp)}
                >
                  {i18n.t("connections.buttons.qrcode")}
                </Button>
              </>
            )}
          />
        )}
        {whatsApp.channel === "whatsapp" &&
          (whatsApp.status === "DISCONNECTED" ||
            whatsApp.status === "PENDING") && (
            <Can
              role={
                user.profile === "user" && user.allowConnections === "enabled"
                  ? "admin"
                  : user.profile
              }
              perform="connections-page:addConnection"
              yes={() => (
                <>
                  <Button
                    size="small"
                    variant="outlined"
                    color="primary"
                    className={classes.actionButton}
                    onClick={() => handleStartWhatsAppSession(whatsApp.id)}
                  >
                    {i18n.t("connections.buttons.tryAgain")}
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="secondary"
                    className={classes.actionButton}
                    onClick={() => handleRequestNewQrCode(whatsApp.id)}
                  >
                    {i18n.t("connections.buttons.newQr")}
                  </Button>
                </>
              )}
            />
          )}
        {whatsApp.channel === "whatsapp" &&
          (whatsApp.status === "CONNECTED" ||
            whatsApp.status === "PAIRING" ||
            whatsApp.status === "TIMEOUT") && (
            <Can
              role={user.profile}
              perform="connections-page:addConnection"
              yes={() => (
                <>
                  <Button
                    size="small"
                    variant="outlined"
                    className={classes.disconnectButton}
                    onClick={() => {
                      handleOpenConfirmationModal("disconnect", whatsApp.id);
                    }}
                  >
                    {i18n.t("connections.buttons.disconnect")}
                  </Button>
                </>
              )}
            />
          )}
        {whatsApp.channel === "whatsapp" && whatsApp.status === "OPENING" && (
          <Button
            size="small"
            variant="outlined"
            disabled
            className={classes.actionButton}
          >
            {i18n.t("connections.buttons.connecting")}
          </Button>
        )}
      </Box>
    );
  };

  const renderStatusToolTips = (whatsApp) => {
    return (
      <div className={classes.customTableCell}>
        {(whatsApp.status === "DISCONNECTED" ||
          whatsApp.status === "PENDING") && (
          <CustomToolTip
            title={i18n.t("connections.toolTips.disconnected.title")}
            content={i18n.t("connections.toolTips.disconnected.content")}
          >
            <SignalCellularConnectedNoInternet0Bar color="secondary" />
          </CustomToolTip>
        )}
        {whatsApp.status === "OPENING" && (
          <CircularProgress size={24} className={classes.buttonProgress} />
        )}
        {whatsApp.status === "qrcode" && (
          <CustomToolTip
            title={i18n.t("connections.toolTips.qrcode.title")}
            content={i18n.t("connections.toolTips.qrcode.content")}
          >
            <CropFree />
          </CustomToolTip>
        )}
        {whatsApp.status === "CONNECTED" && (
          <CustomToolTip
            title={i18n.t("connections.toolTips.connected.title")}
          >
            <SignalCellular4Bar style={{ color: green[500] }} />
          </CustomToolTip>
        )}
        {(whatsApp.status === "TIMEOUT" || whatsApp.status === "PAIRING") && (
          <CustomToolTip
            title={i18n.t("connections.toolTips.timeout.title")}
            content={i18n.t("connections.toolTips.timeout.content")}
          >
            <SignalCellularConnectedNoInternet2Bar color="secondary" />
          </CustomToolTip>
        )}
      </div>
    );
  };

  const restartWhatsapps = async () => {
    try {
      await api.post(`/whatsapp-restart/`);
      toast.success(i18n.t("connections.waitConnection"));
    } catch (err) {
      toastError(err);
    }
  };

  const handleOpenTransferModal = () => {
    setTransferModalOpen(true);
  };

  const handleCloseTransferModal = () => {
    setTransferModalOpen(false);
    setSourceConnection("");
    setTargetConnection("");
  };

  const handleCloseTransferProgressModal = () => {
    setTransferProgressModalOpen(false);
    setTransferProgress({ current: 0, total: 0, percentage: 0 });
  };

  const handleTransferTickets = async () => {
    if (!sourceConnection || !targetConnection) {
      toast.error(i18n.t("connectionSuite.list.selectConnections"));
      return;
    }

    if (sourceConnection === targetConnection) {
      toast.error(i18n.t("connectionSuite.list.differentConnections"));
      return;
    }

    try {
      const response = await api.post(`/transfer-tickets`, {
        sourceConnectionId: sourceConnection,
        targetConnectionId: targetConnection,
      });

      if (response.data.requiresProgress) {
        setTransferModalOpen(false);
        setTransferProgressModalOpen(true);
        setTransferProgress({
          current: 0,
          total: response.data.totalTickets,
          percentage: 0,
        });
      } else {
        toast.success(
          `Tickets transferidos com sucesso! ${
            response.data.transferred || 0
          } tickets transferidos.`
        );
        handleCloseTransferModal();
      }
    } catch (err) {
      toastError(err);
    }
  };

  const handleOpenPreDeleteModal = (whatsAppId) => {
    setWhatsAppToDelete(whatsAppId);
    setPreDeleteModalOpen(true);
  };

  const handleClosePreDeleteModal = () => {
    setPreDeleteModalOpen(false);
    setWhatsAppToDelete(null);
  };

  const handleConfirmTransferDone = () => {
    setPreDeleteModalOpen(false);
    handleOpenConfirmationModal("delete", whatsAppToDelete);
    setWhatsAppToDelete(null);
  };

  return (
    <MainContainer>
      {metaConfig.appId && !metaConfig.loading ? (
        <div
          style={{
            position: "absolute",
            width: 0,
            height: 0,
            overflow: "hidden",
            opacity: 0,
            pointerEvents: "none",
          }}
        >
          <FacebookLogin
            appId={metaConfig.appId}
            autoLoad={false}
            fields="name,email,picture"
            version={metaConfig.sdkVersion}
            disableMobileRedirect={true}
            scope={
              metaConfig.requireBusinessManagement
                ? "public_profile,pages_messaging,pages_show_list,pages_manage_metadata,pages_read_engagement,business_management"
                : "public_profile,pages_messaging,pages_show_list,pages_manage_metadata,pages_read_engagement"
            }
            callback={responseFacebook}
            render={(renderProps) => {
              facebookRenderPropsRef.current = renderProps;
              return <span />;
            }}
          />

          <FacebookLogin
            appId={metaConfig.appId}
            autoLoad={false}
            fields="name,email,picture"
            version={metaConfig.sdkVersion}
            disableMobileRedirect={true}
            scope={
              metaConfig.requireBusinessManagement
                ? "public_profile,instagram_basic,instagram_manage_messages,pages_messaging,pages_show_list,pages_manage_metadata,pages_read_engagement,business_management"
                : "public_profile,instagram_basic,instagram_manage_messages,pages_messaging,pages_show_list,pages_manage_metadata,pages_read_engagement"
            }
            callback={responseInstagram}
            render={(renderProps) => {
              instagramRenderPropsRef.current = renderProps;
              return <span />;
            }}
          />
        </div>
      ) : null}

      <ConfirmationModal
        title={confirmModalInfo.title}
        open={confirmModalOpen}
        onClose={setConfirmModalOpen}
        onConfirm={handleSubmitConfirmationModal}
      >
        {confirmModalInfo.message}
      </ConfirmationModal>

      {qrModalOpen && (
        <QrcodeModal
          open={qrModalOpen}
          onClose={handleCloseQrModal}
          whatsAppId={!whatsAppModalOpen && selectedWhatsApp?.id}
        />
      )}

      {pairingCodeModalOpen && (
        <PairingCodeModal
          open={pairingCodeModalOpen}
          onClose={handleClosePairingCodeModal}
          whatsAppId={selectedWhatsApp?.id}
        />
      )}

      <WhatsAppModal
        open={whatsAppModalOpen}
        onClose={handleCloseWhatsAppModal}
        whatsAppId={!qrModalOpen && selectedWhatsApp?.id}
        channel={channel}
      />

      <OfficialEmbeddedSignupModal
        open={officialEmbeddedSignupModalOpen}
        onClose={handleCloseOfficialEmbeddedSignupModal}
        onSave={handleOfficialEmbeddedSignupSaved}
        initialName=""
        initialTestNumber=""
      />

      <OfficialOnboardingLogsModal
        open={officialLogsModalOpen}
        onClose={handleCloseOfficialLogsModal}
        whatsappId={selectedOfficialLogConnection?.id}
        connectionName={selectedOfficialLogConnection?.name}
      />

      <OfficialConnectionDiagnosticsModal
        open={officialDiagnosticsModalOpen}
        onClose={handleCloseOfficialDiagnosticsModal}
        whatsappId={selectedOfficialDiagnosticsConnection?.id}
        connectionName={selectedOfficialDiagnosticsConnection?.name}
        embeddedStatus={selectedOfficialDiagnosticsConnection?.embeddedSignupStatus}
        initialNumber={
          selectedOfficialDiagnosticsConnection?.phone_number ||
          selectedOfficialDiagnosticsConnection?.number ||
          ""
        }
      />

      <Dialog
        open={transferModalOpen}
        onClose={handleCloseTransferModal}
        maxWidth="sm"
        fullWidth
        className={classes.modernDialog}
      >
        <DialogTitle className={classes.modernDialogTitle}>
          {i18n.t("adminOps.connections.transferTitle")}
        </DialogTitle>
        <DialogContent className={classes.modernDialogContent}>
          <Typography
            variant="body2"
            style={{
              marginBottom: 24,
              lineHeight: 1.7,
              color: "inherit",
              opacity: 0.8,
            }}
          >
            {i18n.t("adminOps.connections.transferHelp")}
          </Typography>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginBottom: 8,
            }}
          >
            <FormControl fullWidth variant="outlined" size="small">
              <InputLabel>{i18n.t("adminOps.connections.source")}</InputLabel>
              <Select
                value={sourceConnection}
                onChange={(e) => setSourceConnection(e.target.value)}
                label={i18n.t("adminOps.connections.source")}
                style={{ borderRadius: 10 }}
              >
                {whatsApps.map((whatsApp) => (
                  <MuiMenuItem key={whatsApp.id} value={whatsApp.id}>
                    {whatsApp.name}
                  </MuiMenuItem>
                ))}
              </Select>
            </FormControl>

            <div
              style={{
                fontSize: 20,
                color: "#25d366",
                fontWeight: "bold",
                flexShrink: 0,
              }}
            >
              →
            </div>

            <FormControl fullWidth variant="outlined" size="small">
              <InputLabel>{i18n.t("adminOps.connections.destination")}</InputLabel>
              <Select
                value={targetConnection}
                onChange={(e) => setTargetConnection(e.target.value)}
                label={i18n.t("adminOps.connections.destination")}
                style={{ borderRadius: 10 }}
              >
                {whatsApps.map((whatsApp) => (
                  <MuiMenuItem key={whatsApp.id} value={whatsApp.id}>
                    {whatsApp.name}
                  </MuiMenuItem>
                ))}
              </Select>
            </FormControl>
          </div>
        </DialogContent>
        <DialogActions className={classes.modernDialogActions}>
          <Button
            onClick={handleCloseTransferModal}
            className={classes.modernCancelButton}
          >
            {i18n.t("wallets.cancel")}
          </Button>
          <Button
            onClick={handleTransferTickets}
            className={classes.modernConfirmButton}
          >
            {i18n.t("ticketOptionsMenu.transfer")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={transferProgressModalOpen}
        onClose={handleCloseTransferProgressModal}
        maxWidth="sm"
        fullWidth
        className={classes.modernDialog}
        disableBackdropClick
        disableEscapeKeyDown
      >
        <DialogTitle className={classes.modernDialogTitle}>
          {i18n.t("connectionSuite.list.transferProgress")}
        </DialogTitle>
        <DialogContent className={classes.modernDialogContent}>
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <Box position="relative" display="inline-flex" marginBottom={3}>
              <CircularProgress
                variant="determinate"
                value={transferProgress.percentage}
                size={90}
                thickness={3}
                style={{ color: "#25d366" }}
              />
              <Box
                top={0}
                left={0}
                bottom={0}
                right={0}
                position="absolute"
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                <Typography
                  variant="h6"
                  component="div"
                  style={{ fontWeight: 800 }}
                >
                  {transferProgress.percentage}%
                </Typography>
              </Box>
            </Box>

            <Typography variant="body1" style={{ fontWeight: 600 }}>
              {transferProgress.current} {i18n.t("connections.buttons.in")} {transferProgress.total} {i18n.t("connectionSuite.list.tickets")}
            </Typography>

            <Typography
              variant="body2"
              color="textSecondary"
              style={{ marginTop: 8 }}
            >
              {i18n.t("connectionSuite.list.transferWait")}
            </Typography>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={preDeleteModalOpen}
        onClose={handleClosePreDeleteModal}
        maxWidth="sm"
        fullWidth
        className={classes.modernDialog}
      >
        <DialogTitle className={classes.modernDialogTitle}>
          {i18n.t("connectionSuite.list.beforeDelete")}
        </DialogTitle>
        <DialogContent className={classes.modernDialogContent}>
          <Typography variant="body2" style={{ lineHeight: 1.7 }}>
            {i18n.t("connectionSuite.list.beforeDeleteHelp")}
          </Typography>
        </DialogContent>
        <DialogActions className={classes.modernDialogActions}>
          <Button
            onClick={handleClosePreDeleteModal}
            className={classes.modernCancelButton}
          >
            {i18n.t("connectionSuite.list.notYet")}
          </Button>
          <Button
            onClick={handleConfirmTransferDone}
            className={classes.modernConfirmButton}
          >
            {i18n.t("adminOps.connections.confirmTransfer")}
          </Button>
        </DialogActions>
      </Dialog>

      {user.allowConnections !== "enabled" && user.profile !== "admin" ? (
        <ForbiddenPage />
      ) : (
        <>
          <MainHeader>
            <Title>
              {i18n.t("connections.title")} ({whatsApps.length})
            </Title>
            <MainHeaderButtonsWrapper>
              <Button
                variant="contained"
                color="primary"
                onClick={handleOpenTransferModal}
              >
                {i18n.t("adminOps.connections.transferTickets")}
              </Button>

              <Button
                variant="contained"
                color="primary"
                onClick={restartWhatsapps}
              >
                {i18n.t("connections.restartConnections")}
              </Button>

              <Button
                variant="contained"
                color="primary"
                onClick={() => openInNewTab(`https://wa.me/${supportNumber}`)}
              >
                {i18n.t("connections.callSupport")}
              </Button>

              <PopupState variant="popover" popupId="demo-popup-menu">
                {(popupState) => (
                  <React.Fragment>
                    <Can
                      role={user.profile}
                      perform="connections-page:addConnection"
                      yes={() => (
                        <>
                          <Button
                            variant="contained"
                            color="primary"
                            {...bindTrigger(popupState)}
                          >
                            {i18n.t("connections.newConnection")}
                          </Button>
                          <Menu {...bindMenu(popupState)}>
                            <MenuItem
                              disabled={
                                planConfig?.plan?.useWhatsapp ? false : true
                              }
                              onClick={() => {
                                handleOpenWhatsAppModal();
                                popupState.close();
                              }}
                            >
                              <WhatsApp
                                fontSize="small"
                                style={{
                                  marginRight: "10px",
                                  color: "#25D366",
                                }}
                              />
                              WhatsApp
                            </MenuItem>

                            <MenuItem
                              disabled={
                                planConfig?.plan?.useWhatsappOfficial
                                  ? false
                                  : true
                              }
                              onClick={() => {
                                handleOpenWhatsAppModal("whatsapp_oficial");
                                popupState.close();
                              }}
                            >
                              <WhatsApp
                                fontSize="small"
                                style={{
                                  marginRight: "10px",
                                  color: "#25D366",
                                }}
                              />
                              {i18n.t("connectionSuite.list.whatsappOfficial")}
                            </MenuItem>

                            <MenuItem
                              onClick={() => {
                                handleOpenWhatsAppModal("telegram");
                                popupState.close();
                              }}
                            >
                              <span
                                style={{
                                  marginRight: "10px",
                                  color: "#229ED9",
                                  fontWeight: 800,
                                  fontSize: 13,
                                  width: 20,
                                  display: "inline-flex",
                                  justifyContent: "center",
                                }}
                              >
                                <TelegramIcon size={24} />
                              </span>
                              Telegram
                            </MenuItem>

                            <MenuItem
                              disabled={
                                !planConfig?.plan?.useWhatsappOfficial ||
                                metaConfig.loading ||
                                !metaConfig.appId
                              }
                              onClick={() => {
                                handleOpenOfficialEmbeddedSignupModal();
                                popupState.close();
                              }}
                            >
                              <WhatsApp
                                fontSize="small"
                                style={{
                                  marginRight: "10px",
                                  color: "#25D366",
                                }}
                              />
                              {!metaConfig.appId
                                ? i18n.t("adminOps.connections.metaSetup")
                                : i18n.t("adminOps.connections.officialMeta")}
                            </MenuItem>

                            <MenuItem
                              disabled={
                                !planConfig?.plan?.useFacebook ||
                                metaConfig.loading ||
                                !metaConfig.appId
                              }
                              onClick={(event) =>
                                handleMetaLoginClick(
                                  event,
                                  "facebook",
                                  popupState
                                )
                              }
                            >
                              <Facebook
                                fontSize="small"
                                style={{
                                  marginRight: "10px",
                                  color: "#3b5998",
                                  opacity: metaSdkReady ? 1 : 0.6,
                                }}
                              />
                              {!metaConfig.appId
                                ? "Configure a Meta no sistema"
                                : facebookProcessing
                                ? "Conectando Facebook..."
                                : !metaSdkReady
                                ? "Carregando Facebook..."
                                : i18n.t("compaies.table.useFacebook")}
                            </MenuItem>

                            <MenuItem
                              disabled={
                                !planConfig?.plan?.useInstagram ||
                                metaConfig.loading ||
                                !metaConfig.appId
                              }
                              onClick={(event) =>
                                handleMetaLoginClick(
                                  event,
                                  "instagram",
                                  popupState
                                )
                              }
                            >
                              <Instagram
                                fontSize="small"
                                style={{
                                  marginRight: "10px",
                                  color: "#e1306c",
                                  opacity: metaSdkReady ? 1 : 0.6,
                                }}
                              />
                              {!metaConfig.appId
                                ? "Configure a Meta no sistema"
                                : instagramProcessing
                                ? "Conectando Instagram..."
                                : !metaSdkReady
                                ? "Carregando Instagram..."
                                : i18n.t("compaies.table.useInstagram")}
                            </MenuItem>
                          </Menu>
                        </>
                      )}
                    />
                  </React.Fragment>
                )}
              </PopupState>
            </MainHeaderButtonsWrapper>
          </MainHeader>

          <Paper className={classes.mainPaper} variant="outlined">
            {loading ? (
              <Box display="flex" justifyContent="center" p={4}>
                <CircularProgress />
              </Box>
            ) : (
              <Grid container spacing={2} style={{ padding: 8 }}>
                {whatsApps?.length > 0 &&
                  whatsApps.map((whatsApp) => {
                    const isOficial =
                      whatsApp.channel === "whatsapp_oficial";
                    const isTelegram =
                      whatsApp.channel === "telegram";
                    const isConnected = whatsApp.status === "CONNECTED";
                    const statusColor = isConnected
                      ? "#25d366"
                      : whatsApp.status === "OPENING"
                      ? "#ff9800"
                      : "#f44336";
                    const number =
                      whatsApp.channel === "whatsapp" && whatsApp.number
                        ? formatSerializedId(whatsApp.number)
                        : isOficial && whatsApp.phone_number
                        ? formatSerializedId(whatsApp.phone_number)
                        : isTelegram
                        ? whatsApp.telegramBotUsername
                          ? `@${whatsApp.telegramBotUsername}`
                          : whatsApp.number || whatsApp.phone_number || "-"
                        : "-";
                    const usedPairingCode = pairingConnections.includes(
                      whatsApp.id
                    );

                    return (
                      <Grid item xs={12} sm={6} md={4} key={whatsApp.id}>
                        <Card className={classes.connectionCard} elevation={0}>
                          <Box className={classes.cardHeader}>
                            <Box className={classes.cardHeaderLeft}>
                              <Box className={classes.channelIconWrapper}>
                                {IconChannel(whatsApp.channel)}
                              </Box>
                              <Box>
                                <Box
                                  display="flex"
                                  alignItems="center"
                                  style={{ gap: 6 }}
                                >
                                  <Typography className={classes.cardName}>
                                    {whatsApp.name}
                                  </Typography>
                                  <span
                                    className={classes.colorDot}
                                    style={{
                                      backgroundColor: whatsApp.color,
                                    }}
                                  />
                                </Box>
                                <Typography className={classes.cardNumber}>
                                  {number}
                                </Typography>
                              </Box>
                            </Box>
                            <Box
                              display="flex"
                              alignItems="center"
                              flexWrap="wrap"
                              style={{ gap: 4 }}
                            >
                              {isOficial ? (
                                <Chip
                                  className={classes.officialBadge}
                                  size="small"
                                  label="API OFICIAL"
                                />
                              ) : isTelegram ? (
                                <Chip
                                  size="small"
                                  label="TELEGRAM"
                                  style={{
                                    backgroundColor: "#229ED9",
                                    color: "#fff",
                                    fontWeight: 700,
                                  }}
                                />
                              ) : (
                                whatsApp.channel === "whatsapp" && (
                                  <>
                                    <Chip
                                      className={classes.normalBadge}
                                      size="small"
                                      label="BAILEYS"
                                    />
                                    {isConnected && (
                                      <Tooltip
                                        title={
                                          usedPairingCode
                                            ? i18n.t("adminOps.connections.pairingCode")
                                            : i18n.t("adminOps.connections.qrCode")
                                        }
                                      >
                                        <Chip
                                          className={
                                            usedPairingCode
                                              ? classes.pairingBadge
                                              : classes.qrBadge
                                          }
                                          size="small"
                                          label={
                                            usedPairingCode
                                              ? "🔑 Código"
                                              : "⬛ QR Code"
                                          }
                                        />
                                      </Tooltip>
                                    )}
                                  </>
                                )
                              )}
                              {whatsApp.isDefault && (
                                <CheckCircle
                                  style={{
                                    color: green[500],
                                    fontSize: 18,
                                  }}
                                />
                              )}
                            </Box>
                          </Box>

                          <Box className={classes.cardBody}>
                            <Box className={classes.statusRow}>
                              <Typography className={classes.statusText}>
                                <span
                                  className={classes.statusDot}
                                  style={{
                                    backgroundColor: statusColor,
                                    color: statusColor,
                                  }}
                                />
                                {i18n.exists(`adminOps.connections.status.${whatsApp.status}`)
                                  ? i18n.t(`adminOps.connections.status.${whatsApp.status}`)
                                  : whatsApp.status}
                              </Typography>
                              <Typography className={classes.lastUpdate}>
                                {format(
                                  parseISO(whatsApp.updatedAt),
                                  "dd/MM/yy HH:mm"
                                )}
                              </Typography>
                            </Box>

                            <Box className={classes.statsRow}>
                              <Box className={classes.statBox}>
                                <Typography className={classes.statValue}>
                                  {whatsApp.sentMessages || 0}
                                </Typography>
                                <Typography className={classes.statLabel}>
                                  {i18n.t("adminOps.connections.sent")}
                                </Typography>
                              </Box>
                              <Box className={classes.statBox}>
                                <Typography className={classes.statValue}>
                                  {whatsApp.receivedMessages || 0}
                                </Typography>
                                <Typography className={classes.statLabel}>
                                  {i18n.t("adminOps.connections.received")}
                                </Typography>
                              </Box>
                            </Box>

                            {isOficial && (
                              <Box className={classes.limitBox}>
                                <Typography className={classes.limitLabel}>
                                  {i18n.t("adminOps.connections.dailyLimit")}
                                </Typography>
                                <Typography className={classes.limitValue}>
                                  {whatsApp.dailyLimit || "1.000"} {i18n.t("adminOps.connections.messagesDay")}
                                </Typography>
                              </Box>
                            )}

                            {(whatsApp.channel === "facebook" ||
                              whatsApp.channel === "instagram") && (
                              <Box
                                display="flex"
                                alignItems="center"
                                justifyContent="space-between"
                                style={{ marginTop: 4, marginBottom: 8 }}
                              >
                                <Typography
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 500,
                                  }}
                                >
                                  {i18n.t("connections.table.receiveComments")}
                                </Typography>
                                <Switch
                                  checked={
                                    whatsApp.receiveComments !== false
                                  }
                                  onChange={() =>
                                    handleToggleReceiveComments(whatsApp)
                                  }
                                  color="primary"
                                  size="small"
                                />
                              </Box>
                            )}

                            <Box>{renderActionButtons(whatsApp)}</Box>
                          </Box>

                          <Can
                            role={
                              user.profile === "user" &&
                              user.allowConnections === "enabled"
                                ? "admin"
                                : user.profile
                            }
                            perform="connections-page:addConnection"
                            yes={() => (
                              <Box className={classes.cardFooter}>
                                <Box display="flex" style={{ gap: 2 }}>
                                  <Tooltip title={i18n.t("chatList.edit")}>
                                    <IconButton
                                      className={classes.footerIconButton}
                                      size="small"
                                      onClick={() =>
                                        handleEditWhatsApp(whatsApp)
                                      }
                                    >
                                      <Edit fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title={i18n.t("chatList.delete")}>
                                    <IconButton
                                      className={classes.footerIconButton}
                                      size="small"
                                      onClick={() =>
                                        handleOpenPreDeleteModal(
                                          whatsApp.id
                                        )
                                      }
                                    >
                                      <DeleteOutline fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                  {isOficial && (
                                    <>
                                      <Tooltip title={i18n.t("connectionSuite.list.diagnosticsTooltip")}>
                                        <IconButton
                                          className={classes.footerIconButton}
                                          size="small"
                                          onClick={() => handleOpenOfficialDiagnosticsModal(whatsApp)}
                                        >
                                          <HealingIcon fontSize="small" />
                                        </IconButton>
                                      </Tooltip>
                                      <Tooltip title={i18n.t("connectionSuite.list.logsTooltip")}>
                                        <IconButton
                                          className={
                                            classes.footerIconButton
                                          }
                                          size="small"
                                          onClick={() =>
                                            handleOpenOfficialLogsModal(whatsApp)
                                          }
                                        >
                                          <SubjectIcon fontSize="small" />
                                        </IconButton>
                                      </Tooltip>
                                      <Tooltip title={i18n.t("connectionSuite.list.syncTemplatesTooltip")}>
                                        <IconButton
                                          className={
                                            classes.footerIconButton
                                          }
                                          size="small"
                                          onClick={() =>
                                            handleSyncTemplates(
                                              whatsApp.id
                                            )
                                          }
                                        >
                                          <Sync fontSize="small" />
                                        </IconButton>
                                      </Tooltip>
                                      <Tooltip title={i18n.t("connectionSuite.list.copyWebhookTooltip")}>
                                        <IconButton
                                          className={
                                            classes.footerIconButton
                                          }
                                          size="small"
                                          onClick={() =>
                                            handleCopyWebhook(
                                              whatsApp.waba_webhook
                                            )
                                          }
                                        >
                                          <WebhookIcon fontSize="small" />
                                        </IconButton>
                                      </Tooltip>
                                    </>
                                  )}
                                </Box>
                              </Box>
                            )}
                          />
                        </Card>
                      </Grid>
                    );
                  })}
              </Grid>
            )}
          </Paper>
        </>
      )}
    </MainContainer>
  );
};

export default Connections;
