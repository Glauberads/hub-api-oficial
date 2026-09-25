import React, { memo, useEffect, useState, useCallback } from "react";
import {
  Box,
  Typography,
  IconButton,
  Chip,
  Paper,
  Tooltip,
  FormControlLabel,
  Switch
} from "@mui/material";
import {
  QuestionAnswer,
  Code as VariablesIcon,
  ContentCopy as ContentCopyIcon,
  DeleteOutline as DeleteOutlineIcon,
  LinkOff as LinkOffIcon,
  Save as SaveIcon
} from "@mui/icons-material";

import { Handle } from "react-flow-renderer";
import { useNodeStorage } from "../../../stores/useNodeStorage";
import { processVariablesInText } from "../../../utils/variableUtils";
import { i18n } from "../../../translate/i18n";

export default memo(({ data, isConnectable, id }) => {
  const storageItems = useNodeStorage();

  const [processedQuestion, setProcessedQuestion] = useState(
    data.question || ""
  );
  const [variableValue, setVariableValue] = useState("");
  const [isExecutionMode, setIsExecutionMode] = useState(false);
  const [alwaysAsk, setAlwaysAsk] = useState(data.alwaysAsk || false);

  const purple = "#9c27b0";
  const purpleDark = "#7b1fa2";
  const purpleSoft = "rgba(156, 39, 176, 0.08)";
  const purpleBorder = "rgba(156, 39, 176, 0.22)";

  // ✅ ADICIONAR ESTE useEffect PARA CORRIGIR ESTILO DO REACT FLOW
  useEffect(() => {
    const styleId = "flowbuilder-input-node-wide-style";

    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.innerHTML = `
        .react-flow__node-input {
          width: 640px !important;
          min-width: 640px !important;
          max-width: none !important;
          padding: 0 !important;
          border: none !important;
          background: transparent !important;
          box-shadow: none !important;
          overflow: visible !important;
        }

        .react-flow__node-input .react-flow__handle {
          z-index: 30 !important;
          pointer-events: all !important;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  const extractVariables = text => {
    if (!text) return [];

    const regex = /\$\{([^}]+)\}/g;
    const matches = [];
    let match;

    while ((match = regex.exec(text)) !== null) {
      matches.push(match[1]);
    }

    return [...new Set(matches)];
  };

  const updateProcessedQuestion = useCallback(() => {
    const originalText = data.question || "";
    const newText = processVariablesInText(originalText);
    setProcessedQuestion(newText);
  }, [data.question]);

  useEffect(() => {
    const isExecutionPath = !window.location.pathname.includes(
      "/flowbuilder-config"
    );

    setIsExecutionMode(isExecutionPath);

    if (isExecutionPath && data.variableName) {
      const checkVariableValue = () => {
        if (window.flowVariables && window.flowVariables[data.variableName]) {
          setVariableValue(window.flowVariables[data.variableName]);
        }
      };

      checkVariableValue();

      const intervalId = setInterval(checkVariableValue, 1000);

      return () => clearInterval(intervalId);
    }
  }, [data.variableName]);

  useEffect(() => {
    updateProcessedQuestion();

    const handleVariableUpdate = () => {
      console.log("[inputNode] Detectada atualização de variáveis");
      updateProcessedQuestion();
    };

    window.addEventListener("flowVariableUpdate", handleVariableUpdate);

    const intervalId = setInterval(() => {
      updateProcessedQuestion();
    }, 500);

    return () => {
      window.removeEventListener("flowVariableUpdate", handleVariableUpdate);
      clearInterval(intervalId);
    };
  }, [data.question, updateProcessedQuestion]);

  useEffect(() => {
    data.alwaysAsk = alwaysAsk;
  }, [alwaysAsk, data]);

  const renderQuestion = () => {
    if (!data.question) {
      return (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ fontStyle: "italic" }}
        >
          Pergunta não definida
        </Typography>
      );
    }

    if (isExecutionMode) {
      return (
        <Typography variant="body2" sx={{ lineHeight: 1.45 }}>
          {processedQuestion}
        </Typography>
      );
    }

    return (
      <Box sx={{ lineHeight: 1.6 }}>
        {data.question.split(/\$\{([^}]+)\}/).map((part, index) => {
          if (index % 2 === 0) {
            return (
              <Typography
                key={index}
                variant="body2"
                component="span"
                sx={{ lineHeight: 1.45 }}
              >
                {part}
              </Typography>
            );
          }

          return (
            <Chip
              key={index}
              label={part}
              size="small"
              sx={{
                height: 20,
                fontSize: "0.72rem",
                bgcolor: "rgba(156, 39, 176, 0.12)",
                color: purple,
                border: "1px solid rgba(156, 39, 176, 0.22)",
                mx: 0.4,
                my: 0.15,
                "& .MuiChip-label": {
                  px: 1
                }
              }}
            />
          );
        })}
      </Box>
    );
  };

  return (
    <Box
      sx={{
        backgroundColor: "#fff",
        borderRadius: "14px",
        boxShadow: "0 6px 18px rgba(16, 24, 40, 0.12)",
        p: 0,
        width: 640,
        minWidth: 640,
        maxWidth: 640,
        minHeight: 175,
        display: "flex",
        flexDirection: "column",
        gap: 0,
        position: "relative",
        border: "1px solid rgba(156, 39, 176, 0.25)",
        overflow: "visible"
      }}
    >
      <Handle
        type="target"
        position="left"
        style={{
          left: -8,
          top: "50%",
          transform: "translateY(-50%)",
          background: purple,
          width: 13,
          height: 13,
          border: "2px solid #fff",
          zIndex: 30,
          cursor: "pointer"
        }}
        onConnect={params => console.log("handle onConnect", params)}
        isConnectable={isConnectable}
      />

      {/* Cabeçalho horizontal */}
      <Box
        sx={{
          height: 42,
          px: 1.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #9c27b0 0%, #7b1fa2 100%)",
          color: "#fff"
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box
            sx={{
              width: 28,
              height: 28,
              borderRadius: "8px",
              background: "rgba(255,255,255,0.16)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <QuestionAnswer fontSize="small" />
          </Box>

          <Box>
            <Typography
              variant="subtitle2"
              sx={{ fontWeight: 800, lineHeight: 1.1 }}
            >
              Input
            </Typography>
            <Typography
              variant="caption"
              sx={{
                opacity: 0.9,
                display: "block",
                lineHeight: 1.1,
                fontSize: "0.68rem"
              }}
            >
              Captura resposta do cliente
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 0.3 }}>
          <Tooltip title="Duplicar">
            <IconButton
              size="small"
              sx={{ color: "#fff" }}
              onClick={() => {
                storageItems.setNodesStorage(id);
                storageItems.setAct("duplicate");
              }}
            >
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title={i18n.t("connections.confirmationModal.disconnectTitle")}>
            <IconButton
              size="small"
              sx={{ color: "#fff" }}
              onClick={() => {
                storageItems.setNodesStorage(id);
                storageItems.setAct("disconnect");
              }}
            >
              <LinkOffIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title={i18n.t("chatList.delete")}>
            <IconButton
              size="small"
              sx={{ color: "#fff" }}
              onClick={() => {
                storageItems.setNodesStorage(id);
                storageItems.setAct("delete");
              }}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Conteúdo horizontal */}
      <Box
        sx={{
          p: 1.4,
          display: "flex",
          gap: 1.2,
          alignItems: "stretch"
        }}
      >
        {/* Pergunta */}
        <Paper
          elevation={0}
          sx={{
            flex: 1.7,
            bgcolor: "#fbf7fd",
            borderRadius: "10px",
            border: `1px solid ${purpleBorder}`,
            p: 1.2,
            minHeight: 76,
            maxHeight: 108,
            overflow: "auto"
          }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              display: "block",
              mb: 0.6,
              fontWeight: 700,
              textTransform: "uppercase",
              fontSize: "0.65rem",
              letterSpacing: 0.4
            }}
          >
            Pergunta
          </Typography>

          {renderQuestion()}
        </Paper>

        {/* Variável */}
        <Paper
          elevation={0}
          sx={{
            flex: 1,
            bgcolor: "#fbf7fd",
            borderRadius: "10px",
            border: `1px solid ${purpleBorder}`,
            p: 1.2,
            minHeight: 76,
            maxHeight: 108,
            overflow: "hidden"
          }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              display: "block",
              mb: 0.8,
              fontWeight: 700,
              textTransform: "uppercase",
              fontSize: "0.65rem",
              letterSpacing: 0.4
            }}
          >
            Variável
          </Typography>

          {data.variableName ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.8 }}>
              <Chip
                label={data.variableName}
                size="small"
                icon={
                  <VariablesIcon
                    sx={{
                      color: `${purple} !important`,
                      width: 16,
                      height: 16
                    }}
                  />
                }
                sx={{
                  width: "fit-content",
                  maxWidth: "100%",
                  height: 26,
                  fontSize: "0.8rem",
                  bgcolor: "rgba(156, 39, 176, 0.12)",
                  color: purpleDark,
                  border: "1px solid rgba(156, 39, 176, 0.22)",
                  fontWeight: 700,
                  "& .MuiChip-label": {
                    px: 1,
                    maxWidth: 135,
                    overflow: "hidden",
                    textOverflow: "ellipsis"
                  }
                }}
              />

              {isExecutionMode && variableValue && (
                <Tooltip title={`Valor: ${variableValue}`}>
                  <Box
                    sx={{
                      p: 0.75,
                      borderRadius: "8px",
                      bgcolor: "rgba(25, 118, 210, 0.08)",
                      border: "1px solid rgba(25, 118, 210, 0.18)",
                      display: "flex",
                      alignItems: "center",
                      gap: 0.6
                    }}
                  >
                    <SaveIcon
                      fontSize="small"
                      sx={{ color: "#1976d2", width: 16, height: 16 }}
                    />
                    <Typography
                      variant="caption"
                      color="primary"
                      sx={{
                        maxWidth: 150,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis"
                      }}
                    >
                      {variableValue}
                    </Typography>
                  </Box>
                </Tooltip>
              )}
            </Box>
          ) : (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontStyle: "italic" }}
            >
              Variável não definida
            </Typography>
          )}
        </Paper>
      </Box>

      {/* Rodapé horizontal */}
      <Box
        sx={{
          px: 1.4,
          pb: 1.2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1
        }}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          {data.question && data.question.includes("${") ? (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.7,
                bgcolor: purpleSoft,
                border: "1px solid rgba(156, 39, 176, 0.12)",
                px: 1,
                py: 0.6,
                borderRadius: "8px",
                maxWidth: 290
              }}
            >
              <VariablesIcon
                fontSize="small"
                sx={{ color: purple, width: 16, height: 16 }}
              />
              <Typography
                variant="caption"
                sx={{
                  color: purpleDark,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis"
                }}
              >
                Variáveis: {extractVariables(data.question).join(", ")}
              </Typography>
            </Box>
          ) : (
            <Typography
              variant="caption"
              sx={{ color: "text.secondary", fontStyle: "italic" }}
            >
              A resposta será salva para uso nos próximos blocos.
            </Typography>
          )}
        </Box>

        <Box
          sx={{
            bgcolor: purpleSoft,
            border: "1px solid rgba(156, 39, 176, 0.12)",
            borderRadius: "8px",
            px: 1,
            py: 0.4,
            flexShrink: 0
          }}
        >
          <FormControlLabel
            control={
              <Switch
                checked={alwaysAsk}
                onChange={e => setAlwaysAsk(e.target.checked)}
                size="small"
                color="secondary"
              />
            }
            label={
              <Typography variant="caption" sx={{ fontSize: "0.72rem" }}>
                Sempre perguntar
              </Typography>
            }
            sx={{ m: 0 }}
          />
        </Box>
      </Box>

      <Handle
        type="source"
        position="right"
        id="a"
        style={{
          right: -8,
          top: "50%",
          transform: "translateY(-50%)",
          background: purple,
          width: 13,
          height: 13,
          border: "2px solid #fff",
          zIndex: 30,
          cursor: "pointer"
        }}
        isConnectable={isConnectable}
      />
    </Box>
  );
});