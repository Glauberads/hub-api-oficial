import React, { useState, useEffect, useContext } from "react";
import { useHistory } from "react-router-dom";
import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import MainContainer from "../../components/MainContainer";
import {
  Button,
  CircularProgress,
  Grid,
  TextField,
  Typography,
  Divider,
  Chip,
  Box,
} from "@material-ui/core";
import { Field, Form, Formik } from "formik";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";
import axios from "axios";
import usePlans from "../../hooks/usePlans";
import { AuthContext } from "../../context/Auth/AuthContext";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    overflowX: "hidden",
    padding: theme.spacing(2),
    paddingBottom: 100,
    ...theme.scrollbarStyles,
  },
  sectionTitle: {
    marginTop: theme.spacing(3),
    marginBottom: theme.spacing(1),
    fontWeight: "bold",
  },
  elementMargin: {
    padding: theme.spacing(2),
  },
  formContainer: {
    maxWidth: 500,
  },
  textRight: {
    textAlign: "right",
  },
  endpointBox: {
    backgroundColor: theme.palette.type === "dark" ? "#3c4043" : "#f5f5f5",
    color: theme.palette.text.primary,
    borderRadius: 4,
    padding: theme.spacing(1.5),
    fontFamily: "monospace",
    fontSize: 13,
    wordBreak: "break-all",
    marginBottom: theme.spacing(1),
    border: `1px solid ${theme.palette.divider}`,
  },
  chip: {
    marginRight: theme.spacing(0.5),
    marginBottom: theme.spacing(0.5),
  },
  sectionDivider: {
    margin: theme.spacing(3, 0),
  },
  badgeNew: {
    backgroundColor: "#4caf50",
    color: "#fff",
    borderRadius: 4,
    padding: "2px 6px",
    fontSize: 11,
    fontWeight: "bold",
    marginLeft: 8,
    verticalAlign: "middle",
  },
  codeBlock: {
    backgroundColor: "#1e1e1e",
    color: "#d4d4d4",
    borderRadius: 6,
    padding: theme.spacing(2),
    fontFamily: "monospace",
    fontSize: 12,
    whiteSpace: "pre-wrap",
    wordBreak: "break-all",
    marginTop: theme.spacing(1),
  },
}));

const MessagesAPI = () => {
  const classes = useStyles();
  const tx = key => i18n.t(`messagesAPI.extended.${key}`);
  const history = useHistory();
  const [file, setFile] = useState({});
  const { user } = useContext(AuthContext);
  const { getPlanCompany } = usePlans();
  const [bulkMessages, setBulkMessages] = useState("");

  useEffect(() => {
    async function fetchData() {
      const companyId = user.companyId;
      const planConfigs = await getPlanCompany(undefined, companyId);
      if (!planConfigs.plan.useExternalApi) {
        toast.error(tx("accessDenied"));
        setTimeout(() => history.push(`/`), 1000);
      }
    }
    fetchData();
  }, []);

  const getEndpoint = () => process.env.REACT_APP_BACKEND_URL + "/api/messages/send";
  const getCheckEndpoint = () => process.env.REACT_APP_BACKEND_URL + "/api/messages/checkNumber";
  const getNoTicketEndpoint = () => process.env.REACT_APP_BACKEND_URL + "/api/messages/send/noTicket";
  const getBulkEndpoint = () => process.env.REACT_APP_BACKEND_URL + "/api/messages/send/bulk";
  const getLinkImageEndpoint = () => process.env.REACT_APP_BACKEND_URL + "/api/messages/send/linkImage";
  const getConnectionsEndpoint = () => process.env.REACT_APP_BACKEND_URL + "/api/messages/connections";
  const getButtonsEndpoint = () => process.env.REACT_APP_BACKEND_URL + "/api/messages/send/buttons";

  const handleSendTextMessage = async (values) => {
    const { number, body, userId, queueId } = values;
    try {
      await axios.post(getEndpoint(), { number, body, userId, queueId }, {
        headers: { "Content-type": "application/json", Authorization: `Bearer ${values.token}` },
      });
      toast.success("Mensagem enviada com sucesso");
    } catch (err) { toastError(err); }
  };

  const handleSendMediaMessage = async (values) => {
    try {
      const firstFile = file[0];
      const data = new FormData();
      data.append("number", values.number);
      data.append("body", values.body ? values.body : firstFile.name);
      data.append("userId", values.userId);
      data.append("queueId", values.queueId);
      data.append("medias", firstFile);
      await axios.post(getEndpoint(), data, {
        headers: { "Content-type": "multipart/form-data", Authorization: `Bearer ${values.token}` },
      });
      toast.success("Mensagem enviada com sucesso");
    } catch (err) { toastError(err); }
  };

  const handleCheckNumber = async (values) => {
    try {
      const res = await axios.post(getCheckEndpoint(), { number: values.number }, {
        headers: { "Content-type": "application/json", Authorization: `Bearer ${values.token}` },
      });
      if (res.data.existsInWhatsapp) {
        toast.success(`✅ Número existe no WhatsApp: ${res.data.numberFormatted}`);
      } else {
        toast.warn("❌ Número não encontrado no WhatsApp");
      }
    } catch (err) { toastError(err); }
  };

  const handleSendNoTicket = async (values) => {
    try {
      await axios.post(getNoTicketEndpoint(), { number: values.number, body: values.body }, {
        headers: { "Content-type": "application/json", Authorization: `Bearer ${values.token}` },
      });
      toast.success("Mensagem enviada (sem ticket)");
    } catch (err) { toastError(err); }
  };

  const handleSendLinkImage = async (values) => {
    try {
      await axios.post(getLinkImageEndpoint(), { number: values.number, url: values.url, caption: values.caption }, {
        headers: { "Content-type": "application/json", Authorization: `Bearer ${values.token}` },
      });
      toast.success("Imagem enviada com sucesso");
    } catch (err) { toastError(err); }
  };

  const handleSendBulk = async (values) => {
    try {
      let messages;
      try {
        messages = JSON.parse(bulkMessages);
      } catch {
        toast.error('JSON inválido. Use o formato: [{"number":"55...","body":"texto"}]');
        return;
      }
      const res = await axios.post(getBulkEndpoint(), { messages, delay: Number(values.delay) || 2000 }, {
        headers: { "Content-type": "application/json", Authorization: `Bearer ${values.token}` },
      });
      toast.success(`Lote enviado: ${res.data.sent}/${res.data.total} mensagens com sucesso`);
    } catch (err) { toastError(err); }
  };

  const handleListConnections = async (values) => {
    try {
      const res = await axios.get(getConnectionsEndpoint(), {
        headers: { Authorization: `Bearer ${values.token}` },
      });
      toast.success(`${res.data.connections.length} conexão(ões) encontrada(s). Veja o console para detalhes.`);
      console.table(res.data.connections);
    } catch (err) { toastError(err); }
  };

  const [buttonsJson, setButtonsJson] = useState('[{"text":"Vendas","id":"1","queueId":5,"userId":12},{"text":"Suporte","id":"2","queueId":3},{"text":"Financeiro","id":"3"}]');
  const [mixedButtonsJson, setMixedButtonsJson] = useState('[{"type":"quick_reply","text":"Vendas","id":"1"},{"type":"quick_reply","text":"Suporte","id":"2"},{"type":"cta_url","text":"Abrir site","url":"https://seusite.com.br"}]');

  const handleSendButtons = async (values) => {
    try {
      let buttons;
      try {
        buttons = JSON.parse(buttonsJson);
      } catch {
        toast.error('JSON de botões inválido. Use: [{"text":"Texto","id":"1"}]');
        return;
      }
      await axios.post(getButtonsEndpoint(), {
        number: values.number,
        body: values.body,
        footer: values.footer || undefined,
        type: "buttons",
        buttons,
      }, {
        headers: { "Content-type": "application/json", Authorization: `Bearer ${values.token}` },
      });
      toast.success("Mensagem com botões enviada com sucesso");
    } catch (err) { toastError(err); }
  };

  const handleSendMixedButtons = async (values) => {
    try {
      let buttons;
      try {
        buttons = JSON.parse(mixedButtonsJson);
      } catch {
        toast.error('JSON de botões inválido. Use: [{"type":"quick_reply","text":"Texto","id":"1"},{"type":"cta_url","text":"Abrir","url":"https://..."}]');
        return;
      }
      await axios.post(getButtonsEndpoint(), {
        number: values.number,
        body: values.body,
        footer: values.footer || undefined,
        type: "mixed",
        buttons,
      }, {
        headers: { "Content-type": "application/json", Authorization: `Bearer ${values.token}` },
      });
      toast.success("Mensagem com botões mistos enviada com sucesso");
    } catch (err) { toastError(err); }
  };

  const renderSection = (number, title, isNew, docContent, formContent) => (
    <>
      <Divider className={classes.sectionDivider} />
      <Typography variant="h6" color="primary" className={classes.elementMargin}>
        {number}. {title}
        {isNew && <span className={classes.badgeNew}>{tx("new")}</span>}
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <Typography className={classes.elementMargin} component="div">
            {docContent}
          </Typography>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Typography className={classes.elementMargin}>
            <b>{tx("testSend")}</b>
          </Typography>
          {formContent}
        </Grid>
      </Grid>
    </>
  );

  const renderSimpleForm = (initialValues, onSubmit, fields, submitLabel = tx("send")) => (
    <Formik initialValues={initialValues} enableReinitialize onSubmit={(values, actions) => {
      setTimeout(async () => { await onSubmit(values); actions.setSubmitting(false); actions.resetForm(); }, 400);
    }}>
      {({ isSubmitting }) => (
        <Form className={classes.formContainer}>
          <Grid container spacing={2}>
            {fields.map((f) => (
              <Grid item xs={12} md={f.md || 12} key={f.name}>
                <Field as={TextField} label={f.label} name={f.name} variant="outlined" margin="dense" fullWidth required={f.required !== false} multiline={f.multiline} rows={f.rows} />
              </Grid>
            ))}
            <Grid item xs={12} className={classes.textRight}>
              <Button type="submit" color="primary" variant="contained">
                {isSubmitting ? <CircularProgress size={24} /> : submitLabel}
              </Button>
            </Grid>
          </Grid>
        </Form>
      )}
    </Formik>
  );

  return (
    <MainContainer>
      <Paper className={classes.mainPaper} style={{ marginLeft: "5px" }} variant="outlined">
        <Typography variant="h5">📡 {tx("documentationTitle")}</Typography>

        <Typography variant="h6" color="primary" className={classes.elementMargin}>
          {tx("methodsTitle")}
        </Typography>
        <Typography component="div">
          <ol>
            <li>{i18n.t("messagesAPI.API.methods.messagesText")}</li>
            <li>{tx("mediaMessages")}</li>
            <li>{tx("checkNumber")} <span className={classes.badgeNew}>{tx("new")}</span></li>
            <li>{tx("noTicket")} <span className={classes.badgeNew}>{tx("new")}</span></li>
            <li>{tx("imageUrl")} <span className={classes.badgeNew}>{tx("new")}</span></li>
            <li>{tx("bulk")} <span className={classes.badgeNew}>{tx("new")}</span></li>
            <li>{tx("listConnections")} <span className={classes.badgeNew}>{tx("new")}</span></li>
            <li>{tx("interactiveButtons")} <span className={classes.badgeNew}>{tx("new")}</span></li>
            <li>{tx("mixedButtons")} <span className={classes.badgeNew}>{tx("new")}</span></li>
          </ol>
        </Typography>

        <Typography variant="h6" color="primary" className={classes.elementMargin}>{i18n.t("messagesAPI.API.instructions.title")}</Typography>
        <Typography className={classes.elementMargin} component="div">
          <b>{i18n.t("messagesAPI.API.instructions.comments")}</b>
          <ul>
            <li>{tx("tokenInstruction")}</li>
            <li>{tx("numberInstruction")}</li>
            <li>{tx("headerInstruction")} <code>Authorization: Bearer SEU_TOKEN</code></li>
          </ul>
        </Typography>

        {renderSection(1, tx("textTitle"), false,
          <>
            <p>{tx("textDescription")}</p>
            <div className={classes.endpointBox}><b>{i18n.t("messagesAPIInstructions.post")}</b> {getEndpoint()}</div>
            <b>{tx("headersJson")}</b><br /><br />
            <b>{tx("bodyJson")}</b>
            <div className={classes.codeBlock}>{`{
  "number": "5585999999999",
  "body": "Mensagem",
  "userId": "ID do usuário ou ''",
  "queueId": "ID da fila ou ''",
  "sendSignature": false,
  "closeTicket": false
}`}</div>
          </>,
          renderSimpleForm({ token: "", number: "", body: "", userId: "", queueId: "" }, handleSendTextMessage, [
            { name: "token", label: tx("registeredToken"), md: 6 },
            { name: "number", label: tx("number"), md: 6 },
            { name: "body", label: tx("message") },
            { name: "userId", label: tx("userId"), md: 6, required: false },
            { name: "queueId", label: tx("queueId"), md: 6, required: false },
          ], tx("send"))
        )}

        {renderSection(2, tx("mediaMessages"), false,
          <>
            <p>{tx("mediaDescription")}</p>
            <div className={classes.endpointBox}><b>{i18n.t("messagesAPIInstructions.post")}</b> {getEndpoint()}</div>
            <b>{tx("headersForm")}</b><br /><br />
            <b>{tx("formData")}</b>
            <ul>
              <li><b>number:</b> 5585999999999</li>
              <li><b>body:</b> {tx("optionalCaption")}</li>
              <li><b>userId:</b> {tx("userIdHelp")}</li>
              <li><b>queueId:</b> {tx("queueIdHelp")}</li>
              <li><b>medias:</b> {tx("file")}</li>
              <li><b>sendSignature:</b> true/false</li>
              <li><b>closeTicket:</b> true/false</li>
            </ul>
          </>,
          <Formik initialValues={{ token: "", number: "", body: "", userId: "", queueId: "" }} enableReinitialize onSubmit={(values, actions) => {
            setTimeout(async () => { await handleSendMediaMessage(values); actions.setSubmitting(false); actions.resetForm(); document.getElementById("medias").value = null; }, 400);
          }}>
            {({ isSubmitting }) => (
              <Form className={classes.formContainer}>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}><Field as={TextField} label={tx("registeredToken")} name="token" variant="outlined" margin="dense" fullWidth required /></Grid>
                  <Grid item xs={12} md={6}><Field as={TextField} label={tx("number")} name="number" variant="outlined" margin="dense" fullWidth required /></Grid>
                  <Grid item xs={12}><Field as={TextField} label={tx("caption")} name="body" variant="outlined" margin="dense" fullWidth /></Grid>
                  <Grid item xs={12} md={6}><Field as={TextField} label={i18n.t("messagesAPI.textMessage.userId")} name="userId" variant="outlined" margin="dense" fullWidth /></Grid>
                  <Grid item xs={12} md={6}><Field as={TextField} label={i18n.t("messagesAPI.textMessage.queueId")} name="queueId" variant="outlined" margin="dense" fullWidth /></Grid>
                  <Grid item xs={12}><input type="file" name="medias" id="medias" required onChange={(e) => setFile(e.target.files)} /></Grid>
                  <Grid item xs={12} className={classes.textRight}>
                    <Button type="submit" color="primary" variant="contained">{isSubmitting ? <CircularProgress size={24} /> : i18n.t("chatMessages.send")}</Button>
                  </Grid>
                </Grid>
              </Form>
            )}
          </Formik>
        )}

        {renderSection(3, tx("checkTitle"), true,
          <>
            <p>{tx("checkDescription")}</p>
            <div className={classes.endpointBox}><b>{i18n.t("messagesAPIInstructions.post")}</b> {getCheckEndpoint()}</div>
            <b>{tx("bodyJson")}</b>
            <div className={classes.codeBlock}>{`{
  "number": "5585999999999"
}`}</div>
            <b>{tx("response")}</b>
            <div className={classes.codeBlock}>{`{
  "existsInWhatsapp": true,
  "number": "5585999999999",
  "numberFormatted": "5585999999999@s.whatsapp.net"
}`}</div>
          </>,
          renderSimpleForm({ token: "", number: "" }, handleCheckNumber, [
            { name: "token", label: tx("registeredToken"), md: 6 },
            { name: "number", label: tx("number"), md: 6 },
          ], tx("verify"))
        )}

        {renderSection(4, tx("noTicketTitle"), true,
          <>
            <p>{tx("noTicketDescription")}</p>
            <div className={classes.endpointBox}><b>{i18n.t("messagesAPIInstructions.post")}</b> {getNoTicketEndpoint()}</div>
            <b>{tx("bodyJson")}</b>
            <div className={classes.codeBlock}>{`{
  "number": "5585999999999",
  "body": "Sua mensagem aqui"
}`}</div>
            <b>{tx("response")}</b>
            <div className={classes.codeBlock}>{`{
  "status": "SUCCESS",
  "message": "Mensagem enviada sem registro de ticket."
}`}</div>
          </>,
          renderSimpleForm({ token: "", number: "", body: "" }, handleSendNoTicket, [
            { name: "token", label: tx("registeredToken"), md: 6 },
            { name: "number", label: tx("number"), md: 6 },
            { name: "body", label: tx("message"), multiline: true, rows: 3 },
          ], tx("send"))
        )}

        {renderSection(5, tx("imageTitle"), true,
          <>
            <p>{tx("imageDescription")}</p>
            <div className={classes.endpointBox}><b>{i18n.t("messagesAPIInstructions.post")}</b> {getLinkImageEndpoint()}</div>
            <b>{tx("bodyJson")}</b>
            <div className={classes.codeBlock}>{`{
  "number": "5585999999999",
  "url": "https://exemplo.com/imagem.jpg",
  "caption": "Legenda da imagem (opcional)"
}`}</div>
          </>,
          renderSimpleForm({ token: "", number: "", url: "", caption: "" }, handleSendLinkImage, [
            { name: "token", label: tx("registeredToken"), md: 6 },
            { name: "number", label: tx("number"), md: 6 },
            { name: "url", label: tx("imageAddress") },
            { name: "caption", label: tx("caption"), required: false },
          ], tx("send"))
        )}

        {renderSection(6, tx("bulkTitle"), true,
          <>
            <p>{tx("bulkDescription")}</p>
            <div className={classes.endpointBox}><b>{i18n.t("messagesAPIInstructions.post")}</b> {getBulkEndpoint()}</div>
            <b>{tx("bodyJson")}</b>
            <div className={classes.codeBlock}>{`{
  "delay": 2000,
  "messages": [
    {"number": "5585999999999", "body": "Olá João!"},
    {"number": "5585888888888", "body": "Olá Maria!"}
  ]
}`}</div>
            <b>{tx("response")}</b>
            <div className={classes.codeBlock}>{`{
  "total": 2,
  "sent": 2,
  "results": [
    {"number": "5585999999999", "status": "SUCCESS"},
    {"number": "5585888888888", "status": "SUCCESS"}
  ]
}`}</div>
            <Box mt={1}>
              <Chip size="small" label={tx("delayHelp")} className={classes.chip} />
            </Box>
          </>,
          <Formik initialValues={{ token: "", delay: "2000" }} enableReinitialize onSubmit={(values, actions) => {
            setTimeout(async () => { await handleSendBulk(values); actions.setSubmitting(false); }, 400);
          }}>
            {({ isSubmitting }) => (
              <Form className={classes.formContainer}>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={8}><Field as={TextField} label={tx("registeredToken")} name="token" variant="outlined" margin="dense" fullWidth required /></Grid>
                  <Grid item xs={12} md={4}><Field as={TextField} label="Delay (ms)" name="delay" variant="outlined" margin="dense" fullWidth /></Grid>
                  <Grid item xs={12}>
                    <TextField
                      label={tx("messagesJson")}
                      multiline
                      rows={6}
                      variant="outlined"
                      margin="dense"
                      fullWidth
                      value={bulkMessages}
                      onChange={(e) => setBulkMessages(e.target.value)}
                      placeholder={`[{"number":"5585999999999","body":"Olá!"}]`}
                      required
                    />
                  </Grid>
                  <Grid item xs={12} className={classes.textRight}>
                    <Button type="submit" color="primary" variant="contained">{isSubmitting ? <CircularProgress size={24} /> : tx("sendBatch")}</Button>
                  </Grid>
                </Grid>
              </Form>
            )}
          </Formik>
        )}

        {renderSection(7, tx("connectionsTitle"), true,
          <>
            <p>{tx("connectionsDescription")}</p>
            <div className={classes.endpointBox}><b>GET</b> {getConnectionsEndpoint()}</div>
            <b>{tx("response")}</b>
            <div className={classes.codeBlock}>{`{
  "connections": [
    {
      "id": 1,
      "name": "Suporte",
      "status": "CONNECTED",
      "isDefault": true,
      "number": "5585999999999",
      "channel": "whatsapp"
    }
  ]
}`}</div>
          </>,
          renderSimpleForm({ token: "" }, handleListConnections, [
            { name: "token", label: tx("registeredToken") },
          ], tx("list"))
        )}

        {renderSection(8, tx("buttonsTitle"), true,
          <>
            <p>{tx("buttonsDescription")}</p>
            <div className={classes.endpointBox}><b>{i18n.t("messagesAPIInstructions.post")}</b> {getButtonsEndpoint()}</div>
            <b>{i18n.t("messagesAPIInstructions.headers")}</b> Authorization Bearer (token) e Content-Type (application/json)<br /><br />
            <b>{tx("bodyButtons")}</b>
            <div className={classes.codeBlock}>{`{
  "number": "5585999999999",
  "body": "Escolha uma opção:",
  "footer": "Rodapé opcional",
  "type": "buttons",
  "buttons": [
    {"text": "Vendas", "id": "1", "queueId": 5, "userId": 12},
    {"text": "Suporte", "id": "2", "queueId": 3},
    {"text": "Financeiro", "id": "3"}
  ]
}`}</div>
            <Box mt={1}>
              <Chip size="small" label={tx("queueClick")} className={classes.chip} color="primary" variant="outlined" />
              <Chip size="small" label={tx("userClick")} className={classes.chip} color="secondary" variant="outlined" />
            </Box>
            <b>{tx("bodyList")}</b>
            <div className={classes.codeBlock}>{`{
  "number": "5585999999999",
  "body": "Selecione um serviço:",
  "type": "list",
  "buttonText": "Ver opções",
  "sections": [
    {
      "title": "Serviços",
      "rows": [
        {"title": "Suporte", "id": "suporte", "description": "Falar com suporte"},
        {"title": "Vendas", "id": "vendas", "description": "Falar com vendas"}
      ]
    }
  ]
}`}</div>
            <Box mt={1}>
              <Chip size="small" label="type: buttons | list | url | copy | pix | mixed" className={classes.chip} />
              <Chip size="small" label={tx("maxButtons")} className={classes.chip} />
            </Box>
          </>,
          <Formik initialValues={{ token: "", number: "", body: "", footer: "" }} enableReinitialize onSubmit={(values, actions) => {
            setTimeout(async () => { await handleSendButtons(values); actions.setSubmitting(false); actions.resetForm(); }, 400);
          }}>
            {({ isSubmitting }) => (
              <Form className={classes.formContainer}>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}><Field as={TextField} label={tx("registeredToken")} name="token" variant="outlined" margin="dense" fullWidth required /></Grid>
                  <Grid item xs={12} md={6}><Field as={TextField} label={tx("number")} name="number" variant="outlined" margin="dense" fullWidth required /></Grid>
                  <Grid item xs={12}><Field as={TextField} label={tx("message")} name="body" variant="outlined" margin="dense" fullWidth required multiline rows={2} /></Grid>
                  <Grid item xs={12}><Field as={TextField} label={tx("footer")} name="footer" variant="outlined" margin="dense" fullWidth /></Grid>
                  <Grid item xs={12}>
                    <TextField
                      label={tx("buttonsJson")}
                      multiline
                      rows={4}
                      variant="outlined"
                      margin="dense"
                      fullWidth
                      value={buttonsJson}
                      onChange={(e) => setButtonsJson(e.target.value)}
                      placeholder={`[{"text":"Opção 1","id":"1"},{"text":"Opção 2","id":"2"}]`}
                      required
                    />
                  </Grid>
                  <Grid item xs={12} className={classes.textRight}>
                    <Button type="submit" color="primary" variant="contained">{isSubmitting ? <CircularProgress size={24} /> : tx("sendButtons")}</Button>
                  </Grid>
                </Grid>
              </Form>
            )}
          </Formik>
        )}

        {renderSection(9, tx("mixedTitle"), true,
          <>
            <p>{tx("mixedDescription")}</p>
            <div className={classes.endpointBox}><b>{i18n.t("messagesAPIInstructions.post")}</b> {getButtonsEndpoint()}</div>
            <b>{i18n.t("messagesAPIInstructions.headers")}</b> Authorization Bearer (token) e Content-Type (application/json)<br /><br />
            <b>{tx("bodyJson")}</b>
            <div className={classes.codeBlock}>{`{
  "number": "5585999999999",
  "body": "Escolha uma opção ou acesse nosso site:",
  "footer": "Rodapé opcional",
  "type": "mixed",
  "buttons": [
    {"type": "quick_reply", "text": "Vendas", "id": "1"},
    {"type": "quick_reply", "text": "Suporte", "id": "2"},
    {"type": "cta_url", "text": "Abrir site", "url": "https://seusite.com.br"},
    {"type": "cta_copy", "text": "Copiar PIX", "copyCode": "00020126..."},
    {"type": "cta_call", "text": "Ligar agora", "phoneNumber": "+5511999999999"}
  ]
}`}</div>
            <Box mt={1}>
              <Chip size="small" label={tx("quickReplyHelp")} className={classes.chip} color="primary" variant="outlined" />
              <Chip size="small" label={tx("urlHelp")} className={classes.chip} color="primary" variant="outlined" />
              <Chip size="small" label={tx("copyHelp")} className={classes.chip} color="secondary" variant="outlined" />
              <Chip size="small" label={tx("callHelp")} className={classes.chip} color="secondary" variant="outlined" />
              <Chip size="small" label={tx("maxMixed")} className={classes.chip} />
            </Box>
          </>,
          <Formik initialValues={{ token: "", number: "", body: "", footer: "" }} enableReinitialize onSubmit={(values, actions) => {
            setTimeout(async () => { await handleSendMixedButtons(values); actions.setSubmitting(false); actions.resetForm(); }, 400);
          }}>
            {({ isSubmitting }) => (
              <Form className={classes.formContainer}>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}><Field as={TextField} label={tx("registeredToken")} name="token" variant="outlined" margin="dense" fullWidth required /></Grid>
                  <Grid item xs={12} md={6}><Field as={TextField} label={tx("number")} name="number" variant="outlined" margin="dense" fullWidth required /></Grid>
                  <Grid item xs={12}><Field as={TextField} label={tx("message")} name="body" variant="outlined" margin="dense" fullWidth required multiline rows={2} /></Grid>
                  <Grid item xs={12}><Field as={TextField} label={tx("footer")} name="footer" variant="outlined" margin="dense" fullWidth /></Grid>
                  <Grid item xs={12}>
                    <TextField
                      label={tx("mixedButtonsJson")}
                      multiline
                      rows={5}
                      variant="outlined"
                      margin="dense"
                      fullWidth
                      value={mixedButtonsJson}
                      onChange={(e) => setMixedButtonsJson(e.target.value)}
                      placeholder={`[{"type":"quick_reply","text":"Opção","id":"1"},{"type":"cta_url","text":"Link","url":"https://..."}]`}
                      required
                    />
                  </Grid>
                  <Grid item xs={12} className={classes.textRight}>
                    <Button type="submit" color="primary" variant="contained">{isSubmitting ? <CircularProgress size={24} /> : tx("sendMixed")}</Button>
                  </Grid>
                </Grid>
              </Form>
            )}
          </Formik>
        )}
      </Paper>
    </MainContainer>
  );
};

export default MessagesAPI;
