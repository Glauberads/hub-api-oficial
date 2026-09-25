import {
  ArrowForwardIos,
  ContentCopy,
  Delete,
  Dialpad,
  LinkOff,
} from "@mui/icons-material";
import React, { memo } from "react";
import { useTheme } from "@material-ui/core/styles";

import { Handle } from "react-flow-renderer";
import { useNodeStorage } from "../../../stores/useNodeStorage";

export default memo(({ data, isConnectable, id }) => {
  const storageItems = useNodeStorage();
  const theme = useTheme();
  const isDark = (theme.palette.type || theme.palette.mode) === "dark";
  const accent = "#7C3AED";
  const options = Array.isArray(data?.arrayOption) ? data.arrayOption : [];

  const handleStyle = {
    background: accent,
    width: "16px",
    height: "16px",
    borderRadius: "50%",
    border: "2px solid #fff",
    boxShadow: "0 0 0 2px rgba(124,58,237,0.16)",
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
        minWidth: 235,
        maxWidth: 270,
        boxShadow: isDark
          ? "0 14px 32px rgba(0,0,0,0.22)"
          : "0 14px 32px rgba(15,23,42,0.08)",
        border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"}`,
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
        <ContentCopy onClick={() => { storageItems.setNodesStorage(id); storageItems.setAct("duplicate"); }} sx={iconActionStyle} />
        <LinkOff onClick={() => { storageItems.setNodesStorage(id); storageItems.setAct("disconnect"); }} sx={iconActionStyle} />
        <Delete onClick={() => { storageItems.setNodesStorage(id); storageItems.setAct("delete"); }} sx={iconActionStyle} />
      </div>

      <div
        style={{
          color: theme.palette.text.primary,
          fontSize: "15px",
          display: "flex",
          alignItems: "center",
          fontWeight: 700,
          marginBottom: "4px",
          paddingRight: "54px"
        }}
      >
        <Dialpad sx={{ width: "16px", height: "16px", marginRight: "6px", color: accent }} />
        <div>Menu Numérico</div>
      </div>

      <div
        style={{
          fontSize: "10px",
          color: theme.palette.text.secondary,
          marginBottom: "10px",
          textTransform: "uppercase",
          letterSpacing: ".04em"
        }}
      >
        {options.length} opção{options.length === 1 ? "" : "ões"}
      </div>

      <div
        style={{
          color: theme.palette.text.primary,
          fontSize: "11px",
          overflow: "hidden",
          marginBottom: "10px",
          background: isDark ? "rgba(255,255,255,0.04)" : "rgba(248,250,252,0.95)",
          border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)"}`,
          borderRadius: "12px",
          padding: "8px 10px",
          lineHeight: 1.45,
          maxHeight: "62px",
          wordBreak: "break-word"
        }}
      >
        {data?.message || "Mensagem do menu..."}
      </div>

      {options.map((option, index) => (
        <div
          key={option.number}
          style={{
            display: "flex",
            alignItems: "center",
            position: "relative",
            marginTop: index === 0 ? 0 : "6px"
          }}
        >
          <div
            style={{
              padding: "8px 12px",
              fontSize: "11px",
              color: theme.palette.text.primary,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              width: "100%",
              fontWeight: 600,
              borderRadius: "10px",
              background: isDark ? "rgba(124,58,237,0.10)" : "rgba(124,58,237,0.08)",
              border: `1px solid ${isDark ? "rgba(124,58,237,0.18)" : "rgba(124,58,237,0.14)"}`
            }}
          >
            <span style={{ color: accent, marginRight: 6 }}>[{option.number}]</span>
            {option.value || `Opção ${option.number}`}
          </div>

          <Handle
            type="source"
            position="right"
            id={"a" + option.number}
            style={{
              ...handleStyle,
              top: "50%",
              position: "absolute",
              right: "-10px",
              transform: "translateY(-50%)",
              flexShrink: 0
            }}
            isConnectable={isConnectable}
          >
            <ArrowForwardIos
              sx={{
                color: "#fff",
                width: "8px",
                height: "8px",
                marginLeft: "2px",
                marginBottom: "1px",
                pointerEvents: "none"
              }}
            />
          </Handle>
        </div>
      ))}
    </div>
  );
});
