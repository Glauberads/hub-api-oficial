import React, { useState, useCallback, useEffect } from "react";
import {
  Box,
  TextField,
  Typography,
  IconButton,
  Button
} from "@mui/material";
import DataObjectIcon from "@mui/icons-material/DataObject";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import { useTheme } from "@material-ui/core/styles";
import { Handle } from "react-flow-renderer";
import { useNodeStorage } from "../../../stores/useNodeStorage";
import { i18n } from "../../../translate/i18n";

const VariableNode = React.memo(({ data, id }) => {
  const theme = useTheme();
  const isDark = (theme.palette.type || theme.palette.mode) === "dark";
  const accent = "#0EA5E9";

  const [variableName, setVariableName] = useState(data.variableName || "");
  const [variableValue, setVariableValue] = useState(data.variableValue || "");
  const [variableType, setVariableType] = useState(data.variableType || "text");
  const [savedStatus, setSavedStatus] = useState(data.savedStatus || "");
  const [showSavePopup, setShowSavePopup] = useState(false);

  const storageItems = useNodeStorage();

  useEffect(() => {
    data.variableName = variableName;
    data.variableValue = variableValue;
    data.variableType = variableType;
    data.savedStatus = savedStatus;
  }, [variableName, variableValue, variableType, savedStatus, data]);

  useEffect(() => {
    let timer;
    if (showSavePopup) {
      timer = setTimeout(() => {
        setShowSavePopup(false);
      }, 3000);
    }
    return () => clearTimeout(timer);
  }, [showSavePopup]);

  const handleSave = useCallback(() => {
    if (variableName) {
      window.flowVariables = window.flowVariables || {};
      window.flowVariables[variableName] = variableValue;
      setSavedStatus("Salvo!");
      setShowSavePopup(true);
    }
  }, [variableName, variableValue]);

  const handleStyle = {
    background: accent,
    width: 16,
    height: 16,
    borderRadius: "50%",
    border: "2px solid #fff",
    boxShadow: "0 0 0 2px rgba(14,165,233,0.16)"
  };

  const actionButtonSx = {
    color: isDark ? "rgba(226,232,240,0.78)" : "rgba(71,85,105,0.82)",
    p: 0.5
  };

  return (
    <Box
      sx={{
        position: "relative",
        background: isDark ? "rgba(15, 23, 42, 0.92)" : "rgba(255,255,255,0.96)",
        borderRadius: "16px",
        boxShadow: isDark
          ? "0 14px 32px rgba(0,0,0,0.22)"
          : "0 14px 32px rgba(15,23,42,0.08)",
        border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"}`,
        backdropFilter: "blur(10px)",
        p: 1.75,
        width: 292,
        display: "flex",
        flexDirection: "column",
        gap: 1.25,
        overflow: "visible"
      }}
    >
      <Handle
        type="target"
        position="left"
        id="variable-in"
        style={{
          ...handleStyle,
          left: -10,
          top: "24px"
        }}
      />

      <Box display="flex" justifyContent="space-between" alignItems="center" pr={5}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <DataObjectIcon fontSize="small" sx={{ color: accent }} />
          <Typography
            variant="subtitle2"
            sx={{ fontWeight: 700, color: theme.palette.text.primary }}
          >
            Variável Global
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          display: "flex",
          position: "absolute",
          right: 10,
          top: 10,
          gap: 0.25,
          alignItems: "center"
        }}
      >
        <IconButton
          size="small"
          sx={actionButtonSx}
          onClick={() => {
            storageItems.setNodesStorage(id);
            storageItems.setAct("duplicate");
          }}
        >
          <ContentCopyIcon fontSize="small" />
        </IconButton>

        <IconButton
          size="small"
          sx={actionButtonSx}
          onClick={() => {
            storageItems.setNodesStorage(id);
            storageItems.setAct("disconnect");
          }}
        >
          <LinkOffIcon fontSize="small" />
        </IconButton>

        <IconButton
          size="small"
          sx={actionButtonSx}
          onClick={() => {
            storageItems.setNodesStorage(id);
            storageItems.setAct("delete");
          }}
        >
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </Box>

      <Typography
        variant="caption"
        sx={{
          color: theme.palette.text.secondary,
          textTransform: "uppercase",
          letterSpacing: ".04em",
          mt: -0.25
        }}
      >
        Definição de valor global
      </Typography>

      <TextField
        label="Nome da variável"
        size="small"
        value={variableName}
        onChange={(e) => setVariableName(e.target.value)}
        fullWidth
        variant="outlined"
        InputProps={{
          sx: {
            borderRadius: "12px",
            background: isDark ? "rgba(255,255,255,0.04)" : "rgba(248,250,252,0.95)"
          }
        }}
      />

      <TextField
        label={i18n.t("financial.value")}
        size="small"
        value={variableValue}
        onChange={(e) => setVariableValue(e.target.value)}
        fullWidth
        multiline
        minRows={2}
        maxRows={4}
        variant="outlined"
        helperText="Você pode usar valores estáticos ou referências como ${outraVariavel}"
        InputProps={{
          sx: {
            borderRadius: "12px",
            background: isDark ? "rgba(255,255,255,0.04)" : "rgba(248,250,252,0.95)"
          }
        }}
        FormHelperTextProps={{
          sx: {
            color: theme.palette.text.secondary,
            mx: 0.5
          }
        }}
      />

      <Box display="flex" justifyContent="space-between" alignItems="center" mt={0.5}>
        <Typography
          variant="caption"
          sx={{ color: savedStatus === "Salvo!" ? "success.main" : "text.secondary" }}
        >
          {savedStatus}
        </Typography>
        <Button
          variant="contained"
          size="small"
          onClick={handleSave}
          startIcon={<CheckCircleOutlineIcon />}
          sx={{
            textTransform: "none",
            boxShadow: "none",
            borderRadius: "12px",
            px: 1.4,
            background: `linear-gradient(135deg, ${accent} 0%, #0284C7 100%)`,
            "&:hover": {
              boxShadow: "none",
              background: `linear-gradient(135deg, ${accent} 0%, #0284C7 100%)`
            }
          }}
        >
          Salvar variável
        </Button>
      </Box>

      {showSavePopup && (
        <Box
          sx={{
            position: "absolute",
            top: "58px",
            right: "12px",
            backgroundColor: "#10B981",
            color: "white",
            padding: "8px 14px",
            borderRadius: "10px",
            boxShadow: "0 10px 24px rgba(0,0,0,0.18)",
            zIndex: 1000,
            animation: "fadeIn 0.3s ease-in-out",
            "@keyframes fadeIn": {
              "0%": { opacity: 0, transform: "translateY(-8px)" },
              "100%": { opacity: 1, transform: "translateY(0)" }
            }
          }}
        >
          <Typography variant="body2">Variável salva com sucesso!</Typography>
        </Box>
      )}

      <Handle
        type="source"
        position="right"
        id="variable-out"
        style={{
          ...handleStyle,
          right: -10,
          top: "50%",
          transform: "translateY(-50%)"
        }}
      />
    </Box>
  );
});

export default VariableNode;

export const getFlowVariable = (name) => {
  if (!window.flowVariables) {
    return undefined;
  }
  return window.flowVariables[name];
};

export const setFlowVariable = (name, value) => {
  if (!window.flowVariables) {
    window.flowVariables = {};
  }

  window.flowVariables[name] = value;

  const event = new CustomEvent("flowVariableUpdate", {
    detail: { name, value }
  });
  window.dispatchEvent(event);

  return value;
};
