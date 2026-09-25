import {
  AccessTime,
  ArrowForwardIos,
  ContentCopy,
  Delete,
  Description,
  Image,
  LibraryBooks,
  LinkOff,
  Message,
  MicNone,
  Videocam,
} from "@mui/icons-material";
import React, { memo } from "react";
import { useTheme } from "@material-ui/core/styles";

import { Handle } from "react-flow-renderer";
import { useNodeStorage } from "../../../stores/useNodeStorage";
import { Typography } from "@mui/material";
import { i18n } from "../../../translate/i18n";

export default memo(({ data, isConnectable, id }) => {
  const storageItems = useNodeStorage();
  const theme = useTheme();
  const isDark = (theme.palette.type || theme.palette.mode) === "dark";
  const accent = "#F97316";
  const seq = Array.isArray(data?.seq) ? data.seq : [];
  const elements = Array.isArray(data?.elements) ? data.elements : [];

  const handleStyle = {
    background: accent,
    width: "16px",
    height: "16px",
    borderRadius: "50%",
    border: "2px solid #fff",
    boxShadow: "0 0 0 2px rgba(249,115,22,0.16)",
    cursor: "pointer"
  };

  const iconActionStyle = {
    width: "14px",
    height: "14px",
    color: isDark ? "rgba(226,232,240,0.78)" : "rgba(71,85,105,0.82)",
    cursor: "pointer"
  };

  const getElementByNumber = number =>
    elements.find(itemLoc => itemLoc.number === number) || {};

  const renderItem = item => {
    const current = getElementByNumber(item);

    if (item.includes("message")) {
      return {
        icon: <Message sx={{ color: accent, width: 16, height: 16 }} />,
        label: current.value || "Mensagem",
        subtitle: ""
      };
    }

    if (item.includes("interval")) {
      return {
        icon: <AccessTime sx={{ color: accent, width: 16, height: 16 }} />,
        label: `${current.value || 0} segundos`,
        subtitle: ""
      };
    }

    if (item.includes("img")) {
      return {
        icon: <Image sx={{ color: accent, width: 16, height: 16 }} />,
        label: current.original || current.value || "Imagem",
        subtitle: current.caption || ""
      };
    }

    if (item.includes("audio")) {
      return {
        icon: <MicNone sx={{ color: accent, width: 16, height: 16 }} />,
        label: current.original || "Áudio",
        subtitle: ""
      };
    }

    if (item.includes("video")) {
      return {
        icon: <Videocam sx={{ color: accent, width: 16, height: 16 }} />,
        label: current.original || "Vídeo",
        subtitle: ""
      };
    }

    if (item.includes("document")) {
      return {
        icon: <Description sx={{ color: accent, width: 16, height: 16 }} />,
        label: current.original || "Documento",
        subtitle: ""
      };
    }

    return {
      icon: <LibraryBooks sx={{ color: accent, width: 16, height: 16 }} />,
      label: "Item",
      subtitle: ""
    };
  };

  return (
    <div
      style={{
        position: "relative",
        background: isDark ? "rgba(15, 23, 42, 0.92)" : "rgba(255,255,255,0.96)",
        padding: "14px",
        borderRadius: "16px",
        border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"}`,
        boxShadow: isDark
          ? "0 14px 32px rgba(0,0,0,0.22)"
          : "0 14px 32px rgba(15,23,42,0.08)",
        width: 260,
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
          display: "flex",
          alignItems: "center",
          fontWeight: 700,
          marginBottom: "4px",
          paddingRight: "54px"
        }}
      >
        <LibraryBooks
          sx={{ width: "16px", height: "16px", marginRight: "6px", color: accent }}
        />
        <div>{i18n.t("campaigns.settings.content")}</div>
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
        Sequência com {seq.length} item{seq.length === 1 ? "" : "ns"}
      </div>

      <div
        style={{
          display: "grid",
          gap: "6px",
          maxHeight: 220,
          overflowY: "auto",
          paddingRight: 2
        }}
      >
        {seq.length > 0 ? (
          seq.map(item => {
            const current = renderItem(item);

            return (
              <div
                key={item}
                style={{
                  background: isDark ? "rgba(255,255,255,0.04)" : "rgba(248,250,252,0.95)",
                  border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)"}`,
                  borderRadius: "12px",
                  padding: "8px 10px"
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    marginBottom: current.subtitle ? "4px" : "6px"
                  }}
                >
                  {current.icon}
                </div>

                <Typography
                  textAlign={"center"}
                  sx={{
                    textOverflow: "ellipsis",
                    fontSize: "10px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    color: theme.palette.text.primary,
                    fontWeight: 500
                  }}
                >
                  {current.label}
                </Typography>

                {current.subtitle ? (
                  <Typography
                    textAlign={"center"}
                    sx={{
                      fontSize: "9px",
                      lineHeight: 1.25,
                      marginTop: "4px",
                      color: theme.palette.text.secondary,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      wordBreak: "break-word"
                    }}
                  >
                    {current.subtitle}
                  </Typography>
                ) : null}
              </div>
            );
          })
        ) : (
          <div
            style={{
              background: isDark ? "rgba(255,255,255,0.04)" : "rgba(248,250,252,0.95)",
              border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)"}`,
              borderRadius: "12px",
              padding: "12px",
              color: theme.palette.text.secondary,
              fontSize: "11px",
              textAlign: "center"
            }}
          >
            Nenhum item configurado.
          </div>
        )}
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
            pointerEvents: "none"
          }}
        />
      </Handle>
    </div>
  );
});