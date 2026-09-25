import {
  ArrowForwardIos,
  ContentCopy,
  Delete,
  LinkOff,
} from "@mui/icons-material";
import React, { memo } from "react";
import { useTheme } from "@material-ui/core/styles";
import { useNodeStorage } from "../../../stores/useNodeStorage";
import { Handle } from "react-flow-renderer";
import { Box } from "@material-ui/core";
import typebotIcon from "../../../assets/typebot.jpg";
import { i18n } from "../../../translate/i18n";

export default memo(({ data, isConnectable, id }) => {
  const storageItems = useNodeStorage();
  const theme = useTheme();
  const isDark = (theme.palette.type || theme.palette.mode) === "dark";
  const accent = "#10B981";

  const handleStyle = {
    background: accent,
    width: "16px",
    height: "16px",
    borderRadius: "50%",
    border: "2px solid #fff",
    boxShadow: "0 0 0 2px rgba(16,185,129,0.16)",
    cursor: "pointer"
  };

  const iconActionStyle = {
    width: "14px",
    height: "14px",
    color: isDark ? "rgba(226,232,240,0.78)" : "rgba(71,85,105,0.82)",
    cursor: "pointer"
  };

  const normalizeBaseUrl = url =>
    (url || "").toString().trim().replace(/\/+$/, "");

  const normalizeSlug = slug =>
    (slug || "").toString().trim().replace(/^\/+/, "");

  const typebotName = data?.name || "TypeBot";
  const blockLabel = data?.slug || "Novo Typebot";
  const typebotSlug = normalizeSlug(data?.typebotSlug || "");
  const baseUrl = normalizeBaseUrl(data?.typebot || "https://typebot.io");

  const finalUrl =
    data?.fullUrl ||
    (typebotSlug ? `${baseUrl}/${typebotSlug}` : baseUrl || "");

  const waitForResponse =
    typeof data?.waitForResponse === "boolean"
      ? data.waitForResponse
      : true;

  const expireMinutes = data?.expireMinutes ?? 60;
  const messageInterval = data?.messageInterval ?? 1000;

  const stopEvent = e => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDuplicate = e => {
    stopEvent(e);
    storageItems.setNodesStorage(id);
    storageItems.setAct("duplicate");
  };

  const handleDisconnect = e => {
    stopEvent(e);
    storageItems.setNodesStorage(id);
    storageItems.setAct("disconnect");
  };

  const handleDelete = e => {
    stopEvent(e);
    storageItems.setNodesStorage(id);
    storageItems.setAct("delete");
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
        border: `1px solid ${
          isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"
        }`,
        minWidth: 220,
        maxWidth: 280,
        backdropFilter: "blur(10px)",
        cursor: "pointer"
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
        onConnect={params => console.log("handle onConnect", params)}
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
        <ContentCopy onClick={handleDuplicate} sx={iconActionStyle} />
        <LinkOff onClick={handleDisconnect} sx={iconActionStyle} />
        <Delete onClick={handleDelete} sx={iconActionStyle} />
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
        <Box
          component="img"
          sx={{
            width: 16,
            height: 16,
            marginRight: "6px",
            borderRadius: "4px"
          }}
          src={typebotIcon}
          alt="icon"
        />
        <div>{typebotName}</div>
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
        Integração externa
      </div>

      <div
        style={{
          color: theme.palette.text.primary,
          fontSize: "12px",
          width: "100%",
          background: isDark
            ? "rgba(16,185,129,0.10)"
            : "rgba(16,185,129,0.08)",
          border: `1px solid ${
            isDark ? "rgba(16,185,129,0.20)" : "rgba(16,185,129,0.14)"
          }`,
          marginBottom: "8px",
          borderRadius: "12px",
          padding: "10px 12px",
          boxSizing: "border-box"
        }}
      >
        <div
          style={{
            textAlign: "center",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            fontSize: "11px",
            fontWeight: 700,
            marginBottom: "2px"
          }}
          title={blockLabel}
        >
          {blockLabel}
        </div>

        {typebotSlug ? (
          <div
            style={{
              textAlign: "center",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              fontSize: "10px",
              opacity: 0.85
            }}
            title={typebotSlug}
          >
            /{typebotSlug}
          </div>
        ) : null}
      </div>

      {finalUrl ? (
        <div
          style={{
            fontSize: "10px",
            color: theme.palette.text.secondary,
            marginBottom: "8px",
            lineHeight: 1.35,
            wordBreak: "break-word"
          }}
          title={finalUrl}
        >
          <strong style={{ color: theme.palette.text.primary }}>URL:</strong>{" "}
          {finalUrl}
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "8px",
          marginBottom: "2px"
        }}
      >
        <div
          style={{
            flex: 1,
            background: isDark ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.04)",
            border: `1px solid ${
              isDark ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.06)"
            }`,
            borderRadius: "10px",
            padding: "6px 8px",
            boxSizing: "border-box"
          }}
        >
          <div
            style={{
              fontSize: "9px",
              color: theme.palette.text.secondary,
              textTransform: "uppercase",
              marginBottom: "2px"
            }}
          >
            Expira
          </div>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: theme.palette.text.primary
            }}
          >
            {expireMinutes} min
          </div>
        </div>

        <div
          style={{
            flex: 1,
            background: isDark ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.04)",
            border: `1px solid ${
              isDark ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.06)"
            }`,
            borderRadius: "10px",
            padding: "6px 8px",
            boxSizing: "border-box"
          }}
        >
          <div
            style={{
              fontSize: "9px",
              color: theme.palette.text.secondary,
              textTransform: "uppercase",
              marginBottom: "2px"
            }}
          >
            {i18n.t("recurrenceSection.labelInterval")}
          </div>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: theme.palette.text.primary
            }}
          >
            {messageInterval} ms
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: "8px",
          fontSize: "10px",
          color: waitForResponse ? accent : theme.palette.text.secondary,
          fontWeight: 600
        }}
      >
        {waitForResponse
          ? "Aguardando resposta do Typebot"
          : "Sem espera de resposta"}
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