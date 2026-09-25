import React, {
  useState,
  useEffect,
  useCallback
} from "react";
import { SiOpenai } from "react-icons/si";
import { toast } from "react-toastify";
import "./mobile-styles.css";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import {
  Paper,
  Button,
  IconButton,
  List,
  ListItem,
  Typography,
  Box,
  Grid,
  Collapse,
  useMediaQuery,
  Fab,
  Slide,
  ClickAwayListener
} from "@material-ui/core";
import {
  Close as CloseIcon,
  Add as AddIcon,
  ExpandLess,
  ExpandMore,
  Save as SaveIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  ChevronLeft,
  ChevronRight
} from "@material-ui/icons";
import WebAssetIcon from "@material-ui/icons/WebAsset";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import api from "../../services/api";
import toastError from "../../errors/toastError";

import HttpIcon from "@mui/icons-material/Http";
import DataObjectIcon from "@mui/icons-material/DataObject";
import QuestionAnswerIcon from "@mui/icons-material/QuestionAnswer";
import CompareArrows from "@mui/icons-material/CompareArrows";

import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow
} from "react-flow-renderer";

import {
  AccessTime,
  CallSplit,
  DynamicFeed,
  LibraryBooks,
  Message,
  RocketLaunch,
  Tag,
  Queue,
  Person,
  SmartButton
} from "@mui/icons-material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

// Import dos nós (mantendo os mesmos)
import messageNode from "./nodes/messageNode.js";
import startNode from "./nodes/startNode";
import openaiNode from "./nodes/openaiNode";
import geminiNode from "./nodes/geminiNode";
import menuNode from "./nodes/menuNode";
import interactiveNode from "./nodes/interactiveNode";
import intervalNode from "./nodes/intervalNode";
import imgNode from "./nodes/imgNode";
import randomizerNode from "./nodes/randomizerNode";
import videoNode from "./nodes/videoNode";
import switchFlowNode from "./nodes/switchFlowNode";
import attendantNode from "./nodes/attendantNode";
import RemoveEdge from "./nodes/removeEdge";
import audioNode from "./nodes/audioNode";
import { useNodeStorage } from "../../stores/useNodeStorage";
import singleBlockNode from "./nodes/singleBlockNode";
import ticketNode from "./nodes/ticketNode";
import tagNode from "./nodes/tagNode";
import conditionCompareNode from "./nodes/conditionCompareNode";
import HttpRequestNode from "./nodes/httpRequestNode";
import removeTagNode from "./nodes/removeTagNode";
import VariableNode, {
  getFlowVariable,
  setFlowVariable
} from "./nodes/variableNode";
import inputNode from "./nodes/inputNode";
import typebotNode from "./nodes/typebotNode";
import asaasNode from "./nodes/asaasNode";

// Imports dos modais (mantendo os mesmos)
import FlowBuilderAddImgModal from "../../components/FlowBuilderAddImgModal";
import FlowBuilderTicketModal from "../../components/FlowBuilderAddTicketModal";
import FlowBuilderAddAudioModal from "../../components/FlowBuilderAddAudioModal";
import FlowBuilderAddTagModal from "../../components/FlowBuilderAddTagModal";
import FlowBuilderRandomizerModal from "../../components/FlowBuilderRandomizerModal";
import FlowBuilderAddVideoModal from "../../components/FlowBuilderAddVideoModal";
import FlowBuilderSingleBlockModal from "../../components/FlowBuilderSingleBlockModal";
import FlowBuilderAddTextModal from "../../components/FlowBuilderAddTextModal";
import FlowBuilderIntervalModal from "../../components/FlowBuilderIntervalModal";
import FlowBuilderMenuModal from "../../components/FlowBuilderMenuModal";
import FlowBuilderInteractiveModal from "../../components/FlowBuilderInteractiveModal";
import FlowBuilderAddSwitchFlowModal from "../../components/FlowBuilderAddSwitchFlowModal";
import FlowBuilderAddAttendantModal from "../../components/FlowBuilderAddAttendantModal";
import FlowBuilderInputModal from "../../components/FlowBuilderInputModal";
import FlowBuilderConditionCompareModal from "../../components/FlowBuilderConditionCompareModal";
import FlowBuilderRemoveTagModal from "../../components/FlowBuilderRemoveTagModal";
import FlowBuilderOpenAIModal from "../../components/FlowBuilderAddOpenAIModal";
import FlowBuilderGeminiModal from "../../components/FlowBuilderGeminiModal";
import { useParams } from "react-router-dom/cjs/react-router-dom.min";
import {
  CircularProgress,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch
} from "@material-ui/core";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles(theme => ({
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    overflow: "hidden",
    background:
      theme.palette.type === "dark"
        ? "linear-gradient(180deg, #0b1220 0%, #101826 100%)"
        : "linear-gradient(180deg, #f8fafc 0%, #eef3f8 100%)"
  },

  header: {
    flexShrink: 0,
    background:
      theme.palette.type === "dark"
        ? "rgba(15, 23, 42, 0.86)"
        : "rgba(255, 255, 255, 0.82)",
    borderBottom: `1px solid ${theme.palette.type === "dark"
      ? "rgba(255,255,255,0.06)"
      : "rgba(15,23,42,0.08)"
      }`,
    backdropFilter: "blur(14px)",
    boxShadow:
      theme.palette.type === "dark"
        ? "0 8px 30px rgba(0,0,0,0.18)"
        : "0 8px 30px rgba(15,23,42,0.06)",
    zIndex: 20
  },

  content: {
    flex: 1,
    display: "flex",
    position: "relative",
    overflow: "hidden",
    minWidth: 0,
    minHeight: 0
  },

  sidebar: {
    width: props => (props.sidebarOpen ? 310 : 72),
    background:
      theme.palette.type === "dark"
        ? "rgba(15, 23, 42, 0.78)"
        : "rgba(255, 255, 255, 0.76)",
    borderRight: `1px solid ${theme.palette.type === "dark"
      ? "rgba(255,255,255,0.06)"
      : "rgba(15,23,42,0.08)"
      }`,
    backdropFilter: "blur(16px)",
    transition: "width 0.28s ease",
    display: "flex",
    flexDirection: "column",
    zIndex: 12,
    flexShrink: 0,
    minHeight: 0,
    boxShadow:
      theme.palette.type === "dark"
        ? "8px 0 30px rgba(0,0,0,0.18)"
        : "8px 0 30px rgba(15,23,42,0.05)",
    [theme.breakpoints.down("md")]: {
      display: "none"
    }
  },

  sidebarHeader: {
    padding: theme.spacing(1.2, 1.2),
    borderBottom: `1px solid ${theme.palette.type === "dark"
      ? "rgba(255,255,255,0.06)"
      : "rgba(15,23,42,0.08)"
      }`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 64,
    background:
      theme.palette.type === "dark"
        ? "rgba(15, 23, 42, 0.68)"
        : "rgba(255, 255, 255, 0.64)"
  },

  sidebarContent: {
    flex: 1,
    overflowY: "auto",
    padding: theme.spacing(1),
    ...(theme.scrollbarStyles || {})
  },

  flowContainer: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
    minWidth: 0,
    minHeight: 0,
    width: "100%",
    height: "100%",
    background:
      theme.palette.type === "dark"
        ? "radial-gradient(circle at top left, rgba(59,130,246,0.10), transparent 26%), radial-gradient(circle at 86% 14%, rgba(16,185,129,0.09), transparent 22%), linear-gradient(180deg, #0b1220 0%, #111827 100%)"
        : "radial-gradient(circle at top left, rgba(59,130,246,0.09), transparent 24%), radial-gradient(circle at 86% 14%, rgba(16,185,129,0.08), transparent 20%), linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)",

    "& .react-flow": {
      background: "transparent"
    },

    "& .react-flow__renderer": {
      background: "transparent"
    },

    "& .react-flow__pane": {
      background: "transparent"
    },

    "& .react-flow__controls": {
      zIndex: 1100,
      bottom: theme.spacing(2),
      left: theme.spacing(2),
      background:
        theme.palette.type === "dark"
          ? "rgba(15,23,42,0.78)"
          : "rgba(255,255,255,0.82)",
      border: `1px solid ${theme.palette.type === "dark"
        ? "rgba(255,255,255,0.07)"
        : "rgba(15,23,42,0.08)"
        }`,
      borderRadius: 16,
      overflow: "hidden",
      backdropFilter: "blur(10px)",
      boxShadow:
        theme.palette.type === "dark"
          ? "0 12px 30px rgba(0,0,0,0.20)"
          : "0 12px 30px rgba(15,23,42,0.08)",
      [theme.breakpoints.down("md")]: {
        display: "none"
      }
    },

    "& .react-flow__controls button": {
      background: "transparent",
      color: theme.palette.text.primary,
      borderBottom: `1px solid ${theme.palette.type === "dark"
        ? "rgba(255,255,255,0.06)"
        : "rgba(15,23,42,0.06)"
        }`
    },

    "& .react-flow__controls button:hover": {
      background:
        theme.palette.type === "dark"
          ? "rgba(255,255,255,0.06)"
          : "rgba(15,23,42,0.05)"
    },

    "& .react-flow__minimap": {
      background:
        theme.palette.type === "dark"
          ? "rgba(15,23,42,0.76)"
          : "rgba(255,255,255,0.84)",
      border: `1px solid ${theme.palette.type === "dark"
        ? "rgba(255,255,255,0.07)"
        : "rgba(15,23,42,0.08)"
        }`,
      borderRadius: 18,
      overflow: "hidden",
      backdropFilter: "blur(10px)",
      boxShadow:
        theme.palette.type === "dark"
          ? "0 12px 30px rgba(0,0,0,0.18)"
          : "0 12px 30px rgba(15,23,42,0.08)"
    },

    "& .react-flow__attribution": {
      display: "none"
    }
  },

  bottomSheet: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    background:
      theme.palette.type === "dark"
        ? "rgba(15, 23, 42, 0.94)"
        : "rgba(255, 255, 255, 0.96)",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    boxShadow:
      theme.palette.type === "dark"
        ? "0 -12px 40px rgba(0,0,0,0.28)"
        : "0 -12px 40px rgba(15,23,42,0.10)",
    zIndex: 1500,
    maxHeight: "80vh",
    display: "flex",
    flexDirection: "column",
    border: `1px solid ${theme.palette.type === "dark"
      ? "rgba(255,255,255,0.06)"
      : "rgba(15,23,42,0.08)"
      }`,
    backdropFilter: "blur(16px)",
    [theme.breakpoints.up("lg")]: {
      display: "none"
    }
  },

  bottomSheetHandle: {
    width: 44,
    height: 5,
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.18)"
        : "rgba(15,23,42,0.14)",
    borderRadius: 999,
    margin: "10px auto 6px auto",
    cursor: "pointer"
  },

  bottomSheetHeader: {
    padding: theme.spacing(1, 2),
    borderBottom: `1px solid ${theme.palette.type === "dark"
      ? "rgba(255,255,255,0.06)"
      : "rgba(15,23,42,0.08)"
      }`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between"
  },

  bottomSheetContent: {
    flex: 1,
    overflowY: "auto",
    padding: theme.spacing(1.5),
    ...(theme.scrollbarStyles || {})
  },

  fab: {
    position: "fixed",
    top: 62,
    right: theme.spacing(2),
    zIndex: 1400,
    background:
      "linear-gradient(135deg, " +
      theme.palette.primary.main +
      " 0%, " +
      theme.palette.primary.dark +
      " 100%)",
    color: theme.palette.primary.contrastText,
    boxShadow: "0 14px 30px rgba(0,0,0,0.18)",
    "&:hover": {
      transform: "translateY(-1px)",
      boxShadow: "0 18px 34px rgba(0,0,0,0.24)",
      background:
        "linear-gradient(135deg, " +
        theme.palette.primary.main +
        " 0%, " +
        theme.palette.primary.dark +
        " 100%)"
    },
    [theme.breakpoints.down("md")]: {
      bottom: theme.spacing(9),
      top: "auto"
    }
  },

  addFab: {
    position: "fixed",
    bottom: theme.spacing(2),
    left: theme.spacing(2),
    zIndex: 1400,
    background:
      "linear-gradient(135deg, " +
      theme.palette.secondary.main +
      " 0%, " +
      theme.palette.secondary.dark +
      " 100%)",
    color: theme.palette.secondary.contrastText,
    boxShadow: "0 14px 30px rgba(0,0,0,0.18)",
    "&:hover": {
      transform: "translateY(-1px)",
      boxShadow: "0 18px 34px rgba(0,0,0,0.24)",
      background:
        "linear-gradient(135deg, " +
        theme.palette.secondary.main +
        " 0%, " +
        theme.palette.secondary.dark +
        " 100%)"
    },
    [theme.breakpoints.up("lg")]: {
      display: "none"
    }
  },

  nodeButton: {
    justifyContent: "flex-start",
    textTransform: "none",
    padding: theme.spacing(1.2),
    marginBottom: theme.spacing(0.7),
    borderRadius: 14,
    transition: "all 0.18s ease",
    color: theme.palette.text.primary,
    background:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.03)"
        : "rgba(255,255,255,0.55)",
    border: `1px solid ${theme.palette.type === "dark"
      ? "rgba(255,255,255,0.05)"
      : "rgba(15,23,42,0.06)"
      }`,
    "&:hover": {
      background:
        theme.palette.type === "dark"
          ? "rgba(255,255,255,0.06)"
          : "rgba(255,255,255,0.85)",
      transform: "translateX(4px)",
      boxShadow:
        theme.palette.type === "dark"
          ? "0 10px 24px rgba(0,0,0,0.16)"
          : "0 10px 24px rgba(15,23,42,0.08)"
    }
  },

  collapsedNodeButton: {
    width: 50,
    height: 50,
    minWidth: 50,
    padding: 0,
    margin: theme.spacing(0.6, 0.5),
    justifyContent: "center",
    color: theme.palette.text.primary,
    borderRadius: 14,
    background:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.03)"
        : "rgba(255,255,255,0.70)",
    border: `1px solid ${theme.palette.type === "dark"
      ? "rgba(255,255,255,0.05)"
      : "rgba(15,23,42,0.06)"
      }`,
    "&:hover": {
      background:
        theme.palette.type === "dark"
          ? "rgba(255,255,255,0.06)"
          : "rgba(255,255,255,0.94)",
      boxShadow:
        theme.palette.type === "dark"
          ? "0 10px 24px rgba(0,0,0,0.14)"
          : "0 10px 24px rgba(15,23,42,0.08)"
    }
  },

  categoryHeader: {
    padding: theme.spacing(1.1, 1.2),
    background:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.03)"
        : "rgba(255,255,255,0.64)",
    fontWeight: "bold",
    color: theme.palette.text.primary,
    cursor: "pointer",
    userSelect: "none",
    borderRadius: 14,
    marginBottom: theme.spacing(0.7),
    border: `1px solid ${theme.palette.type === "dark"
      ? "rgba(255,255,255,0.04)"
      : "rgba(15,23,42,0.05)"
      }`,
    "&:hover": {
      background:
        theme.palette.type === "dark"
          ? "rgba(255,255,255,0.05)"
          : "rgba(255,255,255,0.90)"
    }
  },

  quickActions: {
    position: "fixed",
    top: 128,
    right: theme.spacing(2),
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1),
    zIndex: 1200,
    [theme.breakpoints.down("md")]: {
      display: "none"
    }
  },

  quickActionButton: {
    background:
      theme.palette.type === "dark"
        ? "rgba(15, 23, 42, 0.76)"
        : "rgba(255, 255, 255, 0.82)",
    backdropFilter: "blur(10px)",
    boxShadow:
      theme.palette.type === "dark"
        ? "0 12px 24px rgba(0,0,0,0.16)"
        : "0 12px 24px rgba(15,23,42,0.08)",
    color: theme.palette.text.primary,
    border: `1px solid ${theme.palette.type === "dark"
      ? "rgba(255,255,255,0.07)"
      : "rgba(15,23,42,0.08)"
      }`,
    width: 50,
    height: 50,
    "&:hover": {
      background:
        theme.palette.type === "dark"
          ? "rgba(15, 23, 42, 0.92)"
          : "rgba(255,255,255,0.96)",
      transform: "scale(1.05)",
      boxShadow:
        theme.palette.type === "dark"
          ? "0 16px 28px rgba(0,0,0,0.18)"
          : "0 16px 28px rgba(15,23,42,0.10)"
    }
  },

  mobileControls: {
    position: "fixed",
    bottom: 84,
    left: theme.spacing(2),
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1),
    zIndex: 1300,
    [theme.breakpoints.up("lg")]: {
      display: "none"
    }
  },

  controlButton: {
    background:
      theme.palette.type === "dark"
        ? "rgba(15, 23, 42, 0.80)"
        : "rgba(255, 255, 255, 0.84)",
    backdropFilter: "blur(10px)",
    boxShadow:
      theme.palette.type === "dark"
        ? "0 12px 24px rgba(0,0,0,0.16)"
        : "0 12px 24px rgba(15,23,42,0.08)",
    width: 48,
    height: 48,
    color: theme.palette.text.primary,
    border: `1px solid ${theme.palette.type === "dark"
      ? "rgba(255,255,255,0.07)"
      : "rgba(15,23,42,0.08)"
      }`,
    "&:hover": {
      background:
        theme.palette.type === "dark"
          ? "rgba(15, 23, 42, 0.92)"
          : "rgba(255,255,255,0.96)",
      transform: "scale(1.05)"
    }
  },

  categoryCard: {
    background:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.03)"
        : "rgba(255,255,255,0.78)",
    borderRadius: 18,
    border: `1px solid ${theme.palette.type === "dark"
      ? "rgba(255,255,255,0.06)"
      : "rgba(15,23,42,0.08)"
      }`,
    boxShadow:
      theme.palette.type === "dark"
        ? "0 10px 24px rgba(0,0,0,0.14)"
        : "0 10px 24px rgba(15,23,42,0.06)",
    backdropFilter: "blur(10px)"
  },

  categoryTitle: {
    fontWeight: "bold",
    marginBottom: theme.spacing(1),
    display: "flex",
    alignItems: "center",
    color: theme.palette.text.primary
  },

  categoryNodeBtn: {
    width: "100%",
    marginBottom: theme.spacing(0.8),
    justifyContent: "flex-start",
    textTransform: "none",
    fontSize: "0.82rem",
    padding: theme.spacing(1, 1.4),
    color: theme.palette.text.primary,
    borderRadius: 12,
    borderColor:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.06)"
        : "rgba(15,23,42,0.08)",
    "&:hover": {
      background:
        theme.palette.type === "dark"
          ? "rgba(255,255,255,0.05)"
          : "rgba(255,255,255,0.92)"
    }
  },

  loadingContainer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "70vh"
  }
}));

const nodeCategories = [
  {
    name: i18n.t("automation.editor.categories.basic"),
    color: theme => theme.palette.primary.main,
    icon: <RocketLaunch />,
    nodes: [
      {
        icon: <RocketLaunch />,
        name: i18n.t("automation.editor.nodes.start"),
        type: "start",
        description: i18n.t("automation.editor.nodes.startHelp")
      }
    ]
  },
  {
    name: i18n.t("automation.editor.categories.content"),
    color: theme => theme.palette.success.main,
    icon: <LibraryBooks />,
    nodes: [
      {
        icon: <LibraryBooks />,
        name: i18n.t("automation.editor.nodes.content"),
        type: "content",
        description: i18n.t("automation.editor.nodes.contentHelp")
      },
      {
        icon: <Message />,
        name: i18n.t("automation.editor.nodes.text"),
        type: "text",
        description: i18n.t("automation.editor.nodes.textHelp")
      }
    ]
  },
  {
    name: i18n.t("automation.editor.categories.interaction"),
    color: theme => theme.palette.warning.main,
    icon: <DynamicFeed />,
    nodes: [
      {
        icon: <DynamicFeed />,
        name: "Menu",
        type: "menu",
        description: i18n.t("automation.editor.nodes.menuHelp")
      },
      {
        icon: <SmartButton />,
        name: i18n.t("automation.editor.nodes.interactive"),
        type: "interactiveMenu",
        description: i18n.t("automation.editor.nodes.interactiveHelp")
      },
      {
        icon: <QuestionAnswerIcon />,
        name: "Input",
        type: "input",
        description: i18n.t("automation.editor.nodes.inputHelp")
      },
      {
        icon: <AccessTime />,
        name: i18n.t("automation.editor.nodes.interval"),
        type: "interval",
        description: i18n.t("automation.editor.nodes.intervalHelp")
      }
    ]
  },
  {
    name: i18n.t("automation.editor.categories.logic"),
    color: theme => theme.palette.secondary.main,
    icon: <CallSplit />,
    nodes: [
      {
        icon: <CallSplit />,
        name: i18n.t("automation.editor.nodes.randomizer"),
        type: "random",
        description: i18n.t("automation.editor.nodes.randomizerHelp")
      },
      {
        icon: <CompareArrows />,
        name: i18n.t("automation.editor.nodes.condition"),
        type: "conditionCompare",
        description: i18n.t("automation.editor.nodes.conditionHelp")
      }
    ]
  },
  {
    name: i18n.t("automation.editor.categories.system"),
    color: theme => theme.palette.info.main,
    icon: <Queue />,
    nodes: [
      {
        icon: <Queue />,
        name: i18n.t("automation.editor.nodes.queues"),
        type: "ticket",
        description: i18n.t("automation.editor.nodes.queuesHelp")
      },
      {
        icon: <Tag />,
        name: "Tags",
        type: "tag",
        description: i18n.t("automation.editor.nodes.tagsHelp")
      },
      {
        icon: <Tag />,
        name: i18n.t("automation.editor.nodes.removeTag"),
        type: "removeTag",
        description: i18n.t("automation.editor.nodes.removeTagHelp")
      },
      {
        icon: <ArrowForwardIcon />,
        name: i18n.t("automation.editor.nodes.switchFlow"),
        type: "switchFlow",
        description: i18n.t("automation.editor.nodes.switchFlowHelp")
      },
      {
        icon: <Person />,
        name: i18n.t("automation.editor.nodes.agent"),
        type: "attendant",
        description: i18n.t("automation.editor.nodes.agentHelp")
      }
    ]
  },
  {
    name: i18n.t("automation.editor.categories.integrations"),
    color: theme => theme.palette.error.main,
    icon: <HttpIcon />,
    nodes: [
      {
        icon: <HttpIcon />,
        name: "HTTP Request",
        type: "httpRequest",
        description: i18n.t("automation.editor.nodes.httpHelp")
      },
      {
        icon: <DataObjectIcon />,
        name: i18n.t("automation.editor.nodes.variable"),
        type: "variable",
        description: i18n.t("automation.editor.nodes.variableHelp")
      },
      {
        icon: <QuestionAnswerIcon />,
        name: "Typebot",
        type: "typebot",
        description: i18n.t("automation.editor.nodes.typebotHelp")
      },
      {
        icon: <SiOpenai />,
        name: "Gemini",
        type: "gemini",
        description: i18n.t("automation.editor.nodes.geminiHelp")
      },
      {
        icon: <SiOpenai />,
        name: "OpenAI",
        type: "openai",
        description: i18n.t("automation.editor.nodes.openaiHelp")
      },
      {
        icon: <QuestionAnswerIcon />,
        name: "Asaas",
        type: "asaas",
        description: i18n.t("automation.editor.nodes.asaasHelp")
      }
    ]
  }
];

function geraStringAleatoria(tamanho) {
  var stringAleatoria = "";
  var caracteres =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (var i = 0; i < tamanho; i++) {
    stringAleatoria += caracteres.charAt(
      Math.floor(Math.random() * caracteres.length)
    );
  }
  return stringAleatoria;
}

const nodeTypes = {
  message: messageNode,
  start: startNode,
  menu: menuNode,
  interactiveMenu: interactiveNode,
  interval: intervalNode,
  img: imgNode,
  gemini: geminiNode,
  audio: audioNode,
  randomizer: randomizerNode,
  video: videoNode,
  singleBlock: singleBlockNode,
  ticket: ticketNode,
  tag: tagNode,
  removeTag: removeTagNode,
  switchFlow: switchFlowNode,
  attendant: attendantNode,
  httpRequest: HttpRequestNode,
  variable: VariableNode,
  openai: openaiNode,
  input: inputNode,
  conditionCompare: conditionCompareNode,
  typebot: typebotNode,
  asaas: asaasNode
};

const edgeTypes = {
  buttonedge: RemoveEdge
};

const initialNodes = [
  {
    id: "1",
    position: { x: 250, y: 100 },
    data: { label: "Inicio do fluxo" },
    type: "start"
  }
];

const initialEdges = [];

const getTypebotDefaults = node => ({
  name: node?.data?.name || "TypeBot",
  slug: node?.data?.slug || i18n.t("automation.typebot.new"),
  typebot: node?.data?.typebot || node?.data?.url || "https://typebot.co",
  typebotSlug: node?.data?.typebotSlug || "",
  typebotId: node?.data?.typebotId || "",
  message: node?.data?.message || "",
  expireMinutes:
    node?.data?.expireMinutes ?? node?.data?.sessionExpiryMinutes ?? 60,
  messageInterval:
    node?.data?.messageInterval ?? node?.data?.messageDelay ?? 1000,
  keywordFinish: node?.data?.keywordFinish || "#",
  keywordRestart: node?.data?.keywordRestart || "00",
  invalidOptionMessage:
    node?.data?.invalidOptionMessage ||
    "Opção inválida, por favor envie #",
  restartMessage:
    node?.data?.restartMessage || "Vamos começar novamente?",
  waitForResponse:
    typeof node?.data?.waitForResponse === "boolean"
      ? node.data.waitForResponse
      : true,
  variableName: node?.data?.variableName || "",
  fullUrl:
    node?.data?.fullUrl ||
    (
      (node?.data?.typebot || node?.data?.url || "https://typebot.co").replace(/\/+$/, "") +
      "/" +
      (node?.data?.typebotSlug || "").replace(/^\/+|\/+$/g, "")
    )
});

const isMobileDevice = () => {
  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    ) ||
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0
  );
};

const MobileControls = () => {
  const classes = useStyles({});
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  return (
    <div className={classes.mobileControls}>
      <IconButton
        onClick={() => zoomIn()}
        className={classes.controlButton}
        size="small"
      >
        <ZoomInIcon />
      </IconButton>

      <IconButton
        onClick={() => zoomOut()}
        className={classes.controlButton}
        size="small"
      >
        <ZoomOutIcon />
      </IconButton>

      <IconButton
        onClick={() => fitView({ padding: 0.2 })}
        className={classes.controlButton}
        size="small"
      >
        <WebAssetIcon />
      </IconButton>
    </div>
  );
};

const QuickActions = ({ onActionClick }) => {
  const classes = useStyles({});

  const quickActions = [
    { icon: <Message />, name: "Texto", type: "text" },
    { icon: <DynamicFeed />, name: "Menu", type: "menu" },
    { icon: <AccessTime />, name: "Intervalo", type: "interval" },
    { icon: <LibraryBooks />, name: "Conteúdo", type: "content" }
  ];

  return (
    <div className={classes.quickActions}>
      {quickActions.map(action => (
        <Tooltip key={action.type} title={action.name} placement="left">
          <IconButton
            onClick={() => onActionClick(action.type)}
            className={classes.quickActionButton}
            size="medium"
          >
            {action.icon}
          </IconButton>
        </Tooltip>
      ))}
    </div>
  );
};

export const FlowBuilderConfig = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const { id } = useParams();

  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState(["Básicos"]);

  const classes = useStyles({ sidebarOpen });

  const [loading, setLoading] = useState(false);
  const [dataNode, setDataNode] = useState(null);

  const [modalAddText, setModalAddText] = useState(null);
  const [modalAddInterval, setModalAddInterval] = useState(false);
  const [modalAddMenu, setModalAddMenu] = useState(null);
  const [modalAddInteractive, setModalAddInteractive] = useState(null);
  const [modalAddImg, setModalAddImg] = useState(null);
  const [modalAddAudio, setModalAddAudio] = useState(null);
  const [modalAddRandomizer, setModalAddRandomizer] = useState(null);
  const [modalAddVideo, setModalAddVideo] = useState(null);
  const [modalAddSingleBlock, setModalAddSingleBlock] = useState(null);
  const [modalAddTicket, setModalAddTicket] = useState(null);
  const [modalAddTag, setModalAddTag] = useState(null);
  const [modalAddRemoveTag, setModalAddRemoveTag] = useState(null);
  const [modalAddSwitchFlow, setModalAddSwitchFlow] = useState(null);
  const [modalAddAttendant, setModalAddAttendant] = useState(null);
  const [modalAddOpenAI, setModalAddOpenAI] = useState(null);
  const [modalAddGemini, setModalAddGemini] = useState(null);
  const [modalAddInput, setModalAddInput] = useState(null);
  const [modalAddConditionCompare, setModalAddConditionCompare] = useState(null);
  const [modalAddTypebot, setModalAddTypebot] = useState(null);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const storageItems = useNodeStorage();

  const [typebotForm, setTypebotForm] = useState(getTypebotDefaults());

  const isDarkMode =
    theme.palette.type === "dark" || theme.palette.mode === "dark";

  const getDefaultNodeStyle = useCallback(() => {
    return {
      background: isDarkMode
        ? "rgba(15, 23, 42, 0.88)"
        : "rgba(255, 255, 255, 0.94)",
      borderRadius: 16,
      border: `1px solid ${isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"
        }`,
      boxShadow: isDarkMode
        ? "0 12px 30px rgba(0,0,0,0.22)"
        : "0 12px 30px rgba(15,23,42,0.10)",
      backdropFilter: "blur(10px)",
      overflow: "hidden",
      padding: 0
    };
  }, [isDarkMode]);

  const getSelectedNodeStyle = useCallback(() => {
    return {
      ...getDefaultNodeStyle(),
      border: `1.5px solid ${theme.palette.primary.main}`,
      boxShadow: isDarkMode
        ? `0 0 0 3px rgba(59,130,246,0.18), 0 18px 34px rgba(0,0,0,0.24)`
        : `0 0 0 3px rgba(59,130,246,0.12), 0 18px 34px rgba(15,23,42,0.12)`
    };
  }, [getDefaultNodeStyle, isDarkMode, theme.palette.primary.main]);

  const getDefaultEdgeStyle = useCallback(() => {
    return {
      stroke: isDarkMode ? "rgba(148,163,184,0.78)" : "rgba(100,116,139,0.66)",
      strokeWidth: isMobile ? 3.6 : 2.6,
      strokeDasharray: "8 8",
      strokeLinecap: "round"
    };
  }, [isDarkMode, isMobile]);

  const applyNodeStyle = useCallback(
    (node, selected = false) => ({
      ...node,
      style: {
        ...getDefaultNodeStyle(),
        ...(node.style || {}),
        ...(selected ? getSelectedNodeStyle() : {})
      }
    }),
    [getDefaultNodeStyle, getSelectedNodeStyle]
  );

  const applyEdgeStyle = useCallback(
    edge => ({
      ...edge,
      type: edge.type || "buttonedge",
      animated: false,
      style: {
        ...getDefaultEdgeStyle(),
        ...(edge.style || {})
      }
    }),
    [getDefaultEdgeStyle]
  );

  const connectionLineStyle = {
    stroke: theme.palette.primary.main,
    strokeWidth: isMobileDevice() ? 4 : 3,
    strokeDasharray: "8 8",
    strokeLinecap: "round",
    opacity: 0.95
  };

  useEffect(() => {
    if (!window.flowVariables) {
      window.flowVariables = {};
      console.log("Sistema de variáveis globais inicializado");
    }
    window.getFlowVariable = getFlowVariable;
    window.setFlowVariable = setFlowVariable;
  }, []);

  const addNode = (type, data = {}) => {
    const posY = nodes[nodes.length - 1].position.y;
    const posX =
      nodes[nodes.length - 1].position.x +
      (nodes[nodes.length - 1].width || 200) +
      48;

    const nodeStyle = getDefaultNodeStyle();

    if (type === "start") {
      return setNodes(old => {
        return [
          ...old.filter(item => item.id !== "1"),
          {
            id: "1",
            position: { x: posX, y: posY },
            data: { label: "Inicio do fluxo" },
            type: "start",
            style: nodeStyle
          }
        ];
      });
    }

    if (type === "typebot") {
      return setNodes(old => {
        const normalizedBaseUrl = (data?.typebot || "https://typebot.io")
          .trim()
          .replace(/\/+$/, "");

        const normalizedSlug = (data?.typebotSlug || "")
          .trim()
          .replace(/^\/+/, "");

        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: {
              slug: data?.slug || i18n.t("automation.typebot.new"),
              typebot: normalizedBaseUrl,
              name: data?.name || "TypeBot",
              message: data?.message || "",
              typebotSlug: normalizedSlug,
              typebotId: data?.typebotId || "",
              expireMinutes: Number(data?.expireMinutes ?? 60),
              messageInterval: Number(data?.messageInterval ?? 1000),
              keywordFinish: data?.keywordFinish || "#",
              keywordRestart: data?.keywordRestart || "00",
              invalidOptionMessage:
                data?.invalidOptionMessage ||
                "Opção inválida, por favor envie #",
              restartMessage:
                data?.restartMessage || "Vamos começar novamente?",
              waitForResponse:
                typeof data?.waitForResponse === "boolean"
                  ? data.waitForResponse
                  : true,
              variableName: data?.variableName || "",
              fullUrl:
                data?.fullUrl ||
                (normalizedSlug
                  ? `${normalizedBaseUrl}/${normalizedSlug}`
                  : normalizedBaseUrl),
              ...data
            },
            type: "typebot",
            style: nodeStyle
          }
        ];
      });
    }

    if (type === "text") {
      return setNodes(old => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { label: data.text },
            type: "message",
            style: nodeStyle
          }
        ];
      });
    }

    if (type === "interval") {
      return setNodes(old => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { label: `Intervalo ${data.sec} seg.`, sec: data.sec },
            type: "interval",
            style: nodeStyle
          }
        ];
      });
    }

    if (type === "menu") {
      return setNodes(old => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: {
              message: data.message,
              arrayOption: data.arrayOption
            },
            type: "menu",
            style: nodeStyle
          }
        ];
      });
    }

    if (type === "interactiveMenu") {
      return setNodes(old => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: {
              message: data.message,
              footer: data.footer,
              headerImage: data.headerImage,
              interactiveType: data.interactiveType,
              listButtonText: data.listButtonText,
              arrayOption: data.arrayOption
            },
            type: "interactiveMenu",
            style: nodeStyle
          }
        ];
      });
    }

    if (type === "img") {
      return setNodes(old => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { url: data.url, caption: data.caption || "" },
            type: "img",
            style: nodeStyle
          }
        ];
      });
    }

    if (type === "audio") {
      return setNodes(old => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: {
              url: data.url,
              record: data.record,
              caption: data.caption || ""
            },
            type: "audio",
            style: nodeStyle
          }
        ];
      });
    }

    if (type === "randomizer") {
      return setNodes(old => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { percent: data.percent },
            type: "randomizer",
            style: nodeStyle
          }
        ];
      });
    }

    if (type === "video") {
      return setNodes(old => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { url: data.url, caption: data.caption || "" },
            type: "video",
            style: nodeStyle
          }
        ];
      });
    }

    if (type === "singleBlock") {
      return setNodes(old => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { ...data },
            type: "singleBlock",
            style: nodeStyle
          }
        ];
      });
    }

    if (type === "ticket") {
      return setNodes(old => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { ...data },
            type: "ticket",
            style: nodeStyle
          }
        ];
      });
    }

    if (type === "openai") {
      return setNodes(old => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { ...data },
            type: "openai",
            style: nodeStyle
          }
        ];
      });
    }

    if (type === "gemini") {
      return setNodes(old => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { ...data },
            type: "gemini",
            style: nodeStyle
          }
        ];
      });
    }

    if (type === "tag") {
      return setNodes(old => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { ...data },
            type: "tag",
            style: nodeStyle
          }
        ];
      });
    }

    if (type === "removeTag") {
      return setNodes(old => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: {
              tag: data?.tag || "",
              ...data
            },
            type: "removeTag",
            style: nodeStyle
          }
        ];
      });
    }

    if (type === "switchFlow") {
      return setNodes(old => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { ...data },
            type: "switchFlow",
            style: nodeStyle
          }
        ];
      });
    }

    if (type === "attendant") {
      return setNodes(old => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { ...data },
            type: "attendant",
            style: nodeStyle
          }
        ];
      });
    }

    if (type === "httpRequest") {
      return setNodes(old => [
        ...old,
        {
          id: geraStringAleatoria(30),
          position: { x: posX, y: posY },
          data: {
            url: "",
            method: data?.method || "POST",
            requestBody: data?.requestBody || "{}",
            headersString: data?.headersString || "",
            queryParams: data?.queryParams || [],
            saveVariables: data?.saveVariables || [],
            ...data
          },
          type: "httpRequest",
          style: nodeStyle
        }
      ]);
    }

    if (type === "variable") {
      return setNodes(old => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: {
              variableName: data?.variableName || "",
              variableValue: data?.variableValue || "",
              variableType: data?.variableType || "text",
              variableExpression: data?.variableExpression || "",
              isExpression: data?.isExpression || false,
              ...data
            },
            type: "variable",
            style: nodeStyle
          }
        ];
      });
    }

    if (type === "input") {
      return setNodes(old => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: {
              question: data?.question || "",
              variableName: data?.variableName || "",
              ...data
            },
            type: "input",
            style: nodeStyle
          }
        ];
      });
    }

    if (type === "conditionCompare") {
      return setNodes(old => [
        ...old,
        {
          id: geraStringAleatoria(30),
          position: { x: posX, y: posY },
          data: {
            leftValue: data?.leftValue || "",
            operator: data?.operator || "equals",
            rightValue: data?.rightValue || "",
            ...data
          },
          type: "conditionCompare",
          style: nodeStyle
        }
      ]);
    }

    if (type === "asaas") {
      return setNodes(old => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: {
              name: data?.name || "Asaas - Segunda via de boleto",
              label: data?.label || "Asaas - Segunda via de boleto",
              action: data?.action || "secondCopyBoleto",
              asaasAction: data?.asaasAction || "secondCopyBoleto",
              cpfCnpjVariable: data?.cpfCnpjVariable || "cpfCnpj",
              variableName: data?.variableName || "cpfCnpj",
              inputVariable: data?.inputVariable || "cpfCnpj",
              sendMessage: data?.sendMessage !== undefined ? data.sendMessage : true,
              ...data
            },
            type: "asaas",
            style: nodeStyle
          }
        ];
      });
    }
  };

  const textAdd = data => addNode("text", data);
  const intervalAdd = data => addNode("interval", data);
  const menuAdd = data => addNode("menu", data);
  const interactiveMenuAdd = data => addNode("interactiveMenu", data);
  const imgAdd = data => addNode("img", data);
  const audioAdd = data => addNode("audio", data);
  const randomizerAdd = data => addNode("randomizer", data);
  const videoAdd = data => addNode("video", data);
  const singleBlockAdd = data => addNode("singleBlock", data);
  const ticketAdd = data => addNode("ticket", data);
  const tagAdd = data => addNode("tag", data);
  const openaiAdd = data => addNode("openai", data);
  const geminiAdd = data => addNode("gemini", data);
  const removeTagAdd = data => addNode("removeTag", data);
  const switchFlowAdd = data => addNode("switchFlow", data);
  const attendantAdd = data => addNode("attendant", data);
  const inputAdd = data => addNode("input", data);
  const conditionCompareAdd = data => addNode("conditionCompare", data);

  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  useEffect(() => {
    setLoading(true);

    const delayDebounceFn = setTimeout(() => {
      const fetchContacts = async () => {
        try {
          const { data } = await api.get(`/flowbuilder/flow/${id}`);

          if (data.flow.flow !== null) {
            const preparedNodes = data.flow.flow.nodes.map(node => {
              if (node.type === "httpRequest") {
                console.log(`[FlowBuilder] Processando nó HTTP Request: ${node.id}`);

                if (node.data.saveVariables && node.data.saveVariables.length > 0) {
                  console.log(
                    `[FlowBuilder] Nó ${node.id} tem ${node.data.saveVariables.length} variáveis configuradas`
                  );

                  if (
                    !node.data.responseVariables ||
                    !Array.isArray(node.data.responseVariables)
                  ) {
                    console.log(
                      `[FlowBuilder] Configurando responseVariables para nó ${node.id}`
                    );
                    node.data.responseVariables = node.data.saveVariables.map(
                      item => ({
                        path: item.path,
                        variableName: item.variable
                      })
                    );
                  }
                } else {
                  node.data.saveVariables = node.data.saveVariables || [];
                  node.data.responseVariables = node.data.responseVariables || [];
                }

                console.log(`[FlowBuilder] Nó HTTP Request ${node.id} processado:`, {
                  url: node.data.url,
                  method: node.data.method,
                  saveVariables: node.data.saveVariables?.length || 0,
                  responseVariables: node.data.responseVariables?.length || 0
                });
              }

              return applyNodeStyle(node);
            });

            const preparedEdges = (data.flow.flow.connections || []).map(edge =>
              applyEdgeStyle(edge)
            );

            setNodes(preparedNodes);
            setEdges(preparedEdges);
          } else {
            setNodes([
              {
                ...initialNodes[0],
                style: getDefaultNodeStyle()
              }
            ]);
            setEdges([]);
          }

          setLoading(false);
        } catch (err) {
          setLoading(false);
          toastError(err);
        }
      };

      fetchContacts();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [id, applyEdgeStyle, applyNodeStyle, getDefaultNodeStyle, setEdges, setNodes]);

  useEffect(() => {
    if (storageItems.action === "delete") {
      setNodes(old => old.filter(item => item.id !== storageItems.node));
      setEdges(old => {
        const newData = old.filter(item => item.source !== storageItems.node);
        const newClearTarget = newData.filter(
          item => item.target !== storageItems.node
        );
        return newClearTarget;
      });
      storageItems.setNodesStorage("");
      storageItems.setAct("idle");
    }

    if (storageItems.action === "disconnect") {
      setEdges(old =>
        old.filter(
          item =>
            item.source !== storageItems.node && item.target !== storageItems.node
        )
      );
      storageItems.setNodesStorage("");
      storageItems.setAct("idle");
    }

    if (storageItems.action === "duplicate") {
      const nodeDuplicate = nodes.filter(item => item.id === storageItems.node)[0];
      const maioresX = nodes.map(node => node.position.x);
      const maiorX = Math.max(...maioresX);
      const finalY = nodes[nodes.length - 1].position.y;

      if (nodeDuplicate) {
        const nodeNew = {
          ...nodeDuplicate,
          id: geraStringAleatoria(30),
          position: {
            x: maiorX + 260,
            y: finalY
          },
          selected: false,
          style: getDefaultNodeStyle()
        };

        setNodes(old => [...old, nodeNew]);
      }

      storageItems.setNodesStorage("");
      storageItems.setAct("idle");
    }
  }, [storageItems.action, nodes, storageItems, setEdges, setNodes, getDefaultNodeStyle]);

  const onConnect = useCallback(
    params =>
      setEdges(eds =>
        addEdge(
          {
            ...params,
            type: "buttonedge",
            animated: false,
            style: getDefaultEdgeStyle()
          },
          eds
        )
      ),
    [setEdges, getDefaultEdgeStyle]
  );

  const saveFlow = async () => {
    try {
      console.log("[FlowBuilder] Preparando para salvar fluxo...");

      const processedNodes = nodes.map(node => {
        if (node.type === "httpRequest") {
          console.log(`[FlowBuilder] Processando nó HTTP Request: ${node.id}`);

          if (node.data.saveVariables && node.data.saveVariables.length > 0) {
            console.log(
              `[FlowBuilder] Nó ${node.id} tem ${node.data.saveVariables.length} variáveis configuradas`
            );

            if (
              !node.data.responseVariables ||
              !Array.isArray(node.data.responseVariables)
            ) {
              console.log(
                `[FlowBuilder] Configurando responseVariables para nó ${node.id}`
              );
              node.data.responseVariables = node.data.saveVariables.map(item => ({
                path: item.path,
                variableName: item.variable
              }));
            }
          } else {
            node.data.saveVariables = node.data.saveVariables || [];
            node.data.responseVariables = node.data.responseVariables || [];
          }

          console.log(`[FlowBuilder] Nó HTTP Request ${node.id} processado:`, {
            url: node.data.url,
            method: node.data.method,
            saveVariables: node.data.saveVariables?.length || 0,
            responseVariables: node.data.responseVariables?.length || 0
          });
        }

        return node;
      });

      console.log("[FlowBuilder] Enviando fluxo para o servidor...");

      await api
        .post("/flowbuilder/flow", {
          idFlow: id,
          nodes: processedNodes,
          connections: edges
        })
        .then(() => {
          toast.success("Fluxo salvo com sucesso");
          setNodes(processedNodes.map(node => applyNodeStyle(node)));
        });
    } catch (error) {
      toast.error("Erro ao salvar o fluxo");
      console.error("Erro ao salvar o fluxo:", error);
    }
  };

  const resetNodeStyles = useCallback(() => {
    setNodes(old => old.map(item => applyNodeStyle(item, false)));
  }, [setNodes, applyNodeStyle]);

  const doubleClick = (event, node) => {
    setDataNode(node);

    if (node.type === "message") setModalAddText("edit");
    if (node.type === "interval") setModalAddInterval("edit");
    if (node.type === "menu") setModalAddMenu("edit");
    if (node.type === "img") setModalAddImg("edit");
    if (node.type === "audio") setModalAddAudio("edit");
    if (node.type === "randomizer") setModalAddRandomizer("edit");
    if (node.type === "video") setModalAddVideo("edit");
    if (node.type === "singleBlock") setModalAddSingleBlock("edit");
    if (node.type === "ticket") setModalAddTicket("edit");
    if (node.type === "tag") setModalAddTag("edit");
    if (node.type === "removeTag") setModalAddRemoveTag("edit");
    if (node.type === "switchFlow") setModalAddSwitchFlow("edit");
    if (node.type === "openai") setModalAddOpenAI("edit");
    if (node.type === "gemini") setModalAddGemini("edit");
    if (node.type === "interactiveMenu") setModalAddInteractive("edit");
    if (node.type === "attendant") setModalAddAttendant("edit");
    if (node.type === "typebot") {
      setTypebotForm(getTypebotDefaults(node));
      setModalAddTypebot("edit");
    }

    if (node.type === "httpRequest") {
      if (node.data.saveVariables && node.data.saveVariables.length > 0) {
        if (
          !node.data.responseVariables ||
          !Array.isArray(node.data.responseVariables)
        ) {
          node.data.responseVariables = node.data.saveVariables.map(item => ({
            path: item.path,
            variableName: item.variable
          }));

          setNodes(old =>
            old.map(itemNode => {
              if (itemNode.id === node.id) {
                return applyNodeStyle(node, true);
              }
              return applyNodeStyle(itemNode, false);
            })
          );

          console.log("[FlowBuilder] Nó HTTP Request atualizado:", node.id);
        }
      }
    }

    if (node.type === "input") setModalAddInput("edit");
    if (node.type === "conditionCompare") setModalAddConditionCompare("edit");
    if (node.type === "asaas") {
      // Abrir modal de edição do Asaas (se existir)
      // Por enquanto apenas log
      console.log("[FlowBuilder] Editando nó Asaas:", node.id);
    }
  };

  const clickNode = (event, node) => {
    setNodes(old =>
      old.map(item => applyNodeStyle(item, item.id === node.id))
    );
  };

  const clickEdge = () => {
    resetNodeStyles();
  };

  const doubleClickEdge = useCallback(
    (event, edge) => {
      event.stopPropagation();
      setEdges(eds => eds.filter(e => e.id !== edge.id));
    },
    [setEdges]
  );

  const updateNode = dataAlter => {
    setNodes(old =>
      old.map(itemNode => {
        if (itemNode.id === dataAlter.id) {
          return applyNodeStyle(dataAlter, false);
        }
        return itemNode;
      })
    );

    setModalAddText(null);
    setModalAddInterval(null);
    setModalAddMenu(null);
    setModalAddInteractive(null);
    setModalAddImg(null);
    setModalAddOpenAI(null);
    setModalAddAudio(null);
    setModalAddRandomizer(null);
    setModalAddVideo(null);
    setModalAddGemini(null);
    setModalAddSingleBlock(null);
    setModalAddTicket(null);
    setModalAddRemoveTag(null);
    setModalAddTag(null);
    setModalAddSwitchFlow(null);
    setModalAddAttendant(null);
    setModalAddInput(null);
    setModalAddConditionCompare(null);
    setModalAddTypebot(null);
    setTypebotForm(getTypebotDefaults());
  };

  const handleCategoryToggle = categoryName => {
    setExpandedCategories(prev =>
      prev.includes(categoryName)
        ? prev.filter(name => name !== categoryName)
        : [...prev, categoryName]
    );
  };

  const clickActions = type => {
    setBottomSheetOpen(false);

    switch (type) {
      case "start":
        addNode("start");
        break;
      case "menu":
        setModalAddMenu("create");
        break;
      case "content":
        setModalAddSingleBlock("create");
        break;
      case "interactiveMenu":
        setModalAddInteractive("create");
        break;
      case "text":
        setModalAddText("create");
        break;
      case "random":
        setModalAddRandomizer("create");
        break;
      case "interval":
        setModalAddInterval("create");
        break;
      case "ticket":
        setModalAddTicket("create");
        break;
      case "tag":
        setModalAddTag("create");
        break;
      case "removeTag":
        setModalAddRemoveTag("create");
        break;
      case "switchFlow":
        setModalAddSwitchFlow("create");
        break;
      case "attendant":
        setModalAddAttendant("create");
        break;
      case "httpRequest":
        addNode("httpRequest");
        break;
      case "variable":
        addNode("variable");
        break;
      case "typebot":
        setDataNode(null);
        setTypebotForm(getTypebotDefaults());
        setModalAddTypebot("create");
        break;
      case "input":
        setModalAddInput("create");
        break;
      case "conditionCompare":
        setModalAddConditionCompare("create");
        break;
      case "openai":
        setModalAddOpenAI("create");
        break;
      case "gemini":
        setModalAddGemini("create");
        break;
      case "img":
        setModalAddImg("create");
        break;
      case "audio":
        setModalAddAudio("create");
        break;
      case "video":
        setModalAddVideo("create");
        break;
      case "asaas":
        addNode("asaas", {
          name: "Asaas - Segunda via de boleto",
          label: "Asaas - Segunda via de boleto",
          action: "secondCopyBoleto",
          asaasAction: "secondCopyBoleto",
          cpfCnpjVariable: "cpfCnpj",
          variableName: "cpfCnpj",
          inputVariable: "cpfCnpj",
          sendMessage: true,
          keepMenuCommandsEnabled: true,
          continueAfterSend: true,
          holdAfterSend: false
        });
        break;
      default:
        break;
    }
  };

  const saveTypebotModal = () => {
    const normalizedBaseUrl = (typebotForm.typebot || "https://typebot.io")
      .trim()
      .replace(/\/+$/, "");

    const normalizedSlug = (typebotForm.typebotSlug || "")
      .trim()
      .replace(/^\/+/, "");

    if (!normalizedSlug) {
      toast.warning("Informe o slug do Typebot.");
      return;
    }

    const payload = {
      name: (typebotForm.name || "TypeBot").trim(),
      slug: (typebotForm.slug || i18n.t("automation.typebot.new")).trim(),
      typebot: normalizedBaseUrl || "https://typebot.co",
      url: normalizedBaseUrl || "https://typebot.co",
      typebotUrl: normalizedBaseUrl || "https://typebot.co",
      typebotSlug: normalizedSlug,
      typebotId: (typebotForm.typebotId || "").trim(),
      message: typebotForm.message || "",
      expireMinutes: Number(typebotForm.expireMinutes) || 60,
      messageInterval: Number(typebotForm.messageInterval) || 1000,
      keywordFinish: (typebotForm.keywordFinish || "#").trim() || "#",
      keywordRestart: (typebotForm.keywordRestart || "00").trim() || "00",
      invalidOptionMessage:
        typebotForm.invalidOptionMessage ||
        "Opção inválida, por favor envie #",
      restartMessage:
        typebotForm.restartMessage || "Vamos começar novamente?",
      waitForResponse: Boolean(typebotForm.waitForResponse),
      variableName: (typebotForm.variableName || "").trim(),
      fullUrl:
        normalizedSlug
          ? `${normalizedBaseUrl || "https://typebot.co"}/${normalizedSlug}`
          : normalizedBaseUrl || "https://typebot.co"
    };

    if (modalAddTypebot === "edit" && dataNode?.id) {
      updateNode({
        ...dataNode,
        type: "typebot",
        data: {
          ...dataNode.data,
          ...payload
        }
      });
      return;
    }

    addNode("typebot", payload);
    setModalAddTypebot(null);
    setTypebotForm(getTypebotDefaults());
  };

  const SidebarContent = () => (
    <div className={classes.sidebarContent}>
      {nodeCategories.map(category => (
        <div key={category.name}>
          {sidebarOpen ? (
            <>
              <div className={classes.categoryHeader}>
                <Box
                  display="flex"
                  alignItems="center"
                  justifyContent="space-between"
                  onClick={() => handleCategoryToggle(category.name)}
                  style={{ cursor: "pointer" }}
                >
                  <Box
                    display="flex"
                    alignItems="center"
                    style={{ gap: theme.spacing(1) }}
                  >
                    <Box
                      style={{
                        color:
                          typeof category.color === "function"
                            ? category.color(theme)
                            : category.color,
                        display: "flex",
                        alignItems: "center"
                      }}
                    >
                      {category.icon}
                    </Box>

                    <Typography variant="body2">{category.name}</Typography>
                  </Box>

                  {expandedCategories.includes(category.name) ? (
                    <ExpandLess />
                  ) : (
                    <ExpandMore />
                  )}
                </Box>
              </div>

              <Collapse in={expandedCategories.includes(category.name)}>
                <List dense>
                  {category.nodes.map(node => (
                    <ListItem key={node.type} disablePadding>
                      <Button
                        fullWidth
                        variant="text"
                        className={classes.nodeButton}
                        onClick={() => clickActions(node.type)}
                        startIcon={
                          <Box
                            style={{
                              color:
                                typeof category.color === "function"
                                  ? category.color(theme)
                                  : category.color,
                              display: "flex",
                              alignItems: "center"
                            }}
                          >
                            {node.icon}
                          </Box>
                        }
                      >
                        <Box textAlign="left" width="100%">
                          <Typography variant="body2">{node.name}</Typography>
                          <Typography variant="caption" color="textSecondary">
                            {node.description}
                          </Typography>
                        </Box>
                      </Button>
                    </ListItem>
                  ))}
                </List>
              </Collapse>
            </>
          ) : (
            <div>
              {category.nodes.map(node => (
                <Tooltip key={node.type} title={node.name} placement="right">
                  <IconButton
                    className={classes.collapsedNodeButton}
                    onClick={() => clickActions(node.type)}
                    style={{
                      color:
                        typeof category.color === "function"
                          ? category.color(theme)
                          : category.color
                    }}
                  >
                    {node.icon}
                  </IconButton>
                </Tooltip>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  const BottomSheetContent = () => (
    <Slide direction="up" in={bottomSheetOpen} mountOnEnter unmountOnExit>
      <div className={classes.bottomSheet}>
        <div
          className={classes.bottomSheetHandle}
          onClick={() => setBottomSheetOpen(false)}
        />

        <div className={classes.bottomSheetHeader}>
          <Typography variant="h6">{i18n.t("automation.editor.addNodes")}</Typography>
          <IconButton onClick={() => setBottomSheetOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </div>

        <div className={classes.bottomSheetContent}>
          <Grid container spacing={2}>
            {nodeCategories.map(category => (
              <Grid item xs={6} key={category.name}>
                <Paper elevation={0} className={classes.categoryCard} style={{ padding: 10 }}>
                  <Typography
                    variant="subtitle2"
                    className={classes.categoryTitle}
                    style={{
                      color:
                        typeof category.color === "function"
                          ? category.color(theme)
                          : category.color,
                      marginBottom: 10
                    }}
                  >
                    {category.name}
                  </Typography>

                  {category.nodes.map(node => (
                    <Button
                      key={node.type}
                      fullWidth
                      variant="outlined"
                      onClick={() => clickActions(node.type)}
                      startIcon={
                        <Box
                          style={{
                            color:
                              typeof category.color === "function"
                                ? category.color(theme)
                                : category.color,
                            display: "flex",
                            alignItems: "center"
                          }}
                        >
                          {node.icon}
                        </Box>
                      }
                      className={classes.categoryNodeBtn}
                      size="small"
                    >
                      {node.name}
                    </Button>
                  ))}
                </Paper>
              </Grid>
            ))}
          </Grid>
        </div>
      </div>
    </Slide>
  );

  if (loading) {
    return (
      <div className={classes.root}>
        <div className={classes.header}>
          <MainHeader>
            <Title>{i18n.t("automation.editor.title")}</Title>
          </MainHeader>
        </div>

        <div className={classes.loadingContainer}>
          <CircularProgress style={{ color: theme.palette.primary.main }} />
        </div>
      </div>
    );
  }

  return (
    <div className={classes.root}>
      <div className={classes.header}>
        <MainHeader>
          <Title>{i18n.t("automation.editor.title")}</Title>
        </MainHeader>
      </div>

      <div className={classes.content}>
        {!isMobile && (
          <div className={classes.sidebar}>
            <div className={classes.sidebarHeader}>
              {sidebarOpen && (
                <Typography variant="subtitle1" style={{ fontWeight: 700 }}>
                  {i18n.t("automation.editor.addNodes")}
                </Typography>
              )}

              <IconButton
                onClick={() => setSidebarOpen(!sidebarOpen)}
                size="small"
              >
                {sidebarOpen ? <ChevronLeft /> : <ChevronRight />}
              </IconButton>
            </div>

            <SidebarContent />
          </div>
        )}

        <div className={classes.flowContainer}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            deleteKeyCode={["Backspace", "Delete"]}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeDoubleClick={doubleClick}
            onNodeClick={clickNode}
            onEdgeClick={clickEdge}
            onEdgeDoubleClick={doubleClickEdge}
            onConnect={onConnect}
            onPaneClick={resetNodeStyles}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            minZoom={0.35}
            maxZoom={1.8}
            snapToGrid
            snapGrid={[16, 16]}
            connectionLineStyle={connectionLineStyle}
            style={{
              background: "transparent"
            }}
            defaultEdgeOptions={{
              type: "buttonedge",
              animated: false,
              style: getDefaultEdgeStyle()
            }}
          >
            <Controls />

            {isMobile && <MobileControls />}

            <MiniMap
              pannable
              zoomable
              style={{
                width: 180,
                height: 120
              }}
            />
            <Background
              variant="dots"
              gap={22}
              size={1.5}
              color={
                isDarkMode
                  ? "rgba(255,255,255,0.08)"
                  : "rgba(15,23,42,0.08)"
              }
            />
          </ReactFlow>
        </div>
      </div>

      <Fab
        color="primary"
        className={classes.fab}
        onClick={saveFlow}
        title="Salvar Fluxo"
      >
        <SaveIcon />
      </Fab>

      {!isMobile && <QuickActions onActionClick={clickActions} />}

      {isMobile && <BottomSheetContent />}

      {isMobile && (
        <Fab
          color="secondary"
          className={classes.addFab}
          onClick={() => setBottomSheetOpen(true)}
        >
          <AddIcon />
        </Fab>
      )}

      {isMobile && bottomSheetOpen && (
        <ClickAwayListener onClickAway={() => setBottomSheetOpen(false)}>
          <div />
        </ClickAwayListener>
      )}

      <FlowBuilderAddTextModal
        open={modalAddText}
        onSave={textAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddText}
      />

      <FlowBuilderIntervalModal
        open={modalAddInterval}
        onSave={intervalAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddInterval}
      />

      <FlowBuilderMenuModal
        open={modalAddMenu}
        onSave={menuAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddMenu}
      />

      <FlowBuilderInteractiveModal
        open={modalAddInteractive}
        onSave={interactiveMenuAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddInteractive}
      />

      <FlowBuilderAddImgModal
        open={modalAddImg}
        onSave={imgAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddImg}
      />

      <FlowBuilderAddAudioModal
        open={modalAddAudio}
        onSave={audioAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddAudio}
      />

      <FlowBuilderRandomizerModal
        open={modalAddRandomizer}
        onSave={randomizerAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddRandomizer}
      />

      <FlowBuilderAddVideoModal
        open={modalAddVideo}
        onSave={videoAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddVideo}
      />

      <FlowBuilderSingleBlockModal
        open={modalAddSingleBlock}
        onSave={singleBlockAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddSingleBlock}
      />

      <FlowBuilderTicketModal
        open={modalAddTicket}
        onSave={ticketAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddTicket}
      />

      <FlowBuilderOpenAIModal
        open={modalAddOpenAI}
        onSave={openaiAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddOpenAI}
      />

      <FlowBuilderGeminiModal
        open={modalAddGemini}
        onSave={geminiAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddGemini}
      />

      <FlowBuilderAddTagModal
        open={modalAddTag}
        onSave={tagAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddTag}
      />

      <FlowBuilderRemoveTagModal
        open={modalAddRemoveTag}
        onSave={removeTagAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={() => setModalAddRemoveTag(null)}
      />

      <FlowBuilderAddSwitchFlowModal
        open={modalAddSwitchFlow}
        onSave={switchFlowAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddSwitchFlow}
      />

      <FlowBuilderAddAttendantModal
        open={modalAddAttendant}
        onSave={attendantAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddAttendant}
      />

      <FlowBuilderInputModal
        open={modalAddInput}
        onSave={inputAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={setModalAddInput}
      />

      <FlowBuilderConditionCompareModal
        open={modalAddConditionCompare}
        onSave={conditionCompareAdd}
        data={dataNode?.type === "conditionCompare" ? dataNode : null}
        onUpdate={updateNode}
        close={() => setModalAddConditionCompare(null)}
        nodes={nodes}
      />

      <Dialog
        open={Boolean(modalAddTypebot)}
        onClose={() => {
          setModalAddTypebot(null);
          setTypebotForm(getTypebotDefaults());
        }}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          {modalAddTypebot === "edit" ? i18n.t("automation.typebot.edit") : i18n.t("automation.typebot.new")}
        </DialogTitle>

        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                label={i18n.t("automation.typebot.name")}
                fullWidth
                value={typebotForm.name}
                onChange={e =>
                  setTypebotForm(prev => ({ ...prev, name: e.target.value }))
                }
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label={i18n.t("automation.typebot.blockText")}
                fullWidth
                value={typebotForm.slug}
                onChange={e =>
                  setTypebotForm(prev => ({ ...prev, slug: e.target.value }))
                }
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label={i18n.t("automation.typebot.url")}
                fullWidth
                value={typebotForm.typebot}
                onChange={e =>
                  setTypebotForm(prev => ({ ...prev, typebot: e.target.value }))
                }
                placeholder="https://typebot.io ou https://bot.seudominio.com"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label={i18n.t("automation.typebot.slug")}
                fullWidth
                value={typebotForm.typebotSlug}
                onChange={e =>
                  setTypebotForm(prev => ({
                    ...prev,
                    typebotSlug: e.target.value
                  }))
                }
                placeholder="atendimento2026"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label={i18n.t("automation.typebot.id")}
                fullWidth
                value={typebotForm.typebotId}
                onChange={e =>
                  setTypebotForm(prev => ({
                    ...prev,
                    typebotId: e.target.value
                  }))
                }
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label={i18n.t("automation.typebot.expireMinutes")}
                type="number"
                fullWidth
                value={typebotForm.expireMinutes}
                onChange={e =>
                  setTypebotForm(prev => ({
                    ...prev,
                    expireMinutes: e.target.value
                  }))
                }
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label={i18n.t("queueIntegrationModal.form.typebotDelayMessage")}
                type="number"
                fullWidth
                value={typebotForm.messageInterval}
                onChange={e =>
                  setTypebotForm(prev => ({
                    ...prev,
                    messageInterval: e.target.value
                  }))
                }
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label={i18n.t("queueIntegrationModal.form.typebotKeywordFinish")}
                fullWidth
                value={typebotForm.keywordFinish}
                onChange={e =>
                  setTypebotForm(prev => ({
                    ...prev,
                    keywordFinish: e.target.value
                  }))
                }
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label={i18n.t("queueIntegrationModal.form.typebotKeywordRestart")}
                fullWidth
                value={typebotForm.keywordRestart}
                onChange={e =>
                  setTypebotForm(prev => ({
                    ...prev,
                    keywordRestart: e.target.value
                  }))
                }
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label={i18n.t("queueIntegrationModal.form.typebotUnknownMessage")}
                fullWidth
                value={typebotForm.invalidOptionMessage}
                onChange={e =>
                  setTypebotForm(prev => ({
                    ...prev,
                    invalidOptionMessage: e.target.value
                  }))
                }
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label={i18n.t("queueIntegrationModal.form.typebotRestartMessage")}
                fullWidth
                value={typebotForm.restartMessage}
                onChange={e =>
                  setTypebotForm(prev => ({
                    ...prev,
                    restartMessage: e.target.value
                  }))
                }
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label={i18n.t("automation.typebot.initialMessage")}
                fullWidth
                multiline
                minRows={3}
                value={typebotForm.message}
                onChange={e =>
                  setTypebotForm(prev => ({ ...prev, message: e.target.value }))
                }
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label={i18n.t("automation.typebot.returnVariable")}
                fullWidth
                value={typebotForm.variableName}
                onChange={e =>
                  setTypebotForm(prev => ({
                    ...prev,
                    variableName: e.target.value
                  }))
                }
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <Box display="flex" alignItems="center" height="100%">
                <FormControlLabel
                  control={
                    <Switch
                      checked={Boolean(typebotForm.waitForResponse)}
                      onChange={e =>
                        setTypebotForm(prev => ({
                          ...prev,
                          waitForResponse: e.target.checked
                        }))
                      }
                      color="primary"
                    />
                  }
                  label={i18n.t("automation.typebot.waitResponse")}
                />
              </Box>
            </Grid>

            <Grid item xs={12}>
              <TextField
                label={i18n.t("automation.typebot.generatedUrl")}
                fullWidth
                disabled
                value={
                  (typebotForm.typebot || "").trim()
                    ? `${(typebotForm.typebot || "").trim().replace(/\/+$/, "")}/${(
                      typebotForm.typebotSlug || ""
                    )
                      .trim()
                      .replace(/^\/+/, "")}`
                    : ""
                }
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions>
          <Button
            onClick={() => {
              setModalAddTypebot(null);
              setTypebotForm(getTypebotDefaults());
            }}
            color="default"
          >
            {i18n.t("wallets.cancel")}
          </Button>

          <Button
            onClick={saveTypebotModal}
            color="primary"
            variant="contained"
          >
            {modalAddTypebot === "edit" ? i18n.t("chatList.edit") : i18n.t("wallets.save")}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};
