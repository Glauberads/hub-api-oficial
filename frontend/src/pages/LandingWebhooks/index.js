import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import {
  Button,
  Grid,
  Paper,
  TextField,
  Typography,
  Switch,
  FormControlLabel,
  Divider,
  Box,
  IconButton,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  Chip,
  MenuItem
} from "@material-ui/core";
import {
  Add as AddIcon,
  Save as SaveIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  FileCopy as FileCopyIcon,
  Refresh as RefreshIcon
} from "@material-ui/icons";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import toastError from "../../errors/toastError";
import api from "../../services/api";

import {
  listLandingWebhooks,
  createLandingWebhook,
  updateLandingWebhook,
  deleteLandingWebhook,
  listLandingWebhookLogs
} from "../../services/landingWebhooks";
import { i18n } from "../../translate/i18n";

const isBaileysConnection = whatsapp => {
  const values = [
    whatsapp?.type,
    whatsapp?.channel,
    whatsapp?.provider,
    whatsapp?.connectionType,
    whatsapp?.integrationType,
    whatsapp?.driver,
    whatsapp?.kind,
    whatsapp?.name
  ]
    .filter(Boolean)
    .map(value => String(value).toLowerCase());

  const hasOfficialField =
    Boolean(whatsapp?.phoneNumberId) ||
    Boolean(whatsapp?.phone_number_id) ||
    Boolean(whatsapp?.wabaId) ||
    Boolean(whatsapp?.waba_id) ||
    Boolean(whatsapp?.whatsappOficialId) ||
    Boolean(whatsapp?.officialWhatsappId) ||
    Boolean(whatsapp?.isOfficial) ||
    Boolean(whatsapp?.isOficial);

  const hasOfficialText = values.some(value =>
    value.includes("oficial") ||
    value.includes("official") ||
    value.includes("whatsapp_oficial") ||
    value.includes("api oficial")
  );

  return !hasOfficialField && !hasOfficialText;
};

const normalizeWhatsappList = data => {
  const list = Array.isArray(data)
    ? data
    : data?.whatsapps || data?.data || data?.rows || [];

  return list.filter(isBaileysConnection);
};

const defaultForm = {
  id: null,
  name: "",
  whatsappId: "",
  queueId: "",
  userId: "",
  flowId: "",
  tagsText: "Lead, Landing Page",
  welcomeMessage:
    "Olá {{name}}, recebemos seu cadastro sobre {{product}}. Em instantes vamos falar com você por aqui.",
  autoSendMessage: true,
  autoStartFlow: false,
  isActive: true
};

const LandingWebhooks = () => {
  const [loading, setLoading] = useState(false);
  const [configs, setConfigs] = useState([]);
  const [logs, setLogs] = useState([]);
  const [whatsapps, setWhatsapps] = useState([]);
  const [queues, setQueues] = useState([]);
  const [users, setUsers] = useState([]);
  const [flows, setFlows] = useState([]);
  const [form, setForm] = useState(defaultForm);

  const loadConfigs = async () => {
    try {
      setLoading(true);
      const data = await listLandingWebhooks();
      setConfigs(data || []);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    try {
      const data = await listLandingWebhookLogs({
        pageNumber: 1
      });

      setLogs(data?.logs || []);
    } catch (err) {
      toastError(err);
    }
  };

  const normalizeList = data => {
    if (Array.isArray(data)) return data;

    if (Array.isArray(data?.whatsapps)) return data.whatsapps;
    if (Array.isArray(data?.queues)) return data.queues;
    if (Array.isArray(data?.users)) return data.users;
    if (Array.isArray(data?.flows)) return data.flows;
    if (Array.isArray(data?.flowbuilders)) return data.flowbuilders;
    if (Array.isArray(data?.data)) return data.data;

    return [];
  };

  const loadSelectOptions = async () => {
    try {
      const [whatsappsResponse, queuesResponse, usersResponse, flowsResponse] =
        await Promise.all([
          api.get("/whatsapp/?session=0"),
          api.get("/queue"),
          api.get("/users/"),
          api.get("/flowbuilder")
        ]);

      setWhatsapps(normalizeWhatsappList(whatsappsResponse.data));
      setQueues(normalizeList(queuesResponse.data));
      setUsers(normalizeList(usersResponse.data));
      setFlows(normalizeList(flowsResponse.data));
    } catch (err) {
      toastError(err);
    }
  };

  useEffect(() => {
    loadConfigs();
    loadLogs();
    loadSelectOptions();
  }, []);

  const handleChange = e => {
    const { name, value } = e.target;

    setForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSwitchChange = e => {
    const { name, checked } = e.target;

    setForm(prev => ({
      ...prev,
      [name]: checked
    }));
  };

  const parseTags = tagsText => {
    if (!tagsText) return [];

    return tagsText
      .split(",")
      .map(tag => tag.trim())
      .filter(Boolean);
  };

  const buildPayload = () => {
    return {
      name: form.name,
      whatsappId: form.whatsappId ? Number(form.whatsappId) : null,
      queueId: form.queueId ? Number(form.queueId) : null,
      userId: form.userId ? Number(form.userId) : null,
      flowId: form.flowId ? Number(form.flowId) : null,
      tags: parseTags(form.tagsText),
      welcomeMessage: form.welcomeMessage,
      autoSendMessage: form.autoSendMessage,
      autoStartFlow: form.autoStartFlow,
      isActive: form.isActive
    };
  };

  const handleSubmit = async e => {
    e.preventDefault();

    if (!form.name.trim()) {
      toast.error(i18n.t("marketing.landing.nameRequired"));
      return;
    }

    try {
      setLoading(true);

      const payload = buildPayload();

      if (form.id) {
        await updateLandingWebhook(form.id, payload);
        toast.success(i18n.t("marketing.landing.updated"));
      } else {
        await createLandingWebhook(payload);
        toast.success(i18n.t("marketing.landing.created"));
      }

      setForm(defaultForm);
      await loadConfigs();
      await loadLogs();
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = config => {
    setForm({
      id: config.id,
      name: config.name || "",
      whatsappId: config.whatsappId ? String(config.whatsappId) : "",
      queueId: config.queueId ? String(config.queueId) : "",
      userId: config.userId ? String(config.userId) : "",
      flowId: config.flowId ? String(config.flowId) : "",
      tagsText: Array.isArray(config.tags) ? config.tags.join(", ") : "",
      welcomeMessage: config.welcomeMessage || "",
      autoSendMessage: !!config.autoSendMessage,
      autoStartFlow: !!config.autoStartFlow,
      isActive: !!config.isActive
    });

    const scrollContainer = document.getElementById("landing-webhooks-scroll");

    if (scrollContainer) {
      scrollContainer.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    }
  };

  const handleDelete = async id => {
    try {
      await deleteLandingWebhook(id);
      toast.success(i18n.t("marketing.landing.deleted"));
      await loadConfigs();
      await loadLogs();
    } catch (err) {
      toastError(err);
    }
  };

  const copyToClipboard = text => {
    if (!text) return;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      toast.success(i18n.t("marketing.landing.urlCopied"));
      return;
    }

    const input = document.createElement("input");
    input.value = text;
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    document.body.removeChild(input);

    toast.success(i18n.t("marketing.landing.urlCopied"));
  };

  const handleNew = () => {
    setForm(defaultForm);
  };

  const renderStatusChip = status => {
    if (status === "success") {
      return <Chip size="small" label={i18n.t("marketing.landing.success")} color="primary" />;
    }

    if (status === "success_message_error") {
      return <Chip size="small" label={i18n.t("marketing.landing.partialSuccess")} />;
    }

    if (status === "error") {
      return <Chip size="small" label={i18n.t("marketing.landing.error")} color="secondary" />;
    }

    if (status === "inactive") {
      return <Chip size="small" label={i18n.t("announcements.inactive")} />;
    }

    return <Chip size="small" label={status || "Pendente"} />;
  };

  return (
    <MainContainer>
      <div
        id="landing-webhooks-scroll"
        style={{
          width: "100%",
          height: "calc(100vh - 70px)",
          overflowY: "auto",
          overflowX: "hidden",
          padding: "0 0 120px 0"
        }}
      >
        <MainHeader>
          <Title>{i18n.t("marketing.landing.title")}</Title>
          <Button
            variant="contained"
            color="primary"
            startIcon={<RefreshIcon />}
            onClick={() => {
              loadConfigs();
              loadLogs();
            }}
            disabled={loading}
          >
            {i18n.t("mainDrawer.appBar.refresh")}
          </Button>
        </MainHeader>

        <Paper style={{ padding: 20, marginBottom: 20 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">
              {form.id ? i18n.t("marketing.landing.edit") : i18n.t("marketing.landing.new")}
            </Typography>

            <Button
              variant="outlined"
              color="primary"
              startIcon={<AddIcon />}
              onClick={handleNew}
            >
              {i18n.t("marketing.landing.newShort")}
            </Button>
          </Box>

          <Divider style={{ margin: "16px 0" }} />

          <form onSubmit={handleSubmit}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  label={i18n.t("marketing.landing.name")}
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  variant="outlined"
                  fullWidth
                  required
                  placeholder={i18n.t("marketing.landing.nameExample")}
                />
              </Grid>

              <Grid item xs={12} md={2}>
                <TextField
                  select
                  label={i18n.t("marketing.landing.whatsappConnection")}
                  name="whatsappId"
                  value={form.whatsappId}
                  onChange={handleChange}
                  variant="outlined"
                  fullWidth
                >
                  <MenuItem value="">{i18n.t("marketing.landing.select")}</MenuItem>
                  {whatsapps.filter(isBaileysConnection).map(whatsapp => (
                    <MenuItem key={whatsapp.id} value={String(whatsapp.id)}>
                      {whatsapp.name || i18n.t("marketing.landing.connectionNumber", { id: whatsapp.id })}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid item xs={12} md={2}>
                <TextField
                  select
                  label={i18n.t("wallets.queue")}
                  name="queueId"
                  value={form.queueId}
                  onChange={handleChange}
                  variant="outlined"
                  fullWidth
                >
                  <MenuItem value="">{i18n.t("queueSelect.withoutQueue")}</MenuItem>
                  {queues.map(queue => (
                    <MenuItem key={queue.id} value={String(queue.id)}>
                      {queue.name || `Fila ${queue.id}`}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid item xs={12} md={2}>
                <TextField
                  select
                  label={i18n.t("wallets.user")}
                  name="userId"
                  value={form.userId}
                  onChange={handleChange}
                  variant="outlined"
                  fullWidth
                >
                  <MenuItem value="">{i18n.t("marketing.landing.noUser")}</MenuItem>
                  {users.map(user => (
                    <MenuItem key={user.id} value={String(user.id)}>
                      {user.name || user.email || i18n.t("marketing.landing.userNumber", { id: user.id })}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid item xs={12} md={3}>
                <TextField
                  select
                  label={i18n.t("marketing.landing.flow")}
                  name="flowId"
                  value={form.flowId}
                  onChange={handleChange}
                  variant="outlined"
                  fullWidth
                >
                  <MenuItem value="">{i18n.t("marketing.landing.noFlow")}</MenuItem>
                  {flows.map(flow => (
                    <MenuItem key={flow.id} value={String(flow.id)}>
                      {flow.name || flow.flowName || flow.title || `Fluxo ${flow.id}`}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid item xs={12} md={9}>
                <TextField
                  label={i18n.t("marketing.landing.autoTags")}
                  name="tagsText"
                  value={form.tagsText}
                  onChange={handleChange}
                  variant="outlined"
                  fullWidth
                  placeholder={i18n.t("marketing.landing.tagsExample")}
                  helperText={i18n.t("marketing.landing.tagsHelp")}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  label={i18n.t("marketing.landing.autoMessage")}
                  name="welcomeMessage"
                  value={form.welcomeMessage}
                  onChange={handleChange}
                  variant="outlined"
                  fullWidth
                  multiline
                  minRows={3}
                  helperText={i18n.t("marketing.landing.variablesHelp")}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.autoSendMessage}
                      onChange={handleSwitchChange}
                      name="autoSendMessage"
                      color="primary"
                    />
                  }
                  label={i18n.t("marketing.landing.sendAutoMessage")}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.autoStartFlow}
                      onChange={handleSwitchChange}
                      name="autoStartFlow"
                      color="primary"
                    />
                  }
                  label={i18n.t("marketing.landing.startFlow")}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.isActive}
                      onChange={handleSwitchChange}
                      name="isActive"
                      color="primary"
                    />
                  }
                  label={i18n.t("marketing.landing.active")}
                />
              </Grid>

              <Grid item xs={12}>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  startIcon={<SaveIcon />}
                  disabled={loading}
                >
                  {form.id ? i18n.t("marketing.landing.saveChanges") : i18n.t("marketing.landing.createIntegration")}
                </Button>
              </Grid>
            </Grid>
          </form>
        </Paper>

        <Paper style={{ padding: 20, marginBottom: 20 }}>
          <Typography variant="h6">{i18n.t("marketing.landing.createdIntegrations")}</Typography>

          <Divider style={{ margin: "16px 0" }} />

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{i18n.t("plans.form.name")}</TableCell>
                  <TableCell>{i18n.t("marketing.landing.webhookUrl")}</TableCell>
                  <TableCell>{i18n.t("financial.status")}</TableCell>
                  <TableCell align="center">{i18n.t("wallets.actions")}</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {configs.map(config => (
                  <TableRow key={config.id}>
                    <TableCell>
                      <Typography variant="body2">
                        <strong>{config.name}</strong>
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {i18n.t("marketing.landing.whatsappId")} {config.whatsappId || "-"} {i18n.t("marketing.landing.queueId")}{" "}
                        {config.queueId || "-"}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <TextField
                        value={config.webhookUrl || ""}
                        variant="outlined"
                        size="small"
                        fullWidth
                        InputProps={{
                          readOnly: true
                        }}
                      />
                    </TableCell>

                    <TableCell>
                      {config.isActive ? (
                        <Chip size="small" label={i18n.t("announcements.active")} color="primary" />
                      ) : (
                        <Chip size="small" label={i18n.t("announcements.inactive")} />
                      )}
                    </TableCell>

                    <TableCell align="center">
                      <Tooltip title={i18n.t("marketing.landing.copyUrl")}>
                        <IconButton
                          size="small"
                          onClick={() => copyToClipboard(config.webhookUrl)}
                        >
                          <FileCopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>

                      <Tooltip title={i18n.t("chatList.edit")}>
                        <IconButton size="small" onClick={() => handleEdit(config)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>

                      <Tooltip title={i18n.t("chatList.delete")}>
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(config.id)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}

                {!configs.length && (
                  <TableRow>
                    <TableCell colSpan={4}>
                      <Typography color="textSecondary">
                        {i18n.t("marketing.landing.empty")}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        <Paper style={{ padding: 20 }}>
          <Typography variant="h6">{i18n.t("marketing.landing.latestLeads")}</Typography>

          <Divider style={{ margin: "16px 0" }} />

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{i18n.t("financial.status")}</TableCell>
                  <TableCell>{i18n.t("queueModal.bot.integration")}</TableCell>
                  <TableCell>{i18n.t("wallets.contact")}</TableCell>
                  <TableCell>{i18n.t("reports.table.id")}</TableCell>
                  <TableCell>{i18n.t("marketing.landing.error")}</TableCell>
                  <TableCell>{i18n.t("schedules.date")}</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {logs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell>{renderStatusChip(log.status)}</TableCell>

                    <TableCell>{log.config?.name || "-"}</TableCell>

                    <TableCell>
                      {log.contact ? (
                        <>
                          <Typography variant="body2">{log.contact.name}</Typography>
                          <Typography variant="caption" color="textSecondary">
                            {log.contact.number}
                          </Typography>
                        </>
                      ) : (
                        "-"
                      )}
                    </TableCell>

                    <TableCell>{log.ticketId || "-"}</TableCell>

                    <TableCell>{log.errorMessage || "-"}</TableCell>

                    <TableCell>
                      {log.createdAt
                        ? new Date(log.createdAt).toLocaleString("pt-BR")
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))}

                {!logs.length && (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Typography color="textSecondary">
                        {i18n.t("marketing.landing.noLeads")}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </div>
    </MainContainer>
  );
};

export default LandingWebhooks;
