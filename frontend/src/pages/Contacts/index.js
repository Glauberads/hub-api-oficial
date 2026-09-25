// src/pages/Contacts/index.js (versão corrigida)
import React, {
  useState,
  useEffect,
  useReducer,
  useContext,
  useRef,
} from "react";
import { toast } from "react-toastify";
import { useHistory } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";
import Avatar from "@material-ui/core/Avatar";
import { getContactAvatarUrl } from "../../utils/getContactAvatarUrl";
import Dialog from "@material-ui/core/Dialog";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import { Facebook, Instagram, WhatsApp, Close, Sync, SyncDisabled, CheckCircle as SyncDone, CloudOff } from "@material-ui/icons";
import Select from "@material-ui/core/Select";
import ListItemText from "@material-ui/core/ListItemText";
import Chip from "@material-ui/core/Chip";
import Box from "@material-ui/core/Box";
import LinearProgress from "@material-ui/core/LinearProgress";
import CircularProgress from "@material-ui/core/CircularProgress";
import DialogActions from "@material-ui/core/DialogActions";
import Backdrop from "@material-ui/core/Backdrop";
import SearchIcon from "@material-ui/icons/Search";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";
import IconButton from "@material-ui/core/IconButton";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import CancelIcon from "@material-ui/icons/Cancel";
import BlockIcon from "@material-ui/icons/Block";
import Checkbox from "@material-ui/core/Checkbox";
import Toolbar from "@material-ui/core/Toolbar";
import Typography from "@material-ui/core/Typography";
import Tooltip from "@material-ui/core/Tooltip";
import { alpha } from "@material-ui/core/styles";

import api from "../../services/api";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import ContactModal from "../../components/ContactModal";
import ConfirmationModal from "../../components/ConfirmationModal/";
import ContactDeleteConfirmModal from "../../components/ContactDeleteConfirmModal";

import { i18n } from "../../translate/i18n";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import MainContainer from "../../components/MainContainer";
import toastError from "../../errors/toastError";
import ForbiddenPage from "../../components/ForbiddenPage";

import { AuthContext } from "../../context/Auth/AuthContext";
import { Can } from "../../components/Can";
import NewTicketModal from "../../components/NewTicketModal";
import NewTicketOficialModal from "../../components/NewTicketOficialModal";
import { TagsFilter } from "../../components/TagsFilter";
import PopupState, { bindTrigger, bindMenu } from "material-ui-popup-state";
import formatSerializedId from "../../utils/formatSerializedId";
import { v4 as uuidv4 } from "uuid";

import { ArrowDropDown, Backup, ContactPhone, DeleteSweep } from "@material-ui/icons";
import { Menu, MenuItem } from "@material-ui/core";

import ContactImportWpModal from "../../components/ContactImportWpModal";
import useCompanySettings from "../../hooks/useSettings/companySettings";
import usePlans from "../../hooks/usePlans";
import { TicketsContext } from "../../context/Tickets/TicketsContext";

const reducer = (state, action) => {
  if (action.type === "LOAD_CONTACTS") {
    const contacts = action.payload;
    const newContacts = [];

    contacts.forEach((contact) => {
      const contactIndex = state.findIndex((c) => c.id === contact.id);
      if (contactIndex !== -1) {
        state[contactIndex] = contact;
      } else {
        newContacts.push(contact);
      }
    });

    return [...state, ...newContacts];
  }

  if (action.type === "UPDATE_CONTACTS") {
    const contact = action.payload;
    const contactIndex = state.findIndex((c) => c.id === contact.id);

    if (contactIndex !== -1) {
      state[contactIndex] = contact;
      return [...state];
    } else {
      return [contact, ...state];
    }
  }

  if (action.type === "DELETE_CONTACT") {
    const contactId = action.payload;
    const contactIndex = state.findIndex((c) => c.id === contactId);
    if (contactIndex !== -1) {
      state.splice(contactIndex, 1);
    }
    return [...state];
  }

  if (action.type === "BULK_DELETE_CONTACTS") {
    const contactIds = action.payload;
    return state.filter(contact => !contactIds.includes(contact.id));
  }

  if (action.type === "DELETE_ALL_CONTACTS") {
    const { excludeIds = [] } = action.payload;
    return state.filter(contact => excludeIds.includes(contact.id));
  }

  if (action.type === "RESET") {
    return [];
  }

  if (action.type === "SET_TOTAL_COUNT") {
    return state;
  }
};

const useStyles = makeStyles((theme) => ({
  mainContainer: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1.5),
  },
  mainPaper: {
    flex: 1,
    overflow: "hidden",
    borderRadius: 16,
    border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.05)",
    background: theme.palette.background.paper,
  },
  tableWrapper: {
    overflowY: "auto",
    overflowX: "auto",
    maxHeight: "calc(100vh - 260px)",
    ...theme.scrollbarStyles,
  },
  avatarCell: {
    width: "72px",
    padding: theme.spacing(1.25, 1),
  },
  idCell: {
    width: "80px",
  },
  checkboxCell: {
    width: "52px",
    padding: theme.spacing(0, 1),
  },
  clickableAvatar: {
    cursor: "pointer",
    width: 40,
    height: 40,
    transition: "all 0.2s ease-in-out",
    boxShadow: "0 4px 14px rgba(0,0,0,0.08)",
    "&:hover": {
      transform: "scale(1.08)",
      boxShadow: "0 6px 18px rgba(0,0,0,0.14)",
    },
  },
  imageDialog: {
    "& .MuiDialog-paper": {
      maxWidth: "500px",
      maxHeight: "500px",
      borderRadius: 16,
    },
  },
  dialogTitle: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: theme.spacing(1),
  },
  profileImage: {
    width: "100%",
    height: "auto",
    maxWidth: "400px",
    maxHeight: "400px",
    objectFit: "contain",
    borderRadius: 12,
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: theme.spacing(1.25),
    width: "100%",
  },
  searchField: {
    minWidth: 260,
    background: theme.palette.background.paper,
    borderRadius: 12,
    "& .MuiOutlinedInput-root": {
      height: 44,
      borderRadius: 12,
      background: theme.palette.background.paper,
    },
  },
  toolbar: {
    padding: theme.spacing(1.25, 2),
    backgroundColor: alpha(theme.palette.primary.main, 0.06),
    minHeight: 56,
    borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
  },
  toolbarHighlight: {
    backgroundColor: alpha(theme.palette.primary.main, 0.09),
  },
  toolbarTitle: {
    flex: "1 1 100%",
    fontWeight: 600,
    fontSize: 14,
  },
  bulkActions: {
    display: "flex",
    gap: theme.spacing(1),
    alignItems: "center",
  },
  syncBanner: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.25, 1.5),
    borderRadius: 14,
    marginBottom: theme.spacing(0.5),
    border: "1px solid transparent",
  },
  syncReady: {
    backgroundColor: alpha(theme.palette.success?.main || "#4caf50", 0.08),
    border: `1px solid ${alpha(theme.palette.success?.main || "#4caf50", 0.18)}`,
    color: theme.palette.success?.dark || "#2e7d32",
  },
  syncSyncing: {
    backgroundColor: alpha(theme.palette.warning?.main || "#ff9800", 0.08),
    border: `1px solid ${alpha(theme.palette.warning?.main || "#ff9800", 0.18)}`,
    color: theme.palette.warning?.dark || "#e65100",
  },
  syncError: {
    backgroundColor: alpha(theme.palette.error?.main || "#f44336", 0.08),
    border: `1px solid ${alpha(theme.palette.error?.main || "#f44336", 0.18)}`,
    color: theme.palette.error?.dark || "#c62828",
  },
  syncContent: {
    flex: 1,
    minWidth: 0,
  },
  syncIcon: {
    animation: "$spin 1.5s linear infinite",
  },
  titleRow: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: theme.spacing(1),
  },
  titleChip: {
    height: 28,
    borderRadius: 999,
    fontWeight: 600,
    background: alpha(theme.palette.primary.main, 0.08),
    color: theme.palette.primary.main,
  },
  selectedChip: {
    height: 28,
    borderRadius: 999,
    fontWeight: 600,
    background: alpha(theme.palette.secondary.main, 0.08),
    color: theme.palette.secondary.main,
  },
  primaryButton: {
    height: 42,
    borderRadius: 12,
    textTransform: "none",
    fontWeight: 600,
    boxShadow: "none",
  },
  addButton: {
    height: 42,
    borderRadius: 12,
    textTransform: "none",
    fontWeight: 700,
    boxShadow: "none",
    paddingLeft: theme.spacing(2),
    paddingRight: theme.spacing(2),
  },
  headCell: {
    fontSize: 12,
    fontWeight: 700,
    color: alpha(theme.palette.text.primary, 0.72),
    textTransform: "uppercase",
    letterSpacing: 0.4,
    background: alpha(theme.palette.primary.main, 0.035),
    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
    paddingTop: theme.spacing(1.35),
    paddingBottom: theme.spacing(1.35),
    whiteSpace: "nowrap",
  },
  bodyCell: {
    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.55)}`,
    paddingTop: theme.spacing(1.25),
    paddingBottom: theme.spacing(1.25),
    verticalAlign: "middle",
  },
  tableRow: {
    transition: "background-color 0.18s ease",
    "&:hover": {
      backgroundColor: alpha(theme.palette.primary.main, 0.025),
    },
  },
  contactName: {
    fontWeight: 600,
    color: theme.palette.text.primary,
    fontSize: 14,
    lineHeight: 1.3,
  },
  usernameText: {
    color: alpha(theme.palette.text.primary, 0.6),
    fontSize: 12,
    lineHeight: 1.2,
    marginTop: 2,
    fontWeight: 500,
  },
  mutedText: {
    color: alpha(theme.palette.text.primary, 0.58),
    fontSize: 13,
  },
  walletChip: {
    height: 28,
    borderRadius: 999,
    fontWeight: 600,
    background: alpha(theme.palette.primary.main, 0.06),
    color: alpha(theme.palette.text.primary, 0.78),
    maxWidth: 170,
  },
  statusChipActive: {
    height: 28,
    borderRadius: 999,
    fontWeight: 700,
    background: alpha(theme.palette.success?.main || "#4caf50", 0.10),
    color: theme.palette.success?.dark || "#2e7d32",
  },
  statusChipInactive: {
    height: 28,
    borderRadius: 999,
    fontWeight: 700,
    background: alpha(theme.palette.error?.main || "#f44336", 0.10),
    color: theme.palette.error?.dark || "#c62828",
  },
  actionGroup: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "4px 6px",
    borderRadius: 999,
    background: alpha(theme.palette.primary.main, 0.04),
    border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
  },
  actionIcon: {
    "&:hover": {
      backgroundColor: alpha(theme.palette.primary.main, 0.08),
    },
  },
  emptyState: {
    padding: theme.spacing(6, 2),
    textAlign: "center",
  },
  sectionSpacing: {
    marginBottom: theme.spacing(1),
  },
  headerControlBox: {
    minWidth: 220,
  },
  '@keyframes spin': {
    '0%': { transform: 'rotate(0deg)' },
    '100%': { transform: 'rotate(360deg)' },
  },
}));

const Contacts = () => {
  const classes = useStyles();
  const history = useHistory();
  const { user, socket } = useContext(AuthContext);

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [searchParam, setSearchParam] = useState("");
  const [contacts, dispatch] = useReducer(reducer, []);
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [totalContactsCount, setTotalContactsCount] = useState(0);

  const [selectedContacts, setSelectedContacts] = useState(new Set());
  const [selectAllMode, setSelectAllMode] = useState(false);

  const [importContactModalOpen, setImportContactModalOpen] = useState(false);
  const [deletingContact, setDeletingContact] = useState(null);
  const [ImportContacts, setImportContacts] = useState(null);
  const [blockingContact, setBlockingContact] = useState(null);
  const [unBlockingContact, setUnBlockingContact] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [exportContact, setExportContact] = useState(false);
  const [confirmChatsOpen, setConfirmChatsOpen] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [newTicketModalOpen, setNewTicketModalOpen] = useState(false);
  const [newTicketOficialModalOpen, setNewTicketOficialModalOpen] = useState(false);
  const [contactTicket, setContactTicket] = useState({});

  const [importConnectionModalOpen, setImportConnectionModalOpen] = useState(false);
  const [importWhatsapps, setImportWhatsapps] = useState([]);
  const [selectedImportWhatsappId, setSelectedImportWhatsappId] = useState("");
  
  const [deleteConfirmModalOpen, setDeleteConfirmModalOpen] = useState(false);
  const [deleteType, setDeleteType] = useState('');
  
  const fileUploadRef = useRef(null);
  const [selectedTags, setSelectedTags] = useState([]);
  const { setCurrentTicket } = useContext(TicketsContext);

  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState('');
  const [selectedContactName, setSelectedContactName] = useState('');

  const { getAll: getAllSettings } = useCompanySettings();
  const [hideNum, setHideNum] = useState(false);
  const [enableLGPD, setEnableLGPD] = useState(false);
  const [useWhatsappOfficial, setUseWhatsappOfficial] = useState(false);

  const [syncStatus, setSyncStatus] = useState(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const { getPlanCompany } = usePlans();
  
  useEffect(() => {
    async function fetchData() {
      const settingList = await getAllSettings(user.companyId);

      for (const [key, value] of Object.entries(settingList)) {
        if (key === "enableLGPD") setEnableLGPD(value === "enabled");
        if (key === "lgpdHideNumber") setHideNum(value === "enabled");
      }

      const companyId = user.companyId;
      const planConfigs = await getPlanCompany(undefined, companyId);
      setUseWhatsappOfficial(planConfigs.plan.useWhatsappOfficial);
    }
    fetchData();
  }, []);

  const fetchSyncStatus = async () => {
    try {
      setSyncLoading(true);
      const { data } = await api.get("/contacts/sync-status");
      setSyncStatus(data);
    } catch (err) {
    } finally {
      setSyncLoading(false);
    }
  };

  useEffect(() => {
    fetchSyncStatus();

    const interval = setInterval(() => {
      if (!syncStatus || syncStatus.status !== "ready") {
        fetchSyncStatus();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleSelectContact = (contactId) => {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(contactId)) {
      newSelected.delete(contactId);
    } else {
      newSelected.add(contactId);
    }
    setSelectedContacts(newSelected);
    setSelectAllMode(false);
  };

  const handleSelectAllContacts = () => {
    if (selectAllMode) {
      setSelectedContacts(new Set());
      setSelectAllMode(false);
    } else {
      const currentPageIds = contacts.map(contact => contact.id);
      const allCurrentSelected = currentPageIds.every(id => selectedContacts.has(id));
      
      if (allCurrentSelected && selectedContacts.size === currentPageIds.length) {
        setSelectAllMode(true);
        setSelectedContacts(new Set());
      } else {
        setSelectedContacts(new Set(currentPageIds));
        setSelectAllMode(false);
      }
    }
  };

  useEffect(() => {
    setSelectedContacts(new Set());
    setSelectAllMode(false);
  }, [searchParam, selectedTags]);

  const getSelectedCount = () => {
    if (selectAllMode) {
      return totalContactsCount;
    }
    return selectedContacts.size;
  };

  const getSelectionButtonText = () => {
    if (selectAllMode) {
      return `Excluir Todos (${totalContactsCount})`;
    }
    if (selectedContacts.size > 0) {
      return `Excluir Selecionados (${selectedContacts.size})`;
    }
    return "Excluir";
  };

  const handleBulkDeleteClick = () => {
    if (selectAllMode) {
      setDeleteType('all');
    } else if (selectedContacts.size > 0) {
      setDeleteType('selected');
    } else {
      toast.warning("Selecione pelo menos um contato para excluir");
      return;
    }
    setDeleteConfirmModalOpen(true);
  };

  const handleBulkDeleteConfirm = async () => {
    try {
      if (deleteType === 'all') {
        await api.delete("/contacts/all", {
          data: {
            confirmation: "DELETE_ALL_CONTACTS",
            excludeIds: []
          }
        });
        toast.success(`Todos os ${totalContactsCount} contatos foram excluídos`);
      } else {
        const contactIds = Array.from(selectedContacts);
        await api.post("/contacts/bulk-delete", { contactIds });
        toast.success(`${contactIds.length} contatos excluídos com sucesso`);
      }
      
      setSelectedContacts(new Set());
      setSelectAllMode(false);
      setSearchParam("");
      setPageNumber(1);
      
    } catch (err) {
      toastError(err);
    } finally {
      setDeleteConfirmModalOpen(false);
      setDeleteType('');
    }
  };

  const handleDeleteAllClick = () => {
    setDeleteType('all');
    setDeleteConfirmModalOpen(true);
  };

  const handleOpenImageModal = (imageUrl, contactName) => {
    setSelectedImage(imageUrl);
    setSelectedContactName(contactName);
    setImageModalOpen(true);
  };

  const handleCloseImageModal = () => {
    setImageModalOpen(false);
    setSelectedImage('');
    setSelectedContactName('');
  };

  const handleImportExcel = async () => {
    try {
      const formData = new FormData();
      formData.append("file", fileUploadRef.current.files[0]);
      await api.request({
        url: `/contacts/upload`,
        method: "POST",
        data: formData,
      });
      history.go(0);
    } catch (err) {
      toastError(err);
    }
  };

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam, selectedTags]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchContacts = async () => {
        try {
          const { data } = await api.get("/contacts/", {
            params: {
              searchParam,
              pageNumber,
              contactTag: JSON.stringify(selectedTags),
            },
          });
          dispatch({ type: "LOAD_CONTACTS", payload: data.contacts });
          setHasMore(data.hasMore);
          setTotalContactsCount(data.count);
          setLoading(false);
        } catch (err) {
          toastError(err);
        }
      };
      fetchContacts();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchParam, pageNumber, selectedTags]);

  useEffect(() => {
    const companyId = user.companyId;

    const onContactEvent = (data) => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_CONTACTS", payload: data.contact });
      }

      if (data.action === "delete") {
        dispatch({ type: "DELETE_CONTACT", payload: +data.contactId });
        setTotalContactsCount(prev => Math.max(0, prev - 1));
      }

      if (data.action === "bulk-delete") {
        dispatch({ type: "BULK_DELETE_CONTACTS", payload: data.contactIds });
        setTotalContactsCount(prev => Math.max(0, prev - data.contactIds.length));
      }

      if (data.action === "delete-all") {
        dispatch({ type: "DELETE_ALL_CONTACTS", payload: { excludeIds: data.excludeIds } });
        setTotalContactsCount(data.excludeIds.length);
      }
    };
    
    socket.on(`company-${companyId}-contact`, onContactEvent);

    return () => {
      socket.off(`company-${companyId}-contact`, onContactEvent);
    };
  }, [socket]);

  const handleSelectTicket = (ticket) => {
    const code = uuidv4();
    const { id, uuid } = ticket;
    setCurrentTicket({ id, uuid, code });
  };

  const handleCloseOrOpenTicket = (ticket) => {
    setNewTicketModalOpen(false);
    if (ticket !== undefined && ticket.uuid !== undefined) {
      handleSelectTicket(ticket);
      history.push(`/tickets/${ticket.uuid}`);
    }
  };

  const handleCloseOrOpenTicketOficial = (ticket) => {
    setNewTicketOficialModalOpen(false);
    if (ticket !== undefined && ticket.uuid !== undefined) {
      handleSelectTicket(ticket);
      history.push(`/tickets/${ticket.uuid}`);
    }
  };

  const handleSelectedTags = (selecteds) => {
    const tags = selecteds.map((t) => t.id);
    setSelectedTags(tags);
  };

  const handleSearch = (event) => {
    setSearchParam(event.target.value.toLowerCase());
  };

  const handleOpenContactModal = () => {
    setSelectedContactId(null);
    setContactModalOpen(true);
  };

  const handleCloseContactModal = () => {
    setSelectedContactId(null);
    setContactModalOpen(false);
  };

  const hadleEditContact = (contactId) => {
    setSelectedContactId(contactId);
    setContactModalOpen(true);
  };

  const handleDeleteContact = async (contactId) => {
    try {
      await api.delete(`/contacts/${contactId}`);
      toast.success(i18n.t("contacts.toasts.deleted"));
    } catch (err) {
      toastError(err);
    }
    setDeletingContact(null);
    setSearchParam("");
    setPageNumber(1);
  };

  const handleBlockContact = async (contactId) => {
    try {
      await api.put(`/contacts/block/${contactId}`, { active: false });
      toast.success("Contato bloqueado");
    } catch (err) {
      toastError(err);
    }
    setDeletingContact(null);
    setSearchParam("");
    setPageNumber(1);
    setBlockingContact(null);
  };

  const handleUnBlockContact = async (contactId) => {
    try {
      await api.put(`/contacts/block/${contactId}`, { active: true });
      toast.success("Contato desbloqueado");
    } catch (err) {
      toastError(err);
    }
    setDeletingContact(null);
    setSearchParam("");
    setPageNumber(1);
    setUnBlockingContact(null);
  };

  const [importingContacts, setImportingContacts] = useState(false);
  const [importProgress, setImportProgress] = useState({ status: "", message: "", progress: 0 });

  useEffect(() => {
    if (!user?.companyId || !socket) return;

    const onImportProgress = (data) => {
      setImportProgress(data);
      if (data.status === "done") {
        toast.success(data.message || "Contatos importados com sucesso!");
        setImportingContacts(false);
        setPageNumber(1);
        setSearchParam("");
        dispatch({ type: "RESET" });
        setTimeout(() => setImportProgress({ status: "", message: "", progress: 0 }), 3000);
      } else if (data.status === "warning") {
        toast.warning
          ? toast.warning(data.message || "Contatos ainda não sincronizados. Conecte o celular e aguarde.")
          : toast(data.message || "Contatos ainda não sincronizados. Conecte o celular e aguarde.");
        setImportingContacts(false);
        setTimeout(() => setImportProgress({ status: "", message: "", progress: 0 }), 5000);
      } else if (data.status === "error") {
        toast.error(data.message || "Erro ao importar contatos");
        setImportingContacts(false);
        setTimeout(() => setImportProgress({ status: "", message: "", progress: 0 }), 3000);
      }
    };

    socket.on(`company-${user.companyId}-importContacts`, onImportProgress);
    return () => {
      socket.off(`company-${user.companyId}-importContacts`, onImportProgress);
    };
  }, [user?.companyId, socket]);

  const handleimportContact = async (whatsappId) => {
    setImportContacts(false);
    setImportConnectionModalOpen(false);
    setImportingContacts(true);
    setImportProgress({ status: "started", message: "Iniciando importação...", progress: 0 });
    try {
      await api.post("/contacts/import", { whatsappId: whatsappId || undefined });
    } catch (err) {
      toastError(err);
      setImportingContacts(false);
      setImportProgress({ status: "", message: "", progress: 0 });
    }
  };

  const handleOpenImportConnectionModal = async () => {
    try {
      const { data } = await api.get("/whatsapp", { params: { companyId: user.companyId, session: 0 } });
      const connected = data.filter(w => w.status === "CONNECTED" && (w.channel === "whatsapp" || !w.channel));
      setImportWhatsapps(connected);
      setSelectedImportWhatsappId(connected.length === 1 ? connected[0].id : "");
      setImportConnectionModalOpen(true);
    } catch (err) {
      toastError(err);
    }
  };

  const handleimportChats = async () => {
    try {
      await api.post("/contacts/import/chats");
      history.go(0);
    } catch (err) {
      toastError(err);
    }
  };

  const loadMore = () => {
    setPageNumber((prevState) => prevState + 1);
  };

  const handleScroll = (e) => {
    if (!hasMore || loading) return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - (scrollTop + 100) < clientHeight) {
      loadMore();
    }
  };

  const getConfirmAction = () => {
    if (deletingContact) return () => handleDeleteContact(deletingContact.id);
    if (blockingContact) return () => handleBlockContact(blockingContact.id);
    if (unBlockingContact) return () => handleUnBlockContact(unBlockingContact.id);
    if (ImportContacts) return handleimportContact;
    return handleImportExcel;
  };

  const getConfirmTitle = () => {
    if (deletingContact) return `${i18n.t("contacts.confirmationModal.deleteTitle")} ${deletingContact.name}?`;
    if (blockingContact) return `Bloquear Contato ${blockingContact.name}?`;
    if (unBlockingContact) return `Desbloquear Contato ${unBlockingContact.name}?`;
    if (ImportContacts) return i18n.t("contacts.confirmationModal.importTitlte");
    return i18n.t("contactListItems.confirmationModal.importTitlte");
  };

  const getConfirmMessage = () => {
    if (exportContact) return i18n.t("contacts.confirmationModal.exportContact");
    if (deletingContact) return i18n.t("contacts.confirmationModal.deleteMessage");
    if (blockingContact) return i18n.t("contacts.confirmationModal.blockContact");
    if (unBlockingContact) return i18n.t("contacts.confirmationModal.unblockContact");
    if (ImportContacts) return i18n.t("contacts.confirmationModal.importMessage");
    return i18n.t("contactListItems.confirmationModal.importMessage");
  };

  const getSyncBannerConfig = () => {
    const availableContactsMatch = String(syncStatus?.message || "").match(/(\d+)\s+contatos?/i);
    const availableContactsCount = availableContactsMatch?.[1];

    if (syncLoading && !syncStatus) {
      return {
        className: `${classes.syncBanner} ${classes.syncSyncing}`,
        icon: <Sync className={classes.syncIcon} fontSize="small" />,
        title: i18n.t("analytics.contacts.syncChecking"),
        description: i18n.t("analytics.contacts.syncCheckingHelp"),
        chipLabel: i18n.t("analytics.contacts.checking")
      };
    }

    if (!syncStatus) return null;

    if (syncStatus.status === "ready") {
      return {
        className: `${classes.syncBanner} ${classes.syncReady}`,
        icon: <SyncDone fontSize="small" />,
        title: i18n.t("analytics.contacts.synced"),
        description: availableContactsCount
          ? i18n.t("analytics.contacts.syncedHelp", { count: availableContactsCount })
          : i18n.t("analytics.contacts.syncReadyHelp"),
        chipLabel: i18n.t("analytics.contacts.ready")
      };
    }

    if (
      syncStatus.status === "syncing" ||
      syncStatus.status === "processing" ||
      syncStatus.status === "pending"
    ) {
      return {
        className: `${classes.syncBanner} ${classes.syncSyncing}`,
        icon: <Sync className={classes.syncIcon} fontSize="small" />,
        title: i18n.t("analytics.contacts.syncing"),
        description: i18n.t("analytics.contacts.syncingHelp"),
        chipLabel: i18n.t("analytics.contacts.syncingChip")
      };
    }

    if (
      syncStatus.status === "disabled" ||
      syncStatus.status === "not_connected"
    ) {
      return {
        className: `${classes.syncBanner} ${classes.syncError}`,
        icon: <SyncDisabled fontSize="small" />,
        title: i18n.t("analytics.contacts.unavailable"),
        description: i18n.t("analytics.contacts.unavailableHelp"),
        chipLabel: i18n.t("analytics.contacts.unavailableChip")
      };
    }

    return {
      className: `${classes.syncBanner} ${classes.syncError}`,
      icon: <CloudOff fontSize="small" />,
      title: i18n.t("analytics.contacts.noStatus"),
      description: i18n.t("analytics.contacts.noStatusHelp"),
      chipLabel: i18n.t("analytics.contacts.noStatusChip")
    };
  };

  const selectedCount = getSelectedCount();
  const isAnyContactSelected = selectAllMode || selectedContacts.size > 0;

  const selectAllCheckboxStatus = () => {
    if (selectAllMode) return { checked: true, indeterminate: false };
    
    const currentPageIds = contacts.map(contact => contact.id);
    const selectedInCurrentPage = currentPageIds.filter(id => selectedContacts.has(id)).length;
    
    if (selectedInCurrentPage === 0) {
      return { checked: false, indeterminate: false };
    } else if (selectedInCurrentPage === currentPageIds.length) {
      return { checked: true, indeterminate: false };
    } else {
      return { checked: false, indeterminate: true };
    }
  };

  const checkboxStatus = selectAllCheckboxStatus();
  const syncBanner = getSyncBannerConfig();

  if (user.showContacts !== "enabled") {
    return <ForbiddenPage />;
  }

  return (
    <>
      <MainContainer className={classes.mainContainer}>
        <NewTicketModal
          modalOpen={newTicketModalOpen}
          initialContact={contactTicket}
          onClose={(ticket) => {
            handleCloseOrOpenTicket(ticket);
          }}
        />
        {useWhatsappOfficial && (
          <NewTicketOficialModal
            modalOpen={newTicketOficialModalOpen}
            initialContact={contactTicket}
            onClose={(ticket) => {
              handleCloseOrOpenTicketOficial(ticket);
            }}
          />
        )}

        <Dialog
          open={importConnectionModalOpen}
          onClose={() => setImportConnectionModalOpen(false)}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>Importar contatos do telefone</DialogTitle>
          <DialogContent>
            <Typography variant="body2" style={{ marginBottom: 16 }}>
              Selecione a conexão WhatsApp de onde deseja importar os contatos:
            </Typography>
            {importWhatsapps.length === 0 ? (
              <Typography color="error" variant="body2">
                Nenhuma conexão WhatsApp conectada encontrada.
              </Typography>
            ) : (
              <Select
                fullWidth
                displayEmpty
                variant="outlined"
                value={selectedImportWhatsappId}
                onChange={(e) => setSelectedImportWhatsappId(e.target.value)}
                renderValue={() => {
                  if (selectedImportWhatsappId === "") return "Selecione uma conexão";
                  const w = importWhatsapps.find(w => w.id === selectedImportWhatsappId);
                  return w ? w.name : "";
                }}
              >
                {importWhatsapps.map((w) => (
                  <MenuItem key={w.id} value={w.id}>
                    <WhatsApp style={{ color: "#25d366", marginRight: 8, verticalAlign: "middle" }} />
                    <ListItemText primary={`${w.name} (${w.number || "sem número"})`} />
                  </MenuItem>
                ))}
              </Select>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setImportConnectionModalOpen(false)} color="secondary" variant="outlined">
              {i18n.t("wallets.cancel")}
            </Button>
            <Button
              onClick={() => handleimportContact(selectedImportWhatsappId)}
              color="primary"
              variant="contained"
              disabled={!selectedImportWhatsappId || importWhatsapps.length === 0}
            >
              {i18n.t("contactListItems.buttons.import")}
            </Button>
          </DialogActions>
        </Dialog>

        <ContactModal
          open={contactModalOpen}
          onClose={handleCloseContactModal}
          aria-labelledby="form-dialog-title"
          contactId={selectedContactId}
        ></ContactModal>
        
        <ContactDeleteConfirmModal
          open={deleteConfirmModalOpen}
          onClose={() => setDeleteConfirmModalOpen(false)}
          onConfirm={handleBulkDeleteConfirm}
          deleteType={deleteType}
          selectedCount={selectedContacts.size}
          totalCount={totalContactsCount}
        />
        
        <Dialog
          open={imageModalOpen}
          onClose={handleCloseImageModal}
          className={classes.imageDialog}
          maxWidth="md"
        >
          <DialogTitle className={classes.dialogTitle}>
            <span>Foto de Perfil - {selectedContactName}</span>
            <IconButton onClick={handleCloseImageModal} size="small">
              <Close />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            {selectedImage ? (
              <img
                src={selectedImage}
                alt={`Foto de perfil de ${selectedContactName}`}
                className={classes.profileImage}
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            ) : (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '200px',
                color: '#666'
              }}>
                Imagem não disponível
              </div>
            )}
          </DialogContent>
        </Dialog>

        <ConfirmationModal
          title={getConfirmTitle()}
          open={confirmOpen}
          onClose={setConfirmOpen}
          onConfirm={getConfirmAction()}
        >
          {getConfirmMessage()}
        </ConfirmationModal>
        
        <ConfirmationModal
          title={i18n.t("contacts.confirmationModal.importChat")}
          open={confirmChatsOpen}
          onClose={setConfirmChatsOpen}
          onConfirm={(e) => handleimportChats()}
        >
          {i18n.t("contacts.confirmationModal.wantImport")}
        </ConfirmationModal>

        <MainHeader>
          <Title>
            <Box className={classes.titleRow}>
              <span>{i18n.t("contacts.title")}</span>
              <Chip
                size="small"
                label={i18n.t("analytics.contacts.records", { count: totalContactsCount })}
                className={classes.titleChip}
              />
              {isAnyContactSelected && (
                <Chip
                  size="small"
                  label={`${selectedCount} selecionado(s) ${selectAllMode ? "(TODOS)" : ""}`}
                  className={classes.selectedChip}
                />
              )}
            </Box>
          </Title>

          <MainHeaderButtonsWrapper>
            <Box className={classes.headerActions}>
              <Box className={classes.headerControlBox}>
                <TagsFilter onFiltered={handleSelectedTags} />
              </Box>

              <TextField
                className={classes.searchField}
                placeholder={i18n.t("contacts.searchPlaceholder")}
                type="search"
                value={searchParam}
                onChange={handleSearch}
                variant="outlined"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon color="secondary" />
                    </InputAdornment>
                  ),
                }}
              />
              
              {isAnyContactSelected && (
                <div className={classes.bulkActions}>
                  <Tooltip title={selectAllMode ? "Excluir todos os contatos" : "Excluir contatos selecionados"}>
                    <Button
                      variant="contained"
                      color="secondary"
                      startIcon={<DeleteOutlineIcon />}
                      onClick={handleBulkDeleteClick}
                      className={classes.primaryButton}
                    >
                      {getSelectionButtonText()}
                    </Button>
                  </Tooltip>
                </div>
              )}

              <PopupState variant="popover" popupId="demo-popup-menu">
                {(popupState) => (
                  <React.Fragment>
                    <Button
                      variant="contained"
                      color="primary"
                      {...bindTrigger(popupState)}
                      className={classes.primaryButton}
                    >
                      {i18n.t("contacts.menu.importexport")}
                      <ArrowDropDown />
                    </Button>
                    <Menu {...bindMenu(popupState)}>
                      <MenuItem
                        onClick={() => {
                          handleOpenImportConnectionModal();
                          popupState.close();
                        }}
                      >
                        <ContactPhone
                          fontSize="small"
                          color="primary"
                          style={{ marginRight: 10 }}
                        />
                        {i18n.t("contacts.menu.importYourPhone")}
                      </MenuItem>
                      <MenuItem
                        onClick={() => {
                          setImportContactModalOpen(true);
                          popupState.close();
                        }}
                      >
                        <Backup
                          fontSize="small"
                          color="primary"
                          style={{ marginRight: 10 }}
                        />
                        {i18n.t("contacts.menu.importToExcel")}
                      </MenuItem>
                      <Can
                        role={user.profile}
                        perform="contacts-page:deleteAllContacts"
                        yes={() => (
                          <MenuItem
                            onClick={() => {
                              handleDeleteAllClick();
                              popupState.close();
                            }}
                            style={{ color: '#f44336' }}
                          >
                            <DeleteSweep
                              fontSize="small"
                              style={{ marginRight: 10, color: '#f44336' }}
                            />
                            Excluir Todos os Contatos
                          </MenuItem>
                        )}
                      />
                    </Menu>
                  </React.Fragment>
                )}
              </PopupState>
              
              <Button
                variant="contained"
                color="primary"
                onClick={handleOpenContactModal}
                className={classes.addButton}
              >
                {i18n.t("contacts.buttons.add")}
              </Button>
            </Box>
          </MainHeaderButtonsWrapper>
        </MainHeader>

        {syncBanner && (
          <Paper elevation={0} className={syncBanner.className}>
            {syncBanner.icon}
            <Box className={classes.syncContent}>
              <Typography variant="subtitle2" style={{ fontWeight: 700 }}>
                {syncBanner.title}
              </Typography>
              <Typography variant="body2">
                {syncBanner.description}
              </Typography>
            </Box>
            <Chip
              size="small"
              label={syncBanner.chipLabel}
              onClick={fetchSyncStatus}
            />
          </Paper>
        )}

        {importContactModalOpen && (
          <ContactImportWpModal
            isOpen={importContactModalOpen}
            handleClose={() => setImportContactModalOpen(false)}
            selectedTags={selectedTags}
            hideNum={hideNum}
            userProfile={user.profile}
          />
        )}

        <Paper
          className={classes.mainPaper}
          variant="outlined"
        >
          <input
            style={{ display: "none" }}
            id="upload"
            name="file"
            type="file"
            accept=".xls,.xlsx"
            onChange={() => {
              setConfirmOpen(true);
            }}
            ref={fileUploadRef}
          />

          {isAnyContactSelected && (
            <Toolbar className={`${classes.toolbar} ${classes.toolbarHighlight}`}>
              <Typography className={classes.toolbarTitle} color="inherit" variant="subtitle1">
                {selectedCount} contato(s) selecionado(s) {selectAllMode && '(TODOS OS CONTATOS)'}
              </Typography>

              <div className={classes.bulkActions}>
                <Tooltip title="Cancelar seleção">
                  <Button
                    size="small"
                    onClick={() => {
                      setSelectedContacts(new Set());
                      setSelectAllMode(false);
                    }}
                  >
                    {i18n.t("wallets.cancel")}
                  </Button>
                </Tooltip>
                <Tooltip title={selectAllMode ? "Excluir todos os contatos" : "Excluir selecionados"}>
                  <IconButton
                    color="inherit"
                    onClick={handleBulkDeleteClick}
                  >
                    <DeleteOutlineIcon />
                  </IconButton>
                </Tooltip>
              </div>
            </Toolbar>
          )}

          <div className={classes.tableWrapper} onScroll={handleScroll}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell className={`${classes.checkboxCell} ${classes.headCell}`}>
                    <Checkbox
                      indeterminate={checkboxStatus.indeterminate}
                      checked={checkboxStatus.checked}
                      onChange={handleSelectAllContacts}
                      disabled={contacts.length === 0}
                      inputProps={{ 'aria-label': 'Selecionar todos os contatos' }}
                    />
                  </TableCell>
                  <TableCell className={`${classes.idCell} ${classes.headCell}`}>{i18n.t("tags.table.id")}</TableCell>
                  <TableCell className={`${classes.avatarCell} ${classes.headCell}`} align="center">Foto</TableCell>
                  <TableCell className={classes.headCell}>{i18n.t("contacts.table.name")}</TableCell>
                  <TableCell className={classes.headCell} align="center">
                    {i18n.t("contacts.table.whatsapp")}
                  </TableCell>
                  <TableCell className={classes.headCell} align="center">
                    {i18n.t("contacts.table.email")}
                  </TableCell>
                  <TableCell className={classes.headCell} align="center">{i18n.t("financial.status")}</TableCell>
                  <TableCell className={classes.headCell} align="center">{i18n.t("contacts.table.wallet")}</TableCell>
                  <TableCell className={classes.headCell} align="center">
                    {i18n.t("contacts.table.actions")}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <>
                  {!loading && contacts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9}>
                        <Box className={classes.emptyState}>
                          <Typography variant="h6" gutterBottom>
                            {i18n.t("contacts.emptyTitle")}
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            {i18n.t("contacts.emptyDescription")}
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  )}

                  {contacts.map((contact) => {
                    const isSelected = selectAllMode || selectedContacts.has(contact.id);
                    
                    return (
                      <TableRow
                        key={contact.id}
                        selected={isSelected}
                        className={classes.tableRow}
                      >
                        <TableCell className={`${classes.checkboxCell} ${classes.bodyCell}`}>
                          <Checkbox
                            checked={isSelected}
                            onChange={() => handleSelectContact(contact.id)}
                            disabled={selectAllMode}
                            inputProps={{ 'aria-label': `Selecionar contato ${contact.name}` }}
                          />
                        </TableCell>

                        <TableCell className={`${classes.idCell} ${classes.bodyCell}`}>
                          <Typography variant="body2" style={{ fontWeight: 600 }}>
                            {contact.id}
                          </Typography>
                        </TableCell>

                        <TableCell className={`${classes.avatarCell} ${classes.bodyCell}`} align="center">
                          <Avatar
                            src={getContactAvatarUrl(contact, contact?.companyId)}
                            className={classes.clickableAvatar}
                            onClick={() => handleOpenImageModal(getContactAvatarUrl(contact, contact?.companyId), contact.name)}
                          />
                        </TableCell>

                        <TableCell className={classes.bodyCell}>
                          <Typography className={classes.contactName}>
                            {contact.name}
                          </Typography>

                          {!!contact.whatsappUsername && (
                            <Typography className={classes.usernameText}>
                              @{String(contact.whatsappUsername).replace(/^@+/, "")}
                            </Typography>
                          )}
                        </TableCell>

                        <TableCell className={classes.bodyCell} align="center">
                          <Typography className={classes.mutedText}>
                            {enableLGPD && hideNum && user.profile === "user"
                              ? contact.isGroup
                                ? contact.number
                                : formatSerializedId(contact?.number) === null
                                ? contact.number.slice(0, -6) +
                                  "**-**" +
                                  contact?.number.slice(-2)
                                : formatSerializedId(contact?.number)?.slice(0, -6) +
                                  "**-**" +
                                  contact?.number?.slice(-2)
                              : contact.isGroup
                              ? contact.number
                              : formatSerializedId(contact?.number)}
                          </Typography>
                        </TableCell>

                        <TableCell className={classes.bodyCell} align="center">
                          <Typography className={classes.mutedText}>
                            {contact.email || "—"}
                          </Typography>
                        </TableCell>

                        <TableCell className={classes.bodyCell} align="center">
                          {contact.active ? (
                            <Chip
                              size="small"
                              icon={<CheckCircleIcon style={{ fontSize: 16 }} />}
                              label={i18n.t("announcements.active")}
                              className={classes.statusChipActive}
                            />
                          ) : (
                            <Chip
                              size="small"
                              icon={<CancelIcon style={{ fontSize: 16 }} />}
                              label="Bloqueado"
                              className={classes.statusChipInactive}
                            />
                          )}
                        </TableCell>

                        <TableCell className={classes.bodyCell} align="center">
                          <Chip
                            size="small"
                            className={classes.walletChip}
                            label={
                              contact.contactWallets && contact.contactWallets.length > 0
                                ? contact.contactWallets[0].wallet?.name || "Usuário não encontrado"
                                : "Não atribuído"
                            }
                          />
                        </TableCell>

                        <TableCell className={classes.bodyCell} align="center">
                          <div className={classes.actionGroup}>
                            {contact.channel === "instagram" ? (
                              <Tooltip title="Abrir conversa">
                                <IconButton
                                  size="small"
                                  disabled={!contact.active}
                                  className={classes.actionIcon}
                                  onClick={() => {
                                    setContactTicket(contact);
                                    setNewTicketModalOpen(true);
                                  }}
                                >
                                  <Instagram style={{ color: "purple" }} />
                                </IconButton>
                              </Tooltip>
                            ) : contact.channel === "facebook" ? (
                              <Tooltip title="Abrir conversa">
                                <IconButton
                                  size="small"
                                  disabled={!contact.active}
                                  className={classes.actionIcon}
                                  onClick={() => {
                                    setContactTicket(contact);
                                    setNewTicketModalOpen(true);
                                  }}
                                >
                                  <Facebook style={{ color: "blue" }} />
                                </IconButton>
                              </Tooltip>
                            ) : useWhatsappOfficial ? (
                              <PopupState variant="popover" popupId={`whatsapp-menu-${contact.id}`}>
                                {(popupState) => (
                                  <>
                                    <Tooltip title="Abrir conversa">
                                      <IconButton
                                        size="small"
                                        disabled={!contact.active}
                                        className={classes.actionIcon}
                                        {...bindTrigger(popupState)}
                                      >
                                        <WhatsApp style={{ color: "#128C7E" }} />
                                      </IconButton>
                                    </Tooltip>
                                    <Menu {...bindMenu(popupState)}>
                                      <MenuItem
                                        onClick={() => {
                                          popupState.close();
                                          setContactTicket(contact);
                                          setNewTicketOficialModalOpen(true);
                                        }}
                                        style={{ fontSize: 13 }}
                                      >
                                        <WhatsApp style={{ color: "#128C7E", fontSize: 18, marginRight: 8 }} />
                                        API Oficial
                                      </MenuItem>
                                      <MenuItem
                                        onClick={() => {
                                          popupState.close();
                                          setContactTicket(contact);
                                          setNewTicketModalOpen(true);
                                        }}
                                        style={{ fontSize: 13 }}
                                      >
                                        <WhatsApp style={{ color: "#25D366", fontSize: 18, marginRight: 8 }} />
                                        Baileys
                                      </MenuItem>
                                    </Menu>
                                  </>
                                )}
                              </PopupState>
                            ) : (
                              <Tooltip title="Abrir conversa">
                                <IconButton
                                  size="small"
                                  disabled={!contact.active}
                                  className={classes.actionIcon}
                                  onClick={() => {
                                    setContactTicket(contact);
                                    setNewTicketModalOpen(true);
                                  }}
                                >
                                  <WhatsApp style={{ color: "#25D366" }} />
                                </IconButton>
                              </Tooltip>
                            )}

                            <Tooltip title={i18n.t("contactModal.title.edit")}>
                              <IconButton
                                size="small"
                                className={classes.actionIcon}
                                onClick={() => hadleEditContact(contact.id)}
                              >
                                <EditIcon color="secondary" />
                              </IconButton>
                            </Tooltip>

                            <Tooltip title={contact.active ? "Bloquear contato" : "Desbloquear contato"}>
                              <IconButton
                                size="small"
                                className={classes.actionIcon}
                                onClick={
                                  contact.active
                                    ? () => {
                                        setConfirmOpen(true);
                                        setBlockingContact(contact);
                                      }
                                    : () => {
                                        setConfirmOpen(true);
                                        setUnBlockingContact(contact);
                                      }
                                }
                              >
                                {contact.active ? (
                                  <BlockIcon color="secondary" />
                                ) : (
                                  <CheckCircleIcon color="secondary" />
                                )}
                              </IconButton>
                            </Tooltip>

                            <Can
                              role={user.profile}
                              perform="contacts-page:deleteContact"
                              yes={() => (
                                <Tooltip title="Excluir contato">
                                  <IconButton
                                    size="small"
                                    className={classes.actionIcon}
                                    onClick={(e) => {
                                      setConfirmOpen(true);
                                      setDeletingContact(contact);
                                    }}
                                  >
                                    <DeleteOutlineIcon color="secondary" />
                                  </IconButton>
                                </Tooltip>
                              )}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {loading && <TableRowSkeleton avatar columns={9} />}
                </>
              </TableBody>
            </Table>
          </div>
        </Paper>
      </MainContainer>

      <Dialog
        open={importingContacts}
        disableBackdropClick
        disableEscapeKeyDown
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Importando Contatos</DialogTitle>
        <DialogContent style={{ textAlign: "center", padding: "30px 20px" }}>
          {importProgress.progress > 0 ? (
            <>
              <Box style={{ width: "100%", marginBottom: 16 }}>
                <LinearProgress variant="determinate" value={importProgress.progress} style={{ height: 10, borderRadius: 5 }} />
              </Box>
              <Typography variant="body1" style={{ marginBottom: 8, fontWeight: 500 }}>
                {importProgress.progress}%
              </Typography>
            </>
          ) : (
            <CircularProgress size={60} style={{ marginBottom: 20 }} />
          )}
          <Typography variant="body1" style={{ marginBottom: 8 }}>
            {importProgress.message || "Importando contatos do celular..."}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Por favor, aguarde. A importação está sendo processada.
          </Typography>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Contacts;
