import { ContentCopy, Delete, Image, LinkOff, Message } from "@mui/icons-material";
import React, { memo } from "react";
import { useTheme } from "@material-ui/core/styles";

import { Handle } from "react-flow-renderer";
import { useNodeStorage } from "../../../stores/useNodeStorage";

export default memo(({ data, isConnectable, id }) => {
  const link = process.env.REACT_APP_BACKEND_URL === 'http://localhost:8090' ? 'http://localhost:8090' : process.env.REACT_APP_BACKEND_URL;

  const storageItems = useNodeStorage();
  const theme = useTheme();
  const isDark = (theme.palette.type || theme.palette.mode) === "dark";
  const accent = "#7C3AED";

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
        border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"}`,
        boxShadow: isDark ? "0 14px 32px rgba(0,0,0,0.22)" : "0 14px 32px rgba(15,23,42,0.08)",
        minWidth: 230,
        maxWidth: 260,
        backdropFilter: "blur(10px)"
      }}
    >
      <Handle
        type="target"
        position="left"
        style={{ ...handleStyle, top: "24px", left: "-10px" }}
        onConnect={(params) => console.log("handle onConnect", params)}
        isConnectable={isConnectable}
      />

      <div style={{ display: "flex", position: "absolute", right: 10, top: 10, gap: 8, alignItems: "center" }}>
        <ContentCopy onClick={() => { storageItems.setNodesStorage(id); storageItems.setAct("duplicate"); }} sx={iconActionStyle} />
        <LinkOff onClick={() => { storageItems.setNodesStorage(id); storageItems.setAct("disconnect"); }} sx={iconActionStyle} />
        <Delete onClick={() => { storageItems.setNodesStorage(id); storageItems.setAct("delete"); }} sx={iconActionStyle} />
      </div>

      <div style={{ color: theme.palette.text.primary, fontSize: "15px", flexDirection: "row", display: "flex", alignItems: "center", fontWeight: 700, marginBottom: "10px", paddingRight: "54px" }}>
        <Image sx={{ width: "16px", height: "16px", marginRight: "6px", color: accent }} />
        <div>Imagem</div>
      </div>

      <div style={{ background: isDark ? "rgba(255,255,255,0.04)" : "rgba(248,250,252,0.95)", border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)"}`, borderRadius: "12px", padding: "10px" }}>
        <img src={`${link}/public/${data?.url || ""}`} style={{ width: "100%", maxHeight: "180px", objectFit: "cover", borderRadius: "10px", display: "block" }} alt="Prévia" />
        {data?.caption && (
          <div style={{ marginTop: "8px", color: theme.palette.text.secondary, fontSize: "11px", lineHeight: 1.45, wordBreak: "break-word" }}>
            {data.caption}
          </div>
        )}
      </div>

      <Handle type="source" position="right" id="a" style={{ ...handleStyle, top: "50%", right: "-10px", transform: "translateY(-50%)" }} isConnectable={isConnectable} />
    </div>
  );
});
