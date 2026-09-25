import React, { useState, useContext, useEffect, useMemo, useCallback } from "react";
import clsx from "clsx";
import {
  makeStyles,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  Button,
  MenuItem,
  IconButton,
  Menu,
  useTheme,
  useMediaQuery,
  Avatar,
  Badge,
  withStyles,
  Chip,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Box,
} from "@material-ui/core";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@material-ui/core";
import MenuIcon from "@material-ui/icons/Menu";
import ChevronLeftIcon from "@material-ui/icons/ChevronLeft";
import NotificationsIcon from "@material-ui/icons/Notifications";
import AssignmentTurnedInIcon from "@material-ui/icons/AssignmentTurnedIn";
import CachedIcon from "@material-ui/icons/Cached";
import PhoneInTalkIcon from "@material-ui/icons/PhoneInTalk";
import api from "../services/api";
import MainListItems from "./MainListItems";
import NotificationsPopOver from "../components/NotificationsPopOver";
import NotificationsVolume from "../components/NotificationsVolume";
import UserModal from "../components/UserModal";
import { AuthContext } from "../context/Auth/AuthContext";
import { WhatsAppsContext } from "../context/WhatsApp/WhatsAppsContext";
import BackdropLoading from "../components/BackdropLoading";
import { i18n } from "../translate/i18n";
import toastError from "../errors/toastError";
import AnnouncementsPopover from "../components/AnnouncementsPopover";
import BirthdayModal from "../components/BirthdayModal";
import logo from "../assets/logo1.png";
import logoDark from "../assets/logo2.png";
import ChatPopover from "../pages/Chat/ChatPopover";
import { useDate } from "../hooks/useDate";
import ColorModeContext from "../layout/themeContext";
import Brightness4Icon from "@material-ui/icons/Brightness4";
import Brightness7Icon from "@material-ui/icons/Brightness7";
import { getBackendUrl } from "../config";
import useSettings from "../hooks/useSettings";
import VersionControl from "../components/VersionControl";
import useSocketListener from "../hooks/useSocketListener";
import OfficialCallNotification from "../components/OfficialCallNotification";
import { FaGlobe } from "react-icons/fa";
import { toast } from "react-toastify";


const TaskAlerts = () => {
  const { user, socket } = useContext(AuthContext);

  const [summary, setSummary] = useState({
    pending: 0,
    today: 0,
    overdue: 0,
    future: 0,
    withoutDeadline: 0,
  });

  const [loaded, setLoaded] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [reminderOpen, setReminderOpen] = useState(false);

  const snoozeKey =
    user?.id && user?.companyId
      ? `task-alert-snooze:${user.companyId}:${user.id}`
      : null;

  const fetchSummary = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data } = await api.get("/tarefas/resumo");

      setSummary({
        pending: Number(data?.pending || 0),
        today: Number(data?.today || 0),
        overdue: Number(data?.overdue || 0),
        future: Number(data?.future || 0),
        withoutDeadline: Number(data?.withoutDeadline || 0),
      });

      setLoaded(true);
    } catch (err) {
      console.error(
        "[TAREFAS] Erro ao carregar resumo:",
        err
      );

      setLoaded(true);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchSummary();

    const timer = setInterval(
      fetchSummary,
      5 * 60 * 1000
    );

    return () => clearInterval(timer);
  }, [fetchSummary]);

  useEffect(() => {
    if (!socket || !user?.companyId) {
      return undefined;
    }

    const event =
      `company${user.companyId}-tarefa`;

    const handleTaskEvent = (payload) => {
      fetchSummary();

      const tarefa = payload?.tarefa;

      const assignedToCurrentUser =
        payload?.action === "create" &&
        tarefa &&
        Number(tarefa.responsibleUserId) ===
          Number(user.id);

      const createdByAnotherUser =
        tarefa &&
        Number(tarefa.userId) !==
          Number(user.id);

      if (
        assignedToCurrentUser &&
        createdByAnotherUser
      ) {
        const priorityLabels = {
          baixa: "Baixa",
          media: "Média",
          alta: "Alta",
          urgente: "Urgente",
        };

        const prazo = tarefa.dataLimite
          ? tarefa.dataLimite
              .split("-")
              .reverse()
              .join("/")
          : "Sem prazo";

        toast.info(
          <div>
            <div
              style={{
                fontWeight: 800,
                marginBottom: 6,
              }}
            >
              📌 Nova tarefa atribuída a você
            </div>

            <div
              style={{
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              {tarefa.nome}
            </div>

            <div
              style={{
                fontSize: "0.85rem",
                marginBottom: 8,
              }}
            >
              Prioridade:{" "}
              {priorityLabels[
                tarefa.prioridade
              ] || tarefa.prioridade}
              {" • "}
              Prazo: {prazo}
            </div>

            <Button
              size="small"
              color="primary"
              onClick={() => {
                window.location.href =
                  "/tarefas";
              }}
              style={{
                fontWeight: 800,
                padding: 0,
              }}
            >
              VER TAREFA
            </Button>
          </div>,
          {
            autoClose: 12000,
            closeOnClick: false,
          }
        );
      }
    };

    socket.on(event, handleTaskEvent);

    return () => {
      socket.off(event, handleTaskEvent);
    };
  }, [
    socket,
    user?.companyId,
    fetchSummary
  ]);

  useEffect(() => {
    if (
      !loaded ||
      !user?.id ||
      summary.pending <= 0
    ) {
      return;
    }

    // Se já está olhando as tarefas, não abre popup.
    if (
      window.location.pathname.startsWith(
        "/tarefas"
      )
    ) {
      return;
    }

    const snoozedUntil = snoozeKey
      ? Number(
          localStorage.getItem(snoozeKey) || 0
        )
      : 0;

    if (Date.now() >= snoozedUntil) {
      setReminderOpen(true);
    }
  }, [
    loaded,
    user?.id,
    summary.pending,
    summary.today,
    summary.overdue,
    snoozeKey
  ]);

  const snooze = () => {
    if (snoozeKey) {
      localStorage.setItem(
        snoozeKey,
        String(
          Date.now() +
            4 * 60 * 60 * 1000
        )
      );
    }

    setReminderOpen(false);
  };

  const goToTasks = () => {
    setAnchorEl(null);
    setReminderOpen(false);

    // Evita popup imediatamente ao sair da
    // tela de tarefas pouco depois.
    if (snoozeKey) {
      localStorage.setItem(
        snoozeKey,
        String(
          Date.now() +
            30 * 60 * 1000
        )
      );
    }

    window.location.href = "/tarefas";
  };

  return (
    <>
      <IconButton
        color="inherit"
        title="Tarefas"
        aria-label="Tarefas"
        onClick={(event) =>
          setAnchorEl(event.currentTarget)
        }
      >
        <Badge
          color="error"
          max={99}
          badgeContent={summary.pending}
          invisible={summary.pending <= 0}
        >
          <AssignmentTurnedInIcon
            style={{ color: "white" }}
          />
        </Badge>
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        keepMounted
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        getContentAnchorEl={null}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
      >
        <div
          style={{
            width: 290,
            padding: "12px 18px 8px",
          }}
        >
          <Typography
            style={{
              fontWeight: 800,
              fontSize: "1rem",
              marginBottom: 12,
            }}
          >
            Suas tarefas
          </Typography>

          <Typography
            variant="body2"
            style={{
              marginBottom: 8,
              color:
                summary.overdue > 0
                  ? "#dc2626"
                  : undefined,
              fontWeight:
                summary.overdue > 0
                  ? 700
                  : 400,
            }}
          >
            🔴 Atrasadas: {summary.overdue}
          </Typography>

          <Typography
            variant="body2"
            style={{
              marginBottom: 8,
              color:
                summary.today > 0
                  ? "#d97706"
                  : undefined,
              fontWeight:
                summary.today > 0
                  ? 700
                  : 400,
            }}
          >
            🟠 Para hoje: {summary.today}
          </Typography>

          <Typography
            variant="body2"
            style={{ marginBottom: 8 }}
          >
            🔵 Futuras: {summary.future}
          </Typography>

          {summary.withoutDeadline > 0 && (
            <Typography
              variant="body2"
              style={{ marginBottom: 8 }}
            >
              ⚪ Sem prazo:{" "}
              {summary.withoutDeadline}
            </Typography>
          )}

          <Divider
            style={{
              margin: "10px 0",
            }}
          />

          <Typography
            variant="body2"
            style={{ fontWeight: 800 }}
          >
            Total pendente: {summary.pending}
          </Typography>
        </div>

        <MenuItem
          onClick={goToTasks}
          style={{
            fontWeight: 700,
            color: "#1976d2",
          }}
        >
          VER TAREFAS
        </MenuItem>
      </Menu>

      <Dialog
        open={reminderOpen}
        onClose={snooze}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>
          Tarefas pendentes
        </DialogTitle>

        <DialogContent>
          <Typography
            style={{
              fontWeight: 700,
              marginBottom: 16,
            }}
          >
            Você possui tarefas que precisam
            de atenção.
          </Typography>

          {summary.overdue > 0 && (
            <Typography
              style={{
                color: "#dc2626",
                fontWeight: 800,
                marginBottom: 10,
              }}
            >
              🔴 {summary.overdue}{" "}
              {summary.overdue === 1
                ? "tarefa atrasada"
                : "tarefas atrasadas"}
            </Typography>
          )}

          {summary.today > 0 && (
            <Typography
              style={{
                color: "#d97706",
                fontWeight: 800,
                marginBottom: 10,
              }}
            >
              🟠 {summary.today}{" "}
              {summary.today === 1
                ? "tarefa para hoje"
                : "tarefas para hoje"}
            </Typography>
          )}

          {summary.future > 0 && (
            <Typography
              style={{ marginBottom: 10 }}
            >
              🔵 {summary.future}{" "}
              {summary.future === 1
                ? "tarefa futura"
                : "tarefas futuras"}
            </Typography>
          )}

          {summary.withoutDeadline > 0 && (
            <Typography
              style={{ marginBottom: 10 }}
            >
              ⚪ {summary.withoutDeadline}{" "}
              {summary.withoutDeadline === 1
                ? "tarefa sem prazo"
                : "tarefas sem prazo"}
            </Typography>
          )}

          <Divider
            style={{ margin: "14px 0" }}
          />

          <Typography
            style={{ fontWeight: 800 }}
          >
            Total pendente: {summary.pending}
          </Typography>
        </DialogContent>

        <DialogActions>
          <Button onClick={snooze}>
            LEMBRAR MAIS TARDE
          </Button>

          <Button
            color="primary"
            variant="contained"
            onClick={goToTasks}
          >
            VER TAREFAS
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};


const backendUrl = getBackendUrl();
const drawerWidth = 240;

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    height: "100dvh",
    overflow: "hidden",
    backgroundColor: theme.palette.fancyBackground,
    [theme.breakpoints.down("sm")]: {
      height: "100dvh",
    },
    "& .MuiButton-outlinedPrimary": {
      color: theme.palette.primary.main,
      border: `1px solid ${theme.palette.primary.main}40`,
      borderRadius: "8px",
      fontWeight: 600,
      textTransform: "none",
      transition: "all 0.3s ease",
      "&:hover": {
        backgroundColor: `${theme.palette.primary.main}10`,
        borderColor: theme.palette.primary.main,
        transform: "translateY(-1px)",
        boxShadow: `0 4px 12px ${theme.palette.primary.main}30`,
      },
    },
    "& .MuiTab-textColorPrimary.Mui-selected": {
      color: theme.palette.primary.main,
      fontWeight: 700,
    },
  },

  chip: {
    background: "red",
    color: "white",
  },

  avatar: {
    width: "100%",
  },

  toolbar: {
    paddingRight: 16,
    paddingLeft: 8,
    color: theme.palette.dark.main,
    background: theme.palette.primary.main,
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
    transition: "all 0.3s ease",
    minHeight: 48,
    [theme.breakpoints.down("sm")]: {
      paddingRight: 6,
      paddingLeft: 6,
      minHeight: 56,
      overflow: "hidden",
    },
  },

  toolbarIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 8px",
    minHeight: "48px",
    backgroundColor: "transparent",
    borderBottom: `1px solid ${theme.palette.divider}`,
    transition: "all 0.3s ease",
    [theme.breakpoints.down("sm")]: {
      minHeight: "56px",
      padding: "0 6px",
    },
  },

  appBar: {
    zIndex: theme.zIndex.drawer + 1,
    transition: theme.transitions.create(["width", "margin"], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
    width: "100%",
  },

  appBarShift: {
    marginLeft: drawerWidth,
    width: `calc(100% - ${drawerWidth}px)`,
    transition: theme.transitions.create(["width", "margin"], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
    [theme.breakpoints.down("sm")]: {
      marginLeft: 0,
      width: "100%",
    },
  },

  menuButtonHidden: {
    display: "none",
  },

  title: {
    flexGrow: 1,
    fontSize: 14,
    color: "white",
    fontWeight: 600,
    letterSpacing: "0.025em",
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    [theme.breakpoints.down("sm")]: {
      display: "none",
    },
  },

  drawerPaper: {
    position: "relative",
    whiteSpace: "nowrap",
    width: drawerWidth,
    transition: theme.transitions.create("width", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
    overflowX: "hidden",
    overflowY: "hidden",
    borderRight: `1px solid ${theme.mode === "light" ? "#e0e0e0" : "#424242"}`,
    boxShadow:
      theme.mode === "light"
        ? "2px 0 8px rgba(0, 0, 0, 0.1)"
        : "2px 0 8px rgba(0, 0, 0, 0.3)",
    [theme.breakpoints.down("sm")]: {
      width: "82vw",
      maxWidth: 320,
      minWidth: 260,
    },
  },

  drawerPaperClose: {
    overflowX: "hidden",
    overflowY: "hidden",
    transition: theme.transitions.create("width", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
    width: theme.spacing(7),
    [theme.breakpoints.up("sm")]: {
      width: theme.spacing(9),
    },
    [theme.breakpoints.down("sm")]: {
      width: 0,
      minWidth: 0,
    },
  },

  appBarSpacer: {
    minHeight: 48,
    [theme.breakpoints.down("sm")]: {
      minHeight: 56,
    },
  },

  content: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    height: "100dvh",
    minWidth: 0,
    minHeight: 0,
    overflow: "hidden",
    position: "relative",
  },

  contentWrapper: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    position: "relative",
    width: "100%",
  },

  container: {
    padding: 0,
    margin: 0,
    maxWidth: "none",
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
  },

  containerWithScroll: {
    flex: 1,
    overflowY: "auto",
    overflowX: "hidden",
    ...theme.scrollbarStyles,
    "&::-webkit-scrollbar": {
      width: "6px",
    },
    "&::-webkit-scrollbar-thumb": {
      backgroundColor: theme.palette.primary.main,
      borderRadius: "4px",
    },
  },

  NotificationsPopOver: {},

  logo: {
    width: "100%",
    height: "45px",
    maxWidth: 180,
    [theme.breakpoints.down("sm")]: {
      width: "auto",
      height: "38px",
      maxWidth: 150,
    },
    logo: theme.logo,
    content:
      "url(" +
      (theme.mode === "light"
        ? theme.calculatedLogoLight()
        : theme.calculatedLogoDark()) +
      ")",
    transition: "all 0.3s ease",
    backgroundColor: "transparent",
    mixBlendMode: theme.mode === "dark" ? "screen" : "normal",
    "&:hover": {
      transform: "scale(1.02)",
    },
  },

  hideLogo: {
    display: "none",
  },

  avatar2: {
    width: theme.spacing(4),
    height: theme.spacing(4),
    cursor: "pointer",
    borderRadius: "50%",
    border: "2px solid #ccc",
    transition: "all 0.3s ease",
    "&:hover": {
      transform: "scale(1.05)",
      borderColor: theme.palette.primary.main,
    },
    [theme.breakpoints.down("sm")]: {
      width: theme.spacing(3.8),
      height: theme.spacing(3.8),
    },
  },

  updateDiv: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },

  toolbarButton: {
    color: "rgba(255, 255, 255, 0.9)",
    borderRadius: "8px",
    padding: "8px",
    margin: "0 2px",
    transition: "all 0.3s ease",
    "&:hover": {
      backgroundColor: "rgba(255, 255, 255, 0.1)",
      transform: "translateY(-1px)",
    },
    "&:active": {
      transform: "translateY(0)",
    },
    [theme.breakpoints.down("sm")]: {
      padding: "6px",
      margin: "0 1px",
    },
  },

  menuButton: {
    color: "white",
    "&:hover": {
      backgroundColor: "rgba(255, 255, 255, 0.1)",
    },
    "& .MuiSvgIcon-root": {
      transition: "transform 0.3s ease",
    },
    "&:hover .MuiSvgIcon-root": {
      transform: "rotate(90deg)",
    },
  },

  languageSelector: {
    position: "relative",
    display: "inline-block",
    "& > button": {
      background: "rgba(255, 255, 255, 0.1)",
      border: "none",
      borderRadius: "8px",
      color: "rgba(255, 255, 255, 0.9)",
      fontSize: "18px",
      padding: "8px 12px",
      cursor: "pointer",
      transition: "all 0.3s ease",
      "&:hover": {
        background: "rgba(255, 255, 255, 0.2)",
        transform: "translateY(-1px)",
      },
    },
    "& > div": {
      position: "absolute",
      top: "45px",
      right: 0,
      left: "auto",
      background: "#fff",
      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
      borderRadius: "8px",
      padding: "8px",
      zIndex: 1000,
      minWidth: "120px",
      "& button": {
        background: "none",
        border: "none",
        color: "#374151",
        display: "block",
        width: "100%",
        padding: "8px 12px",
        textAlign: "left",
        borderRadius: "6px",
        fontSize: "14px",
        fontWeight: 500,
        transition: "all 0.2s ease",
        "&:hover": {
          background: `${theme.palette.primary.main}10`,
          color: theme.palette.primary.main,
          transform: "none",
        },
      },
    },
  },

  topActions: {
    display: "flex",
    alignItems: "center",
    flexShrink: 0,
    minWidth: 0,

    [theme.breakpoints.down("sm")]: {
      flex: "1 1 auto",
      flexShrink: 1,
      minWidth: 0,
      maxWidth: "calc(100vw - 62px)",

      overflowX: "auto",
      overflowY: "hidden",

      justifyContent: "flex-start",

      WebkitOverflowScrolling: "touch",
      overscrollBehaviorX: "contain",

      scrollbarWidth: "none",

      "&::-webkit-scrollbar": {
        display: "none",
      },

      "& > *": {
        flexShrink: 0,
      },

      "& .MuiIconButton-root": {
        padding: 6,
        flexShrink: 0,
      },
    },
  },

  animatedBadge: {
    "& .MuiBadge-badge": {
      animation: "$heartbeat 2s infinite",
    },
  },

  "@keyframes heartbeat": {
    "0%": { transform: "scale(1)" },
    "14%": { transform: "scale(1.1)" },
    "28%": { transform: "scale(1)" },
    "42%": { transform: "scale(1.1)" },
    "70%": { transform: "scale(1)" },
  },

  chatInputArea: {
    flexShrink: 0,
    width: "100%",
    backgroundColor: theme.palette.background.paper,
    borderTop: `1px solid ${theme.palette.divider}`,
    padding: theme.spacing(1, 2),
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(0.5, 1),
    },
  },
}));

const StyledBadge = withStyles((theme) => ({
  badge: {
    backgroundColor: "#44b700",
    color: "#44b700",
    boxShadow: `0 0 0 2px ${theme.palette.background.paper}`,
    "&::after": {
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      borderRadius: "50%",
      animation: "$ripple 1.2s infinite ease-in-out",
      border: "1px solid currentColor",
      content: '""',
    },
  },
  "@keyframes ripple": {
    "0%": {
      transform: "scale(.8)",
      opacity: 1,
    },
    "100%": {
      transform: "scale(2.4)",
      opacity: 0,
    },
  },
}))(Badge);

const SmallAvatar = withStyles((theme) => ({
  root: {
    width: 22,
    height: 22,
    border: `2px solid ${theme.palette.background.paper}`,
  },
}))(Avatar);

const LoggedInLayout = ({ children, themeToggle, hideMenu = false }) => {
  const classes = useStyles();
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { handleLogout, loading, user, socket } = useContext(AuthContext);
  const whatsAppsContext = useContext(WhatsAppsContext);
  const wavoipAvailable = Boolean(
    whatsAppsContext?.wavoipAvailable
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerVariant, setDrawerVariant] = useState("permanent");

  const [languageAnchorEl, setLanguageAnchorEl] = useState(null);
  const [showBirthdayModal, setShowBirthdayModal] = useState(false);
  // ==========================================================
  // Controle do popup de aniversário
  //
  // Entendi:
  //   não exibe novamente durante o mesmo dia.
  //
  // Lembrar mais tarde / X / fechar:
  //   não exibe novamente durante 2 horas.
  //
  // Controle separado por empresa + usuário + data.
  // ==========================================================

  const getBirthdayDayKey = useCallback(() => {
    try {
      return new Intl.DateTimeFormat("sv-SE", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).format(new Date());
    } catch (error) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");

      return `${year}-${month}-${day}`;
    }
  }, []);

  const getBirthdayModalStorageKey = useCallback(
    (suffix) => {
      const companyId = user?.companyId || "0";
      const userId = user?.id || "0";
      const day = getBirthdayDayKey();

      return `birthdayModal:${companyId}:${userId}:${day}:${suffix}`;
    },
    [user?.companyId, user?.id, getBirthdayDayKey]
  );

  const canShowBirthdayModal = useCallback(() => {
    if (!user?.id || !user?.companyId) {
      return false;
    }

    const acknowledgedKey =
      getBirthdayModalStorageKey("acknowledged");

    if (localStorage.getItem(acknowledgedKey) === "1") {
      return false;
    }

    const snoozeKey =
      getBirthdayModalStorageKey("snoozeUntil");

    const snoozeUntil = Number(
      localStorage.getItem(snoozeKey) || 0
    );

    if (snoozeUntil > Date.now()) {
      return false;
    }

    if (snoozeUntil) {
      localStorage.removeItem(snoozeKey);
    }

    return true;
  }, [
    user?.id,
    user?.companyId,
    getBirthdayModalStorageKey
  ]);

  const handleBirthdaySnooze = useCallback(() => {
    if (user?.id && user?.companyId) {
      const snoozeUntil =
        Date.now() + (2 * 60 * 60 * 1000);

      localStorage.setItem(
        getBirthdayModalStorageKey("snoozeUntil"),
        String(snoozeUntil)
      );
    }

    setShowBirthdayModal(false);
  }, [
    user?.id,
    user?.companyId,
    getBirthdayModalStorageKey
  ]);

  const handleBirthdayAcknowledge = useCallback(() => {
    if (user?.id && user?.companyId) {
      localStorage.setItem(
        getBirthdayModalStorageKey("acknowledged"),
        "1"
      );

      localStorage.removeItem(
        getBirthdayModalStorageKey("snoozeUntil")
      );
    }

    setShowBirthdayModal(false);
  }, [
    user?.id,
    user?.companyId,
    getBirthdayModalStorageKey
  ]);


  const theme = useTheme();
  const { colorMode } = useContext(ColorModeContext);
  const greaterThenSm = useMediaQuery(theme.breakpoints.up("sm"));
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [volume, setVolume] = useState(localStorage.getItem("volume") || 1);

  const { dateToClient } = useDate();
  const [profileUrl, setProfileUrl] = useState(null);
  const [updateInProgress, setUpdateInProgress] = useState(false);

  const settings = useSettings();

  useEffect(() => {
    if (isMobile) {
      setDrawerVariant("temporary");
      setDrawerOpen(false);
    } else {
      setDrawerVariant("permanent");
      if (user?.defaultMenu === "closed") {
        setDrawerOpen(false);
      } else {
        setDrawerOpen(true);
      }
    }

    if (user?.defaultTheme === "dark" && theme.mode === "light") {
      colorMode.toggleColorMode();
    }
  }, [isMobile, user?.defaultMenu, user?.defaultTheme]);

  useEffect(() => {
    const companyId = user?.companyId;

    if (companyId) {
      const buildProfileUrl = () => {
        const savedProfileImage = localStorage.getItem("profileImage");
        const currentProfileImage = savedProfileImage || user.profileImage;

        if (currentProfileImage) {
          return `${backendUrl}/public/company${companyId}/user/${currentProfileImage}`;
        }
        return `${backendUrl}/public/app/noimage.png`;
      };

      setProfileUrl(buildProfileUrl());
    }
  }, [user?.companyId, user?.profileImage]);

  const handleAuthEvent = useCallback((data) => {
    if (data.user.id === +user?.id) {
      toastError("Sua conta foi acessada em outro computador.");
      setTimeout(() => {
        localStorage.clear();
        window.location.reload();
      }, 1000);
    }
  }, [user?.id]);

  const handleUserUpdate = useCallback((data) => {
    if (data.action === "update" && data.user.id === +user?.id) {
      if (data.user.profileImage) {
        const newProfileUrl = `${backendUrl}/public/company${user?.companyId}/user/${data.user.profileImage}`;
        setProfileUrl(newProfileUrl);
        localStorage.setItem("profileImage", data.user.profileImage);
      }
    }
  }, [user?.companyId, user?.id]);

  const handleUserBirthday = useCallback((data) => {
    console.log("🎂 Evento de aniversário de usuário recebido:", data);

    if (
      data.userId === +user?.id &&
      canShowBirthdayModal()
    ) {
      setShowBirthdayModal(true);
    }
  }, [user?.id, canShowBirthdayModal]);

  const handleContactBirthday = useCallback((data) => {
    console.log("🎂 Evento de aniversário de contato recebido:", data);
  }, []);

  const checkBirthdaysOnLogin = useCallback(async () => {
    if (user?.id && user?.companyId) {
      try {
        const { data } = await api.get("/birthdays/today");
        const birthdayData = data.data;

        const userBirthday = birthdayData.users.find(
          u => u.id === +user.id
        );

        if (userBirthday && canShowBirthdayModal()) {
          console.log("🎂 Usuário faz aniversário hoje! Mostrando modal...");
          setShowBirthdayModal(true);
        }

        if (birthdayData.users.length > 0 || birthdayData.contacts.length > 0) {
          console.log("🎂 Há aniversariantes hoje:", birthdayData);
        }
      } catch (error) {
        console.error("Erro ao verificar aniversários:", error);
      }
    }
  }, [
    user?.id,
    user?.companyId,
    canShowBirthdayModal
  ]);

  useSocketListener(socket, user, "auth", handleAuthEvent);
  useSocketListener(socket, user, "user", handleUserUpdate);
  useSocketListener(socket, user, "user-birthday", handleUserBirthday);
  useSocketListener(socket, user, "contact-birthday", handleContactBirthday);

  useEffect(() => {
    if (user?.id && user?.companyId) {
      const timer = setTimeout(() => {
        checkBirthdaysOnLogin();
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [user?.id, user?.companyId, checkBirthdaysOnLogin]);

  useEffect(() => {
    if (socket?.emit && user?.companyId) {
      socket.emit("userStatus");

      const interval = setInterval(() => {
        socket?.emit && socket.emit("userStatus");
      }, 1000 * 60 * 5);

      return () => clearInterval(interval);
    }
  }, [socket, user?.companyId]);

  const handleUpdateStart = () => {
    setUpdateInProgress(true);
  };

  const handleUpdateComplete = () => {
    setUpdateInProgress(false);
  };

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
    setMenuOpen(true);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
    setMenuOpen(false);
  };

  const handleOpenUserModal = () => {
    setUserModalOpen(true);
    handleCloseMenu();
  };

  const handleClickLogout = () => {
    handleCloseMenu();
    handleLogout();
  };

  const drawerClose = () => {
    if (isMobile || user.defaultMenu === "closed") {
      setDrawerOpen(false);
    }
  };

  const handleRefreshPage = () => {
    window.location.reload(false);
  };

  const handleMenuItemClick = () => {
    if (isMobile) {
      setDrawerOpen(false);
    }
  };

  const handleLanguageChange = (lng) => {
    i18n.changeLanguage(lng);
    localStorage.setItem("language", lng);
    window.location.reload();
  };

  const LANGUAGE_OPTIONS = [
    { code: "pt-BR", label: "Português" },
    { code: "en", label: "English" },
    { code: "es", label: "Español" },
  ];

  const [enabledLanguages, setEnabledLanguages] = useState(["pt-BR", "en"]);
  const { getPublicSetting } = useSettings();

  useEffect(() => {
    let isMounted = true;

    async function fetchGlobalLanguages() {
      try {
        const enabledLanguagesSetting =
          await getPublicSetting("enabledLanguages");

        let langs = ["pt-BR", "en"];

        try {
          const parsedLanguages = Array.isArray(enabledLanguagesSetting)
            ? enabledLanguagesSetting
            : JSON.parse(enabledLanguagesSetting || "[]");

          if (Array.isArray(parsedLanguages) && parsedLanguages.length > 0) {
            langs = parsedLanguages;
          }
        } catch (parseError) {
          console.log(
            "Layout - erro ao interpretar enabledLanguages:",
            parseError
          );
        }

        if (isMounted) {
          setEnabledLanguages(langs);
        }
      } catch (error) {
        console.log(
          "Layout - erro ao carregar idiomas globais:",
          error
        );
      }
    }

    fetchGlobalLanguages();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredLanguageOptions = LANGUAGE_OPTIONS.filter((lang) =>
    enabledLanguages.includes(lang.code)
  );

  if (loading || updateInProgress) {
    return <BackdropLoading />;
  }

  return (
    <div className={clsx(classes.root, "logged-in-layout")}>
      {!hideMenu && (
        <Drawer
          variant={drawerVariant}
          className={clsx(
            classes.drawerPaper,
            !drawerOpen && !isMobile && classes.drawerPaperClose
          )}
          classes={{
            paper: clsx(
              classes.drawerPaper,
              !drawerOpen && !isMobile && classes.drawerPaperClose
            ),
          }}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          ModalProps={{
            keepMounted: true,
          }}
        >
          <div className={classes.toolbarIcon}>
            <img
              className={drawerOpen ? classes.logo : classes.hideLogo}
              src={
                theme.mode === "dark"
                  ? theme.calculatedLogoDark()
                  : theme.calculatedLogoLight()
              }
              style={{
                display: "block",
                margin: "0 auto",
                height: isMobile ? "42px" : "50px",
                width: "100%",
                backgroundColor: "transparent",
                objectFit: "contain",
                mixBlendMode: theme.mode === "dark" ? "screen" : "normal",
              }}
              alt="logo"
            />
            <IconButton onClick={() => setDrawerOpen(!drawerOpen)}>
              <ChevronLeftIcon />
            </IconButton>
          </div>

          <List className={classes.containerWithScroll} onClick={handleMenuItemClick}>
            <MainListItems collapsed={!drawerOpen} />
          </List>
          <Divider />
        </Drawer>
      )}

      <AppBar
        position="absolute"
        className={clsx(
          classes.appBar,
          !hideMenu && drawerOpen && !isMobile && classes.appBarShift
        )}
        color="primary"
      >
        <Toolbar variant="dense" className={classes.toolbar}>
          {!hideMenu && (
            <IconButton
              edge="start"
              aria-label="open drawer"
              style={{ color: "white" }}
              onClick={() => setDrawerOpen(!drawerOpen)}
              className={clsx(drawerOpen && !isMobile && classes.menuButtonHidden)}
            >
              <MenuIcon />
            </IconButton>
          )}

          {!isMobile ? (
            <Typography
              component="h2"
              variant="h6"
              color="inherit"
              noWrap
              className={classes.title}
            >
              {greaterThenSm &&
              user?.profile === "admin" &&
              user?.company?.dueDate ? (
                <>
                  {i18n.t("mainDrawer.appBar.user.message")} <b>{user.name}</b>,{" "}
                  {i18n.t("mainDrawer.appBar.user.messageEnd")}{" "}
                  <b>{user?.company?.name}</b>! (
                  {i18n.t("mainDrawer.appBar.user.active")}{" "}
                  {dateToClient(user?.company?.dueDate)})
</>
              ) : (
                <>
                  {i18n.t("mainDrawer.appBar.user.message")} <b>{user.name}</b>,{" "}
                  {i18n.t("mainDrawer.appBar.user.messageEnd")}{" "}
                  <b>{user?.company?.name}</b>!
                </>
              )}
            </Typography>
          ) : (
            <Box flexGrow={1} />
          )}

          {!hideMenu && (
            <div className={classes.topActions}>
              <VersionControl
                onUpdateStart={handleUpdateStart}
                onUpdateComplete={handleUpdateComplete}
              />

              <IconButton
                color="inherit"
                title="Idioma"
                aria-label="Idioma"
                aria-controls={
                  languageAnchorEl
                    ? "language-menu"
                    : undefined
                }
                aria-haspopup="true"
                onClick={(event) =>
                  setLanguageAnchorEl(
                    event.currentTarget
                  )
                }
                style={{
                  color: "white",
                  flexShrink: 0
                }}
              >
                <FaGlobe />
              </IconButton>

              <Menu
                id="language-menu"
                anchorEl={languageAnchorEl}
                keepMounted
                open={Boolean(languageAnchorEl)}
                onClose={() =>
                  setLanguageAnchorEl(null)
                }
                getContentAnchorEl={null}
                anchorOrigin={{
                  vertical: "bottom",
                  horizontal: "right"
                }}
                transformOrigin={{
                  vertical: "top",
                  horizontal: "right"
                }}
                PaperProps={{
                  style: {
                    minWidth: 160,
                    maxWidth: 220,
                    marginTop: 4
                  }
                }}
              >
                {filteredLanguageOptions.map(
                  (lang) => (
                    <MenuItem
                      key={lang.code}
                      selected={
                        i18n.language ===
                          lang.code ||
                        i18n.language?.startsWith(
                          `${lang.code}-`
                        )
                      }
                      onClick={() => {
                        setLanguageAnchorEl(null);
                        handleLanguageChange(
                          lang.code
                        );
                      }}
                    >
                      {lang.label}
                    </MenuItem>
                  )
                )}
              </Menu>

              <IconButton edge="start" onClick={colorMode.toggleColorMode}>
                {theme.mode === "dark" ? (
                  <Brightness7Icon style={{ color: "white" }} />
                ) : (
                  <Brightness4Icon style={{ color: "white" }} />
                )}
              </IconButton>

              <NotificationsVolume setVolume={setVolume} volume={volume} />

              {wavoipAvailable && (
                <IconButton
                  color="inherit"
                  title="Abrir telefone"
                  aria-label="Abrir telefone"
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent(
                        "multizap:wavoip-toggle-widget"
                      )
                    );
                  }}
                >
                  <PhoneInTalkIcon style={{ color: "white" }} />
                </IconButton>
              )}

              <IconButton
                onClick={handleRefreshPage}
                aria-label={i18n.t("mainDrawer.appBar.refresh")}
                color="inherit"
              >
                <CachedIcon style={{ color: "white" }} />
              </IconButton>

              <TaskAlerts />

              {user.id && <NotificationsPopOver volume={volume} />}

              <AnnouncementsPopover />

              <ChatPopover />

              <div className="user-menu-wrapper">
                <StyledBadge
                  overlap="circular"
                  anchorOrigin={{
                    vertical: "bottom",
                    horizontal: "right",
                  }}
                  variant="dot"
                  onClick={handleMenu}
                >
                  <Avatar
                    alt="Multi100"
                    className={classes.avatar2}
                    src={profileUrl}
                  />
                </StyledBadge>

                <UserModal
                  open={userModalOpen}
                  onClose={() => setUserModalOpen(false)}
                  onImageUpdate={(newProfileUrl) => setProfileUrl(newProfileUrl)}
                  userId={user?.id}
                />

                <Menu
                  id="menu-appbar"
                  anchorEl={anchorEl}
                  getContentAnchorEl={null}
                  anchorOrigin={{
                    vertical: "bottom",
                    horizontal: "right",
                  }}
                  transformOrigin={{
                    vertical: "top",
                    horizontal: "right",
                  }}
                  open={menuOpen}
                  onClose={handleCloseMenu}
                  PaperProps={{
                    style: {
                      minWidth: "150px",
                      maxWidth: "200px",
                      width: "auto",
                    },
                  }}
                >
                  <MenuItem onClick={handleOpenUserModal}>
                    {i18n.t("mainDrawer.appBar.user.profile")}
                  </MenuItem>
                  <MenuItem onClick={handleClickLogout}>
                    {i18n.t("mainDrawer.appBar.user.logout")}
                  </MenuItem>
                </Menu>
              </div>
            </div>
          )}
        </Toolbar>
      </AppBar>

      <main className={classes.content}>
      <OfficialCallNotification />

        <div className={classes.appBarSpacer} />
        <div className={classes.contentWrapper}>
          {children ? children : null}
        </div>
      </main>

      <BirthdayModal
        open={showBirthdayModal}
        onClose={handleBirthdaySnooze}
        onAcknowledge={handleBirthdayAcknowledge}
        user={user}
      />
    </div>
  );
};

export default LoggedInLayout;
