import React, { useState, useEffect, useRef, useContext } from "react";
import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";
import { head, isNil } from "lodash";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import IconButton from "@material-ui/core/IconButton";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import CircularProgress from "@material-ui/core/CircularProgress";
import AttachFileIcon from "@material-ui/icons/AttachFile";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import Chip from "@material-ui/core/Chip";
import RepeatIcon from "@material-ui/icons/Repeat";
import VisibilityIcon from "@material-ui/icons/Visibility";
import { i18n } from "../../translate/i18n";
import moment from "moment-timezone";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import {
  Box,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Tab,
  Tabs,
  FormControlLabel,
  Switch,
  Typography,
  Collapse,
  List,
  ListItem,
  ListItemText,
  FormHelperText,
  Card,
  CardContent,
  Checkbox,
  FormGroup,
} from "@material-ui/core";
import { AuthContext } from "../../context/Auth/AuthContext";
import ConfirmationModal from "../ConfirmationModal";
import UserStatusIcon from "../UserModal/statusIcon";
import Autocomplete, { createFilterOptions } from "@material-ui/lab/Autocomplete";
import useQueues from "../../hooks/useQueues";
import ContactGroupModal from "../ContactGroupModal";
import TemplatePreview from "../TemplatePreview";
import MessagePreview from "../MessagePreview";
import CampaignContactSelector from "../CampaignContactSelector";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexWrap: "wrap",
  },
  textField: {
    marginRight: theme.spacing(1),
    flex: 1,
  },
  extraAttr: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
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
  recurrenceCard: {
    marginTop: theme.spacing(2),
    padding: theme.spacing(2),
    backgroundColor: theme.palette.type === "dark" ? "#3c4043" : theme.palette.grey[50],
    color: theme.palette.text.primary,
    border: `1px solid ${theme.palette.divider}`,
  },
  previewCard: {
    marginTop: theme.spacing(1),
    maxHeight: 200,
    overflow: "auto",
  },
  recurrenceIcon: {
    marginRight: theme.spacing(1),
    color: theme.palette.primary.main,
  },
}));

const JitterSlider = ({ campaignSettings, setCampaignSettings }) => {
  const jitter = typeof campaignSettings.jitterPercent === "number" ? campaignSettings.jitterPercent : 40;
  const base = typeof campaignSettings.messageInterval === "number" ? campaignSettings.messageInterval : 0;
  const min = base > 0 ? Math.round(base * (1 - jitter / 100)) : 0;
  const max = base > 0 ? Math.round(base * (1 + jitter / 100)) : 0;

  return (
    <div style={{ padding: "0 4px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: "#555" }}>{i18n.t("marketing.modal.jitter")}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#1976d2" }}>±{jitter}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={80}
        step={5}
        value={jitter}
        onChange={(e) => {
          const val = Number(e.target.value);
          setCampaignSettings((p) => ({ ...p, jitterPercent: val }));
        }}
        style={{ width: "100%", accentColor: "#1976d2" }}
      />
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10, color: "#aaa" }}>0% fixo</span>
        <span style={{ fontSize: 10, color: "#aaa" }}>80% máximo</span>
      </div>
      {base > 0 ? (
        <p style={{ fontSize: 11, color: "#888", margin: "4px 0 0" }}>
          {i18n.t("marketing.modal.jitterRange", { base, min, max })}
        </p>
      ) : (
        <p style={{ fontSize: 11, color: "#e65100", margin: "4px 0 0" }}>
          ⚠️ Selecione um intervalo base acima
        </p>
      )}
    </div>
  );
};

const CampaignSchema = Yup.object().shape({
  name: Yup.string()
    .min(2, "Too Short!")
    .max(50, "Too Long!")
    .required("Required"),
  campaignType: Yup.string().oneOf(["whatsapp", "email"]).default("whatsapp"),
  emailSubject: Yup.string().when("campaignType", {
    is: "email",
    then: Yup.string().required("Assunto do email é obrigatório"),
    otherwise: Yup.string().nullable(),
  }),
  emailHtml: Yup.string().nullable(),
  emailHtml2: Yup.string().nullable(),
  emailHtml3: Yup.string().nullable(),
  emailHtml4: Yup.string().nullable(),
  emailHtml5: Yup.string().nullable(),
  emailFromAddress: Yup.string().email("Email inválido").nullable(),
  emailRatePerMinute: Yup.number().min(1).nullable(),
  emailDailyLimit: Yup.number().min(1).required("Limite diário é obrigatório"),
  emailContinueHour: Yup.string().nullable(),
  emailProvider: Yup.string().oneOf(["sendgrid", "smtp"]).nullable(),
  isRecurring: Yup.boolean().default(false),
  recurrenceType: Yup.string().when("isRecurring", {
    is: true,
    then: Yup.string()
      .oneOf(["minutely", "hourly", "daily", "weekly", "biweekly", "monthly", "yearly"])
      .required("Tipo de recorrência é obrigatório"),
    otherwise: Yup.string().nullable(),
  }),
  recurrenceInterval: Yup.number().when("isRecurring", {
    is: true,
    then: Yup.number().min(1, "Intervalo deve ser maior que 0").required("Intervalo é obrigatório"),
    otherwise: Yup.number().nullable(),
  }),
  recurrenceDaysOfWeek: Yup.array().when(["isRecurring", "recurrenceType"], {
    is: (isRecurring, recurrenceType) => isRecurring && recurrenceType === "weekly",
    then: Yup.array().min(1, "Selecione pelo menos um dia da semana").required(),
    otherwise: Yup.array().nullable(),
  }),
  recurrenceDayOfMonth: Yup.number().when(["isRecurring", "recurrenceType"], {
    is: (isRecurring, recurrenceType) => isRecurring && recurrenceType === "monthly",
    then: Yup.number().min(1, "Dia deve ser entre 1 e 31").max(31, "Dia deve ser entre 1 e 31").required("Dia do mês é obrigatório"),
    otherwise: Yup.number().nullable(),
  }),
  recurrenceEndDate: Yup.date().when("isRecurring", {
    is: true,
    then: Yup.date().min(new Date(), "Data final deve ser futura").nullable(),
    otherwise: Yup.date().nullable(),
  }),
  maxExecutions: Yup.number().when("isRecurring", {
    is: true,
    then: Yup.number().min(1, "Número máximo deve ser maior que 0").nullable(),
    otherwise: Yup.number().nullable(),
  }),
  interactiveButtons: Yup.array().max(5, "Adicione no máximo cinco botões."),
});

const CampaignModal = ({
  open,
  onClose,
  campaignId,
  initialValues,
  onSave,
  resetPagination,
}) => {
  const classes = useStyles();
  const theme = useTheme();
  const isMounted = useRef(true);
  const { user, socket } = useContext(AuthContext);
  const { companyId } = user;

  const currentTimezone = user?.timezone || "America/Sao_Paulo";

  const initialState = {
    name: "",
    campaignType: "whatsapp",
    emailSubject: "",
    emailHtml: "",
    emailHtml2: "",
    emailHtml3: "",
    emailHtml4: "",
    emailHtml5: "",
    emailFromName: "",
    emailFromAddress: "",
    emailRatePerMinute: 5,
    emailDailyLimit: 99,
    emailContinueHour: "08:00",
    emailProvider: "sendgrid",
    message1: "",
    message2: "",
    message3: "",
    message4: "",
    message5: "",
    interactiveButtons: [],
    confirmationMessage1: "",
    confirmationMessage2: "",
    confirmationMessage3: "",
    confirmationMessage4: "",
    confirmationMessage5: "",
    status: "INATIVA",
    confirmation: false,
    scheduledAt: "",
    contactListId: "",
    tagListId: "Nenhuma",
    companyId,
    statusTicket: "closed",
    openTicket: "disabled",
    isRecurring: false,
    recurrenceType: "",
    recurrenceInterval: 1,
    recurrenceDaysOfWeek: [],
    recurrenceDayOfMonth: 1,
    recurrenceEndDate: "",
    maxExecutions: null,
  };

  const [campaign, setCampaign] = useState(initialState);
  const [whatsapps, setWhatsapps] = useState([]);
  const [selectedWhatsapps, setSelectedWhatsapps] = useState([]);
  const [whatsappId, setWhatsappId] = useState(null);
  const [contactLists, setContactLists] = useState([]);
  const [tagLists, setTagLists] = useState([]);
  const [messageTab, setMessageTab] = useState(0);
  const [attachment, setAttachment] = useState(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [campaignEditable, setCampaignEditable] = useState(true);
  const [previewExecutions, setPreviewExecutions] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const attachmentFile = useRef(null);

  const [options, setOptions] = useState([]);
  const [queues, setQueues] = useState([]);
  const [allQueues, setAllQueues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedQueue, setSelectedQueue] = useState(null);
  const { findAll: findAllQueues } = useQueues();

  const initialCampaignSettings = {
    messageInterval: 20,
    longerIntervalAfter: 20,
    greaterInterval: 60,
    jitterPercent: 40,
    longPauseEvery: 50,
    longPauseDuration: 30,
  };
  const [campaignSettings, setCampaignSettings] = useState(initialCampaignSettings);
  const [savingSettings, setSavingSettings] = useState(false);

  const [isOficialSelected, setIsOficialSelected] = useState(false);
  const [oficialTemplates, setOficialTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [selectedTemplateData, setSelectedTemplateData] = useState(null);
  const [contactGroupModalOpen, setContactGroupModalOpen] = useState(false);
  const [templateVarValues, setTemplateVarValues] = useState({});
  const [individualContacts, setIndividualContacts] = useState([]);

  const daysOfWeekOptions = [
    { value: 0, label: "Domingo" },
    { value: 1, label: "Segunda-feira" },
    { value: 2, label: "Terça-feira" },
    { value: 3, label: "Quarta-feira" },
    { value: 4, label: "Quinta-feira" },
    { value: 5, label: "Sexta-feira" },
    { value: 6, label: "Sábado" },
  ];

  const getTemplateHeaderFormat = (template) => {
    if (!template) return "";

    if (Array.isArray(template.components)) {
      const headerComp = template.components.find(
        (c) => String(c.type || "").toLowerCase() === "header"
      );
      if (headerComp?.format) {
        return String(headerComp.format).toUpperCase();
      }
    }

    if (template.headerFormat) return String(template.headerFormat).toUpperCase();
    if (template.header_type) return String(template.header_type).toUpperCase();
    if (template.format) return String(template.format).toUpperCase();

    return "";
  };

  const selectedTemplate =
    selectedTemplateData ||
    oficialTemplates.find((t) => t.id === selectedTemplateId) ||
    null;

  const selectedHeaderFormat = getTemplateHeaderFormat(selectedTemplate);

  const templateRequiresMedia = ["IMAGE", "VIDEO", "DOCUMENT"].includes(
    selectedHeaderFormat
  );

  const templateAcceptAttr =
    selectedHeaderFormat === "IMAGE"
      ? "image/*"
      : selectedHeaderFormat === "VIDEO"
        ? "video/*"
        : selectedHeaderFormat === "DOCUMENT"
          ? ".pdf,.doc,.docx,.xls,.xlsx,.txt,.ppt,.pptx"
          : "*/*";

  const handlePreviewRecurrence = async (values) => {
    if (!values.isRecurring || !values.recurrenceType || !values.scheduledAt) {
      setPreviewExecutions([]);
      return;
    }

    try {
      const params = {
        recurrenceType: values.recurrenceType,
        recurrenceInterval: values.recurrenceInterval,
        recurrenceDaysOfWeek: JSON.stringify(values.recurrenceDaysOfWeek),
        recurrenceDayOfMonth: values.recurrenceDayOfMonth,
      };

      if (campaignId) {
        const { data } = await api.get(`/campaigns/${campaignId}/recurrence-preview`, { params });
        setPreviewExecutions(data.executions);
      } else {
        const mockExecutions = calculateMockExecutions(values);
        setPreviewExecutions(mockExecutions);
      }
    } catch (err) {
      console.error("Erro ao buscar preview:", err);
    }
  };

  const calculateMockExecutions = (values) => {
    const executions = [];
    let currentDate = moment.tz(values.scheduledAt, currentTimezone);

    for (let i = 0; i < 5; i++) {
      executions.push(currentDate.format("DD/MM/YYYY HH:mm"));

      switch (values.recurrenceType) {
        case "minutely":
          currentDate = currentDate.clone().add(values.recurrenceInterval, "minutes");
          break;
        case "hourly":
          currentDate = currentDate.clone().add(values.recurrenceInterval, "hours");
          break;
        case "daily":
          currentDate = currentDate.clone().add(values.recurrenceInterval, "days");
          break;
        case "weekly":
          currentDate = currentDate.clone().add(values.recurrenceInterval, "weeks");
          break;
        case "biweekly":
          currentDate = currentDate.clone().add(values.recurrenceInterval * 2, "weeks");
          break;
        case "monthly":
          currentDate = currentDate.clone().add(values.recurrenceInterval, "months");
          if (values.recurrenceDayOfMonth) {
            currentDate = currentDate.date(values.recurrenceDayOfMonth);
          }
          break;
        case "yearly":
          currentDate = currentDate.clone().add(values.recurrenceInterval, "years");
          break;
        default:
          break;
      }
    }

    return executions;
  };

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (isMounted.current) {
      const loadQueues = async () => {
        const list = await findAllQueues();
        setAllQueues(list);
        setQueues(list);
      };
      loadQueues();
    }
  }, []);

  useEffect(() => {
    if (searchParam.length < 3) {
      setLoading(false);
      setSelectedQueue("");
      return;
    }
    const delayDebounceFn = setTimeout(() => {
      setLoading(true);
      const fetchUsers = async () => {
        try {
          const { data } = await api.get("/users/");
          setOptions(data.users);
          setLoading(false);
        } catch (err) {
          setLoading(false);
          toastError(err);
        }
      };
      fetchUsers();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchParam]);

  useEffect(() => {
    if (isMounted.current) {
      if (initialValues) {
        setCampaign((prevState) => {
          return { ...prevState, ...initialValues };
        });
      }

      api
        .get(`/contact-lists/list`, { params: { companyId } })
        .then(({ data }) => setContactLists(data));

      api
        .get(`/whatsapp`, { params: { companyId, session: 0 } })
        .then(({ data }) => {
          const mappedWhatsapps = data.map((whatsapp) => ({
            ...whatsapp,
            selected: false,
          }));
          setWhatsapps(mappedWhatsapps);
        });

      api
        .get(`/tags/list`, { params: { companyId, kanban: 0 } })
        .then(({ data }) => {
          const fetchedTags = data;
          const formattedTagLists = fetchedTags
            .filter((tag) => tag.contacts.length > 0)
            .map((tag) => ({
              id: tag.id,
              name: `${tag.name} (${tag.contacts.length})`,
            }));
          setTagLists(formattedTagLists);
        })
        .catch((error) => {
          console.error("Error retrieving tags:", error);
        });

      if (!campaignId) {
        api
          .get("/email-settings", { params: { provider: "sendgrid" } })
          .then(({ data }) => {
            setCampaign(prev => ({
              ...prev,
              emailProvider: data.provider || "sendgrid",
              emailContinueHour: data.continueHour || "08:00",
              emailRatePerMinute: data.ratePerMinute || 5,
              emailDailyLimit: data.dailyLimit || 99,
              emailFromName: data.fromName || "",
              emailFromAddress: data.fromAddress || ""
            }));
          })
          .catch(() => { });
      }
      const numericKeys = [
        "messageInterval",
        "longerIntervalAfter",
        "greaterInterval",
        "jitterPercent",
        "longPauseEvery",
        "longPauseDuration",
      ];
      api.get("/campaign-settings").then(({ data }) => {
        if (Array.isArray(data) && data.length > 0) {
          const settingsList = [];
          data.forEach((item) => {
            const val = numericKeys.includes(item.key) ? Number(item.value) : item.value;
            settingsList.push([item.key, val]);
          });
          setCampaignSettings((prev) => ({ ...prev, ...Object.fromEntries(settingsList) }));
        }
      });

      if (!campaignId) return;

      api.get(`/campaigns/${campaignId}`).then(({ data }) => {
        if (data?.user) setSelectedUser(data.user);
        if (data?.queue) setSelectedQueue(data.queue.id);
        if (data?.whatsappId) {
          setWhatsappId(parseInt(data.whatsappId, 10));
        } else {
          setWhatsappId(null);
        }
        if (data?.templateId) {
          setSelectedTemplateId(data.templateId);
        }

        setCampaign((prev) => {
          let prevCampaignData = Object.assign({}, prev);

          Object.entries(data).forEach(([key, value]) => {
            if (key === "scheduledAt" && value !== "" && value !== null) {
              prevCampaignData[key] = moment
                .utc(value)
                .tz(currentTimezone)
                .format("YYYY-MM-DDTHH:mm");
            } else if (key === "recurrenceEndDate" && value !== "" && value !== null) {
              prevCampaignData[key] = moment(value).format("YYYY-MM-DD");
            } else if (key === "recurrenceDaysOfWeek" && value) {
              prevCampaignData[key] = JSON.parse(value);
            } else if (key === "interactiveButtons") {
              if (Array.isArray(value)) {
                prevCampaignData[key] = value;
              } else {
                try {
                  prevCampaignData[key] = value ? JSON.parse(value) : [];
                } catch {
                  prevCampaignData[key] = [];
                }
              }
            } else {
              prevCampaignData[key] = value === null ? "" : value;
            }
          });

          return prevCampaignData;
        });
      });
    }
  }, [campaignId, open, initialValues, companyId]);

  useEffect(() => {
    if (!whatsappId || whatsapps.length === 0) {
      setIsOficialSelected(false);
      setOficialTemplates([]);
      setSelectedTemplateData(null);
      return;
    }

    const selectedWpp = whatsapps.find((w) => w.id === whatsappId);

    if (selectedWpp && selectedWpp.channel === "whatsapp_oficial") {
      setIsOficialSelected(true);
      api
        .get(`/quick-messages/list`, {
          params: { companyId, isOficial: true, whatsappId: whatsappId },
        })
        .then(({ data }) => {
          const approved = data.filter((t) => t.status === "APPROVED");
          setOficialTemplates(approved);

          if (selectedTemplateId) {
            const currentTemplate = approved.find((t) => t.id === selectedTemplateId) || null;
            setSelectedTemplateData(currentTemplate);
          } else {
            setSelectedTemplateData(null);
          }
        })
        .catch((err) => {
          console.error("Erro ao buscar templates:", err);
          setOficialTemplates([]);
          setSelectedTemplateData(null);
        });
    } else {
      setIsOficialSelected(false);
      setOficialTemplates([]);
      setSelectedTemplateId(null);
      setSelectedTemplateData(null);
    }
  }, [whatsappId, whatsapps, companyId, selectedTemplateId]);

  useEffect(() => {
    if (selectedTemplateId && oficialTemplates.length > 0) {
      const tpl = oficialTemplates.find((t) => t.id === selectedTemplateId) || null;
      setSelectedTemplateData(tpl);
    } else if (!selectedTemplateId) {
      setSelectedTemplateData(null);
    }
  }, [selectedTemplateId, oficialTemplates]);

  useEffect(() => {
    const now = moment().tz(currentTimezone);

    const scheduledAt = campaign.scheduledAt
      ? moment.tz(campaign.scheduledAt, "YYYY-MM-DDTHH:mm", currentTimezone)
      : null;

    const isEditable =
      campaign.status === "INATIVA" ||
      campaign.status === "PROGRAMADA";

    setCampaignEditable(isEditable);
  }, [campaign.status, campaign.scheduledAt, currentTimezone]);

  const handleClose = () => {
    onClose();
    setCampaign(initialState);
    setPreviewExecutions([]);
    setShowPreview(false);
    setSelectedTemplateId(null);
    setSelectedTemplateData(null);
    setIsOficialSelected(false);
    setOficialTemplates([]);
    setTemplateVarValues({});
    setAttachment(null);
    setWhatsappId(null);
    if (attachmentFile.current) {
      attachmentFile.current.value = null;
    }
  };

  const handleAttachmentFile = (e) => {
    const file = head(e.target.files);

    if (!file) return;

    if (isOficialSelected && templateRequiresMedia) {
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");

      if (selectedHeaderFormat === "IMAGE" && !isImage) {
        toast.error("O template selecionado exige uma imagem.");
        e.target.value = null;
        return;
      }

      if (selectedHeaderFormat === "VIDEO" && !isVideo) {
        toast.error("O template selecionado exige um vídeo.");
        e.target.value = null;
        return;
      }

      if (selectedHeaderFormat === "DOCUMENT" && (isImage || isVideo)) {
        toast.error("O template selecionado exige um documento.");
        e.target.value = null;
        return;
      }
    }

    setAttachment(file);
  };

  const handleSaveCampaign = async (values) => {
    if (values.campaignType === "email") {
      const hasAnyEmailHtml = [
        values.emailHtml,
        values.emailHtml2,
        values.emailHtml3,
        values.emailHtml4,
        values.emailHtml5
      ].some(html => html && String(html).trim() !== "");

      if (!values.emailSubject || !hasAnyEmailHtml) {
        toast.error("Preencha o assunto e pelo menos um conteúdo HTML do email.");
        return;
      }
    } else {
      if (isOficialSelected && !selectedTemplateId) {
        toast.error("Selecione um template aprovado para campanhas via API Oficial.");
        return;
      }

      if (!isOficialSelected && Array.isArray(values.interactiveButtons)) {
        const invalidButton = values.interactiveButtons.find((button) => {
          if (!button?.text?.trim()) return true;
          if (button.type === "cta_url") return !/^https?:\/\//i.test(button.url || "");
          if (button.type === "cta_copy") return !String(button.copyCode || "").trim();
          if (button.type === "cta_call") return !/^\+?[0-9]{8,15}$/.test(button.phoneNumber || "");
          return button.type === "quick_reply" && !String(button.id || "").trim();
        });
        if (invalidButton) {
          toast.error("Revise os campos dos botões interativos antes de salvar.");
          return;
        }
      }
    }

    if (
      values.campaignType !== "email" &&
      isOficialSelected &&
      templateRequiresMedia &&
      !attachment &&
      !campaign.mediaPath
    ) {
      toast.error(
        `O template selecionado exige ${selectedHeaderFormat === "IMAGE"
          ? "uma imagem"
          : selectedHeaderFormat === "VIDEO"
            ? "um vídeo"
            : "um documento"
        } no cabeçalho.`
      );
      return;
    }

    try {
      const dataValues = {
        ...values,
        whatsappId: values.campaignType === "email" ? null : whatsappId,
        campaignType: values.campaignType || "whatsapp",
        interactiveButtons:
          values.campaignType === "whatsapp" && !isOficialSelected
            ? values.interactiveButtons || []
            : [],
        emailSubject: values.emailSubject || null,
        emailHtml: values.emailHtml || "",
        emailHtml1: values.emailHtml1 || "",
        emailHtml2: values.emailHtml2 || "",
        emailHtml3: values.emailHtml3 || "",
        emailHtml4: values.emailHtml4 || "",
        emailHtml5: values.emailHtml5 || "",
        emailFromName: values.emailFromName || null,
        emailFromAddress: values.emailFromAddress || null,
        emailRatePerMinute: Number(values.emailRatePerMinute),
        emailDailyLimit: Number(values.emailDailyLimit),
        emailContinueHour: values.emailContinueHour,
        emailProvider: values.emailProvider || "sendgrid",
        confirmation: values.campaignType === "email" ? false : values.confirmation,
        openTicket: values.campaignType === "email" ? "disabled" : values.openTicket,
        templateId: isOficialSelected ? selectedTemplateId : null,
        templateVariables:
          isOficialSelected && Object.keys(templateVarValues).length > 0
            ? JSON.stringify(templateVarValues)
            : null,
        userId: selectedUser?.id || null,
        queueId: selectedQueue || null,
        recurrenceDaysOfWeek:
          values.isRecurring &&
            values.recurrenceDaysOfWeek &&
            values.recurrenceDaysOfWeek.length > 0
            ? values.recurrenceDaysOfWeek
            : null,
      };

      Object.entries(values).forEach(([key, value]) => {
        if (key === "scheduledAt" && value !== "" && value !== null) {
          dataValues[key] = `${value.replace("T", " ")}:00`;
        } else if (key === "recurrenceEndDate" && value !== "" && value !== null) {
          dataValues[key] = `${value} 23:59:59`;
        } else if (
          key !== "recurrenceDaysOfWeek" &&
          key !== "emailRatePerMinute" &&
          key !== "emailDailyLimit" &&
          key !== "emailContinueHour"
        ) {
          dataValues[key] = value === "" ? null : value;
        }
      });

      if (values.campaignType === "email") {
        dataValues.emailRatePerMinute = Number(values.emailRatePerMinute);
        dataValues.emailDailyLimit = Number(values.emailDailyLimit);
        dataValues.emailContinueHour = values.emailContinueHour;
      }

      if (!values.isRecurring) {
        dataValues.recurrenceType = null;
        dataValues.recurrenceInterval = null;
        dataValues.recurrenceDaysOfWeek = null;
        dataValues.recurrenceDayOfMonth = null;
        dataValues.recurrenceEndDate = null;
        dataValues.maxExecutions = null;
      }

      if (
        !dataValues.contactListId &&
        (!dataValues.tagListId || dataValues.tagListId === "Nenhuma") &&
        individualContacts.length > 0
      ) {
        const listName = `Campanha - ${dataValues.name || "Sem nome"} - ${moment().format("DD/MM HH:mm")}`;
        const { data: newList } = await api.post("/contact-lists/from-contacts", {
          name: listName,
          contactIds: individualContacts,
        });
        dataValues.contactListId = newList.id;
      }

      if (campaignId) {
        await api.put(`/campaigns/${campaignId}`, dataValues);

        if (attachment != null) {
          const formData = new FormData();
          formData.append("file", attachment);
          await api.post(`/campaigns/${campaignId}/media-upload`, formData);
        }

        handleClose();
      } else {
        const { data } = await api.post("/campaigns", dataValues);

        if (attachment != null) {
          const formData = new FormData();
          formData.append("file", attachment);
          await api.post(`/campaigns/${data.id}/media-upload`, formData);
        }

        if (onSave) {
          onSave(data);
        }

        handleClose();
      }

      toast.success(i18n.t("campaigns.toasts.success"));
    } catch (err) {
      console.log(err);
      toastError(err);
    }
  };

  const deleteMedia = async () => {
    if (attachment) {
      setAttachment(null);
      if (attachmentFile.current) {
        attachmentFile.current.value = null;
      }
    }

    if (campaign.mediaPath) {
      await api.delete(`/campaigns/${campaign.id}/media-upload`);
      setCampaign((prev) => ({ ...prev, mediaPath: null, mediaName: null }));
      toast.success(i18n.t("campaigns.toasts.deleted"));
    }
  };

  const renderMessageField = (identifier) => {
    return (
      <Field
        as={TextField}
        id={identifier}
        name={identifier}
        fullWidth
        rows={5}
        label={i18n.t(`campaigns.dialog.form.${identifier}`)}
        placeholder={i18n.t("campaigns.dialog.form.messagePlaceholder")}
        multiline={true}
        variant="outlined"
        helperText={i18n.t("campaigns.dialog.help")}
        disabled={!campaignEditable && campaign.status !== "CANCELADA"}
      />
    );
  };

  const renderConfirmationMessageField = (identifier) => {
    return (
      <Field
        as={TextField}
        id={identifier}
        name={identifier}
        fullWidth
        rows={5}
        label={i18n.t(`campaigns.dialog.form.${identifier}`)}
        placeholder={i18n.t("campaigns.dialog.form.messagePlaceholder")}
        multiline={true}
        variant="outlined"
        disabled={!campaignEditable && campaign.status !== "CANCELADA"}
      />
    );
  };

  const renderInteractiveButtonsEditor = (values, setFieldValue) => {
    const buttons = Array.isArray(values.interactiveButtons)
      ? values.interactiveButtons
      : [];

    const updateButton = (index, changes) => {
      const next = buttons.map((button, buttonIndex) =>
        buttonIndex === index ? { ...button, ...changes } : button
      );
      setFieldValue("interactiveButtons", next);
    };

    const removeButton = (index) => {
      setFieldValue(
        "interactiveButtons",
        buttons.filter((_, buttonIndex) => buttonIndex !== index)
      );
    };

    return (
      <Box
        mt={2}
        p={2}
        style={{
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 8,
          backgroundColor: theme.palette.background.paper,
        }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <div>
            <Typography variant="subtitle2" style={{ fontWeight: 600 }}>
              {i18n.t("marketing.editor.interactiveButtons")}
            </Typography>
            <Typography variant="caption" color="textSecondary">
              {i18n.t("marketing.editor.interactiveButtonsHelp")}
            </Typography>
          </div>
          <Button
            size="small"
            color="primary"
            variant="outlined"
            disabled={!campaignEditable || buttons.length >= 5}
            onClick={() =>
              setFieldValue("interactiveButtons", [
                ...buttons,
                {
                  type: "quick_reply",
                  text: "",
                  id: `campaign_reply_${Date.now()}`,
                  url: "",
                  copyCode: "",
                  phoneNumber: "",
                },
              ])
            }
          >
            {i18n.t("marketing.editor.addButton")}
          </Button>
        </Box>

        {buttons.length === 0 && (
          <Typography variant="body2" color="textSecondary">
            {i18n.t("marketing.editor.noButtons")}
          </Typography>
        )}

        {buttons.map((button, index) => (
          <Box
            key={`${button.id || button.type}-${index}`}
            mt={1}
            p={1.5}
            style={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 6, backgroundColor: theme.palette.background.paper }}
          >
            <Grid container spacing={1} alignItems="center">
              <Grid item xs={12} md={3}>
                <FormControl variant="outlined" margin="dense" fullWidth>
                  <InputLabel>{i18n.t("queueIntegration.table.type")}</InputLabel>
                  <Select
                    value={button.type || "quick_reply"}
                    label={i18n.t("queueIntegration.table.type")}
                    disabled={!campaignEditable}
                    onChange={(event) => {
                      const type = event.target.value;
                      updateButton(index, {
                        type,
                        id: button.id || `campaign_reply_${Date.now()}_${index}`,
                        url: "",
                        copyCode: "",
                        phoneNumber: "",
                      });
                    }}
                  >
                    <MenuItem value="quick_reply">{i18n.t("marketing.editor.quickReply")}</MenuItem>
                    <MenuItem value="cta_url">{i18n.t("marketing.editor.openUrl")}</MenuItem>
                    <MenuItem value="cta_copy">{i18n.t("marketing.editor.copyCode")}</MenuItem>
                    <MenuItem value="cta_call">{i18n.t("marketing.editor.call")}</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  label={i18n.t("marketing.editor.buttonText")}
                  value={button.text || ""}
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  inputProps={{ maxLength: 25 }}
                  disabled={!campaignEditable}
                  onChange={(event) => updateButton(index, { text: event.target.value })}
                />
              </Grid>

              <Grid item xs={10} md={4}>
                {button.type === "cta_url" ? (
                  <TextField
                    label={i18n.t("marketing.editor.fullUrl")}
                    value={button.url || ""}
                    placeholder="https://seusite.com"
                    variant="outlined"
                    margin="dense"
                    fullWidth
                    disabled={!campaignEditable}
                    onChange={(event) => updateButton(index, { url: event.target.value })}
                  />
                ) : button.type === "cta_copy" ? (
                  <TextField
                    label={i18n.t("marketing.editor.codeToCopy")}
                    value={button.copyCode || ""}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                    disabled={!campaignEditable}
                    onChange={(event) => updateButton(index, { copyCode: event.target.value })}
                  />
                ) : button.type === "cta_call" ? (
                  <TextField
                    label={i18n.t("marketing.editor.internationalPhone")}
                    value={button.phoneNumber || ""}
                    placeholder="+5541999999999"
                    variant="outlined"
                    margin="dense"
                    fullWidth
                    disabled={!campaignEditable}
                    onChange={(event) => updateButton(index, { phoneNumber: event.target.value })}
                  />
                ) : (
                  <TextField
                    label={i18n.t("marketing.editor.replyId")}
                    value={button.id || ""}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                    disabled={!campaignEditable}
                    onChange={(event) => updateButton(index, { id: event.target.value })}
                  />
                )}
              </Grid>

              <Grid item xs={2} md={1}>
                <IconButton
                  aria-label={i18n.t("marketing.editor.removeButton")}
                  disabled={!campaignEditable}
                  onClick={() => removeButton(index)}
                >
                  <DeleteOutlineIcon color="secondary" />
                </IconButton>
              </Grid>
            </Grid>
          </Box>
        ))}
      </Box>
    );
  };

  const cancelCampaign = async () => {
    try {
      await api.post(`/campaigns/${campaign.id}/cancel`);
      toast.success(i18n.t("campaigns.toasts.cancel"));
      setCampaign((prev) => ({ ...prev, status: "CANCELADA" }));
      resetPagination();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const restartCampaign = async () => {
    try {
      await api.post(`/campaigns/${campaign.id}/restart`);
      toast.success(i18n.t("campaigns.toasts.restart"));
      setCampaign((prev) => ({ ...prev, status: "EM_ANDAMENTO" }));
      resetPagination();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const filterOptions = createFilterOptions({
    trim: true,
  });

  return (
    <div className={classes.root}>
      <ConfirmationModal
        title={i18n.t("campaigns.confirmationModal.deleteTitle")}
        open={confirmationOpen}
        onClose={() => setConfirmationOpen(false)}
        onConfirm={deleteMedia}
      >
        {i18n.t("campaigns.confirmationModal.deleteMessage")}
      </ConfirmationModal>

      <Dialog
        open={open}
        onClose={handleClose}
        fullWidth
        maxWidth="md"
        scroll="paper"
        PaperProps={{
          style: {
            maxHeight: "90vh",
          },
        }}
      >
        <DialogTitle id="form-dialog-title">
          {campaignEditable ? (
            <>
              {campaignId
                ? `${i18n.t("campaigns.dialog.update")}`
                : `${i18n.t("campaigns.dialog.new")}`}
            </>
          ) : (
            <>{`${i18n.t("campaigns.dialog.readonly")}`}</>
          )}
        </DialogTitle>

        <div style={{ display: "none" }}>
          <input
            type="file"
            ref={attachmentFile}
            accept={isOficialSelected && templateRequiresMedia ? templateAcceptAttr : "*/*"}
            onChange={(e) => handleAttachmentFile(e)}
          />
        </div>

        <Formik
          initialValues={campaign}
          enableReinitialize={true}
          validationSchema={CampaignSchema}
          onSubmit={(values, actions) => {
            setTimeout(() => {
              handleSaveCampaign(values);
              actions.setSubmitting(false);
            }, 400);
          }}
        >
          {({ values, errors, touched, isSubmitting, setFieldValue }) => (
            <Form>
              <ContactGroupModal
                open={contactGroupModalOpen}
                onClose={() => setContactGroupModalOpen(false)}
                onGroupCreated={(newGroup) => {
                  setContactLists((prev) => [...prev, newGroup]);
                  setFieldValue("contactListId", newGroup.id);

                  api.get(`/contact-lists/list`, { params: { companyId } }).then(({ data }) => {
                    setContactLists(data);
                    setFieldValue("contactListId", newGroup.id);
                  });
                }}
              />

              <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
                <Tabs
                  value={messageTab}
                  onChange={(e, val) => setMessageTab(val)}
                  indicatorColor="primary"
                  textColor="primary"
                  variant="fullWidth"
                >
                  <Tab label={i18n.t("campaignReport.campaign")} />
                  <Tab label={`📋 ${i18n.t("marketing.modal.contactListsTab")}`} />
                  <Tab label={`⚙️ ${i18n.t("marketing.modal.settingsTab")}`} />
                </Tabs>
              </Box>

              <div hidden={messageTab !== 0}>
                <DialogContent dividers>
                  <Grid spacing={2} container>
                    <Grid xs={12} md={4} item>
                      <Field
                        as={TextField}
                        label={i18n.t("campaigns.dialog.form.name")}
                        name="name"
                        error={touched.name && Boolean(errors.name)}
                        helperText={touched.name && errors.name}
                        variant="outlined"
                        margin="dense"
                        fullWidth
                        className={classes.textField}
                        disabled={!campaignEditable}
                      />
                    </Grid>

                    <Grid xs={12} md={4} item>
                      <FormControl variant="outlined" margin="dense" fullWidth>
                        <InputLabel>Tipo da Campanha</InputLabel>
                        <Field
                          as={Select}
                          name="campaignType"
                          label="Tipo da Campanha"
                          disabled={!campaignEditable}
                          onChange={(e) => {
                            setFieldValue("campaignType", e.target.value);
                            if (e.target.value === "email") {
                              setWhatsappId(null);
                              setFieldValue("confirmation", false);
                              setFieldValue("openTicket", "disabled");
                            }
                          }}
                        >
                          <MenuItem value="whatsapp">WhatsApp</MenuItem>
                          <MenuItem value="email">Email Marketing</MenuItem>
                        </Field>
                      </FormControl>
                    </Grid>

                    {values.campaignType !== "email" && (
                      <Grid xs={12} md={4} item>
                        <FormControl
                          variant="outlined"
                          margin="dense"
                          fullWidth
                          className={classes.formControl}
                        >
                          <InputLabel id="whatsapp-selection-label">
                            {i18n.t("campaigns.dialog.form.whatsapp")}
                          </InputLabel>
                          <Field
                            as={Select}
                            label={i18n.t("campaigns.dialog.form.whatsapp")}
                            placeholder={i18n.t("campaigns.dialog.form.whatsapp")}
                            labelId="whatsapp-selection-label"
                            id="whatsappIds"
                            name="whatsappIds"
                            required
                            error={touched.whatsappId && Boolean(errors.whatsappId)}
                            disabled={!campaignEditable}
                            value={whatsappId}
                            onChange={(event) => {
                              setWhatsappId(event.target.value);
                            }}
                          >
                            {whatsapps &&
                              whatsapps.map((whatsapp) => (
                                <MenuItem key={whatsapp.id} value={whatsapp.id}>
                                  {whatsapp.name}
                                  {whatsapp.channel === "whatsapp_oficial" && (
                                    <Chip
                                      size="small"
                                      label="API Oficial"
                                      style={{
                                        marginLeft: 8,
                                        backgroundColor: "#25d366",
                                        color: "#fff",
                                        height: 20,
                                        fontSize: "0.7rem",
                                      }}
                                    />
                                  )}
                                </MenuItem>
                              ))}
                          </Field>
                        </FormControl>
                      </Grid>
                    )}

                    {isOficialSelected && values.campaignType !== "email" && (
                      <Grid xs={12} md={4} item>
                        <FormControl
                          variant="outlined"
                          margin="dense"
                          fullWidth
                          className={classes.formControl}
                        >
                          <InputLabel id="template-selection-label">
                            Template *
                          </InputLabel>
                          <Select
                            label="Template *"
                            labelId="template-selection-label"
                            id="templateId"
                            value={selectedTemplateId || ""}
                            onChange={(e) => {
                              const newTemplateId = e.target.value;
                              setSelectedTemplateId(newTemplateId);

                              const template =
                                oficialTemplates.find((t) => t.id === newTemplateId) || null;
                              setSelectedTemplateData(template);

                              const newFormat = getTemplateHeaderFormat(template);
                              if (!["IMAGE", "VIDEO", "DOCUMENT"].includes(newFormat)) {
                                setAttachment(null);
                                if (attachmentFile.current) {
                                  attachmentFile.current.value = null;
                                }
                              }
                            }}
                            disabled={!campaignEditable}
                            required
                          >
                            {oficialTemplates.map((template) => (
                              <MenuItem key={template.id} value={template.id}>
                                {template.shortcode} ({template.category})
                              </MenuItem>
                            ))}
                          </Select>
                          <FormHelperText>
                            {oficialTemplates.length === 0
                              ? "Nenhum template aprovado encontrado. Crie um template antes de enviar."
                              : templateRequiresMedia
                                ? `Este template exige ${selectedHeaderFormat === "IMAGE"
                                  ? "imagem"
                                  : selectedHeaderFormat === "VIDEO"
                                    ? "vídeo"
                                    : "documento"
                                } no cabeçalho.`
                                : "Obrigatório para API Oficial. Mensagens sem template falham fora da janela de 24h."}
                          </FormHelperText>
                        </FormControl>
                      </Grid>
                    )}

                    <Grid xs={12} md={4} item>
                      <Field
                        as={TextField}
                        label={i18n.t("campaigns.dialog.form.scheduledAt")}
                        name="scheduledAt"
                        error={touched.scheduledAt && Boolean(errors.scheduledAt)}
                        helperText={touched.scheduledAt && errors.scheduledAt}
                        variant="outlined"
                        margin="dense"
                        type="datetime-local"
                        InputLabelProps={{
                          shrink: true,
                        }}
                        fullWidth
                        className={classes.textField}
                        disabled={!campaignEditable}
                      />
                    </Grid>

                    <Grid xs={12} item>
                      <Card className={classes.recurrenceCard}>
                        <CardContent>
                          <Box display="flex" alignItems="center" mb={2}>
                            <RepeatIcon className={classes.recurrenceIcon} />
                            <Typography variant="h6">
                              {i18n.t("marketing.modal.recurrenceSettings")}
                            </Typography>
                          </Box>

                          <Grid spacing={2} container>
                            <Grid xs={12} item>
                              <FormControlLabel
                                control={
                                  <Field
                                    as={Switch}
                                    name="isRecurring"
                                    checked={values.isRecurring}
                                    onChange={(e) => {
                                      setFieldValue("isRecurring", e.target.checked);
                                      if (!e.target.checked) {
                                        setPreviewExecutions([]);
                                        setShowPreview(false);
                                      }
                                    }}
                                    disabled={!campaignEditable}
                                  />
                                }
                                label={i18n.t("marketing.modal.enableRecurrence")}
                              />
                            </Grid>

                            <Grid xs={12} item style={{ padding: 0 }}>
                              <Collapse in={values.isRecurring} style={{ width: "100%" }}>
                                <Grid spacing={2} container>
                                  <Grid xs={12} md={3} item>
                                    <FormControl
                                      variant="outlined"
                                      margin="dense"
                                      fullWidth
                                      error={touched.recurrenceType && Boolean(errors.recurrenceType)}
                                    >
                                      <InputLabel>Tipo de Recorrência</InputLabel>
                                      <Field
                                        as={Select}
                                        name="recurrenceType"
                                        label="Tipo de Recorrência"
                                        disabled={!campaignEditable}
                                        onChange={(e) => {
                                          setFieldValue("recurrenceType", e.target.value);
                                          setFieldValue("recurrenceDaysOfWeek", []);
                                          setFieldValue("recurrenceDayOfMonth", 1);
                                        }}
                                      >
                                        <MenuItem value="minutely">Por Minuto</MenuItem>
                                        <MenuItem value="hourly">Por Hora</MenuItem>
                                        <MenuItem value="daily">Diário</MenuItem>
                                        <MenuItem value="weekly">Semanal</MenuItem>
                                        <MenuItem value="biweekly">Quinzenal</MenuItem>
                                        <MenuItem value="monthly">{i18n.t("compaies.table.monthly")}</MenuItem>
                                        <MenuItem value="yearly">{i18n.t("compaies.table.yearly")}</MenuItem>
                                      </Field>
                                      {touched.recurrenceType && errors.recurrenceType && (
                                        <FormHelperText error>{errors.recurrenceType}</FormHelperText>
                                      )}
                                    </FormControl>
                                  </Grid>

                                  <Grid xs={12} md={3} item>
                                    <Field
                                      as={TextField}
                                      name="recurrenceInterval"
                                      label={i18n.t("recurrenceSection.labelInterval")}
                                      type="number"
                                      variant="outlined"
                                      margin="dense"
                                      fullWidth
                                      inputProps={{ min: 1 }}
                                      error={touched.recurrenceInterval && Boolean(errors.recurrenceInterval)}
                                      helperText={
                                        (touched.recurrenceInterval && errors.recurrenceInterval) ||
                                        `A cada ${values.recurrenceInterval || 1} ${values.recurrenceType === "minutely"
                                          ? "minuto(s)"
                                          : values.recurrenceType === "hourly"
                                            ? "hora(s)"
                                            : values.recurrenceType === "daily"
                                              ? "dia(s)"
                                              : values.recurrenceType === "weekly"
                                                ? "semana(s)"
                                                : values.recurrenceType === "biweekly"
                                                  ? "quinzena(s)"
                                                  : values.recurrenceType === "monthly"
                                                    ? "mês(es)"
                                                    : values.recurrenceType === "yearly"
                                                      ? "ano(s)"
                                                      : ""
                                        }`
                                      }
                                      disabled={!campaignEditable}
                                    />
                                  </Grid>

                                  {values.recurrenceType === "weekly" && (
                                    <Grid xs={12} md={6} item>
                                      <Typography variant="subtitle2" gutterBottom>
                                        Dias da Semana
                                      </Typography>
                                      <FormGroup row>
                                        {daysOfWeekOptions.map((day) => (
                                          <FormControlLabel
                                            key={day.value}
                                            control={
                                              <Checkbox
                                                checked={values.recurrenceDaysOfWeek.includes(day.value)}
                                                onChange={(e) => {
                                                  const currentDays = values.recurrenceDaysOfWeek || [];
                                                  if (e.target.checked) {
                                                    setFieldValue("recurrenceDaysOfWeek", [
                                                      ...currentDays,
                                                      day.value,
                                                    ]);
                                                  } else {
                                                    setFieldValue(
                                                      "recurrenceDaysOfWeek",
                                                      currentDays.filter((d) => d !== day.value)
                                                    );
                                                  }
                                                }}
                                                disabled={!campaignEditable}
                                              />
                                            }
                                            label={day.label.substring(0, 3)}
                                          />
                                        ))}
                                      </FormGroup>
                                      {touched.recurrenceDaysOfWeek && errors.recurrenceDaysOfWeek && (
                                        <FormHelperText error>{errors.recurrenceDaysOfWeek}</FormHelperText>
                                      )}
                                    </Grid>
                                  )}

                                  {values.recurrenceType === "monthly" && (
                                    <Grid xs={12} md={3} item>
                                      <Field
                                        as={TextField}
                                        name="recurrenceDayOfMonth"
                                        label="Dia do Mês"
                                        type="number"
                                        variant="outlined"
                                        margin="dense"
                                        fullWidth
                                        inputProps={{ min: 1, max: 31 }}
                                        error={touched.recurrenceDayOfMonth && Boolean(errors.recurrenceDayOfMonth)}
                                        helperText={
                                          (touched.recurrenceDayOfMonth && errors.recurrenceDayOfMonth) ||
                                          "Dia específico do mês (1-31)"
                                        }
                                        disabled={!campaignEditable}
                                      />
                                    </Grid>
                                  )}

                                  <Grid xs={12} md={4} item>
                                    <Field
                                      as={TextField}
                                      name="recurrenceEndDate"
                                      label="Data Final (opcional)"
                                      type="date"
                                      variant="outlined"
                                      margin="dense"
                                      fullWidth
                                      InputLabelProps={{ shrink: true }}
                                      error={touched.recurrenceEndDate && Boolean(errors.recurrenceEndDate)}
                                      helperText={
                                        (touched.recurrenceEndDate && errors.recurrenceEndDate) ||
                                        "Deixe vazio para recorrência infinita"
                                      }
                                      disabled={!campaignEditable}
                                    />
                                  </Grid>

                                  <Grid xs={12} md={4} item>
                                    <Field
                                      as={TextField}
                                      name="maxExecutions"
                                      label="Máximo de Execuções (opcional)"
                                      type="number"
                                      variant="outlined"
                                      margin="dense"
                                      fullWidth
                                      inputProps={{ min: 1 }}
                                      error={touched.maxExecutions && Boolean(errors.maxExecutions)}
                                      helperText={
                                        (touched.maxExecutions && errors.maxExecutions) ||
                                        "Deixe vazio para recorrência infinita"
                                      }
                                      disabled={!campaignEditable}
                                    />
                                  </Grid>

                                  <Grid xs={12} md={4} item>
                                    <Button
                                      variant="outlined"
                                      startIcon={<VisibilityIcon />}
                                      onClick={() => {
                                        handlePreviewRecurrence(values);
                                        setShowPreview(!showPreview);
                                      }}
                                      disabled={!values.recurrenceType || !values.scheduledAt}
                                      fullWidth
                                      style={{ marginTop: 8 }}
                                    >
                                      {showPreview ? "Ocultar" : i18n.t("whitelabel.preview")} Próximas Execuções
                                    </Button>
                                  </Grid>

                                  <Collapse in={showPreview && previewExecutions.length > 0}>
                                    <Grid xs={12} item>
                                      <Card className={classes.previewCard}>
                                        <CardContent>
                                          <Typography variant="subtitle2" gutterBottom>
                                            Próximas 5 Execuções:
                                          </Typography>
                                          <List dense>
                                            {previewExecutions.slice(0, 5).map((execution, index) => (
                                              <ListItem key={index} divider>
                                                <ListItemText
                                                  primary={`${index + 1}ª Execução`}
                                                  secondary={
                                                    typeof execution === "string"
                                                      ? execution
                                                      : moment.utc(execution).tz(currentTimezone).format("DD/MM/YYYY HH:mm")
                                                  }
                                                />
                                              </ListItem>
                                            ))}
                                          </List>
                                        </CardContent>
                                      </Card>
                                    </Grid>
                                  </Collapse>
                                </Grid>
                              </Collapse>
                            </Grid>
                          </Grid>
                        </CardContent>
                      </Card>
                    </Grid>

                    {values.campaignType !== "email" && (
                      <Grid xs={12} md={4} item>
                        <FormControl
                          variant="outlined"
                          margin="dense"
                          fullWidth
                          className={classes.formControl}
                        >
                          <InputLabel id="openTicket-selection-label">
                            {i18n.t("campaigns.dialog.form.openTicket")}
                          </InputLabel>
                          <Field
                            as={Select}
                            label={i18n.t("campaigns.dialog.form.openTicket")}
                            placeholder={i18n.t("campaigns.dialog.form.openTicket")}
                            labelId="openTicket-selection-label"
                            id="openTicket"
                            name="openTicket"
                            error={touched.openTicket && Boolean(errors.openTicket)}
                            disabled={!campaignEditable}
                          >
                            <MenuItem value={"enabled"}>
                              {i18n.t("campaigns.dialog.form.enabledOpenTicket")}
                            </MenuItem>
                            <MenuItem value={"disabled"}>
                              {i18n.t("campaigns.dialog.form.disabledOpenTicket")}
                            </MenuItem>
                          </Field>
                        </FormControl>
                      </Grid>
                    )}

                    {values.campaignType !== "email" && (
                      <>
                        <Grid xs={12} md={4} item>
                          <Autocomplete
                            style={{ marginTop: "8px" }}
                            variant="outlined"
                            margin="dense"
                            className={classes.formControl}
                            getOptionLabel={(option) => `${option.name}`}
                            value={selectedUser}
                            size="small"
                            onChange={(e, newValue) => {
                              setSelectedUser(newValue);
                              if (newValue != null && Array.isArray(newValue.queues)) {
                                if (newValue.queues.length === 1) {
                                  setSelectedQueue(newValue.queues[0].id);
                                }
                                setQueues(newValue.queues);
                              } else {
                                setQueues(allQueues);
                                setSelectedQueue("");
                              }
                            }}
                            options={options}
                            filterOptions={filterOptions}
                            freeSolo
                            fullWidth
                            autoHighlight
                            disabled={!campaignEditable || values.openTicket === "disabled"}
                            noOptionsText={i18n.t("transferTicketModal.noOptions")}
                            loading={loading}
                            renderOption={(option) => (
                              <span>
                                {" "}
                                <UserStatusIcon user={option} /> {option.name}
                              </span>
                            )}
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                label={i18n.t("transferTicketModal.fieldLabel")}
                                variant="outlined"
                                onChange={(e) => setSearchParam(e.target.value)}
                                InputProps={{
                                  ...params.InputProps,
                                  endAdornment: (
                                    <React.Fragment>
                                      {loading ? <CircularProgress color="inherit" size={20} /> : null}
                                      {params.InputProps.endAdornment}
                                    </React.Fragment>
                                  ),
                                }}
                              />
                            )}
                          />
                        </Grid>

                        <Grid xs={12} md={4} item>
                          <FormControl
                            variant="outlined"
                            margin="dense"
                            fullWidth
                            className={classes.formControl}
                          >
                            <InputLabel>
                              {i18n.t("transferTicketModal.fieldQueueLabel")}
                            </InputLabel>
                            <Select
                              value={selectedQueue}
                              onChange={(e) => setSelectedQueue(e.target.value)}
                              label={i18n.t("transferTicketModal.fieldQueuePlaceholder")}
                              required={!isNil(selectedUser)}
                              disabled={!campaignEditable || values.openTicket === "disabled"}
                            >
                              {queues.map((queue) => (
                                <MenuItem key={queue.id} value={queue.id}>
                                  {queue.name}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Grid>

                        <Grid xs={12} md={4} item>
                          <FormControl
                            variant="outlined"
                            margin="dense"
                            fullWidth
                            className={classes.formControl}
                          >
                            <InputLabel id="statusTicket-selection-label">
                              {i18n.t("campaigns.dialog.form.statusTicket")}
                            </InputLabel>
                            <Field
                              as={Select}
                              label={i18n.t("campaigns.dialog.form.statusTicket")}
                              placeholder={i18n.t("campaigns.dialog.form.statusTicket")}
                              labelId="statusTicket-selection-label"
                              id="statusTicket"
                              name="statusTicket"
                              error={touched.statusTicket && Boolean(errors.statusTicket)}
                              disabled={!campaignEditable || values.openTicket === "disabled"}
                            >
                              <MenuItem value={"closed"}>
                                {i18n.t("campaigns.dialog.form.closedTicketStatus")}
                              </MenuItem>
                              <MenuItem value={"pending"}>
                                {i18n.t("campaigns.dialog.form.pendingTicketStatus")}
                              </MenuItem>
                              <MenuItem value={"open"}>
                                {i18n.t("campaigns.dialog.form.openTicketStatus")}
                              </MenuItem>
                            </Field>
                          </FormControl>
                        </Grid>
                      </>
                    )}

                    {/* Email Configuration */}
                    {values.campaignType === "email" && (
                      <Grid xs={12} item>
                        <Box
                          style={{
                            border: `1px solid ${theme.palette.divider}`,
                            borderRadius: 8,
                            padding: 16,
                            backgroundColor: theme.palette.background.paper,
                            marginBottom: 16,
                          }}
                        >
                          <Typography variant="subtitle2" style={{ fontWeight: 600, marginBottom: 12 }}>
                            Configuração do Email Marketing
                          </Typography>

                          <Grid spacing={2} container>
                            {/* Provider Selector */}
                            <Grid xs={12} md={4} item>
                              <FormControl variant="outlined" margin="dense" fullWidth>
                                <InputLabel>Provedor de Email</InputLabel>
                                <Field
                                  as={Select}
                                  name="emailProvider"
                                  label="Provedor de Email"
                                  disabled={!campaignEditable}
                                  onChange={async (e) => {
                                    const provider = e.target.value;

                                    setFieldValue("emailProvider", provider);

                                    try {
                                      const { data } = await api.get("/email-settings", {
                                        params: { provider }
                                      });

                                      setFieldValue("emailContinueHour", data.continueHour || "08:00");
                                      setFieldValue("emailRatePerMinute", data.ratePerMinute || 5);
                                      setFieldValue("emailDailyLimit", data.dailyLimit || 99);
                                      setFieldValue("emailFromName", data.fromName || "");
                                      setFieldValue("emailFromAddress", data.fromAddress || "");
                                    } catch (err) {
                                      setFieldValue("emailContinueHour", "08:00");
                                      setFieldValue("emailRatePerMinute", 5);
                                      setFieldValue("emailDailyLimit", 99);
                                      setFieldValue("emailFromName", "");
                                      setFieldValue("emailFromAddress", "");
                                    }
                                  }}
                                >
                                  <MenuItem value="sendgrid">SendGrid</MenuItem>
                                  <MenuItem value="smtp">SMTP personalizado</MenuItem>
                                </Field>
                                <FormHelperText>
                                  Esta campanha será enviada usando o provedor selecionado.
                                </FormHelperText>
                              </FormControl>
                            </Grid>

                            <Grid xs={12} md={8} item>
                              <Field
                                as={TextField}
                                name="emailSubject"
                                label="Assunto do Email"
                                variant="outlined"
                                margin="dense"
                                fullWidth
                                required
                                disabled={!campaignEditable}
                              />
                            </Grid>

                            <Grid xs={12} md={3} item>
                              <Field
                                as={TextField}
                                name="emailFromName"
                                label="Nome do Remetente"
                                variant="outlined"
                                margin="dense"
                                fullWidth
                                disabled={!campaignEditable}
                              />
                            </Grid>

                            <Grid xs={12} md={3} item>
                              <Field
                                as={TextField}
                                name="emailFromAddress"
                                label="Email do Remetente"
                                variant="outlined"
                                margin="dense"
                                fullWidth
                                disabled={!campaignEditable}
                              />
                            </Grid>

                            <Grid xs={12} md={3} item>
                              <Field
                                as={TextField}
                                name="emailRatePerMinute"
                                label="Emails por minuto"
                                type="number"
                                variant="outlined"
                                margin="dense"
                                fullWidth
                                inputProps={{ min: 1 }}
                                disabled={!campaignEditable}
                              />
                            </Grid>

                            <Grid xs={12} md={3} item>
                              <Field
                                as={TextField}
                                name="emailDailyLimit"
                                label="Limite diário de emails"
                                type="number"
                                variant="outlined"
                                margin="dense"
                                fullWidth
                                required
                                inputProps={{ min: 1 }}
                                disabled={!campaignEditable}
                                helperText="Quantidade máxima de emails que esta campanha pode enviar por dia."
                              />
                            </Grid>

                            <Grid xs={12} md={3} item>
                              <Field
                                as={TextField}
                                name="emailContinueHour"
                                label="Horário para continuar no próximo dia"
                                type="time"
                                variant="outlined"
                                margin="dense"
                                fullWidth
                                InputLabelProps={{
                                  shrink: true,
                                }}
                                disabled={!campaignEditable}
                                helperText="Quando atingir o limite diário, continuará os envios nesse horário no próximo dia."
                              />
                            </Grid>

                            <Grid xs={12} item>
                              <Grid spacing={2} container>
                                {[1, 2, 3, 4, 5].map((num) => (
                                  <Grid xs={12} item key={num}>
                                    <Field
                                      as={TextField}
                                      name={num === 1 ? "emailHtml" : `emailHtml${num}`}
                                      label={`HTML do Email ${num}`}
                                      variant="outlined"
                                      margin="dense"
                                      fullWidth
                                      multiline
                                      rows={8}
                                      disabled={!campaignEditable}
                                      helperText="Você pode usar variáveis: {nome}, {primeiroNome}, {email}, {numero}, {greeting}, {protocol}"
                                    />
                                  </Grid>
                                ))}
                              </Grid>
                            </Grid>
                          </Grid>
                        </Box>
                      </Grid>
                    )}

                    <Grid xs={12} item>
                      <Grid spacing={2} container>
                        <Grid xs={12} md={6} item>
                          <Typography variant="subtitle2" style={{ marginBottom: 8, fontWeight: 600 }}>
                            {i18n.t("marketing.editor.campaignMessage")}
                          </Typography>

                          {values.campaignType !== "email" && !isOficialSelected && (
                            <Box display="flex" flexWrap="wrap" style={{ gap: 4, marginBottom: 8 }}>
                              {[
                                { label: i18n.t("marketing.editor.name"), value: "{nome}" },
                                { label: i18n.t("marketing.editor.number"), value: "{numero}" },
                                { label: i18n.t("marketing.editor.email"), value: "{email}" },
                                { label: i18n.t("marketing.editor.greeting"), value: "{greeting}" },
                                { label: i18n.t("marketing.editor.protocol"), value: "{protocol}" },
                                { label: i18n.t("marketing.editor.firstName"), value: "{primeiroNome}" },
                                { label: i18n.t("marketing.editor.attendant"), value: "{atendente}" },
                              ].map((v) => (
                                <Chip
                                  key={v.value}
                                  label={v.label}
                                  size="small"
                                  color="primary"
                                  variant="outlined"
                                  clickable
                                  disabled={!campaignEditable && campaign.status !== "CANCELADA"}
                                  onClick={() => {
                                    const field = document.getElementById("message1");
                                    if (field) {
                                      const start = field.selectionStart || 0;
                                      const end = field.selectionEnd || 0;
                                      const current = values.message1 || "";
                                      const newVal =
                                        current.substring(0, start) +
                                        v.value +
                                        current.substring(end);
                                      setFieldValue("message1", newVal);
                                      setTimeout(() => {
                                        field.focus();
                                        const pos = start + v.value.length;
                                        field.setSelectionRange(pos, pos);
                                      }, 50);
                                    } else {
                                      setFieldValue("message1", (values.message1 || "") + v.value);
                                    }
                                  }}
                                  style={{ cursor: "pointer" }}
                                />
                              ))}
                            </Box>
                          )}

                          {values.campaignType !== "email" && isOficialSelected ? (
                            <Box>
                              <Box
                                p={2}
                                style={{
                                  backgroundColor: theme.palette.background.paper,
                                  borderRadius: 8,
                                  textAlign: "center",
                                  marginBottom: 12,
                                }}
                              >
                                <Typography variant="body2" color="textSecondary">
                                  Para API Oficial, o conteúdo será enviado pelo template selecionado.
                                </Typography>
                              </Box>

                              {templateRequiresMedia && (
                                <Box
                                  p={2}
                                  style={{
                                    border: `1px solid ${theme.palette.divider}`,
                                    borderRadius: 8,
                                    backgroundColor: theme.palette.background.paper,
                                  }}
                                >
                                  <Typography
                                    variant="subtitle2"
                                    style={{ fontWeight: 600, marginBottom: 6 }}
                                  >
                                    Mídia do cabeçalho do template
                                  </Typography>

                                  <Typography
                                    variant="body2"
                                    color="textSecondary"
                                    style={{ marginBottom: 12 }}
                                  >
                                    Este template exige{" "}
                                    {selectedHeaderFormat === "IMAGE"
                                      ? "uma imagem"
                                      : selectedHeaderFormat === "VIDEO"
                                        ? "um vídeo"
                                        : "um documento"}{" "}
                                    no cabeçalho.
                                  </Typography>

                                  <Box
                                    display="flex"
                                    alignItems="center"
                                    style={{ gap: 8, flexWrap: "wrap" }}
                                  >
                                    {!attachment && !campaign.mediaPath && campaignEditable && (
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        color="primary"
                                        startIcon={<AttachFileIcon />}
                                        onClick={() => attachmentFile.current.click()}
                                      >
                                        Anexar{" "}
                                        {selectedHeaderFormat === "IMAGE"
                                          ? "Imagem"
                                          : selectedHeaderFormat === "VIDEO"
                                            ? "Vídeo"
                                            : "Documento"}
                                      </Button>
                                    )}

                                    {(attachment || campaign.mediaPath) && (
                                      <>
                                        <Button size="small" startIcon={<AttachFileIcon />}>
                                          {attachment ? attachment.name : campaign.mediaName}
                                        </Button>

                                        {campaignEditable && (
                                          <IconButton
                                            size="small"
                                            onClick={() => setConfirmationOpen(true)}
                                            color="primary"
                                          >
                                            <DeleteOutlineIcon color="secondary" fontSize="small" />
                                          </IconButton>
                                        )}
                                      </>
                                    )}
                                  </Box>
                                </Box>
                              )}
                            </Box>
                          ) : values.campaignType === "whatsapp" && values.confirmation ? (
                            <Grid spacing={2} container>
                              {[1, 2, 3, 4, 5].map((num) => (
                                <React.Fragment key={num}>
                                  <Grid xs={12} item>
                                    <>{renderMessageField(`message${num}`)}</>
                                  </Grid>
                                  <Grid xs={12} item>
                                    <>{renderConfirmationMessageField(`confirmationMessage${num}`)}</>
                                  </Grid>
                                </React.Fragment>
                              ))}
                            </Grid>
                          ) : values.campaignType === "whatsapp" && (
                            <Grid spacing={2} container>
                              {[1, 2, 3, 4, 5].map((num) => (
                                <Grid xs={12} item key={num}>
                                  <>{renderMessageField(`message${num}`)}</>
                                </Grid>
                              ))}
                            </Grid>
                          )}

                          {values.campaignType !== "email" && !isOficialSelected && (
                            <Box mt={1} display="flex" alignItems="center" style={{ gap: 8 }}>
                              {!attachment && !campaign.mediaPath && campaignEditable && (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="primary"
                                  startIcon={<AttachFileIcon />}
                                  onClick={() => attachmentFile.current.click()}
                                >
                                  {i18n.t("marketing.modal.attachMedia")}
                                </Button>
                              )}
                              {(campaign.mediaPath || attachment) && (
                                <>
                                  <Button size="small" startIcon={<AttachFileIcon />}>
                                    {attachment != null ? attachment.name : campaign.mediaName}
                                  </Button>
                                  {campaignEditable && (
                                    <IconButton
                                      size="small"
                                      onClick={() => setConfirmationOpen(true)}
                                      color="primary"
                                    >
                                      <DeleteOutlineIcon color="secondary" fontSize="small" />
                                    </IconButton>
                                  )}
                                </>
                              )}
                            </Box>
                          )}
                        </Grid>

                        <Grid xs={12} md={6} item>
                          <Typography variant="subtitle2" style={{ marginBottom: 8, fontWeight: 600 }}>
                            {i18n.t("marketing.modal.preview")}
                          </Typography>
                          {values.campaignType === "email" ? (
                            <Box
                              style={{
                                border: `1px solid ${theme.palette.divider}`,
                                borderRadius: 8,
                                padding: 16,
                                backgroundColor: theme.palette.background.paper,
                                maxHeight: 360,
                                overflow: "auto",
                              }}
                              dangerouslySetInnerHTML={{
                                __html:
                                  (
                                    [
                                      values.emailHtml,
                                      values.emailHtml2,
                                      values.emailHtml3,
                                      values.emailHtml4,
                                      values.emailHtml5
                                    ].filter(h => h && h.trim() !== "")[
                                    Math.floor(
                                      Math.random() *
                                      [
                                        values.emailHtml,
                                        values.emailHtml2,
                                        values.emailHtml3,
                                        values.emailHtml4,
                                        values.emailHtml5
                                      ].filter(h => h && h.trim() !== "").length
                                    )
                                    ]
                                  ) || "<p>Preview do email...</p>"
                              }}
                            />
                          ) : isOficialSelected && selectedTemplateId ? (
                            <TemplatePreview
                              template={
                                selectedTemplateData ||
                                oficialTemplates.find((t) => t.id === selectedTemplateId)
                              }
                              attachment={attachment}
                              mediaPath={campaign.mediaPath}
                              mediaName={campaign.mediaName}
                              onVariablesChange={setTemplateVarValues}
                            />
                          ) : (
                            <MessagePreview
                              messages={{
                                ...values,
                                message1:
                                  [
                                    values.message1,
                                    values.message2,
                                    values.message3,
                                    values.message4,
                                    values.message5,
                                  ].filter(m => m && m.trim() !== "")[
                                  Math.floor(
                                    Math.random() *
                                    [
                                      values.message1,
                                      values.message2,
                                      values.message3,
                                      values.message4,
                                      values.message5,
                                    ].filter(m => m && m.trim() !== "").length
                                  )
                                  ] || ""
                              }}
                              attachment={attachment}
                              mediaPath={campaign.mediaPath}
                              mediaName={campaign.mediaName}
                            />
                          )}
                        </Grid>
                      </Grid>
                    </Grid>

                    {values.campaignType === "whatsapp" && !isOficialSelected && (
                      <Grid xs={12} item>
                        {renderInteractiveButtonsEditor(values, setFieldValue)}
                      </Grid>
                    )}

                    <Grid xs={12} item>
                      <Box
                        style={{
                          border: `1px solid ${theme.palette.divider}`,
                          borderRadius: 8,
                          padding: "12px 16px",
                        }}
                      >
                        <Typography
                          variant="subtitle2"
                          style={{
                            fontWeight: 600,
                            marginBottom: 8,
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          📋 {i18n.t("marketing.editor.campaignContactList")}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="textSecondary"
                          style={{ fontSize: 12, marginBottom: 12 }}
                        >
                          {i18n.t("marketing.editor.campaignContactListHelp")}
                        </Typography>
                        <Grid spacing={1} container>
                          <Grid xs={12} md={6} item>
                            <FormControl variant="outlined" size="small" fullWidth disabled={!campaignEditable}>
                              <InputLabel id="contactListId-label">{i18n.t("campaigns.table.contactList")}</InputLabel>
                              <Select
                                labelId="contactListId-label"
                                label={i18n.t("campaigns.table.contactList")}
                                value={values.contactListId || ""}
                                onChange={(e) => setFieldValue("contactListId", e.target.value)}
                              >
                                <MenuItem value="">
                                  <em>{i18n.t("marketing.editor.noListSelected")}</em>
                                </MenuItem>
                                {contactLists.map((cl) => (
                                  <MenuItem key={cl.id} value={cl.id}>
                                    {cl.name}
                                    {cl.contactsCount !== undefined && (
                                      <Typography
                                        component="span"
                                        style={{ fontSize: 11, color: "#999", marginLeft: 8 }}
                                      >
                                        ({i18n.t("marketing.editor.contactsCount", { count: cl.contactsCount })})
                                      </Typography>
                                    )}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid xs={12} md={6} item>
                            <FormControl variant="outlined" size="small" fullWidth disabled={!campaignEditable}>
                              <InputLabel id="tagListId-label">{i18n.t("marketing.editor.filterTag")}</InputLabel>
                              <Select
                                labelId="tagListId-label"
                                label={i18n.t("marketing.editor.filterTag")}
                                value={values.tagListId || "Nenhuma"}
                                onChange={(e) => setFieldValue("tagListId", e.target.value)}
                              >
                                <MenuItem value="Nenhuma">
                                  <em>{i18n.t("marketing.editor.noTagFilter")}</em>
                                </MenuItem>
                                {tagLists.map((tl) => (
                                  <MenuItem key={tl.id} value={tl.id}>
                                    {tl.name}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </Grid>
                        </Grid>
                        <Box mt={1} display="flex" style={{ gap: 8, flexWrap: "wrap" }}>
                          {values.contactListId && (
                            <Button
                              size="small"
                              style={{ fontSize: 11, textTransform: "none" }}
                              onClick={() => {
                                setFieldValue("contactListId", "");
                                setMessageTab(1);
                              }}
                            >
                              {i18n.t("marketing.editor.changeList")}
                            </Button>
                          )}
                          {!values.contactListId && campaignEditable && (
                            <Button
                              size="small"
                              variant="outlined"
                              color="primary"
                              style={{ fontSize: 11, textTransform: "none" }}
                              onClick={() => setMessageTab(1)}
                            >
                              {i18n.t("marketing.editor.createOrSelectList")}
                            </Button>
                          )}
                        </Box>
                      </Box>
                    </Grid>
                  </Grid>
                </DialogContent>
              </div>

              <div hidden={messageTab !== 1}>
                <DialogContent dividers>
                  <CampaignContactSelector
                    contactListId={values.contactListId}
                    tagListId={values.tagListId}
                    tagLists={tagLists}
                    contactLists={contactLists}
                    onTagChange={(val) => setFieldValue("tagListId", val)}
                    onContactListChange={(val) => {
                      setFieldValue("contactListId", val);
                      if (val) {
                        api
                          .get(`/contact-lists/list`, { params: { companyId } })
                          .then(({ data }) => setContactLists(data))
                          .catch(() => { });
                      }
                    }}
                    onSelectedContactsChange={setIndividualContacts}
                    campaignEditable={campaignEditable}
                    campaignName={values.name}
                    whatsappId={whatsappId}
                    onGoToCampaignTab={() => setMessageTab(0)}
                  />
                </DialogContent>
              </div>

              <div hidden={messageTab !== 2}>
                <DialogContent dividers>
                  <Grid spacing={2} container>
                    <Grid xs={12} item>
                      <Typography variant="subtitle1" style={{ fontWeight: 600, marginBottom: 8 }}>
                        {i18n.t("marketing.modal.sendingIntervals")}
                      </Typography>
                      <Typography variant="body2" color="textSecondary" style={{ marginBottom: 16 }}>
                        {i18n.t("marketing.modal.sendingIntervalsHelp")}
                      </Typography>
                    </Grid>

                    <Grid xs={12} md={4} item>
                      <FormControl variant="outlined" fullWidth size="small">
                        <InputLabel id="cfg-messageInterval-label">
                          {i18n.t("campaigns.settings.randomInterval")}
                        </InputLabel>
                        <Select
                          labelId="cfg-messageInterval-label"
                          label={i18n.t("campaigns.settings.randomInterval")}
                          value={campaignSettings.messageInterval}
                          onChange={(e) =>
                            setCampaignSettings((p) => ({
                              ...p,
                              messageInterval: Number(e.target.value),
                            }))
                          }
                        >
                          <MenuItem value={0}>{i18n.t("campaigns.settings.noBreak")}</MenuItem>
                          {[5, 10, 15, 20, 30, 60, 80, 100, 120].map((amount) => (
                            <MenuItem key={amount} value={amount}>{i18n.t("marketing.modal.seconds", { amount })}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>

                    <Grid xs={12} md={4} item>
                      <FormControl variant="outlined" fullWidth size="small">
                        <InputLabel id="cfg-longerIntervalAfter-label">
                          {i18n.t("campaigns.settings.intervalGapAfter")}
                        </InputLabel>
                        <Select
                          labelId="cfg-longerIntervalAfter-label"
                          label={i18n.t("campaigns.settings.intervalGapAfter")}
                          value={campaignSettings.longerIntervalAfter}
                          onChange={(e) =>
                            setCampaignSettings((p) => ({
                              ...p,
                              longerIntervalAfter: Number(e.target.value),
                            }))
                          }
                        >
                          <MenuItem value={0}>{i18n.t("campaigns.settings.undefined")}</MenuItem>
                          <MenuItem value={5}>5 {i18n.t("campaigns.settings.messages")}</MenuItem>
                          <MenuItem value={10}>10 {i18n.t("campaigns.settings.messages")}</MenuItem>
                          <MenuItem value={20}>20 {i18n.t("campaigns.settings.messages")}</MenuItem>
                          <MenuItem value={30}>30 {i18n.t("campaigns.settings.messages")}</MenuItem>
                          <MenuItem value={50}>50 {i18n.t("campaigns.settings.messages")}</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>

                    <Grid xs={12} md={4} item>
                      <FormControl variant="outlined" fullWidth size="small">
                        <InputLabel id="cfg-greaterInterval-label">
                          {i18n.t("campaigns.settings.laggerTriggerRange")}
                        </InputLabel>
                        <Select
                          labelId="cfg-greaterInterval-label"
                          label={i18n.t("campaigns.settings.laggerTriggerRange")}
                          value={campaignSettings.greaterInterval}
                          onChange={(e) =>
                            setCampaignSettings((p) => ({
                              ...p,
                              greaterInterval: Number(e.target.value),
                            }))
                          }
                        >
                          <MenuItem value={0}>{i18n.t("campaigns.settings.noBreak")}</MenuItem>
                          {[20, 30, 60, 90, 120, 180].map((amount) => (
                            <MenuItem key={amount} value={amount}>{i18n.t("marketing.modal.seconds", { amount })}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>

                    <Grid xs={12} item>
                      <div
                        style={{
                          borderTop: "1px dashed #e0e0e0",
                          margin: "16px 0 10px",
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: "#e65100",
                            background: "#fff3e0",
                            borderRadius: 4,
                            padding: "2px 10px",
                          }}
                        >
                          🛡️ Anti-Ban
                        </span>
                        <span style={{ fontSize: 11, color: "#888" }}>
                          {i18n.t("marketing.modal.antiBanHelp")}
                        </span>
                      </div>
                    </Grid>

                    <Grid xs={12} md={4} item>
                      <JitterSlider
                        campaignSettings={campaignSettings}
                        setCampaignSettings={setCampaignSettings}
                      />
                    </Grid>

                    <Grid xs={12} md={4} item>
                      <FormControl variant="outlined" fullWidth size="small">
                        <InputLabel id="cfg-longPauseEvery-label">
                          {i18n.t("marketing.modal.extraPauseEvery")}
                        </InputLabel>
                        <Select
                          labelId="cfg-longPauseEvery-label"
                          label={i18n.t("marketing.modal.extraPauseEvery")}
                          value={
                            campaignSettings.longPauseEvery !== undefined &&
                              campaignSettings.longPauseEvery !== null
                              ? campaignSettings.longPauseEvery
                              : 50
                          }
                          onChange={(e) => {
                            setCampaignSettings((p) => ({
                              ...p,
                              longPauseEvery: Number(e.target.value),
                            }));
                          }}
                        >
                          <MenuItem value={0}>{i18n.t("whatsappModal.menuItem.disabled")}</MenuItem>
                          {[10, 20, 30, 50, 100].map((amount) => (
                            <MenuItem key={amount} value={amount}>
                              {i18n.t("marketing.modal.everyMessages", { amount })}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>

                    <Grid xs={12} md={4} item>
                      <FormControl variant="outlined" fullWidth size="small">
                        <InputLabel id="cfg-longPauseDuration-label">
                          {i18n.t("marketing.modal.extraPauseDuration")}
                        </InputLabel>
                        <Select
                          labelId="cfg-longPauseDuration-label"
                          label={i18n.t("marketing.modal.extraPauseDuration")}
                          value={
                            campaignSettings.longPauseDuration !== undefined &&
                              campaignSettings.longPauseDuration !== null
                              ? campaignSettings.longPauseDuration
                              : 30
                          }
                          disabled={campaignSettings.longPauseEvery === 0}
                          onChange={(e) => {
                            setCampaignSettings((p) => ({
                              ...p,
                              longPauseDuration: Number(e.target.value),
                            }));
                          }}
                        >
                          <MenuItem value={15}>{i18n.t("marketing.modal.seconds", { amount: 15 })}</MenuItem>
                          <MenuItem value={30}>{i18n.t("marketing.modal.seconds", { amount: 30 })}</MenuItem>
                          {[1, 2, 5].map((amount) => (
                            <MenuItem key={amount} value={amount * 60}>{i18n.t("marketing.modal.minutes", { amount })}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>

                    <Grid xs={12} item style={{ textAlign: "right" }}>
                      <Button
                        variant="contained"
                        color="primary"
                        disabled={savingSettings}
                        onClick={async () => {
                          setSavingSettings(true);
                          try {
                            await api.post("/campaign-settings", { settings: campaignSettings });
                            toast.success("Configurações salvas com sucesso!");
                          } catch (err) {
                            toastError(err);
                          } finally {
                            setSavingSettings(false);
                          }
                        }}
                      >
                        {savingSettings ? (
                          <CircularProgress size={20} color="inherit" />
                        ) : (
                          i18n.t("campaigns.settings.save")
                        )}
                      </Button>
                    </Grid>
                  </Grid>
                </DialogContent>
              </div>

              <DialogActions>
                {campaign.status === "CANCELADA" && (
                  <Button color="primary" onClick={() => restartCampaign()} variant="outlined">
                    {i18n.t("campaigns.dialog.buttons.restart")}
                  </Button>
                )}

                {campaign.status === "EM_ANDAMENTO" && (
                  <Button color="primary" onClick={() => cancelCampaign()} variant="outlined">
                    {i18n.t("campaigns.dialog.buttons.cancel")}
                  </Button>
                )}

                <Button
                  onClick={handleClose}
                  color="primary"
                  disabled={isSubmitting}
                  variant="outlined"
                >
                  {i18n.t("campaigns.dialog.buttons.close")}
                </Button>

                {(messageTab === 0 || messageTab === 1) &&
                  (campaignEditable || campaign.status === "CANCELADA") && (
                    <Button
                      type="submit"
                      color="primary"
                      disabled={isSubmitting}
                      variant="contained"
                      className={classes.btnWrapper}
                    >
                      {campaignId
                        ? `${i18n.t("campaigns.dialog.buttons.edit")}`
                        : `${i18n.t("campaigns.dialog.buttons.add")}`}
                      {isSubmitting && (
                        <CircularProgress size={24} className={classes.buttonProgress} />
                      )}
                    </Button>
                  )}
              </DialogActions>
            </Form>
          )}
        </Formik>
      </Dialog>
    </div>
  );
};

export default CampaignModal;
