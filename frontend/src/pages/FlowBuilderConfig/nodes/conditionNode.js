import { ImportExport, Message } from "@mui/icons-material";
import React, { memo } from "react";
import { useTheme } from "@material-ui/core/styles";

import { Handle } from "react-flow-renderer";

export default memo(({ data, isConnectable }) => {
  const theme = useTheme();
  const isDark = (theme.palette.type || theme.palette.mode) === "dark";
  const accent = "#7C3AED";

  const typeCondition = (value) => {
    if (value === 1) return "==";
    if (value === 2) return ">=";
    if (value === 3) return "<=";
    if (value === 4) return "<";
    if (value === 5) return ">";
    return "==";
  };

  const handleStyle = {
    background: accent,
    width: "16px",
    height: "16px",
    borderRadius: "50%",
    border: "2px solid #fff",
    boxShadow: "0 0 0 2px rgba(124,58,237,0.16)"
  };

  return (
    <div style={{ position: "relative", background: isDark ? "rgba(15, 23, 42, 0.92)" : "rgba(255,255,255,0.96)", padding: "14px", borderRadius: "16px", border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"}`, boxShadow: isDark ? "0 14px 32px rgba(0,0,0,0.22)" : "0 14px 32px rgba(15,23,42,0.08)", minWidth: 210, backdropFilter: "blur(10px)" }}>
      <Handle type="target" position="left" style={{ ...handleStyle, top: "50%", left: "-10px", transform: "translateY(-50%)" }} onConnect={(params) => console.log("handle onConnect", params)} isConnectable={isConnectable} />

      <div style={{ color: theme.palette.text.primary, fontSize: "15px", flexDirection: "row", display: "flex", alignItems: "center", fontWeight: 700, marginBottom: "12px" }}>
        <ImportExport sx={{ width: "16px", height: "16px", marginRight: "6px", color: accent }} />
        <div>Condição</div>
      </div>

      <div style={{ display: "grid", gap: "8px" }}>
        <div style={{ padding: "8px 10px", borderRadius: "10px", background: isDark ? "rgba(255,255,255,0.04)" : "rgba(248,250,252,0.95)", border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)"}`, color: theme.palette.text.primary, fontSize: "12px", fontWeight: 600 }}>
          {data?.key || "variável"}
        </div>

        <div style={{ justifySelf: "center", padding: "4px 10px", borderRadius: "999px", background: isDark ? "rgba(124,58,237,0.16)" : "rgba(124,58,237,0.08)", color: accent, fontSize: "12px", fontWeight: 700 }}>
          {typeCondition(data?.condition)}
        </div>

        <div style={{ padding: "8px 10px", borderRadius: "10px", background: isDark ? "rgba(255,255,255,0.04)" : "rgba(248,250,252,0.95)", border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)"}`, color: theme.palette.text.primary, fontSize: "12px", fontWeight: 600 }}>
          {data?.value || "valor"}
        </div>
      </div>

      <Handle type="source" position="right" id="a" style={{ ...handleStyle, top: 38, right: "-10px" }} isConnectable={isConnectable} />
      <Handle type="source" position="right" id="b" style={{ ...handleStyle, bottom: 38, top: "auto", right: "-10px" }} isConnectable={isConnectable} />
    </div>
  );
});
