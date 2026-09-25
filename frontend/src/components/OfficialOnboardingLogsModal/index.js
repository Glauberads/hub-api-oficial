import React, { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  CircularProgress,
  Typography,
  Box,
  Paper,
  Grid,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  dialogPaper: {
    borderRadius: 16,
    overflow: "hidden",
  },
  dialogTitle: {
    fontWeight: 700,
    fontSize: 18,
    padding: "20px 24px 12px",
  },
  dialogContent: {
    padding: "8px 24px 20px",
  },
  dialogActions: {
    padding: "12px 24px 20px",
    gap: 8,
  },
  closeButton: {
    borderRadius: 10,
    textTransform: "none",
    fontWeight: 600,
    padding: "8px 20px",
  },
  refreshButton: {
    borderRadius: 10,
    textTransform: "none",
    fontWeight: 600,
    padding: "8px 20px",
  },
  logCard: {
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    padding: 14,
    marginBottom: 12,
    background:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.03)"
        : "#fff",
  },
  logHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8,
    flexWrap: "wrap",
  },
  step: {
    fontWeight: 700,
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: "0.4px",
  },
  status: {
    fontWeight: 700,
    fontSize: 12,
    textTransform: "uppercase",
  },
  statusSuccess: {
    color: "#2e7d32",
  },
  statusWarning: {
    color: "#ed6c02",
  },
  statusError: {
    color: "#d32f2f",
  },
  statusInfo: {
    color: theme.palette.text.secondary,
  },
  message: {
    fontSize: 13,
    color: theme.palette.text.primary,
    marginBottom: 6,
    lineHeight: 1.5,
  },
  metaText: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    lineHeight: 1.5,
    wordBreak: "break-word",
  },
  emptyBox: {
    padding: 24,
    textAlign: "center",
    color: theme.palette.text.secondary,
  },
}));

const OfficialOnboardingLogsModal = ({
  open,
  onClose,
  whatsappId,
  connectionName,
}) => {
  const dateLocale = i18n.language === "pt" ? "pt-BR" : i18n.language === "es" ? "es-ES" : "en-US";
  const classes = useStyles();
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);

  const getStatusClass = (status) => {
    if (status === "success") return classes.statusSuccess;
    if (status === "warning") return classes.statusWarning;
    if (status === "error") return classes.statusError;
    return classes.statusInfo;
  };

  const loadLogs = useCallback(async () => {
    if (!open || !whatsappId) {
      setLogs([]);
      return;
    }

    try {
      setLoading(true);
      const { data } = await api.get(`/embedded-signup/logs/${whatsappId}`, {
        params: {
          limit: 100,
        },
      });
      setLogs(Array.isArray(data?.data) ? data.data : []);
    } catch (err) {
      toastError(err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [open, whatsappId]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      classes={{ paper: classes.dialogPaper }}
    >
      <DialogTitle className={classes.dialogTitle}>
        {i18n.t("connectionSuite.logs.title")}
      </DialogTitle>

      <DialogContent className={classes.dialogContent}>
        <Typography
          variant="body2"
          style={{ marginBottom: 16, opacity: 0.8 }}
        >
          {connectionName
            ? `${i18n.t("connectionSuite.common.connection")}: ${connectionName}`
            : i18n.t("connectionSuite.common.activationHistory")}
        </Typography>

        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress size={28} />
          </Box>
        ) : logs.length === 0 ? (
          <Paper elevation={0} className={classes.emptyBox}>
            <Typography variant="body2">
              {i18n.t("connectionSuite.logs.empty")}
            </Typography>
          </Paper>
        ) : (
          logs.map((log) => (
            <Paper key={log.id} elevation={0} className={classes.logCard}>
              <div className={classes.logHeader}>
                <Typography className={classes.step}>
                  {log.step || "step"}
                </Typography>
                <Typography
                  className={`${classes.status} ${getStatusClass(log.status)}`}
                >
                  {log.status || "info"}
                </Typography>
              </div>

              {!!log.message && (
                <Typography className={classes.message}>
                  {log.message}
                </Typography>
              )}

              <Grid container spacing={1}>
                <Grid item xs={12} md={6}>
                  <Typography className={classes.metaText}>
                    <strong>{i18n.t("connectionSuite.common.createdAt")}:</strong>{" "}
                    {log.createdAt
                      ? new Date(log.createdAt).toLocaleString(dateLocale)
                      : "-"}
                  </Typography>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Typography className={classes.metaText}>
                    <strong>{i18n.t("connectionSuite.common.updatedAt")}:</strong>{" "}
                    {log.updatedAt
                      ? new Date(log.updatedAt).toLocaleString(dateLocale)
                      : "-"}
                  </Typography>
                </Grid>
              </Grid>

              {!!log.error && (
                <Typography
                  className={classes.metaText}
                  style={{ color: "#d32f2f", marginTop: 8 }}
                >
                  <strong>{i18n.t("connectionSuite.logs.error")}:</strong> {log.error}
                </Typography>
              )}

              {!!log.payload && (
                <Box mt={1}>
                  <Typography className={classes.metaText}>
                    <strong>{i18n.t("connectionSuite.logs.payload")}:</strong>
                  </Typography>
                  <Paper
                    elevation={0}
                    style={{
                      marginTop: 6,
                      padding: 10,
                      borderRadius: 10,
                      background: "rgba(0,0,0,0.04)",
                      overflowX: "auto",
                    }}
                  >
                    <pre
                      style={{
                        margin: 0,
                        fontSize: 12,
                        lineHeight: 1.5,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {JSON.stringify(log.payload, null, 2)}
                    </pre>
                  </Paper>
                </Box>
              )}
            </Paper>
          ))
        )}
      </DialogContent>

      <DialogActions className={classes.dialogActions}>
        <Button
          onClick={onClose}
          className={classes.closeButton}
          variant="outlined"
        >
          {i18n.t("campaigns.settings.close")}
        </Button>

        <Button
          onClick={loadLogs}
          className={classes.refreshButton}
          variant="contained"
          color="primary"
          disabled={loading}
        >
          {loading ? <CircularProgress size={18} color="inherit" /> : i18n.t("mainDrawer.appBar.refresh")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default OfficialOnboardingLogsModal;
