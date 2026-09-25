import React, { useState, useEffect, useContext, useCallback } from "react";
import { toast } from "react-toastify";
import { makeStyles } from "@material-ui/core/styles";
import {
  Paper, Button, Table, TableBody, TableCell, TableHead, TableRow,
  IconButton, TextField, InputAdornment, Grid, Select, MenuItem,
  FormControl, InputLabel, Dialog, DialogTitle, DialogContent,
  DialogActions, Chip, Box, Typography, CircularProgress, Tooltip,
  Divider
} from "@material-ui/core";
import {
  Search as SearchIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Sync as SyncIcon,
  CheckCircle as CheckCircleIcon,
  HourglassEmpty as PendingIcon,
  Cancel as RejectedIcon,
  Visibility as ViewIcon,
  Edit as EditIcon
} from "@material-ui/icons";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import ConfirmationModal from "../../components/ConfirmationModal";
import { AuthContext } from "../../context/Auth/AuthContext";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: 0,
    overflowY: "scroll",
    borderRadius: 16,
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
    ...theme.scrollbarStyles,
  },
  topCard: {
    width: "100%",
    padding: theme.spacing(2),
    borderRadius: 16,
    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark || theme.palette.primary.main} 100%)`,
    color: "#fff",
    boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
  },
  topTitle: {
    color: "#fff !important",
    fontSize: 24,
    fontWeight: 700,
    margin: 0,
  },
  topSubtitle: {
    color: "#fff",
    fontSize: 14,
    marginTop: 4,
    opacity: 0.95,
  },
  filtersCard: {
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
    borderRadius: 16,
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: "0 4px 16px rgba(0,0,0,0.05)",
  },
  statsContainer: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  statCard: {
    padding: theme.spacing(1.5),
    borderRadius: 14,
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: "0 4px 14px rgba(0,0,0,0.05)",
  },
  statValue: {
    fontSize: 22,
    fontWeight: 800,
  },
  statLabel: {
    fontSize: 12,
    color: theme.palette.text.secondary,
  },
  tableHeader: {
    backgroundColor: theme.palette.type === "dark" ? "#3c4043" : "#f7f9fa",
  },
  headCell: {
    fontWeight: 700,
    color: theme.palette.text.secondary,
    paddingTop: 14,
    paddingBottom: 14,
  },
  tableRow: {
    transition: "background 0.2s ease",
    "&:hover": {
      backgroundColor: theme.palette.type === "dark" ? "rgba(255,255,255,0.07)" : "#f5fff9",
    },
  },
  templateName: {
    fontWeight: 700,
  },
  categoryChip: {
    borderRadius: 10,
    fontWeight: 600,
  },
  actionButton: {
    backgroundColor: theme.palette.type === "dark" ? "#45494d" : "#f5f7f8",
    color: theme.palette.type === "dark" ? theme.palette.text.primary : "#455a64",
    border: `1px solid ${theme.palette.divider}`,
    margin: "0 2px",
    "&:hover": {
      backgroundColor: theme.palette.type === "dark" ? "rgba(76,175,80,0.18)" : "#e8f5e9",
      color: theme.palette.type === "dark" ? "#81c784" : "#075e54",
    },
  },
  deleteButton: {
    "&:hover": {
      backgroundColor: theme.palette.type === "dark" ? "rgba(244,67,54,0.18)" : "#ffebee",
      color: theme.palette.type === "dark" ? "#ef9a9a" : "#c62828",
    },
  },
  emptyBox: {
    padding: theme.spacing(5),
    textAlign: "center",
  },
  formControl: {
    minWidth: 200,
  },
  statusApproved: { color: "#4caf50" },
  statusPending: { color: "#ff9800" },
  statusRejected: { color: "#f44336" },
  componentBox: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 8,
    padding: theme.spacing(2),
    marginBottom: theme.spacing(1),
  },
  previewBox: {
    backgroundColor: "#e5ddd5",
    borderRadius: 8,
    padding: theme.spacing(2),
    maxWidth: 400,
  },
  previewBubble: {
    backgroundColor: "#dcf8c6",
    borderRadius: 8,
    padding: theme.spacing(1.5),
    marginBottom: theme.spacing(1),
  }
}));

const CATEGORIES = [
  { value: "MARKETING", labelKey: "templatesMeta.categoryMarketing" },
  { value: "UTILITY", labelKey: "templatesMeta.categoryUtility" },
  { value: "AUTHENTICATION", labelKey: "templatesMeta.categoryAuthentication" },
];

const LANGUAGES = [
  { value: "pt_BR", label: "Português (BR)" },
  { value: "en_US", label: "English (US)" },
  { value: "es", label: "Español" },
];

const TemplateManager = () => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);

  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [whatsapps, setWhatsapps] = useState([]);
  const [selectedWhatsappId, setSelectedWhatsappId] = useState("");
  const [searchParam, setSearchParam] = useState("");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState(null);

  // Form state
  const [templateName, setTemplateName] = useState("");
  const [templateCategory, setTemplateCategory] = useState("MARKETING");
  const [templateLanguage, setTemplateLanguage] = useState("pt_BR");
  const [headerText, setHeaderText] = useState("");
  const [headerType, setHeaderType] = useState("TEXT");
  const [headerMedia, setHeaderMedia] = useState(null);
  const [bodyText, setBodyText] = useState("");
  const [footerText, setFooterText] = useState("");
  const [buttons, setButtons] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Fetch official whatsapp connections
  useEffect(() => {
    const fetchWhatsapps = async () => {
      try {
        const { data } = await api.get("/whatsapp/?session=0");
        const oficial = data.filter(w => w.channel === "whatsapp_oficial");
        setWhatsapps(oficial);
        if (oficial.length > 0 && !selectedWhatsappId) {
          setSelectedWhatsappId(oficial[0].id);
        }
      } catch (err) {
        toastError(err);
      }
    };
    fetchWhatsapps();
  }, []);

  // Fetch templates when whatsapp changes
  const fetchTemplates = useCallback(async () => {
    if (!selectedWhatsappId) return;
    setLoading(true);
    try {
      const { data } = await api.get("/quick-messages/list", {
        params: {
          companyId: user.companyId,
          isOficial: "true",
          whatsappId: selectedWhatsappId
        }
      });
      setTemplates(Array.isArray(data) ? data : []);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, [selectedWhatsappId, user.companyId]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Listen for template status change notifications via socket
  useEffect(() => {
    if (!user?.companyId) return;

    // Import socket from context if available
    const handleStatusChange = (data) => {
      if (data.action === "statusChange" && data.changes) {
        data.changes.forEach(change => {
          const statusLabel = {
            APPROVED: "✅ APROVADO",
            REJECTED: "❌ REJEITADO",
            PENDING: "⏳ PENDENTE",
            PAUSED: "⏸️ PAUSADO",
          };
          const newLabel = statusLabel[change.newStatus] || change.newStatus;
          const oldLabel = statusLabel[change.oldStatus] || change.oldStatus;

          if (change.newStatus === "APPROVED") {
            toast.success(`Template "${change.name}" foi ${newLabel}! 🎉`, { autoClose: 8000 });
          } else if (change.newStatus === "REJECTED") {
            toast.error(`Template "${change.name}" foi ${newLabel}`, { autoClose: 10000 });
          } else {
            toast.info(`Template "${change.name}": ${oldLabel} → ${newLabel}`, { autoClose: 6000 });
          }
        });
        // Refresh templates list
        fetchTemplates();
      }
    };

    // We'll handle notifications from the sync response instead
    return () => { };
  }, [user?.companyId, fetchTemplates]);

  const handleSync = async () => {
    if (!selectedWhatsappId) return;
    setSyncing(true);
    try {
      const { data } = await api.get(`/whatsapp/sync-templates/${selectedWhatsappId}`);

      // Show status change notifications
      if (data.statusChanges && data.statusChanges.length > 0) {
        data.statusChanges.forEach(change => {
          if (change.newStatus === "APPROVED") {
            toast.success(`🎉 Template "${change.name}" foi APROVADO pela Meta!`, { autoClose: 8000 });
          } else if (change.newStatus === "REJECTED") {
            toast.error(`❌ Template "${change.name}" foi REJEITADO pela Meta`, { autoClose: 10000 });
          } else {
            toast.info(`Template "${change.name}": ${change.oldStatus} → ${change.newStatus}`, { autoClose: 6000 });
          }
        });
        toast.success(`Sincronização concluída - ${data.statusChanges.length} template(s) com mudança de status`);
      } else {
        toast.success(i18n.t("templatesMeta.syncNoChanges"));
      }

      await fetchTemplates();
    } catch (err) {
      const errMsg = err?.response?.data?.error || err?.response?.data?.message || err?.message || "";
      if (errMsg.includes("TOKEN_EXPIRED") || errMsg.includes("token") && (errMsg.includes("expirou") || errMsg.includes("inválido"))) {
        toast.error(i18n.t("templatesMeta.invalidToken"), { autoClose: 12000 });
      } else {
        toastError(err);
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleCreateTemplate = async () => {
    if (!templateName || !bodyText) {
      toast.error(i18n.t("templatesMeta.nameBodyRequired"));
      return;
    }

    // Validate template name (only lowercase, numbers and underscores)
    const nameRegex = /^[a-z0-9_]+$/;
    if (!nameRegex.test(templateName)) {
      toast.error(i18n.t("templatesMeta.invalidName"));
      return;
    }

    if (footerText && footerText.length > 60) {
      toast.error(i18n.t("templatesMeta.footerLimit"));
      return;
    }

    setSubmitting(true);
    try {
      const components = [];

      if (headerType === "TEXT" && headerText) {
        components.push({
          type: "HEADER",
          format: "TEXT",
          text: headerText
        });
      }

      if (
        ["IMAGE", "VIDEO", "DOCUMENT"].includes(
          String(headerType).toUpperCase()
        )
      ) {
        components.push({
          type: "HEADER",
          format: headerType,
          example: {
            header_handle: ["example"]
          }
        });
      }

      components.push({ type: "BODY", text: bodyText });

      if (footerText) {
        components.push({ type: "FOOTER", text: footerText });
      }

      if (buttons.length > 0) {
        components.push({
          type: "BUTTONS",
          buttons: buttons.map(b => ({
            type: b.type,
            text: b.text,
            ...(b.type === "URL" ? { url: b.url } : {}),
            ...(b.type === "PHONE_NUMBER" ? { phone_number: b.phone } : {})
          }))
        });
      }

      const payload = {
        name: templateName,
        language: templateLanguage,
        category: templateCategory,
        components
      };

      const formData = new FormData();

      formData.append("data", JSON.stringify(payload));

      if (
        ["IMAGE", "VIDEO", "DOCUMENT"].includes(
          String(headerType).toUpperCase()
        )
      ) {
        if (!headerMedia) {
          toast.error(i18n.t("templatesMeta.selectMedia"));
          setSubmitting(false);
          return;
        }

        formData.append("file", headerMedia);
      }

      await api.post(
        `/whatsapp/${selectedWhatsappId}/create-template`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data"
          }
        }
      );

      toast.success(i18n.t("templatesMeta.submitted"));
      setCreateModalOpen(false);
      resetForm();
      setHeaderMedia(null);
      setHeaderType("TEXT");

      // Sync to get latest status
      await handleSync();
    } catch (err) {
      const errMsg = err?.response?.data?.error || err?.response?.data?.message || err?.message || "";
      if (errMsg.includes("TOKEN_EXPIRED") || (errMsg.includes("token") && (errMsg.includes("expirou") || errMsg.includes("inválido")))) {
        toast.error(i18n.t("templatesMeta.invalidToken"), { autoClose: 12000 });
      } else {
        toastError(err);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!deletingTemplate) return;
    try {
      await api.delete(`/whatsapp/${selectedWhatsappId}/delete-template/${deletingTemplate.shortcode}`);
      toast.success(i18n.t("templatesMeta.deleted"));
      setConfirmModalOpen(false);
      setDeletingTemplate(null);
      await fetchTemplates();
    } catch (err) {
      const errMsg = err?.response?.data?.error || err?.response?.data?.message || err?.message || "";
      if (errMsg.includes("TOKEN_EXPIRED") || (errMsg.includes("token") && (errMsg.includes("expirou") || errMsg.includes("inválido")))) {
        toast.error(i18n.t("templatesMeta.invalidToken"), { autoClose: 12000 });
      } else {
        toastError(err);
      }
    }
  };

  const handleEditTemplate = (template) => {
    // Pre-fill the create form with existing template data for re-creation
    setTemplateName(template.shortcode || "");
    setTemplateCategory(template.category || "MARKETING");
    setTemplateLanguage(template.language || "pt_BR");

    // Parse components if available
    if (template.components && template.components.length > 0) {
      const header = template.components.find(c => c.type === "HEADER");
      const body = template.components.find(c => c.type === "BODY");
      const footer = template.components.find(c => c.type === "FOOTER");
      const btns = template.components.find(c => c.type === "BUTTONS");

      setHeaderText(header?.text || "");
      setBodyText(body?.text || "");
      setFooterText(footer?.text || "");

      if (btns?.buttons) {
        const parsed = typeof btns.buttons === "string" ? JSON.parse(btns.buttons) : btns.buttons;
        setButtons((parsed || []).map(b => ({
          type: b.type || "QUICK_REPLY",
          text: b.text || "",
          url: b.url || "",
          phone: b.phone_number || ""
        })));
      } else {
        setButtons([]);
      }
    } else {
      setHeaderText("");
      setBodyText(template.message || "");
      setFooterText("");
      setButtons([]);
    }

    setCreateModalOpen(true);
  };

  const resetForm = () => {
    setTemplateName("");
    setTemplateCategory("MARKETING");
    setTemplateLanguage("pt_BR");
    setHeaderText("");
    setHeaderType("TEXT");
    setHeaderMedia(null);
    setBodyText("");
    setFooterText("");
    setButtons([]);
  };

  const addButton = (type) => {
    if (buttons.length >= 3) {
      toast.warning(i18n.t("templatesMeta.maxButtons"));
      return;
    }
    setButtons([...buttons, { type, text: "", url: "", phone: "" }]);
  };

  const updateButton = (index, field, value) => {
    const updated = [...buttons];
    updated[index][field] = value;
    setButtons(updated);
  };

  const removeButton = (index) => {
    setButtons(buttons.filter((_, i) => i !== index));
  };

  const getStatusIcon = (status) => {
    switch (status?.toUpperCase()) {
      case "APPROVED":
        return <Chip icon={<CheckCircleIcon />} label={i18n.t("templatesMeta.approved")} size="small" style={{ backgroundColor: "#e8f5e9", color: "#2e7d32" }} />;
      case "PENDING":
        return <Chip icon={<PendingIcon />} label={i18n.t("settings.settings.options.pending")} size="small" style={{ backgroundColor: "#fff3e0", color: "#e65100" }} />;
      case "REJECTED":
        return <Chip icon={<RejectedIcon />} label={i18n.t("templatesMeta.rejected")} size="small" style={{ backgroundColor: "#ffebee", color: "#c62828" }} />;
      default:
        return <Chip label={status || "N/A"} size="small" />;
    }
  };

  const getCategoryLabel = (cat) => {
    const found = CATEGORIES.find(c => c.value === cat);
    return found ? i18n.t(found.labelKey) : cat;
  };

  const filteredTemplates = templates.filter(t =>
    !searchParam || t.shortcode?.toLowerCase().includes(searchParam.toLowerCase())
  );

  const totalTemplates = templates.length;
  const approvedTemplates = templates.filter(t => String(t.status || "").toUpperCase() === "APPROVED").length;
  const pendingTemplates = templates.filter(t => String(t.status || "").toUpperCase() === "PENDING").length;
  const rejectedTemplates = templates.filter(t => String(t.status || "").toUpperCase() === "REJECTED").length;

  return (
    <MainContainer>
      <ConfirmationModal
        title={i18n.t("templatesMeta.deleteTitle", {
          name: deletingTemplate?.shortcode || ""
        })}
        open={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={handleDeleteTemplate}
      >
        {i18n.t("templatesMeta.deleteWarning")}
      </ConfirmationModal>

      {/* View Modal */}
      <Dialog open={viewModalOpen} onClose={() => setViewModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{i18n.t("templatesMeta.details")}</DialogTitle>
        <DialogContent>
          {selectedTemplate && (
            <Box>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="textSecondary">{i18n.t("plans.form.name")}</Typography>
                  <Typography>{selectedTemplate.shortcode}</Typography>
                </Grid>
                <Grid item xs={3}>
                  <Typography variant="subtitle2" color="textSecondary">{i18n.t("languages.undefined")}</Typography>
                  <Typography>{selectedTemplate.language || "pt_BR"}</Typography>
                </Grid>
                <Grid item xs={3}>
                  <Typography variant="subtitle2" color="textSecondary">{i18n.t("financial.status")}</Typography>
                  {getStatusIcon(selectedTemplate.status)}
                </Grid>
              </Grid>
              <Box mt={2}>
                <Typography variant="subtitle2" color="textSecondary">{i18n.t("templatesMeta.category")}</Typography>
                <Typography>{getCategoryLabel(selectedTemplate.category)}</Typography>
              </Box>
              {selectedTemplate.components && selectedTemplate.components.length > 0 && (
                <Box mt={2}>
                  <Typography variant="subtitle2" color="textSecondary" gutterBottom>{i18n.t("templatesMeta.components")}</Typography>
                  <Box className={classes.previewBox}>
                    {selectedTemplate.components.map((comp, i) => (
                      <Box key={i} mb={1}>
                        {comp.type === "HEADER" && (
                          <Typography variant="subtitle1" style={{ fontWeight: 700 }}>{comp.text}</Typography>
                        )}
                        {comp.type === "BODY" && (
                          <Box className={classes.previewBubble}>
                            <Typography style={{ whiteSpace: "pre-wrap" }}>{comp.text}</Typography>
                          </Box>
                        )}
                        {comp.type === "FOOTER" && (
                          <Typography variant="caption" color="textSecondary">{comp.text}</Typography>
                        )}
                        {comp.type === "BUTTONS" && comp.buttons && (
                          <Box mt={1}>
                            {(typeof comp.buttons === "string" ? JSON.parse(comp.buttons) : comp.buttons).map((btn, j) => (
                              <Button key={j} variant="outlined" size="small" fullWidth style={{ marginBottom: 4 }}>
                                {btn.text}
                              </Button>
                            ))}
                          </Box>
                        )}
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewModalOpen(false)} color="primary">{i18n.t("campaigns.settings.close")}</Button>
        </DialogActions>
      </Dialog>

      {/* Create Modal */}
      <Dialog open={createModalOpen} onClose={() => setCreateModalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{i18n.t("templatesMeta.createNew")}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                label={i18n.t("templatesMeta.templateName")}
                fullWidth
                margin="dense"
                variant="outlined"
                value={templateName}
                onChange={e => setTemplateName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                helperText={i18n.t("templatesMeta.nameHint")}
                required
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth margin="dense" variant="outlined">
                <InputLabel>{i18n.t("templatesMeta.category")}</InputLabel>
                <Select value={templateCategory} onChange={e => setTemplateCategory(e.target.value)} label={i18n.t("templatesMeta.category")}>
                  {CATEGORIES.map(c => (
                    <MenuItem key={c.value} value={c.value}>{i18n.t(c.labelKey)}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth margin="dense" variant="outlined">
                <InputLabel>{i18n.t("languages.undefined")}</InputLabel>
                <Select value={templateLanguage} onChange={e => setTemplateLanguage(e.target.value)} label={i18n.t("languages.undefined")}>
                  {LANGUAGES.map(l => (
                    <MenuItem key={l.value} value={l.value}>{l.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <Divider style={{ margin: "16px 0" }} />

          <FormControl fullWidth margin="dense" variant="outlined">
            <InputLabel>{i18n.t("templatesMeta.headerType")}</InputLabel>

            <Select
              value={headerType}
              onChange={(e) =>
                setHeaderType(String(e.target.value).toUpperCase())
              }
              label={i18n.t("templatesMeta.headerType")}
            >
              <MenuItem value="TEXT">{i18n.t("queueModal.bot.text")}</MenuItem>
              <MenuItem value="IMAGE">{i18n.t("templatesMeta.image")}</MenuItem>
              <MenuItem value="VIDEO">{i18n.t("templatesMeta.video")}</MenuItem>
              <MenuItem value="DOCUMENT">{i18n.t("templatesMeta.document")}</MenuItem>
            </Select>
          </FormControl>

          {String(headerType).toUpperCase() === "TEXT" ? (
            <TextField
              label={i18n.t("templatesMeta.headerText")}
              fullWidth
              margin="dense"
              variant="outlined"
              value={headerText}
              onChange={e => setHeaderText(e.target.value)}
              helperText={i18n.t("templatesMeta.headerTextHint")}
            />
          ) : (
            <Box mt={2}>
              <input
                type="file"
                onChange={(e) => setHeaderMedia(e.target.files[0])}
              />

              <Typography variant="caption" color="textSecondary">
                {i18n.t("templatesMeta.exampleMedia")}
              </Typography>
            </Box>
          )}

          <TextField
            label={i18n.t("templatesMeta.messageBody")}
            fullWidth
            margin="dense"
            variant="outlined"
            multiline
            rows={4}
            value={bodyText}
            onChange={e => setBodyText(e.target.value)}
            helperText={i18n.t("templatesMeta.variablesHint")}
            required
          />

          <TextField
            label={i18n.t("templatesMeta.optionalFooter")}
            fullWidth
            margin="dense"
            variant="outlined"
            value={footerText}
            onChange={e => setFooterText(e.target.value)}
            helperText={i18n.t("templatesMeta.footerHint")}
          />

          <Divider style={{ margin: "16px 0" }} />

          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
            <Typography variant="subtitle2">{i18n.t("templatesMeta.optionalButtons")}</Typography>
            <Box>
              <Button size="small" onClick={() => addButton("QUICK_REPLY")} style={{ marginRight: 8 }}>
                {i18n.t("templatesMeta.addQuickReply")}
              </Button>
              <Button size="small" onClick={() => addButton("URL")}>
                {i18n.t("templatesMeta.addLink")}
              </Button>
              <Button size="small" onClick={() => addButton("PHONE_NUMBER")} style={{ marginLeft: 8 }}>
                {i18n.t("templatesMeta.addPhone")}
              </Button>
            </Box>
          </Box>

          {buttons.map((btn, i) => (
            <Box key={i} className={classes.componentBox}>
              <Grid container spacing={1} alignItems="center">
                <Grid item xs={3}>
                  <Chip label={btn.type === "QUICK_REPLY" ? i18n.t("templatesMeta.quickReplyShort") : btn.type === "URL" ? i18n.t("templatesMeta.link") : i18n.t("wallets.phone")} size="small" />
                </Grid>
                <Grid item xs={btn.type === "QUICK_REPLY" ? 8 : 4}>
                  <TextField
                    size="small"
                    label={i18n.t("queueModal.bot.text")}
                    fullWidth
                    value={btn.text}
                    onChange={e => updateButton(i, "text", e.target.value)}
                  />
                </Grid>
                {btn.type === "URL" && (
                  <Grid item xs={4}>
                    <TextField
                      size="small"
                      label={i18n.t("queueIntegrationModal.form.urlN8N")}
                      fullWidth
                      value={btn.url}
                      onChange={e => updateButton(i, "url", e.target.value)}
                    />
                  </Grid>
                )}
                {btn.type === "PHONE_NUMBER" && (
                  <Grid item xs={4}>
                    <TextField
                      size="small"
                      label={i18n.t("wallets.phone")}
                      fullWidth
                      value={btn.phone}
                      onChange={e => updateButton(i, "phone", e.target.value)}
                    />
                  </Grid>
                )}
                <Grid item xs={1}>
                  <IconButton size="small" onClick={() => removeButton(i)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Grid>
              </Grid>
            </Box>
          ))}

          {/* Preview */}
          {bodyText && (
            <Box mt={2}>
              <Typography variant="subtitle2" gutterBottom>{i18n.t("templatesMeta.preview")}</Typography>
              <Box className={classes.previewBox}>
                {headerText && (
                  <Typography variant="subtitle1" style={{ fontWeight: 700, marginBottom: 4 }}>{headerText}</Typography>
                )}
                <Box className={classes.previewBubble}>
                  <Typography style={{ whiteSpace: "pre-wrap" }}>{bodyText}</Typography>
                </Box>
                {footerText && (
                  <Typography variant="caption" color="textSecondary">{footerText}</Typography>
                )}
                {buttons.length > 0 && (
                  <Box mt={1}>
                    {buttons.map((btn, i) => (
                      <Button key={i} variant="outlined" size="small" fullWidth style={{ marginBottom: 4 }}>
                        {btn.text || `Botão ${i + 1}`}
                      </Button>
                    ))}
                  </Box>
                )}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setCreateModalOpen(false); resetForm(); }}>
            {i18n.t("wallets.cancel")}
          </Button>
          <Button
            onClick={handleCreateTemplate}
            color="primary"
            variant="contained"
            disabled={submitting || !templateName || !bodyText}
          >
            {submitting ? <CircularProgress size={24} /> : i18n.t("templatesMeta.submitApproval")}
          </Button>
        </DialogActions>
      </Dialog>

      <MainHeader>
        <Box className={classes.topCard}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={7}>
              <Typography className={classes.topTitle}>
                {i18n.t("templatesMeta.management")}
              </Typography>
              <Typography className={classes.topSubtitle}>
                {i18n.t("templatesMeta.managementDescription")}
              </Typography>
            </Grid>

            <Grid item xs={12} sm={5}>
              <Typography style={{ fontSize: 13, opacity: 0.9, color: "#fff" }}>
                {i18n.t("templatesMeta.selectedConnection")}
              </Typography>
              <Typography style={{ fontWeight: 700, color: "#fff" }}>
                {whatsapps.find(w => String(w.id) === String(selectedWhatsappId))?.name || "Nenhuma conexão oficial"}
              </Typography>
            </Grid>
          </Grid>
        </Box>
      </MainHeader>

      <Grid container spacing={2} className={classes.statsContainer}>
        <Grid item xs={6} md={3}>
          <Paper className={classes.statCard} elevation={0}>
            <Typography className={classes.statValue}>{totalTemplates}</Typography>
            <Typography className={classes.statLabel}>{i18n.t("templatesMeta.totalTemplates")}</Typography>
          </Paper>
        </Grid>

        <Grid item xs={6} md={3}>
          <Paper className={classes.statCard} elevation={0}>
            <Typography className={classes.statValue} style={{ color: "#2e7d32" }}>
              {approvedTemplates}
            </Typography>
            <Typography className={classes.statLabel}>{i18n.t("templatesMeta.approvedPlural")}</Typography>
          </Paper>
        </Grid>

        <Grid item xs={6} md={3}>
          <Paper className={classes.statCard} elevation={0}>
            <Typography className={classes.statValue} style={{ color: "#e65100" }}>
              {pendingTemplates}
            </Typography>
            <Typography className={classes.statLabel}>{i18n.t("momentsUser.pending")}</Typography>
          </Paper>
        </Grid>

        <Grid item xs={6} md={3}>
          <Paper className={classes.statCard} elevation={0}>
            <Typography className={classes.statValue} style={{ color: "#c62828" }}>
              {rejectedTemplates}
            </Typography>
            <Typography className={classes.statLabel}>{i18n.t("templatesMeta.rejectedPlural")}</Typography>
          </Paper>
        </Grid>
      </Grid>

      <Paper className={classes.filtersCard} elevation={0}>
        <Grid spacing={2} container alignItems="center">
          <Grid xs={12} md={4} item>
            <FormControl fullWidth size="small" variant="outlined">
              <InputLabel>{i18n.t("reports.table.whatsapp")}</InputLabel>
              <Select
                value={selectedWhatsappId}
                onChange={e => setSelectedWhatsappId(e.target.value)}
                label={i18n.t("reports.table.whatsapp")}
              >
                {whatsapps.map(w => (
                  <MenuItem key={w.id} value={w.id}>
                    {w.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid xs={12} md={4} item>
            <TextField
              fullWidth
              size="small"
              placeholder={i18n.t("templatesMeta.searchPlaceholder")}
              type="search"
              variant="outlined"
              value={searchParam}
              onChange={e => setSearchParam(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon style={{ color: "gray" }} />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          <Grid xs={12} sm={6} md={2} item>
            <Tooltip title={i18n.t("templatesMeta.syncMeta")}>
              <Button
                fullWidth
                variant="outlined"
                onClick={handleSync}
                disabled={syncing || !selectedWhatsappId}
                startIcon={syncing ? <CircularProgress size={18} /> : <SyncIcon />}
              >
                {i18n.t("templatesMeta.sync")}
              </Button>
            </Tooltip>
          </Grid>

          <Grid xs={12} sm={6} md={2} item>
            <Button
              fullWidth
              variant="contained"
              color="primary"
              onClick={() => setCreateModalOpen(true)}
              disabled={!selectedWhatsappId}
              startIcon={<AddIcon />}
            >
              {i18n.t("templatesMeta.create")}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <Paper className={classes.mainPaper} variant="outlined">
        {whatsapps.length === 0 && !loading ? (
          <Box p={4} textAlign="center">
            <Typography color="textSecondary">
              {i18n.t("templatesMeta.noOfficialConnection")}
            </Typography>
          </Box>
        ) : (
          <Table size="small">
            <TableHead className={classes.tableHeader}>
              <TableRow>
                <TableCell className={classes.headCell}>{i18n.t("plans.form.name")}</TableCell>
                <TableCell className={classes.headCell} align="center">{i18n.t("templatesMeta.category")}</TableCell>
                <TableCell className={classes.headCell} align="center">{i18n.t("languages.undefined")}</TableCell>
                <TableCell className={classes.headCell} align="center">{i18n.t("financial.status")}</TableCell>
                <TableCell className={classes.headCell} align="center">{i18n.t("wallets.actions")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredTemplates.map((template) => (
                <TableRow key={template.id} className={classes.tableRow}>
                  <TableCell>
                    <Typography className={classes.templateName}>
                      {template.shortcode}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {i18n.t("templatesMeta.officialModel")}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Chip label={getCategoryLabel(template.category)} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell align="center">{template.language || "pt_BR"}</TableCell>
                  <TableCell align="center">{getStatusIcon(template.status)}</TableCell>
                  <TableCell align="center">
                    <Tooltip title={i18n.t("templatesMeta.viewDetails")}>
                      <IconButton size="small" className={classes.actionButton} onClick={() => { setSelectedTemplate(template); setViewModalOpen(true); }}>
                        <ViewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={i18n.t("templatesMeta.editRecreate")}>
                      <IconButton size="small" className={classes.actionButton} onClick={() => handleEditTemplate(template)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={i18n.t("templatesMeta.deleteTemplate")}>
                      <IconButton 
                        size="small" 
                        className={`${classes.actionButton} ${classes.deleteButton}`} 
                        onClick={() => { setDeletingTemplate(template); setConfirmModalOpen(true); }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {loading && <TableRowSkeleton columns={5} />}
              {!loading && filteredTemplates.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Typography color="textSecondary" style={{ padding: 16 }}>
                      {i18n.t("templatesMeta.empty")}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Paper>
    </MainContainer>
  );
};

export default TemplateManager;
