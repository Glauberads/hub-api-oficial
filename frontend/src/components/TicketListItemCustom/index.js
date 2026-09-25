import React, {
  useState,
  useEffect,
  useRef,
  useContext,
  useCallback,
} from "react";

import { useHistory, useParams } from "react-router-dom";
import { parseISO, format, isSameDay } from "date-fns";
import clsx from "clsx";

import { makeStyles, useTheme } from "@material-ui/core/styles";
import { green, grey } from "@material-ui/core/colors";
import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import ButtonWithSpinner from "../ButtonWithSpinner";
import MarkdownWrapper from "../MarkdownWrapper";
import { List, Tooltip } from "@material-ui/core";
import { AuthContext } from "../../context/Auth/AuthContext";
import { TicketsContext } from "../../context/Tickets/TicketsContext";
import toastError from "../../errors/toastError";
import { v4 as uuidv4 } from "uuid";

import GroupIcon from "@material-ui/icons/Group";
import ContactTag from "../ContactTag";
import ConnectionIcon from "../ConnectionIcon";
import AcceptTicketWithouSelectQueue from "../AcceptTicketWithoutQueueModal";
import TransferTicketModalCustom from "../TransferTicketModalCustom";
import ShowTicketOpen from "../ShowTicketOpenModal";
import FinalizacaoVendaModal from "../FinalizacaoVendaModal";
import { isNil } from "lodash";
import { toast } from "react-toastify";
import { Done, HighlightOff, SwapHoriz, Add } from "@material-ui/icons";
import VisibilityIcon from "@material-ui/icons/Visibility";
import useCompanySettings from "../../hooks/useSettings/companySettings";
import NewTicketModal from "../NewTicketModal";
import {
  Avatar,
  Badge,
  ListItemAvatar,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  Typography,
  Dialog,
  DialogTitle,
  DialogActions,
  Button,
  DialogContent,
  CircularProgress,
} from "@material-ui/core";

const useStyles = makeStyles((theme) => {
  const isDark = theme.palette.type === "dark" || theme.palette.mode === "dark";

  return {
    ticket: {
      position: "relative",
      margin: "0 6px 10px 6px",
      padding: "10px 96px 10px 12px",
      borderRadius: 18,
      border: `1px solid ${theme.palette.divider}`,
      background: isDark ? "rgba(255,255,255,0.03)" : "#ffffff",
      boxShadow: isDark
        ? "0 6px 18px rgba(0,0,0,0.22)"
        : "0 6px 18px rgba(15, 23, 42, 0.08)",
      overflow: "hidden",
      alignItems: "center",
      transition: "all 0.2s ease",
      minHeight: 72,
      "&:hover": {
        transform: "translateY(-1px)",
        boxShadow: isDark
          ? "0 8px 22px rgba(0,0,0,0.28)"
          : "0 8px 22px rgba(15, 23, 42, 0.12)",
      },
      "&.Mui-selected": {
        background: isDark ? "rgba(16,170,98,0.10)" : "rgba(16,170,98,0.08)",
        borderColor: "#10aa62",
      },
      "&.Mui-selected:hover": {
        background: isDark ? "rgba(16,170,98,0.12)" : "rgba(16,170,98,0.10)",
      },
      [theme.breakpoints.down("sm")]: {
        padding: "9px 88px 9px 10px",
        margin: "0 4px 8px 4px",
        minHeight: 68,
      },
    },

    pendingTicket: {
      cursor: "unset",
    },

    queueTag: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#f3f4f6",
      color: "#111827",
      padding: "2px 8px",
      fontWeight: 700,
      borderRadius: 999,
      fontSize: "0.68rem",
      whiteSpace: "nowrap",
      lineHeight: 1.2,
    },

    noTicketsDiv: {
      display: "flex",
      height: "100px",
      margin: 40,
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
    },

    noTicketsText: {
      textAlign: "center",
      color: "rgb(104, 121, 146)",
      fontSize: "14px",
      lineHeight: "1.4",
    },

    noTicketsTitle: {
      textAlign: "center",
      fontSize: "16px",
      fontWeight: "600",
      margin: "0px",
    },

    avatarSection: {
      minWidth: 52,
      marginRight: 8,
      marginTop: 0,
      [theme.breakpoints.down("sm")]: {
        minWidth: 48,
        marginRight: 6,
      },
    },

    avatar: {
      width: 46,
      height: 46,
      borderRadius: "50%",
      backgroundColor: "#3f51b5",
      color: "#fff",
      fontWeight: "bold",
      fontSize: "15px",
      boxShadow: isDark
        ? "0 4px 12px rgba(0,0,0,0.24)"
        : "0 4px 12px rgba(15,23,42,0.12)",
      [theme.breakpoints.down("sm")]: {
        width: 42,
        height: 42,
        fontSize: "14px",
      },
    },

    listItemTextRoot: {
      flex: 1,
      minWidth: 0,
      width: "100%",
      margin: 0,
      paddingRight: 0,
    },

    contactNameWrapper: {
      display: "flex",
      flexDirection: "column",
      width: "100%",
      minWidth: 0,
      color: theme.palette.text.primary,
    },

    titleRow: {
      display: "flex",
      alignItems: "center",
      gap: 4,
      minWidth: 0,
      width: "100%",
    },

    titleIcons: {
      display: "inline-flex",
      alignItems: "center",
      gap: 3,
      flexShrink: 0,
    },

    connectionIcon: {
      marginRight: 0,
      flexShrink: 0,
    },

    contactNameText: {
      minWidth: 0,
      maxWidth: "100%",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      fontWeight: 700,
      color: theme.palette.text.primary,
      fontSize: "0.98rem",
      lineHeight: 1.2,
      [theme.breakpoints.down("sm")]: {
        fontSize: "0.9rem",
      },
    },

    viewIconButton: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#0f73b8",
      padding: 1,
      cursor: "pointer",
      flexShrink: 0,
    },

    secondaryWrapper: {
      display: "flex",
      flexDirection: "column",
      width: "100%",
      minWidth: 0,
      marginTop: 2,
    },

    previewRow: {
      display: "flex",
      alignItems: "center",
      width: "100%",
      minWidth: 0,
    },

    contactLastMessage: {
      flex: 1,
      minWidth: 0,
      color: isDark ? grey[400] : "#4b5563",
      fontSize: "0.84rem",
      lineHeight: 1.25,
      overflow: "hidden",
      "& p, & div, & span": {
        margin: 0,
      },
      "& *": {
        maxWidth: "100%",
      },
      [theme.breakpoints.up("md")]: {
        whiteSpace: "nowrap",
        textOverflow: "ellipsis",
        overflow: "hidden",
      },
      [theme.breakpoints.down("sm")]: {
        display: "-webkit-box",
        WebkitLineClamp: 1,
        WebkitBoxOrient: "vertical",
        whiteSpace: "normal",
        wordBreak: "break-word",
        overflow: "hidden",
      },
    },

    contactLastMessageUnread: {
      flex: 1,
      minWidth: 0,
      fontWeight: 700,
      color: theme.palette.text.primary,
      fontSize: "0.84rem",
      lineHeight: 1.25,
      overflow: "hidden",
      "& p, & div, & span": {
        margin: 0,
      },
      "& *": {
        maxWidth: "100%",
      },
      [theme.breakpoints.up("md")]: {
        whiteSpace: "nowrap",
        textOverflow: "ellipsis",
        overflow: "hidden",
      },
      [theme.breakpoints.down("sm")]: {
        display: "-webkit-box",
        WebkitLineClamp: 1,
        WebkitBoxOrient: "vertical",
        whiteSpace: "normal",
        wordBreak: "break-word",
        overflow: "hidden",
      },
    },

    infoChipsRow: {
      display: "flex",
      flexWrap: "wrap",
      gap: 4,
      marginTop: 5,
      alignItems: "center",
    },

    connectionTag: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#FFF",
      padding: "1px 7px",
      fontWeight: 700,
      borderRadius: 999,
      fontSize: "0.63rem",
      lineHeight: 1.15,
      whiteSpace: "nowrap",
      boxShadow: isDark
        ? "0 3px 8px rgba(0,0,0,0.18)"
        : "0 3px 8px rgba(15,23,42,0.06)",
    },

    tagsRow: {
      display: "flex",
      flexWrap: "wrap",
      gap: 4,
      marginTop: 4,
      alignItems: "center",
    },

    newMessagesCount: {
      display: "none",
    },

    badgeStyle: {
      color: "white",
      backgroundColor: green[500],
    },

    acceptButton: {
      position: "absolute",
      right: "1px",
    },

    ticketQueueColor: {
      width: 5,
      height: "calc(100% - 12px)",
      position: "absolute",
      top: 6,
      left: 0,
      borderRadius: "0 999px 999px 0",
      flex: "none",
    },

    ticketInfo: {
      position: "relative",
      top: -13,
    },

    ticketInfo1: {
      position: "relative",
      top: 13,
      right: 0,
    },

    secondaryContentSecond: {
      display: "flex",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 4,
      width: "100%",
    },

    Radiusdot: {
      "& .MuiBadge-badge": {
        borderRadius: 2,
        position: "inherit",
        height: 16,
        margin: 2,
        padding: 3,
      },
      "& .MuiBadge-anchorOriginTopRightRectangle": {
        transform: "scale(1) translate(0%, -40%)",
      },
    },

    timeBlock: {
      position: "absolute",
      top: 10,
      right: 12,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minWidth: 54,
      zIndex: 2,
      [theme.breakpoints.down("sm")]: {
        top: 8,
        right: 10,
      },
    },

    rightColumn: {
      position: "absolute",
      right: 10,
      top: "50%",
      transform: "translateY(-50%)",
      width: 70,
      minWidth: 70,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 2,
      [theme.breakpoints.down("sm")]: {
        width: 64,
        minWidth: 64,
        right: 8,
      },
    },

    lastMessageTime: {
      color: isDark ? grey[300] : "#6b7280",
      fontWeight: 700,
      fontSize: "0.8rem",
      lineHeight: 1,
      whiteSpace: "nowrap",
      textAlign: "center",
    },

    lastMessageTimeUnread: {
      color: "#10aa62",
      fontWeight: 800,
      fontSize: "0.8rem",
      lineHeight: 1,
      whiteSpace: "nowrap",
      textAlign: "center",
    },

    unreadBubble: {
      minWidth: 28,
      height: 28,
      padding: "0 7px",
      borderRadius: 14,
      backgroundColor: green[500],
      color: "#fff",
      fontWeight: 800,
      fontSize: "0.82rem",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 6,
      boxSizing: "border-box",
      boxShadow: isDark
        ? "0 4px 10px rgba(16,170,98,0.24)"
        : "0 4px 10px rgba(16,170,98,0.20)",
    },

    unreadBubbleHidden: {
      height: 0,
      marginBottom: 0,
    },

    actionsRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      width: "100%",
      flexWrap: "nowrap",
    },

    actionButtonBase: {
      minWidth: 30,
      width: 30,
      height: 30,
      padding: 0,
      borderRadius: "50%",
      border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e5e7eb",
      boxShadow: isDark
        ? "0 3px 8px rgba(0,0,0,0.18)"
        : "0 3px 8px rgba(15,23,42,0.06)",
      backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "#fff",
      "&:hover": {
        backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#f9fafb",
      },
    },

    actionAccept: {
      color: "#16a34a",
    },

    actionTransfer: {
      color: "#0f73b8",
    },

    actionClose: {
      color: "#dc2626",
    },

    actionSpy: {
      color: "#0f73b8",
    },

    actionNew: {
      color: "#16a34a",
    },

    imageModal: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },

    imageModalContent: {
      outline: "none",
      maxWidth: "90vw",
      maxHeight: "90vh",
    },

    expandedImage: {
      width: "100%",
      height: "auto",
      maxWidth: "500px",
      borderRadius: theme.spacing(1),
    },

    clickableAvatar: {
      cursor: "pointer",
      "&:hover": {
        opacity: 0.85,
      },
    },
  };
});

const TicketListItemCustom = ({ setTabOpen, ticket }) => {
  const classes = useStyles();
  const theme = useTheme();
  const history = useHistory();
  const [loading, setLoading] = useState(false);
  const [
    acceptTicketWithouSelectQueueOpen,
    setAcceptTicketWithouSelectQueueOpen,
  ] = useState(false);
  const [transferTicketModalOpen, setTransferTicketModalOpen] = useState(false);
  const [newTicketModalOpen, setNewTicketModalOpen] = useState(false);

  const [openAlert, setOpenAlert] = useState(false);
  const [userTicketOpen, setUserTicketOpen] = useState("");
  const [queueTicketOpen, setQueueTicketOpen] = useState("");

  const [openFinalizacaoVenda, setOpenFinalizacaoVenda] = useState(false);
  const [finalizacaoTipo, setFinalizacaoTipo] = useState(null);
  const [ticketDataToFinalize, setTicketDataToFinalize] = useState(null);
  const [showFinalizacaoOptions, setShowFinalizacaoOptions] = useState(false);

  const [imageModalOpen, setImageModalOpen] = useState(false);

  // Estados adicionados para a janela modal de visualização (Espiar)
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewMessages, setViewMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const { ticketId } = useParams();

  const getContactAvatarUrl = useCallback((contact) => {
    const profilePicUrl = String(contact?.profilePicUrl || "").trim();
    const urlPicture = String(contact?.urlPicture || "").trim();

    const value =
      profilePicUrl && !profilePicUrl.includes("nopicture")
        ? profilePicUrl
        : urlPicture;

    if (!value || value === "null" || value === "undefined") {
      return "";
    }

    return value;
  }, []);

  const contactAvatarUrl = getContactAvatarUrl(ticket?.contact);

  const normalizeTicketColor = useCallback((color, fallback = "#7c7c7c") => {
    const value = String(color || "").trim();

    if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(value)) {
      return value;
    }

    return fallback;
  }, []);

  const getTicketConnectionColor = useCallback((ticketData) => {
    const customColor = normalizeTicketColor(ticketData?.whatsapp?.color, "");

    if (customColor) {
      return customColor;
    }

    switch (ticketData?.channel) {
      case "whatsapp":
        return "#25D366";
      case "telegram":
        return "#229ED9";
      case "facebook":
        return "#4267B2";
      case "instagram":
        return "#E1306C";
      case "whatsapp_oficial":
        return "#075E54";
      default:
        return "#10aa62";
    }
  }, [normalizeTicketColor]);

  const connectionColor = getTicketConnectionColor(ticket);
  const queueColor = normalizeTicketColor(ticket?.queue?.color, "#7c7c7c");


  const isMounted = useRef(true);
  const { setCurrentTicket } = useContext(TicketsContext);
  const { user } = useContext(AuthContext);

  const { get: getSetting } = useCompanySettings();

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleImageClick = (e) => {
    e.stopPropagation();
    if (contactAvatarUrl) {
      setImageModalOpen(true);
    }
  };

  const handleImageModalClose = () => {
    setImageModalOpen(false);
  };

  const handleOpenAcceptTicketWithouSelectQueue = useCallback(() => {
    setAcceptTicketWithouSelectQueueOpen(true);
  }, []);

  const handleCloseTicket = async (id) => {
    if (
      user.finalizacaoComValorVendaAtiva === true ||
      user.finalizacaoComValorVendaAtiva === "true"
    ) {
      setFinalizacaoTipo("comDespedida");
      setOpenFinalizacaoVenda(true);
      handleSelectTicket(ticket);
      history.push(`/tickets/${ticket.uuid}`);
    } else {
      const setting = await getSetting({
        column: "requiredTag",
      });

      if (setting.requiredTag === "enabled") {
        try {
          const contactTags = await api.get(
            `/contactTags/${ticket.contact.id}`
          );
          if (!contactTags.data.tags) {
            toast.warning(i18n.t("messagesList.header.buttons.requiredTag"));
          } else {
            await api.put(`/tickets/${id}`, {
              status: "closed",
              userId: user?.id || null,
            });

            if (isMounted.current) {
              setLoading(false);
            }

            history.push(`/tickets/`);
          }
        } catch (err) {
          setLoading(false);
          toastError(err);
        }
      } else {
        setLoading(true);
        try {
          await api.put(`/tickets/${id}`, {
            status: "closed",
            userId: user?.id || null,
          });
        } catch (err) {
          setLoading(false);
          toastError(err);
        }
        if (isMounted.current) {
          setLoading(false);
        }

        history.push(`/tickets/`);
      }
    }
  };

  const handleCloseIgnoreTicket = async (id) => {
    setLoading(true);
    try {
      await api.put(`/tickets/${id}`, {
        status: "closed",
        userId: user?.id || null,
        sendFarewellMessage: false,
        amountUsedBotQueues: 0,
      });
    } catch (err) {
      setLoading(false);
      toastError(err);
    }
    if (isMounted.current) {
      setLoading(false);
    }

    history.push(`/tickets/`);
  };

  const truncate = (str, len) => {
    if (!isNil(str)) {
      if (str.length > len) {
        return str.substring(0, len) + "...";
      }
      return str;
    }
  };

  const handleCloseTransferTicketModal = useCallback(() => {
    if (isMounted.current) {
      setTransferTicketModalOpen(false);
    }
  }, []);

  const handleOpenTransferModal = (e) => {
    if (e) e.stopPropagation();
    setLoading(true);
    setTransferTicketModalOpen(true);
    if (isMounted.current) {
      setLoading(false);
    }
    handleSelectTicket(ticket);
    history.push(`/tickets/${ticket.uuid}`);
  };

  const handleOpenNewTicketModal = (e) => {
    if (e) e.stopPropagation();
    setNewTicketModalOpen(true);
  };

  const handleCloseNewTicketModal = (newTicket) => {
    setNewTicketModalOpen(false);
    if (newTicket) {
      handleSelectTicket(newTicket);
      history.push(`/tickets/${newTicket.uuid}`);
    }
  };

  const handleAcepptTicket = async (id) => {
    setLoading(true);
    try {
      const otherTicket = await api.put(`/tickets/${id}`, {
        status:
          ticket.isGroup && ticket.channel === "whatsapp" ? "group" : "open",
        userId: user?.id,
      });

      if (otherTicket.data.id !== ticket.id) {
        if (otherTicket.data.userId !== user?.id) {
          setOpenAlert(true);
          setUserTicketOpen(otherTicket.data.user.name);
          setQueueTicketOpen(otherTicket.data.queue.name);
        } else {
          setLoading(false);
          setTabOpen(ticket.isGroup ? "group" : "open");
          handleSelectTicket(otherTicket.data);
          history.push(`/tickets/${otherTicket.uuid}`);
        }
      } else {
        let setting;

        try {
          setting = await getSetting({
            column: "sendGreetingAccepted",
          });
        } catch (err) {
          toastError(err);
        }

        if (
          setting.sendGreetingAccepted === "enabled" &&
          (!ticket.isGroup || ticket.whatsapp?.groupAsTicket === "enabled")
        ) {
          handleSendMessage(ticket.id);
        }
        if (isMounted.current) {
          setLoading(false);
        }

        setTabOpen(ticket.isGroup ? "group" : "open");
        handleSelectTicket(ticket);
        history.push(`/tickets/${ticket.uuid}`);
      }
    } catch (err) {
      setLoading(false);
      toastError(err);
    }
  };

  const handleSendMessage = async (id) => {
    let setting;

    try {
      setting = await getSetting({
        column: "greetingAcceptedMessage",
      });
    } catch (err) {
      toastError(err);
    }
    if (!setting.greetingAcceptedMessage) {
      toast.warning(
        i18n.t("messagesList.header.buttons.greetingAcceptedMessage")
      );
      return;
    }
    const msg = `${setting.greetingAcceptedMessage}`;
    const message = {
      read: 1,
      fromMe: true,
      mediaUrl: "",
      body: `${msg.trim()}`,
    };
    try {
      await api.post(`/messages/${id}`, message);
    } catch (err) {
      toastError(err);
    }
  };

  const handleCloseAlert = useCallback(() => {
    setOpenAlert(false);
    setLoading(false);
  }, []);

  const handleSelectTicket = (ticket) => {
    const code = uuidv4();
    const { id, uuid } = ticket;
    setCurrentTicket({ id, uuid, code });
  };

  const handleUpdateTicketStatusWithData = async (
    ticketData,
    sendFarewellMessage,
    finalizacaoMessage
  ) => {
    try {
      await api.put(`/tickets/${ticket.id}`, {
        ...ticketData,
        sendFarewellMessage,
        finalizacaoMessage,
      });
      toast.success("Ticket finalizado com sucesso!");
      history.push(`/tickets/`);
    } catch (err) {
      toastError(err);
    }
  };

  // FUNÇÃO CORRIGIDA PARA ABRIR O MODAL DE VISUALIZAR CONVERSA
  const handleOpenConversation = async (e) => {
    if (e) e.stopPropagation();

    // Em vez de navegar para a rota do ticket (history.push), 
    // abrimos um modal próprio e carregamos as mensagens.
    setViewModalOpen(true);
    setLoadingMessages(true);
    
    try {
      const { data } = await api.get(`/messages/${ticket.id}`);
      // Ajuste conforme o formato de retorno da sua API 
      // (geralmente data.messages ou o próprio data)
      setViewMessages(data?.messages || data || []);
    } catch (err) {
      toastError(err);
    } finally {
      if (isMounted.current) {
        setLoadingMessages(false);
      }
    }
  };

  const shouldBlurMessages =
    ticket.status === "pending" &&
    user?.allowSeeMessagesInPendingTickets === "disabled";

  const renderLastMessage = () => {
    if (shouldBlurMessages) {
      return (
        <MarkdownWrapper>
          {i18n.t("tickets.messageHidden") || "Mensagem oculta"}
        </MarkdownWrapper>
      );
    }

    if (!ticket.lastMessage) {
      return <br />;
    }

    if (ticket.lastMessage.includes("data:image/png;base64")) {
      return <MarkdownWrapper>{i18n.t("mainDrawer.appBar.message.location")}</MarkdownWrapper>;
    }

    if (ticket.lastMessage.includes("BEGIN:VCARD")) {
      return <MarkdownWrapper>{i18n.t("wallets.contact")}</MarkdownWrapper>;
    }

    return (
      <MarkdownWrapper>
        {truncate(ticket.lastMessage, 55)}
      </MarkdownWrapper>
    );
  };

  const formattedUpdatedAt = ticket.lastMessage
    ? isSameDay(parseISO(ticket.updatedAt), new Date())
      ? format(parseISO(ticket.updatedAt), "HH:mm")
      : format(parseISO(ticket.updatedAt), "dd/MM/yyyy")
    : "";

  const renderActionButtons = () => {
    if (ticket.status === "chatbot") {
      return (
        <ButtonWithSpinner
          variant="contained"
          className={clsx(classes.actionButtonBase, classes.actionSpy)}
          size="small"
          loading={loading}
          onClick={handleOpenConversation}
        >
          <Tooltip title="Abrir conversa">
            <VisibilityIcon fontSize="small" />
          </Tooltip>
        </ButtonWithSpinner>
      );
    }

    return (
      <>
        {ticket.status === "pending" &&
          (ticket.queueId === null || ticket.queueId === undefined) && (
            <ButtonWithSpinner
              variant="contained"
              className={clsx(classes.actionButtonBase, classes.actionAccept)}
              size="small"
              loading={loading}
              onClick={(e) => {
                e.stopPropagation();
                handleOpenAcceptTicketWithouSelectQueue();
              }}
            >
              <Tooltip title={`${i18n.t("ticketsList.buttons.accept")}`}>
                <Done fontSize="small" />
              </Tooltip>
            </ButtonWithSpinner>
          )}

        {ticket.status === "pending" && ticket.queueId !== null && (
          <ButtonWithSpinner
            variant="contained"
            className={clsx(classes.actionButtonBase, classes.actionAccept)}
            size="small"
            loading={loading}
            onClick={(e) => {
              e.stopPropagation();
              handleAcepptTicket(ticket.id);
            }}
          >
            <Tooltip title={`${i18n.t("ticketsList.buttons.accept")}`}>
              <Done fontSize="small" />
            </Tooltip>
          </ButtonWithSpinner>
        )}

        {(ticket.status === "pending" ||
          ticket.status === "open" ||
          ticket.status === "group") && (
            <ButtonWithSpinner
              variant="contained"
              className={clsx(classes.actionButtonBase, classes.actionTransfer)}
              size="small"
              loading={loading}
              onClick={(e) => handleOpenTransferModal(e)}
            >
              <Tooltip title={`${i18n.t("ticketsList.buttons.transfer")}`}>
                <SwapHoriz fontSize="small" />
              </Tooltip>
            </ButtonWithSpinner>
          )}

        {(ticket.status === "open" || ticket.status === "group") && (
          <ButtonWithSpinner
            variant="contained"
            className={clsx(classes.actionButtonBase, classes.actionClose)}
            size="small"
            loading={loading}
            onClick={(e) => {
              e.stopPropagation();
              handleCloseTicket(ticket.id);
            }}
          >
            <Tooltip title={`${i18n.t("ticketsList.buttons.closed")}`}>
              <HighlightOff fontSize="small" />
            </Tooltip>
          </ButtonWithSpinner>
        )}

        {(ticket.status === "pending" || ticket.status === "lgpd") &&
          (user.userClosePendingTicket === "enabled" ||
            user.profile === "admin") && (
            <ButtonWithSpinner
              variant="contained"
              className={clsx(classes.actionButtonBase, classes.actionClose)}
              size="small"
              loading={loading}
              onClick={(e) => {
                e.stopPropagation();
                handleCloseIgnoreTicket(ticket.id);
              }}
            >
              <Tooltip title={`${i18n.t("ticketsList.buttons.ignore")}`}>
                <HighlightOff fontSize="small" />
              </Tooltip>
            </ButtonWithSpinner>
          )}

        {ticket.status === "closed" && (
          <ButtonWithSpinner
            variant="contained"
            className={clsx(classes.actionButtonBase, classes.actionNew)}
            size="small"
            loading={loading}
            onClick={(e) => {
              e.stopPropagation();
              handleOpenNewTicketModal(e);
            }}
          >
            <Tooltip title="Criar Novo Ticket">
              <Add fontSize="small" />
            </Tooltip>
          </ButtonWithSpinner>
        )}
      </>
    );
  };

  return (
    <React.Fragment key={ticket.id}>
      {openAlert && (
        <ShowTicketOpen
          isOpen={openAlert}
          handleClose={handleCloseAlert}
          user={userTicketOpen}
          queue={queueTicketOpen}
        />
      )}

      {acceptTicketWithouSelectQueueOpen && (
        <AcceptTicketWithouSelectQueue
          modalOpen={acceptTicketWithouSelectQueueOpen}
          onClose={(e) => setAcceptTicketWithouSelectQueueOpen(false)}
          ticketId={ticket.id}
          ticket={ticket}
        />
      )}

      {transferTicketModalOpen && (
        <TransferTicketModalCustom
          modalOpen={transferTicketModalOpen}
          onClose={handleCloseTransferTicketModal}
          ticketid={ticket.id}
          ticket={ticket}
        />
      )}

      {newTicketModalOpen && (
        <NewTicketModal
          modalOpen={newTicketModalOpen}
          onClose={handleCloseNewTicketModal}
          initialContact={ticket.contact}
        />
      )}

      {/* NOVO MODAL: Visualizar Conversa Internamente */}
      <Dialog
        open={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ style: { minHeight: "40vh", maxHeight: "80vh" } }}
      >
        <DialogTitle>Conversa: {ticket.contact?.name || "Contato"}</DialogTitle>
        <DialogContent 
          dividers 
          style={{ 
            backgroundColor: theme.palette.type === 'dark' ? '#1e1e1e' : '#e5ddd5', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '8px' 
          }}
        >
          {loadingMessages ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "20px" }}>
              <CircularProgress size={24} />
              <Typography style={{ marginLeft: 10 }}>Carregando histórico...</Typography>
            </div>
          ) : viewMessages.length === 0 ? (
            <Typography align="center" style={{ marginTop: 20 }}>
              Nenhuma mensagem encontrada.
            </Typography>
          ) : (
            viewMessages.map((m) => {
              const isDark = theme.palette.type === "dark" || theme.palette.mode === "dark";
              return (
                <div 
                  key={m.id} 
                  style={{ 
                    alignSelf: m.fromMe ? "flex-end" : "flex-start", 
                    maxWidth: "80%", 
                    marginBottom: "8px" 
                  }}
                >
                  <div style={{
                    backgroundColor: m.fromMe ? (isDark ? "#056162" : "#dcf8c6") : (isDark ? "#262d31" : "#fff"),
                    color: isDark ? "#fff" : "#303030",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    boxShadow: "0 1px 1px rgba(0,0,0,0.1)"
                  }}>
                    <MarkdownWrapper>{m.body}</MarkdownWrapper>
                  </div>
                </div>
              );
            })
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewModalOpen(false)} color="primary">
            {i18n.t("campaigns.settings.close")}
          </Button>
        </DialogActions>
      </Dialog>

      <ListItem
        button
        dense
        onClick={(e) => {
          const isCheckboxClicked =
            (e.target.tagName.toLowerCase() === "input" &&
              e.target.type === "checkbox") ||
            (e.target.tagName.toLowerCase() === "svg" &&
              e.target.type === undefined) ||
            (e.target.tagName.toLowerCase() === "path" &&
              e.target.type === undefined);

          if (isCheckboxClicked) return;

          handleSelectTicket(ticket);
        }}
        selected={ticketId && ticketId === ticket.uuid}
        className={clsx(classes.ticket, {
          [classes.pendingTicket]: ticket.status === "pending",
        })}
      >
        <span
          style={{
            backgroundColor: connectionColor,
          }}
          className={classes.ticketQueueColor}
        />

        {ticket.lastMessage && (
          <div className={classes.timeBlock}>
            <Typography
              className={
                Number(ticket.unreadMessages) > 0
                  ? classes.lastMessageTimeUnread
                  : classes.lastMessageTime
              }
              component="span"
              variant="body2"
            >
              {formattedUpdatedAt}
            </Typography>
          </div>
        )}

        <ListItemAvatar className={classes.avatarSection}>
          <Avatar
            className={clsx(classes.avatar, classes.clickableAvatar)}
            src={contactAvatarUrl}
            onClick={handleImageClick}
          >
            {!contactAvatarUrl && ticket?.contact?.name
              ? ticket.contact.name
                  .trim()
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((w) => w[0]?.toUpperCase())
                  .join("")
              : null}
          </Avatar>
        </ListItemAvatar>

        <ListItemText
          disableTypography
          classes={{ root: classes.listItemTextRoot }}
          primary={
            <div className={classes.contactNameWrapper}>
              <div className={classes.titleRow}>
                <span className={classes.titleIcons}>
                  {ticket.isGroup && ticket.channel === "whatsapp" && (
                    <GroupIcon
                      fontSize="small"
                      style={{ color: grey[700], marginBottom: -1 }}
                    />
                  )}

                  {ticket.channel && (
                    <ConnectionIcon
                      width="17"
                      height="17"
                      className={classes.connectionIcon}
                      connectionType={ticket.channel}
                    />
                  )}
                </span>

                <Typography
                  noWrap
                  component="span"
                  variant="body2"
                  className={classes.contactNameText}
                >
                  {truncate(ticket.contact?.name, 42)}
                </Typography>

                {(ticket.status === "open" ||
                  ticket.status === "group" ||
                  ticket.status === "chatbot") && (
                  <Tooltip title="Abrir conversa">
                    <span
                      className={classes.viewIconButton}
                      onClick={handleOpenConversation}
                    >
                      <VisibilityIcon fontSize="small" />
                    </span>
                  </Tooltip>
                )}
              </div>
            </div>
          }
          secondary={
            <div className={classes.secondaryWrapper}>
              <div className={classes.previewRow}>
                <Typography
                  className={
                    Number(ticket.unreadMessages) > 0
                      ? classes.contactLastMessageUnread
                      : classes.contactLastMessage
                  }
                  component="span"
                  variant="body2"
                >
                  {renderLastMessage()}
                </Typography>
              </div>

              <div className={classes.infoChipsRow}>
                {ticket?.whatsapp ? (
                  <span
                    className={classes.connectionTag}
                    style={{
                      backgroundColor: connectionColor,
                    }}
                  >
                    {ticket.whatsapp?.name?.toUpperCase()}
                  </span>
                ) : null}

                <span
                  className={classes.connectionTag}
                  style={{
                    backgroundColor: queueColor,
                  }}
                >
                  {ticket.queueId
                    ? ticket.queue?.name?.toUpperCase()
                    : ticket.status === "lgpd"
                    ? i18n.t("settings.settings.LGPD.title")
                    : `${i18n.t("momentsUser.noqueue")}`}
                </span>

                {ticket?.user && (
                  <span
                    className={classes.connectionTag}
                    style={{ backgroundColor: "#111827" }}
                  >
                    {ticket.user?.name?.toUpperCase()}
                  </span>
                )}
              </div>

              {ticket?.contact?.tags?.length > 0 && (
                <div className={classes.tagsRow}>
                  {ticket?.contact?.tags?.map((tag) => {
                    return (
                      <ContactTag
                        tag={tag}
                        key={`ticket-contact-tag-${ticket.id}-${tag.id}`}
                      />
                    );
                  })}
                </div>
              )}

              {ticket.tags?.length > 0 && (
                <div className={classes.tagsRow}>
                  {ticket.tags?.map((tag) => {
                    return (
                      <ContactTag
                        tag={tag}
                        key={`ticket-contact-tag-${ticket.id}-${tag.id}`}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          }
        />

        <div className={classes.rightColumn}>
          {Number(ticket.unreadMessages) > 0 ? (
            <div className={classes.unreadBubble}>
              {shouldBlurMessages ? "?" : ticket.unreadMessages}
            </div>
          ) : (
            <div className={classes.unreadBubbleHidden} />
          )}

          <div className={classes.actionsRow}>{renderActionButtons()}</div>
        </div>
      </ListItem>

      {openFinalizacaoVenda && (
        <FinalizacaoVendaModal
          open={openFinalizacaoVenda}
          onClose={() => setOpenFinalizacaoVenda(false)}
          ticket={ticket}
          onFinalizar={(ticketData) => {
            setOpenFinalizacaoVenda(false);
            setTicketDataToFinalize(ticketData);
            setShowFinalizacaoOptions(true);
          }}
        />
      )}

      {showFinalizacaoOptions && (
        <Dialog
          open={showFinalizacaoOptions}
          onClose={() => setShowFinalizacaoOptions(false)}
          aria-labelledby="finalizacao-options-title"
        >
          <DialogTitle id="finalizacao-options-title">
            Como deseja finalizar?
          </DialogTitle>
          <DialogActions>
            <Button
              onClick={async () => {
                setShowFinalizacaoOptions(false);
                await handleUpdateTicketStatusWithData(
                  ticketDataToFinalize,
                  false,
                  null
                );
              }}
              style={{ background: theme.palette.primary.main, color: "white" }}
            >
              {i18n.t("messagesList.header.dialogRatingWithoutFarewellMsg")}
            </Button>
            <Button
              onClick={async () => {
                setShowFinalizacaoOptions(false);
                await handleUpdateTicketStatusWithData(
                  ticketDataToFinalize,
                  true,
                  null
                );
              }}
              style={{ background: theme.palette.primary.main, color: "white" }}
            >
              {i18n.t("messagesList.header.dialogRatingCancel")}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      <Dialog
        open={imageModalOpen}
        onClose={handleImageModalClose}
        className={classes.imageModal}
        maxWidth="md"
        fullWidth
      >
        <DialogContent className={classes.imageModalContent}>
          <img
            src={contactAvatarUrl}
            alt={ticket?.contact?.name || "Foto do contato"}
            className={classes.expandedImage}
          />
        </DialogContent>
      </Dialog>
    </React.Fragment>
  );
};

export default TicketListItemCustom;