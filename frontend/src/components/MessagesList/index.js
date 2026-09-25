import React, { useContext, useState, useEffect, useReducer, useRef } from "react";
import { isSameDay, parseISO, format } from "date-fns";
import clsx from "clsx";
import { isNil } from "lodash";
import { blue, green } from "@material-ui/core/colors";
import {
  Button,
  Divider,
  Typography,
  IconButton,
  makeStyles
} from "@material-ui/core";

import {
  AccessTime,
  Done,
  DoneAll,
  ExpandMore,
  GetApp,
  Facebook,
  Instagram,
  Reply,
  WhatsApp
} from "@material-ui/icons";
import LockIcon from "@material-ui/icons/Lock";
import MarkdownWrapper from "../MarkdownWrapper";
import VcardPreview from "../VcardPreview";
import LocationPreview from "../LocationPreview";
import ModalImageCors from "../ModalImageCors";
import MessageOptionsMenu from "../MessageOptionsMenu";
import whatsBackground from "../../assets/wa-background.png";
import whatsBackgroundDark from "../../assets/wa-background-dark.png";
import YouTubePreview from "../ModalYoutubeCors";
import PdfPreview from "../PdfPreview";
import { ReplyMessageContext } from "../../context/ReplyingMessage/ReplyingMessageContext";
import { ForwardMessageContext } from "../../context/ForwarMessage/ForwardMessageContext";
import AdMetaPreview from "../AdMetaPreview";
import FacebookPostPreview from "../FacebookPostPreview";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import SelectMessageCheckbox from "./SelectMessageCheckbox";
import useCompanySettings from "../../hooks/useSettings/companySettings";
import { AuthContext } from "../../context/Auth/AuthContext";
import { QueueSelectedContext } from "../../context/QueuesSelected/QueuesSelectedContext";
import AudioModal from "../AudioModal";
import { CircularProgress } from "@material-ui/core";
import { useParams, useHistory } from "react-router-dom";
import { downloadResource } from "../../utils";
import Template from "./templates";
import { usePdfViewer } from "../../hooks/usePdfViewer";
import { toast } from "react-toastify";
import TelegramIcon from "../TelegramIcon";

const useStyles = makeStyles((theme) => ({
  messagesListWrapper: {
    overflow: "hidden",
    position: "relative",
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    width: "100%",
    minWidth: 300,
    minHeight: 200,
  },

  currentTick: {
    alignItems: "center",
    textAlign: "center",
    alignSelf: "center",
    width: "95%",
    backgroundColor: theme.palette.primary.main,
    margin: "10px",
    borderRadius: "10px",
    boxShadow: "1px 5px 10px #b3b3b3",
  },

  currentTicktText: {
    color: theme.palette.primary,
    fontWeight: "bold",
    padding: 8,
    alignSelf: "center",
    marginLeft: "0px",
  },

  messagesList: {
    backgroundImage: theme.mode === "light" ? `url(${whatsBackground})` : `url(${whatsBackgroundDark})`,
    backgroundColor: theme.mode === "light" ? "#e5ddd5" : "#0b0b0d",
    backgroundSize: "cover",
    backgroundRepeat: "repeat",
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    padding: "20px 20px 30px 20px",
    overflowY: "scroll",
    ...theme.scrollbarStyles,
  },
  dragElement: {
    background: "rgba(255, 255, 255, 0.8)",
    position: "absolute",
    width: "100%",
    height: "100%",
    zIndex: 999999,
    textAlign: "center",
    fontSize: "3em",
    border: "5px dashed #333",
    color: "#333",
    display: "flex",
    justifyContent: "center",
    alignItems: "center"
  },
  circleLoading: {
    color: blue[500],
    position: "absolute",
    opacity: "70%",
    top: 0,
    left: "50%",
    marginTop: 12,
  },

  messageLeft: {
    marginRight: 20,
    marginTop: 2,
    minWidth: 100,
    maxWidth: 600,
    height: "auto",
    display: "block",
    position: "relative",
    "&:hover #messageActionsButton": {
      display: "flex",
      position: "absolute",
      top: 0,
      right: 0,
    },

    whiteSpace: "pre-wrap",
    backgroundColor: theme.mode === "light" ? "#ffffff" : "#202c33",
    color: theme.mode === "light" ? "#303030" : "#ffffff",
    alignSelf: "flex-start",
    borderTopLeftRadius: 0,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    paddingLeft: 5,
    paddingRight: 5,
    paddingTop: 5,
    paddingBottom: 0,
    boxShadow: theme.mode === "light" ? "0 1px 1px #b3b3b3" : "0 1px 1px #000000"
  },

  quotedContainerLeft: {
    margin: "-3px -80px 6px -6px",
    overflow: "hidden",
    backgroundColor: theme.mode === "light" ? "#f0f0f0" : "#1d282f",
    borderRadius: "7.5px",
    display: "flex",
    position: "relative",
  },

  quotedMsg: {
    padding: 10,
    maxWidth: 300,
    height: "auto",
    display: "block",
    whiteSpace: "pre-wrap",
    overflow: "hidden",
  },

  quotedSideColorLeft: {
    flex: "none",
    width: "4px",
    backgroundColor: "#388aff",
  },

  messageRight: {
    marginLeft: 20,
    marginTop: 2,
    minWidth: 100,
    maxWidth: 600,
    height: "auto",
    display: "block",
    position: "relative",
    "&:hover #messageActionsButton": {
      display: "flex",
      position: "absolute",
      top: 0,
      right: 0,
    },
    whiteSpace: "pre-wrap",
    backgroundColor: theme.mode === "light" ? "#dcf8c6" : "#005c4b",
    color: theme.mode === "light" ? "#303030" : "#ffffff",
    alignSelf: "flex-end",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 0,
    paddingLeft: 5,
    paddingRight: 5,
    paddingTop: 5,
    paddingBottom: 0,
    boxShadow: theme.mode === "light" ? "0 1px 1px #b3b3b3" : "0 1px 1px #000000"
  },

  messageRightPrivate: {
    marginLeft: 20,
    marginTop: 2,
    minWidth: 100,
    maxWidth: 600,
    height: "auto",
    display: "block",
    position: "relative",
    "&:hover #messageActionsButton": {
      display: "flex",
      position: "absolute",
      top: 0,
      right: 0,
    },
    whiteSpace: "pre-wrap",
    backgroundColor: "#F0E68C",
    color: "#303030",
    alignSelf: "flex-end",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 0,
    paddingLeft: 5,
    paddingRight: 5,
    paddingTop: 5,
    paddingBottom: 0,
    boxShadow: theme.mode === "light" ? "0 1px 1px #b3b3b3" : "0 1px 1px #000000"
  },

  quotedContainerRight: {
    margin: "-3px -80px 6px -6px",
    overflowY: "hidden",
    backgroundColor: theme.mode === "light" ? "#cfe9ba" : "#025144",
    borderRadius: "7.5px",
    display: "flex",
    position: "relative",
  },

  quotedMsgRight: {
    padding: 10,
    maxWidth: 300,
    height: "auto",
    whiteSpace: "pre-wrap",
  },

  quotedSideColorRight: {
    flex: "none",
    width: "4px",
    backgroundColor: "#35cd96",
  },

  messageActionsButton: {
    display: "none",
    position: "relative",
    color: "#999",
    zIndex: 1,
    backgroundColor: "inherit",
    opacity: "90%",
    "&:hover, &.Mui-focusVisible": { backgroundColor: "inherit" },
  },

  messageContactName: {
    display: "flex",
    color: "#6bcbef",
    fontWeight: 500,
  },

  textContentItem: {
    overflowWrap: "break-word",
    padding: "3px 80px 6px 6px",
  },

  textContentItemDeleted: {
    fontStyle: "italic",
    color: "rgba(0, 0, 0, 0.36)",
    overflowWrap: "break-word",
    padding: "3px 80px 6px 6px",
  },

  messageMedia: {
    width: 400,
    height: "auto",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    "&[controls]": {
      objectFit: "contain",
    }
  },

  timestamp: {
    fontSize: 11,
    position: "absolute",
    bottom: 0,
    right: 5,
    color: "#999",
  },

  forwardMessage: {
    fontSize: 12,
    fontStyle: "italic",
    position: "absolute",
    top: 0,
    left: 5,
    color: "#999",
    display: "flex",
    alignItems: "center"
  },

  dailyTimestamp: {
    alignItems: "center",
    textAlign: "center",
    alignSelf: "center",
    width: "110px",
    backgroundColor: theme.mode === "dark" ? "rgba(255,255,255,0.1)" : "#e1f3fb",
    margin: "10px",
    borderRadius: "10px",
    boxShadow: theme.mode === "dark" ? "0 1px 1px rgba(0,0,0,0.5)" : "0 1px 1px #b3b3b3",
  },

  dailyTimestampText: {
    color: theme.mode === "dark" ? "#ccc" : "#808888",
    padding: 8,
    alignSelf: "center",
    marginLeft: "0px",
  },

  ackIcons: {
    fontSize: 18,
    verticalAlign: "middle",
    marginLeft: 4,
  },

  deletedIcon: {
    fontSize: 18,
    verticalAlign: "middle",
    marginRight: 4,
  },

  ackDoneAllIcon: {
    color: blue[500],
    fontSize: 18,
    verticalAlign: "middle",
    marginLeft: 4,
  },

  ackPlayedIcon: {
    color: green[500],
    fontSize: 18,
    verticalAlign: "middle",
    marginLeft: 4,
  },
  downloadMedia: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "inherit",
    padding: 10,
    color: theme.mode === "light" ? theme.palette.light : theme.palette.dark,
  },

  messageCenter: {
    marginTop: 5,
    alignItems: "center",
    verticalAlign: "center",
    alignContent: "center",
    backgroundColor: "#E1F5FEEB",
    fontSize: "12px",
    minWidth: 100,
    maxWidth: 270,
    color: "#272727",
    borderTopLeftRadius: 0,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    paddingLeft: 5,
    paddingRight: 5,
    paddingTop: 5,
    paddingBottom: 0,
    boxShadow: "0 1px 1px #b3b3b3",
  },

  deletedMessage: {
    color: "#f55d65"
  }
}));

const reducer = (state, action) => {
  if (action.type === "LOAD_MESSAGES") {
    const messages = action.payload;
    const newMessages = [];

    messages.forEach((message) => {
      const messageIndex = state.findIndex((m) => m.id === message.id);
      if (messageIndex !== -1) {
        state[messageIndex] = message;
      } else {
        newMessages.push(message);
      }
    });

    return [...newMessages, ...state];
  }

  if (action.type === "ADD_MESSAGE") {
    const newMessage = action.payload;
    const messageIndex = state.findIndex((m) => m.id === newMessage.id);

    if (messageIndex !== -1) {
      state[messageIndex] = newMessage;
    } else {
      state.push(newMessage);
    }

    return [...state];
  }

  if (action.type === "UPDATE_MESSAGE") {
    const messageToUpdate = action.payload;
    const messageIndex = state.findIndex((m) => m.id === messageToUpdate.id);

    if (messageIndex !== -1) {
      state[messageIndex] = {
        ...state[messageIndex],
        ...messageToUpdate,
        ticket: {
          ...(state[messageIndex].ticket || {}),
          ...(messageToUpdate.ticket || {}),
        },
      };
    }

    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

const parseTemplateDataJson = (dataJson) => {
  if (!dataJson) return null;

  try {
    let parsed = typeof dataJson === "string" ? JSON.parse(dataJson) : dataJson;

    if (typeof parsed === "string") {
      parsed = JSON.parse(parsed);
    }

    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (error) {
    return null;
  }
};

const isTemplateMessage = (message) => {
  if (!message) return false;

  if (String(message.mediaType || "").toLowerCase() === "template") {
    return true;
  }

  try {
    const parsed =
      typeof message.dataJson === "string"
        ? JSON.parse(message.dataJson)
        : message.dataJson;

    return parsed?.type === "template";
  } catch (error) {
    return false;
  }
};;

const isValidLatitude = (value) =>
  Number.isFinite(value) && value >= -90 && value <= 90;

const isValidLongitude = (value) =>
  Number.isFinite(value) && value >= -180 && value <= 180;

const buildGoogleMapsUrl = (latitude, longitude) =>
  `https://maps.google.com/maps?q=${encodeURIComponent(
    `${latitude},${longitude}`
  )}&z=17&hl=pt-BR`;

const buildLocationPreviewUrl = (latitude, longitude) => {
  const lat = encodeURIComponent(String(latitude));
  const lng = encodeURIComponent(String(longitude));

  return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=17&size=600x300&markers=${lat},${lng},red-pushpin`;
};

const parseLocationFromDataJson = (dataJson) => {
  if (!dataJson || typeof dataJson !== "string") {
    return null;
  }

  try {
    const parsed = JSON.parse(dataJson);
    const latitude = Number(parsed?.latitude ?? parsed?.degreesLatitude);
    const longitude = Number(parsed?.longitude ?? parsed?.degreesLongitude);

    if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) {
      return null;
    }

    return {
      latitude,
      longitude,
      name: parsed?.name || parsed?.locationName || null,
      address: parsed?.address || parsed?.locationAddress || null,
      url: parsed?.url || buildGoogleMapsUrl(latitude, longitude)
    };
  } catch (error) {
    return null;
  }
};

const parseLocationFromBody = (body) => {
  if (!body || typeof body !== "string") {
    return null;
  }

  const text = body.trim();
  if (!text) return null;

  try {
    const parsed = JSON.parse(text);
    const latitude = Number(parsed?.latitude ?? parsed?.degreesLatitude);
    const longitude = Number(parsed?.longitude ?? parsed?.degreesLongitude);

    if (isValidLatitude(latitude) && isValidLongitude(longitude)) {
      return {
        latitude,
        longitude,
        name: parsed?.name || parsed?.locationName || null,
        address: parsed?.address || parsed?.locationAddress || null,
        url: parsed?.url || buildGoogleMapsUrl(latitude, longitude)
      };
    }
  } catch (error) { }

  const locationParts = text.split("|").map(item => item.trim()).filter(Boolean);

  if (locationParts.length >= 2) {
    const image = locationParts[0];
    const link = locationParts[1];
    const description = locationParts.length > 2 ? locationParts[2] : null;

    const coordsMatch = String(description || "").match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
    if (coordsMatch) {
      const latitude = Number(coordsMatch[1]);
      const longitude = Number(coordsMatch[2]);

      if (isValidLatitude(latitude) && isValidLongitude(longitude)) {
        return {
          latitude,
          longitude,
          name: null,
          address: description,
          url: link || buildGoogleMapsUrl(latitude, longitude),
          image
        };
      }
    }

    return {
      latitude: null,
      longitude: null,
      name: null,
      address: description,
      url: link,
      image
    };
  }

  const coordsMatch = text.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (coordsMatch) {
    const latitude = Number(coordsMatch[1]);
    const longitude = Number(coordsMatch[2]);

    if (isValidLatitude(latitude) && isValidLongitude(longitude)) {
      return {
        latitude,
        longitude,
        name: null,
        address: `${latitude}, ${longitude}`,
        url: buildGoogleMapsUrl(latitude, longitude)
      };
    }
  }

  try {
    const urlMatch = text.match(/https?:\/\/[^\s]+/i);
    if (urlMatch) {
      const parsedUrl = new URL(urlMatch[0]);
      const q = parsedUrl.searchParams.get("q");

      if (q) {
        const qMatch = q.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
        if (qMatch) {
          const latitude = Number(qMatch[1]);
          const longitude = Number(qMatch[2]);

          if (isValidLatitude(latitude) && isValidLongitude(longitude)) {
            return {
              latitude,
              longitude,
              name: null,
              address: `${latitude}, ${longitude}`,
              url: buildGoogleMapsUrl(latitude, longitude)
            };
          }
        }
      }
    }
  } catch (error) { }

  return null;
};

const getLocationPreviewData = (message) => {
  const locationFromDataJson = parseLocationFromDataJson(message?.dataJson);
  if (locationFromDataJson) {
    return {
      image: buildLocationPreviewUrl(
        locationFromDataJson.latitude,
        locationFromDataJson.longitude
      ),
      link: locationFromDataJson.url || buildGoogleMapsUrl(
        locationFromDataJson.latitude,
        locationFromDataJson.longitude
      ),
      description:
        locationFromDataJson.name ||
        locationFromDataJson.address ||
        `${locationFromDataJson.latitude}, ${locationFromDataJson.longitude}`
    };
  }

  const locationFromBody = parseLocationFromBody(message?.body);
  if (locationFromBody) {
    if (locationFromBody.image) {
      return {
        image: locationFromBody.image,
        link: locationFromBody.url,
        description: locationFromBody.address || locationFromBody.name || ""
      };
    }

    if (isValidLatitude(Number(locationFromBody.latitude)) && isValidLongitude(Number(locationFromBody.longitude))) {
      return {
        image: buildLocationPreviewUrl(
          locationFromBody.latitude,
          locationFromBody.longitude
        ),
        link: locationFromBody.url || buildGoogleMapsUrl(
          locationFromBody.latitude,
          locationFromBody.longitude
        ),
        description:
          locationFromBody.name ||
          locationFromBody.address ||
          `${locationFromBody.latitude}, ${locationFromBody.longitude}`
      };
    }

    if (locationFromBody.url) {
      return {
        image: "",
        link: locationFromBody.url,
        description: locationFromBody.address || locationFromBody.name || "Localização"
      };
    }
  }

  return null;
};

const normalizeContactPhone = (value) => {
  if (!value) return "";
  return String(value).replace(/\D/g, "");
};

const buildContactPreviewName = (name, number) => {
  const safeName = typeof name === "string" ? name.trim() : "";
  if (safeName) return safeName;

  const safeNumber = normalizeContactPhone(number);
  if (safeNumber) return `Contato ${safeNumber}`;

  return "Contato compartilhado";
};

const parseContactPreviewFromMessage = (message) => {
  const fallbackBody = typeof message?.body === "string" ? message.body : "";
  const fallbackNumber = normalizeContactPhone(message?.contact?.number || "");
  const fallbackName = buildContactPreviewName(
    message?.contact?.name || "",
    fallbackNumber
  );

  // 1) Tenta formato JSON da API Oficial
  if (fallbackBody) {
    try {
      const parsed = JSON.parse(fallbackBody);
      const sharedContact = parsed?.contacts?.[0];

      if (sharedContact) {
        const parsedName =
          sharedContact?.name?.formatted_name ||
          [
            sharedContact?.name?.first_name,
            sharedContact?.name?.middle_name,
            sharedContact?.name?.last_name
          ]
            .filter(Boolean)
            .join(" ")
            .trim();

        const parsedNumber =
          normalizeContactPhone(sharedContact?.phones?.[0]?.wa_id) ||
          normalizeContactPhone(sharedContact?.phones?.[0]?.phone) ||
          fallbackNumber;

        return {
          contact: buildContactPreviewName(parsedName, parsedNumber),
          number: parsedNumber
        };
      }
    } catch (error) {
      // segue para formato vCard
    }
  }

  // 2) Tenta formato vCard/Baileys
  if (fallbackBody) {
    const lines = fallbackBody.split("\n");
    let contactName = "";
    let contactNumber = "";

    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];

      if (!contactName && line.includes("FN:")) {
        const parts = line.split("FN:");
        contactName = parts[1] ? parts[1].trim() : "";
      }

      if (!contactNumber) {
        const phoneMatch = line.match(/\+?\d[\d\s\-()]{7,}\d/);
        if (phoneMatch) {
          contactNumber = normalizeContactPhone(phoneMatch[0]);
        }
      }
    }

    return {
      contact: buildContactPreviewName(contactName || fallbackName, contactNumber || fallbackNumber),
      number: contactNumber || fallbackNumber
    };
  }

  return {
    contact: fallbackName,
    number: fallbackNumber
  };
};

const getQuotedMessagePreviewText = (quotedMsg) => {
  if (!quotedMsg) return "";

  if (quotedMsg.isDeleted) {
    return "🚫 Mensagem apagada";
  }

  const mediaType = String(quotedMsg.mediaType || "").toLowerCase();
  const body = typeof quotedMsg.body === "string" ? quotedMsg.body.trim() : "";

  if (
    body &&
    ![
      "audio",
      "video",
      "image",
      "sticker",
      "document",
      "application",
      "location",
      "locationmessage",
      "contactmessage",
      "contacts",
      "admetapreview",
      "facebookpostpreview"
    ].includes(mediaType)
  ) {
    return body;
  }

  if (mediaType === "audio") return "🎵 Áudio";
  if (mediaType === "video") return "🎥 Vídeo";
  if (mediaType === "image") return "🖼️ Imagem";
  if (mediaType === "sticker") return "🏷️ Figurinha";
  if (mediaType === "document" || mediaType === "application") return "📎 Documento";
  if (mediaType === "location" || mediaType === "locationmessage") return "📍 Localização";
  if (mediaType === "contactmessage" || mediaType === "contacts") return "👤 Contato";
  if (mediaType === "admetapreview") return "📢 Anúncio";
  if (mediaType === "facebookpostpreview") return "📘 Publicação";

  return body || "Mensagem";
};

const renderReactionReference = (message, classes) => {
  const quotedMsg = message?.quotedMsg;
  if (!quotedMsg) return null;

  const previewText = getQuotedMessagePreviewText(quotedMsg);
  const quotedAuthor = quotedMsg.fromMe
    ? "Você"
    : quotedMsg?.contact?.name || "Contato";

  return (
    <div
      className={clsx(classes.quotedContainerLeft, {
        [classes.quotedContainerRight]: message.fromMe,
      })}
      style={{ marginBottom: 6 }}
    >
      <span
        className={clsx(classes.quotedSideColorLeft, {
          [classes.quotedSideColorRight]: quotedMsg?.fromMe,
        })}
      />
      <div className={classes.quotedMsg} style={{ padding: 8, maxWidth: 280 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            marginBottom: 2,
            color: "#388aff",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap"
          }}
        >
          {quotedAuthor}
        </div>

        <div
          style={{
            fontSize: 13,
            color: "inherit",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap"
          }}
          title={previewText}
        >
          {previewText}
        </div>
      </div>
    </div>
  );
};

// ==================== FUNÇÃO ADICIONADA ====================
const normalizeAdThumbnail = (value) => {
  if (!value) return "";

  const thumbnail = String(value).trim();

  if (
    thumbnail.startsWith("data:image/") ||
    thumbnail.startsWith("http://") ||
    thumbnail.startsWith("https://") ||
    thumbnail.startsWith("blob:")
  ) {
    return thumbnail;
  }

  return `data:image/jpeg;base64,${thumbnail}`;
};

// ==================== NOVOS HELPERS ADICIONADOS ====================
const parseAdReferralFromMessage = (message) => {
  if (!message) return null;

  let referral = message.referral || null;

  if (!referral && message.dataJson) {
    try {
      const parsed =
        typeof message.dataJson === "string"
          ? JSON.parse(message.dataJson)
          : message.dataJson;

      const extendedText =
        parsed?.message?.extendedTextMessage ||
        parsed?.extendedTextMessage ||
        null;

      referral =
        parsed?.referral ||
        parsed?.message?.referral ||
        parsed?.data?.referral ||
        extendedText?.contextInfo?.externalAdReply ||
        (
          extendedText &&
          (
            extendedText.jpegThumbnail ||
            extendedText.thumbnailUrl ||
            extendedText.title ||
            extendedText.description
          )
            ? extendedText
            : null
        );
    } catch (error) { }
  }

  if (!referral) return null;

  const image = normalizeAdThumbnail(
    referral.jpegThumbnail ||
    referral.thumbnail ||
    referral.thumbnailUrl ||
    referral.thumbnail_url ||
    referral.imageUrl ||
    referral.image_url ||
    ""
  );

  const descriptionText =
    referral.description ||
    referral.body ||
    referral.text ||
    "";

  const extractedUrl =
    String(descriptionText).match(/https?:\/\/[^\s|]+/i)?.[0] || "";

  const sourceUrl =
    referral.sourceUrl ||
    referral.source_url ||
    referral.matchedText ||
    referral.matched_text ||
    extractedUrl ||
    "";

  const title =
    referral.headline ||
    referral.title ||
    "";

  const body =
    referral.description ||
    referral.body ||
    referral.text ||
    "";

  const messageUser =
    typeof message.body === "string" && message.body.trim()
      ? message.body
      : "Olá! Tenho interesse e queria mais informações, por favor.";

  return {
    image,
    sourceUrl,
    title,
    body,
    messageUser,
    sourceId: referral.sourceId || referral.source_id || "",
    ctwaClid: referral.ctwaClid || referral.ctwa_clid || "",
    mediaType: referral.mediaType || referral.media_type || ""
  };
};

const hasAdReferralPreview = (message) => {
  return !!parseAdReferralFromMessage(message);
};
// ================================================================

const getTemplateDataFromMessage = (message) => {
  if (!message?.dataJson) return null;

  try {
    const parsed =
      typeof message.dataJson === "string"
        ? JSON.parse(message.dataJson)
        : message.dataJson;

    if (parsed?.type === "template") {
      return parsed;
    }

    return null;
  } catch (error) {
    return null;
  }
};

const MessagesList = ({
  isGroup,
  onDrop,
  whatsappId,
  queueId,
  channel,
  ticketStatus
}) => {
  const classes = useStyles();
  const [messagesList, dispatch] = useReducer(reducer, []);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const history = useHistory();
  const lastMessageRef = useRef();

  const [selectedMessage, setSelectedMessage] = useState({});
  const { setReplyingMessage } = useContext(ReplyMessageContext);
  const [anchorEl, setAnchorEl] = useState(null);
  const messageOptionsMenuOpen = Boolean(anchorEl);
  const { ticketId } = useParams();

  const currentTicketId = useRef(ticketId);
  const { getAll } = useCompanySettings();
  const [dragActive, setDragActive] = useState(false);
  const [dragTimeout, setDragTimeout] = useState(null);

  const [videoLoading, setVideoLoading] = useState(true);
  const [videoError, setVideoError] = useState(false);

  const [lgpdDeleteMessage, setLGPDDeleteMessage] = useState(false);
  const { selectedQueuesMessage } = useContext(QueueSelectedContext);

  const {
    downloadPdf,
    extractPdfInfoFromMessage,
    isPdfUrl
  } = usePdfViewer();

  const { showSelectMessageCheckbox } = useContext(ForwardMessageContext);
  const { user, socket } = useContext(AuthContext);
  const companyId = user.companyId;

  // ==================== FUNÇÃO ADICIONADA ====================
  const handleDownloadMessageFile = async (message, fallbackName = "arquivo") => {
    try {
      const mediaUrl = String(message?.mediaUrl || "");

      const encodedFileName = mediaUrl
        .split("?")[0]
        .split("#")[0]
        .split("/")
        .pop();

      let fileName = encodedFileName || fallbackName;

      try {
        fileName = decodeURIComponent(fileName);
      } catch (err) {
        // Mantém o nome original caso não esteja codificado corretamente.
      }

      const response = await api.get(`/messages/${message.id}/download`, {
        responseType: "blob",
      });

      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      window.URL.revokeObjectURL(url);
    } catch (err) {
      toastError(err);
    }
  };
  // ===========================================================

  useEffect(() => {
    async function fetchData() {
      const settings = await getAll(companyId);

      let settinglgpdDeleteMessage;
      let settingEnableLGPD;

      for (const [key, value] of Object.entries(settings)) {
        if (key === "lgpdDeleteMessage") settinglgpdDeleteMessage = value;
        if (key === "enableLGPD") settingEnableLGPD = value;
      }
      if (settingEnableLGPD === "enabled" && settinglgpdDeleteMessage === "enabled") {
        setLGPDDeleteMessage(true);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
    currentTicketId.current = ticketId;
  }, [ticketId, selectedQueuesMessage]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchMessages = async () => {
        if (ticketId === "undefined") {
          history.push("/tickets");
          return;
        }
        if (isNil(ticketId)) return;
        try {
          const { data } = await api.get("/messages/" + ticketId, {
            params: { pageNumber, selectedQueues: JSON.stringify(selectedQueuesMessage) },
          });

          if (currentTicketId.current === ticketId) {
            // Processar mensagens para garantir que referrals sejam reconhecidos
            const processedMessages = data.messages.map(msg => {
              // Se a mensagem tem referral, garantir que mediaType seja definido
              if (hasAdReferralPreview(msg) && !msg.mediaType) {
                return { ...msg, mediaType: "adMetaPreview" };
              }
              return msg;
            });

            dispatch({ type: "LOAD_MESSAGES", payload: processedMessages });
            setHasMore(data.hasMore);
            setLoading(false);
            setLoadingMore(false);
          }

          if (pageNumber === 1 && data.messages.length > 1) {
            scrollToBottom();
          }
        } catch (err) {
          setLoading(false);
          toastError(err);
          setLoadingMore(false);
        }
      };

      fetchMessages();
    }, 500);
    return () => {
      clearTimeout(delayDebounceFn);
    };
  }, [pageNumber, ticketId, selectedQueuesMessage]);

  useEffect(() => {
    if (ticketId === "undefined") {
      return;
    }

    const companyId = user.companyId;

    const connectEventMessagesList = () => {
      socket.emit("joinChatBox", `${ticketId}`);
    };

    const onAppMessageMessagesList = (data) => {
      if (data.action === "create" && data.ticket.uuid === ticketId) {
        // Processar mensagem recebida em tempo real
        let processedMessage = data.message;
        if (hasAdReferralPreview(processedMessage) && !processedMessage.mediaType) {
          processedMessage = { ...processedMessage, mediaType: "adMetaPreview" };
        }
        dispatch({ type: "ADD_MESSAGE", payload: processedMessage });
        scrollToBottom();
      }

      if (data.action === "update" && data?.message?.ticket?.uuid === ticketId) {
        let processedMessage = data.message;
        if (hasAdReferralPreview(processedMessage) && !processedMessage.mediaType) {
          processedMessage = { ...processedMessage, mediaType: "adMetaPreview" };
        }
        dispatch({ type: "UPDATE_MESSAGE", payload: processedMessage });
      }

      if (data.action == "delete" && data.message.ticket?.uuid === ticketId) {
        dispatch({ type: "DELETE_MESSAGE", payload: data.messageId });
      }
    };
    socket.on("connect", connectEventMessagesList);
    socket.on(`company-${companyId}-appMessage`, onAppMessageMessagesList);

    return () => {
      socket.emit("joinChatBoxLeave", `${ticketId}`);
      socket.off("connect", connectEventMessagesList);
      socket.off(`company-${companyId}-appMessage`, onAppMessageMessagesList);
    };

  }, [ticketId, socket, companyId]);

  useEffect(() => {
    return () => {
      if (dragTimeout) {
        clearTimeout(dragTimeout);
      }
    };
  }, [dragTimeout]);

  const loadMore = () => {
    if (loadingMore) return;
    setLoadingMore(true);
    setPageNumber((prevPageNumber) => prevPageNumber + 1);
  };

  const scrollToBottom = () => {
    const doScroll = () => {
      if (lastMessageRef.current) {
        lastMessageRef.current.scrollIntoView({ behavior: "instant", block: "end" });
      } else {
        const messagesList = document.getElementById("messagesList");
        if (messagesList) {
          messagesList.scrollTop = messagesList.scrollHeight;
        }
      }
    };
    setTimeout(doScroll, 100);
    setTimeout(doScroll, 300);
    setTimeout(doScroll, 600);
  };

  const handleScroll = (e) => {
    if (!hasMore) return;
    const { scrollTop } = e.currentTarget;

    if (scrollTop === 0) {
      document.getElementById("messagesList").scrollTop = 1;
    }

    if (loading) {
      return;
    }

    if (scrollTop < 50) {
      loadMore();
    }
  };

  const handleOpenMessageOptionsMenu = (e, message) => {
    setAnchorEl(e.currentTarget);
    setSelectedMessage(message);
  };

  const handleCloseMessageOptionsMenu = (e) => {
    setAnchorEl(null);
  };

  const hanldeReplyMessage = (e, message) => {
    setAnchorEl(null);
    setReplyingMessage(message);
  };

  const getBasename = (filepath) => {
    if (!filepath) return "";
    const cleanPath = filepath.split("?")[0].split("#")[0];
    const segments = cleanPath.split("/");
    return segments[segments.length - 1];
  };

  const isStickerMessage = (message = {}) => {
    const mediaType = String(message.mediaType || "").toLowerCase();
    const mimeType = String(message.mimetype || message.mimeType || "").toLowerCase();
    const type = String(message.type || "").toLowerCase();
    const mediaUrl = String(message.mediaUrl || "").toLowerCase();
    const fileName = String(message.fileName || "").toLowerCase();
    const body = String(message.body || "").trim().toLowerCase();
    const hasMedia =
      !!message.mediaUrl ||
      !!message.fileUrl ||
      !!message.file ||
      !!message.idFile;

    return (
      mediaType === "sticker" ||
      type === "sticker" ||
      mimeType === "image/webp" ||
      fileName.endsWith(".webp") ||
      mediaUrl.endsWith(".webp") ||
      mediaUrl.includes(".webp?") ||
      (body === "[figurinha]" && hasMedia)
    );
  };

  const checkMessageMedia = (message) => {
    const isAudioMessage = (message) => {
      if (message.mediaType === "audio") {
        console.log("🎵 Detectado como áudio pelo mediaType:", message.mediaType);
        return true;
      }

      if (message.mediaUrl) {
        const audioExtensions = [".mp3", ".wav", ".ogg", ".m4a", ".aac", ".webm"];
        const url = message.mediaUrl.toLowerCase();
        const hasAudioExtension = audioExtensions.some(ext => url.includes(ext));

        if (hasAudioExtension) {
          console.log("🎵 Detectado como áudio pela URL:", url);
          return true;
        }
      }

      if (message.body && typeof message.body === "string") {
        const body = message.body.toLowerCase();
        const isAudioBody =
          body.includes("áudio gravado") ||
          body.includes("audio_") ||
          body.includes("🎵") ||
          body.includes("arquivo de áudio") ||
          body.includes("mensagem de voz");

        if (isAudioBody) {
          console.log("🎵 Detectado como áudio pelo body:", body);
          return true;
        }
      }

      return false;
    };

    const templateData = getTemplateDataFromMessage(message);

    if (templateData) {
      return (
        <Template
          message={{
            ...message,
            dataJson: JSON.stringify(templateData)
          }}
        />
      );
    }

    const referralPreview = parseAdReferralFromMessage(message);

    if (referralPreview) {
      console.log("📢 Renderizando preview de anúncio:", referralPreview.title);
      return (
        <AdMetaPreview
          image={referralPreview.image}
          sourceUrl={referralPreview.sourceUrl}
          title={referralPreview.title}
          body={referralPreview.body}
          messageUser={referralPreview.messageUser}
        />
      );
    }

    if (isTemplateMessage(message)) {
      return <Template message={message} />;
    }

    else if (message.mediaType === "locationMessage" || message.mediaType === "location") {
      const locationData = getLocationPreviewData(message);

      if (locationData) {
        return (
          <LocationPreview
            image={locationData.image}
            link={locationData.link}
            description={locationData.description}
          />
        );
      }
    }

    else if (message.mediaType === "contactMessage" || message.mediaType === "contacts") {
      const parsedContact = parseContactPreviewFromMessage(message);

      return (
        <VcardPreview
          contact={parsedContact.contact}
          numbers={parsedContact.number}
          queueId={message?.ticket?.queueId}
          whatsappId={message?.ticket?.whatsappId}
          channel={channel}
        />
      );
    }

    else if (message.mediaType === "adMetaPreview") {
      console.log("Entrou no MetaPreview");
      let [image, sourceUrl, title, body, messageUser] = message.body.split("|");

      if (!messageUser || messageUser.trim() === "") {
        messageUser = "Olá! Tenho interesse e queria mais informações, por favor.";
      }

      return <AdMetaPreview
        image={image}
        sourceUrl={sourceUrl}
        title={title}
        body={body}
        messageUser={messageUser}
      />;
    }

    else if (message.mediaType === "facebookPostPreview") {
      let [image, sourceUrl, title, body, comment] = message.body.split("|");

      return <FacebookPostPreview
        image={image}
        sourceUrl={sourceUrl}
        title={title}
        body={body}
        comment={comment}
      />;
    }

    else if (isStickerMessage(message)) {
      const stickerUrl = message.mediaUrl || message.fileUrl || "";

      if (!stickerUrl) return null;

      return (
        <div style={{ padding: "4px 0", maxWidth: "180px" }}>
          <img
            src={stickerUrl}
            alt="figurinha"
            style={{
              display: "block",
              maxWidth: "180px",
              maxHeight: "180px",
              width: "auto",
              height: "auto",
              objectFit: "contain",
              cursor: "pointer"
            }}
            onClick={() => window.open(stickerUrl, "_blank")}
          />
        </div>
      );
    }

    else if (isPdfUrl(message.mediaUrl, message.body, message.mediaType)) {
      console.log("📄 Renderizando como documento/PDF:", message.id);
      const pdfInfo = extractPdfInfoFromMessage(message, companyId);

      return (
        <PdfPreview
          url={pdfInfo.url}
          filename={pdfInfo.filename}
          size={pdfInfo.size}
          mediaType={pdfInfo.mediaType}
          onDownload={() => {
            handleDownloadMessageFile(message, "arquivo.pdf");
          }}
        />
      );
    }

    else if (isAudioMessage(message)) {
      console.log("🎵 Renderizando como áudio:", message.id);
      return (
        <div style={{
          width: "100%",
          maxWidth: "300px",
          padding: "8px",
          backgroundColor: "transparent"
        }}>
          <AudioModal
            url={message.mediaUrl}
            message={message}
          />
        </div>
      );
    }

    else if (message.mediaType === "image") {
      console.log("🖼️ Renderizando como imagem");
      const imageUrl = message.mediaUrl || "";
      return <ModalImageCors imageUrl={imageUrl} />;
    }

    else if (message.mediaType === "video") {
      console.log("🎥 Renderizando como vídeo");

      return (
        <div style={{ maxWidth: "400px", width: "100%", position: "relative" }}>
          {videoLoading && !videoError && (
            <div style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 2,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "8px"
            }}>
              <CircularProgress size={30} />
              <Typography variant="caption" color="textSecondary">
                Carregando vídeo...
              </Typography>
            </div>
          )}

          <video
            className={classes.messageMedia}
            src={message.mediaUrl}
            controls
            preload="metadata"
            playsInline
            style={{
              width: "100%",
              height: "auto",
              maxHeight: "300px",
              borderRadius: "8px",
              backgroundColor: "#f0f0f0",
              opacity: videoLoading ? 0.3 : 1,
              transition: "opacity 0.3s ease"
            }}
            onLoadStart={() => {
              console.log("⏳ Iniciando carregamento do vídeo");
              setVideoLoading(true);
              setVideoError(false);
            }}
            onLoadedData={() => {
              console.log("✅ Vídeo carregado e pronto");
              setVideoLoading(false);
            }}
            onCanPlay={() => {
              console.log("✅ Vídeo pronto para reprodução");
              setVideoLoading(false);
            }}
            onError={(e) => {
              console.error("❌ Erro ao carregar vídeo:", e);
              console.log("🔗 URL do vídeo:", message.mediaUrl);
              setVideoLoading(false);
              setVideoError(true);
            }}
          >
            <source src={message.mediaUrl} type="video/mp4" />
            <source src={message.mediaUrl} type="video/webm" />
            <source src={message.mediaUrl} type="video/ogg" />
            Seu navegador não suporta reprodução de vídeo.
          </video>

          {videoError && (
            <div style={{
              padding: "20px",
              textAlign: "center",
              backgroundColor: "#f5f5f5",
              borderRadius: "8px",
              color: "#666",
              marginTop: "8px"
            }}>
              <Typography variant="body2" style={{ marginBottom: "12px" }}>
                ❌ Erro ao carregar vídeo
              </Typography>
              <Button
                startIcon={<GetApp />}
                onClick={() => handleDownloadMessageFile(message, message.body || "video.mp4")}
                variant="outlined"
                size="small"
              >
                Baixar Vídeo
              </Button>
            </div>
          )}
        </div>
      );
    }

    else if (message.mediaType === "document" || message.mediaType === "application" || message.mediaUrl) {
      const mediaUrl = String(message.mediaUrl || "");

      const encodedFileName = mediaUrl
        .split("?")[0]
        .split("#")[0]
        .split("/")
        .pop();

      let fileName = encodedFileName || "arquivo";

      try {
        fileName = decodeURIComponent(fileName);
      } catch (err) {
        // Mantém o nome original caso não esteja codificado corretamente.
      }
      const getFileIcon = (name) => {
        const ext = (name || "").split(".").pop()?.toLowerCase();
        const iconMap = {
          zip: "🗜️", rar: "🗜️", "7z": "🗜️", tar: "🗜️", gz: "🗜️", bz2: "🗜️",
          doc: "📝", docx: "📝", odt: "📝", rtf: "📝", txt: "📝",
          xls: "📊", xlsx: "📊", ods: "📊", csv: "📊",
          ppt: "📽️", pptx: "📽️", odp: "📽️",
          exe: "⚙️", msi: "⚙️",
        };
        return iconMap[ext] || "📄";
      };

      const fileIcon = getFileIcon(fileName);
      const fileExt = (fileName || "").split(".").pop()?.toUpperCase() || "ARQUIVO";

      console.log("📎 Renderizando como documento/arquivo:", { fileName, mediaType: message.mediaType, mediaUrl: message.mediaUrl });

      return (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "10px 14px",
          borderRadius: "8px",
          backgroundColor: "rgba(0,0,0,0.04)",
          maxWidth: "320px",
          cursor: "pointer",
          transition: "background-color 0.2s",
        }}
          onClick={() => handleDownloadMessageFile(message, fileName)}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.08)"}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.04)"}
        >
          <span style={{ fontSize: "28px", lineHeight: 1 }}>{fileIcon}</span>
          <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
            <div style={{
              fontSize: "13px",
              fontWeight: 500,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              color: "inherit"
            }}>
              {fileName}
            </div>
            <div style={{ fontSize: "11px", color: "#667781", marginTop: "2px" }}>
              {fileExt} • Clique para baixar
            </div>
          </div>
          <GetApp style={{ color: "#667781", fontSize: "20px", flexShrink: 0 }} />
        </div>
      );
    }

    return null;
  };

  const renderMessageAck = (message) => {
    if (message.ack === 0) {
      return <AccessTime fontSize="small" className={classes.ackIcons} />;
    } else if (message.ack === 1) {
      return <Done fontSize="small" className={classes.ackIcons} />;
    } else if (message.ack === 2 || message.ack === 3) {
      return <DoneAll fontSize="small" className={classes.ackIcons} />;
    } else if (message.ack === 4) {
      return <DoneAll fontSize="small" className={message.mediaType === "audio" ? classes.ackPlayedIcon : classes.ackDoneAllIcon} />;
    } else if (message.ack === 5) {
      return <DoneAll fontSize="small" className={classes.ackDoneAllIcon} />;
    }
  };

  const renderDailyTimestamps = (message, index) => {
    const today = format(new Date(), "dd/MM/yyyy");

    if (index === 0) {
      return (
        <span
          className={classes.dailyTimestamp}
          key={`timestamp-${message.id}`}
        >
          <div className={classes.dailyTimestampText}>
            {today === format(parseISO(messagesList[index].createdAt), "dd/MM/yyyy") ? "HOJE" : format(parseISO(messagesList[index].createdAt), "dd/MM/yyyy")}
          </div>
        </span>
      );
    } else if (index > 0) {
      let messageDay = parseISO(messagesList[index].createdAt);
      let previousMessageDay = parseISO(messagesList[index - 1].createdAt);

      if (!isSameDay(messageDay, previousMessageDay)) {
        return (
          <span
            className={classes.dailyTimestamp}
            key={`timestamp-${message.id}`}
          >
            <div className={classes.dailyTimestampText}>
              {today === format(parseISO(messagesList[index].createdAt), "dd/MM/yyyy") ? "HOJE" : format(parseISO(messagesList[index].createdAt), "dd/MM/yyyy")}
            </div>
          </span>
        );
      }
    }
    return null;
  };

  const renderTicketsSeparator = (message, index) => {
    let lastTicket = messagesList[index - 1]?.ticketId;
    let currentTicket = message.ticketId;

    if (lastTicket !== currentTicket && lastTicket !== undefined) {
      if (message?.ticket?.queue) {
        return (
          <span
            className={classes.currentTick}
            key={`timestamp-${message.id}a`}
          >
            <div
              className={classes.currentTicktText}
              style={{ backgroundColor: message?.ticket?.queue?.color || "grey" }}
            >
              #{i18n.t("ticketsList.called")} {message?.ticketId} - {message?.ticket?.queue?.name}
            </div>
          </span>
        );
      } else {
        return (
          <span
            className={classes.currentTick}
            key={`timestamp-${message.id}b`}
          >
            <div
              className={classes.currentTicktText}
              style={{ backgroundColor: "grey" }}
            >
              #{i18n.t("ticketsList.called")} {message.ticketId} - {i18n.t("ticketsList.noQueue")}
            </div>
          </span>
        );
      }
    }
    return null;
  };

  const renderMessageDivider = (message, index) => {
    if (index < messagesList.length && index > 0) {
      let messageUser = messagesList[index].fromMe;
      let previousMessageUser = messagesList[index - 1].fromMe;
      if (messageUser !== previousMessageUser) {
        return (
          <span style={{ marginTop: 16 }} key={`divider-${message.id}`}></span>
        );
      }
    }
    return null;
  };

  const renderQuotedMessage = (message) => {
    const quotedLocationData = (
      message?.quotedMsg?.mediaType === "location" ||
      message?.quotedMsg?.mediaType === "locationMessage"
    )
      ? getLocationPreviewData(message.quotedMsg)
      : null;

    return (
      <div
        className={clsx(classes.quotedContainerLeft, {
          [classes.quotedContainerRight]: message.fromMe,
        })}
      >
        <span
          className={clsx(classes.quotedSideColorLeft, {
            [classes.quotedSideColorRight]: message.quotedMsg?.fromMe,
          })}
        ></span>
        <div className={classes.quotedMsg}>
          {!message.quotedMsg?.fromMe && (
            <span className={classes.messageContactName}>
              {message.quotedMsg?.contact?.name}
            </span>
          )}

          {message.quotedMsg.mediaType === "audio" && (
            <div className={classes.downloadMedia}>
              <AudioModal url={message.quotedMsg.mediaUrl} />
            </div>
          )}
          {message.quotedMsg.mediaType === "video" && (
            <div style={{ maxWidth: "300px", width: "100%" }}>
              <video
                className={classes.messageMedia}
                src={message.quotedMsg.mediaUrl}
                controls
                preload="metadata"
                style={{
                  width: "100%",
                  height: "auto",
                  maxHeight: "200px",
                  borderRadius: "6px",
                  backgroundColor: "#f0f0f0"
                }}
                onError={(e) => {
                  console.error("❌ Erro ao carregar vídeo citado:", e);
                }}
              >
                <source src={message.quotedMsg.mediaUrl} type="video/mp4" />
                <source src={message.quotedMsg.mediaUrl} type="video/webm" />
                <source src={message.quotedMsg.mediaUrl} type="video/ogg" />
                <div style={{ padding: "10px", textAlign: "center", fontSize: "12px", color: "#999" }}>
                  ❌ Erro ao carregar vídeo
                </div>
              </video>
            </div>
          )}
          {(message.quotedMsg.mediaType === "location" || message.quotedMsg.mediaType === "locationMessage") && quotedLocationData && (
            <LocationPreview
              image={quotedLocationData.image}
              link={quotedLocationData.link}
              description={quotedLocationData.description}
            />
          )}
          {message.quotedMsg.mediaType === "contactMessage" && (
            "Contato"
          )}
          {isStickerMessage(message.quotedMsg) && (
            <div style={{ padding: "4px 0", maxWidth: "120px" }}>
              <img
                src={message.quotedMsg.mediaUrl}
                alt="figurinha"
                style={{
                  display: "block",
                  maxWidth: "120px",
                  maxHeight: "120px",
                  width: "auto",
                  height: "auto",
                  objectFit: "contain"
                }}
              />
            </div>
          )}
          {(message.quotedMsg.mediaType === "application" || message.quotedMsg.mediaType === "document") && (
            <div className={classes.downloadMedia}>
              <Button
                startIcon={<GetApp />}
                variant="outlined"
                onClick={() => handleDownloadMessageFile(message.quotedMsg, "arquivo")}
              >
                Download
              </Button>
            </div>
          )}
          {message.quotedMsg.mediaType === "image" && (
            <ModalImageCors imageUrl={message.quotedMsg.mediaUrl} />
          )}
          {getQuotedMessagePreviewText(message.quotedMsg)}
        </div>
      </div>
    );
  };

  const handleDrag = event => {
    event.preventDefault();
    event.stopPropagation();

    if (event.type === "dragenter" || event.type === "dragover") {
      const hasFiles = event.dataTransfer &&
        event.dataTransfer.types &&
        (event.dataTransfer.types.includes("Files") ||
          event.dataTransfer.types.includes("application/x-moz-file"));

      if (hasFiles) {
        if (dragTimeout) {
          clearTimeout(dragTimeout);
        }

        const timeout = setTimeout(() => {
          if (event.dataTransfer.items && event.dataTransfer.items.length > 0) {
            setDragActive(true);
          }
        }, 100);

        setDragTimeout(timeout);
      }
    } else if (event.type === "dragleave") {
      if (dragTimeout) {
        clearTimeout(dragTimeout);
        setDragTimeout(null);
      }

      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX;
      const y = event.clientY;

      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
        setDragActive(false);
      }
    }
  };

  const isYouTubeLink = (url) => {
    const youtubeRegex = /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    return youtubeRegex.test(url);
  };

  const handleDrop = event => {
    event.preventDefault();
    event.stopPropagation();

    if (dragTimeout) {
      clearTimeout(dragTimeout);
      setDragTimeout(null);
    }

    setDragActive(false);

    if (event.dataTransfer.files &&
      event.dataTransfer.files.length > 0 &&
      event.dataTransfer.files[0] instanceof File) {
      if (onDrop) {
        onDrop(event.dataTransfer.files);
      }
    }
  };

  const xmlRegex = /<([^>]+)>/g;
  const boldRegex = /\*(.*?)\*/g;

  const formatXml = (xmlString) => {
    if (boldRegex.test(xmlString)) {
      xmlString = xmlString.replace(boldRegex, "**$1**");
    }
    return xmlString;
  };

  const isPixReceivedMessage = (body = "") => {
    return typeof body === "string" &&
      /PIX RECEBIDO/i.test(body) &&
      /Chave:\s*/i.test(body);
  };

  const extractPixKeyFromBody = (body = "") => {
    if (typeof body !== "string") return "";

    const match = body.match(/Chave:\s*([^\n\r]+)/i);
    return match?.[1]?.trim() || "";
  };

  const copyTextToClipboard = async (text = "") => {
    if (!text) return false;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }

      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      return true;
    } catch (error) {
      return false;
    }
  };

  const handleCopyPixKey = async (body = "") => {
    const pixKey = extractPixKeyFromBody(body);

    if (!pixKey) {
      toast.error("Chave Pix não encontrada.");
      return;
    }

    const copied = await copyTextToClipboard(pixKey);

    if (copied) {
      toast.success("Chave Pix copiada.");
    } else {
      toast.error("Não foi possível copiar a chave Pix.");
    }
  };

  const renderPixCopyButton = (message) => {
    if (!message || message.isDeleted || !isPixReceivedMessage(message.body)) {
      return null;
    }

    const pixKey = extractPixKeyFromBody(message.body);

    if (!pixKey) return null;

    return (
      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
        <Button
          size="small"
          variant="outlined"
          onClick={(e) => {
            e.stopPropagation();
            handleCopyPixKey(message.body);
          }}
          style={{
            textTransform: "none",
            borderRadius: 8,
            fontSize: 12,
            padding: "2px 10px",
            minHeight: 30
          }}
        >
          Copiar chave
        </Button>
      </div>
    );
  };

  const renderMessages = () => {
    if (messagesList.length > 0) {
      const viewMessagesList = messagesList.map((message, index) => {
        if (message.mediaType === "call_log") {
          return (
            <React.Fragment key={message.id}>
              {renderDailyTimestamps(message, index)}
              {renderTicketsSeparator(message, index)}
              {renderMessageDivider(message, index)}
              <div className={classes.messageCenter}>
                <IconButton
                  variant="contained"
                  size="small"
                  id="messageActionsButton"
                  disabled={message.isDeleted}
                  className={classes.messageActionsButton}
                  onClick={(e) => handleOpenMessageOptionsMenu(e, message)}
                >
                  <ExpandMore />
                </IconButton>
                {isGroup && (
                  <span className={classes.messageContactName}>
                    {message.contact?.name}
                  </span>
                )}

                <div>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 17" width="20" height="17">
                    <path fill="#df3333" d="M18.2 12.1c-1.5-1.8-5-2.7-8.2-2.7s-6.7 1-8.2 2.7c-.7.8-.3 2.3.2 2.8.2.2.3.3.5.3 1.4 0 3.6-.7 3.6-.7.5-.2.8-.5.8-1v-1.3c.7-1.2 5.4-1.2 6.4-.1l.1.1v1.3c0 .2.1.4.2.6.1.2.3.3.5.4 0 0 2.2.7 3.6.7.2 0 1.4-2 .5-3.1zM5.4 3.2l4.7 4.6 5.8-5.7-.9-.8L10.1 6 6.4 2.3h2.5V1H4.1v4.8h1.3V3.2z"></path>
                  </svg> <span>{i18n.t("ticketsList.missedCall")} {format(parseISO(message.createdAt), "HH:mm")}</span>
                </div>
              </div>
            </React.Fragment>
          );
        }

        if (!message.fromMe) {
          return (
            <React.Fragment key={message.id}>
              {renderDailyTimestamps(message, index)}
              {renderTicketsSeparator(message, index)}
              {renderMessageDivider(message, index)}
              <div
                className={classes.messageLeft}
                title={message.queueId && message.queue?.name}
                onDoubleClick={(e) => hanldeReplyMessage(e, message)}
              >
                {showSelectMessageCheckbox && (
                  <SelectMessageCheckbox
                    message={message}
                  />
                )}
                <IconButton
                  variant="contained"
                  size="small"
                  id="messageActionsButton"
                  disabled={message.isDeleted}
                  className={classes.messageActionsButton}
                  onClick={(e) => handleOpenMessageOptionsMenu(e, message)}
                >
                  <ExpandMore />
                </IconButton>

                {message.isForwarded && (
                  <div>
                    <span className={classes.forwardMessage}>
                      <Reply style={{ color: "grey", transform: "scaleX(-1)" }} /> {i18n.t("forwardMessage.text")}
                    </span>
                    <br />
                  </div>
                )}
                {isGroup && (
                  <span className={classes.messageContactName}>
                    {message.contact?.name}
                  </span>
                )}
                {isYouTubeLink(message.body) && (
                  <YouTubePreview videoUrl={message.body} />
                )}

                {!lgpdDeleteMessage && message.isDeleted && (
                  <div>
                    <span className={classes.deletedMessage}>
                      🚫 Essa mensagem foi apagada pelo contato &nbsp;
                    </span>
                  </div>
                )}

                {(
                  message.mediaUrl ||
                  message.mediaType === "locationMessage" ||
                  message.mediaType === "location" ||
                  message.mediaType === "contactMessage" ||
                  message.mediaType === "contacts" ||
                  isTemplateMessage(message) ||
                  message.mediaType === "adMetaPreview" ||
                  message.mediaType === "facebookPostPreview" ||
                  hasAdReferralPreview(message)
                ) && checkMessageMedia(message)}

                <div className={clsx(classes.textContentItem, {
                  [classes.textContentItemDeleted]: message.isDeleted,
                })}>
                  {message.quotedMsg &&
                    (message.mediaType === "reactionMessage"
                      ? renderReactionReference(message, classes)
                      : renderQuotedMessage(message))}
                  {(message.mediaType === "buttonsResponseMessage" || message.mediaType === "messageContextInfo") && !message.isDeleted && (
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      marginBottom: "2px",
                      fontSize: "11px",
                      color: "#667781",
                      fontStyle: "italic",
                    }}>
                      <span>📌 Selecionou:</span>
                      <span style={{ fontWeight: "bold", color: "#1d6f42" }}>{message.body}</span>
                    </div>
                  )}
                  {message.mediaType !== "adMetaPreview" &&
                    message.mediaType !== "facebookPostPreview" &&
                    message.mediaType !== "buttonsResponseMessage" &&
                    message.mediaType !== "messageContextInfo" && (
                      <div>
                        {(message.mediaUrl !== null && (message.mediaType === "image" || message.mediaType === "video") && getBasename(message.mediaUrl).trim() !== message.body.trim()) ||
                          (message.mediaType !== "audio" &&
                            message.mediaType !== "image" &&
                            message.mediaType !== "video" &&
                            message.mediaType !== "reactionMessage" &&
                            message.mediaType !== "locationMessage" &&
                            message.mediaType !== "location" &&
                            message.mediaType !== "contactMessage" &&
                            message.mediaType !== "contacts" &&
                            !isTemplateMessage(message) &&
                            !isStickerMessage(message)) ? (
                          <>
                            {xmlRegex.test(message.body) ? (
                              <>
                                <span>{message.body}</span>
                                {renderPixCopyButton(message)}
                              </>
                            ) : (
                              <>
                                <MarkdownWrapper>
                                  {(lgpdDeleteMessage && message.isDeleted)
                                    ? "🚫 _Mensagem apagada_ "
                                    : message.body}
                                </MarkdownWrapper>
                                {renderPixCopyButton(message)}
                              </>
                            )}
                          </>
                        ) : null}
                      </div>
                    )}

                  {message.mediaType === "reactionMessage" && (
                    <span style={{ marginLeft: "0px" }}>
                      <MarkdownWrapper>
                        {`${message?.contact?.name || "Contato"} reagiu com ${message.body}`}
                      </MarkdownWrapper>
                    </span>
                  )}

                  <span className={classes.timestamp}>
                    {message.isEdited ? "Editada " + format(parseISO(message.createdAt), "HH:mm") : format(parseISO(message.createdAt), "HH:mm")}
                  </span>
                </div>
              </div>
            </React.Fragment>
          );
        } else {
          return (
            <React.Fragment key={message.id}>
              {renderDailyTimestamps(message, index)}
              {renderTicketsSeparator(message, index)}
              {renderMessageDivider(message, index)}
              <div
                className={message.isPrivate ? classes.messageRightPrivate : classes.messageRight}
                title={message.queueId && message.queue?.name}
                onDoubleClick={(e) => hanldeReplyMessage(e, message)}
              >
                {showSelectMessageCheckbox && (
                  <SelectMessageCheckbox
                    message={message}
                  />
                )}

                <IconButton
                  variant="contained"
                  size="small"
                  id="messageActionsButton"
                  disabled={message.isDeleted}
                  className={classes.messageActionsButton}
                  onClick={(e) => handleOpenMessageOptionsMenu(e, message)}
                >
                  <ExpandMore />
                </IconButton>
                {message.isForwarded && (
                  <div>
                    <span className={classes.forwardMessage}>
                      <Reply style={{ color: "grey", transform: "scaleX(-1)" }} /> {i18n.t("forwardMessage.text")}
                    </span>
                    <br />
                  </div>
                )}
                {isYouTubeLink(message.body) && (
                  <YouTubePreview videoUrl={message.body} />
                )}
                {!lgpdDeleteMessage && message.isDeleted && (
                  <div>
                    <span className={classes.deletedMessage}>
                      🚫 Essa mensagem foi apagada &nbsp;
                    </span>
                  </div>
                )}
                {(
                  message.mediaUrl ||
                  message.mediaType === "locationMessage" ||
                  message.mediaType === "location" ||
                  message.mediaType === "contactMessage" ||
                  message.mediaType === "contacts" ||
                  isTemplateMessage(message) ||
                  message.mediaType === "adMetaPreview" ||
                  message.mediaType === "facebookPostPreview" ||
                  hasAdReferralPreview(message)
                ) && checkMessageMedia(message)}
                <div
                  className={clsx(classes.textContentItem, {
                    [classes.textContentItemDeleted]: message.isDeleted,
                  })}
                >
                  {message.quotedMsg &&
                    (message.mediaType === "reactionMessage"
                      ? renderReactionReference(message, classes)
                      : renderQuotedMessage(message))}

                  {((message.mediaType === "image" || message.mediaType === "video") && getBasename(message.mediaUrl) === message.body) ||
                    (message.mediaType !== "audio" &&
                      message.mediaType !== "reactionMessage" &&
                      message.mediaType !== "locationMessage" &&
                      message.mediaType !== "location" &&
                      message.mediaType !== "contactMessage" &&
                      message.mediaType !== "contacts" &&
                      !isTemplateMessage(message) &&
                      message.mediaType !== "adMetaPreview" &&
                      message.mediaType !== "facebookPostPreview" &&
                      !isStickerMessage(message)) ? (
                    <>
                      {xmlRegex.test(message.body) ? (
                        <>
                          <div>{formatXml(message.body)}</div>
                          {renderPixCopyButton(message)}
                        </>
                      ) : (
                        <>
                          <MarkdownWrapper>{message.body}</MarkdownWrapper>
                          {renderPixCopyButton(message)}
                        </>
                      )}
                    </>
                  ) : null}

                  {message.mediaType === "reactionMessage" && (
                    <span style={{ marginLeft: "0px" }}>
                      <MarkdownWrapper>
                        {`Você reagiu com ${message.body}`}
                      </MarkdownWrapper>
                    </span>
                  )}

                  <span className={classes.timestamp}>
                    {message.isEdited ? "Editada " + format(parseISO(message.createdAt), "HH:mm") : format(parseISO(message.createdAt), "HH:mm")}
                    {renderMessageAck(message)}
                  </span>
                </div>
              </div>
            </React.Fragment>
          );
        }
      });
      return viewMessagesList;
    } else {
      return <div>Diga olá para seu novo contato!</div>;
    }
  };

  const shouldBlurMessages = ticketStatus === "pending" && user.allowSeeMessagesInPendingTickets === "disabled";

  return (
    <div className={classes.messagesListWrapper} onDragEnter={handleDrag}>
      {dragActive && <div className={classes.dragElement} onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}>Solte o arquivo aqui</div>}
      <MessageOptionsMenu
        message={selectedMessage}
        anchorEl={anchorEl}
        menuOpen={messageOptionsMenuOpen}
        handleClose={handleCloseMessageOptionsMenu}
        isGroup={isGroup}
        whatsappId={whatsappId}
        queueId={queueId}
        onDownloadMessage={handleDownloadMessageFile}
        onReactMessage={async (message, emoji) => {
          try {
            await api.post(`/messages/${message.id}/react`, {
              reaction: emoji
            });

            toast.success(`Reação ${emoji} enviada.`);
          } catch (err) {
            toastError(err);
          }
        }}
      />

      <div
        id="messagesList"
        className={classes.messagesList}
        onScroll={handleScroll}
        style={{
          filter: shouldBlurMessages ? "blur(4px)" : "none",
          pointerEvents: shouldBlurMessages ? "none" : "auto"
        }}
      >
        {messagesList.length > 0 ? renderMessages() : []}
        <div ref={lastMessageRef} style={{ float: "left", clear: "both" }} />
      </div>

      {(channel !== "whatsapp" && channel !== undefined && channel !== "whatsapp_oficial") && (
        <div
          style={{
            width: "100%",
            display: "flex",
            padding: "10px",
            alignItems: "center",
            backgroundColor: "#E1F3FB",
          }}
        >
          {channel === "facebook" ? (
            <Facebook />
          ) : channel === "instagram" ? (
            <Instagram />
          ) : (
            <TelegramIcon size={18} />
          )}

          <span>
            Canal{" "}
            {channel === "facebook"
              ? i18n.t("compaies.table.useFacebook")
              : channel === "instagram"
                ? i18n.t("compaies.table.useInstagram")
                : "Telegram"}{" "}
            conectado. Responda normalmente pelo sistema.
          </span>
        </div>
      )}

      {loading && (
        <div>
          <CircularProgress className={classes.circleLoading} />
        </div>
      )}
    </div>
  );
};

export default MessagesList;