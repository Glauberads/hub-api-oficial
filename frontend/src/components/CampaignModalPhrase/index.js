import React, { useState, useContext, useRef, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogActions,
  Button,
  TextField,
  Stack,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Checkbox,
  IconButton,
  Box,
  Autocomplete,
  ListItemText,
  Divider,
  Alert,
  Chip
} from "@mui/material";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
} from "@mui/icons-material";
import { makeStyles } from "@mui/styles";
import { green, red } from "@mui/material/colors";
import { AuthContext } from "../../context/Auth/AuthContext";
import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import { toast } from "react-toastify";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexWrap: "wrap",
  },
  textField: {
    marginRight: 8,
    flex: 1,
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
  online: {
    color: green[500],
  },
  offline: {
    color: red[500],
  },
  phraseContainer: {
    border: "1px solid #e0e0e0",
    borderRadius: "8px",
    padding: "16px",
    marginBottom: "8px",
    backgroundColor: "#fafafa"
  },
  addButton: {
    alignSelf: 'flex-start',
    marginTop: "8px"
  },
  whatsappChip: {
    margin: "2px"
  }
}));

// Helper de normalização de IDs
const normalizeIdArray = (value) => {
  if (value === null || value === undefined || value === "") return [];

  let items = [];

  if (Array.isArray(value)) {
    items = value;
  } else if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      items = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      items = trimmed.split(",").map(item => item.trim());
    }
  } else {
    items = [value];
  }

  return [...new Set(
    items
      .map(item => Number(item))
      .filter(item => Number.isInteger(item) && item > 0)
  )];
};

const CampaignModalPhrase = ({ open, onClose, FlowCampaignId, onSave }) => {
  const classes = useStyles();
  const isMounted = useRef(true);
  const { user } = useContext(AuthContext);
  
  const companyId = user?.companyId;

  // Estados básicos
  const [campaignEditable, setCampaignEditable] = useState(true);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(true);

  // Estados do formulário
  const [dataItem, setDataItem] = useState({
    name: "",
  });

  const [dataItemError, setDataItemError] = useState({
    name: false,
    flowId: false,
    phrases: false,
    whatsappIds: false, // NOVA VALIDAÇÃO
  });

  // Estado para múltiplas frases
  const [phrases, setPhrases] = useState([
    { text: "", type: "exact" }
  ]);

  // Estados para flows e whatsapp
  const [flowSelected, setFlowSelected] = useState(null);
  const [flowsData, setFlowsData] = useState([]);
  const [flowsDataComplete, setFlowsDataComplete] = useState([]);
  
  // Estado para múltiplas conexões
  const [selectedWhatsapps, setSelectedWhatsapps] = useState([]);
  const [whatsApps, setWhatsApps] = useState([]);

  // Estado para filtro de tags
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);

  // Buscar flows
  const getFlows = async () => {
    try {
      const flows = await api.get("/flowbuilder");
      if (isMounted.current) {
        setFlowsDataComplete(flows.data.flows || []);
        setFlowsData((flows.data.flows || []).map((flow) => flow.name));
      }
      return flows.data.flows || [];
    } catch (error) {
      console.error("Erro ao buscar flows:", error);
      if (isMounted.current) {
        toast.error("Erro ao carregar fluxos");
      }
      return [];
    }
  };

  // Buscar WhatsApps
  const getWhatsApps = async () => {
    try {
      const response = await api.get("/whatsapp");
      if (isMounted.current) {
        setWhatsApps(response.data || []);
      }
    } catch (error) {
      console.error("Erro ao buscar WhatsApps:", error);
      if (isMounted.current) {
        toast.error("Erro ao carregar conexões");
      }
    }
  };

  // Buscar Tags disponíveis
  const getTags = async () => {
    try {
      const response = await api.get("/tags");
      if (isMounted.current) {
        setAvailableTags(response.data?.tags || response.data || []);
      }
    } catch (error) {
      console.error("Erro ao buscar tags:", error);
    }
  };

  // Carregar dados se for edição
  const detailsPhrase = async (flows) => {
    if (!FlowCampaignId || !isMounted.current) return;
    
    setLoading(true);
    try {
      console.log(`Buscando dados da campanha ID: ${FlowCampaignId}`);
      const response = await api.get(`/flowcampaign/${FlowCampaignId}`);
      console.log("Resposta da API detailsPhrase:", response.data);
      
      const details = response.data;
      
      if (!isMounted.current) return;
      
      // Preencher nome da campanha
      setDataItem({
        name: details.name || "",
      });
      
      // Preencher status
      setActive(details.status !== false);
      
      // NORMALIZAR WhatsApps selecionados
      const normalizedWhatsappIds = normalizeIdArray(
        details.whatsappIds && details.whatsappIds.length
          ? details.whatsappIds
          : details.whatsappId
      );
      
      setSelectedWhatsapps(normalizedWhatsappIds);
      console.log("[FLOWCAMPAIGN][LOAD] whatsappIds recebidos:", details.whatsappIds, "normalizados:", normalizedWhatsappIds);

      // NORMALIZAR tags selecionadas
      setSelectedTagIds(normalizeIdArray(details.tagIds));
      
      // Processar frases
      let parsedPhrases = [];
      try {
        if (details.phrase) {
          if (typeof details.phrase === 'string') {
            try {
              const parsed = JSON.parse(details.phrase);
              if (Array.isArray(parsed)) {
                parsedPhrases = parsed;
              } else {
                parsedPhrases = [{ text: details.phrase, type: 'exact' }];
              }
            } catch {
              parsedPhrases = [{ text: details.phrase, type: 'exact' }];
            }
          } else if (Array.isArray(details.phrase)) {
            parsedPhrases = details.phrase;
          } else if (typeof details.phrase === 'object') {
            parsedPhrases = [details.phrase];
          }
        }
        
        parsedPhrases = parsedPhrases.map(phrase => ({
          text: phrase.text || phrase,
          type: phrase.type || 'exact'
        }));
        
        if (parsedPhrases.length === 0) {
          parsedPhrases = [{ text: "", type: "exact" }];
        }
        
        console.log("Frases processadas:", parsedPhrases);
        setPhrases(parsedPhrases);
      } catch (error) {
        console.error("Erro ao processar frases:", error);
        setPhrases([{ text: "", type: "exact" }]);
      }
      
      // Selecionar flow
      if (details.flowId && flows && flows.length > 0) {
        const foundFlow = flows.find((flow) => flow.id === details.flowId);
        if (foundFlow) {
          console.log("Flow encontrado:", foundFlow.name);
          setFlowSelected(foundFlow.name);
        } else {
          console.warn("Flow não encontrado para ID:", details.flowId);
        }
      }
      
    } catch (error) {
      console.error("Erro ao carregar detalhes:", error);
      if (isMounted.current) {
        toast.error("Erro ao carregar dados da campanha");
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  // Resetar estados quando modal abre/fecha
  const resetForm = () => {
    setDataItem({ name: "" });
    setPhrases([{ text: "", type: "exact" }]);
    setFlowSelected(null);
    setSelectedWhatsapps([]);
    setSelectedTagIds([]);
    setActive(true);
    clearErrors();
  };

  // Inicialização
  useEffect(() => {
    isMounted.current = true;
    
    const initData = async () => {
      if (open) {
        console.log("Modal aberto. FlowCampaignId:", FlowCampaignId);
        
        resetForm();
        
        const flows = await getFlows();
        await getWhatsApps();
        await getTags();
        
        if (FlowCampaignId) {
          await detailsPhrase(flows);
        }
      }
    };
    
    initData();

    return () => {
      isMounted.current = false;
    };
  }, [open, FlowCampaignId]);

  // Função para adicionar nova frase
  const addPhraseField = () => {
    setPhrases(prevPhrases => [...prevPhrases, { text: "", type: "exact" }]);
  };

  // Função para remover frase
  const removePhraseField = (index) => {
    if (phrases.length > 1) {
      setPhrases(prevPhrases => prevPhrases.filter((_, i) => i !== index));
    }
  };

  // Função para atualizar frase específica
  const updatePhrase = (index, field, value) => {
    setPhrases(prevPhrases => {
      const newPhrases = [...prevPhrases];
      if (newPhrases[index]) {
        newPhrases[index] = { ...newPhrases[index], [field]: value };
      }
      return newPhrases;
    });
  };

  // Validação
  const validateForm = () => {
    const errors = {
      name: !dataItem.name.trim(),
      flowId: !flowSelected,
      phrases: phrases.length === 0 || phrases.some(p => !p.text.trim()),
      whatsappIds: selectedWhatsapps.length === 0 // NOVA VALIDAÇÃO
    };
    
    setDataItemError(errors);
    return !Object.values(errors).some(error => error);
  };

  // Limpar erros
  const clearErrors = () => {
    setDataItemError({
      name: false,
      flowId: false,
      phrases: false,
      whatsappIds: false,
    });
  };

  // Handler para mudanças no campo nome
  const handleNameChange = (event) => {
    const value = event.target.value;
    setDataItem(prev => ({ ...prev, name: value }));
    
    if (value.trim() && dataItemError.name) {
      setDataItemError(prev => ({ ...prev, name: false }));
    }
  };

  // HANDLER NORMALIZADO para mudanças na seleção de WhatsApps
  const handleWhatsappChange = (event) => {
    const normalized = normalizeIdArray(event.target.value);
    setSelectedWhatsapps(normalized);

    console.log("[FLOWCAMPAIGN][CHANGE] selecionados:", normalized);

    if (normalized.length > 0 && dataItemError.whatsappIds) {
      setDataItemError(prev => ({ ...prev, whatsappIds: false }));
    }
  };

  // Salvar
  const handleSave = async () => {
    // NORMALIZAR antes de salvar
    const normalizedSelectedWhatsapps = normalizeIdArray(selectedWhatsapps);
    const normalizedSelectedTagIds = normalizeIdArray(selectedTagIds);

    // VALIDAR após normalização
    if (normalizedSelectedWhatsapps.length === 0) {
      toast.error("Selecione pelo menos uma conexão válida");
      setDataItemError(prev => ({ ...prev, whatsappIds: true }));
      return;
    }

    if (!dataItem.name.trim()) {
      toast.error("Nome da campanha é obrigatório");
      setDataItemError(prev => ({ ...prev, name: true }));
      return;
    }

    if (!flowSelected) {
      toast.error("Selecione um fluxo");
      setDataItemError(prev => ({ ...prev, flowId: true }));
      return;
    }

    const validPhrases = phrases.filter(p => p.text.trim());
    if (validPhrases.length === 0) {
      toast.error("Pelo menos uma palavra/frase é obrigatória");
      setDataItemError(prev => ({ ...prev, phrases: true }));
      return;
    }

    setLoading(true);
    
    try {
      const flowIdSelected = flowsDataComplete.find(flow => flow.name === flowSelected)?.id;
      
      if (!flowIdSelected) {
        toast.error("Fluxo selecionado não encontrado");
        return;
      }

      const payload = {
        name: dataItem.name.trim(),
        flowId: Number(flowIdSelected),
        phrases: validPhrases,
        whatsappIds: normalizedSelectedWhatsapps,
        tagIds: normalizedSelectedTagIds,
        status: active,
        ...(FlowCampaignId && { id: Number(FlowCampaignId) })
      };

      console.log("[FLOWCAMPAIGN][SAVE] payload final:", payload);

      if (FlowCampaignId) {
        await api.put("/flowcampaign", payload);
        toast.success("Campanha atualizada com sucesso!");
      } else {
        await api.post("/flowcampaign", payload);
        toast.success("Campanha criada com sucesso!");
      }

      onSave && onSave();
      handleClose();
      
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar campanha");
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  // Fechar modal
  const handleClose = () => {
    if (!isMounted.current) return;
    
    resetForm();
    onClose();
  };

  // Verificação de segurança antes de renderizar
  if (!user || !companyId) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="md"
      scroll="paper"
      disableEscapeKeyDown={loading}
    >
      <DialogTitle>
        {campaignEditable ? (
          <>
            {FlowCampaignId
              ? `${i18n.t("campaignsPhrase.editCampaignWithFlowByPhrase")}`
              : `${i18n.t("campaignsPhrase.newCampaignWithFlowByPhrase")}`}
          </>
        ) : (
          <>{`${i18n.t("campaigns.dialog.readonly")}`}</>
        )}
      </DialogTitle>

      {!loading && (
        <Stack sx={{ padding: "24px", gap: "20px" }}>
          {/* Nome da Campanha */}
          <Stack gap={1}>
            <Typography variant="subtitle1" fontWeight={500}>
              {i18n.t("campaignsPhrase.phraseTriggerName")}
            </Typography>
            <TextField
              label={i18n.t("automation.flowCampaigns.campaignName")}
              name="name"
              variant="outlined"
              error={dataItemError.name}
              value={dataItem.name}
              margin="dense"
              onChange={handleNameChange}
              className={classes.textField}
              style={{ width: "100%" }}
              helperText={dataItemError.name ? i18n.t("automation.flowCampaigns.nameRequired") : ""}
              disabled={loading}
            />
          </Stack>

          {/* Seleção do Fluxo */}
          <Stack gap={1}>
            <Typography variant="subtitle1" fontWeight={500}>
              {i18n.t("campaignsPhrase.chooseAStream")}
            </Typography>
            <Autocomplete
              value={flowSelected}
              onChange={(event, newValue) => {
                setFlowSelected(newValue);
                if (newValue && dataItemError.flowId) {
                  setDataItemError(prev => ({ ...prev, flowId: false }));
                }
              }}
              options={flowsData}
              disabled={loading}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={i18n.t("automation.flowCampaigns.selectFlow")}
                  variant="outlined"
                  error={dataItemError.flowId}
                  helperText={dataItemError.flowId ? i18n.t("automation.flowCampaigns.flowRequired") : ""}
                />
              )}
              style={{ width: "100%" }}
            />
          </Stack>

          {/* Seleção de Múltiplas Conexões WhatsApp com ID visível */}
          <Stack gap={1}>
            <Typography variant="subtitle1" fontWeight={500}>
              {i18n.t("automation.flowCampaigns.selectConnections")}
            </Typography>
            <FormControl fullWidth variant="outlined" error={dataItemError.whatsappIds}>
              <InputLabel>{i18n.t("automation.flowCampaigns.whatsappConnections")}</InputLabel>
              <Select
                multiple
                value={selectedWhatsapps}
                onChange={handleWhatsappChange}
                label={i18n.t("automation.flowCampaigns.whatsappConnections")}
                disabled={loading}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((whatsappId) => {
                      const whatsapp = whatsApps.find(w => w.id === whatsappId);
                      return (
                        <Chip 
                          key={whatsappId} 
                          label={whatsapp ? `${whatsapp.name} - ID ${whatsapp.id}` : `ID: ${whatsappId}`}
                          className={classes.whatsappChip}
                          size="small"
                          color={whatsapp?.status === "CONNECTED" ? "success" : "default"}
                        />
                      );
                    })}
                  </Box>
                )}
              >
                {whatsApps?.length > 0 &&
                  whatsApps.map((whatsapp) => (
                    <MenuItem key={whatsapp.id} value={whatsapp.id}>
                      <Checkbox checked={selectedWhatsapps.indexOf(whatsapp.id) > -1} />
                      <ListItemText
                        primary={
                          <Typography component="span" style={{ fontSize: 14 }}>
                            {whatsapp.name} - ID {whatsapp.id} &nbsp;
                            <span
                              className={
                                whatsapp.status === "CONNECTED"
                                  ? classes.online
                                  : classes.offline
                              }
                            >
                              ({whatsapp.status})
                            </span>
                          </Typography>
                        }
                      />
                    </MenuItem>
                  ))}
              </Select>
              {dataItemError.whatsappIds && (
                <Typography variant="caption" color="error" sx={{ mt: 1, ml: 2 }}>
                  {i18n.t("automation.flowCampaigns.connectionRequired")}
                </Typography>
              )}
            </FormControl>
            
            {/* Informação sobre conexões selecionadas */}
            {selectedWhatsapps.length > 0 && (
              <Alert severity="info" sx={{ mt: 1 }}>
                <Typography variant="body2">
                  {i18n.t("automation.flowCampaigns.selectedConnections", { count: selectedWhatsapps.length })}
                </Typography>
              </Alert>
            )}
          </Stack>

          {/* Filtro por Tags do Contato */}
          <Stack gap={1}>
            <Typography variant="subtitle1" fontWeight={500}>
              {i18n.t("automation.flowCampaigns.filterTag")} <span style={{ fontWeight: 400, fontSize: 13, color: "#888" }}>({i18n.t("automation.common.optional")})</span>
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {i18n.t("automation.flowCampaigns.filterTagHelp")}
            </Typography>
            <FormControl fullWidth variant="outlined">
              <InputLabel>{i18n.t("automation.flowCampaigns.tagsOptional")}</InputLabel>
              <Select
                multiple
                value={selectedTagIds}
                onChange={(e) => setSelectedTagIds(normalizeIdArray(e.target.value))}
                label={i18n.t("automation.flowCampaigns.tagsOptional")}
                disabled={loading}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((tagId) => {
                      const tag = availableTags.find(t => t.id === tagId);
                      return (
                        <Chip
                          key={tagId}
                          label={tag ? tag.name : `Tag ${tagId}`}
                          size="small"
                          style={{ backgroundColor: tag?.color || '#aaa', color: '#fff' }}
                        />
                      );
                    })}
                  </Box>
                )}
              >
                {availableTags.map((tag) => (
                  <MenuItem key={tag.id} value={tag.id}>
                    <Checkbox checked={selectedTagIds.indexOf(tag.id) > -1} />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: tag.color || '#aaa' }} />
                      <ListItemText primary={tag.name} />
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {selectedTagIds.length > 0 && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                <Typography variant="body2">
                  🏷️ {i18n.t("automation.flowCampaigns.activeTagFilter", { count: selectedTagIds.length })}
                </Typography>
              </Alert>
            )}
          </Stack>

          <Divider />

          {/* Seção de Palavras-chave */}
          <Stack gap={2}>
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="subtitle1" fontWeight={500}>
                {i18n.t("automation.flowCampaigns.keywords")}
              </Typography>
            </Box>

            <Alert severity="success" sx={{ mb: 1 }}>
              <Typography variant="body2">
                🔀 {i18n.t("automation.flowCampaigns.orLogicHelp")}
              </Typography>
            </Alert>

            {phrases.map((phrase, index) => (
              <Box key={index} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                {index > 0 && (
                  <Chip
                    label="OU"
                    size="small"
                    color="warning"
                    sx={{ fontWeight: 700, minWidth: 36, fontSize: 11 }}
                  />
                )}
                <Box className={classes.phraseContainer} sx={{ flex: 1, display: "flex", alignItems: "center", gap: 1, p: 1.5, mb: 0 }}>
                  <TextField
                    label={i18n.t("automation.flowCampaigns.keywordNumber", { number: index + 1 })}
                    value={phrase.text}
                    onChange={(e) => {
                      updatePhrase(index, 'text', e.target.value);
                      if (e.target.value.trim() && dataItemError.phrases) {
                        setDataItemError(prev => ({ ...prev, phrases: false }));
                      }
                    }}
                    variant="outlined"
                    size="small"
                    fullWidth
                    placeholder="Ex: oi, olá, quero orçamento..."
                    error={dataItemError.phrases && !phrase.text.trim()}
                    helperText={dataItemError.phrases && !phrase.text.trim() ? i18n.t("automation.common.required") : ""}
                    disabled={loading}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addPhraseField();
                      }
                    }}
                  />

                  <FormControl sx={{ minWidth: 120 }} size="small">
                    <InputLabel>{i18n.t("queueIntegration.table.type")}</InputLabel>
                    <Select
                      value={phrase.type}
                      onChange={(e) => updatePhrase(index, 'type', e.target.value)}
                      label={i18n.t("queueIntegration.table.type")}
                      disabled={loading}
                    >
                      <MenuItem value="exact">{i18n.t("automation.flowCampaigns.exact")}</MenuItem>
                      <MenuItem value="partial">{i18n.t("automation.flowCampaigns.partial")}</MenuItem>
                    </Select>
                  </FormControl>

                  <IconButton
                    onClick={() => removePhraseField(index)}
                    color="error"
                    size="small"
                    disabled={loading || phrases.length === 1}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
            ))}

            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={addPhraseField}
              className={classes.addButton}
              disabled={loading}
              size="small"
            >
              {i18n.t("automation.flowCampaigns.addKeyword")}
            </Button>
          </Stack>

          <Divider />

          {/* Status */}
          <Stack direction="row" gap={2} alignItems="center">
            <Typography variant="subtitle1" fontWeight={500}>
              {i18n.t("campaignsPhrase.status")}
            </Typography>
            <Checkbox
              checked={active}
              onChange={() => setActive(prev => !prev)}
              disabled={loading}
            />
            <Typography variant="body2" color="textSecondary">
              {active ? i18n.t("announcements.active") : i18n.t("campaignReport.inactive")}
            </Typography>
          </Stack>
        </Stack>
      )}

      <DialogActions sx={{ padding: "16px 24px" }}>
        <Button
          variant="outlined"
          onClick={handleClose}
          disabled={loading}
        >
          {i18n.t("campaignsPhrase.cancel")}
        </Button>
        
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={loading}
        >
          {loading ? i18n.t("automation.common.saving") : FlowCampaignId ? i18n.t("mainDrawer.appBar.refresh") : i18n.t("automation.common.create")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CampaignModalPhrase;
