import React, { useState, useEffect, useContext, useRef } from "react";

import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import CircularProgress from "@material-ui/core/CircularProgress";
import Select from "@material-ui/core/Select";
import InputLabel from "@material-ui/core/InputLabel";
import MenuItem from "@material-ui/core/MenuItem";
import FormControl from "@material-ui/core/FormControl";
import whatsappIcon from "../../assets/nopicture.png";
import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import QueueSelect from "../QueueSelect";
import { AuthContext } from "../../context/Auth/AuthContext";
import useWhatsApps from "../../hooks/useWhatsApps";

import { Can } from "../Can";
import { Avatar, Chip, Grid, Input, Paper, Tab, Tabs } from "@material-ui/core";
import { getBackendUrl } from "../../config";
import TabPanel from "../TabPanel";
import AvatarUploader from "../AvatarUpload";

const backendUrl = getBackendUrl();

const TIMEZONES = [
  { value: "America/Noronha", label: "Brasil - Fernando de Noronha (GMT-2)" },
  { value: "America/Sao_Paulo", label: "Brasil - Brasília / São Paulo (GMT-3)" },
  { value: "America/Belem", label: "Brasil - Belém (GMT-3)" },
  { value: "America/Manaus", label: "Brasil - Manaus / Amazonas (GMT-4)" },
  { value: "America/Rio_Branco", label: "Brasil - Rio Branco / Acre (GMT-5)" },
  { value: "America/Mexico_City", label: "México - Cidade do México" },
  { value: "America/Bogota", label: "Colômbia - Bogotá" },
  { value: "America/Lima", label: "Peru - Lima" },
  { value: "America/Montevideo", label: "Uruguai - Montevidéu" },
  { value: "America/New_York", label: "EUA - New York" },
  { value: "America/Los_Angeles", label: "EUA - Los Angeles" },
  { value: "Europe/Lisbon", label: "Portugal - Lisboa" },
  { value: "Europe/London", label: "Reino Unido - Londres" },
  { value: "Europe/Madrid", label: "Espanha - Madrid" },
  { value: "Europe/Berlin", label: "Alemanha - Berlim" },
  { value: "Europe/Rome", label: "Itália - Roma" },
  { value: "Africa/Johannesburg", label: "África do Sul - Joanesburgo" },
  { value: "Asia/Dubai", label: "Emirados Árabes - Dubai" },
  { value: "Asia/Tokyo", label: "Japão - Tóquio" },
  { value: "Asia/Singapore", label: "Singapura" },
  { value: "Australia/Sydney", label: "Austrália - Sydney" }
];

const formatDateForInput = (date) => {
  if (!date) return '';

  // Se já está no formato YYYY-MM-DD, retorna como está
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }

  // Se é uma data ISO ou objeto Date, converte para YYYY-MM-DD
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';

  // Usar métodos locais para evitar problemas de timezone
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const parseDateFromInput = (dateString) => {
  if (!dateString) return null;

  // Se já está no formato YYYY-MM-DD, retorna como está
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString;
  }

  // Se é uma data ISO, extrai apenas a parte da data
  if (dateString.includes('T')) {
    return dateString.split('T')[0];
  }

  return dateString;
};

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexWrap: "wrap",
  },
  multFieldLine: {
    display: "flex",
    "& > *:not(:last-child)": {
      marginRight: theme.spacing(1),
    },
  },
  btnWrapper: {
    position: "relative",
  },
  buttonProgress: {
    color: green[500],
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -12,
    marginLeft: -12,
  },
  formControl: {
    margin: theme.spacing(1),
    minWidth: 120,
  },
  textField: {
    marginRight: theme.spacing(1),
    flex: 1,
  },
  container: {
    display: "flex",
    flexWrap: "wrap",
  },
  avatar: {
    width: theme.spacing(12),
    height: theme.spacing(12),
    margin: theme.spacing(2),
    cursor: "pointer",
    borderRadius: "50%",
    border: "2px solid #ccc",
  },
  updateDiv: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
  updateInput: {
    display: "none",
  },
  updateLabel: {
    padding: theme.spacing(1),
    margin: theme.spacing(1),
    textTransform: "uppercase",
    textAlign: "center",
    cursor: "pointer",
    border: "2px solid #ccc",
    borderRadius: "5px",
    minWidth: 160,
    fontWeight: "bold",
    color: "#555",
  },
  errorUpdate: {
    border: "2px solid red",
  },
  errorText: {
    color: "red",
    fontSize: "0.8rem",
    fontWeight: "bold",
  },
}));

const UserSchema = Yup.object().shape({
  name: Yup.string()
    .min(2, "Too Short!")
    .max(50, "Too Long!")
    .required("Required"),
  password: Yup.string().min(5, "Too Short!").max(50, "Too Long!"),
  email: Yup.string().email("Invalid email").required("Required"),
  allHistoric: Yup.string().nullable(),
});

const UserModal = ({ open, onClose, userId }) => {
  const classes = useStyles();

  const initialState = {
    name: "",
    email: "",
    password: "",
    birthDate: "",
    timezone: "America/Sao_Paulo",
    profile: "user",
    startWork: "00:00",
    endWork: "23:59",
    farewellMessage: "",
    allTicket: "enable",
    allowGroup: false,
    defaultTheme: "light",
    defaultMenu: "open",
    allHistoric: "enabled",
    allUserChat: "enabled",
    userClosePendingTicket: "enabled",
    showDashboard: "enabled",
    allowRealTime: "enabled",
    allowConnections: "enabled",
    showContacts: "enabled",
    showCampaign: "enabled",
    showFlow: "enabled",
    finalizacaoComValorVendaAtiva: "false",
    allowSeeMessagesInPendingTickets: "enabled",
    showReturnQueueButton: "enabled",
    showTransferTicketButton: "enabled",
    allowAiSuggestions: "disabled"
  };

  const { user: loggedInUser } = useContext(AuthContext);

  const [user, setUser] = useState(initialState);
  const [selectedQueueIds, setSelectedQueueIds] = useState([]);
  const [selectedWhatsappIds, setSelectedWhatsappIds] = useState([]);
  // const [allTicket, setAllTicket] = useState("disable");
  const { loading, whatsApps } = useWhatsApps();
  const [profileUrl, setProfileUrl] = useState(null);
  const [tab, setTab] = useState("general");
  const [avatar, setAvatar] = useState(null);
  const startWorkRef = useRef();
  const endWorkRef = useRef();

  useEffect(() => {
    const fetchUser = async () => {
      if (!userId) return;
      try {
        const { data } = await api.get(`/users/${userId}`);
        setUser((prevState) => ({
          ...prevState,
          ...data,
          timezone: data.timezone || "America/Sao_Paulo",
          allTicket:
            data.allTicket === "enable" || data.allTicket === "enabled"
              ? "enable"
              : "disable",
          finalizacaoComValorVendaAtiva: data.finalizacaoComValorVendaAtiva
            ? "true"
            : "false",
          allowSeeMessagesInPendingTickets: data.allowSeeMessagesInPendingTickets === "enabled" ? "enabled" : "disabled",
          showReturnQueueButton: data.showReturnQueueButton === "enabled" ? "enabled" : "disabled",
          showTransferTicketButton: data.showTransferTicketButton === "enabled" ? "enabled" : "disabled",
          allowAiSuggestions: data.allowAiSuggestions === "enabled" ? "enabled" : "disabled",
          farewellMessage: data.farewellMessage || "",
          // Formatar a data corretamente
          birthDate: formatDateForInput(data.birthDate)
        }));

        const { profileImage } = data;
        setProfileUrl(
          `${backendUrl}/public/company${data.companyId}/user/${profileImage}`
        );

        const userQueueIds = data.queues?.map((queue) => queue.id);
        setSelectedQueueIds(userQueueIds);
        // Carregar múltiplas conexões vinculadas
        const userWhatsappIds = data.whatsapps?.map((w) => w.id) || [];
        if (userWhatsappIds.length > 0) {
          setSelectedWhatsappIds(userWhatsappIds);
        } else if (data.whatsappId) {
          // Fallback para campo legado
          setSelectedWhatsappIds([data.whatsappId]);
        } else {
          setSelectedWhatsappIds([]);
        }
      } catch (err) {
        toastError(err);
      }
    };

    fetchUser();
  }, [userId, open]);

  const handleClose = () => {
    onClose();
    setUser(initialState);
  };

  const handleTabChange = (event, newValue) => {
    setTab(newValue);
  };

  const getBasename = (filepath) => {
    if (!filepath) return '';
    // Remove query strings e hashes
    const cleanPath = filepath.split('?')[0].split('#')[0];
    // Pega o último segmento após /
    const segments = cleanPath.split('/');
    return segments[segments.length - 1];
  };

  // UserModal/index.js - Função handleSaveUser corrigida
  const handleSaveUser = async (values) => {
    const uploadAvatar = async (userId) => {
      if (!avatar || typeof avatar !== 'object') return null;

      const formData = new FormData();
      formData.append("userId", userId);
      formData.append("typeArch", "user");
      formData.append("profileImage", avatar);

      try {
        const { data } = await api.post(
          `/users/${userId}/media-upload`,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          }
        );

        return data.user.profileImage;
      } catch (error) {
        console.error("Erro no upload da imagem:", error);
        throw error;
      }
    };

    const userData = {
      ...values,
      timezone: values.timezone || "America/Sao_Paulo",
      whatsappId: selectedWhatsappIds.length > 0 ? selectedWhatsappIds[0] : null,
      whatsappIds: selectedWhatsappIds,
      queueIds: selectedQueueIds,
      finalizacaoComValorVendaAtiva: values.finalizacaoComValorVendaAtiva === "true",
      birthDate: parseDateFromInput(values.birthDate),
      allowSeeMessagesInPendingTickets: values.allowSeeMessagesInPendingTickets === "enabled" ? "enabled" : "disabled",
      showReturnQueueButton: values.showReturnQueueButton,
      showTransferTicketButton: values.showTransferTicketButton,
      allowAiSuggestions: values.allowAiSuggestions
    };

    try {
      let responseData;

      if (userId) {
        // Atualizar usuário existente
        const { data } = await api.put(`/users/${userId}`, userData);
        responseData = data;

        // Upload da imagem se houver uma nova
        if (avatar && typeof avatar === 'object') {
          const newProfileImage = await uploadAvatar(userId);
          if (newProfileImage) {
            responseData.profileImage = newProfileImage;

            // Atualizar localStorage se for o usuário logado
            if (userId === loggedInUser.id) {
              localStorage.setItem("profileImage", newProfileImage);
            }
          }
        }
      } else {
        // Criar novo usuário
        const { data } = await api.post("/users", userData);
        responseData = data.user;

        // Upload da imagem se houver
        if (avatar && typeof avatar === 'object' && responseData.id) {
          const newProfileImage = await uploadAvatar(responseData.id);
          if (newProfileImage) {
            responseData.profileImage = newProfileImage;
          }
        }
      }

      handleClose();
      toast.success(i18n.t("userModal.success"));

      // Recarregar página se for o usuário logado para atualizar a interface
      if (userId === loggedInUser.id) {
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <div className={classes.root}>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="md"
        fullWidth
        scroll="paper"
        PaperProps={{
          style: {
            maxHeight: "calc(100dvh - 32px)",
            borderRadius: 16,
          }
        }}
      >
        <DialogTitle id="form-dialog-title">
          {userId
            ? `${i18n.t("userModal.title.edit")}`
            : `${i18n.t("userModal.title.add")}`}
        </DialogTitle>
        <Formik
          initialValues={user}
          enableReinitialize={true}
          validationSchema={UserSchema}
          onSubmit={(values, actions) => {
            setTimeout(() => {
              handleSaveUser(values);
              actions.setSubmitting(false);
            }, 400);
          }}
        >
          {({ touched, errors, isSubmitting, setFieldValue }) => (
            <Form>
              <Paper className={classes.mainPaper} elevation={1}>
                <Tabs
                  value={tab}
                  indicatorColor="primary"
                  textColor="primary"
                  scrollButtons="on"
                  variant="scrollable"
                  onChange={handleTabChange}
                  className={classes.tab}
                >
                  <Tab
                    label={i18n.t("userModal.tabs.general")}
                    value={"general"}
                  />
                  <Tab
                    label={i18n.t("userModal.tabs.permissions")}
                    value={"permissions"}
                  />
                </Tabs>
              </Paper>
              <Paper className={classes.paper} elevation={0} style={{ overflowY: "auto" }}>
                <DialogContent dividers style={{ paddingBottom: 24 }}>
                  <TabPanel
                    className={classes.container}
                    value={tab}
                    name={"general"}
                  >
                    <Grid
                      container
                      spacing={1}
                      alignContent="center"
                      alignItems="center"
                      justifyContent="center"
                    >
                      <FormControl className={classes.updateDiv}>
                        <AvatarUploader
                          setAvatar={setAvatar}
                          avatar={user.profileImage}
                          companyId={user.companyId}
                        />
                        {user.profileImage && (
                          <Button
                            variant="outlined"
                            color="secondary"
                            onClick={() => {
                              user.profileImage = null;
                              setFieldValue("profileImage", null);
                              setAvatar(null);
                            }}
                          >
                            {i18n.t("userModal.title.removeImage")}
                          </Button>
                        )}
                      </FormControl>
                    </Grid>
                    <Grid container spacing={1}>
                      <Grid item xs={12} md={6} xl={6}>
                        <Field
                          as={TextField}
                          label={i18n.t("userModal.form.name")}
                          autoFocus
                          name="name"
                          error={touched.name && Boolean(errors.name)}
                          helperText={touched.name && errors.name}
                          variant="outlined"
                          margin="dense"
                          fullWidth
                        />
                      </Grid>
                      <Grid item xs={12} md={6} xl={6}>
                        <Field
                          as={TextField}
                          label={i18n.t("userModal.form.password")}
                          type="password"
                          name="password"
                          error={touched.password && Boolean(errors.password)}
                          helperText={touched.password && errors.password}
                          variant="outlined"
                          margin="dense"
                          fullWidth
                        />
                      </Grid>
                    </Grid>
                    <Grid container spacing={1}>
                      <Grid item xs={12} md={8} xl={8}>
                        <Field
                          as={TextField}
                          label={i18n.t("userModal.form.email")}
                          name="email"
                          error={touched.email && Boolean(errors.email)}
                          helperText={touched.email && errors.email}
                          variant="outlined"
                          margin="dense"
                          fullWidth
                        />
                      </Grid>
                      <Grid item xs={12} md={4} xl={4}>
                        <FormControl
                          variant="outlined"
                          //className={classes.formControl}
                          margin="dense"
                          fullWidth
                        >
                          <Can
                            role={loggedInUser.profile}
                            perform="user-modal:editProfile"
                            yes={() => (
                              <>
                                <InputLabel id="profile-selection-input-label">
                                  {i18n.t("userModal.form.profile")}
                                </InputLabel>

                                <Field
                                  as={Select}
                                  label={i18n.t("userModal.form.profile")}
                                  name="profile"
                                  labelId="profile-selection-label"
                                  id="profile-selection"
                                  required
                                >
                                  <MenuItem value="admin">Admin</MenuItem>
                                  <MenuItem value="user">User</MenuItem>
                                </Field>
                              </>
                            )}
                          />
                        </FormControl>
                      </Grid>
                    </Grid>
                    <Grid container spacing={1}>
                      <Grid item xs={12} md={12} xl={12}>
                        <Can
                          role={loggedInUser.profile}
                          perform="user-modal:editQueues"
                          yes={() => (
                            <QueueSelect
                              selectedQueueIds={selectedQueueIds}
                              onChange={(values) => setSelectedQueueIds(values)}
                              fullWidth
                            />
                          )}
                        />
                      </Grid>
                    </Grid>
                    <Grid container spacing={1}>
                      <Grid item xs={12} md={12} xl={12}>
                        <Can
                          role={loggedInUser.profile}
                          perform="user-modal:editProfile"
                          yes={() => (
                            <FormControl
                              variant="outlined"
                              margin="dense"
                              className={classes.maxWidth}
                              fullWidth
                            >
                              <InputLabel>
                                {i18n.t("connections.title")}
                              </InputLabel>
                              <Select
                                multiple
                                value={selectedWhatsappIds}
                                onChange={(e) => setSelectedWhatsappIds(e.target.value)}
                                label={i18n.t("connections.title")}
                                renderValue={(selected) => (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                    {selected.map((id) => {
                                      const w = whatsApps.find(w => w.id === id);
                                      return (
                                        <Chip
                                          key={id}
                                          label={w ? w.name : id}
                                          size="small"
                                          style={{ margin: 2 }}
                                        />
                                      );
                                    })}
                                  </div>
                                )}
                              >
                                {whatsApps.map((whatsapp) => (
                                  <MenuItem
                                    key={whatsapp.id}
                                    value={whatsapp.id}
                                  >
                                    {whatsapp.name}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          )}
                        />
                      </Grid>
                    </Grid>
                    <Can
                      role={loggedInUser.profile}
                      perform="user-modal:editProfile"
                      yes={() => (
                        <>
                          <Grid container spacing={1}>
                            <Grid item xs={12} md={6} xl={6}>
                              <Field
                                as={TextField}
                                label={i18n.t("userModal.form.startWork")}
                                type="time"
                                ampm={"false"}
                                inputRef={startWorkRef}
                                InputLabelProps={{
                                  shrink: true,
                                }}
                                inputProps={{
                                  step: 600, // 5 min
                                }}
                                fullWidth
                                name="startWork"
                                error={
                                  touched.startWork && Boolean(errors.startWork)
                                }
                                helperText={touched.startWork && errors.startWork}
                                variant="outlined"
                                margin="dense"
                                className={classes.textField}
                              />
                            </Grid>
                            <Grid item xs={12} md={6} xl={6}>
                              <Field
                                as={TextField}
                                label={i18n.t("userModal.form.endWork")}
                                type="time"
                                ampm={"false"}
                                inputRef={endWorkRef}
                                InputLabelProps={{
                                  shrink: true,
                                }}
                                inputProps={{
                                  step: 600, // 5 min
                                }}
                                fullWidth
                                name="endWork"
                                error={touched.endWork && Boolean(errors.endWork)}
                                helperText={touched.endWork && errors.endWork}
                                variant="outlined"
                                margin="dense"
                                className={classes.textField}
                              />
                            </Grid>
                          </Grid>
                          <Grid container spacing={1}>
                            <Grid item xs={12} md={12} xl={12}>
                              <FormControl
                                variant="outlined"
                                margin="dense"
                                fullWidth
                              >
                                <InputLabel>Fuso horário</InputLabel>
                                <Field
                                  as={Select}
                                  label="Fuso horário"
                                  name="timezone"
                                  type="timezone"
                                  required
                                >
                                  {TIMEZONES.map((timezone) => (
                                    <MenuItem key={timezone.value} value={timezone.value}>
                                      {timezone.label}
                                    </MenuItem>
                                  ))}
                                </Field>
                              </FormControl>
                            </Grid>
                          </Grid>
                        </>
                      )}
                    />

                    <Grid container spacing={1}>
                      <Grid item xs={12} md={6} xl={6}>
                        <Field
                          as={TextField}
                          label="Data de Nascimento"
                          type="date"
                          name="birthDate"
                          InputLabelProps={{
                            shrink: true,
                          }}
                          fullWidth
                          variant="outlined"
                          margin="dense"
                          className={classes.textField}
                          helperText="Data de nascimento para notificações de aniversário"
                          onChange={(e) => {
                            const formattedDate = parseDateFromInput(e.target.value);
                            setFieldValue('birthDate', formattedDate);
                          }}
                        />
                      </Grid>
                    </Grid>

                    <Field
                      as={TextField}
                      label={i18n.t("userModal.form.farewellMessage")}
                      type="farewellMessage"
                      multiline
                      rows={4}
                      fullWidth
                      name="farewellMessage"
                      error={
                        touched.farewellMessage &&
                        Boolean(errors.farewellMessage)
                      }
                      helperText={
                        touched.farewellMessage && errors.farewellMessage
                      }
                      variant="outlined"
                      margin="dense"
                    />

                    <Grid container spacing={1}>
                      <Grid item xs={12} md={6} xl={6}>
                        <FormControl
                          variant="outlined"
                          className={classes.maxWidth}
                          margin="dense"
                          fullWidth
                        >
                          <>
                            <InputLabel>
                              {i18n.t("userModal.form.defaultTheme")}
                            </InputLabel>

                            <Field
                              as={Select}
                              label={i18n.t("userModal.form.defaultTheme")}
                              name="defaultTheme"
                              type="defaultTheme"
                              required
                            >
                              <MenuItem value="light">
                                {i18n.t("userModal.form.defaultThemeLight")}
                              </MenuItem>
                              <MenuItem value="dark">
                                {i18n.t("userModal.form.defaultThemeDark")}
                              </MenuItem>
                            </Field>
                          </>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} md={6} xl={6}>
                        <FormControl
                          variant="outlined"
                          className={classes.maxWidth}
                          margin="dense"
                          fullWidth
                        >
                          <>
                            <InputLabel>
                              {i18n.t("userModal.form.defaultMenu")}
                            </InputLabel>

                            <Field
                              as={Select}
                              label={i18n.t("userModal.form.defaultMenu")}
                              name="defaultMenu"
                              type="defaultMenu"
                              required
                            >
                              <MenuItem value={"open"}>
                                {i18n.t("userModal.form.defaultMenuOpen")}
                              </MenuItem>
                              <MenuItem value={"closed"}>
                                {i18n.t("userModal.form.defaultMenuClosed")}
                              </MenuItem>
                            </Field>
                          </>
                        </FormControl>
                      </Grid>
                    </Grid>
                  </TabPanel>
                  <TabPanel
                    className={classes.container}
                    value={tab}
                    name={"permissions"}
                  >
                    <Can
                      role={loggedInUser.profile}
                      perform="user-modal:editProfile"
                      yes={() => (
                        <>
                          <Grid container spacing={1}>
                            <Grid item xs={12} md={6} xl={6}>
                              <FormControl
                                variant="outlined"
                                className={classes.maxWidth}
                                margin="dense"
                                fullWidth
                              >
                                <>
                                  <InputLabel>
                                    {i18n.t("userModal.form.allTicket")}
                                  </InputLabel>

                                  <Field
                                    as={Select}
                                    label={i18n.t("userModal.form.allTicket")}
                                    name="allTicket"
                                    type="allTicket"
                                    required
                                  >
                                    <MenuItem value="enable">
                                      {i18n.t("userModal.form.allTicketEnable")}
                                    </MenuItem>
                                    <MenuItem value="disable">
                                      {i18n.t(
                                        "userModal.form.allTicketDisable"
                                      )}
                                    </MenuItem>
                                  </Field>
                                </>
                              </FormControl>
                            </Grid>
                            <Grid item xs={12} md={6} xl={6}>
                              <FormControl
                                variant="outlined"
                                className={classes.maxWidth}
                                margin="dense"
                                fullWidth
                              >
                                <>
                                  <InputLabel>
                                    {i18n.t("userModal.form.allowGroup")}
                                  </InputLabel>

                                  <Field
                                    as={Select}
                                    label={i18n.t("userModal.form.allowGroup")}
                                    name="allowGroup"
                                    type="allowGroup"
                                    required
                                  >
                                    <MenuItem value={true}>
                                      {i18n.t("userModal.form.allTicketEnable")}
                                    </MenuItem>
                                    <MenuItem value={false}>
                                      {i18n.t(
                                        "userModal.form.allTicketDisable"
                                      )}
                                    </MenuItem>
                                  </Field>
                                </>
                              </FormControl>
                            </Grid>
                          </Grid>

                          <Grid container spacing={1}>
                            <Grid item xs={12} md={6} xl={6}>
                              <FormControl
                                variant="outlined"
                                className={classes.maxWidth}
                                margin="dense"
                                fullWidth
                              >
                                <>
                                  <InputLabel>
                                    {i18n.t("userModal.form.showReturnQueueButton")}
                                  </InputLabel>

                                  <Field
                                    as={Select}
                                    label={i18n.t("userModal.form.showReturnQueueButton")}
                                    name="showReturnQueueButton"
                                    type="showReturnQueueButton"
                                    required
                                  >
                                    <MenuItem value="enabled">
                                      {i18n.t("userModal.form.allHistoricEnabled")}
                                    </MenuItem>
                                    <MenuItem value="disabled">
                                      {i18n.t("userModal.form.allHistoricDisabled")}
                                    </MenuItem>
                                  </Field>
                                </>
                              </FormControl>
                            </Grid>
                            <Grid item xs={12} md={6} xl={6}>
                              <FormControl
                                variant="outlined"
                                className={classes.maxWidth}
                                margin="dense"
                                fullWidth
                              >
                                <>
                                  <InputLabel>
                                    {i18n.t("userModal.form.showTransferTicketButton")}
                                  </InputLabel>

                                  <Field
                                    as={Select}
                                    label={i18n.t("userModal.form.showTransferTicketButton")}
                                    name="showTransferTicketButton"
                                    type="showTransferTicketButton"
                                    required
                                  >
                                    <MenuItem value="enabled">
                                      {i18n.t("userModal.form.allHistoricEnabled")}
                                    </MenuItem>
                                    <MenuItem value="disabled">
                                      {i18n.t("userModal.form.allHistoricDisabled")}
                                    </MenuItem>
                                  </Field>
                                </>
                              </FormControl>
                            </Grid>
                          </Grid>

                          <Grid container spacing={1}>
                            <Grid item xs={12} md={6} xl={6}>
                              <FormControl
                                variant="outlined"
                                className={classes.maxWidth}
                                margin="dense"
                                fullWidth
                              >
                                <>
                                  <InputLabel>
                                    {i18n.t("userModal.form.allHistoric")}
                                  </InputLabel>

                                  <Field
                                    as={Select}
                                    label={i18n.t("userModal.form.allHistoric")}
                                    name="allHistoric"
                                    type="allHistoric"
                                    required
                                  >
                                    <MenuItem value="disabled">
                                      {i18n.t(
                                        "userModal.form.allHistoricDisabled"
                                      )}
                                    </MenuItem>
                                    <MenuItem value="enabled">
                                      {i18n.t(
                                        "userModal.form.allHistoricEnabled"
                                      )}
                                    </MenuItem>
                                  </Field>
                                </>
                              </FormControl>
                            </Grid>
                            <Grid item xs={12} md={6} xl={6}>
                              <FormControl
                                variant="outlined"
                                className={classes.maxWidth}
                                margin="dense"
                                fullWidth
                              >
                                <>
                                  <InputLabel>
                                    {i18n.t("userModal.form.allUserChat")}
                                  </InputLabel>

                                  <Field
                                    as={Select}
                                    label={i18n.t("userModal.form.allUserChat")}
                                    name="allUserChat"
                                    type="allUserChat"
                                    required
                                  >
                                    <MenuItem value="disabled">
                                      {i18n.t(
                                        "userModal.form.allHistoricDisabled"
                                      )}
                                    </MenuItem>
                                    <MenuItem value="enabled">
                                      {i18n.t(
                                        "userModal.form.allHistoricEnabled"
                                      )}
                                    </MenuItem>
                                  </Field>
                                </>
                              </FormControl>
                            </Grid>
                          </Grid>

                          <Grid container spacing={1}>
                            <Grid item xs={12} md={6} xl={6}>
                              <FormControl
                                variant="outlined"
                                className={classes.maxWidth}
                                margin="dense"
                                fullWidth
                              >
                                <>
                                  <InputLabel>
                                    {i18n.t(
                                      "userModal.form.userClosePendingTicket"
                                    )}
                                  </InputLabel>

                                  <Field
                                    as={Select}
                                    label={i18n.t(
                                      "userModal.form.userClosePendingTicket"
                                    )}
                                    name="userClosePendingTicket"
                                    type="userClosePendingTicket"
                                    required
                                  >
                                    <MenuItem value="disabled">
                                      {i18n.t(
                                        "userModal.form.allHistoricDisabled"
                                      )}
                                    </MenuItem>
                                    <MenuItem value="enabled">
                                      {i18n.t(
                                        "userModal.form.allHistoricEnabled"
                                      )}
                                    </MenuItem>
                                  </Field>
                                </>
                              </FormControl>
                            </Grid>
                            <Grid item xs={12} md={6} xl={6}>
                              <FormControl
                                variant="outlined"
                                className={classes.maxWidth}
                                margin="dense"
                                fullWidth
                              >
                                <>
                                  <InputLabel>
                                    {i18n.t("userModal.form.allowSeeMessagesInPendingTickets")}
                                  </InputLabel>

                                  <Field
                                    as={Select}
                                    label={i18n.t("userModal.form.allowSeeMessagesInPendingTickets")}
                                    name="allowSeeMessagesInPendingTickets"
                                    type="allowSeeMessagesInPendingTickets"
                                    required
                                  >
                                    <MenuItem value="disabled">
                                      {i18n.t(
                                        "userModal.form.allHistoricDisabled"
                                      )}
                                    </MenuItem>
                                    <MenuItem value="enabled">
                                      {i18n.t(
                                        "userModal.form.allHistoricEnabled"
                                      )}
                                    </MenuItem>
                                  </Field>
                                </>
                              </FormControl>
                            </Grid>
                          </Grid>

                          <Grid container spacing={1}>
                            <Grid item xs={12} md={6} xl={6}>
                              <FormControl
                                variant="outlined"
                                className={classes.maxWidth}
                                margin="dense"
                                fullWidth
                              >
                                <>
                                  <InputLabel>
                                    {i18n.t("userModal.form.allowConnections")}
                                  </InputLabel>

                                  <Field
                                    as={Select}
                                    label={i18n.t(
                                      "userModal.form.allowConnections"
                                    )}
                                    name="allowConnections"
                                    type="allowConnections"
                                    required
                                  >
                                    <MenuItem value="disabled">
                                      {i18n.t(
                                        "userModal.form.allHistoricDisabled"
                                      )}
                                    </MenuItem>
                                    <MenuItem value="enabled">
                                      {i18n.t(
                                        "userModal.form.allHistoricEnabled"
                                      )}
                                    </MenuItem>
                                  </Field>
                                </>
                              </FormControl>
                            </Grid>
                            <Grid item xs={12} md={6} xl={6}>
                              <FormControl
                                variant="outlined"
                                className={classes.maxWidth}
                                margin="dense"
                                fullWidth
                              >
                                <>
                                  <InputLabel>
                                    {i18n.t("userModal.form.showDashboard")}
                                  </InputLabel>

                                  <Field
                                    as={Select}
                                    label={i18n.t(
                                      "userModal.form.showDashboard"
                                    )}
                                    name="showDashboard"
                                    type="showDashboard"
                                    required
                                  >
                                    <MenuItem value="disabled">
                                      {i18n.t(
                                        "userModal.form.allHistoricDisabled"
                                      )}
                                    </MenuItem>
                                    <MenuItem value="enabled">
                                      {i18n.t(
                                        "userModal.form.allHistoricEnabled"
                                      )}
                                    </MenuItem>
                                  </Field>
                                </>
                              </FormControl>
                            </Grid>
                          </Grid>

                          <Grid container spacing={1}>
                            <Grid item xs={12} md={6} xl={6}>
                              <FormControl
                                variant="outlined"
                                className={classes.maxWidth}
                                margin="dense"
                                fullWidth
                              >
                                <>
                                  <InputLabel>
                                    {i18n.t("userModal.form.allowRealTime")}
                                  </InputLabel>

                                  <Field
                                    as={Select}
                                    label={i18n.t(
                                      "userModal.form.allowRealTime"
                                    )}
                                    name="allowRealTime"
                                    type="allowRealTime"
                                    required
                                  >
                                    <MenuItem value="disabled">
                                      {i18n.t(
                                        "userModal.form.allHistoricDisabled"
                                      )}
                                    </MenuItem>
                                    <MenuItem value="enabled">
                                      {i18n.t(
                                        "userModal.form.allHistoricEnabled"
                                      )}
                                    </MenuItem>
                                  </Field>
                                </>
                              </FormControl>
                            </Grid>
                            <Grid item xs={12} md={6} xl={6}>
                              <FormControl
                                variant="outlined"
                                className={classes.maxWidth}
                                margin="dense"
                                fullWidth
                              >
                                <>
                                  <InputLabel>
                                    {i18n.t("userModal.form.showContacts")}
                                  </InputLabel>

                                  <Field
                                    as={Select}
                                    label={i18n.t(
                                      "userModal.form.showContacts"
                                    )}
                                    name="showContacts"
                                    type="showContacts"
                                    required
                                  >
                                    <MenuItem value="disabled">
                                      {i18n.t(
                                        "userModal.form.allHistoricDisabled"
                                      )}
                                    </MenuItem>
                                    <MenuItem value="enabled">
                                      {i18n.t(
                                        "userModal.form.allHistoricEnabled"
                                      )}
                                    </MenuItem>
                                  </Field>
                                </>
                              </FormControl>
                            </Grid>
                          </Grid>

                          <Grid container spacing={1}>
                            <Grid item xs={12} md={6} xl={6}>
                              <FormControl
                                variant="outlined"
                                className={classes.maxWidth}
                                margin="dense"
                                fullWidth
                              >
                                <>
                                  <InputLabel>
                                    {i18n.t("userModal.form.showCampaign")}
                                  </InputLabel>

                                  <Field
                                    as={Select}
                                    label={i18n.t(
                                      "userModal.form.showCampaign"
                                    )}
                                    name="showCampaign"
                                    type="showCampaign"
                                    required
                                  >
                                    <MenuItem value="disabled">
                                      {i18n.t(
                                        "userModal.form.allHistoricDisabled"
                                      )}
                                    </MenuItem>
                                    <MenuItem value="enabled">
                                      {i18n.t(
                                        "userModal.form.allHistoricEnabled"
                                      )}
                                    </MenuItem>
                                  </Field>
                                </>
                              </FormControl>
                            </Grid>
                            <Grid item xs={12} md={6} xl={6}>
                              <FormControl
                                variant="outlined"
                                className={classes.maxWidth}
                                margin="dense"
                                fullWidth
                              >
                                <>
                                  <InputLabel>
                                    {i18n.t("userModal.form.showFlow")}
                                  </InputLabel>

                                  <Field
                                    as={Select}
                                    label={i18n.t("userModal.form.showFlow")}
                                    name="showFlow"
                                    type="showFlow"
                                    required
                                  >
                                    <MenuItem value="disabled">
                                      {i18n.t(
                                        "userModal.form.allHistoricDisabled"
                                      )}
                                    </MenuItem>
                                    <MenuItem value="enabled">
                                      {i18n.t(
                                        "userModal.form.allHistoricEnabled"
                                      )}
                                    </MenuItem>
                                  </Field>
                                </>
                              </FormControl>
                            </Grid>
                          </Grid>

                          <Grid container spacing={1}>
                            <Grid item xs={12} md={6} xl={6}>
                              <FormControl
                                variant="outlined"
                                className={classes.maxWidth}
                                margin="dense"
                                fullWidth
                              >
                                <>
                                  <InputLabel>
                                    Finalização com Valor de Venda
                                  </InputLabel>

                                  <Field
                                    as={Select}
                                    label="Finalização com Valor de Venda"
                                    name="finalizacaoComValorVendaAtiva"
                                    type="finalizacaoComValorVendaAtiva"
                                    required
                                  >
                                    <MenuItem value="false">
                                      {i18n.t("whatsappModal.menuItem.disabled")}
                                    </MenuItem>
                                    <MenuItem value="true">{i18n.t("whatsappModal.menuItem.enabled")}</MenuItem>
                                  </Field>
                                </>
                              </FormControl>
                            </Grid>
                          </Grid>

                          <Grid container spacing={1}>
                            <Grid item xs={12} md={6} xl={6}>
                              <FormControl
                                variant="outlined"
                                className={classes.maxWidth}
                                margin="dense"
                                fullWidth
                              >
                                <>
                                  <InputLabel>
                                    Permitir Sugestões IA
                                  </InputLabel>

                                  <Field
                                    as={Select}
                                    label="Permitir Sugestões IA"
                                    name="allowAiSuggestions"
                                    type="allowAiSuggestions"
                                    required
                                  >
                                    <MenuItem value="disabled">
                                      {i18n.t("whatsappModal.menuItem.disabled")}
                                    </MenuItem>

                                    <MenuItem value="enabled">
                                      {i18n.t("whatsappModal.menuItem.enabled")}
                                    </MenuItem>
                                  </Field>
                                </>
                              </FormControl>
                            </Grid>
                          </Grid>
                        </>
                      )}
                    />
                  </TabPanel>
                </DialogContent>
              </Paper>
              <DialogActions>
                <Button
                  onClick={handleClose}
                  color="secondary"
                  disabled={isSubmitting}
                  variant="outlined"
                >
                  {i18n.t("userModal.buttons.cancel")}
                </Button>
                <Button
                  type="submit"
                  color="primary"
                  disabled={isSubmitting}
                  variant="contained"
                  className={classes.btnWrapper}
                >
                  {userId
                    ? `${i18n.t("userModal.buttons.okEdit")}`
                    : `${i18n.t("userModal.buttons.okAdd")}`}
                  {isSubmitting && (
                    <CircularProgress
                      size={24}
                      className={classes.buttonProgress}
                    />
                  )}
                </Button>
              </DialogActions>
            </Form>
          )}
        </Formik>
      </Dialog>
    </div>
  );
};

export default UserModal;