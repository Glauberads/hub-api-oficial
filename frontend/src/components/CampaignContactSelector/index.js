import React, { useState, useEffect, useReducer, useContext, useRef, useCallback } from "react";
import {
  Box,
  Typography,
  TextField,
  CircularProgress,
  Chip,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
  InputAdornment,
  Stepper,
  Step,
  StepLabel,
  Checkbox,
  Avatar,
  Divider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from "@material-ui/core";
import LabelIcon from "@material-ui/icons/Label";
import { makeStyles } from "@material-ui/core/styles";
import PeopleIcon from "@material-ui/icons/People";
import AddIcon from "@material-ui/icons/Add";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import BlockIcon from "@material-ui/icons/Block";
import PhoneAndroidIcon from "@material-ui/icons/PhoneAndroid";
import SearchIcon from "@material-ui/icons/Search";
import ListIcon from "@material-ui/icons/List";
import ArrowBackIcon from "@material-ui/icons/ArrowBack";
import GetAppIcon from "@material-ui/icons/GetApp";
import CheckIcon from "@material-ui/icons/Check";
import CloudUploadIcon from "@material-ui/icons/CloudUpload";
import InsertDriveFileIcon from "@material-ui/icons/InsertDriveFile";
import PersonAddIcon from "@material-ui/icons/PersonAdd";
import api from "../../services/api";
import { AuthContext } from "../../context/Auth/AuthContext";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";
import planilhaExemplo from "../../assets/planilha.xlsx";
import ContactListDialog from "../ContactListDialog";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  root: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    gap: 0,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  listCard: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 8,
    marginBottom: 8,
    cursor: "pointer",
    transition: "all 0.15s",
    "&:hover": {
      borderColor: theme.palette.primary.main,
      backgroundColor: theme.palette.action.hover,
    },
  },
  listCardSelected: {
    borderColor: theme.palette.primary.main,
    backgroundColor: theme.palette.primary.light + "15",
  },
  listCardContent: {
    display: "flex",
    alignItems: "center",
    padding: "10px 14px",
    gap: 10,
  },
  listName: {
    fontWeight: 600,
    fontSize: 13,
    flex: 1,
  },
  listCount: {
    fontSize: 11,
    color: theme.palette.text.secondary,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontWeight: 600,
    fontSize: 13,
    marginBottom: 10,
    display: "flex",
    alignItems: "center",
    gap: 6,
    color: theme.palette.text.primary,
  },
  importBtn: {
    textTransform: "none",
    fontSize: 12,
  },
  emptyBox: {
    textAlign: "center",
    padding: "24px 16px",
    border: `1px dashed ${theme.palette.divider}`,
    borderRadius: 8,
    color: theme.palette.text.secondary,
  },
  contactTable: {
    "& th": { fontSize: 12, fontWeight: 600 },
    "& td": { fontSize: 12 },
  },
  selectedBadge: {
    backgroundColor: theme.palette.primary.main,
    color: "#fff",
    fontSize: 10,
    height: 20,
    marginLeft: 6,
  },
  dropZone: {
    border: `2px dashed ${theme.palette.primary.main}`,
    borderRadius: 10,
    padding: "28px 16px",
    textAlign: "center",
    cursor: "pointer",
    transition: "all 0.2s",
    backgroundColor: theme.palette.primary.light + "10",
    "&:hover": {
      backgroundColor: theme.palette.primary.light + "25",
    },
  },
  dropZoneActive: {
    backgroundColor: theme.palette.primary.light + "40",
    borderColor: theme.palette.primary.dark,
  },
  fileChip: {
    margin: "8px auto 0",
    display: "flex",
    maxWidth: 280,
  },
}));

// Reducer para listas
const listReducer = (state, action) => {
  if (action.type === "LOAD") return action.payload;
  if (action.type === "ADD") return [action.payload, ...state];
  if (action.type === "UPDATE") {
    return state.map((l) => (l.id === action.payload.id ? action.payload : l));
  }
  if (action.type === "DELETE") return state.filter((l) => l.id !== action.payload);
  return state;
};

const CampaignContactSelector = ({
  contactListId,
  onContactListChange,
  campaignEditable,
  campaignName,
  whatsappId,
  onGoToCampaignTab,
  // props legadas (não usadas ativamente mas mantidas para compatibilidade)
  tagListId,
  tagLists,
  contactLists: contactListsProp,
  onTagChange,
  onSelectedContactsChange,
}) => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const { companyId } = user;
  const fileUploadRef = useRef(null);

  const [contactLists, dispatch] = useReducer(listReducer, []);
  const [loadingLists, setLoadingLists] = useState(false);

  // Vista atual: "lists" | "contacts"
  const [view, setView] = useState("lists");
  const [viewingList, setViewingList] = useState(null);

  // Contatos da lista sendo visualizada
  const [contacts, setContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [hasMoreContacts, setHasMoreContacts] = useState(false);
  const [contactPage, setContactPage] = useState(1);

  // Modal nova lista
  const [listDialogOpen, setListDialogOpen] = useState(false);
  const [editingList, setEditingList] = useState(null);

  // Modal "Nova Lista com Excel" (fluxo em 2 passos)
  const [newListModalOpen, setNewListModalOpen] = useState(false);
  const [newListStep, setNewListStep] = useState(0); // 0 = nome, 1 = upload
  const [newListName, setNewListName] = useState("");
  const [newListNameError, setNewListNameError] = useState("");
  const [newListCreated, setNewListCreated] = useState(null); // lista criada na etapa 1
  const [savingList, setSavingList] = useState(false);
  const [uploadingExcel, setUploadingExcel] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const excelUploadRef = useRef(null);

  // Importação WhatsApp
  const [importingPhone, setImportingPhone] = useState(false);

  // === Modal Buscar Contatos do Sistema ===
  const [systemContactsOpen, setSystemContactsOpen] = useState(false);
  const [systemContacts, setSystemContacts] = useState([]);
  const [systemContactsSearch, setSystemContactsSearch] = useState("");
  const [systemContactsLoading, setSystemContactsLoading] = useState(false);
  const [systemContactsPage, setSystemContactsPage] = useState(1);
  const [systemContactsHasMore, setSystemContactsHasMore] = useState(false);
  const [selectedSystemContacts, setSelectedSystemContacts] = useState([]);
  const [addingSystemContacts, setAddingSystemContacts] = useState(false);
  const [targetListForSystemContacts, setTargetListForSystemContacts] = useState(null);
  const systemContactsSearchTimeout = useRef(null);
  // filtros de tag
  const [availableTags, setAvailableTags] = useState([]);
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [loadingTags, setLoadingTags] = useState(false);

  // Busca de listas
  const [listSearch, setListSearch] = useState("");

  // === Funções do modal de contatos do sistema ===
  const fetchSystemContacts = useCallback(async (search = "", page = 1, tagsIds = []) => {
    setSystemContactsLoading(true);
    try {
      const params = { searchParam: search, pageNumber: page };
      if (tagsIds.length > 0) {
        params.tagsIds = JSON.stringify(tagsIds);
      }
      const { data } = await api.get("/contacts", { params });
      const records = data.contacts || [];
      if (page === 1) {
        setSystemContacts(records);
      } else {
        setSystemContacts((prev) => [...prev, ...records]);
      }
      setSystemContactsHasMore(data.hasMore || false);
    } catch (err) {
      toastError(err);
    } finally {
      setSystemContactsLoading(false);
    }
  }, []);

  const fetchAvailableTags = useCallback(async () => {
    setLoadingTags(true);
    try {
      const { data } = await api.get("/tags/list", { params: { kanban: 0 } });
      setAvailableTags(Array.isArray(data) ? data : []);
    } catch (err) {
      // silencioso
    } finally {
      setLoadingTags(false);
    }
  }, []);

  const handleOpenSystemContacts = (list) => {
    setTargetListForSystemContacts(list);
    setSelectedSystemContacts([]);
    setSystemContactsSearch("");
    setSystemContactsPage(1);
    setSelectedTagIds([]);
    setSystemContacts([]);
    setSystemContactsOpen(true);
    fetchSystemContacts("", 1, []);
    fetchAvailableTags();
  };

  const handleSystemContactsSearch = (value) => {
    setSystemContactsSearch(value);
    setSystemContactsPage(1);
    clearTimeout(systemContactsSearchTimeout.current);
    systemContactsSearchTimeout.current = setTimeout(() => {
      fetchSystemContacts(value, 1, selectedTagIds);
    }, 400);
  };

  const handleTagFilter = (tagId) => {
    setSelectedTagIds((prev) => {
      const next = prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId];
      setSystemContactsPage(1);
      fetchSystemContacts(systemContactsSearch, 1, next);
      return next;
    });
  };

  const handleClearTagFilters = () => {
    setSelectedTagIds([]);
    setSystemContactsPage(1);
    fetchSystemContacts(systemContactsSearch, 1, []);
  };

  const handleToggleSystemContact = (contact) => {
    setSelectedSystemContacts((prev) => {
      const exists = prev.find((c) => c.id === contact.id);
      if (exists) return prev.filter((c) => c.id !== contact.id);
      return [...prev, contact];
    });
  };

  const handleSelectAllSystemContacts = () => {
    if (selectedSystemContacts.length === systemContacts.length) {
      setSelectedSystemContacts([]);
    } else {
      setSelectedSystemContacts([...systemContacts]);
    }
  };

  const handleAddSystemContactsToList = async () => {
    if (!targetListForSystemContacts || selectedSystemContacts.length === 0) return;
    setAddingSystemContacts(true);
    try {
      // Adicionar cada contato selecionado à lista
      await Promise.all(
        selectedSystemContacts.map((contact) =>
          api.post("/contact-list-items", {
            name: contact.name,
            number: contact.number,
            username: contact.username || "",
            email: contact.email || "",
            contactListId: targetListForSystemContacts.id,
            companyId,
          }).catch(() => null) // ignora duplicatas silenciosamente
        )
      );
      toast.success(
        `${selectedSystemContacts.length} contato(s) adicionado(s) à lista "${targetListForSystemContacts.name}"!`
      );
      setSystemContactsOpen(false);
      // Atualiza a vista de contatos se estiver na lista alvo
      if (viewingList && String(viewingList.id) === String(targetListForSystemContacts.id)) {
        fetchContacts(viewingList, 1, contactSearch);
      }
      fetchLists();
    } catch (err) {
      toastError(err);
    } finally {
      setAddingSystemContacts(false);
    }
  };

  // Carrega listas
  const fetchLists = async () => {
    setLoadingLists(true);
    try {
      const { data } = await api.get("/contact-lists/", {
        params: { searchParam: listSearch, pageNumber: 1 },
      });
      dispatch({ type: "LOAD", payload: data.records || [] });
    } catch (err) {
      toastError(err);
    } finally {
      setLoadingLists(false);
    }
  };

  useEffect(() => {
    fetchLists();
  }, [listSearch]);

  // Carrega contatos da lista selecionada para visualização
  const fetchContacts = async (list, page = 1, search = "") => {
    setLoadingContacts(true);
    try {
      const { data } = await api.get("contact-list-items", {
        params: { searchParam: search, pageNumber: page, contactListId: list.id },
      });
      if (page === 1) {
        setContacts(data.contacts || []);
      } else {
        setContacts((prev) => [...prev, ...(data.contacts || [])]);
      }
      setHasMoreContacts(data.hasMore || false);
    } catch (err) {
      toastError(err);
    } finally {
      setLoadingContacts(false);
    }
  };

  const openListContacts = (list) => {
    setViewingList(list);
    setView("contacts");
    setContactPage(1);
    setContactSearch("");
    fetchContacts(list, 1, "");
  };

  const handleSelectList = (list) => {
    if (!campaignEditable) return;
    if (onContactListChange) {
      onContactListChange(String(contactListId) === String(list.id) ? "" : list.id);
    }
  };

  const handleDeleteList = async (listId) => {
    try {
      await api.delete(`/contact-lists/${listId}`);
      dispatch({ type: "DELETE", payload: listId });
      if (String(contactListId) === String(listId) && onContactListChange) {
        onContactListChange("");
      }
      toast.success("Lista removida com sucesso");
    } catch (err) {
      toastError(err);
    }
  };

  const handleImportExcel = async () => {
    if (!viewingList) return;
    try {
      const formData = new FormData();
      formData.append("file", fileUploadRef.current.files[0]);
      await api.request({
        url: `contact-lists/${viewingList.id}/upload`,
        method: "POST",
        data: formData,
      });
      toast.success("Importação iniciada! Os contatos serão carregados em breve.");
      setTimeout(() => fetchContacts(viewingList, 1, contactSearch), 2000);
    } catch (err) {
      toastError(err);
    }
  };

  const handleImportFromPhone = async (listId) => {
    if (!whatsappId) {
      toast.warning("Selecione uma conexão WhatsApp na campanha antes de importar.");
      return;
    }
    setImportingPhone(true);
    try {
      await api.post("/contacts/import", { whatsappId });
      toast.success("Contatos do WhatsApp importados com sucesso!");
      fetchLists();
    } catch (err) {
      toastError(err);
    } finally {
      setImportingPhone(false);
    }
  };

  // === Funções do modal "Nova Lista com Excel" ===
  const handleOpenNewListModal = () => {
    setNewListName("");
    setNewListNameError("");
    setNewListCreated(null);
    setNewListStep(0);
    setSelectedFile(null);
    setNewListModalOpen(true);
  };

  const handleCloseNewListModal = () => {
    setNewListModalOpen(false);
    setNewListName("");
    setNewListNameError("");
    setNewListCreated(null);
    setNewListStep(0);
    setSelectedFile(null);
    // Recarregar listas ao fechar (pode ter criado uma lista na etapa 1)
    fetchLists();
  };

  const handleCreateListStep1 = async () => {
    const trimmed = newListName.trim();
    if (!trimmed || trimmed.length < 2) {
      setNewListNameError("O nome deve ter pelo menos 2 caracteres.");
      return;
    }
    setSavingList(true);
    try {
      const { data } = await api.post("/contact-lists", { name: trimmed });
      setNewListCreated(data);
      setNewListStep(1);
      toast.success(`Lista "${trimmed}" criada com sucesso!`);
    } catch (err) {
      toastError(err);
    } finally {
      setSavingList(false);
    }
  };

  const handleFileSelect = (file) => {
    if (!file) return;
    const validTypes = [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    const validExtensions = [".xls", ".xlsx"];
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!validExtensions.includes(ext)) {
      toast.error("Formato inválido. Use apenas arquivos .xls ou .xlsx");
      return;
    }
    setSelectedFile(file);
  };

  const handleUploadExcel = async () => {
    if (!selectedFile || !newListCreated) return;
    setUploadingExcel(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      await api.request({
        url: `contact-lists/${newListCreated.id}/upload`,
        method: "POST",
        data: formData,
      });
      toast.success("Arquivo enviado! Os contatos serão carregados em breve.");
      // Selecionar a lista criada automaticamente para a campanha
      if (onContactListChange) {
        onContactListChange(newListCreated.id);
      }
      handleCloseNewListModal();
    } catch (err) {
      toastError(err);
    } finally {
      setUploadingExcel(false);
    }
  };

  const handleSkipUpload = () => {
    // Selecionar lista criada e fechar
    if (newListCreated && onContactListChange) {
      onContactListChange(newListCreated.id);
    }
    handleCloseNewListModal();
  };

  const selectedList = contactLists.find((l) => String(l.id) === String(contactListId));

  // Inputs ocultos sempre presentes (fora dos condicionais de vista)
  const hiddenInputs = (
    <>
      <input
        style={{ display: "none" }}
        ref={fileUploadRef}
        type="file"
        accept=".xls,.xlsx"
        onChange={handleImportExcel}
      />
      <input
        style={{ display: "none" }}
        ref={excelUploadRef}
        type="file"
        accept=".xls,.xlsx"
        onChange={(e) => handleFileSelect(e.target.files[0])}
      />
    </>
  );

  // ======= VISTA: CONTATOS DA LISTA =======
  if (view === "contacts" && viewingList) {
    return (
      <Box className={classes.root}>
        {hiddenInputs}

        {/* Header */}
        <Box className={classes.header}>
          <Box display="flex" alignItems="center" style={{ gap: 8 }}>
            <IconButton size="small" onClick={() => setView("lists")}>
              <ArrowBackIcon fontSize="small" />
            </IconButton>
            <Typography style={{ fontWeight: 600, fontSize: 15 }}>
              {viewingList.name}
            </Typography>
            <Chip size="small" label={`${contacts.length} contatos`} />
          </Box>
          <Box display="flex" style={{ gap: 8 }}>
            <a href={planilhaExemplo} download="planilha.xlsx" style={{ textDecoration: "none" }}>
              <Button size="small" variant="outlined" startIcon={<GetAppIcon />} className={classes.importBtn}>
                Modelo Excel
              </Button>
            </a>
            <Button
              size="small"
              variant="outlined"
              color="primary"
              className={classes.importBtn}
              onClick={() => {
                fileUploadRef.current.value = null;
                fileUploadRef.current.click();
              }}
            >
              Importar Excel
            </Button>
          </Box>
        </Box>

        {/* Busca */}
        <TextField
          placeholder="Buscar contato por nome, username, número ou email..."
          variant="outlined"
          size="small"
          fullWidth
          value={contactSearch}
          onChange={(e) => {
            setContactSearch(e.target.value);
            setContactPage(1);
            fetchContacts(viewingList, 1, e.target.value);
          }}
          style={{ marginBottom: 12 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon style={{ fontSize: 16, color: "#999" }} />
              </InputAdornment>
            ),
          }}
        />

        {/* Tabela de contatos */}
        {loadingContacts && contacts.length === 0 ? (
          <Box display="flex" justifyContent="center" p={3}>
            <CircularProgress size={28} />
          </Box>
        ) : contacts.length === 0 ? (
          <Box className={classes.emptyBox}>
            <Typography variant="body2">Nenhum contato nesta lista ainda.</Typography>
            <Typography variant="body2" style={{ marginTop: 4, fontSize: 12 }}>
              Importe via Excel ou do WhatsApp usando os botões acima.
            </Typography>
          </Box>
        ) : (
          <Paper variant="outlined" style={{ overflow: "auto", maxHeight: 380 }}>
            <Table size="small" className={classes.contactTable}>
              <TableHead>
                <TableRow>
                  <TableCell align="center" style={{ width: 40 }}>#</TableCell>
                  <TableCell>{i18n.t("plans.form.name")}</TableCell>
                  <TableCell align="center">Username</TableCell>
                  <TableCell align="center">{i18n.t("whatsappModalRel.form.number")}</TableCell>
                  <TableCell align="center">{i18n.t("wallets.email")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {contacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell align="center">
                      {contact.isWhatsappValid ? (
                        <CheckCircleIcon style={{ fontSize: 16, color: "green" }} />
                      ) : (
                        <BlockIcon style={{ fontSize: 16, color: "#ccc" }} />
                      )}
                    </TableCell>
                    <TableCell>{contact.name}</TableCell>
                    <TableCell align="center">{contact.username || "-"}</TableCell>
                    <TableCell align="center">{contact.number}</TableCell>
                    <TableCell align="center">{contact.email}</TableCell>
                  </TableRow>
                ))}
                {loadingContacts && (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <CircularProgress size={20} />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>
        )}

        {hasMoreContacts && !loadingContacts && (
          <Box textAlign="center" mt={1}>
            <Button
              size="small"
              onClick={() => {
                const next = contactPage + 1;
                setContactPage(next);
                fetchContacts(viewingList, next, contactSearch);
              }}
            >
              Carregar mais
            </Button>
          </Box>
        )}

        {/* Botão selecionar esta lista para a campanha */}
        <Box mt={2} display="flex" justifyContent="space-between" alignItems="center">
          <Button
            variant="outlined"
            color="primary"
            startIcon={<CheckIcon />}
            disabled={!campaignEditable}
            onClick={() => {
              handleSelectList(viewingList);
              toast.success(`Lista "${viewingList.name}" selecionada para a campanha!`);
            }}
            style={{ textTransform: "none" }}
          >
            {String(contactListId) === String(viewingList.id)
              ? "✓ Lista selecionada para esta campanha"
              : "Selecionar esta lista para a campanha"}
          </Button>
          {onGoToCampaignTab && String(contactListId) === String(viewingList.id) && (
            <Button
              size="small"
              color="primary"
              variant="contained"
              onClick={onGoToCampaignTab}
              style={{ textTransform: "none" }}
            >
              Voltar para a Campanha →
            </Button>
          )}
        </Box>
      </Box>
    );
  }

  // ======= VISTA: LISTA DE GRUPOS =======
  return (
    <Box className={classes.root}>
      {hiddenInputs}

      {/* ===== MODAL: NOVA LISTA COM EXCEL ===== */}
      <Dialog open={newListModalOpen} onClose={handleCloseNewListModal} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" style={{ gap: 8 }}>
            <AddIcon color="primary" />
            <span>Nova Lista de Contatos</span>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Stepper activeStep={newListStep} style={{ padding: "8px 0 20px", background: "transparent" }}>
            <Step><StepLabel>Nomear lista</StepLabel></Step>
            <Step><StepLabel>{i18n.t("contacts.confirmationModal.importTitlte")}</StepLabel></Step>
          </Stepper>

          {/* ETAPA 0: Nome da lista */}
          {newListStep === 0 && (
            <Box>
              <Typography variant="body2" color="textSecondary" style={{ marginBottom: 16, fontSize: 13 }}>
                Dê um nome para identificar esta lista de contatos.
              </Typography>
              <TextField
                label="Nome da lista"
                variant="outlined"
                fullWidth
                autoFocus
                value={newListName}
                onChange={(e) => { setNewListName(e.target.value); setNewListNameError(""); }}
                error={!!newListNameError}
                helperText={newListNameError}
                onKeyPress={(e) => { if (e.key === "Enter") handleCreateListStep1(); }}
                inputProps={{ maxLength: 50 }}
                placeholder="Ex: Clientes VIP, Prospects Novembro..."
              />
              <Typography style={{ fontSize: 11, color: "#999", marginTop: 6 }}>
                {newListName.length}/50 caracteres
              </Typography>
            </Box>
          )}

          {/* ETAPA 1: Upload Excel */}
          {newListStep === 1 && newListCreated && (
            <Box>
              <Box
                style={{
                  background: "#e8f5e9",
                  border: "1px solid #a5d6a7",
                  borderRadius: 8,
                  padding: "8px 14px",
                  marginBottom: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <CheckCircleIcon style={{ color: "#4caf50", fontSize: 16 }} />
                <Typography style={{ fontSize: 12, color: "#2e7d32", fontWeight: 600 }}>
                  Lista "{newListCreated.name}" criada! Agora importe os contatos (opcional).
                </Typography>
              </Box>

              {/* Área de drop */}
              <Box
                className={`${classes.dropZone} ${dragOver ? classes.dropZoneActive : ""}`}
                onClick={() => { excelUploadRef.current.value = null; excelUploadRef.current.click(); }}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const file = e.dataTransfer.files[0];
                  if (file) handleFileSelect(file);
                }}
              >
                <CloudUploadIcon style={{ fontSize: 40, color: "#1976d2", marginBottom: 8 }} />
                <Typography style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                  Arraste o Excel aqui ou clique para selecionar
                </Typography>
                <Typography style={{ fontSize: 12, color: "#666" }}>
                  Formatos aceitos: .xls, .xlsx
                </Typography>
              </Box>

              {/* Arquivo selecionado */}
              {selectedFile && (
                <Box
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 12,
                    padding: "8px 12px",
                    background: "#f5f5f5",
                    borderRadius: 8,
                    border: "1px solid #e0e0e0",
                  }}
                >
                  <InsertDriveFileIcon style={{ color: "#1976d2", fontSize: 20 }} />
                  <Box flex={1}>
                    <Typography style={{ fontSize: 13, fontWeight: 600 }}>{selectedFile.name}</Typography>
                    <Typography style={{ fontSize: 11, color: "#666" }}>
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </Typography>
                  </Box>
                  <IconButton size="small" onClick={() => setSelectedFile(null)}>
                    <DeleteOutlineIcon style={{ fontSize: 16 }} />
                  </IconButton>
                </Box>
              )}

              {/* Link download modelo */}
              <Box mt={2} textAlign="center">
                <a href={planilhaExemplo} download="planilha.xlsx" style={{ fontSize: 12, color: "#1976d2" }}>
                  📥 Baixar planilha modelo (.xlsx)
                </a>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions style={{ padding: "12px 16px", justifyContent: "space-between" }}>
          <Button onClick={handleCloseNewListModal} style={{ textTransform: "none" }}>
            {newListStep === 1 ? i18n.t("campaigns.settings.close") : i18n.t("wallets.cancel")}
          </Button>
          <Box display="flex" style={{ gap: 8 }}>
            {newListStep === 1 && (
              <Button
                onClick={handleSkipUpload}
                variant="outlined"
                style={{ textTransform: "none" }}
              >
                Pular importação
              </Button>
            )}
            {newListStep === 0 && (
              <Button
                onClick={handleCreateListStep1}
                variant="contained"
                color="primary"
                disabled={savingList || !newListName.trim()}
                style={{ textTransform: "none" }}
                startIcon={savingList ? <CircularProgress size={14} color="inherit" /> : null}
              >
                {savingList ? "Criando..." : "Criar Lista →"}
              </Button>
            )}
            {newListStep === 1 && (
              <Button
                onClick={handleUploadExcel}
                variant="contained"
                color="primary"
                disabled={!selectedFile || uploadingExcel}
                style={{ textTransform: "none" }}
                startIcon={uploadingExcel ? <CircularProgress size={14} color="inherit" /> : <CloudUploadIcon />}
              >
                {uploadingExcel ? "Enviando..." : i18n.t("contacts.buttons.import")}
              </Button>
            )}
          </Box>
        </DialogActions>
      </Dialog>

      {/* ===== MODAL: BUSCAR CONTATOS DO SISTEMA ===== */}
      <Dialog
        open={systemContactsOpen}
        onClose={() => setSystemContactsOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" style={{ gap: 8 }}>
            <PersonAddIcon color="secondary" />
            <span>Buscar Contatos do Sistema</span>
            {selectedSystemContacts.length > 0 && (
              <Chip
                size="small"
                label={`${selectedSystemContacts.length} selecionado(s)`}
                color="secondary"
                style={{ marginLeft: 8 }}
              />
            )}
          </Box>
        </DialogTitle>
        <DialogContent dividers style={{ padding: "12px 16px" }}>
          {/* Destino */}
          {targetListForSystemContacts && (
            <Box
              style={{
                background: "#e3f2fd",
                border: "1px solid #90caf9",
                borderRadius: 8,
                padding: "8px 12px",
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <ListIcon style={{ color: "#1976d2", fontSize: 16 }} />
              <Typography style={{ fontSize: 12, color: "#1565c0", fontWeight: 600 }}>
                Adicionando à lista: {targetListForSystemContacts.name}
              </Typography>
            </Box>
          )}

          {/* Busca */}
          <TextField
            placeholder="Buscar por nome, username ou número..."
            variant="outlined"
            size="small"
            fullWidth
            autoFocus
            value={systemContactsSearch}
            onChange={(e) => handleSystemContactsSearch(e.target.value)}
            style={{ marginBottom: 10 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon style={{ fontSize: 16, color: "#999" }} />
                </InputAdornment>
              ),
            }}
          />

          {/* ===== FILTRO POR TAG ===== */}
          <Box style={{ marginBottom: 10 }}>
            <Box display="flex" alignItems="center" style={{ gap: 6, marginBottom: 6 }}>
              <LabelIcon style={{ fontSize: 14, color: "#888" }} />
              <Typography style={{ fontSize: 12, color: "#555", fontWeight: 600 }}>
                Filtrar por tag:
              </Typography>
              {selectedTagIds.length > 0 && (
                <Button
                  size="small"
                  style={{ fontSize: 10, textTransform: "none", padding: "0 6px", minHeight: 20 }}
                  onClick={handleClearTagFilters}
                >
                  Limpar ({selectedTagIds.length})
                </Button>
              )}
            </Box>
            {loadingTags ? (
              <Box display="flex" alignItems="center" style={{ gap: 6 }}>
                <CircularProgress size={14} />
                <Typography style={{ fontSize: 11, color: "#aaa" }}>Carregando tags...</Typography>
              </Box>
            ) : availableTags.length === 0 ? (
              <Typography style={{ fontSize: 11, color: "#aaa" }}>
                Nenhuma tag disponível.
              </Typography>
            ) : (
              <Box display="flex" flexWrap="wrap" style={{ gap: 4 }}>
                {availableTags.map((tag) => {
                  const isActive = selectedTagIds.includes(tag.id);
                  return (
                    <Chip
                      key={tag.id}
                      size="small"
                      label={tag.name}
                      clickable
                      onClick={() => handleTagFilter(tag.id)}
                      style={{
                        fontSize: 11,
                        height: 22,
                        backgroundColor: isActive ? (tag.color || "#1976d2") : "transparent",
                        color: isActive ? "#fff" : (tag.color || "#555"),
                        border: `1px solid ${tag.color || "#bbb"}`,
                        fontWeight: isActive ? 700 : 400,
                        transition: "all 0.15s",
                      }}
                    />
                  );
                })}
              </Box>
            )}
          </Box>
          <Divider style={{ marginBottom: 8 }} />

          {/* Selecionar todos */}
          {systemContacts.length > 0 && (
            <Box
              display="flex"
              alignItems="center"
              style={{ marginBottom: 6, padding: "0 4px" }}
            >
              <Checkbox
                size="small"
                checked={
                  systemContacts.length > 0 &&
                  selectedSystemContacts.length === systemContacts.length
                }
                indeterminate={
                  selectedSystemContacts.length > 0 &&
                  selectedSystemContacts.length < systemContacts.length
                }
                onChange={handleSelectAllSystemContacts}
                color="secondary"
              />
              <Typography style={{ fontSize: 12, color: "#555" }}>
                Selecionar todos ({systemContacts.length} exibidos)
              </Typography>
            </Box>
          )}

          {/* Lista de contatos */}
          {systemContactsLoading && systemContacts.length === 0 ? (
            <Box display="flex" justifyContent="center" p={3}>
              <CircularProgress size={28} />
            </Box>
          ) : systemContacts.length === 0 ? (
            <Box className={classes.emptyBox}>
              <Typography variant="body2">Nenhum contato encontrado.</Typography>
              <Typography variant="body2" style={{ fontSize: 12, marginTop: 4 }}>
                Tente buscar por outro nome, username ou número.
              </Typography>
            </Box>
          ) : (
            <Paper variant="outlined" style={{ overflow: "auto", maxHeight: 340 }}>
              <Table size="small" className={classes.contactTable}>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" />
                    <TableCell>{i18n.t("plans.form.name")}</TableCell>
                    <TableCell align="center">Username</TableCell>
                    <TableCell align="center">{i18n.t("whatsappModalRel.form.number")}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {systemContacts.map((contact) => {
                    const isChecked = !!selectedSystemContacts.find((c) => c.id === contact.id);
                    return (
                      <TableRow
                        key={contact.id}
                        hover
                        style={{ cursor: "pointer" }}
                        onClick={() => handleToggleSystemContact(contact)}
                      >
                        <TableCell padding="checkbox">
                          <Checkbox
                            size="small"
                            checked={isChecked}
                            color="secondary"
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => handleToggleSystemContact(contact)}
                          />
                        </TableCell>
                        <TableCell>
                          <Box display="flex" alignItems="center" style={{ gap: 8 }}>
                            <Avatar
                              src={contact.urlPicture}
                              alt={contact.name}
                              style={{ width: 28, height: 28, fontSize: 12 }}
                            >
                              {contact.name ? contact.name[0].toUpperCase() : "?"}
                            </Avatar>
                            <Typography style={{ fontSize: 12 }}>{contact.name}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="center" style={{ fontSize: 12 }}>
                          {contact.username || "-"}
                        </TableCell>
                        <TableCell align="center" style={{ fontSize: 12 }}>
                          {contact.number}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {systemContactsLoading && (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        <CircularProgress size={18} />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Paper>
          )}

          {/* Carregar mais */}
          {systemContactsHasMore && !systemContactsLoading && (
            <Box textAlign="center" mt={1}>
              <Button
                size="small"
                onClick={() => {
                  const next = systemContactsPage + 1;
                  setSystemContactsPage(next);
                  fetchSystemContacts(systemContactsSearch, next, selectedTagIds);
                }}
              >
                Carregar mais
              </Button>
            </Box>
          )}
        </DialogContent>
        <DialogActions style={{ padding: "12px 16px", justifyContent: "space-between" }}>
          <Button
            onClick={() => setSystemContactsOpen(false)}
            style={{ textTransform: "none" }}
          >
            {i18n.t("wallets.cancel")}
          </Button>
          <Button
            onClick={handleAddSystemContactsToList}
            variant="contained"
            color="secondary"
            disabled={selectedSystemContacts.length === 0 || addingSystemContacts}
            style={{ textTransform: "none" }}
            startIcon={
              addingSystemContacts ? (
                <CircularProgress size={14} color="inherit" />
              ) : (
                <PersonAddIcon />
              )
            }
          >
            {addingSystemContacts
              ? "Adicionando..."
              : `Adicionar ${selectedSystemContacts.length > 0 ? `(${selectedSystemContacts.length})` : ""} à lista`}
          </Button>
        </DialogActions>
      </Dialog>

      <ContactListDialog
        open={listDialogOpen}
        onClose={() => {
          setListDialogOpen(false);
          setEditingList(null);
          setTimeout(() => fetchLists(), 500);
        }}
        aria-labelledby="form-dialog-title"
        contactListId={editingList?.id}
      />

      {/* Header */}
      <Box className={classes.header}>
        <Box>
          <Typography style={{ fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", gap: 6 }}>
            <ListIcon style={{ fontSize: 18 }} />
            {i18n.t("contactLists.title")}
          </Typography>
          <Typography variant="body2" color="textSecondary" style={{ fontSize: 12, marginTop: 2 }}>
            {i18n.t("marketing.selector.description")}
          </Typography>
        </Box>
        <Box display="flex" style={{ gap: 8 }}>
          <Button
            variant="outlined"
            color="primary"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => { setEditingList(null); setListDialogOpen(true); }}
            style={{ textTransform: "none", whiteSpace: "nowrap" }}
          >
            {i18n.t("marketing.selector.simpleList")}
          </Button>
          <Button
            variant="contained"
            color="primary"
            size="small"
            startIcon={<CloudUploadIcon style={{ fontSize: 16 }} />}
            onClick={handleOpenNewListModal}
            style={{ textTransform: "none", whiteSpace: "nowrap" }}
          >
            {i18n.t("marketing.selector.newExcelList")}
          </Button>
        </Box>
      </Box>

      {/* Lista selecionada para a campanha */}
      {selectedList && (
        <Box
          style={{
            background: "linear-gradient(135deg, #e8f5e9 0%, #f1f8e9 100%)",
            border: "1.5px solid #4caf50",
            borderRadius: 8,
            padding: "10px 14px",
            marginBottom: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Box display="flex" alignItems="center" style={{ gap: 8 }}>
            <CheckCircleIcon style={{ color: "#4caf50", fontSize: 18 }} />
            <Box>
              <Typography style={{ fontWeight: 600, fontSize: 13, color: "#2e7d32" }}>
                {i18n.t("marketing.selector.selectedList", { name: selectedList.name })}
              </Typography>
              <Typography style={{ fontSize: 11, color: "#558b2f" }}>
                {i18n.t("marketing.selector.contactsUsed", { count: selectedList.contactsCount || 0 })}
              </Typography>
            </Box>
          </Box>
          {campaignEditable && (
            <Button
              size="small"
              style={{ fontSize: 11, textTransform: "none", color: "#c62828" }}
              onClick={() => onContactListChange && onContactListChange("")}
            >
              {i18n.t("marketing.selector.remove")}
            </Button>
          )}
        </Box>
      )}

      {/* Busca */}
      <TextField
        placeholder={i18n.t("marketing.selector.search")}
        variant="outlined"
        size="small"
        fullWidth
        value={listSearch}
        onChange={(e) => setListSearch(e.target.value)}
        style={{ marginBottom: 12 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon style={{ fontSize: 16, color: "#999" }} />
            </InputAdornment>
          ),
        }}
      />

      {/* Listas */}
      {loadingLists ? (
        <Box display="flex" justifyContent="center" p={3}>
          <CircularProgress size={28} />
        </Box>
      ) : contactLists.length === 0 ? (
        <Box className={classes.emptyBox}>
          <PeopleIcon style={{ fontSize: 36, color: "#bbb", marginBottom: 8 }} />
          <Typography variant="body2">{i18n.t("marketing.selector.empty")}</Typography>
          <Typography variant="body2" style={{ fontSize: 12, marginTop: 4 }}>
            {i18n.t("marketing.selector.emptyHelp")}
          </Typography>
        </Box>
      ) : (
        <Box style={{ maxHeight: 360, overflow: "auto" }}>
          {contactLists.map((list) => {
            const isSelected = String(contactListId) === String(list.id);
            return (
              <Paper
                key={list.id}
                variant="outlined"
                className={`${classes.listCard} ${isSelected ? classes.listCardSelected : ""}`}
                onClick={() => openListContacts(list)}
              >
                <Box className={classes.listCardContent}>
                  <PeopleIcon style={{ fontSize: 18, color: isSelected ? "#1976d2" : "#999" }} />
                  <Box flex={1}>
                    <Box display="flex" alignItems="center">
                      <Typography className={classes.listName}>
                        {list.name}
                      </Typography>
                      {isSelected && (
                        <Chip
                          size="small"
                          label="Selecionada"
                          className={classes.selectedBadge}
                        />
                      )}
                    </Box>
                    <Typography className={classes.listCount}>
                      {list.contactsCount || 0} contatos
                    </Typography>
                  </Box>
                  <Box display="flex" style={{ gap: 2 }}>
                    <Tooltip title={isSelected ? "Lista já selecionada" : "Selecionar para a campanha"}>
                      <span>
                        <IconButton
                          size="small"
                          color={isSelected ? "primary" : "default"}
                          disabled={!campaignEditable}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectList(list);
                          }}
                        >
                          <CheckIcon style={{ fontSize: 16 }} />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Buscar contatos do sistema para esta lista">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenSystemContacts(list);
                        }}
                      >
                        <PersonAddIcon style={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Editar lista">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingList(list);
                          setListDialogOpen(true);
                        }}
                      >
                        <EditIcon style={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Excluir lista">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Excluir a lista "${list.name}"?`)) {
                            handleDeleteList(list.id);
                          }
                        }}
                      >
                        <DeleteOutlineIcon style={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              </Paper>
            );
          })}
        </Box>
      )}
    </Box>
  );
};

export default CampaignContactSelector;
