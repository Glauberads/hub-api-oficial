import {
  ArrowForwardIos,
  ContentCopy,
  Delete,
  LinkOff,
} from "@mui/icons-material";
import React, { memo } from "react";
import { useTheme } from "@material-ui/core/styles";
import { useNodeStorage } from "../../../stores/useNodeStorage";
import { Handle } from "react-flow-renderer";
import { SiOpenai } from "react-icons/si";
import { i18n } from "../../../translate/i18n";

const promptTemplateLabels = {
  atendimento_comercial: "Atendimento comercial",
  suporte_tecnico: "Suporte técnico",
  qualificacao_lead: "Qualificação de lead",
  agendamento: "Agendamento",
  cobranca_educada: "Cobrança educada",
  secretaria_virtual: "Secretária virtual",
  pos_venda: "Pós-venda"
};

const modelLabels = {
  "gpt-3.5-turbo": "GPT 3.5 Turbo",
  "gpt-3.5-turbo-1106": "GPT 3.5 Turbo (1106)",
  "gpt-3.5-turbo-16k": "GPT 3.5 Turbo 16K",
  "gpt-4": "GPT 4",
  "gpt-4-turbo": "GPT 4 Turbo",
  "gpt-4o": "GPT 4o",
  "gpt-4o-mini": "GPT 4o Mini"
};

export default memo(({ data, isConnectable, id }) => {
  const storageItems = useNodeStorage();
  const theme = useTheme();
  const isDark = (theme.palette.type || theme.palette.mode) === "dark";
  const accent = "#10A37F";

  const integration =
    data?.typebotIntegration ||
    data?.data?.typebotIntegration ||
    data ||
    {};

  const assistantName =
    integration?.name ||
    integration?.projectName ||
    integration?.assistantName ||
    integration?.promptName ||
    "GPT AI Assistant";

  const selectedModel =
    modelLabels[integration?.model] ||
    integration?.model ||
    "GPT 4o";

  const selectedTemplate =
    promptTemplateLabels[integration?.promptTemplateId] ||
    null;

  const flowMode =
    integration?.flowMode === "temporary" ? "Temporário" : "Permanente";

  const handleStyle = {
    background: accent,
    width: "16px",
    height: "16px",
    borderRadius: "50%",
    border: "2px solid #fff",
    boxShadow: "0 0 0 2px rgba(16,163,127,0.16)",
    cursor: "pointer"
  };

  const iconActionStyle = {
    width: "14px",
    height: "14px",
    color: isDark ? "rgba(226,232,240,0.78)" : "rgba(71,85,105,0.82)",
    cursor: "pointer"
  };

  const chipStyle = {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 8px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 600,
    lineHeight: 1.2,
    border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"}`,
    background: isDark ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.04)",
    color: theme.palette.text.secondary
  };

  return (
    <div
      style={{
        position: "relative",
        background: isDark ? "rgba(15, 23, 42, 0.92)" : "rgba(255,255,255,0.96)",
        padding: "14px",
        borderRadius: "16px",
        boxShadow: isDark
          ? "0 14px 32px rgba(0,0,0,0.22)"
          : "0 14px 32px rgba(15,23,42,0.08)",
        border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"}`,
        minWidth: 240,
        maxWidth: 280,
        backdropFilter: "blur(10px)"
      }}
    >
      <Handle
        type="target"
        position="left"
        style={{
          ...handleStyle,
          top: "24px",
          left: "-10px"
        }}
        onConnect={(params) => console.log("handle onConnect", params)}
        isConnectable={isConnectable}
      >
        <ArrowForwardIos
          sx={{
            color: "#fff",
            width: "9px",
            height: "9px",
            marginLeft: "2px",
            marginBottom: "1px",
            pointerEvents: "none"
          }}
        />
      </Handle>

      <div
        style={{
          display: "flex",
          position: "absolute",
          right: 10,
          top: 10,
          gap: 8,
          alignItems: "center"
        }}
      >
        <ContentCopy
          onClick={() => {
            storageItems.setNodesStorage(id);
            storageItems.setAct("duplicate");
          }}
          sx={iconActionStyle}
        />
        <LinkOff
          onClick={() => {
            storageItems.setNodesStorage(id);
            storageItems.setAct("disconnect");
          }}
          sx={iconActionStyle}
        />
        <Delete
          onClick={() => {
            storageItems.setNodesStorage(id);
            storageItems.setAct("delete");
          }}
          sx={iconActionStyle}
        />
      </div>

      <div
        style={{
          color: theme.palette.text.primary,
          fontSize: "15px",
          display: "flex",
          alignItems: "center",
          fontWeight: 700,
          marginBottom: "10px",
          paddingRight: "54px"
        }}
      >
        <SiOpenai
          style={{
            width: "16px",
            height: "16px",
            marginRight: "6px",
            color: accent,
            flexShrink: 0
          }}
        />
        <div>OpenAI</div>
      </div>

      <div
        style={{
          background: isDark ? "rgba(16,163,127,0.10)" : "rgba(236,253,245,0.95)",
          border: `1px solid ${isDark ? "rgba(16,163,127,0.20)" : "rgba(16,163,127,0.14)"}`,
          borderRadius: "12px",
          padding: "10px 12px"
        }}
      >
        <div
          style={{
            color: theme.palette.text.secondary,
            fontSize: "11px",
            marginBottom: "4px",
            textTransform: "uppercase",
            letterSpacing: ".04em"
          }}
        >
          {i18n.t("queueModal.bot.integration")}
        </div>

        <div
          style={{
            color: theme.palette.text.primary,
            fontSize: "13px",
            fontWeight: 700,
            marginBottom: "6px",
            wordBreak: "break-word"
          }}
        >
          {assistantName}
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6
          }}
        >
          <span style={chipStyle}>{selectedModel}</span>
          <span style={chipStyle}>{flowMode}</span>
          {selectedTemplate && <span style={chipStyle}>{selectedTemplate}</span>}
        </div>
      </div>

      <Handle
        type="source"
        position="right"
        id="a"
        style={{
          ...handleStyle,
          top: "50%",
          right: "-10px",
          transform: "translateY(-50%)"
        }}
        isConnectable={isConnectable}
      >
        <ArrowForwardIos
          sx={{
            color: "#fff",
            width: "9px",
            height: "9px",
            marginLeft: "2px",
            marginBottom: "1px",
            pointerEvents: "none"
          }}
        />
      </Handle>
    </div>
  );
});