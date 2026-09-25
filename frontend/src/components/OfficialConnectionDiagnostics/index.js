import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  Grid,
  Paper,
  TextField,
  Typography,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  root: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 12,
    padding: 16,
    backgroundColor:
      theme.palette.type === "dark" ? "rgba(255,255,255,0.03)" : "#fff",
  },
  title: {
    fontSize: "0.95rem",
    fontWeight: 700,
    color: theme.palette.text.primary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: "0.8rem",
    color: theme.palette.text.secondary,
    marginBottom: 12,
    lineHeight: 1.4,
  },
  actions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 16,
  },
  field: {
    "& .MuiOutlinedInput-root": {
      borderRadius: 10,
    },
  },
  chipOk: {
    fontWeight: 700,
    color: "#2e7d32",
  },
  chipWarn: {
    fontWeight: 700,
    color: "#ed6c02",
  },
  chipError: {
    fontWeight: 700,
    color: "#d32f2f",
  },
}));

const OfficialConnectionDiagnostics = ({
  whatsappId,
  embeddedStatus,
  initialNumber = "",
}) => {
  const classes = useStyles();

  const [loading, setLoading] = useState(false);
  const [sendingTextTest, setSendingTextTest] = useState(false);
  const [sendingTemplateTest, setSendingTemplateTest] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [testNumber, setTestNumber] = useState(initialNumber || "");
  const [textBody, setTextBody] = useState(
    "Teste de ativação da API Oficial realizado com sucesso."
  );
  const [templateName, setTemplateName] = useState("");
  const [templateLanguageCode, setTemplateLanguageCode] = useState("pt_BR");
  const [templateParametersRaw, setTemplateParametersRaw] = useState("");
  const [diagnostics, setDiagnostics] = useState(null);

  const getStatusClass = (status) => {
    if (status === "healthy") return classes.chipOk;
    if (status === "warning") return classes.chipWarn;
    return classes.chipError;
  };

  const parseTemplateParameters = () => {
    return String(templateParametersRaw || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  };

  const loadDiagnostics = useCallback(async () => {
    if (!whatsappId) return;

    try {
      setLoading(true);
      const { data } = await api.get(
        `/embedded-signup/diagnostics/${whatsappId}`
      );
      setDiagnostics(data?.data || null);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, [whatsappId]);

  useEffect(() => {
    loadDiagnostics();
  }, [loadDiagnostics]);

  const handleReconnect = async () => {
    if (!whatsappId) return;

    try {
      setReconnecting(true);
      await api.post(`/embedded-signup/reconnect/${whatsappId}`);
      toast.success(i18n.t("connectionSuite.diagnostics.reconnectSuccess"));
      await loadDiagnostics();
    } catch (err) {
      toastError(err);
    } finally {
      setReconnecting(false);
    }
  };

  const handleTestSendText = async () => {
    if (!whatsappId) return;

    if (!testNumber) {
      toast.error(i18n.t("connectionSuite.diagnostics.testNumberRequired"));
      return;
    }

    try {
      setSendingTextTest(true);
      await api.post(`/embedded-signup/test-send/${whatsappId}`, {
        number: testNumber,
        body: textBody,
      });
      toast.success(i18n.t("connectionSuite.diagnostics.textSuccess"));
      await loadDiagnostics();
    } catch (err) {
      toastError(err);
    } finally {
      setSendingTextTest(false);
    }
  };

  const handleTestSendTemplate = async () => {
    if (!whatsappId) return;

    if (!testNumber) {
      toast.error(i18n.t("connectionSuite.diagnostics.testNumberRequired"));
      return;
    }

    if (!templateName) {
      toast.error(i18n.t("connectionSuite.diagnostics.templateNameRequired"));
      return;
    }

    try {
      setSendingTemplateTest(true);
      await api.post(`/embedded-signup/test-send/${whatsappId}`, {
        number: testNumber,
        templateName,
        templateLanguageCode,
        templateParameters: parseTemplateParameters(),
      });
      toast.success(i18n.t("connectionSuite.diagnostics.templateSuccess"));
      await loadDiagnostics();
    } catch (err) {
      toastError(err);
    } finally {
      setSendingTemplateTest(false);
    }
  };

  return (
    <Paper elevation={0} className={classes.root}>
      <Typography className={classes.title}>
        {i18n.t("connectionSuite.diagnostics.title")}
      </Typography>

      <Typography className={classes.subtitle}>
        {i18n.t("connectionSuite.diagnostics.help")}
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <TextField
            label={i18n.t("connectionSuite.modal.onboardingStatus")}
            variant="outlined"
            fullWidth
            value={embeddedStatus || "none"}
            InputProps={{ readOnly: true }}
            className={classes.field}
          />
        </Grid>

        <Grid item xs={12} md={4}>
          <TextField
            label={i18n.t("connectionSuite.modal.connectionHealth")}
            variant="outlined"
            fullWidth
            value={diagnostics?.status || "unknown"}
            InputProps={{ readOnly: true }}
            className={classes.field}
          />
        </Grid>

        <Grid item xs={12} md={4}>
          <TextField
            label={i18n.t("connectionSuite.embedded.finalTestNumber")}
            variant="outlined"
            fullWidth
            value={testNumber}
            onChange={(e) => setTestNumber(e.target.value)}
            className={classes.field}
          />
        </Grid>
      </Grid>

      <Divider style={{ marginTop: 16, marginBottom: 16 }} />

      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" py={2}>
          <CircularProgress size={26} />
        </Box>
      ) : (
        <>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="body2">
                {i18n.t("connectionSuite.diagnostics.tokenPresent")}:{" "}
                <span
                  className={
                    diagnostics?.checks?.hasToken
                      ? classes.chipOk
                      : classes.chipError
                  }
                >
                  {diagnostics?.checks?.hasToken ? i18n.t("plans.form.yes") : i18n.t("plans.form.no")}
                </span>
              </Typography>
              <Typography variant="body2">
                {i18n.t("connectionSuite.diagnostics.tokenValid")}:{" "}
                <span
                  className={
                    diagnostics?.checks?.tokenValid
                      ? classes.chipOk
                      : classes.chipError
                  }
                >
                  {diagnostics?.checks?.tokenValid ? i18n.t("plans.form.yes") : i18n.t("plans.form.no")}
                </span>
              </Typography>
              <Typography variant="body2">
                {i18n.t("connectionSuite.diagnostics.wabaPresent")}:{" "}
                <span
                  className={
                    diagnostics?.checks?.hasWabaId
                      ? classes.chipOk
                      : classes.chipError
                  }
                >
                  {diagnostics?.checks?.hasWabaId ? i18n.t("plans.form.yes") : i18n.t("plans.form.no")}
                </span>
              </Typography>
              <Typography variant="body2">
                {i18n.t("connectionSuite.diagnostics.phoneIdPresent")}:{" "}
                <span
                  className={
                    diagnostics?.checks?.hasPhoneNumberId
                      ? classes.chipOk
                      : classes.chipError
                  }
                >
                  {diagnostics?.checks?.hasPhoneNumberId ? i18n.t("plans.form.yes") : i18n.t("plans.form.no")}
                </span>
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="body2">
                {i18n.t("connectionSuite.diagnostics.numberAccessible")}:{" "}
                <span
                  className={
                    diagnostics?.checks?.phoneReachable
                      ? classes.chipOk
                      : classes.chipError
                  }
                >
                  {diagnostics?.checks?.phoneReachable ? i18n.t("plans.form.yes") : i18n.t("plans.form.no")}
                </span>
              </Typography>
              <Typography variant="body2">
                {i18n.t("connectionSuite.modal.signedWebhook")}:{" "}
                <span
                  className={
                    diagnostics?.checks?.webhookSubscribed
                      ? classes.chipOk
                      : classes.chipError
                  }
                >
                  {diagnostics?.checks?.webhookSubscribed ? i18n.t("plans.form.yes") : i18n.t("plans.form.no")}
                </span>
              </Typography>
              <Typography variant="body2">
                {i18n.t("connectionSuite.diagnostics.appSubscribed")}:{" "}
                <span
                  className={
                    diagnostics?.checks?.appSubscribed
                      ? classes.chipOk
                      : classes.chipError
                  }
                >
                  {diagnostics?.checks?.appSubscribed ? i18n.t("plans.form.yes") : i18n.t("plans.form.no")}
                </span>
              </Typography>
              <Typography variant="body2">
                {i18n.t("connectionSuite.diagnostics.finalStatus")}:{" "}
                <span className={getStatusClass(diagnostics?.status)}>
                  {diagnostics?.status || "unknown"}
                </span>
              </Typography>
            </Grid>
          </Grid>

          <Box mt={2}>
            <Typography variant="body2" color="textSecondary">
              {diagnostics?.details || i18n.t("connectionSuite.common.details")}
            </Typography>

            {!!diagnostics?.lastError && (
              <Typography
                variant="body2"
                style={{ color: "#d32f2f", marginTop: 8 }}
              >
                {i18n.t("connectionSuite.modal.lastError")}: {diagnostics.lastError}
              </Typography>
            )}
          </Box>
        </>
      )}

      <Divider style={{ marginTop: 16, marginBottom: 16 }} />

      <Typography className={classes.title}>
        {i18n.t("connectionSuite.diagnostics.textTest")}
      </Typography>
      <Typography className={classes.subtitle}>
        {i18n.t("connectionSuite.diagnostics.textTestHelp")}
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TextField
            label={i18n.t("connectionSuite.diagnostics.testMessage")}
            variant="outlined"
            fullWidth
            multiline
            rows={3}
            value={textBody}
            onChange={(e) => setTextBody(e.target.value)}
            className={classes.field}
          />
        </Grid>
      </Grid>

      <div className={classes.actions}>
        <Button
          variant="contained"
          color="primary"
          onClick={handleTestSendText}
          disabled={
            loading || reconnecting || sendingTextTest || sendingTemplateTest
          }
        >
          {sendingTextTest ? (
            <CircularProgress size={18} color="inherit" />
          ) : (
            i18n.t("connectionSuite.diagnostics.textTest")
          )}
        </Button>
      </div>

      <Divider style={{ marginTop: 16, marginBottom: 16 }} />

      <Typography className={classes.title}>
        {i18n.t("connectionSuite.diagnostics.templateTest")}
      </Typography>
      <Typography className={classes.subtitle}>
        {i18n.t("connectionSuite.diagnostics.templateTestHelp")}
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <TextField
            label={i18n.t("connectionSuite.diagnostics.templateName")}
            variant="outlined"
            fullWidth
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="Ex.: teste_onboarding"
            className={classes.field}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            label={i18n.t("connectionSuite.diagnostics.templateLanguage")}
            variant="outlined"
            fullWidth
            value={templateLanguageCode}
            onChange={(e) => setTemplateLanguageCode(e.target.value)}
            placeholder="Ex.: pt_BR"
            className={classes.field}
          />
        </Grid>

        <Grid item xs={12}>
          <TextField
            label={i18n.t("connectionSuite.diagnostics.templateParameters")}
            variant="outlined"
            fullWidth
            value={templateParametersRaw}
            onChange={(e) => setTemplateParametersRaw(e.target.value)}
            placeholder="Ex.: João, Multizap, 15/04/2026"
            helperText={i18n.t("connectionSuite.diagnostics.parametersHelp")}
            className={classes.field}
          />
        </Grid>
      </Grid>

      <div className={classes.actions}>
        <Button
          variant="contained"
          color="primary"
          onClick={handleTestSendTemplate}
          disabled={
            loading || reconnecting || sendingTextTest || sendingTemplateTest
          }
        >
          {sendingTemplateTest ? (
            <CircularProgress size={18} color="inherit" />
          ) : (
            i18n.t("connectionSuite.diagnostics.templateTest")
          )}
        </Button>

        <Button
          variant="outlined"
          color="primary"
          onClick={loadDiagnostics}
          disabled={
            loading || reconnecting || sendingTextTest || sendingTemplateTest
          }
        >
          {i18n.t("connectionSuite.diagnostics.update")}
        </Button>

        <Button
          variant="outlined"
          color="secondary"
          onClick={handleReconnect}
          disabled={
            loading || reconnecting || sendingTextTest || sendingTemplateTest
          }
        >
          {reconnecting ? (
            <CircularProgress size={18} />
          ) : (
            i18n.t("connectionSuite.diagnostics.reconnect")
          )}
        </Button>
      </div>
    </Paper>
  );
};

export default OfficialConnectionDiagnostics;
