import React, { useEffect, useState } from "react";
import { 
  Paper, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, IconButton, List, ListItem, ListItemText, ListItemSecondaryAction,
  Divider, Box, Select, MenuItem, InputLabel, FormControl, Card, CardContent,
  Chip, Grid, Switch, FormControlLabel, Accordion, AccordionSummary, AccordionDetails,
  Avatar, Tooltip, InputAdornment, useTheme
} from "@material-ui/core";
import { Add, Edit, Delete, FileCopy, Save, Close, ExpandMore, AttachFile, Schedule, CloudUpload, InsertLink, PlayArrow } from "@material-ui/icons";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";

const FloupPage = () => {
  const theme = useTheme();
  const [floups, setFloups] = useState([]);
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [form, setForm] = useState({ id: null, name: "", description: "", templateType: "personalizado", condition: "queue", conditionValue: "", steps: [], stopConditions: [], pauseConditions: [] });
  const [preview, setPreview] = useState("");
  const [tags, setTags] = useState([]);
  const [queues, setQueues] = useState([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [floupToDelete, setFloupToDelete] = useState(null);

  const uploadFile = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('typeArch', 'floup');
    if (form.id) {
      formData.append('floupId', form.id.toString());
    }
    try {
      console.log('[FLOUP] uploadFile → Iniciando upload:', { fileName: file.name, fileSize: file.size, fileType: file.type, floupId: form.id });
      const response = await api.post('/plugins/floup/upload', formData, { 
        headers: { 
          'Content-Type': 'multipart/form-data' 
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          console.log('[FLOUP] uploadFile → Progresso:', percentCompleted + '%');
        }
      });
      console.log('[FLOUP] uploadFile → Resposta completa do servidor:', response.data);
      if (response.data && response.data.url) {
        console.log('[FLOUP] uploadFile → URL retornada:', response.data.url);
        return response.data.url;
      } else {
        console.error('[FLOUP] uploadFile → Resposta sem URL:', response.data);
        return null;
      }
    } catch (error) {
      console.error('[FLOUP] uploadFile → Erro completo:', error);
      console.error('[FLOUP] uploadFile → Erro response:', error.response?.data);
      console.error('[FLOUP] uploadFile → Erro status:', error.response?.status);
      return null;
    }
  };

  const deleteFile = async (fileUrl) => {
    if (!fileUrl) {
      console.warn('[FLOUP] deleteFile → URL vazia, nada para deletar');
      return;
    }
    try {
      console.log('[FLOUP] deleteFile → Iniciando remoção do arquivo:', fileUrl);
      const response = await api.delete('/plugins/floup/upload', { 
        data: { fileUrl } 
      });
      console.log('[FLOUP] deleteFile → Arquivo removido com sucesso:', response.data);
      return true;
    } catch (error) {
      console.error('[FLOUP] deleteFile → Erro ao remover arquivo:', error);
      console.error('[FLOUP] deleteFile → Erro response:', error.response?.data);
      console.error('[FLOUP] deleteFile → Erro status:', error.response?.status);
      // Não bloquear a remoção do frontend mesmo se houver erro no backend
      return false;
    }
  };

  const load = async () => {
    const { data } = await api.get("/plugins/floup");
    setFloups(data);
    try { const { data: tagList } = await api.get('/tags/list'); setTags(tagList || []); } catch {}
    try { 
      const { data: queueList } = await api.get('/queue'); 
      setQueues(queueList || []); 
    } catch (error) {
      console.error('[FLOUP] load → Erro ao buscar filas do sistema:', error);
      setQueues([]);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    // Garantir que todos os campos dos steps estão presentes, preservando TODOS os campos originais
    const stepsWithDefaults = form.steps.map((step, index) => {
      const stepData = {
        order: step.order || (index + 1),
        message: step.message || '',
        timeUnit: step.timeUnit || 'minutes',
        timeValue: step.timeValue || 0,
        mediaUrl: step.mediaUrl || '', // Preservar mediaUrl mesmo se vazio
        mediaType: step.mediaType || 'url'
      };
      
      // Log detalhado de cada step antes de salvar
      if (step.mediaUrl) {
        console.log(`[FLOUP] handleSave → Step ${index + 1} (order ${stepData.order}) tem mediaUrl:`, step.mediaUrl);
      }
      
      return stepData;
    });
    
    const payload = { 
      name: form.name, 
      description: form.description, 
      templateType: form.templateType, 
      condition: form.condition || "queue",
      conditionValue: form.conditionValue || "",
      isActive: true, 
      steps: stepsWithDefaults, 
      stopConditions: form.stopConditions || [], 
      pauseConditions: form.pauseConditions || [] 
    };
    
    // Log completo do payload
    console.log('[FLOUP] handleSave → Payload completo:', JSON.stringify(payload, null, 2));
    console.log('[FLOUP] handleSave → Total de steps:', stepsWithDefaults.length);
    console.log('[FLOUP] handleSave → Steps com mediaUrl:', stepsWithDefaults.filter(s => s.mediaUrl && s.mediaUrl.trim() !== '').map(s => ({ order: s.order, mediaUrl: s.mediaUrl, mediaType: s.mediaType })));
    
    try {
      if (form.id) {
        const response = await api.put(`/plugins/floup/${form.id}`, payload);
        console.log('[FLOUP] handleSave → Resposta do PUT:', response.data);
      } else {
        const response = await api.post(`/plugins/floup`, payload);
        console.log('[FLOUP] handleSave → Resposta do POST:', response.data);
      }
      
      setOpen(false);
      resetForm();
      await load();
    } catch (error) {
      console.error('[FLOUP] handleSave → Erro ao salvar:', error);
      alert('Erro ao salvar o Follow UP. Verifique o console para mais detalhes.');
    }
  };

  const resetForm = () => {
    setForm({ id: null, name: "", description: "", templateType: "personalizado", condition: "queue", conditionValue: "", steps: [], stopConditions: [], pauseConditions: [] });
    setCurrentStep(0);
    setPreview("");
  };

  const handleDelete = (id) => {
    const floup = floups.find(f => f.id === id);
    setFloupToDelete({ id, name: floup?.name || 'este floup' });
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (floupToDelete) {
      try {
        await api.delete(`/plugins/floup/${floupToDelete.id}`);
        await load();
        setDeleteConfirmOpen(false);
        setFloupToDelete(null);
      } catch (error) {
        console.error('[FLOUP] Erro ao deletar floup:', error);
        alert('Erro ao deletar o Follow UP. Verifique o console para mais detalhes.');
      }
    }
  };
  const handleDuplicate = async (id) => { await api.post(`/plugins/floup/${id}/duplicate`); await load(); };

  const updateStep = (idx, key, value) => {
    setForm(prevForm => {
      const steps = [...prevForm.steps];
      if (!steps[idx]) {
        console.warn(`[FLOUP] updateStep → Step ${idx} não existe, criando novo step`);
        steps[idx] = { order: idx + 1, message: "", timeUnit: "minutes", timeValue: 0, mediaUrl: "", mediaType: "url" };
      }
      const updatedStep = { ...steps[idx], [key]: value };
      steps[idx] = updatedStep;
      console.log(`[FLOUP] updateStep → Atualizando step ${idx}, campo ${key}:`, { oldValue: steps[idx]?.[key], newValue: value, updatedStep });
      const newForm = { ...prevForm, steps };
      if (key === "message") setPreview(value);
      return newForm;
    });
  };

  const addStep = () => {
    const newStep = { order: form.steps.length + 1, message: "", timeUnit: "minutes", timeValue: 0, mediaUrl: "", mediaType: "url" };
    setForm({ ...form, steps: [...form.steps, newStep] });
  };
  const removeStep = (idx) => setForm({ ...form, steps: form.steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i + 1 })) });

  const getTemplateTypeConfig = (type) => {
    switch (type) {
      case "cliente":
        return { title: i18n.t("automation.followup.clientTemplate"), description: i18n.t("automation.followup.clientTemplateHelp"), defaultSteps: [{ order: 1, message: i18n.t("automation.followup.clientDefaultMessage"), timeUnit: "minutes", timeValue: 0, mediaUrl: "", mediaType: "url" }] };
      case "lead":
        return { title: i18n.t("automation.followup.leadTemplate"), description: i18n.t("automation.followup.leadTemplateHelp"), defaultSteps: [{ order: 1, message: i18n.t("automation.followup.leadDefaultMessage"), timeUnit: "hours", timeValue: 2, mediaUrl: "", mediaType: "url" }] };
      case "personalizado":
      default:
        return { title: i18n.t("automation.followup.customTemplate"), description: i18n.t("automation.followup.customTemplateHelp"), defaultSteps: [] };
    }
  };

  const isImageFile = (url) => {
    if (!url) return false;
    const lowerUrl = url.toLowerCase();
    
    // Verificar se é uma URL base64 (data:image)
    if (lowerUrl.startsWith('data:image/')) {
      return true;
    }
    
    // Verificar extensões de imagem
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'];
    if (imageExtensions.some(ext => lowerUrl.includes(ext))) {
      return true;
    }
    
    // Verificar se contém 'image' na URL (para APIs que retornam imagens)
    if (lowerUrl.includes('image') && (lowerUrl.includes('http') || lowerUrl.includes('https'))) {
      return true;
    }
    
    return false;
  };

  const isVideoFile = (url) => {
    if (!url) return false;
    const lowerUrl = url.toLowerCase();
    
    // Verificar se é uma URL base64 (data:video)
    if (lowerUrl.startsWith('data:video/')) {
      return true;
    }
    
    // Verificar extensões de vídeo
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.avi', '.mov', '.mkv', '.flv', '.wmv'];
    if (videoExtensions.some(ext => lowerUrl.includes(ext))) {
      return true;
    }
    
    // Verificar se contém 'video' na URL
    if (lowerUrl.includes('video') && (lowerUrl.includes('http') || lowerUrl.includes('https'))) {
      return true;
    }
    
    return false;
  };

  const renderStepForm = (step, idx) => (
    <Accordion key={idx} expanded={currentStep === idx} onChange={() => setCurrentStep(currentStep === idx ? -1 : idx)}>
      <AccordionSummary expandIcon={<ExpandMore />}>
        <Box display="flex" alignItems="center" width="100%">
          <Typography variant="h6" style={{ marginRight: 16 }}>{i18n.t("automation.followup.stepNumber", { number: step.order })}</Typography>
          <Chip label={step.message ? step.message.substring(0, 30) + "..." : i18n.t("automation.followup.emptyMessage")} size="small" color={step.message ? "primary" : "default"} />
          {step.mediaUrl && (<Chip icon={<AttachFile />} label={i18n.t("automation.followup.attachment")} size="small" color="secondary" style={{ marginLeft: 8 }} />)}
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <Box width="100%">
          <Paper 
            elevation={0}
            style={{ 
              padding: 16, 
              backgroundColor: theme.palette.type === 'dark' 
                ? theme.palette.background.default 
                : '#f5f5f5',
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 8
            }}
          >
            <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField fullWidth label={i18n.t("schedules.table.body")} value={step.message} onChange={e => updateStep(idx, "message", e.target.value)} multiline rows={3} inputProps={{ maxLength: 500 }} helperText={i18n.t("automation.followup.characters", { count: (step.message || "").length })} />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField fullWidth type="number" label={i18n.t("financial.value")} value={step.timeValue || 0} onChange={e => updateStep(idx, "timeValue", parseInt(e.target.value || "0"))} inputProps={{ min: 0 }} />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>{i18n.t("automation.followup.timeUnit")}</InputLabel>
                <Select value={step.timeUnit || "minutes"} onChange={e => updateStep(idx, "timeUnit", e.target.value)}>
                  <MenuItem value="minutes">{i18n.t("recurrenceSection.options.minutes")}</MenuItem>
                  <MenuItem value="hours">{i18n.t("automation.followup.hours")}</MenuItem>
                  <MenuItem value="days">{i18n.t("recurrenceSection.options.days")}</MenuItem>
                  <MenuItem value="weeks">{i18n.t("recurrenceSection.options.weeks")}</MenuItem>
                  <MenuItem value="months">{i18n.t("recurrenceSection.options.months")}</MenuItem>
                  <MenuItem value="years">{i18n.t("automation.followup.years")}</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="body2" style={{ paddingTop: 16, color: theme.palette.text.secondary }}>{i18n.t("automation.followup.sendAfter", { value: step.timeValue || 0, unit: i18n.t(`automation.followup.units.${step.timeUnit || "minutes"}`) })}</Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom style={{ color: theme.palette.text.primary, marginBottom: 8 }}>{i18n.t("automation.followup.attachmentLink")}</Typography>
              <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                <FormControl style={{ minWidth: 100 }}>
                  <Select 
                    value={step.mediaType || "url"} 
                    onChange={e => updateStep(idx, "mediaType", e.target.value)}
                    style={{ color: theme.palette.text.primary }}
                    variant="outlined"
                    size="small"
                  >
                    <MenuItem value="url">Link</MenuItem>
                    <MenuItem value="upload">{i18n.t("automation.followup.upload")}</MenuItem>
                  </Select>
                </FormControl>
                {step.mediaType === "url" ? (
                  <TextField 
                    size="small"
                    placeholder={i18n.t("automation.followup.pasteUrl")}
                    value={step.mediaUrl || ""} 
                    onChange={e => updateStep(idx, "mediaUrl", e.target.value)} 
                    InputProps={{ 
                      startAdornment: <InputAdornment position="start"><InsertLink style={{ fontSize: 16 }} /></InputAdornment>,
                      endAdornment: step.mediaUrl ? (
                        <InputAdornment position="end">
                          <Box display="flex" alignItems="center" gap={0.5}>
                            {isImageFile(step.mediaUrl) && (
                              <img 
                                src={step.mediaUrl} 
                                alt="Preview" 
                                style={{ 
                                  width: 24, 
                                  height: 24,
                                  objectFit: 'cover', 
                                  borderRadius: 2,
                                  border: `1px solid ${theme.palette.divider}`
                                }}
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                            )}
                            {isVideoFile(step.mediaUrl) && (
                              <Box
                                style={{
                                  width: 24,
                                  height: 24,
                                  borderRadius: 2,
                                  border: `1px solid ${theme.palette.divider}`,
                                  overflow: 'hidden',
                                  position: 'relative',
                                  cursor: 'pointer',
                                  flexShrink: 0
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const videoUrl = step.mediaUrl;
                                  const newWindow = window.open('', '_blank');
                                  if (newWindow) {
                                    newWindow.document.write(`
                                      <html>
                                        <head><title>Player de Vídeo</title></head>
                                        <body style="margin:0;padding:0;background:#000;display:flex;justify-content:center;align-items:center;height:100vh;">
                                          <video controls autoplay style="max-width:100%;max-height:100%;">
                                            <source src="${videoUrl}" type="video/mp4">
                                            Seu navegador não suporta o elemento de vídeo.
                                          </video>
                                        </body>
                                      </html>
                                    `);
                                  }
                                }}
                              >
                                <video
                                  src={step.mediaUrl}
                                  preload="metadata"
                                  style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover'
                                  }}
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                  }}
                                />
                                <Box
                                  style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                                    borderRadius: '50%',
                                    padding: 2,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}
                                >
                                  <PlayArrow style={{ fontSize: 12, color: '#fff' }} />
                                </Box>
                              </Box>
                            )}
                            <IconButton
                              size="small"
                              onClick={() => {
                                updateStep(idx, "mediaUrl", "");
                                updateStep(idx, "uploadedFile", null);
                              }}
                              title="Remover link"
                              style={{ padding: 2 }}
                            >
                              <Delete style={{ fontSize: 16 }} />
                            </IconButton>
                          </Box>
                        </InputAdornment>
                      ) : null
                    }}
                    style={{ flex: 1, minWidth: 150, maxWidth: 400 }}
                  />
                ) : (
                  <>
                    <input accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt" style={{ display: 'none' }} id={`file-upload-${idx}`} type="file" onChange={async (e) => { 
                      const inputElement = e.target;
                      const file = e.target.files[0]; 
                      if (file) { 
                        console.log('[FLOUP] onChange → Upload iniciado:', { stepIndex: idx, fileName: file.name, fileSize: file.size, fileType: file.type });
                        updateStep(idx, "mediaUrl", `Enviando ${file.name}...`); 
                        const uploadedUrl = await uploadFile(file); 
                        console.log('[FLOUP] onChange → URL recebida do uploadFile:', uploadedUrl);
                        if (uploadedUrl) { 
                          console.log('[FLOUP] onChange → Upload concluído com sucesso:', { stepIndex: idx, uploadedUrl });
                          setForm(prevForm => {
                            const steps = [...prevForm.steps];
                            if (!steps[idx]) {
                              console.warn(`[FLOUP] onChange → Step ${idx} não existe, criando novo step`);
                              steps[idx] = { order: idx + 1, message: "", timeUnit: "minutes", timeValue: 0, mediaUrl: "", mediaType: "url" };
                            }
                            steps[idx] = { ...steps[idx], mediaUrl: uploadedUrl, uploadedFile: file };
                            console.log('[FLOUP] onChange → Step atualizado:', steps[idx]);
                            return { ...prevForm, steps };
                          });
                        } else { 
                          console.error('[FLOUP] onChange → Erro no upload do arquivo - uploadedUrl é null');
                          updateStep(idx, "mediaUrl", ""); 
                          alert("Erro no upload do arquivo. Verifique o console para mais detalhes."); 
                        } 
                        if (inputElement) {
                          inputElement.value = '';
                        }
                      } else {
                        console.log('[FLOUP] onChange → Nenhum arquivo selecionado');
                        if (inputElement) {
                          inputElement.value = '';
                        }
                      }
                    }} />
                    {!step.mediaUrl || step.mediaUrl.includes('Enviando') ? (
                      <>
                        <label htmlFor={`file-upload-${idx}`}>
                          <Button 
                            variant="outlined" 
                            component="span" 
                            startIcon={<CloudUpload />}
                            size="small"
                          >
                            Escolher Arquivo
                          </Button>
                        </label>
                        {step.mediaUrl && step.mediaUrl.includes('Enviando') && (
                          <Box display="flex" alignItems="center" gap={0.5}>
                            <CloudUpload style={{ fontSize: 16, color: theme.palette.primary.main }} />
                            <Typography variant="caption" style={{ color: theme.palette.text.secondary }}>
                              {step.mediaUrl.replace('Enviando ', '')}
                            </Typography>
                          </Box>
                        )}
                      </>
                    ) : (
                      <Box 
                        display="flex" 
                        alignItems="center" 
                        gap={0.5}
                        style={{ 
                          flex: 1,
                          padding: '4px 8px',
                          borderRadius: 4,
                          backgroundColor: theme.palette.type === 'dark' ? theme.palette.background.default : '#f5f5f5',
                          border: `1px solid ${theme.palette.divider}`,
                          minWidth: 0,
                          maxWidth: 400
                        }}
                      >
                        {isImageFile(step.mediaUrl) ? (
                          <img 
                            src={step.mediaUrl} 
                            alt="Preview" 
                            style={{ 
                              width: 24, 
                              height: 24,
                              objectFit: 'cover', 
                              borderRadius: 2,
                              border: `1px solid ${theme.palette.divider}`,
                              flexShrink: 0
                            }}
                            onError={(e) => {
                              e.target.style.display = 'none';
                              const icon = e.target.nextElementSibling;
                              if (icon) icon.style.display = 'flex';
                            }}
                          />
                        ) : isVideoFile(step.mediaUrl) ? (
                          <Box
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: 2,
                              border: `1px solid ${theme.palette.divider}`,
                              overflow: 'hidden',
                              position: 'relative',
                              cursor: 'pointer',
                              flexShrink: 0
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              const videoUrl = step.mediaUrl;
                              const newWindow = window.open('', '_blank');
                              if (newWindow) {
                                newWindow.document.write(`
                                  <html>
                                    <head><title>Player de Vídeo</title></head>
                                    <body style="margin:0;padding:0;background:#000;display:flex;justify-content:center;align-items:center;height:100vh;">
                                      <video controls autoplay style="max-width:100%;max-height:100%;">
                                        <source src="${videoUrl}" type="video/mp4">
                                        Seu navegador não suporta o elemento de vídeo.
                                      </video>
                                    </body>
                                  </html>
                                `);
                              }
                            }}
                          >
                            <video
                              src={step.mediaUrl}
                              preload="metadata"
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover'
                              }}
                              onError={(e) => {
                                e.target.style.display = 'none';
                                const icon = e.target.nextElementSibling;
                                if (icon) icon.style.display = 'flex';
                              }}
                            />
                            <Box
                              style={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                                borderRadius: '50%',
                                padding: 2,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <PlayArrow style={{ fontSize: 12, color: '#fff' }} />
                            </Box>
                          </Box>
                        ) : null}
                        <Box 
                          display={isImageFile(step.mediaUrl) || isVideoFile(step.mediaUrl) ? 'none' : 'flex'}
                          alignItems="center"
                          style={{ color: theme.palette.text.secondary, flexShrink: 0 }}
                        >
                          <AttachFile style={{ fontSize: 16 }} />
                        </Box>
                        <Typography 
                          variant="caption" 
                          style={{ 
                            color: theme.palette.text.primary,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flex: 1,
                            fontSize: '0.75rem'
                          }}
                        >
                          {step.mediaUrl.split('/').pop() || step.mediaUrl}
                        </Typography>
                        <IconButton 
                          size="small"
                          onClick={async () => {
                            const fileUrlToDelete = step.mediaUrl;
                            console.log('[FLOUP] Removendo mídia do step:', idx, 'URL:', fileUrlToDelete);
                            await deleteFile(fileUrlToDelete);
                            updateStep(idx, "mediaUrl", "");
                            updateStep(idx, "uploadedFile", null);
                          }}
                          title="Remover mídia"
                          style={{ padding: 2, marginLeft: 4 }}
                        >
                          <Delete style={{ fontSize: 16 }} />
                        </IconButton>
                      </Box>
                    )}
                  </>
                )}
              </Box>
            </Grid>
            <Grid item xs={12}>
              <Box display="flex" justifyContent="flex-end" gap={1}>
                <Button onClick={() => removeStep(idx)} startIcon={<Delete />} color="secondary" variant="outlined">{i18n.t("automation.followup.removeStep")}</Button>
              </Box>
            </Grid>
          </Grid>
          </Paper>
        </Box>
      </AccordionDetails>
    </Accordion>
  );

  const renderPreview = () => {
    if (!preview) return null;
    return (
      <Card style={{ marginTop: 16 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>{i18n.t("automation.followup.preview")}</Typography>
          <Paper variant="outlined" style={{ padding: 16, whiteSpace: 'pre-wrap', backgroundColor: theme.palette.type === 'dark' ? theme.palette.background.default : '#f5f5f5', color: theme.palette.text.primary, fontFamily: 'monospace', fontSize: '14px' }}>{preview}</Paper>
          <Box display="flex" alignItems="center" marginTop={1}>
            <Chip icon={<AttachFile />} label={i18n.t("automation.followup.attachment")} size="small" color="secondary" />
            <Typography variant="caption" style={{ marginLeft: 8, color: theme.palette.text.secondary }}>{i18n.t("automation.followup.attachmentPreviewHelp")}</Typography>
          </Box>
        </CardContent>
      </Card>
    );
  };

  return (
    <Box p={2}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5">{i18n.t("automation.followup.title")}</Typography>
        <Button variant="contained" color="primary" startIcon={<Add />} onClick={() => { resetForm(); setOpen(true); }}>{i18n.t("automation.followup.newTemplate")}</Button>
      </Box>
      <Paper variant="outlined">
        <List>
          {floups.map(f => (
            <React.Fragment key={f.id}>
              <ListItem>
                <ListItemText primary={f.name} secondary={<div><Typography variant="body2" color="textSecondary">{f.description}</Typography><Box display="flex" gap={1} marginTop={1}><Chip label={f.templateType === "personalizado" ? i18n.t("automation.followup.custom") : f.templateType} size="small" color="primary" variant="outlined" /><Chip label={i18n.t("automation.followup.stepCount", { count: (f.steps || []).length })} size="small" color="default" variant="outlined" /><Chip label={f.isActive ? i18n.t("announcements.active") : i18n.t("announcements.inactive")} size="small" color={f.isActive ? "primary" : "default"} /></Box></div>} />
                <ListItemSecondaryAction>
                  <Tooltip title={i18n.t("chatList.edit")}><IconButton onClick={() => { 
                    const stepsToLoad = f.steps || [];
                    console.log('[FLOUP] Carregando Floup para edição:', {
                      id: f.id,
                      name: f.name,
                      stepsCount: stepsToLoad.length,
                      stepsWithMedia: stepsToLoad.filter(s => s.mediaUrl).map(s => ({ order: s.order, mediaUrl: s.mediaUrl }))
                    });
                    setForm({ 
                      id: f.id, 
                      name: f.name, 
                      description: f.description, 
                      templateType: f.templateType || "personalizado", 
                      condition: f.condition || "queue",
                      conditionValue: f.conditionValue || "",
                      steps: stepsToLoad, 
                      stopConditions: f.stopConditions || [], 
                      pauseConditions: f.pauseConditions || [] 
                    }); 
                    setOpen(true); 
                  }}><Edit /></IconButton></Tooltip>
                  <Tooltip title={i18n.t("automation.followup.duplicate")}><IconButton onClick={() => handleDuplicate(f.id)}><FileCopy /></IconButton></Tooltip>
                  <Tooltip title={i18n.t("ticketOptionsMenu.delete")}><IconButton onClick={() => handleDelete(f.id)}><Delete /></IconButton></Tooltip>
                </ListItemSecondaryAction>
              </ListItem>
              <Divider />
            </React.Fragment>
          ))}
        </List>
      </Paper>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center"><Avatar style={{ marginRight: 16 }}><Schedule /></Avatar>{form.id ? i18n.t("automation.followup.editTemplate") : i18n.t("automation.followup.newTemplate")}</Box>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12}><Typography variant="h6" gutterBottom>{i18n.t("automation.followup.basicInfo")}</Typography></Grid>
            <Grid item xs={12} md={6}><TextField fullWidth label={i18n.t("automation.followup.templateName")} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>{i18n.t("automation.followup.templateType")}</InputLabel>
                <Select value={form.templateType} onChange={e => { const config = getTemplateTypeConfig(e.target.value); setForm({ ...form, templateType: e.target.value, steps: config.defaultSteps }); }}>
                  <MenuItem value="cliente">{i18n.t("connections.client")}</MenuItem>
                  <MenuItem value="lead">Lead</MenuItem>
                  <MenuItem value="personalizado">{i18n.t("automation.followup.custom")}</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}><TextField fullWidth label={i18n.t("chatIndex.description")} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} multiline rows={2} /></Grid>
            <Grid item xs={12}>
              <Divider style={{ marginTop: 8, marginBottom: 16 }} />
              <Typography variant="subtitle2" gutterBottom style={{ color: theme.palette.text.primary, marginBottom: 8 }}>{i18n.t("automation.followup.triggerCondition")}</Typography>
              <Typography variant="body2" style={{ color: theme.palette.text.secondary, marginBottom: 16 }}>
                {i18n.t("automation.followup.triggerConditionHelp")}
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel style={{ color: theme.palette.text.secondary }}>{i18n.t("automation.followup.condition")}</InputLabel>
                <Select 
                  value={form.condition || "queue"} 
                  onChange={e => setForm({ ...form, condition: e.target.value, conditionValue: "" })} 
                  style={{ color: theme.palette.text.primary }}
                >
                  <MenuItem value="queue">{i18n.t("automation.followup.systemQueue")}</MenuItem>
                  <MenuItem value="tag">{i18n.t("automation.followup.systemTag")}</MenuItem>
                  <MenuItem value="firstClientInteraction">{i18n.t("automation.followup.firstClientInteraction")}</MenuItem>
                  <MenuItem value="firstAttendantInteraction">{i18n.t("automation.followup.firstAgentInteraction")}</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              {form.condition === "queue" && (
                <FormControl fullWidth>
                  <InputLabel style={{ color: theme.palette.text.secondary }}>{i18n.t("wallets.queue")}</InputLabel>
                  <Select 
                    value={form.conditionValue || ""} 
                    onChange={e => setForm({ ...form, conditionValue: e.target.value })} 
                    displayEmpty
                    style={{ color: theme.palette.text.primary }}
                  >
                    <MenuItem value=""><em>{i18n.t("automation.followup.selectQueue")}</em></MenuItem>
                    {queues.map(q => (<MenuItem key={q.id} value={q.name}>{q.name}</MenuItem>))}
                  </Select>
                </FormControl>
              )}
              {form.condition === "tag" && (
                <FormControl fullWidth>
                  <InputLabel style={{ color: theme.palette.text.secondary }}>Tag</InputLabel>
                  <Select 
                    value={form.conditionValue || ""} 
                    onChange={e => setForm({ ...form, conditionValue: e.target.value })} 
                    displayEmpty
                    style={{ color: theme.palette.text.primary }}
                  >
                    <MenuItem value=""><em>{i18n.t("automation.followup.selectTag")}</em></MenuItem>
                    {tags.map(t => (<MenuItem key={t.id} value={t.name}>{t.name}</MenuItem>))}
                  </Select>
                </FormControl>
              )}
              {(form.condition === "firstClientInteraction" || form.condition === "firstAttendantInteraction") && (
                <TextField 
                  fullWidth 
                  label="Descrição da condição" 
                  value={form.conditionValue || ""} 
                  onChange={e => setForm({ ...form, conditionValue: e.target.value })} 
                  placeholder="Ex: Cliente enviou primeira mensagem"
                  InputLabelProps={{
                    style: { color: theme.palette.text.secondary }
                  }}
                />
              )}
            </Grid>
            <Grid item xs={12}>
              <Paper variant="outlined" style={{ padding: 16, backgroundColor: '#e3f2fd', border: '1px solid #2196f3' }}>
                <Typography variant="body2" style={{ color: '#1976d2' }}>
                  <strong>{getTemplateTypeConfig(form.templateType).title}</strong><br/>
                  {getTemplateTypeConfig(form.templateType).description}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12}>
              <Divider style={{ marginTop: 16, marginBottom: 16 }} />
              <Typography variant="h6" gutterBottom>{i18n.t("automation.followup.stopControls")}</Typography>
              <Paper
                variant="outlined"
                style={{
                  padding: 16,
                  backgroundColor:
                    (theme.palette.type === 'dark' || theme.palette.mode === 'dark')
                      ? 'rgba(255, 152, 0, 0.08)'
                      : '#fff3e0',
                  border:
                    (theme.palette.type === 'dark' || theme.palette.mode === 'dark')
                      ? '1px solid rgba(255, 183, 77, 0.55)'
                      : '1px solid #ff9800',
                  color: theme.palette.text.primary
                }}
              >
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <FormControlLabel 
                      control={
                        <Switch 
                          checked={form.stopConditions?.some(c => c.type === 'anyMessage') || false} 
                          onChange={e => {
                            const stopConditions = form.stopConditions || [];
                            if (e.target.checked) {
                              if (!stopConditions.some(c => c.type === 'anyMessage')) {
                                setForm({ ...form, stopConditions: [...stopConditions, { type: 'anyMessage', enabled: true }] });
                              }
                            } else {
                              setForm({ ...form, stopConditions: stopConditions.filter(c => c.type !== 'anyMessage') });
                            }
                          }} 
                        />
                      } 
                      label={i18n.t("automation.followup.stopAnyMessage")}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <FormControlLabel 
                      control={
                        <Switch 
                          checked={form.stopConditions?.some(c => c.type === 'keyword') || false} 
                          onChange={e => {
                            const stopConditions = form.stopConditions || [];
                            if (e.target.checked) {
                              if (!stopConditions.some(c => c.type === 'keyword')) {
                                setForm({ ...form, stopConditions: [...stopConditions, { type: 'keyword', enabled: true, keyword: '' }] });
                              }
                            } else {
                              setForm({ ...form, stopConditions: stopConditions.filter(c => c.type !== 'keyword') });
                            }
                          }} 
                        />
                      } 
                      label={i18n.t("automation.followup.stopKeyword")}
                    />
                    {form.stopConditions?.some(c => c.type === 'keyword') && (
                      <TextField 
                        fullWidth 
                        label="Palavra chave" 
                        value={form.stopConditions.find(c => c.type === 'keyword')?.keyword || ''} 
                        onChange={e => {
                          const stopConditions = form.stopConditions || [];
                          const keywordCondition = stopConditions.find(c => c.type === 'keyword');
                          if (keywordCondition) {
                            keywordCondition.keyword = e.target.value;
                            setForm({ ...form, stopConditions: [...stopConditions.filter(c => c.type !== 'keyword'), keywordCondition] });
                          }
                        }} 
                        placeholder="Ex: PARAR, CANCELAR, SAIR" 
                        style={{ marginTop: 8 }} 
                      />
                    )}
                  </Grid>
                  <Grid item xs={12}>
                    <FormControlLabel 
                      control={
                        <Switch 
                          checked={form.stopConditions?.some(c => c.type === 'ticketClosed') || false} 
                          onChange={e => {
                            const stopConditions = form.stopConditions || [];
                            if (e.target.checked) {
                              if (!stopConditions.some(c => c.type === 'ticketClosed')) {
                                setForm({ ...form, stopConditions: [...stopConditions, { type: 'ticketClosed', enabled: true }] });
                              }
                            } else {
                              setForm({ ...form, stopConditions: stopConditions.filter(c => c.type !== 'ticketClosed') });
                            }
                          }} 
                        />
                      } 
                      label={i18n.t("automation.followup.stopClosedTicket")}
                    />
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
            <Grid item xs={12}>
              <Box display="flex" justifyContent="space-between" alignItems="center" marginTop={2}>
                <Typography variant="h6">{i18n.t("automation.followup.steps")}</Typography>
                <Button onClick={addStep} startIcon={<Add />} variant="outlined">{i18n.t("automation.followup.addStep")}</Button>
              </Box>
            </Grid>
            {form.steps.map((step, idx) => renderStepForm(step, idx))}
            {renderPreview()}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} startIcon={<Close />}>{i18n.t("wallets.cancel")}</Button>
          <Button onClick={handleSave} variant="contained" color="primary" startIcon={<Save />} disabled={!form.name || form.steps.length === 0}>{i18n.t("automation.followup.saveTemplate")}</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={deleteConfirmOpen} onClose={() => { setDeleteConfirmOpen(false); setFloupToDelete(null); }}>
        <DialogTitle>{i18n.t("chatPopover.confirmDelete")}</DialogTitle>
        <DialogContent>
          <Typography>
            Tem certeza que deseja deletar o Follow UP <strong>"{floupToDelete?.name}"</strong>?
            <br />
            <br />
            Esta ação não pode ser desfeita e todas as mídias associadas serão excluídas permanentemente.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDeleteConfirmOpen(false); setFloupToDelete(null); }} color="primary">
            {i18n.t("wallets.cancel")}
          </Button>
          <Button onClick={confirmDelete} color="secondary" variant="contained" startIcon={<Delete />}>
            {i18n.t("ticketOptionsMenu.delete")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FloupPage;
