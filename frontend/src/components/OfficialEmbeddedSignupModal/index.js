import React, { useCallback, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  TextField,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  Grid,
  Paper,
  RadioGroup,
  FormControlLabel,
  Radio,
  Divider
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import {
  launchEmbeddedSignup,
  extractEmbeddedSignupData
} from "../../services/metaEmbeddedSignup";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  root: {},
  dialogContent: {
    minWidth: 720,
    paddingTop: theme.spacing(2)
  },
  paperOption: {
    padding: theme.spacing(2),
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.12)"
  },
  sectionTitle: {
    fontWeight: 700,
    marginBottom: theme.spacing(1)
  },
  helperText: {
    marginTop: theme.spacing(1),
    color: theme.palette.text.secondary
  },
  actionsLeft: {
    marginRight: "auto"
  },
  statusBox: {
    padding: theme.spacing(2),
    borderRadius: 12,
    background: theme.palette.background.default,
    border: "1px solid rgba(0,0,0,0.08)",
    marginTop: theme.spacing(2)
  },
  fieldSpacing: {
    marginTop: theme.spacing(2)
  },
  stepper: {
    paddingLeft: 0,
    paddingRight: 0,
    paddingTop: 0,
    marginBottom: theme.spacing(2)
  }
}));

const steps = [
  "connectionSuite.common.stepType",
  "connectionSuite.common.stepMeta",
  "connectionSuite.common.stepFinish"
];

const OfficialEmbeddedSignupModal = ({
  open,
  onClose,
  onSave,
  initialName = "",
  initialTestNumber = ""
}) => {
  const classes = useStyles();

  const [activeStep, setActiveStep] = useState(0);
  const [mode, setMode] = useState("cloudapi_new");
  const [connectionName, setConnectionName] = useState(initialName);
  const [testNumber, setTestNumber] = useState(initialTestNumber);
  const [loading, setLoading] = useState(false);
  const [metaLoading, setMetaLoading] = useState(false);
  const [config, setConfig] = useState(null);
  const [embeddedData, setEmbeddedData] = useState(null);
  const [result, setResult] = useState(null);

  const resetState = useCallback(() => {
    setActiveStep(0);
    setMode("cloudapi_new");
    setConnectionName(initialName || "");
    setTestNumber(initialTestNumber || "");
    setLoading(false);
    setMetaLoading(false);
    setConfig(null);
    setEmbeddedData(null);
    setResult(null);
  }, [initialName, initialTestNumber]);

  const handleClose = useCallback(() => {
    if (loading || metaLoading) {
      return;
    }

    resetState();

    if (onClose) {
      onClose();
    }
  }, [loading, metaLoading, onClose, resetState]);

  const modeLabel = useMemo(() => {
    return mode === "coexistence"
      ? i18n.t("connectionSuite.embedded.currentNumber")
      : i18n.t("connectionSuite.embedded.newNumber");
  }, [mode]);

  const startEmbeddedSignup = useCallback(async () => {
    try {
      setLoading(true);

      const { data } = await api.post("/embedded-signup/start", {
        mode
      });

      const responseConfig = data?.config || data || {};
      const normalizedConfig = {
        appId: responseConfig.appId || data?.appId || "",
        configId: responseConfig.configId || data?.configId || "",
        apiVersion: responseConfig.apiVersion || data?.apiVersion || "v25.0",
        mode: responseConfig.mode || data?.mode || mode
      };

      if (!normalizedConfig.appId) {
        throw new Error("META_APP_ID não configurado no backend.");
      }

      if (!normalizedConfig.configId) {
        throw new Error("META_EMBEDDED_SIGNUP_CONFIG_ID não configurado no backend.");
      }

      setConfig(normalizedConfig);
      setLoading(false);
      setMetaLoading(true);

      const launchResult = await launchEmbeddedSignup({
        appId: normalizedConfig.appId,
        configId: normalizedConfig.configId,
        apiVersion: normalizedConfig.apiVersion,
        mode: normalizedConfig.mode
      });

      const extracted = extractEmbeddedSignupData(launchResult);

      if (!extracted.code) {
        throw new Error("A Meta não retornou o code do onboarding.");
      }

      if (!extracted.wabaId) {
        throw new Error("A Meta não retornou o WABA ID do onboarding.");
      }

      if (!extracted.phoneNumberId) {
        throw new Error("A Meta não retornou o Phone Number ID do onboarding.");
      }

      setEmbeddedData(extracted);
      setActiveStep(1);
      setMetaLoading(false);
      toast.success(i18n.t("connectionSuite.embedded.capturedSuccess"));
    } catch (error) {
      setLoading(false);
      setMetaLoading(false);
      toastError(error);
    }
  }, [mode]);

  const completeEmbeddedSignup = useCallback(async () => {
    try {
      if (!embeddedData?.code || !embeddedData?.wabaId || !embeddedData?.phoneNumberId) {
      toast.error(i18n.t("connectionSuite.embedded.incompleteData"));
        return;
      }

      setLoading(true);

      const payload = {
        code: embeddedData.code,
        wabaId: embeddedData.wabaId,
        phoneNumberId: embeddedData.phoneNumberId,
        businessId: embeddedData.businessId || "",
        mode,
        name: connectionName,
        number: "",
        testNumber
      };

      const { data } = await api.post("/embedded-signup/complete", payload);

      const finalData = data?.data || data;
      setResult(finalData);
      setActiveStep(2);
      setLoading(false);

      toast.success(i18n.t("connectionSuite.embedded.completed"));

      if (onSave) {
        onSave(finalData);
      }
    } catch (error) {
      setLoading(false);
      toastError(error);
    }
  }, [embeddedData, mode, connectionName, testNumber, onSave]);

  const renderStepContent = () => {
    if (activeStep === 0) {
      return (
        <>
          <Typography className={classes.sectionTitle}>
        {i18n.t("connectionSuite.embedded.chooseType")}
          </Typography>

          <RadioGroup
            value={mode}
            onChange={(e) => setMode(e.target.value)}
          >
            <Paper className={classes.paperOption} elevation={0}>
              <FormControlLabel
                value="cloudapi_new"
                control={<Radio color="primary" />}
                label={i18n.t("connectionSuite.embedded.newNumber")}
              />
              <Typography variant="body2" className={classes.helperText}>
                  {i18n.t("connectionSuite.embedded.newNumberHelp")}
              </Typography>
            </Paper>

            <div style={{ height: 12 }} />

            <Paper className={classes.paperOption} elevation={0}>
              <FormControlLabel
                value="coexistence"
                control={<Radio color="primary" />}
                label={i18n.t("connectionSuite.embedded.currentNumber")}
              />
              <Typography variant="body2" className={classes.helperText}>
                  {i18n.t("connectionSuite.embedded.currentNumberHelp")}
              </Typography>
            </Paper>
          </RadioGroup>

          <TextField
            className={classes.fieldSpacing}
            label={i18n.t("connectionSuite.embedded.connectionName")}
            variant="outlined"
            fullWidth
            value={connectionName}
            onChange={(e) => setConnectionName(e.target.value)}
            placeholder="Ex.: API Oficial Comercial"
          />

          <TextField
            className={classes.fieldSpacing}
            label={i18n.t("connectionSuite.embedded.finalTestNumber")}
            variant="outlined"
            fullWidth
            value={testNumber}
            onChange={(e) => setTestNumber(e.target.value)}
            placeholder="Ex.: 5532999999999"
          />

          <div className={classes.statusBox}>
            <Typography variant="subtitle2">
              {i18n.t("connectionSuite.embedded.selectedMode")}: {modeLabel}
            </Typography>
            <Typography variant="body2" className={classes.helperText}>
              {i18n.t("connectionSuite.embedded.continueHelp")}
            </Typography>
          </div>
        </>
      );
    }

    if (activeStep === 1) {
      return (
        <>
          <Typography className={classes.sectionTitle}>
            {i18n.t("connectionSuite.embedded.capturedData")}
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                label="WABA ID"
                variant="outlined"
                fullWidth
                value={embeddedData?.wabaId || ""}
                InputProps={{ readOnly: true }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                label="Phone Number ID"
                variant="outlined"
                fullWidth
                value={embeddedData?.phoneNumberId || ""}
                InputProps={{ readOnly: true }}
              />
            </Grid>
          </Grid>

          <TextField
            className={classes.fieldSpacing}
            label="Business ID"
            variant="outlined"
            fullWidth
            value={embeddedData?.businessId || ""}
            placeholder="Será consultado automaticamente se a Meta não retornar"
            InputProps={{ readOnly: true }}
          />

          <TextField
            className={classes.fieldSpacing}
            label={i18n.t("connectionSuite.embedded.returnedCode")}
            variant="outlined"
            fullWidth
            value={embeddedData?.code || ""}
            InputProps={{ readOnly: true }}
          />

          <div className={classes.statusBox}>
            <Typography variant="subtitle2">
              {i18n.t("connectionSuite.embedded.nextStep")}
            </Typography>
            <Typography variant="body2" className={classes.helperText}>
              {i18n.t("connectionSuite.embedded.nextStepHelp")}
            </Typography>
          </div>
        </>
      );
    }

    return (
      <>
        <Typography className={classes.sectionTitle}>
          {result?.embeddedSignupStatus === "completed"
            ? i18n.t("connectionSuite.embedded.createdSuccess")
            : i18n.t("connectionSuite.embedded.createdPending")}
        </Typography>

        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField
              label={i18n.t("connectionSuite.embedded.connectionId")}
              variant="outlined"
              fullWidth
              value={result?.whatsappId || ""}
              InputProps={{ readOnly: true }}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              label={i18n.t("connectionSuite.modal.onboardingStatus")}
              variant="outlined"
              fullWidth
              value={result?.embeddedSignupStatus || ""}
              InputProps={{ readOnly: true }}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              label="WABA ID"
              variant="outlined"
              fullWidth
              value={result?.waba_id || ""}
              InputProps={{ readOnly: true }}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              label="Phone Number ID"
              variant="outlined"
              fullWidth
              value={result?.phone_number_id || ""}
              InputProps={{ readOnly: true }}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              label={i18n.t("connectionSuite.modal.displayedNumber")}
              variant="outlined"
              fullWidth
              value={result?.phone_number || ""}
              InputProps={{ readOnly: true }}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              label={i18n.t("connectionSuite.modal.verifiedName")}
              variant="outlined"
              fullWidth
              value={result?.verified_name || ""}
              InputProps={{ readOnly: true }}
            />
          </Grid>
        </Grid>

        <Divider className={classes.fieldSpacing} />

        <div className={classes.statusBox}>
          <Typography variant="subtitle2">
            {i18n.t("connectionSuite.embedded.diagnostic")}
          </Typography>
          <Typography variant="body2" className={classes.helperText}>
            {i18n.t("connectionSuite.common.status")}: {result?.diagnostics?.status || "N/D"}
          </Typography>
          <Typography variant="body2" className={classes.helperText}>
            {i18n.t("connectionSuite.common.details")}: {result?.diagnostics?.details || "-"}
          </Typography>
          <Typography variant="body2" className={classes.helperText}>
            {i18n.t("connectionSuite.modal.signedWebhook")}: {result?.webhookSubscribed ? i18n.t("plans.form.yes") : i18n.t("plans.form.no")}
          </Typography>
        </div>
      </>
    );
  };

  const primaryButtonLabel = useMemo(() => {
    if (metaLoading) {
      return i18n.t("connectionSuite.common.waitingMeta");
    }

    if (loading) {
      return i18n.t("connectionSuite.common.processing");
    }

    if (activeStep === 0) {
      return i18n.t("connectionSuite.common.stepMeta");
    }

    if (activeStep === 1) {
      return i18n.t("connectionSuite.common.finishOnboarding");
    }

    return i18n.t("connectionSuite.common.close");
  }, [activeStep, loading, metaLoading]);

  const handlePrimaryAction = async () => {
    if (activeStep === 0) {
      await startEmbeddedSignup();
      return;
    }

    if (activeStep === 1) {
      await completeEmbeddedSignup();
      return;
    }

    handleClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="md"
      aria-labelledby="official-embedded-signup-dialog"
    >
      <DialogTitle id="official-embedded-signup-dialog">
        {i18n.t("connectionSuite.embedded.title")}
      </DialogTitle>

      <DialogContent className={classes.dialogContent}>
        <Stepper activeStep={activeStep} alternativeLabel className={classes.stepper}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{i18n.t(label)}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {renderStepContent()}
      </DialogContent>

      <DialogActions>
        <div className={classes.actionsLeft}>
          {(loading || metaLoading) && <CircularProgress size={24} />}
        </div>

        <Button
          onClick={handleClose}
          disabled={loading || metaLoading}
        >
          {i18n.t("wallets.cancel")}
        </Button>

        {activeStep === 1 && (
          <Button
            onClick={() => setActiveStep(0)}
            disabled={loading || metaLoading}
          >
            {i18n.t("campaignReport.backButton")}
          </Button>
        )}

        <Button
          variant="contained"
          color="primary"
          onClick={handlePrimaryAction}
          disabled={loading || metaLoading}
        >
          {primaryButtonLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default OfficialEmbeddedSignupModal;
