import React, { useEffect, useState, useContext } from "react";
import QRCode from "qrcode.react";
import toastError from "../../errors/toastError";
import { makeStyles } from "@material-ui/core/styles";
import {
  Dialog,
  DialogContent,
  Typography,
  Box,
  CircularProgress,
  IconButton,
} from "@material-ui/core";
import { Close as CloseIcon } from "@material-ui/icons";
import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import { AuthContext } from "../../context/Auth/AuthContext";

const useStyles = makeStyles((theme) => ({
  dialogPaper: {
    borderRadius: 16,
    overflow: "hidden",
    maxWidth: 460,
    width: "100%",
    margin: 16,
    background: "#fff",
  },
  header: {
    background: "linear-gradient(135deg, #00a884 0%, #00d4aa 100%)",
    padding: "32px 24px 28px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    position: "relative",
  },
  closeButton: {
    position: "absolute",
    top: 8,
    right: 8,
    color: "rgba(255,255,255,0.8)",
    "&:hover": {
      color: "#fff",
      backgroundColor: "rgba(255,255,255,0.15)",
    },
  },
  whatsappIcon: {
    width: 48,
    height: 48,
    marginBottom: 12,
    filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.15))",
  },
  headerTitle: {
    color: "#fff",
    fontWeight: 700,
    fontSize: "1.15rem",
    textAlign: "center",
    textShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  headerSubtitle: {
    color: "rgba(255,255,255,0.85)",
    fontSize: "0.82rem",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 1.4,
  },
  content: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "28px 24px 32px",
    background: "#fff",
  },
  qrWrapper: {
    position: "relative",
    padding: 16,
    borderRadius: 12,
    border: "2px solid #e8e8e8",
    background: "#fff",
    boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
    transition: "all 0.3s ease",
    "&:hover": {
      borderColor: "#00a884",
      boxShadow: "0 4px 24px rgba(0,168,132,0.12)",
    },
  },
  qrOverlay: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: 44,
    height: 44,
    borderRadius: "50%",
    background: "#00a884",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 2px 8px rgba(0,168,132,0.3)",
    zIndex: 2,
  },
  qrOverlayIcon: {
    color: "#fff",
    fontSize: 24,
    fontWeight: 700,
  },
  loadingContainer: {
    width: 256,
    height: 256,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    border: "2px dashed #d0d0d0",
    background: "#fafafa",
  },
  loadingSpinner: {
    color: "#00a884",
    marginBottom: 16,
  },
  loadingText: {
    color: "#667781",
    fontSize: "0.85rem",
    textAlign: "center",
  },
  steps: {
    marginTop: 24,
    width: "100%",
    padding: "0 8px",
  },
  stepItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
    "&:last-child": {
      marginBottom: 0,
    },
  },
  stepNumber: {
    minWidth: 24,
    height: 24,
    borderRadius: "50%",
    background: "#00a884",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "0.75rem",
    fontWeight: 700,
    flexShrink: 0,
    marginTop: 1,
  },
  stepText: {
    color: "#41525d",
    fontSize: "0.82rem",
    lineHeight: 1.5,
    "& strong": {
      color: "#111b21",
    },
  },
  refreshHint: {
    marginTop: 20,
    color: "#8696a0",
    fontSize: "0.75rem",
    textAlign: "center",
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
}));

const QrcodeModal = ({ open, onClose, whatsAppId }) => {
  const classes = useStyles();
  const [qrCode, setQrCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [connected, setConnected] = useState(false);
  const { user, socket } = useContext(AuthContext);

  const requestNewQr = async () => {
    if (!whatsAppId) return;
    try {
      await api.put(`/whatsappsession/${whatsAppId}`);
    } catch (err) {
      console.warn("Erro ao solicitar novo QR:", err);
    }
  };

  useEffect(() => {
    if (!open || !whatsAppId) return;
    setConnected(false);
    setQrCode("");
    const fetchSession = async () => {
      try {
        const { data } = await api.get(`/whatsapp/${whatsAppId}`);
        if (data.status === "CONNECTED") {
          setConnected(true);
          setTimeout(() => onClose(), 1500);
          return;
        }
        if (data.qrcode) {
          setQrCode(data.qrcode);
          setCountdown(45);
        } else {
          requestNewQr();
        }
      } catch (err) {
        toastError(err);
      }
    };
    fetchSession();
  }, [whatsAppId, open]);

  // Countdown e auto-refresh do QR
  useEffect(() => {
    if (!open || !qrCode || connected) return;
    setCountdown(45);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          // QR expirou, solicitar novo
          requestNewQr();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [qrCode, open, connected]);

  useEffect(() => {
    if (!whatsAppId || !open) return;
    const companyId = user.companyId;

    const onWhatsappData = (data) => {
      if (data.action === "update" && data.session.id === whatsAppId) {
        // Conectou com sucesso
        if (data.session.status === "CONNECTED") {
          setConnected(true);
          setQrCode("");
          setTimeout(() => onClose(), 1500);
          return;
        }
        // Novo QR recebido
        if (data.session.qrcode) {
          setQrCode(data.session.qrcode);
        } else if (data.session.status !== "CONNECTED") {
          // QR expirou, mas não conectou - solicitar novo
          setQrCode("");
          setTimeout(() => requestNewQr(), 2000);
        }
      }
    };
    socket.on(`company-${companyId}-whatsappSession`, onWhatsappData);

    return () => {
      socket.off(`company-${companyId}-whatsappSession`, onWhatsappData);
    };
  }, [whatsAppId, onClose, user.companyId, open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      classes={{ paper: classes.dialogPaper }}
      aria-labelledby="qr-code-dialog"
    >
      {/* Header verde WhatsApp */}
      <Box className={classes.header}>
        <IconButton className={classes.closeButton} onClick={onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
        <svg
          className={classes.whatsappIcon}
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M24 4C12.954 4 4 12.954 4 24c0 3.535.922 6.855 2.535 9.738L4 44l10.524-2.76A19.91 19.91 0 0024 44c11.046 0 20-8.954 20-20S35.046 4 24 4z"
            fill="#fff"
          />
          <path
            d="M24 7C14.611 7 7 14.611 7 24c0 3.258.932 6.296 2.543 8.875L7.2 40.8l8.136-2.133A16.91 16.91 0 0024 41c9.389 0 17-7.611 17-17S33.389 7 24 7zm-3.5 9.5c.32 0 .66.007.95.018.35.01.82-.13 1.28.98.48 1.16 1.63 3.98 1.77 4.27.14.29.24.63.05.98-.19.35-.29.57-.57.87-.29.31-.6.69-.86.92-.29.26-.59.54-.25 1.07.34.52 1.49 2.46 3.2 3.99 2.2 1.96 4.05 2.57 4.62 2.86.57.29.9.24 1.23-.15.34-.38 1.43-1.67 1.81-2.24.38-.57.76-.48 1.28-.29.52.19 3.32 1.57 3.89 1.85.57.29.94.43 1.08.66.14.24.14 1.36-.33 2.67-.47 1.31-2.74 2.57-3.78 2.67-3.27.32-5.91-.66-8.82-2.63-4.24-2.88-6.66-7.43-6.86-7.77-.2-.34-2.08-2.77-2.08-5.28 0-2.52 1.31-3.75 1.78-4.26.47-.52 1.02-.64 1.37-.64z"
            fill="#00a884"
          />
        </svg>
        <Typography className={classes.headerTitle}>
          Conectar ao WhatsApp
        </Typography>
        <Typography className={classes.headerSubtitle}>
          Escaneie o QR Code com seu celular para iniciar a sessão
        </Typography>
      </Box>

      <DialogContent className={classes.content}>
        {connected ? (
          <Box className={classes.loadingContainer} style={{ borderColor: "#00a884", borderStyle: "solid" }}>
            <Typography style={{ color: "#00a884", fontWeight: 700, fontSize: "1.1rem" }}>
              ✅ Conectado com sucesso!
            </Typography>
          </Box>
        ) : qrCode ? (
          <Box className={classes.qrWrapper}>
            <QRCode
              value={qrCode}
              size={256}
              level="M"
              style={{ display: "block" }}
              fgColor="#111b21"
            />
          </Box>
        ) : (
          <Box className={classes.loadingContainer}>
            <CircularProgress size={40} className={classes.loadingSpinner} />
            <Typography className={classes.loadingText}>
              Gerando novo QR Code...
            </Typography>
          </Box>
        )}

        {!connected && (
          <>
            {/* Passos */}
            <Box className={classes.steps}>
              <Box className={classes.stepItem}>
                <Box className={classes.stepNumber}>1</Box>
                <Typography className={classes.stepText}>
                  Abra o <strong>WhatsApp</strong> no seu celular
                </Typography>
              </Box>
              <Box className={classes.stepItem}>
                <Box className={classes.stepNumber}>2</Box>
                <Typography className={classes.stepText}>
                  Toque em <strong>Mais opções ⋮</strong> ou{" "}
                  <strong>Configurações ⚙</strong> e selecione{" "}
                  <strong>Aparelhos conectados</strong>
                </Typography>
              </Box>
              <Box className={classes.stepItem}>
                <Box className={classes.stepNumber}>3</Box>
                <Typography className={classes.stepText}>
                  Toque em <strong>Conectar um aparelho</strong> e aponte a câmera
                  para este QR Code
                </Typography>
              </Box>
            </Box>

            <Typography className={classes.refreshHint}>
              🔄 {qrCode && countdown > 0
                ? `QR Code atualiza em ${countdown}s`
                : "Atualizando QR Code..."}
            </Typography>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default React.memo(QrcodeModal);
