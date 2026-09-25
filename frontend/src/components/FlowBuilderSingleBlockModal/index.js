import React, { useState, useEffect, useRef, useContext } from "react";

import * as Yup from "yup";
import { Formik, FieldArray, Form, Field } from "formik";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import IconButton from "@material-ui/core/IconButton";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import CircularProgress from "@material-ui/core/CircularProgress";
import Compressor from "compressorjs";

import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import {
  Checkbox,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import {
  AccessTime,
  AddCircle,
  Delete,
  DragIndicator,
  Image,
  KeyboardArrowDown,
  KeyboardArrowUp,
  Message,
  MicNone,
  Videocam,
  InsertDriveFile,
} from "@mui/icons-material";
import { capitalize } from "../../utils/capitalize";
import { Box } from "@material-ui/core";
import { AuthContext } from "../../context/Auth/AuthContext";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexWrap: "wrap",
  },
  textField: {
    marginRight: theme.spacing(1),
    flex: 1,
  },

  extraAttr: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },

  btnWrapper: {
    position: "relative",
  },

  buttonProgress: {
    color: green[500],
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -12,
    marginLeft: -12,
  },

  dialogPaper: {
    borderRadius: 18,
    overflow: "hidden",
    boxShadow: "0 18px 45px rgba(15, 23, 42, 0.16)",
    background:
      theme.palette.type === "dark"
        ? "linear-gradient(180deg, #0f172a 0%, #111827 100%)"
        : "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  },

  dialogTitle: {
    padding: theme.spacing(2, 3),
    borderBottom: `1px solid ${theme.palette.type === "dark"
      ? "rgba(255,255,255,0.06)"
      : "rgba(15,23,42,0.08)"
      }`,
    background:
      theme.palette.type === "dark"
        ? "rgba(15, 23, 42, 0.88)"
        : "rgba(255, 255, 255, 0.92)",
    backdropFilter: "blur(10px)",
  },

  titleText: {
    fontWeight: 700,
    fontSize: "1.05rem",
    color: theme.palette.text.primary,
  },

  bodyCard: {
    gap: "12px",
    padding: "18px",
    overflow: "auto",
    height: "70vh",
    scrollBehavior: "smooth",
    background:
      theme.palette.type === "dark"
        ? "linear-gradient(180deg, rgba(15,23,42,0.55) 0%, rgba(17,24,39,0.3) 100%)"
        : "linear-gradient(180deg, rgba(248,250,252,0.75) 0%, rgba(241,245,249,0.35) 100%)",
  },

  toolbarWrap: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 6,
    marginBottom: 4,
  },

  actionButton: {
    borderRadius: 12,
    textTransform: "none",
    fontWeight: 600,
    boxShadow: "none",
    padding: "8px 14px",
    background:
      theme.palette.type === "dark"
        ? "rgba(59, 130, 246, 0.14)"
        : "rgba(59, 130, 246, 0.10)",
    color: theme.palette.primary.main,
    border: `1px solid ${theme.palette.type === "dark"
      ? "rgba(96, 165, 250, 0.22)"
      : "rgba(59, 130, 246, 0.18)"
      }`,
    "&:hover": {
      boxShadow: "0 10px 24px rgba(37, 99, 235, 0.12)",
      background:
        theme.palette.type === "dark"
          ? "rgba(59, 130, 246, 0.20)"
          : "rgba(59, 130, 246, 0.14)",
    },
  },

  dragWrapper: {
    width: "100%",
    borderRadius: 18,
    transition: "all 0.18s ease",
  },

  dragWrapperDragging: {
    opacity: 0.65,
    transform: "scale(0.995)",
  },

  dragWrapperOver: {
    outline: "2px dashed rgba(37, 99, 235, 0.45)",
    outlineOffset: "2px",
  },

  elementCard: {
    borderRadius: 16,
    padding: 14,
    position: "relative",
    border: `1px solid ${theme.palette.type === "dark"
      ? "rgba(255,255,255,0.08)"
      : "rgba(15,23,42,0.08)"
      }`,
    background:
      theme.palette.type === "dark"
        ? "rgba(15, 23, 42, 0.72)"
        : "rgba(255, 255, 255, 0.92)",
    boxShadow:
      theme.palette.type === "dark"
        ? "0 10px 24px rgba(0,0,0,0.18)"
        : "0 10px 24px rgba(15,23,42,0.06)",
    backdropFilter: "blur(8px)",
  },

  elementHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  elementTitle: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontWeight: 700,
    color: theme.palette.text.primary,
  },

  dragHandle: {
    width: 32,
    height: 32,
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "grab",
    color: theme.palette.text.secondary,
    background:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.05)"
        : "rgba(15,23,42,0.05)",
    border: `1px solid ${theme.palette.type === "dark"
      ? "rgba(255,255,255,0.08)"
      : "rgba(15,23,42,0.08)"
      }`,
    "&:active": {
      cursor: "grabbing",
    },
  },

  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },

  orderButton: {
    width: 32,
    height: 32,
    borderRadius: 999,
    background:
      theme.palette.type === "dark"
        ? "rgba(59, 130, 246, 0.14)"
        : "rgba(59, 130, 246, 0.10)",
    color: theme.palette.primary.main,
    border: `1px solid ${theme.palette.type === "dark"
      ? "rgba(59, 130, 246, 0.22)"
      : "rgba(59, 130, 246, 0.18)"
      }`,
    "&:hover": {
      background:
        theme.palette.type === "dark"
          ? "rgba(59, 130, 246, 0.20)"
          : "rgba(59, 130, 246, 0.14)",
    },
  },

  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 999,
    background:
      theme.palette.type === "dark"
        ? "rgba(239, 68, 68, 0.14)"
        : "rgba(239, 68, 68, 0.10)",
    color: "#ef4444",
    border: `1px solid ${theme.palette.type === "dark"
      ? "rgba(239, 68, 68, 0.20)"
      : "rgba(239, 68, 68, 0.18)"
      }`,
    "&:hover": {
      background:
        theme.palette.type === "dark"
          ? "rgba(239, 68, 68, 0.20)"
          : "rgba(239, 68, 68, 0.14)",
    },
  },

  mediaPreviewWrap: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: 120,
    marginBottom: 10,
    borderRadius: 14,
    padding: 10,
    background:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.03)"
        : "rgba(248,250,252,0.95)",
    border: `1px dashed ${theme.palette.type === "dark"
      ? "rgba(255,255,255,0.10)"
      : "rgba(15,23,42,0.10)"
      }`,
  },

  uploadButton: {
    borderRadius: 12,
    textTransform: "none",
    fontWeight: 600,
    boxShadow: "none",
  },

  variableBox: {
    width: "100%",
    textAlign: "center",
    borderRadius: 16,
    overflow: "hidden",
    border: `1px solid ${theme.palette.type === "dark"
      ? "rgba(255,255,255,0.08)"
      : "rgba(15,23,42,0.08)"
      }`,
    background:
      theme.palette.type === "dark"
        ? "rgba(15, 23, 42, 0.72)"
        : "rgba(255, 255, 255, 0.92)",
    boxShadow:
      theme.palette.type === "dark"
        ? "0 10px 24px rgba(0,0,0,0.16)"
        : "0 10px 24px rgba(15,23,42,0.05)",
  },

  variableHeader: {
    padding: "12px 16px",
    fontWeight: 700,
    color: "#fff",
    background: "linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)",
  },

  variableList: {
    width: "100%",
    maxHeight: 220,
    overflowY: "auto",
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },

  variableItem: {
    borderRadius: 12,
    padding: "10px 12px",
    fontWeight: 600,
    background:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.04)"
        : "rgba(248,250,252,1)",
    border: `1px dashed ${theme.palette.type === "dark"
      ? "rgba(255,255,255,0.10)"
      : "rgba(15,23,42,0.10)"
      }`,
    color: theme.palette.text.secondary,
  },

  dialogActions: {
    padding: theme.spacing(1.5, 2.5, 2.5, 2.5),
    borderTop: `1px solid ${theme.palette.type === "dark"
      ? "rgba(255,255,255,0.06)"
      : "rgba(15,23,42,0.08)"
      }`,
    background:
      theme.palette.type === "dark"
        ? "rgba(15, 23, 42, 0.88)"
        : "rgba(255, 255, 255, 0.92)",
  },

  cancelButton: {
    borderRadius: 12,
    textTransform: "none",
    fontWeight: 700,
    padding: "8px 18px",
  },

  saveButton: {
    borderRadius: 12,
    textTransform: "none",
    fontWeight: 700,
    padding: "8px 18px",
    boxShadow: "0 12px 28px rgba(37, 99, 235, 0.18)",
  },

  loadingWrap: {
    gap: "8px",
    padding: "16px",
    height: "70vh",
    alignSelf: "center",
    justifyContent: "center",
  },

  loadingCard: {
    borderRadius: 18,
    padding: 28,
    textAlign: "center",
    background:
      theme.palette.type === "dark"
        ? "rgba(15, 23, 42, 0.74)"
        : "rgba(255, 255, 255, 0.94)",
    border: `1px solid ${theme.palette.type === "dark"
      ? "rgba(255,255,255,0.08)"
      : "rgba(15,23,42,0.08)"
      }`,
    boxShadow:
      theme.palette.type === "dark"
        ? "0 12px 30px rgba(0,0,0,0.20)"
        : "0 12px 30px rgba(15,23,42,0.08)",
  },
}));

const FlowBuilderSingleBlockModal = ({
  open,
  onSave,
  onUpdate,
  data,
  close,
}) => {
  const classes = useStyles();
  const isMounted = useRef(true);

  const [activeModal, setActiveModal] = useState(false);

  const [rule, setRule] = useState();

  const [medias, setMedias] = useState([]);

  const [textDig, setTextDig] = useState();

  const [elements, setElements] = useState([]);

  const [elementsSeq, setElementsSeq] = useState([]);

  const [elementsSeqEdit, setElementsSeqEdit] = useState([]);

  const [elementsEdit, setElementsEdit] = useState([]);

  const [numberMessages, setNumberMessages] = useState(0);

  const [numberMessagesLast, setNumberMessagesLast] = useState(0);

  const [numberInterval, setNumberInterval] = useState(0);

  const [numberIntervalLast, setNumberIntervalLast] = useState(0);

  const [numberAudio, setNumberAudio] = useState(0);

  const [numberAudioLast, setNumberAudioLast] = useState(0);

  const [numberVideo, setNumberVideo] = useState(0);

  const [numberVideoLast, setNumberVideoLast] = useState(0);

  const [numberImg, setNumberImg] = useState(0);

  const [numberImgLast, setNumberImgLast] = useState(0);

  const [loading, setLoading] = useState(false);

  const [previewImg, setPreviewImg] = useState([]);

  const [previewAudios, setPreviewAudios] = useState([]);

  const [previewVideos, setPreviewVideos] = useState([]);

  const [arrayOption, setArrayOption] = useState([]);

  const [variables, setVariables] = useState([]);

  const [previewDocs, setPreviewDocs] = useState([]);
  const [numberDocLast, setNumberDocLast] = useState(0);
  const [numberDocs, setNumberDocs] = useState(0);

  const [draggedElementId, setDraggedElementId] = useState(null);
  const [dragOverElementId, setDragOverElementId] = useState(null);

  const [labels, setLabels] = useState({
    title: i18n.t("automation.content.addToFlow"),
    btn: i18n.t("automation.common.add"),
  });

  const { user } = useContext(AuthContext);

  const companyId = user.companyId;

  const isPdfFileName = (name = "") => name.toLowerCase().includes(".pdf");

  const isDocFileName = (name = "") => {
    const lower = name.toLowerCase();
    return (
      lower.includes(".pdf") ||
      lower.includes(".doc") ||
      lower.includes(".docx") ||
      lower.includes(".xls") ||
      lower.includes(".xlsx") ||
      lower.includes(".txt") ||
      lower.includes(".csv") ||
      lower.includes(".ppt") ||
      lower.includes(".pptx")
    );
  };

  const getElementIcon = (type) => {
    if (type === "message") return <Message fontSize="small" />;
    if (type === "interval") return <AccessTime fontSize="small" />;
    if (type === "img") return <Image fontSize="small" />;
    if (type === "audio") return <MicNone fontSize="small" />;
    if (type === "video") return <Videocam fontSize="small" />;
    if (type === "document") return <InsertDriveFile fontSize="small" />;
    return <AddCircle fontSize="small" />;
  };

  const getElementTitle = (type) => {
    if (type === "message") return i18n.t("automation.content.text");
    if (type === "interval") return i18n.t("automation.content.interval");
    if (type === "img") return i18n.t("automation.content.image");
    if (type === "audio") return i18n.t("automation.content.audio");
    if (type === "video") return i18n.t("automation.content.video");
    if (type === "document") return i18n.t("automation.content.document");
    return i18n.t("automation.content.content");
  };

  const extractElementNumber = (elementId = "", type = "") => {
    return parseInt(String(elementId).replace(type, ""), 10);
  };

  const getElementId = (type, number) => `${type}${number}`;

  const getElementTypeFromId = (elementId = "") => {
    if (String(elementId).startsWith("message")) return "message";
    if (String(elementId).startsWith("interval")) return "interval";
    if (String(elementId).startsWith("audio")) return "audio";
    if (String(elementId).startsWith("video")) return "video";
    if (String(elementId).startsWith("document")) return "document";
    if (String(elementId).startsWith("img")) return "img";
    return "";
  };

  const getIdsByType = (sequence = [], type = "") => {
    return sequence.filter((item) => String(item).startsWith(type));
  };

  const getNextNumberFromIds = (ids = [], type = "") => {
    if (!ids.length) return 0;
    const values = ids
      .map((item) => extractElementNumber(item, type))
      .filter((item) => !Number.isNaN(item));

    if (!values.length) return 0;

    return Math.max(...values) + 1;
  };

  const hydrateCountersFromSequence = (sequence = []) => {
    const messageIds = getIdsByType(sequence, "message");
    const intervalIds = getIdsByType(sequence, "interval");
    const imgIds = getIdsByType(sequence, "img");
    const audioIds = getIdsByType(sequence, "audio");
    const videoIds = getIdsByType(sequence, "video");
    const documentIds = getIdsByType(sequence, "document");

    setNumberMessages(messageIds.length);
    setNumberMessagesLast(getNextNumberFromIds(messageIds, "message"));

    setNumberInterval(intervalIds.length);
    setNumberIntervalLast(getNextNumberFromIds(intervalIds, "interval"));

    setNumberImg(imgIds.length);
    setNumberImgLast(getNextNumberFromIds(imgIds, "img"));

    setNumberAudio(audioIds.length);
    setNumberAudioLast(getNextNumberFromIds(audioIds, "audio"));

    setNumberVideo(videoIds.length);
    setNumberVideoLast(getNextNumberFromIds(videoIds, "video"));

    setNumberDocs(documentIds.length);
    setNumberDocLast(getNextNumberFromIds(documentIds, "document"));
  };

  const resetModalState = () => {
    setTextDig();
    setArrayOption([]);
    setMedias([]);
    setPreviewImg([]);
    setPreviewAudios([]);
    setPreviewVideos([]);
    setPreviewDocs([]);
    setElements([]);
    setElementsSeq([]);
    setElementsEdit([]);
    setElementsSeqEdit([]);
    setNumberMessages(0);
    setNumberMessagesLast(0);
    setNumberInterval(0);
    setNumberIntervalLast(0);
    setNumberAudio(0);
    setNumberAudioLast(0);
    setNumberVideo(0);
    setNumberVideoLast(0);
    setNumberImg(0);
    setNumberImgLast(0);
    setNumberDocs(0);
    setNumberDocLast(0);
    setDraggedElementId(null);
    setDragOverElementId(null);
  };

  const tagFileForElement = (file, number, flowType) => {
    if (!file) return file;

    try {
      file.flowNumber = number;
      file.flowType = flowType;
    } catch (e) { }

    return file;
  };

  const upsertMediaFile = (file, number, flowType) => {
    const taggedFile = tagFileForElement(file, number, flowType);
    setMedias((old) => [
      ...old.filter(
        (item) =>
          !(
            Number(item?.flowNumber) === Number(number) &&
            item?.flowType === flowType
          )
      ),
      taggedFile,
    ]);
  };

  const markElementAsReplaced = (type, number) => {
    const elementId = getElementId(type, number);
    setElementsSeqEdit((old) => old.filter((item) => item !== elementId));
    setElementsEdit((old) => old.filter((item) => item.number !== elementId));
  };

  const getExistingEditedElement = (elementId) => {
    return elementsEdit.find((item) => item.number === elementId);
  };

  const getUploadedMediaPayload = (type, number, newNameFiles) => {
    if (!Array.isArray(newNameFiles)) return null;

    const mediaIndex = medias.findIndex(
      (file) =>
        file?.flowType === type &&
        Number(file?.flowNumber) === Number(number)
    );

    if (mediaIndex === -1) return null;

    return {
      value: newNameFiles[mediaIndex],
      original: medias[mediaIndex]?.name,
    };
  };

  const getPreviewImage = (number) => {
    return previewImg.find((item) => Number(item.number) === Number(number));
  };

  const getPreviewAudio = (number) => {
    return previewAudios.find((item) => Number(item.number) === Number(number));
  };

  const getPreviewVideo = (number) => {
    return previewVideos.find((item) => Number(item.number) === Number(number));
  };

  const getPreviewDocument = (number) => {
    return previewDocs.find((item) => Number(item.number) === Number(number));
  };

  const getBackendFlowFileUrl = (fileName = "") => {
    if (!fileName) return "";
    return `${process.env.REACT_APP_BACKEND_URL}/public/company${companyId}/flow/${fileName}`;
  };

  const hasMediaForElement = (elementId, type) => {
    const number = extractElementNumber(elementId, type);

    if (elementsSeqEdit.includes(elementId)) {
      const existing = getExistingEditedElement(elementId);
      if (existing?.value) {
        return true;
      }
    }

    if (
      medias.some(
        (item) =>
          item?.flowType === type &&
          Number(item?.flowNumber) === Number(number)
      )
    ) {
      return true;
    }

    if (type === "img") {
      return previewImg.some((item) => Number(item.number) === Number(number));
    }

    if (type === "audio") {
      return previewAudios.some(
        (item) => Number(item.number) === Number(number)
      );
    }

    if (type === "video") {
      return previewVideos.some(
        (item) => Number(item.number) === Number(number)
      );
    }

    if (type === "document") {
      return previewDocs.some((item) => Number(item.number) === Number(number));
    }

    return false;
  };

  const handleElements = (newNameFiles) => {
    const elementsSequence = [];

    for (let i = 0; i < elementsSeq.length; i++) {
      const currentId = elementsSeq[i];
      const currentType = getElementTypeFromId(currentId);
      const currentNumber = extractElementNumber(currentId, currentType);

      if (currentType === "message") {
        const input = document
          .querySelector(`.${currentId}`)
          ?.querySelector(".MuiInputBase-input");

        const value = input?.value || "";

        if (!value) {
          toast.error("Campos de mensagem vazio!");
          setLoading(false);
          throw "";
        }

        elementsSequence.push({
          type: "message",
          value,
          number: currentId,
        });

        continue;
      }

      if (currentType === "interval") {
        const input = document
          .querySelector(`.${currentId}`)
          ?.querySelector(".MuiInputBase-input");

        const value = input?.value || "";

        if (!value || parseInt(value, 10) === 0 || parseInt(value, 10) > 120) {
          toast.error("Intervalo não pode ser 0 ou maior que 120!");
          setLoading(false);
          throw "";
        }

        elementsSequence.push({
          type: "interval",
          value,
          number: currentId,
        });

        continue;
      }

      if (currentType === "img") {
        const captionInput =
          document.querySelector(`.captionImg${currentNumber} textarea`) ||
          document.querySelector(`.captionImg${currentNumber} input`);

        const captionValue = captionInput?.value || "";

        if (elementsSeqEdit.includes(currentId)) {
          const itemSelectedEdit = elementsEdit.find(
            (item) => item.number === currentId
          );

          elementsSequence.push({
            type: "img",
            value: itemSelectedEdit?.value || "",
            original: itemSelectedEdit?.original || "",
            number: itemSelectedEdit?.number || currentId,
            caption: captionValue,
            teste: "image",
          });
        } else {
          const uploaded = getUploadedMediaPayload("img", currentNumber, newNameFiles);

          if (!uploaded?.value) {
            toast.error("Envie a imagem do card antes de salvar.");
            setLoading(false);
            throw "";
          }

          elementsSequence.push({
            type: "img",
            value: uploaded.value,
            original: uploaded.original,
            number: currentId,
            caption: captionValue,
            teste: "image",
          });
        }

        continue;
      }

      if (currentType === "audio") {
        const audioChecked =
          document
            .querySelector(`.checkaudio${currentNumber}`)
            ?.querySelector(".PrivateSwitchBase-input")?.checked ?? true;

        if (elementsSeqEdit.includes(currentId)) {
          const itemSelectedEdit = elementsEdit.find(
            (item) => item.number === currentId
          );

          elementsSequence.push({
            type: "audio",
            value: itemSelectedEdit?.value || "",
            original: itemSelectedEdit?.original || "",
            number: itemSelectedEdit?.number || currentId,
            record:
              typeof itemSelectedEdit?.record === "boolean"
                ? itemSelectedEdit.record
                : audioChecked,
          });
        } else {
          const uploaded = getUploadedMediaPayload(
            "audio",
            currentNumber,
            newNameFiles
          );

          if (!uploaded?.value) {
            toast.error("Envie o áudio do card antes de salvar.");
            setLoading(false);
            throw "";
          }

          elementsSequence.push({
            type: "audio",
            value: uploaded.value,
            original: uploaded.original,
            number: currentId,
            record: audioChecked,
          });
        }

        continue;
      }

      if (currentType === "video") {
        if (elementsSeqEdit.includes(currentId)) {
          const itemSelectedEdit = elementsEdit.find(
            (item) => item.number === currentId
          );

          elementsSequence.push({
            type: "video",
            value: itemSelectedEdit?.value || "",
            original: itemSelectedEdit?.original || "",
            number: itemSelectedEdit?.number || currentId,
          });
        } else {
          const uploaded = getUploadedMediaPayload(
            "video",
            currentNumber,
            newNameFiles
          );

          if (!uploaded?.value) {
            toast.error("Envie o vídeo do card antes de salvar.");
            setLoading(false);
            throw "";
          }

          elementsSequence.push({
            type: "video",
            value: uploaded.value,
            original: uploaded.original,
            number: currentId,
          });
        }

        continue;
      }

      if (currentType === "document") {
        if (elementsSeqEdit.includes(currentId)) {
          const itemSelectedEdit = elementsEdit.find(
            (item) => item.number === currentId
          );

          elementsSequence.push({
            type: "document",
            value: itemSelectedEdit?.value || "",
            original: itemSelectedEdit?.original || "",
            number: itemSelectedEdit?.number || currentId,
          });
        } else {
          const uploaded = getUploadedMediaPayload(
            "document",
            currentNumber,
            newNameFiles
          );

          if (!uploaded?.value) {
            toast.error("Envie o documento do card antes de salvar.");
            setLoading(false);
            throw "";
          }

          elementsSequence.push({
            type: "document",
            value: uploaded.value,
            original: uploaded.original,
            number: currentId,
          });
        }

        continue;
      }
    }

    return elementsSequence;
  };

  const deleteElementsTypeOne = (id, type) => {
    const elementId = `${type}${id}`;

    setElementsSeq((old) => old.filter((item) => item !== elementId));
    setElementsSeqEdit((old) => old.filter((item) => item !== elementId));
    setElementsEdit((old) => old.filter((item) => item.number !== elementId));

    if (type === "message") {
      setNumberMessages((old) => Math.max(old - 1, 0));
    }

    if (type === "interval") {
      setNumberInterval((old) => Math.max(old - 1, 0));
    }

    if (type === "img") {
      setNumberImg((old) => Math.max(old - 1, 0));
      setPreviewImg((old) => old.filter((item) => Number(item.number) !== Number(id)));
      setMedias((oldMedia) =>
        oldMedia.filter(
          (mediaItem) =>
            !(
              mediaItem?.flowType === "img" &&
              Number(mediaItem?.flowNumber) === Number(id)
            )
        )
      );
    }

    if (type === "audio") {
      setNumberAudio((old) => Math.max(old - 1, 0));
      setPreviewAudios((old) =>
        old.filter((item) => Number(item.number) !== Number(id))
      );
      setMedias((oldMedia) =>
        oldMedia.filter(
          (mediaItem) =>
            !(
              mediaItem?.flowType === "audio" &&
              Number(mediaItem?.flowNumber) === Number(id)
            )
        )
      );
    }

    if (type === "video") {
      setNumberVideo((old) => Math.max(old - 1, 0));
      setPreviewVideos((old) =>
        old.filter((item) => Number(item.number) !== Number(id))
      );
      setMedias((oldMedia) =>
        oldMedia.filter(
          (mediaItem) =>
            !(
              mediaItem?.flowType === "video" &&
              Number(mediaItem?.flowNumber) === Number(id)
            )
        )
      );
    }

    if (type === "document") {
      setNumberDocs((old) => Math.max(old - 1, 0));
      setPreviewDocs((old) =>
        old.filter((item) => Number(item.number) !== Number(id))
      );
      setMedias((oldMedia) =>
        oldMedia.filter(
          (mediaItem) =>
            !(
              mediaItem?.flowType === "document" &&
              Number(mediaItem?.flowNumber) === Number(id)
            )
        )
      );
    }
  };

  const moveElementDown = (id) => {
    setElementsSeq((old) => {
      const index = old.indexOf(id);

      if (index !== -1 && index < old.length - 1) {
        const novoArray = [...old];
        const elementoMovido = novoArray.splice(index, 1)[0];
        novoArray.splice(index + 1, 0, elementoMovido);
        return novoArray;
      }

      return old;
    });
  };

  const moveElementUp = (id) => {
    setElementsSeq((old) => {
      const index = old.indexOf(id);

      if (index !== -1 && index > 0) {
        const novoArray = [...old];
        const elementoMovido = novoArray.splice(index, 1)[0];
        novoArray.splice(index - 1, 0, elementoMovido);
        return novoArray;
      }

      return old;
    });
  };

  const reorderElementsByIds = (fromId, toId) => {
    if (!fromId || !toId || fromId === toId) return;

    setElementsSeq((old) => {
      const fromIndex = old.indexOf(fromId);
      const toIndex = old.indexOf(toId);

      if (fromIndex === -1 || toIndex === -1) return old;

      const newArray = [...old];
      const [movedItem] = newArray.splice(fromIndex, 1);
      newArray.splice(toIndex, 0, movedItem);

      return newArray;
    });
  };

  const handleDragStart = (event, elementId) => {
    setDraggedElementId(elementId);
    try {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", elementId);
    } catch (e) { }
  };

  const handleDragOver = (event, elementId) => {
    event.preventDefault();
    if (dragOverElementId !== elementId) {
      setDragOverElementId(elementId);
    }
    try {
      event.dataTransfer.dropEffect = "move";
    } catch (e) { }
  };

  const handleDrop = (event, elementId) => {
    event.preventDefault();

    let sourceId = draggedElementId;

    if (!sourceId) {
      try {
        sourceId = event.dataTransfer.getData("text/plain");
      } catch (e) { }
    }

    reorderElementsByIds(sourceId, elementId);
    setDraggedElementId(null);
    setDragOverElementId(null);
  };

  const handleDragEnd = () => {
    setDraggedElementId(null);
    setDragOverElementId(null);
  };

  const handleChangeMediasImg = (e, number) => {
    if (!e.target.files) {
      return;
    }

    if (e.target.files[0].size > 2000000) {
      toast.error("Arquivo é muito grande! 2MB máximo");
      return;
    }

    const file = e.target.files[0];
    const imgBlob = URL.createObjectURL(file);

    setPreviewImg((old) => [
      ...old.filter((item) => Number(item.number) !== Number(number)),
      {
        number: number,
        url: imgBlob,
        name: file.name,
        type: file.type,
      },
    ]);

    upsertMediaFile(file, number, "img");
    markElementAsReplaced("img", number);

    e.target.value = null;
  };

  const handleChangeAudios = (e, number) => {
    if (!e.target.files) {
      return;
    }

    if (e.target.files[0].size > 5000000) {
      toast.error("Arquivo é muito grande! 5MB máximo");
      return;
    }

    const file = e.target.files[0];
    const audioBlob = URL.createObjectURL(file);

    setPreviewAudios((old) => [
      ...old.filter((item) => Number(item.number) !== Number(number)),
      {
        number: number,
        url: audioBlob,
        name: file.name,
        type: file.type,
      },
    ]);

    upsertMediaFile(file, number, "audio");
    markElementAsReplaced("audio", number);

    e.target.value = null;
  };

  const handleChangeVideos = (e, number) => {
    if (!e.target.files) {
      return;
    }

    if (e.target.files[0].size > 20000000) {
      toast.error("Arquivo é muito grande! 20MB máximo");
      return;
    }

    const file = e.target.files[0];
    const videoBlob = URL.createObjectURL(file);

    setPreviewVideos((old) => [
      ...old.filter((item) => Number(item.number) !== Number(number)),
      {
        number: number,
        url: videoBlob,
        name: file.name,
        type: file.type,
      },
    ]);

    upsertMediaFile(file, number, "video");
    markElementAsReplaced("video", number);

    e.target.value = null;
  };

  const handleChangeDocuments = (e, number) => {
    if (!e.target.files) {
      return;
    }

    if (e.target.files[0].size > 10000000) {
      toast.error("Arquivo é muito grande! 10MB máximo");
      return;
    }

    const file = e.target.files[0];
    const documentBlob = URL.createObjectURL(file);

    setPreviewDocs((old) => [
      ...old.filter((item) => Number(item.number) !== Number(number)),
      {
        number: number,
        url: documentBlob,
        name: file.name,
        type: file.type,
      },
    ]);

    upsertMediaFile(file, number, "document");
    markElementAsReplaced("document", number);

    e.target.value = null;
  };

  const renderCardHeader = (type, number) => {
    const elementId = `${type}${number}`;

    return (
      <div className={classes.elementHeader}>
        <div className={classes.elementTitle}>
          <div className={classes.dragHandle} title="Arrastar bloco">
            <DragIndicator fontSize="small" />
          </div>
          {getElementIcon(type)}
          <Typography variant="body2" style={{ fontWeight: 700 }}>
            {getElementTitle(type)}
          </Typography>
        </div>

        <div className={classes.headerActions}>
          <IconButton
            size="small"
            className={classes.orderButton}
            onClick={() => moveElementUp(elementId)}
          >
            <KeyboardArrowUp fontSize="small" />
          </IconButton>

          <IconButton
            size="small"
            className={classes.orderButton}
            onClick={() => moveElementDown(elementId)}
          >
            <KeyboardArrowDown fontSize="small" />
          </IconButton>

          <IconButton
            size="small"
            className={classes.deleteButton}
            onClick={() => deleteElementsTypeOne(number, type)}
          >
            <Delete fontSize="small" />
          </IconButton>
        </div>
      </div>
    );
  };

  const imgLayout = (number, valueDefault = "", captionDefault = "") => {
    const preview = getPreviewImage(number);
    const src =
      preview?.url || (valueDefault ? getBackendFlowFileUrl(valueDefault) : "");

    return (
      <Stack
        key={`stackImg${number}`}
        className={`${classes.elementCard} stackImg${number}`}
      >
        {renderCardHeader("img", number)}

        <div className={classes.mediaPreviewWrap}>
          {src ? (
            <img
              src={src}
              className={`img${number}`}
              style={{
                width: "220px",
                maxWidth: "100%",
                borderRadius: "12px",
                objectFit: "cover",
              }}
            />
          ) : null}
        </div>

        <TextField
          label={i18n.t("automation.content.imageCaption")}
          defaultValue={captionDefault}
          className={`captionImg${number}`}
          variant="outlined"
          margin="dense"
          placeholder="Ex: Oferta válida até hoje"
          style={{ width: "100%", marginBottom: 10 }}
        />

        <Button
          variant="contained"
          color="primary"
          component="label"
          className={`${classes.uploadButton} btnImg${number}`}
        >
          {src ? i18n.t("automation.common.changeImage") : i18n.t("automation.common.sendImage")}
          <input
            type="file"
            accept="image/png, image/jpg, image/jpeg"
            hidden
            onChange={(e) => handleChangeMediasImg(e, number)}
          />
        </Button>
      </Stack>
    );
  };

  const audioLayout = (number, valueDefault = "", valueRecordDefault = "") => {
    const preview = getPreviewAudio(number);
    const src = preview?.url || (valueDefault ? getBackendFlowFileUrl(valueDefault) : "");
    const sourceType = preview?.type || "audio/mp3";

    return (
      <Stack
        className={`${classes.elementCard} stackAudio${number}`}
        key={`stackAudio${number}`}
      >
        {renderCardHeader("audio", number)}

        <div className={classes.mediaPreviewWrap}>
          <div
            className={`audio${number}`}
            style={{
              display: "flex",
              flexDirection: "row",
              justifyContent: "center",
              width: "100%",
            }}
          >
            {src ? (
              <audio controls="controls" style={{ maxWidth: "100%" }}>
                <source src={src} type={sourceType} />
                seu navegador não suporta HTML5
              </audio>
            ) : null}
          </div>
        </div>

        <Button
          variant="contained"
          color="primary"
          component="label"
          className={`${classes.uploadButton} btnAudio${number}`}
        >
          {src ? i18n.t("automation.content.changeAudio") : i18n.t("automation.content.sendAudio")}
          <input
            type="file"
            accept="audio/ogg, audio/mp3, audio/opus,audio/mpeg,audio/wav"
            hidden
            onChange={(e) => handleChangeAudios(e, number)}
          />
        </Button>

        <Stack
          direction={"row"}
          justifyContent={"center"}
          alignItems="center"
          spacing={1}
          style={{ marginTop: 8 }}
        >
          <Checkbox
            className={`checkaudio${number}`}
            defaultChecked={valueRecordDefault === "ok" ? false : true}
          />
          <Typography variant="body2">
            {i18n.t("automation.content.sendAsRecordedAudio")}
          </Typography>
        </Stack>
      </Stack>
    );
  };

  const videoLayout = (number, valueDefault = "") => {
    const preview = getPreviewVideo(number);
    const src = preview?.url || (valueDefault ? getBackendFlowFileUrl(valueDefault) : "");
    const sourceType = preview?.type || "video/mp4";

    return (
      <Stack
        className={`${classes.elementCard} stackVideo${number}`}
        key={`stackVideo${number}`}
      >
        {renderCardHeader("video", number)}

        <div className={classes.mediaPreviewWrap}>
          <div
            className={`video${number}`}
            style={{
              display: "flex",
              flexDirection: "row",
              justifyContent: "center",
              width: "100%",
            }}
          >
            {src ? (
              <video
                controls="controls"
                style={{ width: "220px", borderRadius: "12px" }}
              >
                <source src={src} type={sourceType} />
                seu navegador não suporta HTML5
              </video>
            ) : null}
          </div>
        </div>

        <Button
          variant="contained"
          color="primary"
          component="label"
          className={`${classes.uploadButton} btnVideo${number}`}
        >
          {src ? i18n.t("automation.content.changeVideo") : i18n.t("automation.content.sendVideo")}
          <input
            type="file"
            accept="video/mp4,video/avi,video/quicktime,video/x-msvideo,video/webm"
            hidden
            onChange={(e) => handleChangeVideos(e, number)}
          />
        </Button>
      </Stack>
    );
  };

  const messageLayout = (number, valueDefault = "") => {
    return (
      <Stack
        className={`${classes.elementCard} stackMessage${number}`}
        key={`stackMessage${number}`}
      >
        {renderCardHeader("message", number)}

        <TextField
          label={i18n.t("schedules.table.body")}
          defaultValue={valueDefault}
          multiline
          rows={7}
          className={`message${number}`}
          name="text"
          variant="outlined"
          margin="dense"
          style={{ width: "100%" }}
        />
      </Stack>
    );
  };

  const intervalLayout = (number, valueDefault = 0) => {
    return (
      <Stack
        className={`${classes.elementCard} stackInterval${number}`}
        key={`stackInterval${number}`}
      >
        {renderCardHeader("interval", number)}

        <TextField
          label={i18n.t("automation.content.timeSeconds")}
          className={`interval${number}`}
          defaultValue={valueDefault}
          type="number"
          InputProps={{ inputProps: { min: 0, max: 120 } }}
          variant="outlined"
          margin="dense"
          style={{ width: "100%" }}
        />
      </Stack>
    );
  };

  const documentLayout = (number, valueDefault = "") => {
    const preview = getPreviewDocument(number);
    const src = preview?.url || (valueDefault ? getBackendFlowFileUrl(valueDefault) : "");
    const isPdf =
      preview?.type === "application/pdf" ||
      isPdfFileName(preview?.name || valueDefault);

    return (
      <Stack
        className={`${classes.elementCard} stackDocument${number}`}
        key={`stackDocument${number}`}
      >
        {renderCardHeader("document", number)}

        <div className={classes.mediaPreviewWrap}>
          <div
            className={`document${number}`}
            style={{
              display: "flex",
              flexDirection: "row",
              justifyContent: "center",
              width: "100%",
            }}
          >
            {src ? (
              isPdf ? (
                <embed
                  src={src}
                  type="application/pdf"
                  width="220px"
                  height="220px"
                  style={{ borderRadius: "12px" }}
                />
              ) : (
                <a
                  href={src}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontWeight: 600 }}
                >
                  {i18n.t("automation.content.viewDocument")}
                </a>
              )
            ) : null}
          </div>
        </div>

        <Button
          variant="contained"
          color="primary"
          component="label"
          className={`${classes.uploadButton} btnDocument${number}`}
        >
          {src ? i18n.t("automation.content.changeDocument") : i18n.t("automation.content.sendDocument")}
          <input
            type="file"
            accept=".doc,.docx,.pdf,.xls,.xlsx,.txt,.csv,.ppt,.pptx"
            hidden
            onChange={(e) => handleChangeDocuments(e, number)}
          />
        </Button>
      </Stack>
    );
  };

  const renderElementById = (elementId) => {
    const type = getElementTypeFromId(elementId);

    if (!type) return null;

    const number = extractElementNumber(elementId, type);
    const editedElement = getExistingEditedElement(elementId);

    if (type === "message") {
      return messageLayout(number, editedElement?.value || "");
    }

    if (type === "interval") {
      return intervalLayout(number, editedElement?.value || 0);
    }

    if (type === "img") {
      return imgLayout(
        number,
        editedElement?.value || "",
        editedElement?.caption || ""
      );
    }

    if (type === "audio") {
      return audioLayout(
        number,
        editedElement?.value || "",
        editedElement?.record ? "" : "ok"
      );
    }

    if (type === "video") {
      return videoLayout(number, editedElement?.value || "");
    }

    if (type === "document") {
      return documentLayout(number, editedElement?.value || "");
    }

    return null;
  };

  useEffect(() => {
    const localVariables = localStorage.getItem("variables");
    if (localVariables) {
      setVariables(JSON.parse(localVariables));
    }

    if (open === "edit") {
      setLabels({
        title: i18n.t("automation.content.edit"),
        btn: i18n.t("automation.common.save"),
      });

      resetModalState();

      const seq = data?.data?.seq || [];
      const elementsLoc = data?.data?.elements || [];

      setElementsSeq(seq);
      setElementsSeqEdit(seq);
      setElementsEdit(elementsLoc);
      hydrateCountersFromSequence(seq);

      setActiveModal(true);
    }

    if (open === "create") {
      setLabels({
        title: i18n.t("automation.content.addToFlow"),
        btn: i18n.t("automation.common.add"),
      });

      resetModalState();
      setActiveModal(true);
    }
  }, [open, data]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleClose = async () => {
    close(null);
    setActiveModal(false);
    setTimeout(() => {
      resetModalState();
    }, 500);
  };

  const verifyButtonsUpload = () => {
    const newArrImg = elementsSeq.filter((item) => item.includes("img"));
    const newArrAudio = elementsSeq.filter((item) => item.includes("audio"));
    const newArrVideo = elementsSeq.filter((item) => item.includes("video"));
    const newArrDocs = elementsSeq.filter((item) => item.includes("document"));

    for (let i = 0; i < newArrImg.length; i++) {
      if (!hasMediaForElement(newArrImg[i], "img")) {
        return true;
      }
    }

    for (let i = 0; i < newArrAudio.length; i++) {
      if (!hasMediaForElement(newArrAudio[i], "audio")) {
        return true;
      }
    }

    for (let i = 0; i < newArrVideo.length; i++) {
      if (!hasMediaForElement(newArrVideo[i], "video")) {
        return true;
      }
    }

    for (let i = 0; i < newArrDocs.length; i++) {
      if (!hasMediaForElement(newArrDocs[i], "document")) {
        return true;
      }
    }

    return false;
  };

  const handleSaveNode = async () => {
    if (open === "edit") {
      setLoading(true);
      const formData = new FormData();

      medias.forEach(async (media, idx) => {
        const file = media;

        if (!file) {
          return;
        }

        if (media?.type.split("/")[0] === "image") {
          formData.append("typeArch", "flow");
          formData.append("medias", file);
          formData.append("body", file.name);
        } else if (media?.type.split("/")[0] === "audio") {
          formData.append("typeArch", "flow");
          formData.append("medias", file);
          formData.append("body", file.name);
        } else if (media?.type.split("/")[0] === "video") {
          formData.append("typeArch", "flow");
          formData.append("medias", file);
          formData.append("body", file.name);
        } else if (
          media?.type.split("/")[0] === "application" ||
          media?.type.split("/")[1] === "document" ||
          media?.type.split("/")[1] === "pdf"
        ) {
          formData.append("typeArch", "flow");
          formData.append("medias", file);
          formData.append("body", file.name);
        } else {
          formData.append("typeArch", "flow");
          formData.append("medias", file);
          formData.append("body", file.name);
        }
      });

      setTimeout(async () => {
        if (
          (numberAudio === 0 &&
            numberVideo === 0 &&
            numberImg === 0 &&
            numberDocs === 0) ||
          medias.length === 0
        ) {
          try {
            const nextElements = handleElements(null);

            const mountData = {
              ...(data?.data || {}),
              seq: [...elementsSeq],
              elements: nextElements,
            };

            onUpdate({
              ...data,
              data: mountData,
            });
            toast.success("Conteúdo adicionado com sucesso!");
            handleClose();
            setLoading(false);

            return;
          } catch (e) {
            setLoading(false);
            handleClose();
          }
          return;
        }

        const verify = verifyButtonsUpload();
        if (verify) {
          setLoading(false);
          return toast.error(
            "Envie os arquivos faltantes ou delete os cards vazios (Imagem, Áudio, Vídeo e Documento)"
          );
        }

        await api
          .post("/flowbuilder/content", formData)
          .then(async (res) => {
            const nextElements = handleElements(res.data);
            const mountData = {
              ...(data?.data || {}),
              seq: [...elementsSeq],
              elements: nextElements,
            };
            onUpdate({
              ...data,
              data: mountData,
            });
            toast.success("Conteúdo adicionado com sucesso!");
            handleClose();
            setLoading(false);
          })
          .catch((error) => {
            toastError(error);
            handleClose();
            setLoading(false);
          });
      }, 1500);
    } else if (open === "create") {
      setLoading(true);
      const formData = new FormData();

      medias.forEach(async (media, idx) => {
        const file = media;

        if (!file) {
          return;
        }

        if (media?.type.split("/")[0] === "image") {
          formData.append("typeArch", "flow");
          formData.append("medias", media);
          formData.append("body", media.name);
        } else if (media?.type.split("/")[0] === "audio") {
          formData.append("typeArch", "flow");
          formData.append("medias", media);
          formData.append("body", media.name);
        } else if (media?.type.split("/")[0] === "video") {
          formData.append("typeArch", "flow");
          formData.append("medias", media);
          formData.append("body", media.name);
        } else if (
          media?.type.split("/")[0] === "application" ||
          media?.type.split("/")[1] === "document" ||
          media?.type.split("/")[1] === "pdf"
        ) {
          formData.append("typeArch", "flow");
          formData.append("medias", media);
          formData.append("body", media.name);
        } else {
          formData.append("typeArch", "flow");
          formData.append("medias", media);
          formData.append("body", media.name);
        }
      });

      setTimeout(async () => {
        if (
          numberAudio === 0 &&
          numberVideo === 0 &&
          numberImg === 0 &&
          numberDocs === 0
        ) {
          try {
            const nextElements = handleElements(null);

            const mountData = {
              seq: [...elementsSeq],
              elements: nextElements,
            };
            onSave({
              ...mountData,
            });
            toast.success("Conteúdo adicionado com sucesso!");
            handleClose();
            setLoading(false);

            return;
          } catch (e) {
            setLoading(false);
            handleClose();
          }
        }

        const verify = verifyButtonsUpload();
        if (verify) {
          setLoading(false);
          return toast.error(
            "Envie os arquivos faltantes ou delete os cards vazios (Imagem, Áudio, Vídeo e Documento)"
          );
        }

        await api
          .post("/flowbuilder/content", formData)
          .then((res) => {
            const nextElements = handleElements(res.data);
            const mountData = {
              seq: [...elementsSeq],
              elements: nextElements,
            };
            onSave({
              ...mountData,
            });;
            toast.success("Conteúdo adicionado com sucesso!");
            handleClose();
            setLoading(false);
          })
          .catch((error) => {
            toastError(error);
            setLoading(false);
            handleClose();
          });
      }, 1500);
    }
  };

  const scrollToBottom = (className) => {
    const element = document.querySelector(className);
    if (element) {
      element.scrollTop = element.scrollHeight;
    }
  };

  const variableFormatter = (item) => {
    return "{{" + item + "}}";
  };

  return (
    <div>
      <Dialog
        open={activeModal}
        fullWidth
        maxWidth="lg"
        scroll="paper"
        classes={{ paper: classes.dialogPaper }}
      >
        {!loading && (
          <DialogTitle id="form-dialog-title" className={classes.dialogTitle}>
            <Typography className={classes.titleText}>{labels.title}</Typography>
          </DialogTitle>
        )}

        <Stack>
          <Stack
            className={`body-card ${classes.bodyCard}`}
            style={{
              display: loading ? "none" : undefined,
            }}
          >
            {elementsSeq.map((elementId) => {
              return (
                <div
                  key={elementId}
                  draggable
                  onDragStart={(event) => handleDragStart(event, elementId)}
                  onDragOver={(event) => handleDragOver(event, elementId)}
                  onDrop={(event) => handleDrop(event, elementId)}
                  onDragEnd={handleDragEnd}
                  className={`${classes.dragWrapper} ${draggedElementId === elementId
                    ? classes.dragWrapperDragging
                    : ""
                    } ${dragOverElementId === elementId
                      ? classes.dragWrapperOver
                      : ""
                    }`}
                >
                  {renderElementById(elementId)}
                </div>
              );
            })}

            <div className={classes.toolbarWrap}>
              <Button
                className={classes.actionButton}
                onClick={() => {
                  const nextNumber = numberMessagesLast;
                  setElementsSeq((oldEleme) => [
                    ...oldEleme,
                    `message${nextNumber}`,
                  ]);
                  setNumberMessages((old) => old + 1);
                  setNumberMessagesLast((old) => old + 1);
                  setTimeout(() => {
                    scrollToBottom(".body-card");
                  }, 100);
                }}
              >
                <Message
                  sx={{
                    width: "16px",
                    height: "16px",
                    marginRight: "6px",
                  }}
                />
                {i18n.t("queueModal.bot.text")}
              </Button>

              <Button
                className={classes.actionButton}
                onClick={() => {
                  const nextNumber = numberIntervalLast;
                  setElementsSeq((oldEleme) => [
                    ...oldEleme,
                    `interval${nextNumber}`,
                  ]);
                  setNumberInterval((old) => old + 1);
                  setNumberIntervalLast((old) => old + 1);
                  setTimeout(() => {
                    scrollToBottom(".body-card");
                  }, 100);
                }}
              >
                <AccessTime
                  sx={{
                    width: "16px",
                    height: "16px",
                    marginRight: "6px",
                  }}
                />
                {i18n.t("recurrenceSection.labelInterval")}
              </Button>

              <Button
                className={classes.actionButton}
                onClick={() => {
                  const nextNumber = numberImgLast;
                  setElementsSeq((oldEleme) => [...oldEleme, `img${nextNumber}`]);
                  setNumberImg((old) => old + 1);
                  setNumberImgLast((old) => old + 1);
                  setTimeout(() => {
                    scrollToBottom(".body-card");
                  }, 100);
                }}
              >
                <Image
                  sx={{
                    width: "16px",
                    height: "16px",
                    marginRight: "6px",
                  }}
                />
                {i18n.t("automation.content.image")}
              </Button>

              <Button
                className={classes.actionButton}
                onClick={() => {
                  const nextNumber = numberAudioLast;
                  setElementsSeq((oldEleme) => [
                    ...oldEleme,
                    `audio${nextNumber}`,
                  ]);
                  setNumberAudio((old) => old + 1);
                  setNumberAudioLast((old) => old + 1);
                  setTimeout(() => {
                    scrollToBottom(".body-card");
                  }, 100);
                }}
              >
                <MicNone
                  sx={{
                    width: "16px",
                    height: "16px",
                    marginRight: "6px",
                  }}
                />
                {i18n.t("automation.content.audio")}
              </Button>

              <Button
                className={classes.actionButton}
                onClick={() => {
                  const nextNumber = numberVideoLast;
                  setElementsSeq((oldEleme) => [
                    ...oldEleme,
                    `video${nextNumber}`,
                  ]);
                  setNumberVideo((old) => old + 1);
                  setNumberVideoLast((old) => old + 1);
                  setTimeout(() => {
                    scrollToBottom(".body-card");
                  }, 100);
                }}
              >
                <Videocam
                  sx={{
                    width: "16px",
                    height: "16px",
                    marginRight: "6px",
                  }}
                />
                {i18n.t("automation.content.video")}
              </Button>

              <Button
                className={classes.actionButton}
                onClick={() => {
                  const nextNumber = numberDocLast;
                  setElementsSeq((oldEleme) => [
                    ...oldEleme,
                    `document${nextNumber}`,
                  ]);
                  setNumberDocs((old) => old + 1);
                  setNumberDocLast((old) => old + 1);
                  setTimeout(() => {
                    scrollToBottom(".body-card");
                  }, 100);
                }}
              >
                <InsertDriveFile
                  sx={{
                    width: "16px",
                    height: "16px",
                    marginRight: "6px",
                  }}
                />
                {i18n.t("automation.content.document")}
              </Button>
            </div>

            <div className={classes.variableBox}>
              <div className={classes.variableHeader}>{i18n.t("automation.content.variables")}</div>

              {variables && (
                <div className={classes.variableList}>
                  {variables.map((item, index) => (
                    <div key={index} className={classes.variableItem}>
                      {variableFormatter(item)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Stack>

          <DialogActions className={classes.dialogActions}>
            <Button
              onClick={handleClose}
              color="secondary"
              variant="outlined"
              className={classes.cancelButton}
              style={{ display: loading ? "none" : undefined }}
            >
              {i18n.t("contactModal.buttons.cancel")}
            </Button>
            <Button
              type="submit"
              color="primary"
              variant="contained"
              onClick={() => handleSaveNode()}
              className={classes.saveButton}
              style={{ display: loading ? "none" : undefined }}
            >
              {`${labels.btn}`}
            </Button>
          </DialogActions>
        </Stack>

        {loading && (
          <Stack className={classes.loadingWrap}>
            <div className={classes.loadingCard}>
              <Typography style={{ fontWeight: 600, marginBottom: 16 }}>
                Subindo os arquivos e criando o conteúdo...
              </Typography>
              <Stack style={{ alignSelf: "center", marginTop: "12px" }}>
                <CircularProgress />
              </Stack>
            </div>
          </Stack>
        )}
      </Dialog>
    </div>
  );
};

export default FlowBuilderSingleBlockModal;
