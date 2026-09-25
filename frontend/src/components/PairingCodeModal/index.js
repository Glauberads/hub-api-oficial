import React, { useState, useContext, useEffect, useRef, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  CircularProgress,
  Box,
  LinearProgress,
  Stepper,
  Step,
  StepLabel,
} from "@material-ui/core";
import { makeStyles, withStyles } from "@material-ui/core/styles";
import { toast } from "react-toastify";
import { CheckCircle, PhonelinkRing, Sync, Wifi } from "@material-ui/icons";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { i18n } from "../../translate/i18n";

const PulseProgress = withStyles((theme) => ({
  root: {
    height: 6,
    borderRadius: 3,
  },
  colorPrimary: {
    backgroundColor: theme.palette.type === "dark" ? "#333" : "#e0e0e0",
  },
  bar: {
    borderRadius: 3,
    background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.primary.light}, ${theme.palette.primary.main})`,
    backgroundSize: "200% 100%",
    animation: "$shimmer 1.5s ease-in-out infinite",
  },
  "@keyframes shimmer": {
    "0%": { backgroundPosition: "200% 0" },
    "100%": { backgroundPosition: "-200% 0" },
  },
}))(LinearProgress);

const useStyles = makeStyles((theme) => ({
  codeBox: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(1),
  },
  codeText: {
    fontFamily: "monospace",
    fontSize: 42,
    fontWeight: 700,
    letterSpacing: 14,
    color: theme.palette.primary.main,
    background: theme.palette.type === "dark" ? "#1e1e1e" : "#f5f5f5",
    borderRadius: 12,
    padding: "12px 24px",
    border: `2px solid ${theme.palette.primary.main}`,
    userSelect: "all",
  },
  instructions: {
    color: theme.palette.text.secondary,
    textAlign: "center",
    marginTop: theme.spacing(2),
    lineHeight: 1.7,
  },
  step: {
    fontWeight: 600,
    color: theme.palette.text.primary,
  },
  timer: {
    textAlign: "center",
    marginTop: theme.spacing(1),
    color: theme.palette.error.main,
    fontWeight: 600,
  },
  progressContainer: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(1),
  },
  stepper: {
    padding: theme.spacing(1, 0),
    backgroundColor: "transparent",
  },
  stepLabel: {
    "& .MuiStepLabel-label": {
      fontSize: "0.75rem",
    },
  },
  waitingBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: theme.spacing(1),
    marginTop: theme.spacing(2),
    padding: theme.spacing(2),
    borderRadius: 12,
    backgroundColor: theme.palette.type === "dark" ? "#1a2e1a" : "#e8f5e9",
    border: `1px solid ${theme.palette.type === "dark" ? "#2e7d32" : "#a5d6a7"}`,
  },
  pulseIcon: {
    animation: "$pulse 1.5s ease-in-out infinite",
    color: theme.palette.primary.main,
  },
  "@keyframes pulse": {
    "0%, 100%": { opacity: 1, transform: "scale(1)" },
    "50%": { opacity: 0.5, transform: "scale(1.1)" },
  },
  spinIcon: {
    animation: "$spin 2s linear infinite",
    color: theme.palette.primary.main,
  },
  "@keyframes spin": {
    "0%": { transform: "rotate(0deg)" },
    "100%": { transform: "rotate(360deg)" },
  },
  connectedBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: theme.spacing(1),
    marginTop: theme.spacing(2),
    padding: theme.spacing(3),
    borderRadius: 12,
    backgroundColor: theme.palette.type === "dark" ? "#1a2e1a" : "#e8f5e9",
    border: `2px solid #4caf50`,
  },
  connectedIcon: {
    fontSize: 48,
    color: "#4caf50",
    animation: "$scaleIn 0.5s ease-out",
  },
  "@keyframes scaleIn": {
    "0%": { transform: "scale(0)", opacity: 0 },
    "50%": { transform: "scale(1.2)" },
    "100%": { transform: "scale(1)", opacity: 1 },
  },
}));

const STEPS = [
  { label: "connectionSuite.pairing.generated", icon: <PhonelinkRing fontSize="small" /> },
  { label: "connectionSuite.pairing.waiting", icon: <Wifi fontSize="small" /> },
  { label: "connectionSuite.pairing.syncing", icon: <Sync fontSize="small" /> },
  { label: "connectionSuite.pairing.connected", icon: <CheckCircle fontSize="small" /> },
];

const PairingCodeModal = ({ open, onClose, whatsAppId }) => {
  const classes = useStyles();
  const { user, socket } = useContext(AuthContext);

  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [pairingCode, setPairingCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [activeStep, setActiveStep] = useState(0);
  const [connected, setConnected] = useState(false);
  const closeTimerRef = useRef(null);
  const lastStatusRef = useRef("");

  const handleClose = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    lastStatusRef.current = "";
    setPhoneNumber("");
    setPhoneError("");
    setPairingCode("");
    setLoading(false);
    setCountdown(null);
    setActiveStep(0);
    setConnected(false);
    onClose();
  }, [onClose]);

  const applySessionStatus = useCallback((statusRaw) => {
    const status = String(statusRaw || "").toUpperCase();
    if (!status || lastStatusRef.current === status) return;

    lastStatusRef.current = status;

    if (status === "OPENING" || status === "PAIRING") {
      setActiveStep(2);
      return;
    }

    if (status === "QRCODE") {
      setActiveStep(1);
      return;
    }

    if (status === "CONNECTED") {
      setActiveStep(3);
      setConnected(true);
      setCountdown(null);
      toast.success(i18n.t("connectionSuite.pairing.success"));
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      closeTimerRef.current = setTimeout(() => handleClose(), 2500);
      return;
    }

    if (status === "DISCONNECTED" || status === "TIMEOUT") {
      toast.warning(i18n.t("connectionSuite.pairing.failed"));
      setPairingCode("");
      setCountdown(null);
      setActiveStep(0);
      setConnected(false);
    }
  }, [handleClose]);

  // Ouvir evento de conexão para atualizar steps em tempo real
  useEffect(() => {
    if (
      !whatsAppId ||
      !open ||
      !user?.companyId ||
      !socket ||
      typeof socket.on !== "function" ||
      typeof socket.off !== "function"
    ) return;

    const companyId = user.companyId;
    const eventName = `company-${companyId}-whatsappSession`;

    const onWhatsappSession = (data) => {
      if (data?.action !== "update") return;
      if (Number(data?.session?.id) !== Number(whatsAppId)) return;
      applySessionStatus(data?.session?.status);
    };

    socket.on(eventName, onWhatsappSession);
    return () => {
      socket.off(eventName, onWhatsappSession);
    };
  }, [whatsAppId, open, user?.companyId, socket, applySessionStatus]);

  // Fallback: polling de status para casos em que socket não entrega evento
  useEffect(() => {
    if (!open || !whatsAppId || !pairingCode || connected) return;

    let cancelled = false;
    const pollStatus = async () => {
      try {
        const { data } = await api.get(`/whatsapp/${whatsAppId}`);
        if (!cancelled) {
          applySessionStatus(data?.status);
        }
      } catch (_) {
        // fallback silencioso
      }
    };

    pollStatus();
    const interval = setInterval(pollStatus, 2000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [open, whatsAppId, pairingCode, connected, applySessionStatus]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  // Countdown de 60s após receber o código
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      setPairingCode("");
      setCountdown(null);
      setActiveStep(0);
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const formatPhoneDisplay = (raw) => {
    const digits = raw.replace(/\D/g, "").slice(0, 13);
    if (digits.length <= 2) return `+${digits}`;
    if (digits.length <= 4) return `+${digits.slice(0,2)} (${digits.slice(2)}`;
    if (digits.length <= 9) return `+${digits.slice(0,2)} (${digits.slice(2,4)}) ${digits.slice(4)}`;
    return `+${digits.slice(0,2)} (${digits.slice(2,4)}) ${digits.slice(4,9)}-${digits.slice(9)}`;
  };

  const validatePhone = (digits) => {
    if (!digits) return i18n.t("connectionSuite.common.requiredPhone");
    if (digits.length < 10) return i18n.t("connectionSuite.pairing.tooShort");
    if (digits.length > 13) return i18n.t("connectionSuite.pairing.tooLong");
    if (!digits.startsWith("55") && digits.length < 11) return i18n.t("connectionSuite.common.brazilFormat");
    return "";
  };

  const handlePhoneChange = (e) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 13);
    setPhoneNumber(digits);
    setPhoneError(validatePhone(digits));
  };

  const handleRequestCode = async () => {
    const error = validatePhone(phoneNumber);
    if (error) {
      setPhoneError(error);
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post(
        `/whatsappsession/${whatsAppId}/pairing-code`,
        { phoneNumber }
      );
      if (data.connected) {
        toast.success(i18n.t("connectionSuite.pairing.alreadyConnected"));
        handleClose();
        return;
      }

      if (!data?.code) {
        throw new Error(i18n.t("connectionSuite.common.pairingCodeMissing"));
      }

      lastStatusRef.current = "";
      setConnected(false);
      setPairingCode(data.code);
      setCountdown(60);
      setActiveStep(1); // Aguardando pareamento
      try {
        const stored = JSON.parse(localStorage.getItem("pairingCodeConnections") || "[]");
        if (!stored.includes(whatsAppId)) {
          stored.push(whatsAppId);
          localStorage.setItem("pairingCodeConnections", JSON.stringify(stored));
        }
      } catch (_) {}
      toast.info(i18n.t("connectionSuite.pairing.generated"));
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  const getCountdownColor = () => {
    if (countdown > 30) return "#4caf50";
    if (countdown > 10) return "#ff9800";
    return "#f44336";
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        {i18n.t("connectionSuite.pairing.title")}
      </DialogTitle>
      <DialogContent>
        {!pairingCode && !connected ? (
          <>
            <Typography variant="body2" className={classes.instructions}>
              {i18n.t("connectionSuite.pairing.enterNumber")} <span className={classes.step}>{i18n.t("connectionSuite.pairing.countryCode")}</span>.<br />
              {i18n.t("connectionSuite.pairing.example")}: <strong>5511999998888</strong>
            </Typography>
            <Box mt={2}>
              <TextField
                label={i18n.t("connectionSuite.pairing.whatsappNumber")}
                placeholder="+55 (11) 99999-8888"
                fullWidth
                variant="outlined"
                value={formatPhoneDisplay(phoneNumber)}
                onChange={handlePhoneChange}
                disabled={loading}
                error={!!phoneError}
                helperText={phoneError || `${phoneNumber.length}/13 ${i18n.t("connectionSuite.common.digitsHelp")}`}
                inputProps={{ maxLength: 20 }}
              />
            </Box>
          </>
        ) : connected ? (
          <Box className={classes.connectedBox}>
            <CheckCircle className={classes.connectedIcon} />
            <Typography variant="h6" style={{ color: "#4caf50", fontWeight: 700 }}>
              {i18n.t("connectionSuite.pairing.connected")}
            </Typography>
            <Typography variant="body2" style={{ textAlign: "center", color: "#666" }}>
              {i18n.t("connectionSuite.pairing.connectedHelp")}
            </Typography>
          </Box>
        ) : (
          <>
            <Typography variant="body2" className={classes.instructions}>
              {i18n.t("connectionSuite.pairing.instructions")}<br />
              <span className={classes.step}>{i18n.t("connectionSuite.pairing.path")}</span>
              <br /><br />
              {i18n.t("connectionSuite.pairing.tap")} <strong>"{i18n.t("connectionSuite.pairing.phoneLink")}"</strong> {i18n.t("connectionSuite.pairing.enterCode")}
            </Typography>

            <div className={classes.codeBox}>
              <span className={classes.codeText}>{pairingCode}</span>
            </div>

            {countdown !== null && (
              <Box display="flex" alignItems="center" justifyContent="center" mt={1} style={{ gap: 8 }}>
                <Box position="relative" display="inline-flex">
                  <CircularProgress
                    variant="determinate"
                    value={(countdown / 60) * 100}
                    size={36}
                    style={{ color: getCountdownColor() }}
                  />
                  <Box
                    top={0} left={0} bottom={0} right={0}
                    position="absolute"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Typography variant="caption" style={{ fontSize: 11, fontWeight: 700, color: getCountdownColor() }}>
                      {countdown}s
                    </Typography>
                  </Box>
                </Box>
                <Typography variant="body2" style={{ color: getCountdownColor(), fontWeight: 600 }}>
                  {countdown > 30
                    ? i18n.t("connectionSuite.common.waitingCode")
                    : countdown > 10
                      ? i18n.t("connectionSuite.common.enterCodeNow")
                      : i18n.t("connectionSuite.common.codeExpiring")}
                </Typography>
              </Box>
            )}

            {/* Stepper de progresso */}
            <Box className={classes.progressContainer}>
              <Stepper activeStep={activeStep} alternativeLabel className={classes.stepper}>
                {STEPS.map((step, index) => (
                  <Step key={step.label} completed={index < activeStep}>
                    <StepLabel className={classes.stepLabel}>{i18n.t(step.label)}</StepLabel>
                  </Step>
                ))}
              </Stepper>

              {activeStep >= 1 && activeStep < 3 && (
                <PulseProgress variant="indeterminate" />
              )}
            </Box>

            {activeStep === 1 && (
              <Box className={classes.waitingBox}>
                <PhonelinkRing className={classes.pulseIcon} fontSize="large" />
                <Typography variant="body2" style={{ textAlign: "center", fontWeight: 500 }}>
                  {i18n.t("connectionSuite.pairing.waiting")}
                </Typography>
              </Box>
            )}

            {activeStep === 2 && (
              <Box className={classes.waitingBox}>
                <Sync className={classes.spinIcon} fontSize="large" />
                <Typography variant="body2" style={{ textAlign: "center", fontWeight: 500 }}>
                  {i18n.t("connectionSuite.pairing.syncing")}
                </Typography>
              </Box>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="default">
          {connected ? i18n.t("campaigns.settings.close") : i18n.t("wallets.cancel")}
        </Button>
        {!pairingCode && !connected && (
          <Button
            onClick={handleRequestCode}
            color="primary"
            variant="contained"
            disabled={loading || !phoneNumber || !!phoneError}
          >
            {loading ? <CircularProgress size={20} /> : i18n.t("connectionSuite.common.generateCode")}
          </Button>
        )}
        {pairingCode && !connected && (
          <Button
            onClick={() => {
              lastStatusRef.current = "";
              setConnected(false);
              setPairingCode("");
              setCountdown(null);
              setActiveStep(0);
            }}
            color="primary"
            variant="outlined"
          >
            {i18n.t("connectionSuite.pairing.tryAgain")}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default PairingCodeModal;
