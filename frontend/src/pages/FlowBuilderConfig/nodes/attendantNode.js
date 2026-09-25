import {
  ArrowForwardIos,
  ContentCopy,
  Delete,
  LinkOff,
  ConfirmationNumber,
  HeadsetMic,
} from "@mui/icons-material";
import React, { memo } from "react";
import TextField from "@mui/material/TextField";
import { useTheme } from "@material-ui/core/styles";
import { useNodeStorage } from "../../../stores/useNodeStorage";
import { Handle } from "react-flow-renderer";
import { Typography } from "@material-ui/core";
import { i18n } from "../../../translate/i18n";

export default memo(({ data, isConnectable, id }) => {
  const storageItems = useNodeStorage();
  const theme = useTheme();
  const isDark = (theme.palette.type || theme.palette.mode) === "dark";
  const accent = "#0872b9";

  const handleStyle = {
    background: accent,
    width: "16px",
    height: "16px",
    borderRadius: "50%",
    border: "2px solid #fff",
    boxShadow: "0 0 0 2px rgba(8,114,185,0.16)",
    cursor: "pointer"
  };

  const iconActionStyle = {
    width: "14px",
    height: "14px",
    color: isDark ? "rgba(226,232,240,0.78)" : "rgba(71,85,105,0.82)",
    cursor: "pointer"
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
        minWidth: 210,
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
            pointerEvents: "none",
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
          fontSize: "15px",
          flexDirection: "row",
          display: "flex",
          alignItems: "center",
          fontWeight: 700,
          color: theme.palette.text.primary,
          marginBottom: "10px",
          paddingRight: "52px"
        }}
      >
        <HeadsetMic
          sx={{
            width: "16px",
            height: "16px",
            marginRight: "6px",
            color: "#3aba38",
          }}
        />
        <div>{i18n.t("queueModal.bot.attendent")}</div>
      </div>

      <div
        style={{
          background: isDark ? "rgba(255,255,255,0.04)" : "rgba(248,250,252,0.95)",
          border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)"}`,
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
          Destino
        </div>

        <div
          style={{
            color: theme.palette.text.primary,
            fontSize: "13px",
            fontWeight: 600,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis"
          }}
        >
          {data?.user?.name || "Atendente não definido"}
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
            pointerEvents: "none",
          }}
        />
      </Handle>
    </div>
  );
});
