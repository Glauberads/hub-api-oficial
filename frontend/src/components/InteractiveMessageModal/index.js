import React, { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  IconButton,
  Tabs,
  Tab,
  Box,
  Divider,
  Fab,
  Paper,
  Chip,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from "@material-ui/core";
import {
  Close,
  FormatListBulleted,
  LocalOffer,
  Payment,
  Link as LinkIcon,
  Phone,
  LocationOn,
  ViewCarousel,
  Storefront,
  Poll,
  Add,
  Delete,
  Send,
  Save,
  FolderOpen,
  BookmarkBorder,
  Bookmark,
  Receipt,
} from "@material-ui/icons";
import SmartButton from "@mui/icons-material/SmartButton";
import { makeStyles } from "@material-ui/core/styles";
import { toast } from "react-toastify";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  dialogPaper: {
    maxWidth: 600,
    width: "100%",
    borderRadius: 12,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  headerTitle: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  tabsRoot: {
    minHeight: 42,
  },
  tab: {
    minWidth: 48,
    minHeight: 42,
    padding: "6px 10px",
    fontSize: 11,
  },
  content: {
    padding: "16px !important",
    maxHeight: "60vh",
    overflowY: "auto",
  },
  fieldRow: {
    marginBottom: 12,
  },
  optionRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  optionNumber: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    backgroundColor: theme.palette.primary.main,
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 600,
    flexShrink: 0,
  },
  addBtn: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    cursor: "pointer",
    color: theme.palette.primary.main,
    fontSize: 13,
    fontWeight: 600,
    padding: "6px 0",
  },
  previewBox: {
    backgroundColor: "#075E54",
    borderRadius: 8,
    padding: 12,
    color: "#fff",
    marginTop: 12,
  },
  previewTitle: {
    fontWeight: 600,
    fontSize: 14,
    marginBottom: 4,
  },
  previewBody: {
    fontSize: 12,
    opacity: 0.9,
    marginBottom: 8,
  },
  previewFooter: {
    fontSize: 11,
    opacity: 0.7,
  },
  previewButton: {
    color: "#00a5f4",
    textAlign: "center",
    padding: "6px 0",
    fontSize: 13,
    fontWeight: 600,
    borderTop: "1px solid rgba(255,255,255,0.15)",
  },
  infoAlert: {
    backgroundColor: "#E8F5E9",
    border: "1px solid #A5D6A7",
    borderRadius: 8,
    padding: "8px 12px",
    marginBottom: 12,
    fontSize: 12,
    color: "#2E7D32",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  sectionBox: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  templateBar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 16px",
    borderBottom: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.type === "dark" ? "rgba(255,255,255,0.03)" : "#FAFAFA",
  },
  templateChip: {
    cursor: "pointer",
    fontSize: 12,
  },
  templateMenu: {
    maxHeight: 300,
  },
  saveDialog: {
    minWidth: 350,
  },
}));

const TAB_CONFIG = [
  { label: "Botões", icon: <SmartButton style={{ fontSize: 16 }} />, type: "button" },
  { label: "Lista", icon: <FormatListBulleted style={{ fontSize: 16 }} />, type: "list" },
  { label: "Cobrança", icon: <Receipt style={{ fontSize: 16 }} />, type: "cobranca" },
  { label: "Ofertas", icon: <LocalOffer style={{ fontSize: 16 }} />, type: "offer" },
  { label: "PIX", icon: <Payment style={{ fontSize: 16 }} />, type: "pix" },
  { label: "URL", icon: <LinkIcon style={{ fontSize: 16 }} />, type: "url" },
  { label: "Ligação", icon: <Phone style={{ fontSize: 16 }} />, type: "call" },
  { label: "Local", icon: <LocationOn style={{ fontSize: 16 }} />, type: "location" },
  { label: "Carrossel", icon: <ViewCarousel style={{ fontSize: 16 }} />, type: "carousel" },
  { label: "Catálogo", icon: <Storefront style={{ fontSize: 16 }} />, type: "catalog" },
  { label: "Enquete", icon: <Poll style={{ fontSize: 16 }} />, type: "poll" },
];

const InteractiveMessageModal = ({ open, onClose, ticketId, ticketChannel }) => {
  const classes = useStyles();
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);

  // Templates state
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templateMenuAnchor, setTemplateMenuAnchor] = useState(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [activeTemplateName, setActiveTemplateName] = useState("");

  // Common fields
  const [bodyText, setBodyText] = useState("");
  const [footerText, setFooterText] = useState("");

  // Buttons
  const [buttons, setButtons] = useState([
    { displayText: "", id: "1" },
    { displayText: "", id: "2" },
  ]);

  // List
  const [listButtonText, setListButtonText] = useState("Selecionar");
  const [sections, setSections] = useState([
    {
      title: "Opções",
      rows: [
        { title: "", description: "", id: "1" },
        { title: "", description: "", id: "2" },
      ],
    },
  ]);

  // Location
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [locationName, setLocationName] = useState("");
  const [locationAddress, setLocationAddress] = useState("");

  // URL
  const [urlText, setUrlText] = useState("");
  const [url, setUrl] = useState("");

  // Call
  const [callText, setCallText] = useState("");
  const [callNumber, setCallNumber] = useState("");

  // PIX
  const [pixKey, setPixKey] = useState("");
  const [pixName, setPixName] = useState("");
  const [pixCity, setPixCity] = useState("");
  const [pixAmount, setPixAmount] = useState("");

  // Poll
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);

  // Offer
  const [offerTitle, setOfferTitle] = useState("");
  const [offerPrice, setOfferPrice] = useState("");
  const [offerDescription, setOfferDescription] = useState("");

  // Carousel
  const [carouselCards, setCarouselCards] = useState([
    { title: "", body: "", buttons: [{ displayText: "", id: "1" }] },
  ]);

  // Cobrança
  const [cobrancaNumber, setCobrancaNumber] = useState("");
  const [cobrancaDescription, setCobrancaDescription] = useState("");
  const [cobrancaQuantity, setCobrancaQuantity] = useState("1");
  const [cobrancaAmount, setCobrancaAmount] = useState("");
  const [cobrancaMessage, setCobrancaMessage] = useState("");
  const [cobrancaPaymentUrl, setCobrancaPaymentUrl] = useState("");
  const [cobrancaButtonText, setCobrancaButtonText] = useState("Revisar e pagar");
  const [cobrancaPdfFile, setCobrancaPdfFile] = useState(null);
  const [cobrancaPdfName, setCobrancaPdfName] = useState("");

  const currentType = TAB_CONFIG[activeTab]?.type;

  // ===== TEMPLATES =====
  const fetchTemplates = useCallback(async () => {
    try {
      setLoadingTemplates(true);
      const { data } = await api.get("/interactive-templates");
      setTemplates(data);
    } catch (err) {
      console.error("Erro ao buscar templates:", err);
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchTemplates();
  }, [open, fetchTemplates]);

  const getCurrentFormData = () => {
    const data = { bodyText, footerText };
    switch (currentType) {
      case "button": return { ...data, buttons };
      case "list": return { ...data, listButtonText, sections };
      case "location": return { ...data, latitude, longitude, locationName, locationAddress };
      case "url": return { ...data, urlText, url };
      case "call": return { ...data, callText, callNumber };
      case "pix": return { ...data, pixKey, pixName, pixCity, pixAmount };
      case "poll": return { ...data, pollQuestion, pollOptions };
      case "offer": return { ...data, offerTitle, offerPrice, offerDescription };
      case "carousel":
      case "catalog": return { ...data, carouselCards };
      case "cobranca": return { ...data, cobrancaNumber, cobrancaDescription, cobrancaQuantity, cobrancaAmount, cobrancaMessage, cobrancaPaymentUrl, cobrancaButtonText };
      default: return data;
    }
  };

  const loadTemplateData = (tpl) => {
    const d = tpl.templateData;
    // Switch to correct tab
    const tabIdx = TAB_CONFIG.findIndex(t => t.type === tpl.interactiveType);
    if (tabIdx >= 0) setActiveTab(tabIdx);

    setBodyText(d.bodyText || "");
    setFooterText(d.footerText || "");
    setActiveTemplateName(tpl.name);

    switch (tpl.interactiveType) {
      case "button":
        setButtons(d.buttons || [{ displayText: "", id: "1" }]);
        break;
      case "list":
        setListButtonText(d.listButtonText || "Selecionar");
        setSections(d.sections || [{ title: "Opções", rows: [{ title: "", description: "", id: "1" }] }]);
        break;
      case "location":
        setLatitude(d.latitude || "");
        setLongitude(d.longitude || "");
        setLocationName(d.locationName || "");
        setLocationAddress(d.locationAddress || "");
        break;
      case "url":
        setUrlText(d.urlText || "");
        setUrl(d.url || "");
        break;
      case "call":
        setCallText(d.callText || "");
        setCallNumber(d.callNumber || "");
        break;
      case "pix":
        setPixKey(d.pixKey || "");
        setPixName(d.pixName || "");
        setPixCity(d.pixCity || "");
        setPixAmount(d.pixAmount || "");
        break;
      case "poll":
        setPollQuestion(d.pollQuestion || "");
        setPollOptions(d.pollOptions || ["", ""]);
        break;
      case "offer":
        setOfferTitle(d.offerTitle || "");
        setOfferPrice(d.offerPrice || "");
        setOfferDescription(d.offerDescription || "");
        break;
      case "carousel":
      case "catalog":
        setCarouselCards(d.carouselCards || [{ title: "", body: "", buttons: [{ displayText: "", id: "1" }] }]);
        break;
      case "cobranca":
        setCobrancaNumber(d.cobrancaNumber || "");
        setCobrancaDescription(d.cobrancaDescription || "");
        setCobrancaQuantity(d.cobrancaQuantity || "1");
        setCobrancaAmount(d.cobrancaAmount || "");
        setCobrancaMessage(d.cobrancaMessage || "");
        setCobrancaPaymentUrl(d.cobrancaPaymentUrl || "");
        setCobrancaButtonText(d.cobrancaButtonText || "Revisar e pagar");
        break;
    }
    setTemplateMenuAnchor(null);
    toast.info(`Template "${tpl.name}" carregado`);
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      toast.error("Digite um nome para o template");
      return;
    }
    try {
      await api.post("/interactive-templates", {
        name: templateName,
        interactiveType: currentType,
        templateData: getCurrentFormData(),
      });
      toast.success("Template salvo!");
      setTemplateName("");
      setSaveDialogOpen(false);
      setActiveTemplateName(templateName);
      fetchTemplates();
    } catch (err) {
      toast.error("Erro ao salvar template");
    }
  };

  const handleDeleteTemplate = async (id, e) => {
    e.stopPropagation();
    try {
      await api.delete(`/interactive-templates/${id}`);
      toast.success("Template removido");
      fetchTemplates();
    } catch (err) {
      toast.error("Erro ao remover");
    }
  };

  const filteredTemplates = templates.filter(t => t.interactiveType === currentType);

  // ===== HANDLERS (same as before) =====
  const handleAddButton = () => {
    if (buttons.length < 3) {
      setButtons([...buttons, { displayText: "", id: String(buttons.length + 1) }]);
    }
  };

  const handleRemoveButton = (index) => {
    setButtons(buttons.filter((_, i) => i !== index));
  };

  const handleButtonChange = (index, value) => {
    const newBtns = [...buttons];
    newBtns[index] = { ...newBtns[index], displayText: value };
    setButtons(newBtns);
  };

  const handleAddRow = (sectionIdx) => {
    const newSections = [...sections];
    const rows = newSections[sectionIdx].rows;
    if (rows.length < 10) {
      rows.push({ title: "", description: "", id: String(rows.length + 1) });
      setSections(newSections);
    }
  };

  const handleRemoveRow = (sectionIdx, rowIdx) => {
    const newSections = [...sections];
    newSections[sectionIdx].rows = newSections[sectionIdx].rows.filter((_, i) => i !== rowIdx);
    setSections(newSections);
  };

  const handleRowChange = (sectionIdx, rowIdx, field, value) => {
    const newSections = [...sections];
    newSections[sectionIdx].rows[rowIdx][field] = value;
    setSections(newSections);
  };

  const handleAddPollOption = () => {
    if (pollOptions.length < 12) {
      setPollOptions([...pollOptions, ""]);
    }
  };

  const handleRemovePollOption = (index) => {
    setPollOptions(pollOptions.filter((_, i) => i !== index));
  };

  const handlePollOptionChange = (index, value) => {
    const newOpts = [...pollOptions];
    newOpts[index] = value;
    setPollOptions(newOpts);
  };

  const handleAddCard = () => {
    if (carouselCards.length < 10) {
      setCarouselCards([...carouselCards, { title: "", body: "", buttons: [{ displayText: "", id: "1" }] }]);
    }
  };

  const handleRemoveCard = (index) => {
    setCarouselCards(carouselCards.filter((_, i) => i !== index));
  };

  const handleCardChange = (index, field, value) => {
    const newCards = [...carouselCards];
    newCards[index] = { ...newCards[index], [field]: value };
    setCarouselCards(newCards);
  };

  const handleSend = async () => {
    if (!bodyText.trim() && !["poll", "location", "cobranca"].includes(currentType)) {
      toast.error("Preencha o texto da mensagem");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        interactiveType: currentType,
        bodyText,
        footerText: footerText || undefined,
      };

      switch (currentType) {
        case "button":
          const validBtns = buttons.filter(b => b.displayText.trim());
          if (validBtns.length === 0) {
            toast.error("Adicione pelo menos um botão");
            setLoading(false);
            return;
          }
          payload.buttons = validBtns;
          break;
        case "list":
          const validSections = sections.map(s => ({
            ...s,
            rows: s.rows.filter(r => r.title.trim()),
          })).filter(s => s.rows.length > 0);
          if (validSections.length === 0) {
            toast.error("Adicione pelo menos uma opção na lista");
            setLoading(false);
            return;
          }
          payload.listButtonText = listButtonText;
          payload.sections = validSections;
          break;
        case "location":
          if (!latitude || !longitude) {
            toast.error("Preencha latitude e longitude");
            setLoading(false);
            return;
          }
          payload.latitude = parseFloat(latitude);
          payload.longitude = parseFloat(longitude);
          payload.locationName = locationName;
          payload.locationAddress = locationAddress;
          break;
        case "url":
          if (!url.trim()) {
            toast.error("Preencha a URL");
            setLoading(false);
            return;
          }
          payload.urlText = urlText;
          payload.url = url;
          break;
        case "call":
          if (!callNumber.trim()) {
            toast.error("Preencha o número de telefone");
            setLoading(false);
            return;
          }
          payload.callText = callText;
          payload.callNumber = callNumber;
          break;
        case "pix":
          if (!pixKey.trim()) {
            toast.error("Preencha a chave PIX");
            setLoading(false);
            return;
          }
          payload.pixKey = pixKey;
          payload.pixName = pixName;
          payload.pixCity = pixCity;
          payload.pixAmount = pixAmount ? parseFloat(pixAmount) : undefined;
          break;
        case "poll":
          const validOpts = pollOptions.filter(o => o.trim());
          if (validOpts.length < 2) {
            toast.error("Adicione pelo menos 2 opções");
            setLoading(false);
            return;
          }
          payload.pollQuestion = pollQuestion || bodyText;
          payload.pollOptions = validOpts;
          break;
        case "offer":
          payload.offerTitle = offerTitle;
          payload.offerPrice = offerPrice;
          payload.offerDescription = offerDescription;
          break;
        case "carousel":
        case "catalog":
          const validCards = carouselCards.filter(c => c.title.trim());
          if (validCards.length === 0) {
            toast.error("Adicione pelo menos um card");
            setLoading(false);
            return;
          }
          payload.carouselCards = validCards;
          break;
        case "cobranca":
          if (!cobrancaDescription.trim()) {
            toast.error("Preencha a descrição da cobrança");
            setLoading(false);
            return;
          }
          // Upload PDF if present
          let pdfPath = "";
          if (cobrancaPdfFile) {
            try {
              const formData = new FormData();
              formData.append("medias", cobrancaPdfFile);
              const uploadRes = await api.post("/messages/upload", formData, {
                headers: { "Content-Type": "multipart/form-data" },
              });
              pdfPath = uploadRes.data?.[0]?.filename || uploadRes.data?.filename || "";
            } catch (uploadErr) {
              toast.error("Erro ao enviar PDF");
              setLoading(false);
              return;
            }
          }
          payload.cobrancaNumber = cobrancaNumber;
          payload.cobrancaDescription = cobrancaDescription;
          payload.cobrancaQuantity = cobrancaQuantity ? parseInt(cobrancaQuantity) : 1;
          payload.cobrancaAmount = cobrancaAmount ? parseFloat(cobrancaAmount) : 0;
          payload.cobrancaMessage = cobrancaMessage;
          payload.cobrancaPaymentUrl = cobrancaPaymentUrl;
          payload.cobrancaButtonText = cobrancaButtonText || "Revisar e pagar";
          payload.cobrancaPdfPath = pdfPath;
          break;
      }

      await api.post(`/messages-interactive/${ticketId}`, payload);
      toast.success("Mensagem interativa enviada!");
      onClose();
    } catch (err) {
      const errMsg = err?.response?.data?.error || err?.message || "Erro ao enviar";
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  // ===== RENDER TABS (same as before) =====
  const renderButtonsTab = () => (
    <>
      <div className={classes.infoAlert}>
        ℹ️ Envie até 3 botões clicáveis. O cliente pode tocar em um botão para responder rapidamente.
      </div>
      <TextField label="Texto da mensagem *" fullWidth multiline rows={3} variant="outlined" value={bodyText} onChange={(e) => setBodyText(e.target.value)} className={classes.fieldRow} />
      <TextField label="Rodapé (opcional)" fullWidth variant="outlined" size="small" value={footerText} onChange={(e) => setFooterText(e.target.value)} className={classes.fieldRow} />
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography variant="subtitle2">Botões (máx. 3)</Typography>
        {buttons.length < 3 && (
          <div className={classes.addBtn} onClick={handleAddButton}><Add style={{ fontSize: 16 }} /> {i18n.t("todo.add")}</div>
        )}
      </Box>
      {buttons.map((btn, idx) => (
        <div key={idx} className={classes.optionRow}>
          <div className={classes.optionNumber}>{idx + 1}</div>
          <TextField fullWidth size="small" variant="outlined" placeholder={`Opção ${idx + 1}`} value={btn.displayText} onChange={(e) => handleButtonChange(idx, e.target.value)} inputProps={{ maxLength: 20 }} />
          {buttons.length > 1 && (
            <IconButton size="small" onClick={() => handleRemoveButton(idx)}><Delete color="error" fontSize="small" /></IconButton>
          )}
        </div>
      ))}
    </>
  );

  const renderListTab = () => (
    <>
      <div className={classes.infoAlert}>ℹ️ Envie uma lista com até 10 opções. O cliente abre um menu para selecionar.</div>
      <TextField label="Texto da mensagem *" fullWidth multiline rows={3} variant="outlined" value={bodyText} onChange={(e) => setBodyText(e.target.value)} className={classes.fieldRow} />
      <TextField label="Rodapé (opcional)" fullWidth variant="outlined" size="small" value={footerText} onChange={(e) => setFooterText(e.target.value)} className={classes.fieldRow} />
      <TextField label="Texto do botão" fullWidth variant="outlined" size="small" value={listButtonText} onChange={(e) => setListButtonText(e.target.value)} className={classes.fieldRow} />
      {sections.map((sec, sIdx) => (
        <div key={sIdx} className={classes.sectionBox}>
          <TextField label="Título da seção" fullWidth size="small" variant="outlined" value={sec.title} onChange={(e) => { const newSec = [...sections]; newSec[sIdx].title = e.target.value; setSections(newSec); }} style={{ marginBottom: 8 }} />
          {sec.rows.map((row, rIdx) => (
            <div key={rIdx} className={classes.optionRow}>
              <div className={classes.optionNumber}>{rIdx + 1}</div>
              <TextField size="small" variant="outlined" placeholder={i18n.t("chatIndex.title")} value={row.title} onChange={(e) => handleRowChange(sIdx, rIdx, "title", e.target.value)} inputProps={{ maxLength: 24 }} style={{ flex: 1 }} />
              <TextField size="small" variant="outlined" placeholder={i18n.t("chatIndex.description")} value={row.description} onChange={(e) => handleRowChange(sIdx, rIdx, "description", e.target.value)} inputProps={{ maxLength: 72 }} style={{ flex: 1 }} />
              {sec.rows.length > 1 && (
                <IconButton size="small" onClick={() => handleRemoveRow(sIdx, rIdx)}><Delete color="error" fontSize="small" /></IconButton>
              )}
            </div>
          ))}
          {sec.rows.length < 10 && (
            <div className={classes.addBtn} onClick={() => handleAddRow(sIdx)}><Add style={{ fontSize: 16 }} /> Adicionar opção</div>
          )}
        </div>
      ))}
    </>
  );

  const renderOfferTab = () => (
    <>
      <div className={classes.infoAlert}>🏷️ Envie uma oferta com título, preço e descrição.</div>
      <TextField label="Título da oferta" fullWidth variant="outlined" size="small" value={offerTitle} onChange={(e) => setOfferTitle(e.target.value)} className={classes.fieldRow} />
      <TextField label="Descrição / Corpo da mensagem *" fullWidth multiline rows={3} variant="outlined" value={bodyText} onChange={(e) => setBodyText(e.target.value)} className={classes.fieldRow} />
      <TextField label="Preço (ex: R$ 99,90)" fullWidth variant="outlined" size="small" value={offerPrice} onChange={(e) => setOfferPrice(e.target.value)} className={classes.fieldRow} />
      <TextField label="Detalhes adicionais" fullWidth variant="outlined" size="small" multiline rows={2} value={offerDescription} onChange={(e) => setOfferDescription(e.target.value)} className={classes.fieldRow} />
      <TextField label="Rodapé (opcional)" fullWidth variant="outlined" size="small" value={footerText} onChange={(e) => setFooterText(e.target.value)} className={classes.fieldRow} />
    </>
  );

  const renderPixTab = () => (
    <>
      <div className={classes.infoAlert}>💰 Envie dados PIX formatados para o cliente.</div>
      <TextField label="Texto da mensagem *" fullWidth multiline rows={2} variant="outlined" value={bodyText} onChange={(e) => setBodyText(e.target.value)} className={classes.fieldRow} />
      <TextField label="Chave PIX *" fullWidth variant="outlined" size="small" value={pixKey} onChange={(e) => setPixKey(e.target.value)} className={classes.fieldRow} placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória" />
      <TextField label="Nome do beneficiário" fullWidth variant="outlined" size="small" value={pixName} onChange={(e) => setPixName(e.target.value)} className={classes.fieldRow} />
      <TextField label="Cidade" fullWidth variant="outlined" size="small" value={pixCity} onChange={(e) => setPixCity(e.target.value)} className={classes.fieldRow} />
      <TextField label="Valor (R$)" fullWidth variant="outlined" size="small" type="number" value={pixAmount} onChange={(e) => setPixAmount(e.target.value)} className={classes.fieldRow} />
    </>
  );

  const renderUrlTab = () => (
    <>
      <div className={classes.infoAlert}>🔗 Envie um link clicável com texto personalizado.</div>
      <TextField label="Texto da mensagem *" fullWidth multiline rows={2} variant="outlined" value={bodyText} onChange={(e) => setBodyText(e.target.value)} className={classes.fieldRow} />
      <TextField label="Texto do link" fullWidth variant="outlined" size="small" value={urlText} onChange={(e) => setUrlText(e.target.value)} className={classes.fieldRow} placeholder="Clique aqui" />
      <TextField label="URL *" fullWidth variant="outlined" size="small" value={url} onChange={(e) => setUrl(e.target.value)} className={classes.fieldRow} placeholder="https://..." />
      <TextField label="Rodapé (opcional)" fullWidth variant="outlined" size="small" value={footerText} onChange={(e) => setFooterText(e.target.value)} className={classes.fieldRow} />
    </>
  );

  const renderCallTab = () => (
    <>
      <div className={classes.infoAlert}>📞 Envie uma mensagem com número para ligação.</div>
      <TextField label="Texto da mensagem *" fullWidth multiline rows={2} variant="outlined" value={bodyText} onChange={(e) => setBodyText(e.target.value)} className={classes.fieldRow} />
      <TextField label="Texto do botão" fullWidth variant="outlined" size="small" value={callText} onChange={(e) => setCallText(e.target.value)} className={classes.fieldRow} placeholder="Ligar agora" />
      <TextField label="Número de telefone *" fullWidth variant="outlined" size="small" value={callNumber} onChange={(e) => setCallNumber(e.target.value)} className={classes.fieldRow} placeholder="+5511999999999" />
    </>
  );

  const renderLocationTab = () => (
    <>
      <div className={classes.infoAlert}>📍 Envie uma localização para o cliente.</div>
      <TextField label="Texto da mensagem" fullWidth multiline rows={2} variant="outlined" value={bodyText} onChange={(e) => setBodyText(e.target.value)} className={classes.fieldRow} />
      <TextField label="Nome do local" fullWidth variant="outlined" size="small" value={locationName} onChange={(e) => setLocationName(e.target.value)} className={classes.fieldRow} />
      <TextField label="Endereço" fullWidth variant="outlined" size="small" value={locationAddress} onChange={(e) => setLocationAddress(e.target.value)} className={classes.fieldRow} />
      <Box display="flex" gap={1} style={{ gap: 8 }}>
        <TextField label="Latitude *" variant="outlined" size="small" type="number" value={latitude} onChange={(e) => setLatitude(e.target.value)} className={classes.fieldRow} style={{ flex: 1 }} placeholder="-23.5505" />
        <TextField label="Longitude *" variant="outlined" size="small" type="number" value={longitude} onChange={(e) => setLongitude(e.target.value)} className={classes.fieldRow} style={{ flex: 1 }} placeholder="-46.6333" />
      </Box>
    </>
  );

  const renderCarouselTab = () => (
    <>
      <div className={classes.infoAlert}>🎠 Envie múltiplos cards como carrossel.</div>
      <TextField label="Texto da mensagem *" fullWidth multiline rows={2} variant="outlined" value={bodyText} onChange={(e) => setBodyText(e.target.value)} className={classes.fieldRow} />
      {carouselCards.map((card, idx) => (
        <div key={idx} className={classes.sectionBox}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="subtitle2">Card {idx + 1}</Typography>
            {carouselCards.length > 1 && (<IconButton size="small" onClick={() => handleRemoveCard(idx)}><Delete color="error" fontSize="small" /></IconButton>)}
          </Box>
          <TextField label={i18n.t("chatIndex.title")} fullWidth size="small" variant="outlined" value={card.title} onChange={(e) => handleCardChange(idx, "title", e.target.value)} style={{ marginBottom: 8 }} />
          <TextField label={i18n.t("chatIndex.description")} fullWidth size="small" variant="outlined" multiline rows={2} value={card.body} onChange={(e) => handleCardChange(idx, "body", e.target.value)} />
        </div>
      ))}
      {carouselCards.length < 10 && (<div className={classes.addBtn} onClick={handleAddCard}><Add style={{ fontSize: 16 }} /> Adicionar card</div>)}
    </>
  );

  const renderCatalogTab = () => (
    <>
      <div className={classes.infoAlert}>🛍️ Envie produtos do catálogo como cards.</div>
      <TextField label="Texto da mensagem *" fullWidth multiline rows={2} variant="outlined" value={bodyText} onChange={(e) => setBodyText(e.target.value)} className={classes.fieldRow} />
      {carouselCards.map((card, idx) => (
        <div key={idx} className={classes.sectionBox}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="subtitle2">Produto {idx + 1}</Typography>
            {carouselCards.length > 1 && (<IconButton size="small" onClick={() => handleRemoveCard(idx)}><Delete color="error" fontSize="small" /></IconButton>)}
          </Box>
          <TextField label="Nome do produto" fullWidth size="small" variant="outlined" value={card.title} onChange={(e) => handleCardChange(idx, "title", e.target.value)} style={{ marginBottom: 8 }} />
          <TextField label="Descrição / Preço" fullWidth size="small" variant="outlined" multiline rows={2} value={card.body} onChange={(e) => handleCardChange(idx, "body", e.target.value)} />
        </div>
      ))}
      {carouselCards.length < 10 && (<div className={classes.addBtn} onClick={handleAddCard}><Add style={{ fontSize: 16 }} /> Adicionar produto</div>)}
    </>
  );

  const renderPollTab = () => (
    <>
      <div className={classes.infoAlert}>
        📊 Crie uma enquete para o cliente votar. {ticketChannel === "whatsapp_oficial" && "(Será enviada como texto formatado na API Oficial)"}
      </div>
      <TextField label="Pergunta da enquete *" fullWidth multiline rows={2} variant="outlined" value={pollQuestion || bodyText} onChange={(e) => { setPollQuestion(e.target.value); if (!bodyText) setBodyText(e.target.value); }} className={classes.fieldRow} />
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography variant="subtitle2">Opções (mín. 2, máx. 12)</Typography>
        {pollOptions.length < 12 && (<div className={classes.addBtn} onClick={handleAddPollOption}><Add style={{ fontSize: 16 }} /> {i18n.t("todo.add")}</div>)}
      </Box>
      {pollOptions.map((opt, idx) => (
        <div key={idx} className={classes.optionRow}>
          <div className={classes.optionNumber}>{idx + 1}</div>
          <TextField fullWidth size="small" variant="outlined" placeholder={`Opção ${idx + 1}`} value={opt} onChange={(e) => handlePollOptionChange(idx, e.target.value)} />
          {pollOptions.length > 2 && (<IconButton size="small" onClick={() => handleRemovePollOption(idx)}><Delete color="error" fontSize="small" /></IconButton>)}
        </div>
      ))}
    </>
  );

  const renderCobrancaTab = () => (
    <>
      <div className={classes.infoAlert}>🧾 Envie uma cobrança com detalhes do pagamento e botão "Revisar e pagar".</div>
      <TextField label="Nº da cobrança" fullWidth variant="outlined" size="small" value={cobrancaNumber} onChange={(e) => setCobrancaNumber(e.target.value)} className={classes.fieldRow} placeholder="DJ89J1E0ZTK" />
      <TextField label="Descrição da cobrança *" fullWidth multiline rows={2} variant="outlined" value={cobrancaDescription} onChange={(e) => setCobrancaDescription(e.target.value)} className={classes.fieldRow} placeholder="Cobrança pensão das crianças" />
      <Box display="flex" style={{ gap: 8 }}>
        <TextField label="Quantidade" variant="outlined" size="small" type="number" value={cobrancaQuantity} onChange={(e) => setCobrancaQuantity(e.target.value)} className={classes.fieldRow} style={{ flex: 1 }} />
        <TextField label="Valor total (R$) *" variant="outlined" size="small" type="number" value={cobrancaAmount} onChange={(e) => setCobrancaAmount(e.target.value)} className={classes.fieldRow} style={{ flex: 1 }} placeholder="199.99" />
      </Box>
      <TextField label="Mensagem personalizada" fullWidth multiline rows={2} variant="outlined" value={cobrancaMessage} onChange={(e) => setCobrancaMessage(e.target.value)} className={classes.fieldRow} placeholder="pague se não cadeia" />
      <TextField label="Rodapé (opcional)" fullWidth variant="outlined" size="small" value={footerText} onChange={(e) => setFooterText(e.target.value)} className={classes.fieldRow} placeholder="Cobrança #666" />
      <Divider style={{ margin: "12px 0" }} />
      <Typography variant="subtitle2" style={{ marginBottom: 8 }}>📄 Anexar PDF / Boleto (opcional)</Typography>
      <Box display="flex" alignItems="center" style={{ gap: 8, marginBottom: 12 }}>
        <Button
          variant="outlined"
          component="label"
          size="small"
          style={{ textTransform: "none" }}
        >
          {cobrancaPdfName || "Selecionar PDF"}
          <input
            type="file"
            accept=".pdf,application/pdf"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                if (file.size > 16 * 1024 * 1024) {
                  toast.error("PDF muito grande (máx. 16MB)");
                  return;
                }
                setCobrancaPdfFile(file);
                setCobrancaPdfName(file.name);
              }
            }}
          />
        </Button>
        {cobrancaPdfFile && (
          <IconButton size="small" onClick={() => { setCobrancaPdfFile(null); setCobrancaPdfName(""); }}>
            <Delete color="error" fontSize="small" />
          </IconButton>
        )}
      </Box>
      <Divider style={{ margin: "12px 0" }} />
      <Typography variant="subtitle2" style={{ marginBottom: 8 }}>Botão de pagamento</Typography>
      <TextField label="Texto do botão" fullWidth variant="outlined" size="small" value={cobrancaButtonText} onChange={(e) => setCobrancaButtonText(e.target.value)} className={classes.fieldRow} />
      <TextField label="URL de pagamento (opcional)" fullWidth variant="outlined" size="small" value={cobrancaPaymentUrl} onChange={(e) => setCobrancaPaymentUrl(e.target.value)} className={classes.fieldRow} placeholder="https://pay.example.com/invoice/123" helperText="Se preenchido, o botão será um link clicável (CTA URL)" />
    </>
  );


  const renderPreview = () => {
    const type = currentType;
    return (
      <Paper className={classes.previewBox} elevation={2}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="caption" style={{ color: "#4FC3F7", fontWeight: 600 }}>● Preview da Mensagem</Typography>
          <Typography variant="caption" style={{ color: "rgba(255,255,255,0.5)" }}>{new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</Typography>
        </Box>
        <div className={classes.previewTitle}>{type === "cobranca" ? (cobrancaDescription || "Descrição da cobrança...") : (offerTitle || bodyText || pollQuestion || "Corpo da mensagem...")}</div>
        {type === "cobranca" && (
          <>
            {cobrancaNumber && <div className={classes.previewBody} style={{ fontSize: 10, opacity: 0.6, textTransform: "uppercase", letterSpacing: 1 }}>Nº DA COBRANÇA: {cobrancaNumber}</div>}
            <div className={classes.previewBody}>{cobrancaDescription || "..."}<br/>Quantidade: {cobrancaQuantity || 1}</div>
            <Box display="flex" justifyContent="space-between" style={{ marginBottom: 8 }}>
              <Typography style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>{i18n.t("connections.total")}</Typography>
              <Typography style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>BRL {cobrancaAmount ? parseFloat(cobrancaAmount).toFixed(2).replace(".", ",") : "0,00"}</Typography>
            </Box>
            {cobrancaMessage && <div className={classes.previewBody}>{cobrancaMessage}</div>}
          </>
        )}
        {type !== "cobranca" && footerText && <div className={classes.previewFooter}>{footerText}</div>}
        {type === "cobranca" && footerText && <div className={classes.previewFooter}>{footerText}</div>}
        {type === "button" && buttons.filter(b => b.displayText.trim()).map((btn, i) => (<div key={i} className={classes.previewButton}>{btn.displayText}</div>))}
        {type === "list" && (<div className={classes.previewButton}><FormatListBulleted style={{ fontSize: 14, verticalAlign: "middle", marginRight: 4 }} />{listButtonText || "Selecionar"}</div>)}
        {type === "pix" && pixKey && (<div className={classes.previewBody}>💰 Chave PIX: {pixKey}{pixAmount && `\n💵 R$ ${parseFloat(pixAmount).toFixed(2)}`}</div>)}
        {type === "url" && url && (<div className={classes.previewButton}>🔗 {urlText || url}</div>)}
        {type === "call" && callNumber && (<div className={classes.previewButton}>📞 {callText || "Ligar"}</div>)}
        {type === "location" && (<div className={classes.previewBody}>📍 {locationName || "Localização"}</div>)}
        {type === "poll" && pollOptions.filter(o => o.trim()).map((o, i) => (<div key={i} className={classes.previewBody}>○ {o}</div>))}
        {type === "cobranca" && (<div className={classes.previewButton}>{cobrancaButtonText || "Revisar e pagar"}</div>)}
      </Paper>
    );
  };

  const renderTabContent = () => {
    switch (currentType) {
      case "button": return renderButtonsTab();
      case "list": return renderListTab();
      case "cobranca": return renderCobrancaTab();
      case "offer": return renderOfferTab();
      case "pix": return renderPixTab();
      case "url": return renderUrlTab();
      case "call": return renderCallTab();
      case "location": return renderLocationTab();
      case "carousel": return renderCarouselTab();
      case "catalog": return renderCatalogTab();
      case "poll": return renderPollTab();
      default: return null;
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} classes={{ paper: classes.dialogPaper }} scroll="paper">
        <div className={classes.header}>
          <div className={classes.headerTitle}>
            <Send style={{ color: "#4CAF50", transform: "rotate(-30deg)" }} />
            <div>
              <Typography variant="subtitle1" style={{ fontWeight: 600, lineHeight: 1.2 }}>
                Enviar Mensagem Interativa
              </Typography>
              <Typography variant="caption" color="textSecondary">
                {activeTemplateName ? `📋 Template: ${activeTemplateName}` : "Envie mensagens com botões, listas, ofertas, PIX ou links"}
              </Typography>
            </div>
          </div>
          <IconButton size="small" onClick={onClose}><Close /></IconButton>
        </div>

        {/* Template bar */}
        <div className={classes.templateBar}>
          <Tooltip title="Carregar template salvo">
            <Chip
              icon={<FolderOpen style={{ fontSize: 16 }} />}
              label={`Modelos (${filteredTemplates.length})`}
              size="small"
              variant="outlined"
              clickable
              className={classes.templateChip}
              onClick={(e) => setTemplateMenuAnchor(e.currentTarget)}
            />
          </Tooltip>
          <Tooltip title="Salvar como template">
            <Chip
              icon={<Save style={{ fontSize: 16 }} />}
              label={i18n.t("wallets.save")}
              size="small"
              color="primary"
              clickable
              className={classes.templateChip}
              onClick={() => setSaveDialogOpen(true)}
            />
          </Tooltip>
          {activeTemplateName && (
            <Chip
              icon={<Bookmark style={{ fontSize: 14 }} />}
              label={activeTemplateName}
              size="small"
              color="secondary"
              onDelete={() => setActiveTemplateName("")}
              style={{ fontSize: 11 }}
            />
          )}
        </div>

        {/* Template load menu */}
        <Menu
          anchorEl={templateMenuAnchor}
          open={Boolean(templateMenuAnchor)}
          onClose={() => setTemplateMenuAnchor(null)}
          classes={{ paper: classes.templateMenu }}
        >
          {filteredTemplates.length === 0 ? (
            <MenuItem disabled>
              <ListItemText primary="Nenhum template salvo para este tipo" />
            </MenuItem>
          ) : (
            filteredTemplates.map((tpl) => (
              <MenuItem key={tpl.id} onClick={() => loadTemplateData(tpl)}>
                <ListItemIcon><BookmarkBorder fontSize="small" /></ListItemIcon>
                <ListItemText primary={tpl.name} />
                <IconButton size="small" onClick={(e) => handleDeleteTemplate(tpl.id, e)}>
                  <Delete fontSize="small" color="error" />
                </IconButton>
              </MenuItem>
            ))
          )}
        </Menu>

        <Tabs
          value={activeTab}
          onChange={(_, v) => { setActiveTab(v); setActiveTemplateName(""); }}
          variant="scrollable"
          scrollButtons="auto"
          indicatorColor="primary"
          textColor="primary"
          classes={{ root: classes.tabsRoot }}
        >
          {TAB_CONFIG.map((tab, i) => (
            <Tab key={i} icon={tab.icon} label={tab.label} classes={{ root: classes.tab }} />
          ))}
        </Tabs>

        <DialogContent className={classes.content}>
          {renderTabContent()}
          {renderPreview()}
        </DialogContent>

        <DialogActions style={{ padding: "8px 16px" }}>
          <Button onClick={onClose} color="default">{i18n.t("wallets.cancel")}</Button>
          <Button variant="contained" color="primary" onClick={handleSend} disabled={loading} startIcon={loading ? null : <Send />}>
            {loading ? "Enviando..." : i18n.t("chatMessages.send")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Save template dialog */}
      <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)}>
        <DialogTitle>Salvar Template</DialogTitle>
        <DialogContent className={classes.saveDialog}>
          <Typography variant="body2" color="textSecondary" style={{ marginBottom: 12 }}>
            Salve a configuração atual como um modelo reutilizável para o tipo <strong>{TAB_CONFIG[activeTab]?.label}</strong>.
          </Typography>
          <TextField
            label="Nome do template"
            fullWidth
            variant="outlined"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            autoFocus
            placeholder="Ex: Boas-vindas com botões"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialogOpen(false)}>{i18n.t("wallets.cancel")}</Button>
          <Button variant="contained" color="primary" onClick={handleSaveTemplate} startIcon={<Save />}>
            {i18n.t("wallets.save")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default InteractiveMessageModal;
