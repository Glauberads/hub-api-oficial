import {
  ArrowForwardIos,
  ContentCopy,
  Delete,
  FormatListBulleted,
  LinkOff,
  TouchApp,
} from "@mui/icons-material";
import React, { memo } from "react";
import { useTheme } from "@material-ui/core/styles";

import { Handle } from "react-flow-renderer";
import { useNodeStorage } from "../../../stores/useNodeStorage";

export default memo(({ data, isConnectable, id }) => {
  const storageItems = useNodeStorage();
  const theme = useTheme();
  const isDark = (theme.palette.type || theme.palette.mode) === "dark";
  const isButton = (data?.interactiveType || "button") === "button";
  const color = isButton ? "#388E3C" : "#1976D2";
  const label = isButton ? "Botões" : "Lista";

  const handleStyle = {
    background: color,
    width: "16px",
    height: "16px",
    borderRadius: "50%",
    border: "2px solid #fff",
    boxShadow: "0 0 0 2px rgba(56,142,60,0.16)",
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
        maxWidth: "240px",
        minWidth: "220px",
        boxShadow: isDark ? "0 14px 32px rgba(0,0,0,0.22)" : "0 14px 32px rgba(15,23,42,0.08)",
        border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"}`,
        backdropFilter: "blur(10px)"
      }}
    >
      <Handle type="target" position="left" style={{ ...handleStyle, top: "24px", left: "-10px" }} onConnect={(params) => console.log("handle onConnect", params)} isConnectable={isConnectable}>
        <ArrowForwardIos sx={{ color: "#fff", width: "9px", height: "9px", marginLeft: "2px", marginBottom: "1px", pointerEvents: "none" }} />
      </Handle>

      <div style={{ display: "flex", position: "absolute", right: 10, top: 10, gap: 8, alignItems: "center" }}>
        <ContentCopy onClick={() => { storageItems.setNodesStorage(id); storageItems.setAct("duplicate"); }} sx={iconActionStyle} />
        <LinkOff onClick={() => { storageItems.setNodesStorage(id); storageItems.setAct("disconnect"); }} sx={iconActionStyle} />
        <Delete onClick={() => { storageItems.setNodesStorage(id); storageItems.setAct("delete"); }} sx={iconActionStyle} />
      </div>

      <div style={{ display: "flex", alignItems: "center", marginBottom: "4px", paddingRight: "54px" }}>
        <TouchApp sx={{ width: "16px", height: "16px", marginRight: "6px", color: "#9C27B0" }} />
        <div style={{ color: theme.palette.text.primary, fontSize: "14px", fontWeight: 700 }}>Msg Interativa API</div>
      </div>

      <div style={{ fontSize: "10px", color: theme.palette.text.secondary, marginBottom: "10px", textTransform: "uppercase", letterSpacing: ".04em" }}>
        {`${label} (máx. ${isButton ? 3 : 10})`}
      </div>

      {data?.headerImage && (
        <img
          src={process.env.REACT_APP_BACKEND_URL + "/public/" + data.headerImage}
          alt="Header"
          style={{ width: "100%", height: "68px", objectFit: "cover", borderRadius: "10px", marginBottom: "10px", display: "block" }}
          onError={(e) => { e.target.style.display = "none"; }}
        />
      )}

      <div style={{ color: theme.palette.text.primary, fontSize: "11px", overflow: "hidden", marginBottom: "10px", background: isDark ? "rgba(255,255,255,0.04)" : "rgba(248,250,252,0.95)", border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)"}`, borderRadius: "12px", padding: "8px 10px", lineHeight: 1.45, maxHeight: "62px" }}>
        {data?.message || "Corpo da mensagem..."}
      </div>

      {isButton && data?.arrayOption && data.arrayOption.slice(0, 3).map((option) => {
        const optionType = option.type || "quick_reply";
        const typePrefix = {
          quick_reply: "↩",
          cta_url: "↗",
          cta_copy: "⧉",
          cta_call: "☎"
        }[optionType] || "↩";
        return (
        <div key={option.number} style={{ display: "flex", alignItems: "center", position: "relative", marginTop: "6px" }}>
          <div style={{ padding: "8px 10px", fontSize: "11px", color: color, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", width: "100%", fontWeight: 600, borderRadius: "10px", background: isDark ? "rgba(56,142,60,0.10)" : "rgba(56,142,60,0.08)", border: `1px solid ${isDark ? "rgba(56,142,60,0.18)" : "rgba(56,142,60,0.14)"}` }}>
            {typePrefix} {option.value || `Botão ${option.number}`}
          </div>

          {optionType === "quick_reply" && (
            <Handle type="source" position="right" id={"a" + option.number} style={{ ...handleStyle, top: "50%", position: "absolute", right: "-10px", transform: "translateY(-50%)", flexShrink: 0 }} isConnectable={isConnectable}>
              <ArrowForwardIos sx={{ color: "#fff", width: "8px", height: "8px", marginLeft: "2px", marginBottom: "1px", pointerEvents: "none" }} />
            </Handle>
          )}
        </div>
      )})}

      {!isButton && (
        <div>
          <div style={{ padding: "8px 10px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", borderRadius: "10px", background: isDark ? "rgba(56,142,60,0.10)" : "rgba(56,142,60,0.08)", border: `1px solid ${isDark ? "rgba(56,142,60,0.18)" : "rgba(56,142,60,0.14)"}` }}>
            <FormatListBulleted sx={{ width: "13px", height: "13px", color }} />
            <span style={{ color, fontSize: "11px", fontWeight: 600 }}>{data?.listButtonText || "Selecionar"}</span>
          </div>

          {data?.arrayOption && data.arrayOption.map((option) => (
            <div key={option.number} style={{ display: "flex", alignItems: "center", position: "relative", marginTop: "6px" }}>
              <div style={{ padding: "8px 10px", fontSize: "11px", color: "#1976D2", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", width: "100%", fontWeight: 600, borderRadius: "10px", background: isDark ? "rgba(25,118,210,0.10)" : "rgba(25,118,210,0.08)", border: `1px solid ${isDark ? "rgba(25,118,210,0.18)" : "rgba(25,118,210,0.14)"}` }}>
                {option.value || `Item ${option.number}`}
              </div>

              <Handle type="source" position="right" id={"a" + option.number} style={{ ...handleStyle, top: "50%", position: "absolute", right: "-10px", transform: "translateY(-50%)", flexShrink: 0 }} isConnectable={isConnectable}>
                <ArrowForwardIos sx={{ color: "#fff", width: "8px", height: "8px", marginLeft: "2px", marginBottom: "1px", pointerEvents: "none" }} />
              </Handle>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
