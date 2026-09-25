import {
  ArrowForwardIos,
  ContentCopy,
  Delete,
  LinkOff,
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
  const accent = "#2563EB";

  const handleStyle = {
    background: accent,
    width: "16px",
    height: "16px",
    borderRadius: "50%",
    border: "2px solid #fff",
    boxShadow: "0 0 0 2px rgba(37,99,235,0.16)",
    cursor: "pointer"
  };

  const iconActionStyle = {
    width: "14px",
    height: "14px",
    color: isDark ? "rgba(226,232,240,0.78)" : "rgba(71,85,105,0.82)",
    cursor: "pointer"
  };

  const tagName = data?.tag?.name || "Tag não definida";

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
        maxWidth: 250,
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
          color: theme.palette.text.primary,
          fontSize: "15px",
          flexDirection: "row",
          display: "flex",
          alignItems: "center",
          fontWeight: 700,
          marginBottom: "4px",
          paddingRight: "54px"
        }}
      >
        <Tag
          sx={{
            width: "16px",
            height: "16px",
            marginRight: "6px",
            color: accent,
          }}
        />
        <div>Tag</div>
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
        Ação de marcação
      </div>

      <div
        style={{
          color: theme.palette.text.primary,
          fontSize: "12px",
          width: "100%",
          background: isDark ? "rgba(37,99,235,0.10)" : "rgba(37,99,235,0.08)",
          border: `1px solid ${isDark ? "rgba(37,99,235,0.20)" : "rgba(37,99,235,0.14)"}`,
          marginBottom: "3px",
          borderRadius: "12px",
          padding: "10px 12px",
          boxSizing: "border-box"
        }}
      >
        <div
          style={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            fontSize: "11px",
            display: "flex",
            color: theme.palette.text.primary,
            justifyContent: "center",
            fontWeight: 600
          }}
        >
          {tagName}
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
