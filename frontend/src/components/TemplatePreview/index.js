import React, { useState, useEffect, useMemo } from "react";
import { makeStyles } from "@material-ui/core/styles";
import { Box, Typography, TextField, Collapse, IconButton } from "@material-ui/core";
import ImageIcon from "@material-ui/icons/Image";
import VideocamIcon from "@material-ui/icons/Videocam";
import DescriptionIcon from "@material-ui/icons/Description";
import EditIcon from "@material-ui/icons/Edit";
import VisibilityIcon from "@material-ui/icons/Visibility";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  phoneFrame: {
    width: "100%",
    maxWidth: 340,
    margin: "8px auto",
    borderRadius: 16,
    border: `2px solid ${theme.palette.divider}`,
    backgroundColor: "#e5ddd5",
    overflow: "hidden",
  },
  phoneHeader: {
    backgroundColor: "#075e54",
    color: "#fff",
    padding: "8px 12px",
    fontSize: 13,
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  chatArea: {
    padding: "12px 10px",
    minHeight: 120,
    maxHeight: 300,
    overflowY: "auto",
  },
  messageBubble: {
    backgroundColor: "#fff",
    borderRadius: "0 8px 8px 8px",
    padding: "8px 10px",
    maxWidth: "90%",
    boxShadow: "0 1px 1px rgba(0,0,0,0.13)",
    wordBreak: "break-word",
  },
  mediaPlaceholder: {
    backgroundColor: "#f0f0f0",
    borderRadius: 6,
    padding: "16px 12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 6,
    color: "#666",
    fontSize: 13,
  },
  mediaPreviewImg: {
    width: "100%",
    maxHeight: 160,
    objectFit: "cover",
    borderRadius: 6,
    marginBottom: 6,
  },
  bodyText: {
    fontSize: 13,
    lineHeight: 1.4,
    color: "#303030",
    whiteSpace: "pre-wrap",
  },
  footerText: {
    fontSize: 11,
    color: "#8c8c8c",
    marginTop: 4,
  },
  buttonsContainer: {
    marginTop: 6,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  templateButton: {
    backgroundColor: "#f7f7f7",
    border: "1px solid #e0e0e0",
    borderRadius: 6,
    padding: "6px 8px",
    textAlign: "center",
    fontSize: 12,
    color: "#00a5f4",
    fontWeight: 500,
  },
  label: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    marginBottom: 4,
    textAlign: "center",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  variablesSection: {
    margin: "8px auto",
    maxWidth: 340,
    padding: "0 4px",
  },
  varField: {
    marginBottom: 4,
  },
  highlight: {
    backgroundColor: "#fff9c4",
    borderRadius: 2,
    padding: "0 2px",
    fontWeight: 500,
  },
}));

// Extract {{n}} placeholders from text
const extractVars = (text) => {
  if (!text) return [];
  const regex = /\{\{(\d+)\}\}/g;
  const vars = [];
  let m;
  while ((m = regex.exec(text)) !== null) {
    if (!vars.includes(m[1])) vars.push(m[1]);
  }
  return vars;
};

const replaceVars = (text, values) => {
  if (!text) return text;
  return text.replace(/\{\{(\d+)\}\}/g, (match, num) => {
    const val = values[num];
    return val ? val : match;
  });
};

const TemplatePreview = ({ template, attachment, onVariablesChange }) => {
  const classes = useStyles();
  const [varValues, setVarValues] = useState({});
  const [editMode, setEditMode] = useState(true);

  // Reset when template changes
  useEffect(() => {
    setVarValues({});
    setEditMode(true);
  }, [template?.id]);

  // Notify parent of variable changes
  useEffect(() => {
    if (onVariablesChange) {
      onVariablesChange(varValues);
    }
  }, [varValues, onVariablesChange]);

  if (!template) return null;

  const components = template.components || [];
  const headerComp = components.find((c) => c.type?.toLowerCase() === "header");
  const bodyComp = components.find((c) => c.type?.toLowerCase() === "body");
  const footerComp = components.find((c) => c.type?.toLowerCase() === "footer");
  const buttonsComp = components.find((c) => c.type?.toLowerCase() === "buttons");

  const hasMediaHeader = headerComp && ["IMAGE", "VIDEO", "DOCUMENT"].includes(headerComp.format);

  // Collect all variables per component
  const allVars = {
    header: headerComp?.format === "TEXT" ? extractVars(headerComp.text) : [],
    body: extractVars(bodyComp?.text),
    footer: extractVars(footerComp?.text),
  };
  const hasVars = allVars.header.length > 0 || allVars.body.length > 0 || allVars.footer.length > 0;

  const handleVarChange = (section, num, value) => {
    setVarValues((prev) => ({ ...prev, [`${section}_${num}`]: value, [num]: value }));
  };

  const getAttachmentPreview = () => {
    if (!attachment && !hasMediaHeader) return null;
    if (attachment) {
      const fileType = attachment.type || "";
      if (fileType.startsWith("image/")) {
        const url = URL.createObjectURL(attachment);
        return <img src={url} alt={i18n.t("templatesMeta.previewAlt")} className={classes.mediaPreviewImg} />;
      }
      if (fileType.startsWith("video/")) {
        return (
          <Box className={classes.mediaPlaceholder}>
            <VideocamIcon fontSize="small" />
            <span>{attachment.name}</span>
          </Box>
        );
      }
      return (
        <Box className={classes.mediaPlaceholder}>
          <DescriptionIcon fontSize="small" />
          <span>{attachment.name}</span>
        </Box>
      );
    }
    const format = headerComp.format;
    const Icon = format === "IMAGE" ? ImageIcon : format === "VIDEO" ? VideocamIcon : DescriptionIcon;
    const label = format === "IMAGE" ? "Imagem" : format === "VIDEO" ? "Vídeo" : "Documento";
    return (
      <Box className={classes.mediaPlaceholder} style={{ border: "2px dashed #ccc" }}>
        <Icon fontSize="small" />
        <span>{i18n.t("templatesMeta.attach")} {label.toLowerCase()} {i18n.t("templatesMeta.above")}</span>
      </Box>
    );
  };

  // Render text with highlighted replaced variables
  const renderTextWithHighlights = (text) => {
    if (!text) return null;
    const parts = text.split(/(\{\{\d+\}\})/g);
    return parts.map((part, i) => {
      const m = part.match(/^\{\{(\d+)\}\}$/);
      if (m) {
        const val = varValues[m[1]];
        if (val) {
          return <span key={i} className={classes.highlight}>{val}</span>;
        }
        return <span key={i} style={{ color: "#e65100", fontWeight: 500 }}>{part}</span>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  let buttons = [];
  if (buttonsComp?.buttons) {
    try {
      buttons = typeof buttonsComp.buttons === "string" ? JSON.parse(buttonsComp.buttons) : buttonsComp.buttons;
    } catch (e) {
      buttons = [];
    }
  }

  const renderVarFields = (section, vars) => {
    if (!vars || vars.length === 0) return null;
    return vars.map((num) => (
      <TextField
        key={`${section}-${num}`}
        className={classes.varField}
        size="small"
        variant="outlined"
        label={`${section} - Variável {{${num}}}`}
        value={varValues[num] || ""}
        onChange={(e) => handleVarChange(section, num, e.target.value)}
        fullWidth
        margin="dense"
        placeholder={`Ex: Nome do contato`}
      />
    ));
  };

  return (
    <Box>
      <Typography className={classes.label}>
        <span>{i18n.t("templatesMeta.previewLabel")} <strong>{template.shortcode || template.name}</strong></span>
        {hasVars && (
          <IconButton size="small" onClick={() => setEditMode(!editMode)} title={editMode ? i18n.t("templatesMeta.hideFields") : i18n.t("templatesMeta.editVariables")}>
            {editMode ? <VisibilityIcon fontSize="small" /> : <EditIcon fontSize="small" />}
          </IconButton>
        )}
      </Typography>

      {/* Variable editing fields */}
      {hasVars && (
        <Collapse in={editMode}>
          <Box className={classes.variablesSection}>
            <Typography variant="caption" color="textSecondary" style={{ marginBottom: 4, display: "block" }}>
              {i18n.t("templatesMeta.fillVariables")}
            </Typography>
            {renderVarFields("Header", allVars.header)}
            {renderVarFields("Body", allVars.body)}
            {renderVarFields("Footer", allVars.footer)}
          </Box>
        </Collapse>
      )}

      <Box className={classes.phoneFrame}>
        <Box className={classes.phoneHeader}>
          <span>📱</span> {i18n.t("templatesMeta.whatsappPreview")}
        </Box>
        <Box className={classes.chatArea}>
          <Box className={classes.messageBubble}>
            {getAttachmentPreview()}
            {headerComp && headerComp.format === "TEXT" && headerComp.text && (
              <Typography style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                {renderTextWithHighlights(headerComp.text)}
              </Typography>
            )}
            {bodyComp?.text && (
              <Typography className={classes.bodyText}>
                {renderTextWithHighlights(bodyComp.text)}
              </Typography>
            )}
            {footerComp?.text && (
              <Typography className={classes.footerText}>
                {renderTextWithHighlights(footerComp.text)}
              </Typography>
            )}
            {buttons.length > 0 && (
              <Box className={classes.buttonsContainer}>
                {buttons.map((btn, i) => (
                  <Box key={i} className={classes.templateButton}>
                    {btn.text || btn.title || `Botão ${i + 1}`}
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default TemplatePreview;
