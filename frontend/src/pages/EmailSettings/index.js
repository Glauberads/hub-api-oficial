import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import {
  Button,
  Grid,
  Paper,
  TextField,
  Switch,
  FormControlLabel,
  Typography,
  Divider,
  Box,
  MenuItem,
  CircularProgress
} from "@material-ui/core";
import InfoOutlinedIcon from "@material-ui/icons/InfoOutlined";
import CheckCircleOutlineIcon from "@material-ui/icons/CheckCircleOutline";
import OpenInNewIcon from "@material-ui/icons/OpenInNew";
import SendIcon from "@material-ui/icons/Send";
import WarningIcon from "@material-ui/icons/Warning";
import { useTheme } from "@material-ui/core/styles";
import { i18n } from "../../translate/i18n";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import toastError from "../../errors/toastError";
import {
  getEmailSettings,
  updateEmailSettings,
  testEmailSettings
} from "../../services/emailSettings";

const EmailSettings = () => {
  const theme = useTheme();
  const isDark = theme.palette.type === "dark";
  const [settings, setSettings] = useState({
    provider: "sendgrid",
    sendgridApiKey: "",

    smtpHost: "",
    smtpPort: 587,
    smtpUser: "",
    smtpPass: "",
    smtpSecure: false,

    fromAddress: "",
    fromName: "",
    dailyLimit: 200,
    ratePerMinute: 5,
    continueHour: "08:00",
    isActive: false
  });

  const [testEmail, setTestEmail] = useState("");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await getEmailSettings();

        const provider = data.provider || "sendgrid";

        setSettings(prev => ({
          ...prev,
          ...data,
          provider,
          sendgridApiKey: data.sendgridApiKey || "",
          smtpHost: data.smtpHost || "",
          smtpPort: data.smtpPort ?? 587,
          smtpUser: data.smtpUser || "",
          smtpPass: "",
          smtpSecure: Boolean(data.smtpSecure),
          fromAddress: data.fromAddress || "",
          fromName: data.fromName || "",
          dailyLimit: data.dailyLimit ?? 200,
          ratePerMinute: data.ratePerMinute ?? 5,
          continueHour: data.continueHour || "08:00",
          isActive: Boolean(data.isActive)
        }));
      } catch (err) {
        toastError(err);
      }
    };

    loadSettings();
  }, []);

  const handleChange = field => event => {
    const value =
      event.target.type === "checkbox"
        ? event.target.checked
        : event.target.value;

    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleProviderChange = async event => {
    const provider = event.target.value;

    setSettings(prev => ({
      ...prev,
      provider
    }));

    try {
      const data = await getEmailSettings(provider);

      setSettings(prev => ({
        ...prev,
        ...data,
        provider,
        smtpPort: data.smtpPort ?? 587,
        smtpSecure: Boolean(data.smtpSecure)
      }));
    } catch (err) {
      setSettings(prev => ({
        ...prev,
        provider,
        sendgridApiKey: provider === "sendgrid" ? "" : prev.sendgridApiKey,
        smtpHost: provider === "smtp" ? "" : prev.smtpHost,
        smtpPort: provider === "smtp" ? 587 : prev.smtpPort,
        smtpUser: provider === "smtp" ? "" : prev.smtpUser,
        smtpPass: "",
        smtpSecure: provider === "smtp" ? false : prev.smtpSecure
      }));
    }
  };

  const handleSave = async () => {
    try {
      const payload = {
        provider: settings.provider || "sendgrid",
        fromAddress: settings.fromAddress,
        fromName: settings.fromName,
        dailyLimit: settings.dailyLimit ? Number(settings.dailyLimit) : 200,
        ratePerMinute: settings.ratePerMinute
          ? Number(settings.ratePerMinute)
          : 5,
        continueHour: settings.continueHour || "08:00",
        isActive: Boolean(settings.isActive)
      };

      if (settings.provider === "sendgrid") {
        if (settings.sendgridApiKey && settings.sendgridApiKey.trim() !== "") {
          payload.sendgridApiKey = settings.sendgridApiKey.trim();
        }
      }

      if (settings.provider === "smtp") {
        payload.smtpHost = settings.smtpHost;
        payload.smtpPort = Number(settings.smtpPort) || 587;
        payload.smtpUser = settings.smtpUser;
        payload.smtpSecure = Boolean(settings.smtpSecure);

        if (settings.smtpPass && settings.smtpPass.trim() !== "") {
          payload.smtpPass = settings.smtpPass.trim();
          payload.smtpPassword = settings.smtpPass.trim();
        }
      }

      const data = await updateEmailSettings(payload);

      setSettings(prev => ({
        ...prev,
        ...data,
        provider: payload.provider,
        smtpPort: data.smtpPort ?? payload.smtpPort ?? 587,
        smtpSecure: Boolean(data.smtpSecure ?? payload.smtpSecure)
      }));

      toast.success("Configurações de email salvas com sucesso!");
    } catch (err) {
      toastError(err);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmail) {
      toast.error("Informe um email de destino para teste");
      return;
    }

    setTesting(true);

    try {
      const result = await testEmailSettings(testEmail, settings.provider);

      if (result.success) {
        toast.success(
          `Email de teste enviado via ${result.provider.toUpperCase()}!`
        );
      } else {
        toast.error(result.error || "Falha ao enviar email de teste");
      }
    } catch (err) {
      toastError(err);
    } finally {
      setTesting(false);
    }
  };

  const renderSendGridHelp = () => {
    return (
      <Paper
        variant="outlined"
        style={{
          marginTop: 8,
          padding: 18,
          borderLeft: "5px solid #10b981",
          background: isDark ? "rgba(16,185,129,0.12)" : "#f0fdf4",
          color: theme.palette.text.primary,
          borderColor: isDark ? "rgba(52,211,153,0.38)" : undefined
        }}
      >
        <Box display="flex" alignItems="center" mb={1}>
          <InfoOutlinedIcon style={{ color: "#10b981", marginRight: 8 }} />
          <Typography variant="subtitle1" style={{ fontWeight: 700 }}>
            {i18n.t("automation.email.sendgridGuide")}
          </Typography>
        </Box>

        <Typography
          variant="body2"
          color="textSecondary"
          style={{ marginBottom: 12 }}
        >
          {i18n.t("automation.email.sendgridDescription")}
        </Typography>

        <Box component="ol" style={{ margin: 0, paddingLeft: 22, lineHeight: 1.9 }}>
          {[1, 2, 3, 4, 5, 6, 7].map(step => <li key={step}>{i18n.t(`automation.email.sendgridStep${step}`)}</li>)}
        </Box>

        <Box
          mt={2}
          display="flex"
          alignItems="center"
          style={{ gap: 12, flexWrap: "wrap" }}
        >
          <Button
            variant="outlined"
            color="primary"
            size="small"
            href="https://app.sendgrid.com/settings/api_keys"
            target="_blank"
            rel="noopener noreferrer"
            endIcon={<OpenInNewIcon />}
          >
            {i18n.t("automation.email.openApiKeys")}
          </Button>

          <Button
            variant="outlined"
            color="primary"
            size="small"
            href="https://app.sendgrid.com/settings/sender_auth"
            target="_blank"
            rel="noopener noreferrer"
            endIcon={<OpenInNewIcon />}
          >
            {i18n.t("automation.email.validateSender")}
          </Button>
        </Box>

        <Box mt={2} style={{ color: isDark ? "#6ee7b7" : "#047857", fontSize: 13 }}>
          <CheckCircleOutlineIcon
            style={{
              fontSize: 16,
              verticalAlign: "middle",
              marginRight: 4
            }}
          />
          {i18n.t("automation.email.spfRecommendation")}
        </Box>
      </Paper>
    );
  };

  const renderSmtpHelp = () => {
    return (
      <Paper
        variant="outlined"
        style={{
          marginTop: 8,
          padding: 18,
          borderLeft: "5px solid #3b82f6",
          background: isDark ? "rgba(59,130,246,0.12)" : "#eff6ff",
          color: theme.palette.text.primary,
          borderColor: isDark ? "rgba(96,165,250,0.4)" : undefined
        }}
      >
        <Box display="flex" alignItems="center" mb={1}>
          <InfoOutlinedIcon style={{ color: "#3b82f6", marginRight: 8 }} />
          <Typography variant="subtitle1" style={{ fontWeight: 700 }}>
            {i18n.t("automation.email.smtpGuide")}
          </Typography>
        </Box>

        <Typography
          variant="body2"
          color="textSecondary"
          style={{ marginBottom: 12 }}
        >
          {i18n.t("automation.email.smtpDescription")}
        </Typography>

        <Box component="ol" style={{ margin: 0, paddingLeft: 22, lineHeight: 1.9 }}>
          {[1, 2, 3, 4, 5, 6].map(step => <li key={step}>{i18n.t(`automation.email.smtpStep${step}`)}</li>)}
        </Box>

        <Box mt={2} style={{ color: isDark ? "#93c5fd" : "#1e40af", fontSize: 13 }}>
          <CheckCircleOutlineIcon
            style={{
              fontSize: 16,
              verticalAlign: "middle",
              marginRight: 4
            }}
          />
          {i18n.t("automation.email.smtpTip")}
        </Box>
      </Paper>
    );
  };

  const renderSmtpWarning = () => {
    return (
      <Paper
        variant="outlined"
        style={{
          marginTop: 8,
          marginBottom: 16,
          padding: 16,
          borderLeft: "5px solid #f59e0b",
          background: isDark ? "rgba(245,158,11,0.12)" : "#fffbeb",
          border: `1px solid ${isDark ? "rgba(252,211,77,0.42)" : "#fcd34d"}`,
          color: theme.palette.text.primary
        }}
      >
        <Box display="flex" alignItems="flex-start" style={{ gap: 10 }}>
          <WarningIcon
            style={{
              color: "#d97706",
              fontSize: 28,
              flexShrink: 0,
              marginTop: 2
            }}
          />

          <Box style={{ flex: 1 }}>
            <Typography
              variant="subtitle1"
              style={{ fontWeight: 700, color: isDark ? "#fcd34d" : "#92400e", marginBottom: 6 }}
            >
              {i18n.t("automation.email.smtpWarningTitle")}
            </Typography>

            <Typography
              variant="body2"
              style={{ color: isDark ? theme.palette.text.primary : "#78350f", lineHeight: 1.6, marginBottom: 8 }}
            >
              {i18n.t("automation.email.smtpWarning")}
            </Typography>

            <Box
              mt={2}
              p={1.5}
              style={{
                background: isDark ? "rgba(245,158,11,0.14)" : "#fef3c7",
                borderRadius: 6,
                fontSize: 12,
                color: isDark ? "#fde68a" : "#78350f"
              }}
            >
              {i18n.t("automation.email.highVolumeRecommendation")}
            </Box>
          </Box>
        </Box>
      </Paper>
    );
  };

  return (
    <MainContainer>
      <MainHeader>
        <Title>{i18n.t("automation.email.title")}</Title>
      </MainHeader>

      <Paper
        style={{
          padding: 24,
          maxHeight: "calc(100vh - 140px)",
          overflowY: "auto",
          overflowX: "hidden"
        }}
      >
        <Typography variant="subtitle1" style={{ marginBottom: 8, fontWeight: 600 }}>
          {i18n.t("automation.email.providerSettings")}
        </Typography>

        <Typography variant="body2" color="textSecondary" style={{ marginBottom: 16 }}>
          {i18n.t("automation.email.providerDescription")}
        </Typography>

        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField
              select
              label={i18n.t("automation.email.provider")}
              variant="outlined"
              fullWidth
              value={settings.provider || "sendgrid"}
              onChange={handleProviderChange}
              helperText={i18n.t("automation.email.selectProviderHelp")}
            >
              <MenuItem value="sendgrid">SendGrid</MenuItem>
              <MenuItem value="smtp">{i18n.t("automation.email.customSmtp")}</MenuItem>
            </TextField>
          </Grid>

          {settings.provider === "sendgrid" && (
            <Grid item xs={12} md={6}>
              <TextField
                label="SendGrid API Key"
                variant="outlined"
                fullWidth
                type="password"
                value={settings.sendgridApiKey || ""}
                onChange={handleChange("sendgridApiKey")}
                placeholder="SG.xxxxxxxxxxxxxxxxx"
                helperText={i18n.t("automation.email.apiKeyHelp")}
              />
            </Grid>
          )}

          {settings.provider === "smtp" && (
            <>
              <Grid item xs={12} md={8}>
                <TextField
                  label="Host SMTP"
                  variant="outlined"
                  fullWidth
                  value={settings.smtpHost || ""}
                  onChange={handleChange("smtpHost")}
                  placeholder="smtp.gmail.com"
                />
              </Grid>

              <Grid item xs={6} md={2}>
                <TextField
                  label={i18n.t("automation.email.port")}
                  variant="outlined"
                  type="number"
                  fullWidth
                  value={settings.smtpPort || 587}
                  onChange={handleChange("smtpPort")}
                  inputProps={{ min: 1 }}
                />
              </Grid>

              <Grid item xs={6} md={2}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={Boolean(settings.smtpSecure)}
                      onChange={handleChange("smtpSecure")}
                      color="primary"
                    />
                  }
                  label="SSL/TLS"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  label={i18n.t("automation.email.smtpUser")}
                  variant="outlined"
                  fullWidth
                  value={settings.smtpUser || ""}
                  onChange={handleChange("smtpUser")}
                  placeholder="seuemail@seudominio.com"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  label={i18n.t("automation.email.smtpPassword")}
                  variant="outlined"
                  fullWidth
                  type="password"
                  value={settings.smtpPass || ""}
                  onChange={handleChange("smtpPass")}
                  helperText="Para Gmail/Outlook, use senha de app."
                />
              </Grid>
            </>
          )}

          {settings.provider === "smtp" && (
            <Grid item xs={12}>
              {renderSmtpWarning()}
            </Grid>
          )}

          <Grid item xs={12}>
            {settings.provider === "smtp" ? renderSmtpHelp() : renderSendGridHelp()}
          </Grid>

          <Grid item xs={12}>
            <Box my={1}>
              <Divider />
            </Box>
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              label={i18n.t("automation.email.senderEmail")}
              variant="outlined"
              fullWidth
              value={settings.fromAddress || ""}
              onChange={handleChange("fromAddress")}
              placeholder="contato@seudominio.com"
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              label={i18n.t("automation.email.senderName")}
              variant="outlined"
              fullWidth
              value={settings.fromName || ""}
              onChange={handleChange("fromName")}
              placeholder="Multizap"
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              label={i18n.t("automation.email.dailyLimit")}
              type="number"
              variant="outlined"
              fullWidth
              value={settings.dailyLimit || 200}
              onChange={handleChange("dailyLimit")}
              inputProps={{ min: 1 }}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              label={i18n.t("automation.email.emailsPerMinute")}
              type="number"
              variant="outlined"
              fullWidth
              value={settings.ratePerMinute || 5}
              onChange={handleChange("ratePerMinute")}
              inputProps={{ min: 1 }}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              label={i18n.t("automation.email.continueHour")}
              type="time"
              variant="outlined"
              fullWidth
              value={settings.continueHour || "08:00"}
              onChange={handleChange("continueHour")}
              InputLabelProps={{ shrink: true }}
              helperText={i18n.t("automation.email.continueHourHelp")}
            />
          </Grid>

          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(settings.isActive)}
                  onChange={handleChange("isActive")}
                  color="primary"
                />
              }
              label={i18n.t("automation.email.enable")}
            />
          </Grid>

          <Grid item xs={12}>
            <Box my={1}>
              <Divider />
            </Box>
          </Grid>

          <Grid item xs={12}>
            <Typography variant="subtitle1" style={{ marginBottom: 8, fontWeight: 600 }}>
              {i18n.t("automation.email.testSending")}
            </Typography>

            <Typography variant="body2" color="textSecondary" style={{ marginBottom: 12 }}>
              {i18n.t("automation.email.testDescription")}{" "}
              <strong>{String(settings.provider || "sendgrid").toUpperCase()}</strong>.
            </Typography>

            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={8}>
                <TextField
                  label={i18n.t("automation.email.testRecipient")}
                  variant="outlined"
                  fullWidth
                  value={testEmail}
                  onChange={e => setTestEmail(e.target.value)}
                  placeholder="seuemail@exemplo.com"
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Button
                  variant="outlined"
                  color="primary"
                  fullWidth
                  onClick={handleTestEmail}
                  disabled={testing}
                  startIcon={testing ? <CircularProgress size={16} /> : <SendIcon />}
                >
                  {testing ? i18n.t("automation.email.sending") : i18n.t("automation.email.sendTest")}
                </Button>
              </Grid>
            </Grid>
          </Grid>

          <Grid item xs={12} style={{ textAlign: "right" }}>
            <Button variant="contained" color="primary" onClick={handleSave}>
              {i18n.t("automation.email.saveSettings")}
            </Button>
          </Grid>
        </Grid>
      </Paper>
    </MainContainer>
  );
};

export default EmailSettings;
