import React, { useContext, useEffect, useState } from "react";
import {
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { Add, DeleteOutline, Edit } from "@material-ui/icons";
import { toast } from "react-toastify";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";
import ConfirmationModal from "../../components/ConfirmationModal";
import ForbiddenPage from "../../components/ForbiddenPage";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles(theme => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(2),
    margin: theme.spacing(1),
    overflowY: "auto",
    ...theme.scrollbarStyles
  },
  statusChip: {
    fontWeight: 600
  },
  helperText: {
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(2)
  },
  textArea: {
    "& textarea": {
      fontFamily: "inherit"
    }
  },
  sectionTitle: {
    fontWeight: 700,
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1)
  }
}));

const defaultConfig = {
  name: "Agente IA Comercial",
  enabled: false,
  whatsappId: "",
  queueId: "",
  userId: "",
  model: "gpt-4o-mini",
  temperature: 0.3,
  systemPrompt: "",
  welcomeMessage: "Olá! Vou te ajudar rapidinho. Me conta o que você procura?",
  qualificationQuestionsText:
    "Qual produto ou serviço você procura?\nQual sua cidade?\nVocê tem um orçamento aproximado?",
  tagsText: "agente_ia\nlead_qualificado",
  autoCreateOpportunity: true,
  autoTransferQueue: true,
  onlyPendingTickets: true,
  maxInteractions: 8,
  isActive: true
};

const normalizeConfigToForm = config => {
  const questions = Array.isArray(config?.qualificationQuestions)
    ? config.qualificationQuestions
        .map(question => question?.label || question?.key || "")
        .filter(Boolean)
        .join("\n")
    : defaultConfig.qualificationQuestionsText;

  const tags = Array.isArray(config?.tags)
    ? config.tags.map(tag => String(tag || "")).filter(Boolean).join("\n")
    : defaultConfig.tagsText;

  return {
    ...defaultConfig,
    ...config,
    whatsappId: config?.whatsappId || "",
    queueId: config?.queueId || "",
    userId: config?.userId || "",
    qualificationQuestionsText: questions,
    tagsText: tags
  };
};

const buildPayload = form => {
  const qualificationQuestions = String(form.qualificationQuestionsText || "")
    .split("\n")
    .map(item => item.trim())
    .filter(Boolean)
    .map((label, index) => ({
      key: `question_${index + 1}`,
      label,
      required: true
    }));

  const tags = String(form.tagsText || "")
    .split("\n")
    .map(item => item.trim())
    .filter(Boolean);

  return {
    name: form.name,
    enabled: Boolean(form.enabled),
    whatsappId: form.whatsappId ? Number(form.whatsappId) : null,
    queueId: form.queueId ? Number(form.queueId) : null,
    userId: form.userId ? Number(form.userId) : null,
    model: form.model || "gpt-4o-mini",
    temperature: Number(form.temperature || 0.3),
    systemPrompt: form.systemPrompt || null,
    welcomeMessage: form.welcomeMessage || null,
    qualificationQuestions,
    handoffRules: {},
    tags,
    autoCreateOpportunity: Boolean(form.autoCreateOpportunity),
    autoTransferQueue: Boolean(form.autoTransferQueue),
    onlyPendingTickets: Boolean(form.onlyPendingTickets),
    maxInteractions: Number(form.maxInteractions || 8),
    isActive: Boolean(form.isActive)
  };
};

const AiSdr = () => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);

  const [configs, setConfigs] = useState([]);
  const [whatsapps, setWhatsapps] = useState([]);
  const [queues, setQueues] = useState([]);
  const [users, setUsers] = useState([]);

  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [form, setForm] = useState(defaultConfig);

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/ai-sdr/configs");
      setConfigs(Array.isArray(data) ? data : []);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  const loadOptions = async () => {
    try {
      const [whatsappRes, queueRes, userRes] = await Promise.all([
        api.get("/whatsapp/?session=0"),
        api.get("/queue"),
        api.get("/users/list")
      ]);

      const whatsappData = whatsappRes.data?.whatsapps || whatsappRes.data || [];
      const queueData = queueRes.data || [];
      const userData = userRes.data?.users || userRes.data || [];

      setWhatsapps(Array.isArray(whatsappData) ? whatsappData : []);
      setQueues(Array.isArray(queueData) ? queueData : []);
      setUsers(Array.isArray(userData) ? userData : []);
    } catch (err) {
      toastError(err);
    }
  };

  useEffect(() => {
    loadConfigs();
    loadOptions();
  }, []);

  const handleOpenModal = config => {
    setSelectedConfig(config || null);
    setForm(config ? normalizeConfigToForm(config) : defaultConfig);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setSelectedConfig(null);
    setForm(defaultConfig);
    setModalOpen(false);
  };

  const handleChange = event => {
    const { name, value, checked, type } = event.target;
    setForm(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const handleSave = async () => {
    try {
      const payload = buildPayload(form);

      if (selectedConfig?.id) {
        await api.put(`/ai-sdr/configs/${selectedConfig.id}`, payload);
        toast.success(i18n.t("adminOps.ai.updated"));
      } else {
        await api.post("/ai-sdr/configs", payload);
        toast.success(i18n.t("adminOps.ai.created"));
      }

      handleCloseModal();
      loadConfigs();
    } catch (err) {
      toastError(err);
    }
  };

  const handleToggleEnabled = async config => {
    try {
      await api.put(`/ai-sdr/configs/${config.id}`, {
        enabled: !config.enabled
      });
      toast.success(
        !config.enabled
          ? i18n.t("adminOps.ai.enabled")
          : i18n.t("adminOps.ai.disabled")
      );
      loadConfigs();
    } catch (err) {
      toastError(err);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/ai-sdr/configs/${selectedConfig.id}`);
      toast.success(i18n.t("adminOps.ai.removed"));
      setConfirmModalOpen(false);
      setSelectedConfig(null);
      loadConfigs();
    } catch (err) {
      toastError(err);
    }
  };

  const getConnectionName = config => {
    return config?.whatsapp?.name || whatsapps.find(w => w.id === config.whatsappId)?.name || i18n.t("adminOps.ai.all");
  };

  const getQueueName = config => {
    return config?.queue?.name || queues.find(q => q.id === config.queueId)?.name || i18n.t("adminOps.ai.noQueue");
  };

  const getUserName = config => {
    return config?.user?.name || users.find(u => u.id === config.userId)?.name || i18n.t("adminOps.ai.notDefined");
  };

  if (user.profile === "user") {
    return <ForbiddenPage />;
  }

  return (
    <MainContainer>
      <ConfirmationModal
        title={
          selectedConfig
            ? i18n.t("finalTouches.ai.removeNamed", { name: selectedConfig.name })
            : i18n.t("finalTouches.ai.removeTitle")
        }
        open={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={handleDelete}
      >
        {i18n.t("finalTouches.ai.removeHelp")}
      </ConfirmationModal>

      <Dialog open={modalOpen} onClose={handleCloseModal} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedConfig ? i18n.t("finalTouches.ai.editTitle") : i18n.t("finalTouches.ai.newTitle")}
        </DialogTitle>

        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography className={classes.helperText}>
                {i18n.t("finalTouches.ai.modalHelp")}
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                label={i18n.t("plans.form.name")}
                name="name"
                value={form.name}
                onChange={handleChange}
                fullWidth
                variant="outlined"
                size="small"
              />
            </Grid>

            <Grid item xs={12} md={3}>
              <FormControlLabel
                control={
                  <Switch
                    checked={Boolean(form.enabled)}
                    onChange={handleChange}
                    name="enabled"
                    color="primary"
                  />
                }
                label={i18n.t("announcements.active")}
              />
            </Grid>

            <Grid item xs={12} md={3}>
              <FormControlLabel
                control={
                  <Switch
                    checked={Boolean(form.onlyPendingTickets)}
                    onChange={handleChange}
                    name="onlyPendingTickets"
                    color="primary"
                  />
                }
                label={i18n.t("finalTouches.ai.onlyPending")}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <FormControl variant="outlined" size="small" fullWidth>
                <InputLabel>{i18n.t("reports.table.whatsapp")}</InputLabel>
                <Select
                  label={i18n.t("reports.table.whatsapp")}
                  name="whatsappId"
                  value={form.whatsappId}
                  onChange={handleChange}
                >
                  <MenuItem value="">{i18n.t("finalTouches.ai.allConnections")}</MenuItem>
                  {whatsapps.map(item => (
                    <MenuItem key={item.id} value={item.id}>
                      {item.name} {item.channel ? `(${item.channel})` : ""}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={4}>
              <FormControl variant="outlined" size="small" fullWidth>
                <InputLabel>{i18n.t("finalTouches.ai.transferQueue")}</InputLabel>
                <Select
                  label={i18n.t("finalTouches.ai.transferQueue")}
                  name="queueId"
                  value={form.queueId}
                  onChange={handleChange}
                >
                  <MenuItem value="">{i18n.t("queueSelect.withoutQueue")}</MenuItem>
                  {queues.map(item => (
                    <MenuItem key={item.id} value={item.id}>
                      {item.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={4}>
              <FormControl variant="outlined" size="small" fullWidth>
                <InputLabel>{i18n.t("queueModal.bot.attendent")}</InputLabel>
                <Select
                  label={i18n.t("queueModal.bot.attendent")}
                  name="userId"
                  value={form.userId}
                  onChange={handleChange}
                >
                  <MenuItem value="">{i18n.t("campaigns.settings.undefined")}</MenuItem>
                  {users.map(item => (
                    <MenuItem key={item.id} value={item.id}>
                      {item.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                label={i18n.t("adminOps.ai.model")}
                name="model"
                value={form.model}
                onChange={handleChange}
                fullWidth
                variant="outlined"
                size="small"
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                label={i18n.t("promptModal.form.temperature")}
                name="temperature"
                value={form.temperature}
                onChange={handleChange}
                type="number"
                inputProps={{ step: "0.1", min: "0", max: "1" }}
                fullWidth
                variant="outlined"
                size="small"
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                label={i18n.t("adminOps.ai.maxInteractions")}
                name="maxInteractions"
                value={form.maxInteractions}
                onChange={handleChange}
                type="number"
                fullWidth
                variant="outlined"
                size="small"
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label={i18n.t("adminOps.ai.welcomeMessage")}
                name="welcomeMessage"
                value={form.welcomeMessage}
                onChange={handleChange}
                fullWidth
                multiline
                minRows={2}
                variant="outlined"
                className={classes.textArea}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label={i18n.t("adminOps.ai.salesPrompt")}
                name="systemPrompt"
                value={form.systemPrompt}
                onChange={handleChange}
                fullWidth
                multiline
                minRows={5}
                variant="outlined"
                className={classes.textArea}
                placeholder={i18n.t("adminOps.ai.promptHelp")}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                label={i18n.t("adminOps.ai.questions")}
                name="qualificationQuestionsText"
                value={form.qualificationQuestionsText}
                onChange={handleChange}
                fullWidth
                multiline
                minRows={5}
                variant="outlined"
                className={classes.textArea}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                label={i18n.t("adminOps.ai.tags")}
                name="tagsText"
                value={form.tagsText}
                onChange={handleChange}
                fullWidth
                multiline
                minRows={5}
                variant="outlined"
                className={classes.textArea}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <FormControlLabel
                control={
                  <Switch
                    checked={Boolean(form.autoTransferQueue)}
                    onChange={handleChange}
                    name="autoTransferQueue"
                    color="primary"
                  />
                }
                label={i18n.t("adminOps.ai.transferHuman")}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <FormControlLabel
                control={
                  <Switch
                    checked={Boolean(form.autoCreateOpportunity)}
                    onChange={handleChange}
                    name="autoCreateOpportunity"
                    color="primary"
                  />
                }
                label={i18n.t("adminOps.ai.createOpportunity")}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <FormControlLabel
                control={
                  <Switch
                    checked={Boolean(form.isActive)}
                    onChange={handleChange}
                    name="isActive"
                    color="primary"
                  />
                }
                label={i18n.t("finalTouches.ai.validConfig")}
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleCloseModal}>{i18n.t("wallets.cancel")}</Button>
          <Button onClick={handleSave} color="primary" variant="contained">
            {i18n.t("wallets.save")}
          </Button>
        </DialogActions>
      </Dialog>

      <MainHeader>
        <Title>{i18n.t("finalTouches.ai.title")}</Title>
        <MainHeaderButtonsWrapper>
          <Button
            variant="contained"
            color="primary"
            startIcon={<Add />}
            onClick={() => handleOpenModal(null)}
          >
            {i18n.t("finalTouches.ai.newAgent")}
          </Button>
        </MainHeaderButtonsWrapper>
      </MainHeader>

      <Paper className={classes.mainPaper} variant="outlined">
        <Typography className={classes.helperText}>
          {i18n.t("finalTouches.ai.pageHelp")}
        </Typography>

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{i18n.t("plans.form.name")}</TableCell>
              <TableCell>{i18n.t("financial.status")}</TableCell>
              <TableCell>{i18n.t("reports.table.whatsapp")}</TableCell>
              <TableCell>{i18n.t("wallets.queue")}</TableCell>
              <TableCell>{i18n.t("queueModal.bot.attendent")}</TableCell>
              <TableCell>{i18n.t("finalTouches.ai.interactions")}</TableCell>
              <TableCell align="center">{i18n.t("wallets.actions")}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading && configs.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>
                  {i18n.t("finalTouches.ai.empty")}
                </TableCell>
              </TableRow>
            )}

            {configs.map(config => (
              <TableRow key={config.id}>
                <TableCell>{config.name}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    className={classes.statusChip}
                    label={config.enabled ? i18n.t("announcements.active") : i18n.t("announcements.inactive")}
                    color={config.enabled ? "primary" : "default"}
                    onClick={() => handleToggleEnabled(config)}
                  />
                </TableCell>
                <TableCell>{getConnectionName(config)}</TableCell>
                <TableCell>{getQueueName(config)}</TableCell>
                <TableCell>{getUserName(config)}</TableCell>
                <TableCell>{config.maxInteractions}</TableCell>
                <TableCell align="center">
                  <Tooltip title={i18n.t("chatList.edit")}>
                    <IconButton size="small" onClick={() => handleOpenModal(config)}>
                      <Edit />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={i18n.t("finalTouches.common.remove")}>
                    <IconButton
                      size="small"
                      onClick={() => {
                        setSelectedConfig(config);
                        setConfirmModalOpen(true);
                      }}
                    >
                      <DeleteOutline />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </MainContainer>
  );
};

export default AiSdr;
