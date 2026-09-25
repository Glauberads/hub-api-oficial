import { ArrowForwardIos, RocketLaunch } from "@mui/icons-material";
import React, { memo } from "react";
import { i18n } from "../../../translate/i18n";
import { useTheme } from "@material-ui/core/styles";

import { Handle } from "react-flow-renderer";

export default memo(({ data, isConnectable }) => {
  const theme = useTheme();
  const isDark = (theme.palette.type || theme.palette.mode) === "dark";
  const accent = "#22C55E";

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
      <div style={{ color: theme.palette.text.primary, fontSize: "15px", display: "flex", alignItems: "center", fontWeight: 700, marginBottom: "8px" }}>
        <RocketLaunch sx={{ width: "16px", height: "16px", marginRight: "6px", color: accent }} />
        <div>{i18n.t("analytics.flow.startTitle")}</div>
      </div>

      <div style={{ color: theme.palette.text.secondary, fontSize: "12px", lineHeight: 1.5 }}>
        {i18n.t("analytics.flow.startDescription")}
      </div>

      <Handle
        type="source"
        position="right"
        id="a"
        style={{
          background: accent,
          width: "16px",
          height: "16px",
          borderRadius: "50%",
          border: "2px solid #fff",
          boxShadow: "0 0 0 2px rgba(34,197,94,0.16)",
          top: "50%",
          right: "-10px",
          transform: "translateY(-50%)",
          cursor: "pointer"
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
