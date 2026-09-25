import React, { useContext, useEffect, useReducer, useState } from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import useHelps from "../hooks/useHelps";
import ListItem from "@material-ui/core/ListItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import ListSubheader from "@material-ui/core/ListSubheader";
import Divider from "@material-ui/core/Divider";
import Avatar from "@material-ui/core/Avatar";
import Badge from "@material-ui/core/Badge";
import Collapse from "@material-ui/core/Collapse";
import List from "@material-ui/core/List";
import Tooltip from "@material-ui/core/Tooltip";
import Typography from "@material-ui/core/Typography";
import Box from "@material-ui/core/Box";
import Chip from "@material-ui/core/Chip";

import DashboardOutlinedIcon from "@material-ui/icons/DashboardOutlined";
import WhatsAppIcon from "@material-ui/icons/WhatsApp";
import SyncAltIcon from "@material-ui/icons/SyncAlt";
import SettingsOutlinedIcon from "@material-ui/icons/SettingsOutlined";
import PeopleAltOutlinedIcon from "@material-ui/icons/PeopleAltOutlined";
import ContactPhoneOutlinedIcon from "@material-ui/icons/ContactPhoneOutlined";
import AccountBalanceWalletIcon from "@material-ui/icons/AccountBalanceWallet";
import AccountTreeOutlinedIcon from "@material-ui/icons/AccountTreeOutlined";
import FlashOnIcon from "@material-ui/icons/FlashOn";
import HelpOutlineIcon from "@material-ui/icons/HelpOutline";
import CodeRoundedIcon from "@material-ui/icons/CodeRounded";
import ViewKanban from "@mui/icons-material/ViewKanban";
import Schedule from "@material-ui/icons/Schedule";
import CheckBoxOutlinedIcon from "@material-ui/icons/CheckBoxOutlined";
import LocalOfferIcon from "@material-ui/icons/LocalOffer";
import EventAvailableIcon from "@material-ui/icons/EventAvailable";
import ExpandLessIcon from "@material-ui/icons/ExpandLess";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import CakeIcon from "@material-ui/icons/Cake";
import AnnouncementIcon from "@material-ui/icons/Announcement";
import ForumIcon from "@material-ui/icons/Forum";
import LocalAtmIcon from "@material-ui/icons/LocalAtm";
import BusinessIcon from "@material-ui/icons/Business";
import WhatshotIcon from "@material-ui/icons/Whatshot";
import EmailIcon from "@material-ui/icons/Email";
import WebIcon from "@material-ui/icons/Web";
import PhoneIcon from "@material-ui/icons/Phone";
import DnsIcon from "@material-ui/icons/Dns";
import AutorenewIcon from "@material-ui/icons/Autorenew";
import {
  AllInclusive,
  AttachFile,
  Dashboard,
  Description,
  DeviceHubOutlined,
  GridOn,
  PhonelinkSetup,
} from "@material-ui/icons";

import { WhatsAppsContext } from "../context/WhatsApp/WhatsAppsContext";
import { AuthContext } from "../context/Auth/AuthContext";
import { useActiveMenu } from "../context/ActiveMenuContext";

import { isArray } from "lodash";
import api from "../services/api";
import toastError from "../errors/toastError";
import usePlans from "../hooks/usePlans";
import { i18n } from "../translate/i18n";

import { ShapeLine, Webhook } from "@mui/icons-material";

import useCompanySettings from "../hooks/useSettings/companySettings";

const iconStyles = {
  dashboard: {
    color: "#6366f1",
    gradient: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
  },
  reports: {
    color: "#3b82f6",
    gradient: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
  },
  callReports: {
    color: "#10b981",
    gradient: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
  },
  realtime: {
    color: "#0ea5e9",
    gradient: "linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)",
  },
  wallets: {
    color: "#10b981",
    gradient: "linear-gradient(135deg, #10b981 0%, #047857 100%)",
  },
  tickets: {
    color: "#10b981",
    gradient: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
  },
  quickMessages: {
    color: "#f59e0b",
    gradient: "linear-gradient(135deg, #f59e0b 0%, #f97316 100%)",
  },
  templates: {
    color: "#ec4899",
    gradient: "linear-gradient(135deg, #ec4899 0%, #db2777 100%)",
  },
  kanban: {
    color: "#8b5cf6",
    gradient: "linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)",
  },
  tasks: {
    color: "#3498db",
    gradient: "linear-gradient(135deg, #3498db 0%, #002bfd 100%)",
  },
  contacts: {
    color: "#06b6d4",
    gradient: "linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)",
  },
  schedules: {
    color: "#ec4899",
    gradient: "linear-gradient(135deg, #ec4899 0%, #be185d 100%)",
  },
  tags: {
    color: "#14b8a6",
    gradient: "linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)",
  },
  chats: {
    color: "#f97316",
    gradient: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
  },
  helps: {
    color: "#3b82f6",
    gradient: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
  },
  campaigns: {
    color: "#ef4444",
    gradient: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
  },
  emailMarketing: {
    color: "#0ea5e9",
    gradient: "linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%)",
  },
  automations: {
    color: "#84cc16",
    gradient: "linear-gradient(135deg, #84cc16 0%, #65a30d 100%)",
  },
  flowCampaign: {
    color: "#84cc16",
    gradient: "linear-gradient(135deg, #84cc16 0%, #65a30d 100%)",
  },
  flowConversation: {
    color: "#10b981",
    gradient: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
  },
  followup: {
    color: "#3b82f6",
    gradient: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
  },
  announcements: {
    color: "#f59e0b",
    gradient: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
  },
  api: {
    color: "#06b6d4",
    gradient: "linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)",
  },
  users: {
    color: "#8b5cf6",
    gradient: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
  },
  birthdays: {
    color: "#ec4899",
    gradient: "linear-gradient(135deg, #ec4899 0%, #be185d 100%)",
  },
  queues: {
    color: "#10b981",
    gradient: "linear-gradient(135deg, #10b981 0%, #047857 100%)",
  },
  files: {
    color: "#14b8a6",
    gradient: "linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)",
  },
  prompts: {
    color: "#a855f7",
    gradient: "linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)",
  },
  aiSdr: {
    color: "#f97316",
    gradient: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
  },
  integrations: {
    color: "#f97316",
    gradient: "linear-gradient(135deg, #f97316 0%, #c2410c 100%)",
  },
  connections: {
    color: "#64748b",
    gradient: "linear-gradient(135deg, #64748b 0%, #475569 100%)",
  },
  warmup: {
    color: "#10b981",
    gradient: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
  },
  allConnections: {
    color: "#334155",
    gradient: "linear-gradient(135deg, #475569 0%, #1e293b 100%)",
  },
  financial: {
    color: "#10b981",
    gradient: "linear-gradient(135deg, #10b981 0%, #065f46 100%)",
  },
  settings: {
    color: "#ef4444",
    gradient: "linear-gradient(135deg, #ef4444 0%, #8b5cf6 100%)",
  },
  companies: {
    color: "#3b82f6",
    gradient: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
  },
  default: {
    color: "#6366f1",
    gradient: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
  },
};

const useStyles = makeStyles((theme) => ({
  menuContainer: {
    overflowY: "auto",
    overflowX: "hidden",
  },

  listItem: {
    height: "44px",
    width: "auto",
    "&:hover $iconHoverActive": {
      backgroundColor: theme.palette.action.hover,
    },
  },

  listItemText: {
    fontSize: "14px",
    color: theme.mode === "light" ? "#666" : "#FFF",
    fontWeight: 500,
  },

  listItemTextActive: {
    fontWeight: 700,
    color: theme.mode === "light" ? "#111827" : "#FFF",
  },

  avatarActive: {
    backgroundColor: "transparent",
  },

  avatarHover: {
    backgroundColor: "transparent",
  },

  iconHoverActive: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: "50%",
    height: 36,
    width: 36,
    backgroundColor: "transparent",
    transition: "all 0.3s",
    "&:hover, &.active": {
      backgroundColor:
        theme.mode === "light"
          ? "rgba(0, 0, 0, 0.04)"
          : "rgba(255, 255, 255, 0.08)",
    },
    "& .MuiSvgIcon-root": {
      fontSize: "1.6rem",
      filter:
        theme.mode === "dark"
          ? "drop-shadow(0 0 1px rgba(0,0,0,0.25))"
          : "none",
    },
  },

  badge: {
    "& .MuiBadge-badge": {
      backgroundColor: "#ef4444",
      color: "#fff",
      fontWeight: 700,
      minWidth: 18,
      height: 18,
      boxShadow: "0 2px 8px rgba(239,68,68,0.25)",
      animation: "$pulse 2s infinite",
    },
  },

  "@keyframes pulse": {
    "0%, 100%": {
      opacity: 1,
    },
    "50%": {
      opacity: 0.7,
    },
  },

  submenuContainer: {
    backgroundColor:
      theme.mode === "light"
        ? "rgba(120,120,120,0.10)"
        : "rgba(120,120,120,0.35)",
  },

  versionChip: {
    background: iconStyles.dashboard.gradient,
    color: "white",
    fontWeight: 600,
    fontSize: "0.75rem",
    transition: "all 0.3s ease",
    "&:hover": {
      backgroundColor: theme.palette.primary.main,
      transform: "scale(1.05)",
    },
  },

  adminSection: {
    "& .MuiListSubheader-root": {
      background: "transparent",
      fontWeight: 700,
    },
  },

  expandIcon: {
    color: theme.mode === "light" ? "#6b7280" : "#cbd5e1",
  },
}));

function ListItemLink(props) {
  const {
    icon,
    primary,
    to,
    tooltip,
    showBadge,
    badgeContent,
    iconKey,
    small
  } = props;
  const classes = useStyles();
  const { activeMenu } = useActiveMenu();
  const location = useLocation();
  const isActive = activeMenu === to || location.pathname === to;

  const renderLink = React.useMemo(
    () =>
      React.forwardRef((itemProps, ref) => (
        <RouterLink to={to} ref={ref} {...itemProps} />
      )),
    [to]
  );

  const iconStyle = iconStyles[iconKey] || iconStyles.default;

  const ConditionalTooltip = ({ children, tooltipEnabled }) =>
    tooltipEnabled ? (
      <Tooltip
        placement="right"
        arrow
        title={
          <Typography style={{ fontWeight: 700, fontSize: "0.9rem" }}>
            {primary}
          </Typography>
        }
      >
        {children}
      </Tooltip>
    ) : (
      children
    );

  return (
    <ConditionalTooltip tooltipEnabled={!!tooltip}>
      <li>
        <ListItem
          button
          component={renderLink}
          className={classes.listItem}
          style={small ? { paddingLeft: "32px" } : {}}
        >
          {icon ? (
            <ListItemIcon>
              {showBadge ? (
                <Badge
                  badgeContent={
                    badgeContent !== undefined
                      ? badgeContent
                      : "!"
                  }
                  color="error"
                  overlap="circular"
                  className={classes.badge}
                >
                  <Avatar
                    className={`${classes.iconHoverActive} ${isActive ? "active" : ""}`}
                    style={{ color: iconStyle.color }}
                  >
                    {icon}
                  </Avatar>
                </Badge>
              ) : (
                <Avatar
                  className={`${classes.iconHoverActive} ${isActive ? "active" : ""}`}
                  style={{ color: iconStyle.color }}
                >
                  {icon}
                </Avatar>
              )}
            </ListItemIcon>
          ) : null}

          <ListItemText
            primary={
              <Typography
                className={`${classes.listItemText} ${
                  isActive ? classes.listItemTextActive : ""
                }`}
              >
                {primary}
              </Typography>
            }
          />
        </ListItem>
      </li>
    </ConditionalTooltip>
  );
}

const reducer = (state, action) => {
  if (action.type === "LOAD_CHATS") {
    const chats = action.payload;
    const newChats = [];

    if (isArray(chats)) {
      chats.forEach((chat) => {
        const chatIndex = state.findIndex((u) => u.id === chat.id);
        if (chatIndex !== -1) {
          state[chatIndex] = chat;
        } else {
          newChats.push(chat);
        }
      });
    }

    return [...state, ...newChats];
  }

  if (action.type === "UPDATE_CHATS") {
    const chat = action.payload;
    const chatIndex = state.findIndex((u) => u.id === chat.id);

    if (chatIndex !== -1) {
      state[chatIndex] = chat;
      return [...state];
    } else {
      return [chat, ...state];
    }
  }

  if (action.type === "DELETE_CHAT") {
    const chatId = action.payload;
    const chatIndex = state.findIndex((u) => u.id === chatId);

    if (chatIndex !== -1) {
      state.splice(chatIndex, 1);
    }

    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }

  if (action.type === "CHANGE_CHAT") {
    const changedChats = state.map((chat) => {
      if (chat.id === action.payload.chat.id) {
        return action.payload.chat;
      }
      return chat;
    });
    return changedChats;
  }
};

const MainListItems = ({ collapsed, drawerClose }) => {
  const theme = useTheme();
  const classes = useStyles();
  const { whatsApps } = useContext(WhatsAppsContext);
  const { user, socket } = useContext(AuthContext);
  const { setActiveMenu } = useActiveMenu();
  const location = useLocation();

  const [connectionWarning, setConnectionWarning] = useState(false);
  const [openDashboardSubmenu, setOpenDashboardSubmenu] = useState(false);
  const [openFlowSubmenu, setOpenFlowSubmenu] = useState(false);
  const [showCampaigns, setShowCampaigns] = useState(false);
  const [showKanban, setShowKanban] = useState(false);
  const [showOpenAi, setShowOpenAi] = useState(false);
  const [showIntegrations, setShowIntegrations] = useState(false);
  const [showWavoipCall, setShowWavoipCall] = useState(false);
  const [showSchedules, setShowSchedules] = useState(false);
  const [showInternalChat, setShowInternalChat] = useState(false);
  const [showExternalApi, setShowExternalApi] = useState(false);
  const [showWallets, setShowWallets] = useState(false);
  const [taskPending, setTaskPending] = useState(0);

  const [invisible, setInvisible] = useState(true);
  const [pageNumber, setPageNumber] = useState(1);
  const [searchParam] = useState("");
  const [chats, dispatch] = useReducer(reducer, []);
  const version = "13.3";
  const [managementHover, setManagementHover] = useState(false);
  const [flowHover, setFlowHover] = useState(false);

  useEffect(() => {
    let mounted = true;

    const fetchTaskSummary = async () => {
      if (!user?.id) return;

      try {
        const { data } = await api.get(
          "/tarefas/resumo"
        );

        if (mounted) {
          setTaskPending(
            Number(data?.pending || 0)
          );
        }
      } catch (_) {
        if (mounted) {
          setTaskPending(0);
        }
      }
    };

    fetchTaskSummary();

    if (!socket || !user?.companyId) {
      return () => {
        mounted = false;
      };
    }

    const event =
      `company${user.companyId}-tarefa`;

    socket.on(event, fetchTaskSummary);

    return () => {
      mounted = false;
      socket.off(event, fetchTaskSummary);
    };
  }, [
    socket,
    user?.id,
    user?.companyId
  ]);

  const { list } = useHelps();
  const [hasHelps, setHasHelps] = useState(false);

  const { get: getSetting } = useCompanySettings();
  const { getPlanCompany } = usePlans();

  const isManagementActive =
    location.pathname === "/" ||
    location.pathname.startsWith("/reports") ||
    location.pathname.startsWith("/dashboard/chamadas") ||
    location.pathname.startsWith("/moments") ||
    location.pathname.startsWith("/plugins/floup/dashboard") ||
    location.pathname.startsWith("/wallets");

  const isFlowbuilderRouteActive =
    location.pathname.startsWith("/phrase-lists") ||
    location.pathname.startsWith("/flowbuilders") ||
    location.pathname.startsWith("/plugins/floup");

  useEffect(() => {
    async function checkHelps() {
      const helps = await list();
      setHasHelps(helps.length > 0);
    }
    checkHelps();
  }, []);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const setting = await getSetting({
          column: "DirectTicketsToWallets",
        });
        setShowWallets(setting?.DirectTicketsToWallets);
      } catch (err) {
        toastError(err);
      }
    };

    fetchSettings();
  }, [getSetting]);

  useEffect(() => {
    if (location.pathname.startsWith("/tickets")) {
      setActiveMenu("/tickets");
    } else {
      setActiveMenu("");
    }
  }, [location, setActiveMenu]);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    async function fetchData() {
      const companyId = user.companyId;
      const planConfigs = await getPlanCompany(undefined, companyId);

      setShowCampaigns(planConfigs.plan.useCampaigns);
      setShowKanban(planConfigs.plan.useKanban);
      setShowOpenAi(planConfigs.plan.useOpenAi);
      setShowIntegrations(planConfigs.plan.useIntegrations);
      setShowSchedules(planConfigs.plan.useSchedules);
      setShowInternalChat(planConfigs.plan.useInternalChat);
      setShowExternalApi(planConfigs.plan.useExternalApi);
      setShowWavoipCall(planConfigs.plan.wavoip);
    }

    fetchData();
  }, [getPlanCompany, user.companyId]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchChats();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchParam, pageNumber]);

  useEffect(() => {
    if (user.id && socket && typeof socket.on === "function") {
      const companyId = user.companyId;

      const onCompanyChatMainListItems = (data) => {
        if (data.action === "new-message" || data.action === "update") {
          dispatch({ type: "CHANGE_CHAT", payload: data });
        }
      };

      const eventName = `company-${companyId}-chat`;
      socket.on(eventName, onCompanyChatMainListItems);

      return () => {
        if (socket && typeof socket.off === "function") {
          socket.off(eventName, onCompanyChatMainListItems);
        }
      };
    }
  }, [socket, user.id, user.companyId]);

  useEffect(() => {
    let unreadsCount = 0;

    if (chats.length > 0) {
      for (let chat of chats) {
        for (let chatUser of chat.users) {
          if (chatUser.userId === user.id) {
            unreadsCount += chatUser.unreads;
          }
        }
      }
    }

    if (unreadsCount > 0) {
      setInvisible(false);
    } else {
      setInvisible(true);
    }
  }, [chats, user.id]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (whatsApps.length > 0) {
        const offlineWhats = whatsApps.filter((whats) => {
          return (
            whats.status === "qrcode" ||
            whats.status === "PAIRING" ||
            whats.status === "DISCONNECTED" ||
            whats.status === "TIMEOUT" ||
            whats.status === "OPENING"
          );
        });

        setConnectionWarning(offlineWhats.length > 0);
      }
    }, 2000);

    return () => clearTimeout(delayDebounceFn);
  }, [whatsApps]);

  const fetchChats = async () => {
    try {
      const { data } = await api.get("/chats/", {
        params: { searchParam, pageNumber },
      });

      dispatch({ type: "LOAD_CHATS", payload: data.records });
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <div onClick={drawerClose} className={classes.menuContainer}>
      {(user.showDashboard === "enabled" || user.allowRealTime === "enabled") && (
        <>
          <Tooltip
            placement="right"
            arrow
            title={
              collapsed ? (
                <Typography style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                  {i18n.t("mainDrawer.listItems.management")}
                </Typography>
              ) : (
                ""
              )
            }
          >
            <ListItem
              dense
              button
              onClick={() => setOpenDashboardSubmenu((prev) => !prev)}
              onMouseEnter={() => setManagementHover(true)}
              onMouseLeave={() => setManagementHover(false)}
            >
              <ListItemIcon>
                <Avatar
                  className={`${classes.iconHoverActive} ${
                    isManagementActive || managementHover ? "active" : ""
                  }`}
                  style={{ color: iconStyles.dashboard.color }}
                >
                  <Dashboard />
                </Avatar>
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography
                    className={`${classes.listItemText} ${
                      isManagementActive ? classes.listItemTextActive : ""
                    }`}
                  >
                    {i18n.t("mainDrawer.listItems.management")}
                  </Typography>
                }
              />
              {openDashboardSubmenu ? (
                <ExpandLessIcon className={classes.expandIcon} />
              ) : (
                <ExpandMoreIcon className={classes.expandIcon} />
              )}
            </ListItem>
          </Tooltip>

          <Collapse
            in={openDashboardSubmenu}
            timeout="auto"
            unmountOnExit
            className={classes.submenuContainer}
          >
            {user.showDashboard === "enabled" && (
              <>
                <ListItemLink
                  small
                  to="/"
                  primary={i18n.t("mainDrawer.listItems.dashboard")}
                  icon={<DashboardOutlinedIcon />}
                  iconKey="dashboard"
                  tooltip={collapsed}
                />
                <ListItemLink
                  small
                  to="/reports"
                  primary={i18n.t("mainDrawer.listItems.reports")}
                  icon={<Description />}
                  iconKey="reports"
                  tooltip={collapsed}
                />
                {(user.profile === "admin" || user.super) && (
                  <ListItemLink
                    small
                    to="/user-performance"
                    primary={i18n.language?.startsWith("es") ? "Rendimiento de agentes" : i18n.language?.startsWith("en") ? "Agent performance" : "Desempenho dos atendentes"}
                    icon={<PeopleAltOutlinedIcon />}
                    iconKey="reports"
                    tooltip={collapsed}
                  />
                )}
                {showWavoipCall && (
                  <ListItemLink
                    small
                    to="/dashboard/chamadas"
                    primary={i18n.t("analytics.calls.title")}
                    icon={<PhoneIcon />}
                    iconKey="callReports"
                    tooltip={collapsed}
                  />
                )}
              </>
            )}

            {user.allowRealTime === "enabled" && (
              <ListItemLink
                to="/moments"
                primary={i18n.t("mainDrawer.listItems.chatsTempoReal")}
                icon={<GridOn />}
                iconKey="realtime"
                tooltip={collapsed}
              />
            )}

            {user.profile === "admin" && (
              <ListItemLink
                small
                to="/plugins/floup/dashboard"
                primary="Painel FollowUP"
                icon={<ViewKanban />}
                iconKey="dashboard"
                tooltip={collapsed}
              />
            )}

            {user.profile === "admin" && showWallets && (
              <ListItemLink
                to="/wallets"
                primary={i18n.t("mainDrawer.listItems.wallets")}
                icon={<AccountBalanceWalletIcon />}
                iconKey="wallets"
                tooltip={collapsed}
              />
            )}
          </Collapse>
        </>
      )}

      <ListItemLink
        to="/tickets"
        primary={i18n.t("mainDrawer.listItems.tickets")}
        icon={<WhatsAppIcon />}
        iconKey="tickets"
        tooltip={collapsed}
      />

      <ListItemLink
        to="/quick-messages"
        primary={i18n.t("mainDrawer.listItems.quickMessages")}
        icon={<FlashOnIcon />}
        iconKey="quickMessages"
        tooltip={collapsed}
      />

      <ListItemLink
        to="/template-manager"
        primary="Templates Meta"
        icon={<Description />}
        iconKey="templates"
        tooltip={collapsed}
      />

      <ListItemLink
        to="/whatsapp-health"
        primary={i18n.language?.startsWith("es") ? "Salud de números" : i18n.language?.startsWith("en") ? "Number health" : "Saúde dos números"}
        icon={<PhonelinkSetup />}
        iconKey="connections"
        tooltip={collapsed}
      />

      {showKanban && (
        <ListItemLink
          to="/kanban"
          primary={i18n.t("mainDrawer.listItems.kanban")}
          icon={<ViewKanban />}
          iconKey="kanban"
          tooltip={collapsed}
        />
      )}

      <ListItemLink
        to="/tarefas"
        primary={i18n.t("todo.task")}
        icon={<CheckBoxOutlinedIcon />}
        iconKey="tasks"
        tooltip={collapsed}
        showBadge={taskPending > 0}
        badgeContent={taskPending}
      />

      <ListItemLink
        to="/renovacoes"
        primary={
          i18n.language?.startsWith("es")
            ? "Renovaciones"
            : i18n.language?.startsWith("en")
              ? "Renewals"
              : "Renovações"
        }
        icon={<AutorenewIcon />}
        iconKey="renewals"
        tooltip={collapsed}
      />

      {user.showContacts === "enabled" && (
        <ListItemLink
          to="/contacts"
          primary={i18n.t("mainDrawer.listItems.contacts")}
          icon={<ContactPhoneOutlinedIcon />}
          iconKey="contacts"
          tooltip={collapsed}
        />
      )}

      {showSchedules && (
        <ListItemLink
          to="/schedules"
          primary={i18n.t("mainDrawer.listItems.schedules")}
          icon={<Schedule />}
          iconKey="schedules"
          tooltip={collapsed}
        />
      )}

      <ListItemLink
        to="/tags"
        primary={i18n.t("mainDrawer.listItems.tags")}
        icon={<LocalOfferIcon />}
        iconKey="tags"
        tooltip={collapsed}
      />

      {showInternalChat && (
        <ListItemLink
          to="/chats"
          primary={i18n.t("mainDrawer.listItems.chats")}
          icon={
            <Badge color="secondary" variant="dot" invisible={invisible}>
              <ForumIcon />
            </Badge>
          }
          iconKey="chats"
          tooltip={collapsed}
        />
      )}

      {hasHelps && (
        <ListItemLink
          to="/helps"
          primary={i18n.t("mainDrawer.listItems.helps")}
          icon={<HelpOutlineIcon />}
          iconKey="helps"
          tooltip={collapsed}
        />
      )}

      {user?.showCampaign === "enabled" && showCampaigns && (
        <ListItemLink
          to="/campaigns"
          primary={i18n.t("mainDrawer.listItems.campaigns")}
          icon={<EventAvailableIcon />}
          iconKey="campaigns"
          tooltip={collapsed}
        />
      )}

      {user?.showCampaign === "enabled" && showCampaigns && user.profile === "admin" && (
        <>
          <ListItemLink
            to="/email-settings"
            primary="Email Marketing"
            icon={<EmailIcon />}
            iconKey="emailMarketing"
            tooltip={collapsed}
          />

          <ListItemLink
            to="/landing-webhooks"
            primary="Landing Pages"
            icon={<WebIcon />}
            iconKey="integrations"
            tooltip={collapsed}
          />
        </>
      )}

      {user.showFlow === "enabled" && (
        <>
          <Tooltip
            placement="right"
            arrow
            title={
              collapsed ? (
                <Typography style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                  {i18n.t("mainDrawer.listItems.automations")}
                </Typography>
              ) : (
                ""
              )
            }
          >
            <ListItem
              dense
              button
              onClick={() => setOpenFlowSubmenu((prev) => !prev)}
              onMouseEnter={() => setFlowHover(true)}
              onMouseLeave={() => setFlowHover(false)}
            >
              <ListItemIcon>
                <Avatar
                  className={`${classes.iconHoverActive} ${
                    isFlowbuilderRouteActive || flowHover ? "active" : ""
                  }`}
                  style={{ color: iconStyles.automations.color }}
                >
                  <Webhook />
                </Avatar>
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography
                    className={`${classes.listItemText} ${
                      isFlowbuilderRouteActive ? classes.listItemTextActive : ""
                    }`}
                  >
                    {i18n.t("mainDrawer.listItems.automations")}
                  </Typography>
                }
              />
              {openFlowSubmenu ? (
                <ExpandLessIcon className={classes.expandIcon} />
              ) : (
                <ExpandMoreIcon className={classes.expandIcon} />
              )}
            </ListItem>
          </Tooltip>

          <Collapse
            in={openFlowSubmenu}
            timeout="auto"
            unmountOnExit
            className={classes.submenuContainer}
          >
            <List dense component="div" disablePadding>
              <ListItemLink
                to="/phrase-lists"
                primary={i18n.t("analytics.navigation.campaignFlow")}
                icon={<EventAvailableIcon />}
                iconKey="flowCampaign"
                tooltip={collapsed}
              />

              <ListItemLink
                to="/flowbuilders"
                primary={i18n.t("analytics.navigation.conversationFlow")}
                icon={<ShapeLine />}
                iconKey="flowConversation"
                tooltip={collapsed}
              />

              <ListItemLink
                to="/plugins/floup"
                primary="Follow UP (Templates)"
                icon={<Webhook />}
                iconKey="followup"
                tooltip={collapsed}
              />
            </List>
          </Collapse>
        </>
      )}

      {(user.profile === "admin" || user.allowConnections === "enabled") && (
        <>
          <Divider />
          <div className={classes.adminSection}>
            <ListSubheader inset>
              {i18n.t("mainDrawer.listItems.administration")}
            </ListSubheader>
          </div>

                    {user.super && (
            <ListItemLink
              to="/server-report"
              primary={i18n.t("adminOps.navigation.serverReport")}
              icon={<DnsIcon />}
            />
          )}

{user.super && (
            <ListItemLink
              to="/announcements"
              primary={i18n.t("mainDrawer.listItems.annoucements")}
              icon={<AnnouncementIcon />}
              iconKey="announcements"
              tooltip={collapsed}
            />
          )}

          {showExternalApi && user.profile === "admin" && (
            <ListItemLink
              to="/messages-api"
              primary={i18n.t("mainDrawer.listItems.messagesAPI")}
              icon={<CodeRoundedIcon />}
              iconKey="api"
              tooltip={collapsed}
            />
          )}

          {user.profile === "admin" && (
            <ListItemLink
              to="/users"
              primary={i18n.t("mainDrawer.listItems.users")}
              icon={<PeopleAltOutlinedIcon />}
              iconKey="users"
              tooltip={collapsed}
            />
          )}

          {user.profile === "admin" && (
            <ListItemLink
              to="/birthday-settings"
              primary={i18n.t("mainDrawer.listItems.birthdaySettings")}
              icon={<CakeIcon />}
              iconKey="birthdays"
              tooltip={collapsed}
            />
          )}

          {user.profile === "admin" && (
            <ListItemLink
              to="/queues"
              primary={i18n.t("mainDrawer.listItems.queues")}
              icon={<AccountTreeOutlinedIcon />}
              iconKey="queues"
              tooltip={collapsed}
            />
          )}

          {user.profile === "admin" && (
            <ListItemLink
              to="/files"
              primary={i18n.t("mainDrawer.listItems.files")}
              icon={<AttachFile />}
              iconKey="files"
              tooltip={collapsed}
            />
          )}

          {showOpenAi && user.profile === "admin" && (
            <ListItemLink
              to="/prompts"
              primary={i18n.t("mainDrawer.listItems.prompts")}
              icon={<AllInclusive />}
              iconKey="prompts"
              tooltip={collapsed}
            />
          )}

          {showIntegrations && user.profile === "admin" && (
            <>
              <ListItemLink
                to="/ai-sdr"
                primary={i18n.t("adminOps.navigation.aiSalesAgent")}
                icon={<WhatshotIcon />}
                iconKey="aiSdr"
                tooltip={collapsed}
              />

              <ListItemLink
                to="/queue-integration"
                primary={i18n.t("mainDrawer.listItems.queueIntegration")}
              icon={<DeviceHubOutlined />}
              iconKey="integrations"
              tooltip={collapsed}
            />
            </>
          )}

          {(user.profile === "admin" || user.allowConnections === "enabled") && (
            <ListItemLink
              to="/connections"
              primary={i18n.t("mainDrawer.listItems.connections")}
              icon={<SyncAltIcon />}
              iconKey="connections"
              showBadge={connectionWarning}
              tooltip={collapsed}
            />
          )}

          {user.profile === "admin" && (
            <ListItemLink
              to="/warmup"
              primary={i18n.t("finalTouches.warmup.title")}
              icon={<WhatshotIcon />}
              iconKey="warmup"
              tooltip={collapsed}
            />
          )}

          {user.super && (
            <ListItemLink
              to="/allConnections"
              primary={i18n.t("mainDrawer.listItems.allConnections")}
              icon={<PhonelinkSetup />}
              iconKey="allConnections"
              tooltip={collapsed}
            />
          )}

          {user.profile === "admin" && (
            <ListItemLink
              to="/financeiro"
              primary={i18n.t("mainDrawer.listItems.financeiro")}
              icon={<LocalAtmIcon />}
              iconKey="financial"
              tooltip={collapsed}
            />
          )}

          {user.profile === "admin" && (
            <ListItemLink
              to="/settings"
              primary={i18n.t("mainDrawer.listItems.settings")}
              icon={<SettingsOutlinedIcon />}
              iconKey="settings"
              tooltip={collapsed}
            />
          )}

          {user.super && (
            <ListItemLink
              to="/companies"
              primary={i18n.t("mainDrawer.listItems.companies")}
              icon={<BusinessIcon />}
              iconKey="companies"
              tooltip={collapsed}
            />
          )}
        </>
      )}

      {!collapsed && (
        <React.Fragment>
          <Divider />
          <Box style={{ padding: "16px", textAlign: "center" }}>
            <Chip
              label={`V${version}`}
              size="small"
              className={classes.versionChip}
            />
          </Box>
        </React.Fragment>
      )}
    </div>
  );
};

export default MainListItems;
