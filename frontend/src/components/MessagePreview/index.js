import React, { useMemo, useState } from "react";
import { makeStyles } from "@material-ui/core/styles";
import { Box, Typography, IconButton } from "@material-ui/core";
import SendIcon from "@material-ui/icons/Send";
import ChatBubbleOutlineIcon from "@material-ui/icons/ChatBubbleOutline";
import ImageIcon from "@material-ui/icons/Image";
import VideocamIcon from "@material-ui/icons/Videocam";
import DescriptionIcon from "@material-ui/icons/Description";
import PersonIcon from "@material-ui/icons/Person";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  container: {
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  header: {
    padding: "10px 14px",
    display: "flex",
    alignItems: "center",
    gap: 8,
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  headerIcon: {
    color: theme.palette.text.secondary,
    fontSize: 20,
  },
  headerTitle: {
    fontWeight: 600,
    fontSize: 14,
    color: theme.palette.text.primary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: theme.palette.text.secondary,
  },
  phoneFrame: {
    backgroundColor: "#e5ddd5",
    backgroundImage: "url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAABmJLR0QA/wD/AP+gvaeTAAAADUlEQVQI12NgYGD4DwABBAEAfbLI3wAAAABJRU5ErkJggg==')",
    minHeight: 160,
    position: "relative",
  },
  whatsappHeader: {
    backgroundColor: "#075e54",
    color: "#fff",
    padding: "8px 14px",
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    backgroundColor: "#ccc",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  contactName: {
    fontWeight: 600,
    fontSize: 13,
  },
  contactStatus: {
    fontSize: 10,
    color: "#b0d9b1",
  },
  chatArea: {
    padding: "16px 12px",
    minHeight: 100,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    textAlign: "center",
    color: "#999",
  },
  emptyIcon: {
    fontSize: 40,
    color: "#bbb",
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 12,
    color: "#999",
  },
  messageBubble: {
    backgroundColor: "#dcf8c6",
    borderRadius: "8px 0 8px 8px",
    padding: "8px 10px",
    maxWidth: "85%",
    marginLeft: "auto",
    boxShadow: "0 1px 1px rgba(0,0,0,0.13)",
    wordBreak: "break-word",
  },
  bodyText: {
    fontSize: 13,
    lineHeight: 1.4,
    color: "#303030",
    whiteSpace: "pre-wrap",
  },
  timeText: {
    fontSize: 10,
    color: "#8c8c8c",
    textAlign: "right",
    marginTop: 2,
  },
  inputBar: {
    backgroundColor: "#f0f0f0",
    padding: "6px 8px",
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  inputField: {
    flex: 1,
    backgroundColor: "#fff",
    border: "none",
    borderRadius: 20,
    padding: "8px 14px",
    fontSize: 13,
    outline: "none",
    color: "#666",
  },
  sendButton: {
    backgroundColor: "#075e54",
    color: "#fff",
    width: 34,
    height: 34,
    "&:hover": {
      backgroundColor: "#064e46",
    },
  },
  variablesHint: {
    padding: "8px 14px",
    fontSize: 12,
    color: theme.palette.text.secondary,
    borderTop: `1px solid ${theme.palette.divider}`,
    backgroundColor: "#fafafa",
  },
  highlight: {
    backgroundColor: "#fff9c4",
    borderRadius: 2,
    padding: "0 2px",
    fontWeight: 500,
  },
  mediaPlaceholder: {
    backgroundColor: "#f0f0f0",
    borderRadius: 6,
    padding: "10px 8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginBottom: 6,
    color: "#666",
    fontSize: 12,
  },
  mediaPreviewImg: {
    width: "100%",
    maxHeight: 120,
    objectFit: "cover",
    borderRadius: 6,
    marginBottom: 6,
  },
}));

const replaceCustomVars = (text) => {
  if (!text) return text;
  return text
    .replace(/\{nome\}/gi, "João Silva")
    .replace(/\{numero\}/gi, "5511999999999")
    .replace(/\{email\}/gi, "joao@email.com")
    .replace(/\{greeting\}/gi, "Bom dia")
    .replace(/\{protocol\}/gi, "2024010001")
    .replace(/\{([\w]+)\}/gi, (match, varName) => `[${varName}]`);
};

const renderTextWithVars = (text, classes) => {
  if (!text) return null;
  const parts = text.split(/(\{[\w]+\})/gi);
  return parts.map((part, i) => {
    if (/^\{[\w]+\}$/i.test(part)) {
      const replaced = replaceCustomVars(part);
      return <span key={i} className={classes.highlight}>{replaced}</span>;
    }
    return <span key={i}>{part}</span>;
  });
};

const MessagePreview = ({ messages, attachment, mediaPath, mediaName }) => {
  const classes = useStyles();

  const activeMessages = useMemo(() => {
    if (!messages) return [];
    return Object.entries(messages)
      .filter(([key, val]) => key.startsWith("message") && val && val.trim())
      .map(([key, val]) => ({ key, num: key.replace("message", ""), text: val }));
  }, [messages]);

  const currentMessage = activeMessages.length > 0 ? activeMessages[0].text : "";

  const getAttachmentPreview = () => {
    if (attachment) {
      const fileType = attachment.type || "";
      if (fileType.startsWith("image/")) {
        const url = URL.createObjectURL(attachment);
        return <img src={url} alt="Preview" className={classes.mediaPreviewImg} />;
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
    if (mediaPath) {
      return (
        <Box className={classes.mediaPlaceholder}>
          <ImageIcon fontSize="small" />
          <span>{mediaName || "Mídia anexada"}</span>
        </Box>
      );
    }
    return null;
  };

  return (
    <Box className={classes.container}>
      {/* Header */}
      <Box className={classes.header}>
        <ChatBubbleOutlineIcon className={classes.headerIcon} />
        <Box>
          <Typography className={classes.headerTitle}>{i18n.t("marketing.preview.title")}</Typography>
          <Typography className={classes.headerSubtitle}>
            {i18n.t("marketing.preview.subtitle")}
          </Typography>
        </Box>
      </Box>

      {/* WhatsApp Frame */}
      <Box className={classes.phoneFrame}>
        <Box className={classes.whatsappHeader}>
          <Box className={classes.avatar}>
            <PersonIcon style={{ color: "#fff", fontSize: 20 }} />
          </Box>
          <Box>
            <Typography className={classes.contactName}>{i18n.t("wallets.contact")}</Typography>
            <Typography className={classes.contactStatus}>{i18n.t("marketing.preview.online")}</Typography>
          </Box>
        </Box>

        <Box className={classes.chatArea}>
          {currentMessage ? (
            <Box className={classes.messageBubble}>
              {getAttachmentPreview()}
              <Typography className={classes.bodyText}>
                {renderTextWithVars(currentMessage, classes)}
              </Typography>
              <Typography className={classes.timeText}>
                {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </Typography>
            </Box>
          ) : (
            <Box className={classes.emptyState}>
              <ChatBubbleOutlineIcon className={classes.emptyIcon} />
              <Typography className={classes.emptyText}>
                {i18n.t("marketing.preview.empty")}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Input bar */}
        <Box className={classes.inputBar}>
          <input
            className={classes.inputField}
            placeholder={i18n.t("marketing.preview.inputPlaceholder")}
            readOnly
            value={currentMessage ? replaceCustomVars(currentMessage).substring(0, 50) + (currentMessage.length > 50 ? "..." : "") : ""}
          />
          <IconButton size="small" className={classes.sendButton}>
            <SendIcon style={{ fontSize: 18 }} />
          </IconButton>
        </Box>
      </Box>

      {/* Variables hint */}
      <Box className={classes.variablesHint}>
        {i18n.t("marketing.preview.availableVariables")} <strong>{"{nome}"}</strong>, <strong>{"{numero}"}</strong>, <strong>{"{email}"}</strong>, <strong>{"{greeting}"}</strong>, <strong>{"{protocol}"}</strong>
      </Box>
    </Box>
  );
};

export default MessagePreview;
