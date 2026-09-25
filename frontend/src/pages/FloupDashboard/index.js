import React, { useEffect, useState, useContext } from "react";
import {
  Paper,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Chip,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  IconButton,
  Tooltip,
  Divider,
  Avatar
} from "@material-ui/core";
import {
  PlayArrow,
  Pause,
  Error,
  Search,
  Refresh
} from "@material-ui/icons";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import api from "../../services/api";
import { useHistory } from "react-router-dom";
import { AuthContext } from "../../context/Auth/AuthContext";
import { i18n } from "../../translate/i18n";

const FloupDashboard = () => {
  const history = useHistory();
  const { user, socket } = useContext(AuthContext);
  const [floups, setFloups] = useState([]);
  const [selectedFloupId, setSelectedFloupId] = useState(null);
  const [floupData, setFloupData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingFloups, setLoadingFloups] = useState(true);
  const [filters, setFilters] = useState({
    channel: "",
    search: ""
  });

  // Canais disponíveis
  const channels = ["whatsapp", "whatsapp_oficial", "facebook", "instagram"];

  const loadFloups = async () => {
    try {
      setLoadingFloups(true);
      const { data } = await api.get("/plugins/floup");
      setFloups(data || []);
      // Se não há Floup selecionado e há Floups disponíveis, selecionar o primeiro
      if (data && data.length > 0) {
        setSelectedFloupId((prev) => prev || data[0].id);
      }
    } catch (error) {
      console.error("Erro ao carregar Floups:", error);
    } finally {
      setLoadingFloups(false);
    }
  };

  const loadFloupDashboard = async () => {
    if (!selectedFloupId) {
      setFloupData(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.channel) params.append("channel", filters.channel);
      if (filters.search) params.append("search", filters.search);

      const { data } = await api.get(`/plugins/floup/dashboard/${selectedFloupId}?${params.toString()}`);
      setFloupData(data);
    } catch (error) {
      console.error("Erro ao carregar dashboard do Floup:", error);
      setFloupData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFloups();
  }, []);

  useEffect(() => {
    loadFloupDashboard();
    
    // Atualizar a cada 30 segundos
    const interval = setInterval(() => {
      loadFloupDashboard();
    }, 30000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFloupId, filters]);

  // Listener de socket para atualizar quando um Floup é cancelado
  useEffect(() => {
    if (!socket || !user?.companyId) return;

    const companyId = user.companyId;
    const eventName = `company-${companyId}-floup-stopped`;

    const onFloupStopped = (data) => {
      console.log('[FLOUP DASHBOARD] Socket event floup-stopped recebido', data);
      // Se o evento é para o Floup selecionado (ou não há Floup selecionado), recarregar imediatamente
      if (!selectedFloupId || data.floupId === selectedFloupId) {
        console.log('[FLOUP DASHBOARD] Floup cancelado, recarregando dashboard...');
        // Aguardar um pouco para garantir que o backend processou
        setTimeout(() => {
          loadFloupDashboard();
        }, 500);
      }
    };

    socket.on(eventName, onFloupStopped);

    return () => {
      socket.off(eventName, onFloupStopped);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, user?.companyId, selectedFloupId, loadFloupDashboard]);

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleFloupChange = (floupId) => {
    setSelectedFloupId(floupId);
    setFloupData(null);
  };

  const renderContactCard = (contact) => {
    const handleContactClick = () => {
      console.log('[FLOUP DASHBOARD] Clicou no contato:', {
        contactId: contact.contactId,
        ticketUuid: contact.ticketUuid,
        ticketId: contact.ticketId,
        ticketStatus: contact.ticketStatus
      });
      
      if (contact.ticketUuid) {
        // Mapear status do ticket para a aba correta
        // pending = "Aguardando", open = "Atendendo", etc.
        let tabParam = '';
        if (contact.ticketStatus) {
          // Mapear status do backend para as abas do frontend
          const statusMap = {
            'pending': 'pending',
            'open': 'open',
            'closed': 'closed',
            'group': 'group'
          };
          const mappedStatus = statusMap[contact.ticketStatus] || contact.ticketStatus;
          tabParam = `?tab=${mappedStatus}`;
          console.log('[FLOUP DASHBOARD] Redirecionando com tab:', mappedStatus, 'URL:', `/tickets/${contact.ticketUuid}${tabParam}`);
        } else {
          console.warn('[FLOUP DASHBOARD] ticketStatus não encontrado para o contato:', contact.contactId);
        }
        // Redirecionar diretamente para o ticket usando UUID com parâmetro de aba
        history.push(`/tickets/${contact.ticketUuid}${tabParam}`);
      } else if (contact.ticketId) {
        // Se não tiver UUID mas tiver ticketId, buscar o UUID primeiro
        // Por enquanto, redirecionar para lista de tickets com filtro
        let tabParam = '';
        if (contact.ticketStatus) {
          tabParam = `&tab=${contact.ticketStatus}`;
        }
        history.push(`/tickets?contactId=${contact.contactId}${tabParam}`);
      } else {
        // Se não tiver ticketId, tentar buscar pelo contato
        history.push(`/tickets?contactId=${contact.contactId}`);
      }
    };

    return (
      <Card
        key={contact.contactId}
        style={{
          marginBottom: 12,
          borderLeft: `4px solid ${contact.hasRecentError ? '#f44336' : '#4caf50'}`,
          cursor: "pointer",
          transition: "all 0.2s"
        }}
        onClick={handleContactClick}
      >
        <CardContent style={{ padding: 12 }}>
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <Avatar
              src={contact.contactProfilePicUrl}
              style={{
                width: 40,
                height: 40
              }}
            >
              {contact.contactName ? contact.contactName.charAt(0).toUpperCase() : "?"}
            </Avatar>
            <Box flex={1}>
              <Typography variant="h6" style={{ fontSize: 16, fontWeight: 600 }}>
                {contact.contactName}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                {contact.contactNumber}
              </Typography>
            </Box>
            {contact.hasRecentError && (
              <Chip
                size="small"
                label="Erro"
                style={{
                  backgroundColor: "#f44336",
                  color: "#fff",
                  fontWeight: 600
                }}
              />
            )}
          </Box>

          <Divider style={{ margin: "8px 0" }} />

          <Box display="flex" alignItems="center" gap={1} mb={0.5}>
            <Chip
              size="small"
              label={contact.channel}
              style={{ height: 18, fontSize: 9 }}
            />
          </Box>

          {contact.nextRunAt && (
            <Box mt={1}>
              <Typography variant="caption" color="textSecondary" style={{ fontSize: 10 }}>
                Próxima: {format(new Date(contact.nextRunAt), "dd/MM 'às' HH:mm", { locale: ptBR })}
              </Typography>
            </Box>
          )}

          {contact.hasRecentError && (
            <Box mt={1} p={1} style={{ backgroundColor: "#ffebee", borderRadius: 4 }}>
              <Typography variant="caption" style={{ color: "#f44336", fontWeight: 600, fontSize: 10 }}>
                ⚠️ Erro recente
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderStepColumn = (step) => {
    const contacts = step.contacts || [];
    const stepColor = step.contactsCount > 0 ? "#4caf50" : "#9e9e9e";

    return (
      <Box
        key={step.stepIndex}
        style={{
          minWidth: 320,
          maxWidth: 320,
          marginRight: 16,
          backgroundColor: "#f5f5f5",
          borderRadius: 8,
          padding: 16,
          height: "calc(100vh - 250px)",
          overflowY: "auto"
        }}
      >
        <Box
          display="flex"
          alignItems="center"
          mb={2}
          p={1}
          style={{
            backgroundColor: `${stepColor}20`,
            borderRadius: 4,
            borderLeft: `4px solid ${stepColor}`
          }}
        >
          <Typography variant="h6" style={{ fontWeight: 600, fontSize: 14 }}>
            Etapa {step.stepOrder}
          </Typography>
          <Chip
            size="small"
            label={contacts.length}
            style={{
              marginLeft: "auto",
              backgroundColor: stepColor,
              color: "#fff"
            }}
          />
        </Box>
        
        <Box mb={1} p={1} style={{ backgroundColor: "#fff", borderRadius: 4, marginBottom: 12 }}>
          <Typography variant="caption" color="textSecondary" style={{ fontSize: 11 }}>
            {step.stepMessage ? step.stepMessage.substring(0, 100) + (step.stepMessage.length > 100 ? '...' : '') : 'Sem mensagem'}
          </Typography>
        </Box>

        {contacts.length === 0 ? (
          <Box
            display="flex"
            alignItems="center"
            justifyContent="center"
            style={{ height: 100, color: "#999" }}
          >
            <Typography variant="body2">Nenhum contato nesta etapa</Typography>
          </Box>
        ) : (
          contacts.map(renderContactCard)
        )}
      </Box>
    );
  };

  return (
    <Box style={{ padding: 24 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" style={{ fontWeight: 600 }}>
          Dashboard de Follow UP por Etapas
        </Typography>
        <Box display="flex" gap={1}>
          <Tooltip title={i18n.t("mainDrawer.appBar.refresh")}>
            <IconButton onClick={loadFloupDashboard} disabled={loading}>
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Seletor de Floup e Filtros - Comprimido */}
      <Paper style={{ padding: 8, marginBottom: 16 }}>
        <Grid container spacing={1} alignItems="center">
          <Grid item xs={12} sm={3} md={2}>
            <FormControl fullWidth variant="outlined" size="small">
              <InputLabel style={{ fontSize: 12 }}>Follow UP</InputLabel>
              <Select
                value={selectedFloupId || ""}
                onChange={(e) => handleFloupChange(e.target.value)}
                label="Follow UP"
                disabled={loadingFloups}
                style={{ fontSize: 13 }}
              >
                {loadingFloups ? (
                  <MenuItem value="">
                    <CircularProgress size={16} />
                  </MenuItem>
                ) : (
                  floups.map((floup) => (
                    <MenuItem key={floup.id} value={floup.id} style={{ fontSize: 13 }}>
                      {floup.name} {floup.isActive ? "" : "(Inativo)"}
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>
          </Grid>
          {floupData && (
            <>
              <Grid item xs={6} sm={2} md={1.5}>
                <Typography variant="caption" color="textSecondary" style={{ fontSize: 10 }}>
                  Etapas
                </Typography>
                <Typography variant="body2" style={{ fontWeight: 600, fontSize: 14 }}>
                  {floupData.totalSteps}
                </Typography>
              </Grid>
              <Grid item xs={6} sm={2} md={1.5}>
                <Typography variant="caption" color="textSecondary" style={{ fontSize: 10 }}>
                  {i18n.t("contacts.title")}
                </Typography>
                <Typography variant="body2" style={{ fontWeight: 600, fontSize: 14 }}>
                  {floupData.totalContacts}
                </Typography>
              </Grid>
            </>
          )}
          {floupData && (
            <>
              <Grid item xs={12} sm={3} md={2.5}>
                <TextField
                  fullWidth
                  label="Buscar"
                  variant="outlined"
                  size="small"
                  value={filters.search}
                  onChange={(e) => handleFilterChange("search", e.target.value)}
                  InputProps={{
                    startAdornment: <Search style={{ marginRight: 4, color: "#999", fontSize: 16 }} />,
                    style: { fontSize: 13 }
                  }}
                  InputLabelProps={{ style: { fontSize: 12 } }}
                />
              </Grid>
              <Grid item xs={12} sm={3} md={2.5}>
                <FormControl fullWidth variant="outlined" size="small">
                  <InputLabel style={{ fontSize: 12 }}>Canal</InputLabel>
                  <Select
                    value={filters.channel}
                    onChange={(e) => handleFilterChange("channel", e.target.value)}
                    label="Canal"
                    style={{ fontSize: 13 }}
                  >
                    <MenuItem value="" style={{ fontSize: 13 }}>{i18n.t("tickets.buttons.showAll")}</MenuItem>
                    {channels.map((channel) => (
                      <MenuItem key={channel} value={channel} style={{ fontSize: 13 }}>
                        {channel.charAt(0).toUpperCase() + channel.slice(1).replace("_", " ")}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </>
          )}
        </Grid>
      </Paper>

      {/* Kanban Board - Etapas */}
      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" style={{ height: 400 }}>
          <CircularProgress />
        </Box>
      ) : !selectedFloupId ? (
        <Box display="flex" justifyContent="center" alignItems="center" style={{ height: 400 }}>
          <Typography variant="h6" color="textSecondary">
            Selecione um Floup para visualizar as etapas
          </Typography>
        </Box>
      ) : !floupData ? (
        <Box display="flex" justifyContent="center" alignItems="center" style={{ height: 400 }}>
          <Typography variant="h6" color="textSecondary">
            Nenhum dado encontrado para este Floup
          </Typography>
        </Box>
      ) : (
        <Box>
          <Typography variant="h5" style={{ marginBottom: 16, fontWeight: 600 }}>
            {floupData.floupName}
          </Typography>
          {floupData.floupDescription && (
            <Typography variant="body2" color="textSecondary" style={{ marginBottom: 24 }}>
              {floupData.floupDescription}
            </Typography>
          )}
          <Box
            display="flex"
            style={{
              overflowX: "auto",
              paddingBottom: 16
            }}
          >
            {floupData.steps && floupData.steps.length > 0 ? (
              floupData.steps.map(renderStepColumn)
            ) : (
              <Box
                display="flex"
                alignItems="center"
                justifyContent="center"
                style={{ width: "100%", height: 200, color: "#999" }}
              >
                <Typography variant="body2">Nenhuma etapa encontrada</Typography>
              </Box>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default FloupDashboard;

