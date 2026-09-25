import React, { memo } from "react";
import { Handle, Position } from "react-flow-renderer";
import {
  Box,
  Typography,
  Paper,
  Chip,
  IconButton,
  Tooltip
} from "@mui/material";
import {
  AccountBalanceWallet,
  ContentCopy as ContentCopyIcon,
  DeleteOutline as DeleteOutlineIcon,
  LinkOff as LinkOffIcon
} from "@mui/icons-material";

import { useNodeStorage } from "../../../stores/useNodeStorage";
import { i18n } from "../../../translate/i18n";

export default memo(({ data, isConnectable, id }) => {
  const storageItems = useNodeStorage();

  const action = data?.action || data?.asaasAction || "secondCopyBoleto";
  const title = action === "secondCopyBoleto"
    ? i18n.t("automation.asaas.title")
    : data?.name || data?.label || i18n.t("automation.asaas.title");
  const cpfCnpjVariable =
    data?.cpfCnpjVariable ||
    data?.variableName ||
    data?.inputVariable ||
    "cpfCnpj";

  const sendMessage =
    data?.sendMessage === undefined ? true : Boolean(data?.sendMessage);

  const actionLabel =
    action === "secondCopyBoleto" ? i18n.t("automation.asaas.secondCopy") : action;

  return (
    <Box
      sx={{
        width: 430,
        minWidth: 430,
        maxWidth: 430,
        backgroundColor: "#fff",
        borderRadius: "14px",
        boxShadow: "0 6px 18px rgba(16, 24, 40, 0.12)",
        border: "1px solid rgba(47, 179, 68, 0.35)",
        position: "relative",
        overflow: "visible"
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{
          left: -8,
          top: "50%",
          transform: "translateY(-50%)",
          background: "#2fb344",
          width: 13,
          height: 13,
          border: "2px solid #fff",
          zIndex: 20,
          cursor: "pointer"
        }}
        isConnectable={isConnectable}
      />

      <Box
        sx={{
          height: 42,
          px: 1.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #0ca678 0%, #2fb344 100%)",
          color: "#fff",
          borderTopLeftRadius: "14px",
          borderTopRightRadius: "14px"
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
            <AccountBalanceWallet fontSize="small" />
          </Box>

          <Box>
            <Typography
              variant="subtitle2"
              sx={{ fontWeight: 800, lineHeight: 1.1 }}
            >
              {title}
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
              {i18n.t("automation.asaas.financialIntegration")}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 0.3 }}>
          <Tooltip title={i18n.t("automation.common.duplicate")}>
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

      <Box sx={{ p: 1.4 }}>
        <Paper
          elevation={0}
          sx={{
            bgcolor: "#f6fff8",
            border: "1px solid rgba(47, 179, 68, 0.18)",
            borderRadius: "10px",
            p: 1.2
          }}
        >
          <Typography
            variant="body2"
            sx={{ fontWeight: 800, mb: 0.6, color: "#1b7f38" }}
          >
            {actionLabel}
          </Typography>

          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", lineHeight: 1.45 }}
          >
            {i18n.t("automation.asaas.description")}
          </Typography>

          <Box
            sx={{
              mt: 1,
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 0.7
            }}
          >
            <Chip
              size="small"
              label={i18n.t("automation.asaas.variable", { variable: cpfCnpjVariable })}
              sx={{
                height: 24,
                bgcolor: "#e6fcf5",
                color: "#087f5b",
                fontWeight: 700,
                border: "1px solid rgba(8, 127, 91, 0.16)"
              }}
            />

            <Chip
              size="small"
              label={sendMessage ? i18n.t("automation.asaas.sendsMessage") : i18n.t("automation.asaas.onlyVariables")}
              sx={{
                height: 24,
                bgcolor: sendMessage ? "#ebfbee" : "#fff3bf",
                color: sendMessage ? "#2b8a3e" : "#e67700",
                fontWeight: 700,
                border: sendMessage
                  ? "1px solid rgba(43, 138, 62, 0.16)"
                  : "1px solid rgba(230, 119, 0, 0.16)"
              }}
            />
          </Box>
        </Paper>
      </Box>

      <Handle
        type="source"
        position={Position.Right}
        id="a"
        style={{
          right: -8,
          top: "50%",
          transform: "translateY(-50%)",
          background: "#2fb344",
          width: 13,
          height: 13,
          border: "2px solid #fff",
          zIndex: 20,
          cursor: "pointer"
        }}
        isConnectable={isConnectable}
      />
    </Box>
  );
});
