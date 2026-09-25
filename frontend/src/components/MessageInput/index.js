import React, {
  useState,
  useEffect,
  useContext,
  useRef,
  useCallback,
} from "react";
import "emoji-mart/css/emoji-mart.css";
import { Picker } from "emoji-mart";
import { useMediaQuery, useTheme } from "@material-ui/core";
import { isNil } from "lodash";
import {
  Fade
} from "@material-ui/core";
import {
  CircularProgress,
  ClickAwayListener,
  IconButton,
  InputBase,
  makeStyles,
  Paper,
  Hidden,
  Menu,
  MenuItem,
  Tooltip,
  Fab,
  Chip,
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Divider,
} from "@material-ui/core";
import { blue, green, pink, grey } from "@material-ui/core/colors";
import {
  AttachFile,
  CheckCircleOutline,
  Clear,
  Comment,
  Create,
  Description,
  HighlightOff,
  Mic,
  Mood,
  MoreVert,
  Send,
  PermMedia,
  Person,
  Reply,
  Duo,
  Timer,
  WhatsApp,
  Info,
  AccountTree
} from "@material-ui/icons";

import {
  FormatBold as FormatBoldIcon,
  FormatItalic as FormatItalicIcon,
  FormatStrikethrough as FormatStrikethroughIcon,
  Code as CodeIcon,
  FormatListNumbered as FormatListNumberedIcon,
  FormatListBulleted as FormatListBulletedIcon,
  FormatQuote as FormatQuoteIcon,
  FormatClear as FormatClearIcon,
} from "@material-ui/icons";

import AddIcon from "@material-ui/icons/Add";
import { CameraAlt, GroupAdd } from "@material-ui/icons";
import MicRecorder from "mic-recorder-to-mp3";
import clsx from "clsx";
import { ReplyMessageContext } from "../../context/ReplyingMessage/ReplyingMessageContext";
import { AuthContext } from "../../context/Auth/AuthContext";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import api, { openApi } from "../../services/api";
import RecordingTimer from "./RecordingTimer";

import useQuickMessages from "../../hooks/useQuickMessages";
import { isString, isEmpty } from "lodash";
import ContactSendModal from "../ContactSendModal";
import CameraModal from "../CameraModal";
import axios from "axios";

import useCompanySettings from "../../hooks/useSettings/companySettings";
import { ForwardMessageContext } from "../../context/ForwarMessage/ForwardMessageContext";
import MessageUploadMedias from "../MessageUploadMedias";
import { EditMessageContext } from "../../context/EditingMessage/EditingMessageContext";
import ScheduleModal from "../ScheduleModal";
import usePlans from "../../hooks/usePlans";
import TemplateModal from "../TemplateMetaModal";
import TriggerFlowModal from "../TriggerFlowModal";
import InteractiveMessageModal from "../InteractiveMessageModal";
import { TouchApp } from "@material-ui/icons";


const Mp3Recorder = new MicRecorder({
  bitRate: 128,
  sampleRate: 44100
});

const isMobileDevice = () => {
  return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

const useStyles = makeStyles((theme) => ({
  mainWrapper: {
    background: "#eee",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    borderTop: "1px solid rgba(0, 0, 0, 0.12)",
    flexShrink: 0,
  },
  "@keyframes pulse": {
    "0%": {
      boxShadow: "0 0 0 0 rgba(25, 118, 210, 0.7)",
    },
    "70%": {
      boxShadow: "0 0 0 10px rgba(25, 118, 210, 0)",
    },
    "100%": {
      boxShadow: "0 0 0 0 rgba(25, 118, 210, 0)",
    },
  },
  avatar: {
    width: "50px",
    height: "50px",
    borderRadius: "25%",
  },
  dropInfo: {
    background: "#eee",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    width: "100%",
    padding: 15,
    left: 0,
    right: 0,
  },
  dropInfoOut: {
    display: "none",
  },
  gridFiles: {
    maxHeight: "100%",
    overflow: "scroll",
  },
  newMessageBox: {
    background: theme.palette.background.default,
    width: "100%",
    display: "flex",
    padding: "7px",
    alignItems: "center",
  },
  messageInputWrapper: {
    padding: 6,
    marginRight: 7,
    background: theme.palette.background.paper,
    display: "flex",
    borderRadius: 20,
    flex: 1,
    position: "relative",
    zIndex: 10,
  },

  messageInputWrapperPrivate: {
    padding: 6,
    marginRight: 7,
    background: "#F0E68C",
    display: "flex",
    borderRadius: 20,
    flex: 1,
    position: "relative",
    zIndex: 10,
  },

  messageInputWrapperPending: {
    padding: 6,
    marginRight: 7,
    background: "#FFE0B2",
    display: "flex",
    borderRadius: 20,
    flex: 1,
    position: "relative",
    border: "2px solid #FF9800",
    zIndex: 10,
  },
  messageInput: {
    paddingLeft: 10,
    flex: 1,
    border: "none",
  },
  messageInputPrivate: {
    paddingLeft: 10,
    flex: 1,
    border: "none",
    color: grey[800],
  },
  messageInputPending: {
    paddingLeft: 10,
    flex: 1,
    border: "none",
    color: "#E65100",
    fontWeight: 500,
  },
  sendMessageIcons: {
    color: grey[700],
  },
  ForwardMessageIcons: {
    color: grey[700],
    transform: "scaleX(-1)",
  },
  uploadInput: {
    display: "none",
  },
  viewMediaInputWrapper: {
    maxHeight: "100%",
    display: "flex",
    padding: "10px 13px",
    position: "relative",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: theme.mode === "light" ? "#ffffff" : "#202c33",
    borderTop: "1px solid rgba(0, 0, 0, 0.12)",
  },
  emojiBox: {
    position: "absolute",
    bottom: 63,
    width: 40,
    borderTop: "1px solid #e8e8e8",
  },
  circleLoading: {
    color: green[500],
    opacity: "70%",
    position: "absolute",
    top: "20%",
    left: "50%",
    marginLeft: -12,
  },
  audioLoading: {
    color: green[500],
    opacity: "70%",
  },
  recorderWrapper: {
    display: "flex",
    alignItems: "center",
    alignContent: "middle",
  },
  cancelAudioIcon: {
    color: "red",
  },
  sendAudioIcon: {
    color: "green",
  },
  replyginMsgWrapper: {
    display: "flex",
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 8,
    paddingLeft: 73,
    paddingRight: 7,
    backgroundColor: theme.palette.optionsBackground,
  },
  replyginMsgContainer: {
    flex: 1,
    marginRight: 5,
    overflowY: "hidden",
    backgroundColor: theme.mode === "light" ? "#f0f0f0" : "#1d282f",
    borderRadius: "7.5px",
    display: "flex",
    position: "relative",
  },
  replyginMsgBody: {
    padding: 10,
    height: "auto",
    display: "block",
    whiteSpace: "pre-wrap",
    overflow: "hidden",
  },
  replyginContactMsgSideColor: {
    flex: "none",
    width: "4px",
    backgroundColor: "#35cd96",
  },
  replyginSelfMsgSideColor: {
    flex: "none",
    width: "4px",
    backgroundColor: "#6bcbef",
  },
  floatingFormatMenu: {
    position: 'fixed',
    backgroundColor: theme.palette.background.paper,
    borderRadius: theme.shape.borderRadius,
    boxShadow: theme.shadows[8],
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    padding: '4px',
    border: `1px solid ${theme.palette.divider}`,
  },

  formatIconButton: {
    padding: '6px',
    borderRadius: '4px',
    minWidth: '32px',
    height: '32px',
  },
  messageContactName: {
    display: "flex",
    color: "#6bcbef",
    fontWeight: 500,
  },
  messageQuickAnswersWrapper: {
    margin: 0,
    position: "absolute",
    bottom: "100%",
    background: theme.palette.background.default,
    padding: 0,
    border: "none",
    left: 0,
    right: 0,
    maxHeight: "200px",
    overflowY: "auto",
    overflowX: "hidden",
    boxShadow: "0 -4px 16px rgba(0, 0, 0, 0.15)",
    borderRadius: "8px 8px 0 0",
    zIndex: 1000,
    "&::-webkit-scrollbar": {
      width: "6px",
    },
    "&::-webkit-scrollbar-track": {
      background: "transparent",
    },
    "&::-webkit-scrollbar-thumb": {
      backgroundColor: theme.palette.action.disabled,
      borderRadius: "3px",
      "&:hover": {
        backgroundColor: theme.palette.action.hover,
      },
    },
    "& li": {
      listStyle: "none",
      "& a": {
        display: "block",
        padding: "8px",
        textOverflow: "ellipsis",
        overflow: "hidden",
        maxHeight: "auto",
        "&:hover": {
          background: theme.palette.background.paper,
          cursor: "pointer",
        },
      },
    },
  },
  quickAnswerItem: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    padding: theme.spacing(1.5),
    minHeight: "48px",
    cursor: "pointer",
    borderRadius: "4px",
    margin: "2px 4px",
    "&:hover": {
      backgroundColor: theme.palette.action.hover,
    },
    transition: "all 0.2s ease-in-out",
  },

  quickAnswerItemSelected: {
    backgroundColor: theme.palette.primary.light + "30",
    borderLeft: `4px solid ${theme.palette.primary.main}`,
    fontWeight: 500,
  },

  quickAnswersScrollIndicator: {
    textAlign: "center",
    padding: theme.spacing(1),
    fontSize: "0.75rem",
    color: theme.palette.text.secondary,
    fontStyle: "italic",
    borderTop: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
  },
  quickAnswerText: {
    flex: 1,
    textOverflow: "ellipsis",
    overflow: "hidden",
  },
  mediaTypeChip: {
    height: 20,
    fontSize: "0.7rem",
  },
  invertedFabMenu: {
    border: "none",
    borderRadius: 50,
    boxShadow: "none",
    padding: theme.spacing(1),
    backgroundColor: "transparent",
    color: "grey",
    "&:hover": {
      backgroundColor: "transparent",
    },
    "&:disabled": {
      backgroundColor: "transparent !important",
    },
  },
  invertedFabMenuMP: {
    border: "none",
    borderRadius: 0,
    boxShadow: "none",
    width: theme.spacing(4),
    height: theme.spacing(4),
    backgroundColor: "transparent",
    color: blue[800],
    "&:hover": {
      backgroundColor: "transparent",
    },
  },
  invertedFabMenuCont: {
    border: "none",
    borderRadius: 0,
    boxShadow: "none",
    minHeight: "auto",
    width: theme.spacing(4),
    height: theme.spacing(4),
    backgroundColor: "transparent",
    color: blue[500],
    "&:hover": {
      backgroundColor: "transparent",
    },
  },
  invertedFabMenuMeet: {
    border: "none",
    borderRadius: 0,
    boxShadow: "none",
    minHeight: "auto",
    width: theme.spacing(4),
    height: theme.spacing(4),
    backgroundColor: "transparent",
    color: green[500],
    "&:hover": {
      backgroundColor: "transparent",
    },
  },
  invertedFabMenuDoc: {
    border: "none",
    borderRadius: 0,
    boxShadow: "none",
    width: theme.spacing(4),
    height: theme.spacing(4),
    backgroundColor: "transparent",
    color: "#7f66ff",
    "&:hover": {
      backgroundColor: "transparent",
    },
  },
  invertedFabMenuCamera: {
    border: "none",
    borderRadius: 0,
    boxShadow: "none",
    width: theme.spacing(4),
    height: theme.spacing(4),
    backgroundColor: "transparent",
    color: pink[500],
    "&:hover": {
      backgroundColor: "transparent",
    },
  },
  flexContainer: {
    display: "flex",
    flex: 1,
    flexDirection: "column",
  },
  flexItem: {
    flex: 1,
  },
  pendingAlert: {
    marginBottom: theme.spacing(1),
    padding: theme.spacing(1, 2),
    backgroundColor: "#E3F2FD",
    border: "1px solid #2196F3",
    borderRadius: 4,
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    color: "#1976D2",
    fontSize: "0.875rem",
  },
}));

const MessageInput = ({
  ticketId,
  ticketStatus,
  droppedFiles,
  contactId,
  ticketChannel,
  whatsappId,
  isGroup,
}) => {
  const classes = useStyles();
  const theme = useTheme();
  const [mediasUpload, setMediasUpload] = useState([]);
  const isMounted = useRef(true);

  const [inputMessage, setInputMessage] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [opportunityLoading, setOpportunityLoading] = useState(false);
  const [opportunityModalOpen, setOpportunityModalOpen] = useState(false);
  const [opportunityAnalysis, setOpportunityAnalysis] = useState(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [quickAnswers, setQuickAnswer] = useState([]);
  const [selectedQuickMessage, setSelectedQuickMessage] = useState(null);
  const [typeBar, setTypeBar] = useState(false);
  const inputRef = useRef();
  const [onDragEnter, setOnDragEnter] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const { setReplyingMessage, replyingMessage } =
    useContext(ReplyMessageContext);
  const { setEditingMessage, editingMessage } = useContext(EditMessageContext);
  const { user, socket } = useContext(AuthContext);
  const [appointmentModalOpen, setAppointmentModalOpen] = useState(false);
  const { getPlanCompany } = usePlans();

  const [signMessagePar, setSignMessagePar] = useState(false);
  const { get: getSetting } = useCompanySettings();
  const [signMessage, setSignMessage] = useState(true);
  const [privateMessage, setPrivateMessage] = useState(false);
  const [privateMessageInputVisible, setPrivateMessageInputVisible] =
    useState(false);
  const [senVcardModalOpen, setSenVcardModalOpen] = useState(false);
  const [showModalMedias, setShowModalMedias] = useState(false);
  const [showSchedules, setShowSchedules] = useState(false);
  const [useWhatsappOfficial, setUseWhatsappOfficial] = useState(false);
  const { list: listQuickMessages } = useQuickMessages();

  const isMobile = useMediaQuery("(max-width: 767px)");
  const [placeholderText, setPlaceHolderText] = useState("");

  const [selectedQuickAnswerIndex, setSelectedQuickAnswerIndex] = useState(-1);
  const [isNavigatingQuickAnswers, setIsNavigatingQuickAnswers] = useState(false);

  const [triggerFlowModalOpen, setTriggerFlowModalOpen] = useState(false);
  const [interactiveModalOpen, setInteractiveModalOpen] = useState(false);
  const [flowProcessing, setFlowProcessing] = useState(false);
  const flowProcessingRef = useRef(false);


  const [formatMenuAnchorPosition, setFormatMenuAnchorPosition] = useState(null);
  const [selectedText, setSelectedText] = useState({ text: '', start: 0, end: 0 });

  // Estado para janela de 24h do WhatsApp Oficial
  const [needsTemplate, setNeedsTemplate] = useState(false);
  const [isWhatsAppOfficial, setIsWhatsAppOfficial] = useState(false);
  const [windowCheckLoading, setWindowCheckLoading] = useState(false);

  const isTicketPending = () => {
    return ticketStatus === "pending";
  };

  // FUNÇÃO DE SUGESTÃO DA IA
  const handleAiSuggestion = async () => {
    try {
      setAiLoading(true);
      const { data } = await api.post(
        `/tickets/${ticketId}/ai-suggestion`,
        {
          currentMessage: inputMessage
        }
      );
      if (data?.suggestion) {
        setInputMessage(data.suggestion);
      }
    } catch (err) {
      toastError(err);
    } finally {
      setAiLoading(false);
    }
  };

  const getOpportunityStatusLabel = (status) => {
    const labels = {
      cold: "Frio",
      warm: "Morno",
      hot: "Quente",
      urgent: "Urgente",
      risk: "Risco",
      support: "Suporte",
      no_opportunity: "Sem oportunidade"
    };

    return labels[status] || status || "Não analisado";
  };

  const getOpportunityIntentLabel = (intent) => {
    const labels = {
      price_request: "Pedido de preço",
      purchase_intent: "Intenção de compra",
      objection: "Objeção",
      complaint: "Reclamação",
      support: "Suporte",
      scheduling: "Agendamento",
      payment: "Pagamento",
      cancellation: "Cancelamento",
      follow_up: "Follow-up",
      no_opportunity: "Sem oportunidade",
      unknown: "Indefinida"
    };

    return labels[intent] || intent || "Indefinida";
  };

  const getOpportunityStatusColor = (status) => {
    const colors = {
      cold: "#64748b",
      warm: "#f59e0b",
      hot: "#ef4444",
      urgent: "#dc2626",
      risk: "#7c2d12",
      support: "#2563eb",
      no_opportunity: "#6b7280"
    };

    return colors[status] || "#7c3aed";
  };

  const handleAnalyzeOpportunity = async () => {
    try {
      setOpportunityLoading(true);

      const { data } = await api.post(
        `/tickets/${ticketId}/ai-suggestion`,
        {
          currentMessage: inputMessage,
          mode: "opportunityRadar"
        }
      );

      if (data?.analysis) {
        setOpportunityAnalysis(data.analysis);
        setOpportunityModalOpen(true);
      }
    } catch (err) {
      toastError(err);
    } finally {
      setOpportunityLoading(false);
    }
  };

  const handleUseOpportunityReply = () => {
    if (opportunityAnalysis?.suggestedReply) {
      setInputMessage(opportunityAnalysis.suggestedReply);
      setOpportunityModalOpen(false);

      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 100);
    }
  };

  useEffect(() => {
    if (isTicketPending()) {
      setPrivateMessage(true);
      setPrivateMessageInputVisible(true);
    }
  }, [ticketStatus]);

  // ✅ Abrir modal de template automaticamente se veio do NewTicketModal com API Oficial
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("openTemplate") === "true" && ticketChannel === "whatsapp_oficial") {
      const timer = setTimeout(() => {
        setTemplateModalOpen(true);
        const url = new URL(window.location.href);
        url.searchParams.delete("openTemplate");
        window.history.replaceState({}, "", url.toString());
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [ticketChannel]);

  useEffect(() => {
    let isCurrentRequest = true;

    async function fetchTemplates() {
      try {
        const { data } = await api.request({
          url: `/quick-messages/list`,
          method: "GET",
          params: {
            isOficial: "true",
            userId: user.id,
            companyId: user.companyId,
            status: "APPROVED",
            whatsappId: String(whatsappId),
          },
        });

        if (isCurrentRequest) {
          const receivedTemplates = Array.isArray(data) ? data : [];

          const connectionTemplates = receivedTemplates.filter(
            template =>
              String(template?.whatsappId || "") === String(whatsappId || "")
          );

          setTemplates(connectionTemplates);
        }
      } catch (err) {
        if (isCurrentRequest) {
          setTemplates([]);
          toastError(err);
        }
      }
    }

    // Não consulta templates sem uma conexão oficial definida.
    if (
      useWhatsappOfficial &&
      ticketChannel === "whatsapp_oficial" &&
      whatsappId
    ) {
      setTemplates([]);
      fetchTemplates();
    } else {
      setTemplates([]);
    }

    return () => {
      isCurrentRequest = false;
    };
  }, [
    useWhatsappOfficial,
    ticketChannel,
    whatsappId,
    user.id,
    user.companyId
  ]);

  useEffect(() => {
    async function fetchData() {
      const companyId = user.companyId;
      const planConfigs = await getPlanCompany(undefined, companyId);
      setShowSchedules(planConfigs.plan.useSchedules);
      setUseWhatsappOfficial(planConfigs.plan.useWhatsappOfficial);
    }
    fetchData();
  }, []);

  // Função para verificar janela de 24h (reutilizável)
  const checkWhatsAppWindow = useCallback(async () => {
    if (!ticketId || ticketChannel !== "whatsapp_oficial") {
      setNeedsTemplate(false);
      setIsWhatsAppOfficial(false);
      return;
    }

    try {
      setWindowCheckLoading(true);
      const { data } = await api.get(`/tickets/${ticketId}/check-whatsapp-window`);

      setIsWhatsAppOfficial(data.isWhatsAppOfficial);
      setNeedsTemplate(data.needsTemplate);

      console.log("📱 WhatsApp Window Check:", {
        needsTemplate: data.needsTemplate,
        isWithin24Hours: data.isWithin24Hours,
        hoursElapsed: data.hoursElapsed
      });
    } catch (err) {
      console.error("Erro ao verificar janela de 24h:", err);
      setNeedsTemplate(false);
    } finally {
      setWindowCheckLoading(false);
    }
  }, [ticketId, ticketChannel]);

  // Verificar janela de 24h do WhatsApp Oficial
  useEffect(() => {
    checkWhatsAppWindow();
  }, [checkWhatsAppWindow]);

  // ✅ Re-verificar janela de 24h quando uma nova mensagem do contato chegar
  useEffect(() => {
    if (!ticketId || ticketChannel !== "whatsapp_oficial" || !socket || !user?.companyId) {
      console.log("⚠️ Socket listener não iniciado:", {
        hasTicketId: !!ticketId,
        isWhatsAppOficial: ticketChannel === "whatsapp_oficial",
        hasSocket: !!socket,
        hasCompanyId: !!user?.companyId
      });
      return;
    }

    const companyId = user.companyId;

    console.log("🎧 Iniciando listener de socket para janela de 24h", {
      ticketId,
      companyId,
      channel: ticketChannel
    });

    const onAppMessage = (data) => {
      console.log("📩 Evento socket recebido:", {
        action: data.action,
        ticketUuid: data.message?.ticket?.uuid,
        ticketId: data.message?.ticket?.id,
        currentTicketId: ticketId,
        fromMe: data.message?.fromMe,
        messageId: data.message?.id
      });

      const isThisTicket = data.message?.ticket?.uuid === ticketId ||
        data.message?.ticket?.id === ticketId ||
        data.ticket?.uuid === ticketId ||
        data.ticket?.id === ticketId;

      if (data.action === "create" && isThisTicket && !data.message?.fromMe) {
        console.log("✅ Nova mensagem do contato detectada - Re-verificando janela de 24h");
        setTimeout(() => {
          checkWhatsAppWindow();
        }, 1000);
      }
    };

    socket.on(`company-${companyId}-appMessage`, onAppMessage);

    return () => {
      console.log("🔌 Removendo listener de socket");
      socket.off(`company-${companyId}-appMessage`, onAppMessage);
    };
  }, [ticketId, ticketChannel, socket, user?.companyId, checkWhatsAppWindow]);

  useEffect(() => {
    let nextPlaceholder = "";

    if (needsTemplate && isWhatsAppOfficial) {
      nextPlaceholder = "⚠️ Janela de 24h expirada - Recomendado enviar template";
    } else if (ticketStatus === "open" || ticketStatus === "group") {
      nextPlaceholder = i18n.t("messagesInput.placeholderOpen");
    } else if (ticketStatus === "pending") {
      nextPlaceholder = "Digite sua mensagem interna (ticket aguardando)...";
    } else {
      nextPlaceholder = i18n.t("messagesInput.placeholderClosed");
    }

    if (isMobile && nextPlaceholder.length > 20) {
      nextPlaceholder = `${nextPlaceholder.substring(0, 20)}...`;
    }

    setPlaceHolderText(nextPlaceholder);
  }, [ticketStatus, needsTemplate, isWhatsAppOfficial, isMobile]);

  const {
    selectedMessages,
    setForwardMessageModalOpen,
    showSelectMessageCheckbox,
  } = useContext(ForwardMessageContext);

  useEffect(() => {
    if (droppedFiles && droppedFiles.length > 0) {
      const selectedMedias = Array.from(droppedFiles);
      setMediasUpload(selectedMedias);
      setShowModalMedias(true);
    }
  }, [droppedFiles]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    inputRef.current.focus();
    if (editingMessage) {
      setInputMessage(editingMessage.body);
    }
  }, [replyingMessage, editingMessage]);

  useEffect(() => {
    inputRef.current.focus();
    return () => {
      setInputMessage("");
      setShowEmoji(false);
      setMediasUpload([]);
      setReplyingMessage(null);
      if (!isTicketPending()) {
        setPrivateMessage(false);
        setPrivateMessageInputVisible(false);
      }
      setEditingMessage(null);
    };
  }, [ticketId, setReplyingMessage, setEditingMessage]);


  useEffect(() => {
    let isProcessing = false;

    const handleInsertQuickMessage = (event) => {
      if (isProcessing) {
        console.log("⚠️ Já processando evento, ignorando...");
        return;
      }

      isProcessing = true;
      const { quickMessage } = event.detail;

      if (!quickMessage) {
        console.error("❌ quickMessage não encontrado no evento");
        isProcessing = false;
        return;
      }

      const quickAnswerValue = {
        id: quickMessage.id || null,
        value: quickMessage.message || "",
        mediaPath: quickMessage.mediaPath || null,
        mediaType: quickMessage.mediaType || null,
        shortcode: quickMessage.shortcode || "",
        label: `/${quickMessage.shortcode || ""} - ${quickMessage.message || ""}`
      };

      if (quickMessage.mediaPath) {
        handleQuickAnswersClickRef.current(quickAnswerValue).finally(() => {
          isProcessing = false;
        });
      } else {
        setInputMessage(quickMessage.message || "");
        setSelectedQuickMessage({
          id: quickMessage.id || null,
          body: quickMessage.message || "",
        });
        setTypeBar(false);

        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.focus();
          }
          isProcessing = false;
        }, 100);
      }
    };

    window.addEventListener('insertQuickMessage', handleInsertQuickMessage);

    return () => {
      window.removeEventListener('insertQuickMessage', handleInsertQuickMessage);
      isProcessing = false;
    };
  }, [ticketId]);

  useEffect(() => {
    setTimeout(() => {
      if (isMounted.current) setOnDragEnter(false);
    }, 1000);
  }, [onDragEnter === true]);

  useEffect(() => {
    const fetchSettings = async () => {
      const setting = await getSetting({
        column: "sendSignMessage",
      });

      if (isMounted.current) {
        if (setting.sendSignMessage === "enabled") {
          setSignMessagePar(true);
          const signMessageStorage = JSON.parse(
            localStorage.getItem("persistentSignMessage")
          );
          if (isNil(signMessageStorage)) {
            setSignMessage(true);
          } else {
            setSignMessage(signMessageStorage);
          }
        } else if (setting.sendSignMessage === "dontSend") {
          localStorage.setItem("persistentSignMessage", false);
          setSignMessage(false);
          setSignMessagePar(false);
        } else {
          setSignMessagePar(false);
        }
      }
    };
    fetchSettings();
  }, []);

  // CORREÇÃO DO ERRO charAt - Função mais robusta
  const safeCapitalizeFirstLetter = (string) => {
    if (!string || typeof string !== 'string') return "";
    return string.charAt(0).toUpperCase() + string.slice(1);
  };

  // FUNÇÕES PARA TRIGGER FLOW MODAL
  const handleTriggerFlowClick = useCallback(() => {
    console.log("🎯 Abrindo modal de fluxo");

    setFlowProcessing(false);
    flowProcessingRef.current = false;

    setTriggerFlowModalOpen(true);
  }, []);

  const handleTriggerFlowClose = useCallback(() => {
    console.log("🚪 Fechando modal");

    setFlowProcessing(false);
    flowProcessingRef.current = false;
    setTriggerFlowModalOpen(false);
  }, []);

  const handleFlowProcessing = useCallback((isProcessing) => {
    console.log("🔄 Flow processing:", isProcessing);
    setFlowProcessing(isProcessing);
    flowProcessingRef.current = isProcessing;

    if (isProcessing) {
      setTimeout(() => {
        console.log("⏰ TIMEOUT - Liberando campo FORÇADO");
        setFlowProcessing(false);
        flowProcessingRef.current = false;
      }, 8000);
    }
  }, []);

  const handleFlowTriggered = useCallback((data) => {
    console.log("✅ Fluxo concluído");

    setFlowProcessing(false);
    flowProcessingRef.current = false;
  }, []);


  // NAVEGAÇÃO POR TECLADO CORRIGIDA
  const handleKeyDown = useCallback((e) => {
    if (!typeBar || !Array.isArray(typeBar) || typeBar.length === 0) {
      setSelectedQuickAnswerIndex(-1);
      setIsNavigatingQuickAnswers(false);
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setIsNavigatingQuickAnswers(true);
        setSelectedQuickAnswerIndex(prev => {
          const nextIndex = prev < typeBar.length - 1 ? prev + 1 : 0;

          setTimeout(() => {
            const container = document.querySelector('.MuiBox-root ul');
            if (container) {
              const selectedElement = container.children[nextIndex];
              if (selectedElement) {
                selectedElement.scrollIntoView({
                  behavior: 'smooth',
                  block: 'nearest'
                });
              }
            }
          }, 0);

          return nextIndex;
        });
        break;

      case 'ArrowUp':
        e.preventDefault();
        setIsNavigatingQuickAnswers(true);
        setSelectedQuickAnswerIndex(prev => {
          const nextIndex = prev > 0 ? prev - 1 : typeBar.length - 1;

          setTimeout(() => {
            const container = document.querySelector('.MuiBox-root ul');
            if (container) {
              const selectedElement = container.children[nextIndex];
              if (selectedElement) {
                selectedElement.scrollIntoView({
                  behavior: 'smooth',
                  block: 'nearest'
                });
              }
            }
          }, 0);

          return nextIndex;
        });
        break;

      case 'Enter':
        if (isNavigatingQuickAnswers && selectedQuickAnswerIndex >= 0) {
          e.preventDefault();
          const selectedAnswer = typeBar[selectedQuickAnswerIndex];
          handleQuickAnswersClick(selectedAnswer);
          setSelectedQuickAnswerIndex(-1);
          setIsNavigatingQuickAnswers(false);
        }
        break;

      case 'Escape':
        if (isNavigatingQuickAnswers) {
          e.preventDefault();
          setSelectedQuickAnswerIndex(-1);
          setIsNavigatingQuickAnswers(false);
          setTypeBar(false);
        }
        break;

      case 'Tab':
        if (isNavigatingQuickAnswers) {
          e.preventDefault();
          setSelectedQuickAnswerIndex(prev => {
            const nextIndex = prev < typeBar.length - 1 ? prev + 1 : 0;
            return nextIndex;
          });
        }
        break;

      default:
        if (isNavigatingQuickAnswers && e.key.length === 1) {
          setSelectedQuickAnswerIndex(-1);
          setIsNavigatingQuickAnswers(false);
        }
        break;
    }
  }, [typeBar, selectedQuickAnswerIndex, isNavigatingQuickAnswers]);

  useEffect(() => {
    if (!typeBar || !Array.isArray(typeBar) || typeBar.length === 0) {
      setSelectedQuickAnswerIndex(-1);
      setIsNavigatingQuickAnswers(false);
    }
  }, [typeBar]);

  const getQuickAnswerItemStyle = (index) => ({
    backgroundColor: selectedQuickAnswerIndex === index
      ? (theme.mode === 'light' ? '#e3f2fd' : '#1e3a5f')
      : 'transparent',
    borderLeft: selectedQuickAnswerIndex === index
      ? `4px solid ${theme.palette.primary.main}`
      : '4px solid transparent',
  });

  const handleSendLinkVideo = async () => {
    const link = `https://meet.jit.si/${ticketId}`;
    setInputMessage(link);
  };

  const handleSendTemplate = async () => {
    setTemplateModalOpen(true);
  };

  const handleChangeInput = useCallback((e) => {
    setInputMessage(e.target.value);
  }, []);

  const handlePrivateMessage = (e) => {
    if (isTicketPending()) {
      return;
    }
    setPrivateMessage(!privateMessage);
    setPrivateMessageInputVisible(!privateMessageInputVisible);
  };

  const getMediaTypeIcon = (mediaType) => {
    switch (mediaType) {
      case 'audio': return '🎵';
      case 'image': return '🖼️';
      case 'video': return '🎥';
      case 'document': return '📎';
      default: return '📎';
    }
  };

  const getMediaTypeColor = (mediaType) => {
    switch (mediaType) {
      case 'audio': return 'secondary';
      case 'image': return 'primary';
      case 'video': return 'default';
      case 'document': return 'default';
      default: return 'default';
    }
  };

  const handleQuickAnswersClick = useCallback(async (value) => {
    if (loading) {
      console.log("⚠️ Já processando, ignorando clique...");
      return;
    }

    console.log("🎯 handleQuickAnswersClick chamado:", value);
    console.log("📋 ticketId atual:", ticketId);

    if (!ticketId) {
      console.error("❌ ticketId não encontrado");
      toastError("Erro: ID do ticket não encontrado");
      return;
    }

    if (value.mediaPath) {
      try {
        setLoading(true);
        console.log("📥 Baixando mídia:", value.mediaPath);

        const response = await api.get(value.mediaPath, {
          responseType: "blob",
        });

        console.log("✅ Mídia baixada com sucesso, tamanho:", response.data.size);

        const messageBody = value.value && value.value.trim() !== "" ? value.value : "";

        await handleUploadQuickMessageMedia(
          response.data,
          messageBody,
          value.mediaType,
          value.id
        );

        console.log("✅ Mídia enviada com sucesso");

        setInputMessage("");
        setTypeBar(false);
        return;
      } catch (err) {
        console.error("❌ Erro ao processar mídia:", err);
        toastError(err);
      } finally {
        setLoading(false);
      }
    } else {
      const nextMessage =
        isString(inputMessage) && inputMessage.startsWith("/")
          ? (value.value || "")
          : `${inputMessage || ""}${value.value || ""}`;

      setInputMessage(nextMessage);
      setSelectedQuickMessage({
        id: value.id || null,
        body: nextMessage,
      });
      setTypeBar(false);
      setSelectedQuickAnswerIndex(-1);
      setIsNavigatingQuickAnswers(false);

      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 0);
    }
  }, [loading, ticketId, privateMessage]);

  // Ref para handleQuickAnswersClick para evitar stale closures no event listener
  const handleQuickAnswersClickRef = useRef(handleQuickAnswersClick);
  useEffect(() => {
    handleQuickAnswersClickRef.current = handleQuickAnswersClick;
  }, [handleQuickAnswersClick]);

  const handleUploadQuickMessageMedia = useCallback(async (
    blob,
    message,
    mediaType = null,
    quickMessageId = null
  ) => {
    console.log("📤 Iniciando upload de mídia:", {
      blobSize: blob.size,
      message,
      mediaType,
      ticketId
    });

    if (!ticketId) {
      throw new Error("ID do ticket não encontrado");
    }

    if (loading) {
      console.log("⚠️ Upload já em andamento, ignorando...");
      return;
    }

    try {
      let extension = 'bin';

      if (blob.type) {
        const mimeType = blob.type.split("/")[1];
        extension = mimeType;

        if (blob.type.includes('webm') || blob.type.includes('audio')) {
          extension = blob.type.includes('webm') ? 'webm' : 'mp3';
        }
      } else if (mediaType) {
        const typeExtensionMap = {
          'audio': 'webm',
          'image': 'jpg',
          'video': 'mp4',
          'document': 'pdf'
        };
        extension = typeExtensionMap[mediaType] || 'bin';
      }

      const formData = new FormData();
      const filename = `${new Date().getTime()}.${extension}`;
      formData.append("medias", blob, filename);
      formData.append("typeArch", "quickMessage");

      const body = message && message.trim() !== ""
        ? ((privateMessage || isTicketPending()) ? `\u200d${message}` : message)
        : ((privateMessage || isTicketPending()) ? `\u200d` : "");

      formData.append("body", body);
      formData.append("fromMe", true);
      formData.append("isPrivate", (privateMessage || isTicketPending()) ? "true" : "false");
      if (quickMessageId) {
        formData.append("quickMessageId", String(quickMessageId));
      }

      console.log("📤 Enviando para:", `/messages/${ticketId}`);

      if (isMounted.current) {
        const response = await api.post(`/messages/${ticketId}`, formData);
        console.log("✅ Upload realizado com sucesso:", response.status);
      }
    } catch (err) {
      console.error("❌ Erro no upload:", err);
      const errorMessage = err?.response?.data?.error || err?.message || "";
      if (!errorMessage.includes("Janela de 24h")) {
        toastError(err);
      }
      throw err;
    }
  }, [ticketId, privateMessage, loading]);

  const handleAddEmoji = (e) => {
    let emoji = e.native;
    setInputMessage((prevState) => prevState + emoji);
  };

  const [modalCameraOpen, setModalCameraOpen] = useState(false);

  const handleCapture = (imageData) => {
    if (imageData) {
      handleUploadCamera(imageData);
    }
  };

  const handleChangeMedias = (e) => {
    if (!e.target.files) {
      return;
    }
    const selectedMedias = Array.from(e.target.files);
    setMediasUpload(selectedMedias);
    setShowModalMedias(true);
  };

  const handleChangeSign = (e) => {
    getStatusSingMessageLocalstogare();
  };

  const handleOpenModalForward = () => {
    if (selectedMessages.length === 0) {
      setForwardMessageModalOpen(false);
      toastError(i18n.t("messagesList.header.notMessage"));
      return;
    }
    setForwardMessageModalOpen(true);
  };

  const getStatusSingMessageLocalstogare = () => {
    const signMessageStorage = JSON.parse(
      localStorage.getItem("persistentSignMessage")
    );
    if (signMessageStorage !== null) {
      if (signMessageStorage) {
        localStorage.setItem("persistentSignMessage", false);
        setSignMessage(false);
      } else {
        localStorage.setItem("persistentSignMessage", true);
        setSignMessage(true);
      }
    } else {
      localStorage.setItem("persistentSignMessage", false);
      setSignMessage(false);
    }
  };

  const handleInputPaste = (e) => {
    if (e.clipboardData.files[0]) {
      const selectedMedias = Array.from(e.clipboardData.files);
      setMediasUpload(selectedMedias);
      setShowModalMedias(true);
    }
  };

  const handleInputDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files[0]) {
      const selectedMedias = Array.from(e.dataTransfer.files);
      setMediasUpload(selectedMedias);
      setShowModalMedias(true);
    }
  };

  const handleUploadMedia = async (mediasUpload) => {
    setLoading(true);

    if (!mediasUpload.length) {
      console.log("Nenhuma mídia selecionada.");
      setLoading(false);
      return;
    }

    const formData = new FormData();
    formData.append("fromMe", true);
    formData.append("isPrivate", (privateMessage || isTicketPending()) ? "true" : "false");
    mediasUpload.forEach((media) => {
      formData.append("body", media.caption);
      formData.append("medias", media.file);
    });

    try {
      await api.post(`/messages/${ticketId}`, formData);

      setLoading(false);
      setMediasUpload([]);
      setShowModalMedias(false);
      if (!isTicketPending()) {
        setPrivateMessage(false);
        setPrivateMessageInputVisible(false);
      }
    } catch (err) {
      const errorMessage = err?.response?.data?.error || err?.message || "";
      if (!errorMessage.includes("Janela de 24h")) {
        toastError(err);
      }
      setLoading(false);
    }
  };

  const handleSendContatcMessage = async (vcard) => {
    setSenVcardModalOpen(false);
    setLoading(true);

    if (isNil(vcard)) {
      setLoading(false);
      return;
    }

    const message = {
      read: 1,
      fromMe: true,
      mediaUrl: "",
      body: null,
      quotedMsg: replyingMessage,
      isPrivate: (privateMessage || isTicketPending()) ? "true" : "false",
      vCard: vcard,
    };
    try {
      await api.post(`/messages/${ticketId}`, message);

      setInputMessage("");
      setSelectedQuickMessage(null);
      setShowEmoji(false);
      setLoading(false);
      setReplyingMessage(null);
      setEditingMessage(null);
      if (!isTicketPending()) {
        setPrivateMessage(false);
        setPrivateMessageInputVisible(false);
      }
    } catch (err) {
      const errorMessage = err?.response?.data?.error || err?.message || "";
      if (!errorMessage.includes("Janela de 24h")) {
        toastError(err);
      }
      setLoading(false);
    }
  };

  // Envia ghost mention (@all) direto sem colocar texto no input
  const handleGhostMention = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await api.post(`/messages/${ticketId}`, {
        read: 1,
        fromMe: true,
        mediaUrl: "",
        body: "@all",
        quotedMsg: null,
        isPrivate: "false",
      });
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage || inputMessage.trim() === "") return;

    if (needsTemplate && isWhatsAppOfficial && !isTicketPending()) {
      console.warn("⚠️ Janela de 24h expirada - Enviando mensagem mesmo assim");
    }

    setLoading(true);

    const userName = (privateMessage || isTicketPending())
      ? `${user.name} - Mensagem Interna`
      : user.name;

    const sendMessage = inputMessage.trim();

    const message = {
      read: 1,
      fromMe: true,
      mediaUrl: "",
      body:
        ((signMessage && !isTicketPending()) || privateMessage || isTicketPending()) && !editingMessage
          ? `*${userName}:*\n${sendMessage}`
          : sendMessage,
      quotedMsg: replyingMessage,
      isPrivate: (privateMessage || isTicketPending()) ? "true" : "false",
      quickMessageId:
        !editingMessage &&
        selectedQuickMessage?.id &&
        selectedQuickMessage.body.trim() === sendMessage
          ? selectedQuickMessage.id
          : undefined,
    };

    try {
      if (editingMessage !== null) {
        await api.post(`/messages/edit/${editingMessage.id}`, message);
      } else {
        console.log("ENVIOU PARA TIKCET", ticketId);
        await api.post(`/messages/${ticketId}`, message);
      }

      setInputMessage("");
      setSelectedQuickMessage(null);
      setShowEmoji(false);
      setLoading(false);
      setReplyingMessage(null);
      if (!isTicketPending()) {
        setPrivateMessage(false);
      }
      setEditingMessage(null);
      if (!isTicketPending()) {
        setPrivateMessageInputVisible(false);
      }
      handleMenuItemClick();
    } catch (err) {
      const errorMessage = err?.response?.data?.error || err?.message || "";
      if (!errorMessage.includes("Janela de 24h")) {
        toastError(err);
      }
      setLoading(false);
    }
  };

  const handleSendMessageTemplate = async (e) => {
    if (e.id === "") return;
    setLoading(true);

    const message = {
      templateId: e.id,
      variables: e.variables,
      bodyToSave: e.bodyToSave,
      mediaUrl: "",
      quotedMsg: replyingMessage,
    };

    try {
      await api.post(`/messages-template/${ticketId}`, message);

      console.log("✅ Template enviado - Re-verificando janela de 24h");
      setNeedsTemplate(false);
      await checkWhatsAppWindow();

      setLoading(false);
    } catch (err) {
      toastError(err);
      setLoading(false);
    }
    setTemplateModalOpen(false);
    setInputMessage("");
    setShowEmoji(false);
    setReplyingMessage(null);
    if (!isTicketPending()) {
      setPrivateMessage(false);
    }
    setEditingMessage(null);
    if (!isTicketPending()) {
      setPrivateMessageInputVisible(false);
    }
    handleMenuItemClick();
  };

  const handleStartRecording = async () => {
    setLoading(true);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      await Mp3Recorder.start();
      setRecording(true);
      setLoading(false);
    } catch (err) {
      toastError(err);
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const companyId = user.companyId;
        const messages = await listQuickMessages({
          companyId,
          userId: user.id,
          isOficial: ticketChannel === "whatsapp_oficial" ? "true" : "false",
        });

        if (cancelled || !isMounted.current) return;

        const options = (messages || []).map((m) => {
          let truncatedMessage = m.message;

          if (isString(truncatedMessage) && truncatedMessage.length > 90) {
            truncatedMessage = m.message.substring(0, 90) + "...";
          }

          return {
            id: m.id,
            value: m.message || "",
            label: `/${m.shortcode} - ${truncatedMessage || ""}`,
            mediaPath: m.mediaPath,
            mediaType: m.mediaType,
            shortcode: m.shortcode,
          };
        });

        setQuickAnswer(options);
      } catch (err) {
        console.error("Erro ao carregar respostas rápidas:", err);
        if (!cancelled && isMounted.current) {
          setQuickAnswer([]);
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (
      isString(inputMessage) &&
      !isEmpty(inputMessage) &&
      inputMessage.length >= 1
    ) {
      const firstWord = inputMessage.charAt(0);

      if (firstWord === "/") {
        setTypeBar(firstWord.indexOf("/") > -1);

        const filteredOptions = quickAnswers.filter(
          (m) => m.label.toLowerCase().indexOf(inputMessage.toLowerCase()) > -1
        );
        setTypeBar(filteredOptions);
      } else {
        setTypeBar(false);
      }
    } else {
      setTypeBar(false);
    }
  }, [inputMessage]);

  useEffect(() => {
    console.log("🔍 Modal state:", triggerFlowModalOpen, "Flow processing:", flowProcessing);

    if (!triggerFlowModalOpen && flowProcessing) {
      console.log("🔓 FORÇANDO liberação do campo");
      setFlowProcessing(false);
      flowProcessingRef.current = false;
    }
  }, [triggerFlowModalOpen, flowProcessing]);

  const disableOption = useCallback(() => {
    const isFlowProcessing = flowProcessingRef.current || flowProcessing;

    return (
      loading ||
      recording ||
      isFlowProcessing ||
      (!isTicketPending() && ticketStatus !== "open" && ticketStatus !== "group")
    );
  }, [loading, recording, flowProcessing, ticketStatus, needsTemplate]);

  const disableOptionForPending = useCallback(() => {
    const isFlowProcessing = flowProcessingRef.current || flowProcessing;

    return (
      loading ||
      recording ||
      isFlowProcessing ||
      ticketStatus === "closed"
    );
  }, [loading, recording, flowProcessing, ticketStatus]);

  const renderOpportunityButton = (disabled) => {
    return (
      <Tooltip title="Radar de Oportunidades IA">
        <IconButton
          onClick={handleAnalyzeOpportunity}
          disabled={disabled || opportunityLoading}
          size="small"
        >
          {opportunityLoading ? (
            <CircularProgress size={18} />
          ) : (
            <span
              style={{
                fontSize: 18,
                fontWeight: "bold",
                color: "#0f766e"
              }}
            >
              🎯
            </span>
          )}
        </IconButton>
      </Tooltip>
    );
  };

  const handleUploadCamera = async (blob) => {
    setLoading(true);
    try {
      const formData = new FormData();
      const filename = `${new Date().getTime()}.png`;
      formData.append("medias", blob, filename);
      formData.append("body", (privateMessage || isTicketPending()) ? `\u200d` : "");
      formData.append("fromMe", true);

      await api.post(`/messages/${ticketId}`, formData);

      setLoading(false);
    } catch (err) {
      const errorMessage = err?.response?.data?.error || err?.message || "";
      if (!errorMessage.includes("Janela de 24h")) {
        toastError(err);
      }
      setLoading(false);
    }
  };

  const handleUploadAudio = async () => {
    setLoading(true);
    try {
      const [, blob] = await Mp3Recorder.stop().getMp3();
      if (blob.size < 10000) {
        setLoading(false);
        setRecording(false);
        return;
      }

      const formData = new FormData();

      let filename;
      if (["whatsapp", "whatsapp_oficial"].includes(ticketChannel)) {
        filename = isMobileDevice()
          ? `audio_${new Date().getTime()}.ogg`
          : `audio_${new Date().getTime()}.mp3`;
      } else {
        filename = `${new Date().getTime()}.m4a`;
      }

      formData.append("medias", blob, filename);
      formData.append("body", "🎵 Mensagem de voz");
      formData.append("fromMe", true);
      formData.append("isPrivate", (privateMessage || isTicketPending()) ? "true" : "false");

      console.log(`📤 Enviando áudio: ${filename} (${blob.size} bytes)`);

      if (isMounted.current) {
        await api.post(`/messages/${ticketId}`, formData);
      }
    } catch (err) {
      const errorMessage = err?.response?.data?.error || err?.message || "";
      if (!errorMessage.includes("Janela de 24h")) {
        toastError(err);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setRecording(false);
      }
    }
  };

  const handleCloseModalMedias = () => {
    setShowModalMedias(false);
  };

  const handleCancelAudio = async () => {
    try {
      await Mp3Recorder.stop().getMp3();
      setRecording(false);
    } catch (err) {
      toastError(err);
    }
  };

  const handleOpenMenuClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuItemClick = (event) => {
    setAnchorEl(null);
  };

  const handleSendContactModalOpen = async () => {
    handleMenuItemClick();
    setSenVcardModalOpen(true);
  };

  const handleCameraModalOpen = async () => {
    handleMenuItemClick();
    setModalCameraOpen(true);
  };

  const handleCancelSelection = () => {
    setMediasUpload([]);
    setShowModalMedias(false);
  };

  const checkForSelectedText = useCallback(() => {
    if (inputRef.current) {
      const start = inputRef.current.selectionStart;
      const end = inputRef.current.selectionEnd;

      if (start !== end && start !== null && end !== null) {
        const selectedText = inputMessage.substring(start, end);
        if (selectedText.trim() !== '') {
          const inputRect = inputRef.current.getBoundingClientRect();
          const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

          setSelectedText({
            text: selectedText,
            start: start,
            end: end
          });

          setFormatMenuAnchorPosition({
            x: inputRect.left + inputRect.width / 2,
            y: inputRect.top + scrollTop - 10
          });

          return true;
        }
      }
    }

    setFormatMenuAnchorPosition(null);
    return false;
  }, [inputMessage]);

  const handleCloseFormatMenu = useCallback(() => {
    setFormatMenuAnchorPosition(null);
  }, []);

  // Aplica a formatação ao texto selecionado
  const handleFormatText = useCallback((formatType) => {
    const { text, start, end } = selectedText;
    let formattedText = '';

    switch (formatType) {
      case 'bold':
        formattedText = `*${text}*`;
        break;
      case 'italic':
        formattedText = `_${text}_`;
        break;
      case 'strikethrough':
        formattedText = `~${text}~`;
        break;
      case 'code':
        formattedText = `\`${text}\``;
        break;
      case 'numberedList':
        formattedText = text.split('\n')
          .map((line, index) => `${index + 1}. ${line}`)
          .join('\n');
        break;
      case 'bulletList':
        formattedText = text.split('\n')
          .map(line => `• ${line}`)
          .join('\n');
        break;
      case 'quote':
        formattedText = text.split('\n')
          .map(line => `> ${line}`)
          .join('\n');
        break;
      case 'clear':
        formattedText = text
          .replace(/\*([^*]+)\*/g, '$1')
          .replace(/_([^_]+)_/g, '$1')
          .replace(/~([^~]+)~/g, '$1')
          .replace(/`([^`]+)`/g, '$1')
          .replace(/^\d+\.\s/gm, '')
          .replace(/^•\s/gm, '')
          .replace(/^>\s/gm, '');
        break;
      default:
        formattedText = text;
    }

    const newInputMessage =
      inputMessage.substring(0, start) +
      formattedText +
      inputMessage.substring(end);

    setInputMessage(newInputMessage);

    handleCloseFormatMenu();

    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newCursorPosition = start + formattedText.length;
        inputRef.current.selectionStart = newCursorPosition;
        inputRef.current.selectionEnd = newCursorPosition;
      }
    }, 100);
  }, [selectedText, inputMessage, handleCloseFormatMenu]);

  // Handlers para detectar seleção de texto
  const handleSelectText = useCallback(() => {
    checkForSelectedText();
  }, [checkForSelectedText]);

  const handleMouseUp = useCallback(() => {
    checkForSelectedText();
  }, [checkForSelectedText]);

  const handleKeyUp = useCallback((e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Shift') {
      checkForSelectedText();
    }
  }, [checkForSelectedText]);

  const renderReplyingMessage = (message) => {
    return (
      <div className={classes.replyginMsgWrapper}>
        <div className={classes.replyginMsgContainer}>
          <span
            className={clsx(classes.replyginContactMsgSideColor, {
              [classes.replyginSelfMsgSideColor]: !message.fromMe,
            })}
          ></span>
          {replyingMessage && (
            <div className={classes.replyginMsgBody}>
              {!message.fromMe && (
                <span className={classes.messageContactName}>
                  {message.contact?.name}
                </span>
              )}
              {message.body}
            </div>
          )}
        </div>
        <IconButton
          aria-label="showRecorder"
          component="span"
          disabled={disableOptionForPending()}
          onClick={() => {
            setReplyingMessage(null);
            setEditingMessage(null);
            setInputMessage("");
          }}
        >
          <Clear className={classes.sendMessageIcons} />
        </IconButton>
      </div>
    );
  };

  const renderFlowProcessingAlert = () => {
    if (!flowProcessing) return null;

    return (
      <Box className={classes.pendingAlert} style={{ backgroundColor: "#E8F5E8", borderColor: "#4CAF50" }}>
        <CircularProgress size={16} style={{ marginRight: 8 }} />
        <span>
          <strong>Fluxo em Execução:</strong> Campo de mensagem temporariamente desabilitado.
        </span>
      </Box>
    );
  };

  const renderTemplateRequiredAlert = () => {
    if (!needsTemplate || !isWhatsAppOfficial) return null;

    return (
      <Box className={classes.pendingAlert} style={{ backgroundColor: "#FFF3E0", borderColor: "#FF9800" }}>
        <WhatsApp style={{ fontSize: 20, color: "#FF9800" }} />
        <span>
          <strong>Janela de 24h Expirada:</strong> Recomendamos enviar um template, mas você também pode digitar normalmente.
        </span>
      </Box>
    );
  };

  const TextFormatMenu = () => {
    const isMenuOpen = Boolean(formatMenuAnchorPosition);
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    if (!isMenuOpen) return null;

    return (
      <ClickAwayListener onClickAway={handleCloseFormatMenu}>
        <Fade in={isMenuOpen}>
          <div
            className={classes.floatingFormatMenu}
            style={{
              top: formatMenuAnchorPosition ? formatMenuAnchorPosition.y - 50 : 0,
              left: formatMenuAnchorPosition ? formatMenuAnchorPosition.x : 0,
            }}
          >
            <Tooltip title="Negrito">
              <IconButton
                className={classes.formatIconButton}
                disabled={disableOptionForPending()}
                onClick={() => handleFormatText('bold')}
                size="small"
              >
                <FormatBoldIcon fontSize={isMobile ? "small" : "medium"} />
              </IconButton>
            </Tooltip>

            <Tooltip title="Itálico">
              <IconButton
                className={classes.formatIconButton}
                disabled={disableOptionForPending()}
                onClick={() => handleFormatText('italic')}
                size="small"
              >
                <FormatItalicIcon fontSize={isMobile ? "small" : "medium"} />
              </IconButton>
            </Tooltip>

            <Tooltip title="Tachado">
              <IconButton
                className={classes.formatIconButton}
                disabled={disableOptionForPending()}
                onClick={() => handleFormatText('strikethrough')}
                size="small"
              >
                <FormatStrikethroughIcon fontSize={isMobile ? "small" : "medium"} />
              </IconButton>
            </Tooltip>

            <Tooltip title="Código">
              <IconButton
                className={classes.formatIconButton}
                disabled={disableOptionForPending()}
                onClick={() => handleFormatText('code')}
                size="small"
              >
                <CodeIcon fontSize={isMobile ? "small" : "medium"} />
              </IconButton>
            </Tooltip>

            <Tooltip title="Lista Numerada">
              <IconButton
                className={classes.formatIconButton}
                disabled={disableOptionForPending()}
                onClick={() => handleFormatText('numberedList')}
                size="small"
              >
                <FormatListNumberedIcon fontSize={isMobile ? "small" : "medium"} />
              </IconButton>
            </Tooltip>

            <Tooltip title="Lista com Marcadores">
              <IconButton
                className={classes.formatIconButton}
                disabled={disableOptionForPending()}
                onClick={() => handleFormatText('bulletList')}
                size="small"
              >
                <FormatListBulletedIcon fontSize={isMobile ? "small" : "medium"} />
              </IconButton>
            </Tooltip>

            <Tooltip title="Citação">
              <IconButton
                className={classes.formatIconButton}
                disabled={disableOptionForPending()}
                onClick={() => handleFormatText('quote')}
                size="small"
              >
                <FormatQuoteIcon fontSize={isMobile ? "small" : "medium"} />
              </IconButton>
            </Tooltip>

            <Tooltip title="Limpar Formatação">
              <IconButton
                className={classes.formatIconButton}
                disabled={disableOptionForPending()}
                onClick={() => handleFormatText('clear')}
                size="small"
              >
                <FormatClearIcon fontSize={isMobile ? "small" : "medium"} />
              </IconButton>
            </Tooltip>

            {isGroup && ticketChannel !== "whatsapp_oficial" && (
              <Tooltip title="Marcação Fantasma (notifica todos sem mostrar @)">
                <IconButton
                  className={classes.formatIconButton}
                  style={{ color: "#9c27b0" }}
                  onClick={handleGhostMention}
                  disabled={loading}
                >
                  <GroupAdd fontSize={isMobile ? "small" : "medium"} />
                </IconButton>
              </Tooltip>
            )}
          </div>
        </Fade>
      </ClickAwayListener>
    );
  };

  const renderPendingAlert = () => {
    if (!isTicketPending()) return null;

    return (
      <Box className={classes.pendingAlert}>
        <Info style={{ fontSize: 20 }} />
        <span>
          <strong>Ticket Aguardando:</strong> Apenas mensagens internas são permitidas neste momento.
        </span>
      </Box>
    );
  };

  const renderOpportunityModal = () => {
    const analysis = opportunityAnalysis || {};
    const statusColor = getOpportunityStatusColor(analysis.status);

    return (
      <Dialog
        open={opportunityModalOpen}
        onClose={() => setOpportunityModalOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Radar de Oportunidades com IA</DialogTitle>
        <DialogContent dividers>
          <Box display="flex" alignItems="center" flexWrap="wrap" style={{ gap: 8, marginBottom: 12 }}>
            <Chip
              label={`Score: ${analysis.score ?? 0}%`}
              style={{ backgroundColor: statusColor, color: "#fff", fontWeight: 700 }}
            />
            <Chip
              label={`Status: ${getOpportunityStatusLabel(analysis.status)}`}
              variant="outlined"
              style={{ borderColor: statusColor, color: statusColor, fontWeight: 700 }}
            />
            <Chip
              label={`Intenção: ${getOpportunityIntentLabel(analysis.intent)}`}
              variant="outlined"
            />
          </Box>

          <Typography variant="subtitle2" style={{ fontWeight: 700 }}>
            Resumo
          </Typography>
          <Typography variant="body2" style={{ marginBottom: 12, whiteSpace: "pre-wrap" }}>
            {analysis.summary || "Nenhum resumo retornado."}
          </Typography>

          <Typography variant="subtitle2" style={{ fontWeight: 700 }}>
            Próxima melhor ação
          </Typography>
          <Typography variant="body2" style={{ marginBottom: 12, whiteSpace: "pre-wrap" }}>
            {analysis.nextAction || "Nenhuma ação recomendada."}
          </Typography>

          <Typography variant="subtitle2" style={{ fontWeight: 700 }}>
            Resposta sugerida
          </Typography>
          <Paper
            variant="outlined"
            style={{
              padding: 12,
              marginBottom: 12,
              background: theme.mode === "light" ? "#f8fafc" : "#1f2937",
              whiteSpace: "pre-wrap"
            }}
          >
            <Typography variant="body2">
              {analysis.suggestedReply || "Nenhuma resposta sugerida."}
            </Typography>
          </Paper>

          <Typography variant="subtitle2" style={{ fontWeight: 700 }}>
            Risco / atenção
          </Typography>
          <Typography variant="body2" style={{ marginBottom: 12, whiteSpace: "pre-wrap" }}>
            {analysis.risk || "Nenhum risco identificado."}
          </Typography>

          {Array.isArray(analysis.tags) && analysis.tags.length > 0 && (
            <>
              <Divider style={{ margin: "12px 0" }} />
              <Box display="flex" alignItems="center" flexWrap="wrap" style={{ gap: 6 }}>
                {analysis.tags.map((tag, index) => (
                  <Chip
                    key={`${tag}-${index}`}
                    size="small"
                    label={tag}
                    variant="outlined"
                  />
                ))}
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpportunityModalOpen(false)}>
            {i18n.t("campaigns.settings.close")}
          </Button>
          <Button
            color="primary"
            variant="contained"
            onClick={handleUseOpportunityReply}
            disabled={!analysis.suggestedReply}
          >
            Usar resposta sugerida
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  if (mediasUpload.length > 0) {
    return (
      <Paper
        elevation={0}
        square
        className={classes.viewMediaInputWrapper}
        onDragEnter={() => setOnDragEnter(true)}
        onDrop={(e) => handleInputDrop(e)}
      >
        {showModalMedias && (
          <MessageUploadMedias
            isOpen={showModalMedias}
            files={mediasUpload}
            onClose={handleCloseModalMedias}
            onSend={handleUploadMedia}
            onCancelSelection={handleCancelSelection}
          />
        )}
      </Paper>
    );
  } else {
    return (
      <>
        {renderOpportunityModal()}
        {templateModalOpen && (
          <TemplateModal
            open={templateModalOpen}
            handleClose={() => setTemplateModalOpen(false)}
            onSelectTemplate={(e) => handleSendMessageTemplate(e)}
            templates={templates}
          />
        )}
        {modalCameraOpen && (
          <CameraModal
            isOpen={modalCameraOpen}
            onRequestClose={() => setModalCameraOpen(false)}
            onCapture={handleCapture}
          />
        )}
        {senVcardModalOpen && (
          <ContactSendModal
            modalOpen={senVcardModalOpen}
            onClose={(c) => {
              handleSendContatcMessage(c);
            }}
          />
        )}

        {/* MODAL DE MENSAGEM INTERATIVA */}
        {interactiveModalOpen && (
          <InteractiveMessageModal
            open={interactiveModalOpen}
            onClose={() => setInteractiveModalOpen(false)}
            ticketId={ticketId}
            ticketChannel={ticketChannel}
          />
        )}


        {/* NOVO MODAL DE TRIGGER FLOW */}
        {triggerFlowModalOpen && (
          <TriggerFlowModal
            open={triggerFlowModalOpen}
            onClose={handleTriggerFlowClose}
            ticketId={ticketId}
            ticketStatus={ticketStatus}
            onFlowTriggered={handleFlowTriggered}
            onFlowProcessing={handleFlowProcessing}
          />
        )}

        <Paper
          square
          elevation={0}
          className={classes.mainWrapper}
          onDragEnter={() => setOnDragEnter(true)}
          onDrop={(e) => handleInputDrop(e)}
        >
          {renderPendingAlert()}
          {renderFlowProcessingAlert()}
          {renderTemplateRequiredAlert()}

          {(replyingMessage && renderReplyingMessage(replyingMessage)) ||
            (editingMessage && renderReplyingMessage(editingMessage))}
          <div className={classes.newMessageBox}>
            {/* Template button removido - mantido apenas no menu + */}

            {!isTicketPending() && (
              <Hidden only={["sm", "xs"]}>
                <IconButton
                  aria-label="emojiPicker"
                  component="span"
                  disabled={disableOption()}
                  onClick={(e) => setShowEmoji((prevState) => !prevState)}
                >
                  <Mood className={classes.sendMessageIcons} />
                </IconButton>
                {showEmoji ? (
                  <div className={classes.emojiBox}>
                    <ClickAwayListener onClickAway={(e) => setShowEmoji(true)}>
                      <Picker
                        perLine={16}
                        theme={"dark"}
                        i18n={i18n}
                        showPreview={true}
                        showSkinTones={false}
                        onSelect={handleAddEmoji}
                      />
                    </ClickAwayListener>
                  </div>
                ) : null}

                <Fab
                  disabled={disableOption()}
                  aria-label="uploadMedias"
                  component="span"
                  className={classes.invertedFabMenu}
                  onClick={handleOpenMenuClick}
                >
                  <AddIcon />
                </Fab>
                <Menu
                  anchorEl={anchorEl}
                  keepMounted
                  open={Boolean(anchorEl)}
                  onClose={handleMenuItemClick}
                  id="simple-menu"
                >
                  <MenuItem onClick={handleMenuItemClick}>
                    <input
                      multiple
                      type="file"
                      id="upload-img-button"
                      accept="image/*, video/*, audio/* "
                      className={classes.uploadInput}
                      onChange={handleChangeMedias}
                    />
                    <label htmlFor="upload-img-button">
                      <Fab
                        aria-label="upload-img"
                        component="span"
                        className={classes.invertedFabMenuMP}
                      >
                        <PermMedia />
                      </Fab>
                      {i18n.t("messageInput.type.imageVideo")}
                    </label>
                  </MenuItem>
                  <MenuItem onClick={handleCameraModalOpen}>
                    <Fab className={classes.invertedFabMenuCamera}>
                      <CameraAlt />
                    </Fab>
                    {i18n.t("messageInput.type.cam")}
                  </MenuItem>
                  <MenuItem onClick={handleMenuItemClick}>
                    <input
                      multiple
                      type="file"
                      id="upload-doc-button"
                      accept="application/*, text/*, .odt, .ods, .odp, .odg, .xml, .ofx, .zip, .rar, .7z, .tar, .gz, .bz2, .msg, .key, .numbers, .pages"
                      className={classes.uploadInput}
                      onChange={handleChangeMedias}
                    />
                    <label htmlFor="upload-doc-button">
                      <Fab
                        aria-label="upload-img"
                        component="span"
                        className={classes.invertedFabMenuDoc}
                      >
                        <Description />
                      </Fab>
                      Documento
                    </label>
                  </MenuItem>
                  <MenuItem onClick={handleSendContactModalOpen}>
                    <Fab className={classes.invertedFabMenuCont}>
                      <Person />
                    </Fab>
                    {i18n.t("messageInput.type.contact")}
                  </MenuItem>
                  <MenuItem onClick={handleSendLinkVideo}>
                    <Fab className={classes.invertedFabMenuMeet}>
                      <Duo />
                    </Fab>
                    {i18n.t("messageInput.type.meet")}
                  </MenuItem>
                </Menu>

                {signMessagePar && (
                  <Tooltip title={i18n.t("messageInput.tooltip.signature")}>
                    <IconButton
                      aria-label="send-upload"
                      component="span"
                      onClick={handleChangeSign}
                    >
                      {signMessage === true ? (
                        <Create
                          style={{
                            color:
                              theme.mode === "light"
                                ? theme.palette.primary.main
                                : "#EEE",
                          }}
                        />
                      ) : (
                        <Create style={{ color: "grey" }} />
                      )}
                    </IconButton>
                  </Tooltip>
                )}

                {/* NOVO ÍCONE DE TRIGGER FLOW - APENAS EM TICKETS OPEN */}
                {ticketStatus === "open" && (
                  <Tooltip title={i18n.t("triggerFlowModal.title")}>
                    <IconButton
                      aria-label="trigger-flow"
                      component="span"
                      onClick={handleTriggerFlowClick}
                      disabled={disableOption()}
                    >
                      <AccountTree
                        style={{
                          color: theme.mode === "light"
                            ? theme.palette.secondary.main
                            : "#EEE"
                        }}
                      />
                    </IconButton>
                  </Tooltip>
                )}

                {/* BOTÃO MENSAGEM INTERATIVA - REMOVIDO */}
                {/* BOTÃO MENCIONAR TODOS - APENAS EM GRUPOS BAILEYS */}
                {isGroup && ticketChannel !== "whatsapp_oficial" && (
                  <Tooltip title="Marcação Fantasma (notifica todos sem mostrar @)">
                    <IconButton
                      aria-label="mention-all"
                      component="span"
                      onClick={handleGhostMention}
                      disabled={disableOption() || loading}
                    >
                      <GroupAdd
                        style={{
                          color: theme.mode === "light"
                            ? theme.palette.primary.main
                            : "#EEE"
                        }}
                      />
                    </IconButton>
                  </Tooltip>
                )}

                {!isTicketPending() && (
                  <Tooltip title={i18n.t("messageInput.tooltip.privateMessage")}>
                    <IconButton
                      aria-label="send-upload"
                      component="span"
                      onClick={handlePrivateMessage}
                    >
                      {privateMessage === true ? (
                        <Comment
                          style={{
                            color:
                              theme.mode === "light"
                                ? theme.palette.primary.main
                                : "#EEE",
                          }}
                        />
                      ) : (
                        <Comment style={{ color: "grey" }} />
                      )}
                    </IconButton>
                  </Tooltip>
                )}
              </Hidden>
            )}

            {isTicketPending() && (
              <Hidden only={["md", "lg", "xl"]}>
                <IconButton
                  aria-controls="simple-menu"
                  aria-haspopup="true"
                  onClick={handleOpenMenuClick}
                >
                  <MoreVert></MoreVert>
                </IconButton>
                <Menu
                  id="simple-menu"
                  keepMounted
                  anchorEl={anchorEl}
                  open={Boolean(anchorEl)}
                  onClose={handleMenuItemClick}
                >
                  <MenuItem onClick={(e) => {
                    e.stopPropagation();
                    setShowEmoji((prevState) => !prevState);
                    handleMenuItemClick();
                  }}>
                    <IconButton
                      aria-label="emojiPicker"
                      component="span"
                      disabled={disableOptionForPending()}
                    >
                      <Mood className={classes.sendMessageIcons} />
                    </IconButton>
                    Emoji
                  </MenuItem>
                </Menu>
              </Hidden>
            )}

            {!isTicketPending() && (
              <Hidden only={["md", "lg", "xl"]}>
                <IconButton
                  aria-controls="simple-menu"
                  aria-haspopup="true"
                  onClick={handleOpenMenuClick}
                >
                  <MoreVert></MoreVert>
                </IconButton>
                <Menu
                  id="simple-menu"
                  keepMounted
                  anchorEl={anchorEl}
                  open={Boolean(anchorEl)}
                  onClose={handleMenuItemClick}
                >
                  <MenuItem onClick={(e) => {
                    e.stopPropagation();
                    setShowEmoji((prevState) => !prevState);
                    handleMenuItemClick();
                  }}>
                    <IconButton
                      aria-label="emojiPicker"
                      component="span"
                      disabled={disableOption()}
                    >
                      <Mood className={classes.sendMessageIcons} />
                    </IconButton>
                    Emoji
                  </MenuItem>
                  <MenuItem>
                    <input
                      multiple
                      type="file"
                      id="upload-img-button-mobile"
                      accept="image/*, video/*, audio/* "
                      disabled={disableOption()}
                      className={classes.uploadInput}
                      onChange={(e) => {
                        handleChangeMedias(e);
                        handleMenuItemClick();
                      }}
                    />
                    <label htmlFor="upload-img-button-mobile" style={{ display: 'flex', alignItems: 'center', width: '100%', cursor: 'pointer' }}>
                      <Fab
                        aria-label="upload-img"
                        component="span"
                        className={classes.invertedFabMenuMP}
                        disabled={disableOption()}
                      >
                        <PermMedia />
                      </Fab>
                      <span style={{ marginLeft: 8 }}>{i18n.t("messageInput.type.imageVideo")}</span>
                    </label>
                  </MenuItem>
                  <MenuItem onClick={() => {
                    handleCameraModalOpen();
                    handleMenuItemClick();
                  }}>
                    <Fab className={classes.invertedFabMenuCamera} disabled={disableOption()}>
                      <CameraAlt />
                    </Fab>
                    {i18n.t("messageInput.type.cam")}
                  </MenuItem>
                  <MenuItem>
                    <input
                      multiple
                      type="file"
                      id="upload-doc-button-mobile"
                      accept="application/*, text/*, .odt, .ods, .odp, .odg, .xml, .ofx, .zip, .rar, .7z, .tar, .gz, .bz2, .msg, .key, .numbers, .pages"
                      disabled={disableOption()}
                      className={classes.uploadInput}
                      onChange={(e) => {
                        handleChangeMedias(e);
                        handleMenuItemClick();
                      }}
                    />
                    <label htmlFor="upload-doc-button-mobile" style={{ display: 'flex', alignItems: 'center', width: '100%', cursor: 'pointer' }}>
                      <Fab
                        aria-label="upload-img"
                        component="span"
                        className={classes.invertedFabMenuDoc}
                        disabled={disableOption()}
                      >
                        <Description />
                      </Fab>
                      <span style={{ marginLeft: 8 }}>Documento</span>
                    </label>
                  </MenuItem>
                  <MenuItem onClick={() => {
                    handleSendContactModalOpen();
                    handleMenuItemClick();
                  }}>
                    <Fab className={classes.invertedFabMenuCont} disabled={disableOption()}>
                      <Person />
                    </Fab>
                    {i18n.t("messageInput.type.contact")}
                  </MenuItem>
                  <MenuItem onClick={() => {
                    handleSendLinkVideo();
                    handleMenuItemClick();
                  }}>
                    <Fab className={classes.invertedFabMenuMeet} disabled={disableOption()}>
                      <Duo />
                    </Fab>
                    {i18n.t("messageInput.type.meet")}
                  </MenuItem>
                  {useWhatsappOfficial &&
                    ticketChannel === "whatsapp_oficial" && (
                      <MenuItem onClick={() => {
                        handleSendTemplate();
                        handleMenuItemClick();
                      }}>
                        <Fab
                          className={classes.invertedFabMenuMeet}
                          style={needsTemplate ? {
                            backgroundColor: theme.palette.primary.main,
                            color: '#fff'
                          } : {}}
                        >
                          <WhatsApp />
                        </Fab>
                        {i18n.t("messageInput.type.template")}
                        {needsTemplate && <span style={{ marginLeft: 8, color: '#FF9800' }}>⚠️</span>}
                      </MenuItem>
                    )}
                  {isGroup && ticketChannel !== "whatsapp_oficial" && (
                    <MenuItem onClick={() => {
                      handleGhostMention();
                      handleMenuItemClick();
                    }}>
                      <Fab className={classes.invertedFabMenuCont} disabled={disableOption() || loading}>
                        <GroupAdd />
                      </Fab>
                      Marcação Fantasma
                    </MenuItem>
                  )}
                  {signMessagePar && (
                    <MenuItem onClick={() => {
                      handleChangeSign();
                      handleMenuItemClick();
                    }}>
                      <Tooltip title={i18n.t("messageInput.tooltip.signature")}>
                        <IconButton
                          aria-label="send-upload"
                          component="span"
                        >
                          {signMessage === true ? (
                            <Create
                              style={{
                                color:
                                  theme.mode === "light"
                                    ? theme.palette.primary.main
                                    : "#EEE",
                              }}
                            />
                          ) : (
                            <Create style={{ color: "grey" }} />
                          )}
                        </IconButton>
                      </Tooltip>
                      Assinatura
                    </MenuItem>
                  )}

                  {/* NOVO ITEM DE MENU MOBILE PARA TRIGGER FLOW */}
                  {ticketStatus === "open" && (
                    <MenuItem onClick={() => {
                      handleMenuItemClick();
                      handleTriggerFlowClick();
                    }}>
                      <IconButton
                        aria-label="trigger-flow"
                        component="span"
                      >
                        <AccountTree
                          style={{
                            color: theme.mode === "light"
                              ? theme.palette.secondary.main
                              : "#EEE"
                          }}
                        />
                      </IconButton>
                      {i18n.t("triggerFlowModal.title")}
                    </MenuItem>
                  )}

                  {/* ITEM DE MENU MOBILE PARA MENSAGEM INTERATIVA - REMOVIDO */}
                  <MenuItem onClick={() => {
                    handlePrivateMessage();
                    handleMenuItemClick();
                  }}>
                    <Tooltip title="Habilitar/Desabilitar Comentários">
                      <IconButton
                        aria-label="send-upload"
                        component="span"
                      >
                        {privateMessage === true ? (
                          <Comment
                            style={{
                              color:
                                theme.mode === "light"
                                  ? theme.palette.primary.main
                                  : "#EEE",
                            }}
                          />
                        ) : (
                          <Comment style={{ color: "grey" }} />
                        )}
                      </IconButton>
                    </Tooltip>
                    Comentários
                  </MenuItem>
                </Menu>
              </Hidden>
            )}

            {/* Emoji Picker para Mobile */}
            <Hidden only={["md", "lg", "xl"]}>
              {showEmoji && (
                <div className={classes.emojiBox} style={{
                  bottom: 63,
                  left: 0,
                  right: 0,
                  width: '100%',
                  zIndex: 9999
                }}>
                  <ClickAwayListener onClickAway={(e) => setShowEmoji(false)}>
                    <Picker
                      perLine={7}
                      theme={"dark"}
                      i18n={i18n}
                      showPreview={false}
                      showSkinTones={false}
                      onSelect={(emoji) => {
                        handleAddEmoji(emoji);
                        setShowEmoji(false);
                      }}
                      style={{ width: '100%' }}
                    />
                  </ClickAwayListener>
                </div>
              )}
            </Hidden>

            <div className={classes.flexContainer}>
              {(privateMessageInputVisible || isTicketPending()) && (
                <div className={classes.flexItem}>
                  <div className={isTicketPending() ? classes.messageInputWrapperPending : classes.messageInputWrapperPrivate}>
                    <InputBase
                      inputRef={(input) => {
                        input && input.focus();
                        input && (inputRef.current = input);
                      }}
                      className={isTicketPending() ? classes.messageInputPending : classes.messageInputPrivate}
                      placeholder={
                        isTicketPending()
                          ? "Mensagem interna (ticket aguardando aceite)..."
                          : ticketStatus === "open" || ticketStatus === "group"
                            ? i18n.t("messagesInput.placeholderPrivateMessage")
                            : i18n.t("messagesInput.placeholderClosed")
                      }
                      multiline
                      maxRows={5}
                      value={inputMessage}
                      onChange={handleChangeInput}
                      disabled={disableOptionForPending()}
                      onPaste={(e) => {
                        (ticketStatus === "open" || ticketStatus === "group" || isTicketPending()) &&
                          handleInputPaste(e);
                      }}
                      onKeyDown={handleKeyDown}
                      onKeyUp={handleKeyUp}
                      onMouseUp={handleMouseUp}
                      onSelect={handleSelectText}
                      onKeyPress={(e) => {
                        if (loading || e.shiftKey) return;
                        else if (e.key === "Enter" && !isNavigatingQuickAnswers) {
                          handleSendMessage();
                        }
                      }}
                      spellCheck={true}
                    />
                    <Tooltip title="Sugestão IA">
                      <IconButton
                        onClick={handleAiSuggestion}
                        disabled={aiLoading}
                        size="small"
                      >
                        {aiLoading ? (
                          <CircularProgress size={18} />
                        ) : (
                          <span style={{
                            fontSize: 18,
                            fontWeight: "bold",
                            color: "#7c3aed"
                          }}>
                            ✨
                          </span>
                        )}
                      </IconButton>
                    </Tooltip>
                    {renderOpportunityButton(disableOptionForPending())}
                    {typeBar ? (
                      <Box
                        component="ul"
                        className={classes.messageQuickAnswersWrapper}
                        style={{
                          marginBottom: "8px"
                        }}
                      >
                        {typeBar.map((value, index) => {
                          const isSelected = selectedQuickAnswerIndex === index;
                          return (
                            <li
                              className={classes.messageQuickAnswersWrapperItem}
                              key={index}
                              style={{ listStyle: "none" }}
                            >
                              <div
                                className={clsx(
                                  classes.quickAnswerItem,
                                  isSelected && classes.quickAnswerItemSelected
                                )}
                                style={{
                                  ...getQuickAnswerItemStyle(index),
                                  ...(isSelected && {
                                    backgroundColor: theme.palette.primary.light + "20",
                                    borderLeft: `4px solid ${theme.palette.primary.main}`,
                                    transform: "translateX(2px)"
                                  })
                                }}
                                onClick={() => handleQuickAnswersClick(value)}
                              >
                                <Box className={classes.quickAnswerText}>
                                  {value.label}
                                </Box>
                                {value.mediaType && (
                                  <Chip
                                    size="small"
                                    label={`${getMediaTypeIcon(value.mediaType)} ${value.mediaType}`}
                                    color={getMediaTypeColor(value.mediaType)}
                                    className={classes.mediaTypeChip}
                                  />
                                )}
                              </div>
                            </li>
                          );
                        })}

                        {typeBar.length > 4 && (
                          <li style={{ listStyle: "none" }}>
                            <div className={classes.quickAnswersScrollIndicator}>
                              📋 {typeBar.length} respostas • use ↑↓ para navegar
                            </div>
                          </li>
                        )}
                      </Box>
                    ) : null}
                  </div>
                </div>
              )}
              {!privateMessageInputVisible && !isTicketPending() && (
                <div className={classes.flexItem}>
                  <div className={classes.messageInputWrapper}>
                    <InputBase
                      inputRef={(input) => {
                        input && input.focus();
                        input && (inputRef.current = input);
                      }}
                      className={classes.messageInput}
                      placeholder={placeholderText}
                      multiline
                      maxRows={5}
                      value={inputMessage}
                      onChange={handleChangeInput}
                      disabled={disableOption()}
                      onPaste={(e) => {
                        (ticketStatus === "open" || ticketStatus === "group") &&
                          handleInputPaste(e);
                      }}
                      onKeyDown={handleKeyDown}
                      onKeyUp={handleKeyUp}
                      onMouseUp={handleMouseUp}
                      onSelect={handleSelectText}
                      onKeyPress={(e) => {
                        if (loading || e.shiftKey) return;

                        if (e.key === "Enter" && !isNavigatingQuickAnswers) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      spellCheck={true}
                    />
                    <Tooltip title="Sugestão IA">
                      <IconButton
                        onClick={handleAiSuggestion}
                        disabled={aiLoading}
                        size="small"
                      >
                        {aiLoading ? (
                          <CircularProgress size={18} />
                        ) : (
                          <span style={{
                            fontSize: 18,
                            fontWeight: "bold",
                            color: "#7c3aed"
                          }}>
                            ✨
                          </span>
                        )}
                      </IconButton>
                    </Tooltip>
                    {renderOpportunityButton(disableOption())}
                    {typeBar ? (
                      <ul className={classes.messageQuickAnswersWrapper}>
                        {typeBar.map((value, index) => {
                          const isSelected = selectedQuickAnswerIndex === index;
                          return (
                            <li
                              className={classes.messageQuickAnswersWrapperItem}
                              key={index}
                            >
                              <div
                                className={`${classes.quickAnswerItem} ${isSelected ? 'selected' : ''}`}
                                style={getQuickAnswerItemStyle(index)}
                                onClick={() => handleQuickAnswersClick(value)}
                              >
                                <Box className={classes.quickAnswerText}>
                                  {value.label}
                                </Box>
                                {value.mediaType && (
                                  <Chip
                                    size="small"
                                    label={`${getMediaTypeIcon(value.mediaType)} ${value.mediaType}`}
                                    color={getMediaTypeColor(value.mediaType)}
                                    className={classes.mediaTypeChip}
                                  />
                                )}
                              </div>
                            </li>
                          );
                        })}

                        {typeBar.length > 5 && (
                          <div className={classes.quickAnswersScrollIndicator}>
                            {typeBar.length} respostas • role para ver mais
                          </div>
                        )}
                      </ul>
                    ) : (
                      <div></div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {(!privateMessageInputVisible || isTicketPending()) && (
              <>
                {showSchedules && !isTicketPending() && (
                  <Tooltip title={i18n.t("tickets.buttons.scredule")}>
                    <IconButton
                      aria-label="scheduleMessage"
                      component="span"
                      onClick={() => setAppointmentModalOpen(true)}
                      disabled={loading}
                    >
                      <Timer className={classes.sendMessageIcons} />
                    </IconButton>
                  </Tooltip>
                )}
                {inputMessage || showSelectMessageCheckbox ? (
                  <>
                    <IconButton
                      aria-label="sendMessage"
                      component="span"
                      onClick={
                        showSelectMessageCheckbox
                          ? handleOpenModalForward
                          : handleSendMessage
                      }
                      disabled={loading}
                    >
                      {showSelectMessageCheckbox ? (
                        <Reply className={classes.ForwardMessageIcons} />
                      ) : (
                        <Send className={classes.sendMessageIcons} />
                      )}
                    </IconButton>
                  </>
                ) : recording ? (
                  <div className={classes.recorderWrapper}>
                    <IconButton
                      aria-label="cancelRecording"
                      component="span"
                      fontSize="large"
                      disabled={loading}
                      onClick={handleCancelAudio}
                    >
                      <HighlightOff className={classes.cancelAudioIcon} />
                    </IconButton>
                    {loading ? (
                      <div>
                        <CircularProgress className={classes.audioLoading} />
                      </div>
                    ) : (
                      <RecordingTimer />
                    )}

                    <IconButton
                      aria-label="sendRecordedAudio"
                      component="span"
                      onClick={handleUploadAudio}
                      disabled={loading}
                    >
                      <CheckCircleOutline className={classes.sendAudioIcon} />
                    </IconButton>
                  </div>
                ) : (
                  <IconButton
                    aria-label="showRecorder"
                    component="span"
                    disabled={disableOptionForPending()}
                    onClick={handleStartRecording}
                  >
                    <Mic className={classes.sendMessageIcons} />
                  </IconButton>
                )}
              </>
            )}

            {privateMessageInputVisible && !isTicketPending() && (
              <>
                <IconButton
                  aria-label="sendMessage"
                  component="span"
                  onClick={
                    showSelectMessageCheckbox
                      ? handleOpenModalForward
                      : handleSendMessage
                  }
                  disabled={loading}
                >
                  {showSelectMessageCheckbox ? (
                    <Reply className={classes.ForwardMessageIcons} />
                  ) : (
                    <Send className={classes.sendMessageIcons} />
                  )}
                </IconButton>
              </>
            )}

            {appointmentModalOpen && (
              <ScheduleModal
                open={appointmentModalOpen}
                onClose={() => setAppointmentModalOpen(false)}
                message={inputMessage}
                contactId={contactId}
                fromMessageInput={true}
                user={user}
              />
            )}

            {/* Menu de formatação que aparece quando texto é selecionado */}
            <TextFormatMenu />

          </div>
        </Paper>
      </>
    );
  }
};

export default MessageInput;
