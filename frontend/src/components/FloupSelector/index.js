import React, { useState, useEffect, useRef, useContext } from "react";
import { FormControl, InputLabel, Select, MenuItem, Chip, Box, Typography, Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Popover, Checkbox } from "@material-ui/core";
import { PlayArrow, Stop, Schedule, Info, CheckCircle, TrackChanges } from "@material-ui/icons";
import { format } from "date-fns";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";
import { AuthContext } from "../../context/Auth/AuthContext";
import { i18n } from "../../translate/i18n";

const FloupSelector = ({ contact, ticket }) => {
  const { user, socket } = useContext(AuthContext);
  const [floups, setFloups] = useState([]);
  const [selectedFloup, setSelectedFloup] = useState("");
  const [activeFloup, setActiveFloup] = useState(null);
  const [loading, setLoading] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const buttonRef = useRef(null);
  const justStoppedRef = useRef(false); // Flag para indicar que acabamos de parar
  const stoppedFloupIdRef = useRef(null); // Guardar o ID do Floup que foi parado

  useEffect(() => {
    loadFloups();
    // Só recarregar floup ativo se não acabamos de parar
    if (!justStoppedRef.current) {
      loadActiveFloup();
    } else {
      // Resetar a flag após um tempo maior para evitar que restaure o estado
      setTimeout(() => {
        justStoppedRef.current = false;
        stoppedFloupIdRef.current = null;
        console.log('[FLOUP] useEffect → Flag justStopped resetada');
      }, 15000); // Aumentado para 15 segundos
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact?.id]);

  // Listener de socket para eventos de Floup parado
  useEffect(() => {
    if (!socket || !user?.companyId || !contact?.id) return;

    const companyId = user.companyId;
    const eventName = `company-${companyId}-floup-stopped`;

    const onFloupStopped = (data) => {
      console.log('[FLOUP] Socket event floup-stopped recebido', data);
      // Se o evento é para este contato, limpar o estado
      if (data.contactId === contact.id) {
        console.log('[FLOUP] Floup parado via socket para este contato, limpando estado');
        setActiveFloup(null);
        setSelectedFloup("");
        justStoppedRef.current = true;
        stoppedFloupIdRef.current = data.floupId;
        // Resetar a flag após 15 segundos
        setTimeout(() => {
          justStoppedRef.current = false;
          stoppedFloupIdRef.current = null;
        }, 15000);
      }
    };

    socket.on(eventName, onFloupStopped);

    return () => {
      socket.off(eventName, onFloupStopped);
    };
  }, [socket, user?.companyId, contact?.id]);

  // Listener de socket para eventos de Floup atribuído (iniciado automaticamente)
  useEffect(() => {
    if (!socket || !user?.companyId || !contact?.id) return;

    const companyId = user.companyId;
    const eventName = `company-${companyId}-floup-assigned`;

    const onFloupAssigned = (data) => {
      console.log('[FLOUP] Socket event floup-assigned recebido', data);
      // Se o evento é para este contato, recarregar o Floup ativo imediatamente
      if (data.contactId === contact.id) {
        console.log('[FLOUP] Floup atribuído via socket para este contato, recarregando Floup ativo...', { 
          floupId: data.floupId, 
          scheduleId: data.schedule?.id 
        });
        // Aguardar um pouco para garantir que o backend processou completamente
        setTimeout(() => {
          loadActiveFloup();
        }, 300);
      }
    };

    socket.on(eventName, onFloupAssigned);

    return () => {
      socket.off(eventName, onFloupAssigned);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, user?.companyId, contact?.id]);

  // Listener de socket para eventos de passo executado
  useEffect(() => {
    if (!socket || !user?.companyId || !contact?.id) return;

    const companyId = user.companyId;
    const eventName = `company-${companyId}-floup-step-executed`;

    const onStepExecuted = (data) => {
      console.log('[FLOUP] Socket event floup-step-executed recebido', data);
      // Se o evento é para este contato, recarregar (mesmo que não tenhamos Floup ativo ainda)
      if (data.contactId === contact.id) {
        console.log('[FLOUP] Passo executado via socket, recarregando Floup ativo...', { floupId: data.floupId, stepIndex: data.stepIndex });
        // Aguardar um pouco para garantir que o backend processou
        setTimeout(() => {
          loadActiveFloup();
        }, 500);
      }
    };

    socket.on(eventName, onStepExecuted);

    return () => {
      socket.off(eventName, onStepExecuted);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, user?.companyId, contact?.id]);

  const handleOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);

  const loadFloups = async () => {
    try {
      const { data } = await api.get("/plugins/floup");
      setFloups((data || []).filter(f => f.isActive));
    } catch (err) {
      toastError(err);
    }
  };

  const loadActiveFloup = async () => {
    if (!contact?.id) return;
    // Se acabamos de parar, não recarregar
    if (justStoppedRef.current) {
      console.log('[FLOUP] loadActiveFloup → Ignorado porque acabamos de parar');
      return;
    }
    try {
      const { data } = await api.get(`/plugins/floup/contact/${contact.id}/active`);
      console.log('[FLOUP] loadActiveFloup → Dados recebidos', data);
      
      // Se acabamos de parar este Floup específico, não carregar mesmo que retorne dados
      if (stoppedFloupIdRef.current && data?.id === stoppedFloupIdRef.current) {
        console.log('[FLOUP] loadActiveFloup → Ignorado porque este Floup foi parado recentemente');
        setActiveFloup(null);
        return;
      }
      
      // Se data é null, undefined, ou objeto vazio, limpar estado
      if (!data || (typeof data === 'object' && Object.keys(data).length === 0) || !data.id) {
        console.log('[FLOUP] loadActiveFloup → Limpando estado (sem dados)');
        setActiveFloup(null);
      } else {
        // Verificar se o schedule ainda está pendente
        if (data.activeSchedule && data.activeSchedule.status === 'PENDING') {
          console.log('[FLOUP] loadActiveFloup → Floup ativo encontrado', data);
          setActiveFloup(data);
        } else {
          // Se o schedule não está mais pendente, limpar
          console.log('[FLOUP] loadActiveFloup → Limpando estado (schedule não pendente)', data.activeSchedule?.status);
          setActiveFloup(null);
        }
      }
    } catch (err) {
      // Em caso de erro 404 ou qualquer erro, limpar estado
      console.log('[FLOUP] loadActiveFloup → Erro ao buscar floup ativo', err);
      setActiveFloup(null);
    }
  };

  const handleFloupSelect = async (floupId) => {
    if (!floupId || !contact?.id) return;
    setLoading(true);
    try {
      await api.post(`/plugins/floup/${floupId}/assign`, { contactId: contact.id, ticketId: ticket?.id });
      setSelectedFloup(floupId);
      await loadActiveFloup();
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStopFloup = async () => {
    console.log('[FLOUP] handleStopFloup chamado', { activeFloup, contactId: contact?.id });
    if (!activeFloup?.id || !contact?.id) {
      console.warn('[FLOUP] handleStopFloup → Condições não atendidas', { activeFloupId: activeFloup?.id, contactId: contact?.id });
      return;
    }
    setLoading(true);
    const floupIdToStop = activeFloup.id; // Guardar o ID antes de limpar
    justStoppedRef.current = true; // Marcar que acabamos de parar
    stoppedFloupIdRef.current = floupIdToStop; // Guardar o ID do Floup parado
    console.log('[FLOUP] handleStopFloup → Parando floup', { floupId: floupIdToStop, contactId: contact.id });
    try {
      const response = await api.post(`/plugins/floup/${floupIdToStop}/stop`, { contactId: contact.id });
      console.log('[FLOUP] handleStopFloup → Resposta do backend', response.data);
      // Limpar estado imediatamente após sucesso - SEM recarregar
      console.log('[FLOUP] handleStopFloup → Limpando estado');
      setActiveFloup(null);
      setSelectedFloup("");
      // Fechar o popover
      handleClose();
      // Mostrar mensagem de sucesso
      toast.success(response.data?.message || 'Follow UP interrompido com sucesso');
      // NÃO recarregar mais - o socket event vai cuidar disso se necessário
      // A flag justStoppedRef vai prevenir recarregamentos por 15 segundos
    } catch (err) {
      // Em caso de erro, limpar o estado sempre
      setActiveFloup(null);
      setSelectedFloup("");
      handleClose();
      
      // Só mostrar erro se não for um caso de "já foi cancelado"
      if (!err.response?.data?.message?.includes('cancelado') && 
          !err.response?.data?.message?.includes('concluído') &&
          !err.response?.data?.message?.includes('já foi')) {
        toastError(err);
      } else {
        // Mesmo que já tenha sido cancelado, manter a flag ativa
        justStoppedRef.current = true;
        stoppedFloupIdRef.current = floupIdToStop;
        setTimeout(() => {
          justStoppedRef.current = false;
          stoppedFloupIdRef.current = null;
        }, 15000);
      }
    } finally {
      setLoading(false);
    }
  };

  const renderFloupInfo = () => {
    if (!activeFloup) return null;
    return (
      <Box display="flex" alignItems="center" gap={1} marginTop={1} marginBottom={1}>
        <Button 
          size="small" 
          color="secondary" 
          variant="outlined"
          startIcon={<Stop />} 
          onClick={handleStopFloup} 
          disabled={loading}
          style={{ fontSize: '0.75rem', padding: '4px 8px' }}
        >
          Parar Follow UP
        </Button>
      </Box>
    );
  };

  const renderFloupSteps = () => {
    if (!activeFloup?.steps) return null;
    const currentStepIndex = activeFloup.activeSchedule?.currentStepIndex || 0;
    const executedSteps = activeFloup.executedSteps || {};
    
    return (
      <Box marginTop={1}>
        <Typography variant="caption" color="textSecondary" style={{ fontSize: '0.7rem' }}>Próximos passos:</Typography>
        <Box marginTop={0.5}>
          {activeFloup.steps.map((step, index) => {
            // Um passo foi executado apenas se seu índice é menor que currentStepIndex
            // (currentStepIndex indica qual passo será executado PRÓXIMO, então passos anteriores já foram executados)
            const isExecuted = index < currentStepIndex;
            const executedAt = executedSteps[index]?.executedAt;
            const stepOrder = step.order || (index + 1);
            const stepMessage = String(step.message || "").substring(0, 25);
            
            return (
              <Box 
                key={index} 
                display="flex" 
                alignItems="center" 
                gap={0.5} 
                marginBottom={0.5}
                style={{ 
                  padding: '4px 0',
                  fontSize: '0.7rem'
                }}
              >
                <Checkbox
                  checked={isExecuted}
                  disabled
                  size="small"
                  style={{ 
                    padding: 0,
                    width: 18,
                    height: 18
                  }}
                  icon={<Box style={{ width: 16, height: 16, border: '1px solid #ccc', borderRadius: 2 }} />}
                  checkedIcon={
                    <CheckCircle 
                      style={{ 
                        fontSize: 18, 
                        color: '#4caf50'
                      }} 
                    />
                  }
                />
                <Typography 
                  variant="caption" 
                  style={{ 
                    fontSize: '0.7rem',
                    flex: 1,
                    textDecoration: isExecuted ? 'none' : 'none',
                    color: isExecuted ? '#666' : 'inherit'
                  }}
                >
                  {stepOrder}: {stepMessage}{stepMessage.length >= 25 ? '...' : ''}
                </Typography>
                {isExecuted && executedAt && (
                  <Typography 
                    variant="caption" 
                    color="textSecondary" 
                    style={{ 
                      fontSize: '0.65rem',
                      color: '#4caf50',
                      fontWeight: 'bold'
                    }}
                  >
                    {format(new Date(executedAt), "dd/MM HH:mm")}
                  </Typography>
                )}
              </Box>
            );
          })}
        </Box>
      </Box>
    );
  };

  return (
    <>
      <Button
        ref={buttonRef}
        onClick={handleOpen}
        variant="outlined"
        size="small"
        style={{ 
          marginRight: 2,
          textTransform: 'none',
          minWidth: 'auto',
          padding: '2px 4px'
        }}
      >
        <TrackChanges style={{ fontSize: 18 }} />
        {activeFloup && (
          <Chip 
            icon={<PlayArrow style={{ fontSize: 12 }} />} 
            label={i18n.t("announcements.active")} 
            color="primary" 
            size="small" 
            style={{ marginLeft: 4, height: 18, fontSize: '0.65rem' }}
          />
        )}
      </Button>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        PaperProps={{
          style: {
            minWidth: 320,
            maxWidth: 400,
            padding: 16
          }
        }}
      >
        <Box display="flex" alignItems="center" justifyContent="space-between" marginBottom={2}>
          <Box display="flex" alignItems="center" gap={1}>
            <Schedule style={{ fontSize: 18, color: '#1976d2' }} />
            <Typography variant="subtitle2" style={{ fontWeight: 'bold' }}>Follow UP</Typography>
            <IconButton 
              size="small" 
              onClick={() => {
                handleClose();
                setInfoOpen(true);
              }} 
              title="Informações sobre Follow UP"
              style={{ padding: 4 }}
            >
              <Info style={{ fontSize: 16 }} />
            </IconButton>
          </Box>
        </Box>

        <Box marginBottom={2}>
          <FormControl size="small" fullWidth>
            <InputLabel shrink style={{ backgroundColor: 'white', padding: '0 8px', zIndex: 1 }}>Selecionar Follow UP</InputLabel>
            <Select 
              value={selectedFloup || ""} 
              onChange={(e) => {
                handleFloupSelect(e.target.value);
                handleClose();
              }} 
              disabled={loading || !!activeFloup} 
              displayEmpty 
              style={{ zIndex: 1 }}
            >
              <MenuItem value=""><em>Escolher template...</em></MenuItem>
              {floups.map(floup => (
                <MenuItem key={floup.id} value={floup.id}>
                  <Box display="flex" alignItems="center" justifyContent="space-between" width="100%">
                    <span>{floup.name}</span>
                    <Chip label={floup.templateType || "personalizado"} size="small" variant="outlined" style={{ marginLeft: 8 }} />
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {renderFloupInfo()}
        {renderFloupSteps()}
      </Popover>

      <Dialog open={infoOpen} onClose={() => setInfoOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={8}><Schedule />Sobre o Sistema Follow UP</Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" paragraph>
            O <strong>Follow UP</strong> permite criar fluxos de mensagens e atribuí-los a um contato ou ticket para execução automática.
          </Typography>
          <Typography variant="body2">Selecione um template ativo para iniciar. Você pode interromper a qualquer momento.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInfoOpen(false)} color="primary">Entendi</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default FloupSelector;


