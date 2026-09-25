import {
  ArrowForwardIos,
  ContentCopy,
  Delete,
  LinkOff,
  RemoveCircle,
  Tag,
} from "@mui/icons-material";
import React, { memo } from "react";
import { useTheme } from "@material-ui/core/styles";
import { useNodeStorage } from "../../../stores/useNodeStorage";
import { Handle } from "react-flow-renderer";

export default memo(({ data, isConnectable, id }) => {
  const storageItems = useNodeStorage();
  const theme = useTheme();
  const isDark = (theme.palette.type || theme.palette.mode) === "dark";
  const accent = "#EF4444";

  const handleStyle = {
    background: accent,
    width: "16px",
    height: "16px",
    borderRadius: "50%",
    border: "2px solid #fff",
    boxShadow: "0 0 0 2px rgba(239,68,68,0.16)",
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
        minWidth: 220,
        maxWidth: 260,
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
          sx={{ color: "#fff", width: "9px", height: "9px", marginLeft: "2px", marginBottom: "1px", pointerEvents: "none" }}
        />
      </Handle>

      <div style={{ display: "flex", position: "absolute", right: 10, top: 10, gap: 8, alignItems: "center" }}>
        <ContentCopy onClick={() => { storageItems.setNodesStorage(id); storageItems.setAct("duplicate"); }} sx={iconActionStyle} />
        <LinkOff onClick={() => { storageItems.setNodesStorage(id); storageItems.setAct("disconnect"); }} sx={iconActionStyle} />
        <Delete onClick={() => { storageItems.setNodesStorage(id); storageItems.setAct("delete"); }} sx={iconActionStyle} />
      </div>

      <div style={{ color: theme.palette.text.primary, fontSize: "15px", display: "flex", alignItems: "center", fontWeight: 700, marginBottom: "10px", paddingRight: "54px" }}>
        <RemoveCircle sx={{ width: "16px", height: "16px", marginRight: "6px", color: accent }} />
        <div>Remover Tag</div>
      </div>

      <div style={{ background: isDark ? "rgba(239,68,68,0.10)" : "rgba(239,68,68,0.08)", border: `1px solid ${isDark ? "rgba(239,68,68,0.18)" : "rgba(239,68,68,0.14)"}`, borderRadius: "12px", padding: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", color: accent, marginBottom: 4 }}>
          <Tag sx={{ width: "14px", height: "14px" }} />
          <span style={{ fontSize: "11px", fontWeight: 700 }}>Tag configurada</span>
        </div>

        <div style={{ color: theme.palette.text.primary, fontSize: "12px", fontWeight: 600, wordBreak: "break-word" }}>
          {data?.tag?.name || "Tag não selecionada"}
        </div>

        <div style={{ fontSize: "10px", color: theme.palette.text.secondary, marginTop: "4px" }}>
          Remove a tag do contato quando este bloco for executado.
        </div>
      </div>

      <Handle
        type="source"
        position="right"
        style={{
          ...handleStyle,
          top: "50%",
          right: "-10px",
          transform: "translateY(-50%)"
        }}
        isConnectable={isConnectable}
      >
        <ArrowForwardIos
          sx={{ color: "#fff", width: "9px", height: "9px", marginLeft: "2px", marginBottom: "1px", pointerEvents: "none" }}
        />
      </Handle>
    </div>
  );
});
