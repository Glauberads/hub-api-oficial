import React, { useContext, useState, useEffect } from "react";

import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";
import { makeStyles } from "@material-ui/core/styles";
import { useTheme } from "@material-ui/core/styles";
import CallIcon from "@material-ui/icons/Call";
import RecordVoiceOverIcon from "@material-ui/icons/RecordVoiceOver";
import GroupAddIcon from "@material-ui/icons/GroupAdd";
import HourglassEmptyIcon from "@material-ui/icons/HourglassEmpty";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import FilterListIcon from "@material-ui/icons/FilterList";
import ClearIcon from "@material-ui/icons/Clear";
import SendIcon from "@material-ui/icons/Send";
import MessageIcon from "@material-ui/icons/Message";
import AccessAlarmIcon from "@material-ui/icons/AccessAlarm";
import TimerIcon from "@material-ui/icons/Timer";
import CheckCircleOutlineIcon from "@material-ui/icons/CheckCircleOutline";
import ErrorOutlineIcon from "@material-ui/icons/ErrorOutline";
import { ArrowDownward, ArrowUpward } from "@material-ui/icons";

import * as XLSX from "xlsx";
import { toast } from "react-toastify";

import MainContainer from "../../components/MainContainer";
import TabPanel from "../../components/TabPanel";
import TableAttendantsStatus from "../../components/Dashboard/TableAttendantsStatus";
import { isArray } from "lodash";

import { AuthContext } from "../../context/Auth/AuthContext";

import useDashboard from "../../hooks/useDashboard";
import useContacts from "../../hooks/useContacts";
import useMessages from "../../hooks/useMessages";
import { ChatsUser } from "./ChartsUser";

import Filters from "./Filters";
import { isEmpty } from "lodash";
import moment from "moment";
import { ChartsDate } from "./ChartsDate";
import {
  Avatar,
  Button as MuiButton,
  Card,
  CardContent,
  Container,
  Stack,
  SvgIcon,
  Tab,
  Tabs,
  LinearProgress,
  Box,
  IconButton,
} from "@mui/material";
import { Groups, SaveAlt } from "@mui/icons-material";
import { i18n } from "../../translate/i18n";
import Grid2 from "@mui/material/Unstable_Grid2/Grid2";
import ForbiddenPage from "../../components/ForbiddenPage";

const useStyles = makeStyles((theme) => {
  const isLight =
    (theme?.palette?.type || theme?.palette?.mode || "light") === "light";

  return {
    overline: {
      fontSize: "0.9rem",
      fontWeight: 700,
      color: theme.palette.text.secondary,
      letterSpacing: "0.5px",
      lineHeight: 2.5,
      textTransform: "uppercase",
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    },
    h4: {
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      fontWeight: 700,
      fontSize: "2rem",
      lineHeight: 1,
      color: theme.palette.text.primary,
    },
    tab: {
      minWidth: "auto",
      width: "auto",
      padding: theme.spacing(0.5, 1),
      borderRadius: 8,
      transition: "0.3s",
      borderWidth: "1px",
      borderStyle: "solid",
      marginRight: theme.spacing(0.5),
      marginLeft: theme.spacing(0.5),
      [theme.breakpoints.down("lg")]: {
        fontSize: "0.9rem",
        padding: theme.spacing(0.4, 0.8),
        marginRight: theme.spacing(0.4),
        marginLeft: theme.spacing(0.4),
      },
      [theme.breakpoints.down("md")]: {
        fontSize: "0.8rem",
        padding: theme.spacing(0.3, 0.6),
        marginRight: theme.spacing(0.3),
        marginLeft: theme.spacing(0.3),
      },
      "&:hover": {
        backgroundColor: "rgba(6, 81, 131, 0.08)",
      },
      "&$selected": {
        color: theme.palette.primary.contrastText,
        backgroundColor: theme.palette.primary.main,
      },
    },
    tabIndicator: {
      borderWidth: "2px",
      borderStyle: "solid",
      height: 6,
      bottom: 0,
      color: isLight
        ? theme.palette.primary.main
        : theme.palette.primary.contrastText,
    },
    container: {
      paddingTop: theme.spacing(1.5),
      paddingBottom: theme.spacing(3),
    },
    nps: {
      paddingTop: theme.spacing(1),
      paddingBottom: theme.spacing(1),
    },
    fixedHeightPaper: {
      padding: theme.spacing(2),
      display: "flex",
      flexDirection: "column",
      height: 240,
      overflowY: "auto",
      ...theme.scrollbarStyles,
    },
    cardAvatar: {
      fontSize: "55px",
      color: theme.palette.text.primary,
      backgroundColor: theme.palette.background.paper,
      width: theme.spacing(7),
      height: theme.spacing(7),
    },
    cardTitle: {
      fontSize: "18px",
      color: theme.palette.primary.main,
    },
    cardSubtitle: {
      color: theme.palette.text.secondary,
      fontSize: "14px",
    },
    alignRight: {
      textAlign: "right",
    },
    fullWidth: {
      width: "100%",
    },
    selectContainer: {
      width: "100%",
      textAlign: "left",
    },
    iframeDashboard: {
      width: "100%",
      height: "calc(100vh - 64px)",
      border: "none",
    },
    customFixedHeightPaperLg: {
      padding: theme.spacing(2),
      display: "flex",
      overflow: "auto",
      flexDirection: "column",
      height: "100%",
    },
    sectionTitle: {
      fontSize: "1.15rem",
      fontWeight: 800,
      color: theme.palette.text.primary,
      marginBottom: theme.spacing(0.5),
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    },
    sectionSubtitle: {
      fontSize: "0.9rem",
      color: theme.palette.text.secondary,
    },
    mainPaper: {
      flex: 1,
      overflowY: "auto",
      overflowX: "hidden",
      ...theme.scrollbarStyles,
      background: isLight
        ? "linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)"
        : `linear-gradient(180deg, ${theme.palette.background.default} 0%, ${theme.palette.background.paper} 100%)`,
      borderRadius: "18px",
      border: "1px solid rgba(255,255,255,0.06)",
    },
    heroCard: {
      position: "relative",
      overflow: "hidden",
      borderRadius: 22,
      padding: theme.spacing(3),
      background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${
        theme.palette.primary.dark || theme.palette.primary.main
      } 100%)`,
      color: "#fff",
      boxShadow: "0 20px 40px rgba(0,0,0,0.18)",
      minHeight: 210,
    },
    heroGlow: {
      position: "absolute",
      right: -70,
      top: -50,
      width: 220,
      height: 220,
      borderRadius: "50%",
      background: "rgba(255,255,255,0.12)",
      filter: "blur(4px)",
    },
    heroGlowSmall: {
      position: "absolute",
      left: -40,
      bottom: -70,
      width: 160,
      height: 160,
      borderRadius: "50%",
      background: "rgba(255,255,255,0.08)",
    },
    heroTop: {
      position: "relative",
      zIndex: 1,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: theme.spacing(2),
      [theme.breakpoints.down("sm")]: {
        flexDirection: "column",
      },
    },
    heroTitle: {
      fontSize: "2rem",
      fontWeight: 800,
      lineHeight: 1.1,
      marginBottom: theme.spacing(1),
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    },
    heroText: {
      color: "rgba(255,255,255,0.88)",
      maxWidth: 700,
      fontSize: "0.95rem",
    },
    heroBadgeRow: {
      display: "flex",
      flexWrap: "wrap",
      gap: theme.spacing(1),
      marginTop: theme.spacing(2),
    },
    heroBadge: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 12px",
      borderRadius: 999,
      background: "rgba(255,255,255,0.14)",
      border: "1px solid rgba(255,255,255,0.18)",
      fontSize: "0.82rem",
      fontWeight: 600,
      backdropFilter: "blur(10px)",
      color: "#fff",
    },
    heroActions: {
      position: "relative",
      zIndex: 1,
      display: "flex",
      flexWrap: "wrap",
      gap: theme.spacing(1),
      justifyContent: "flex-end",
      [theme.breakpoints.down("sm")]: {
        width: "100%",
        justifyContent: "flex-start",
      },
    },
    actionButton: {
      borderRadius: 12,
      textTransform: "none",
      fontWeight: 700,
      padding: "10px 16px",
      boxShadow: "none",
    },
    actionButtonLight: {
      background: "rgba(255,255,255,0.14) !important",
      color: "#fff !important",
      border: "1px solid rgba(255,255,255,0.2) !important",
      "&:hover": {
        background: "rgba(255,255,255,0.2) !important",
      },
    },
    filtersWrapper: {
      borderRadius: 18,
      background: `${theme.palette.background.paper} !important`,
      border: "1px solid rgba(0,0,0,0.06)",
      boxShadow: "0 8px 26px rgba(15,23,42,0.06)",
      padding: theme.spacing(2),
    },
    summaryCard: {
      height: "100%",
      borderRadius: 20,
      boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
      border: "1px solid rgba(0,0,0,0.05)",
      overflow: "hidden",
      position: "relative",
      transition: "all 0.25s ease",
      background: `${theme.palette.background.paper} !important`,
      "&:hover": {
        transform: "translateY(-4px)",
        boxShadow: "0 18px 36px rgba(15,23,42,0.12)",
      },
    },
    summaryStripe: {
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: 4,
    },
    summaryContent: {
      display: "flex",
      alignItems: "center",
      gap: theme.spacing(2),
      padding: theme.spacing(2.2),
    },
    metricCard: {
      height: "100%",
      borderRadius: 18,
      background: `${theme.palette.background.paper} !important`,
      boxShadow: "0 8px 28px rgba(15,23,42,0.06)",
      border: "1px solid rgba(0,0,0,0.05)",
      transition: "all 0.22s ease",
      "&:hover": {
        transform: "translateY(-3px)",
        boxShadow: "0 14px 30px rgba(15,23,42,0.1)",
      },
    },
    metricCardContent: {
      display: "flex",
      alignItems: "center",
      gap: theme.spacing(2),
      padding: theme.spacing(2.1),
    },
    metricAvatar: {
      width: 52,
      height: 52,
      borderRadius: 16,
      boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.2)",
    },
    metricLabel: {
      fontSize: "0.88rem",
      fontWeight: 600,
      color: `${theme.palette.text.secondary} !important`,
      lineHeight: 1.3,
    },
    metricValue: {
      fontSize: "1.35rem",
      fontWeight: 800,
      color: `${theme.palette.text.primary} !important`,
      lineHeight: 1.1,
      marginBottom: 4,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    },
    blockHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.spacing(1.5),
      marginTop: theme.spacing(1),
      gap: theme.spacing(1),
      [theme.breakpoints.down("sm")]: {
        flexDirection: "column",
        alignItems: "flex-start",
      },
    },
    blockTitleWrap: {
      display: "flex",
      flexDirection: "column",
      gap: 2,
    },
    blockEyebrow: {
      fontSize: "0.78rem",
      fontWeight: 800,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: theme.palette.primary.main,
    },
    blockTitle: {
      fontSize: "1.2rem",
      fontWeight: 800,
      color: theme.palette.text.primary,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    },
    blockDescription: {
      fontSize: "0.9rem",
      color: theme.palette.text.secondary,
    },
    sectionPaper: {
      borderRadius: 20,
      padding: theme.spacing(2.2),
      background: `${theme.palette.background.paper} !important`,
      boxShadow: "0 8px 28px rgba(15,23,42,0.06)",
      border: "1px solid rgba(0,0,0,0.05)",
      height: "100%",
    },
    npsCard: {
      borderRadius: 18,
      padding: theme.spacing(2),
      background: `${theme.palette.background.paper} !important`,
      boxShadow: "0 8px 28px rgba(15,23,42,0.06)",
      border: "1px solid rgba(0,0,0,0.05)",
      height: "100%",
    },
    npsHead: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.spacing(1.5),
    },
    npsLabel: {
      fontSize: "0.92rem",
      fontWeight: 700,
      color: theme.palette.text.primary,
    },
    npsValue: {
      fontSize: "1.05rem",
      fontWeight: 800,
      color: theme.palette.text.primary,
    },
    progressBar: {
      width: "100%",
      borderRadius: 999,
      height: 10,
    },
    progressTrack: {
      backgroundColor: isLight ? "#edf2f7" : "rgba(255,255,255,0.08)",
    },
    ratingCard: {
      borderRadius: 20,
      padding: theme.spacing(2.2),
      background: `${theme.palette.background.paper} !important`,
      boxShadow: "0 8px 28px rgba(15,23,42,0.06)",
      border: "1px solid rgba(0,0,0,0.05)",
    },
    ratingHighlight: {
      minWidth: 120,
      borderRadius: 18,
      padding: theme.spacing(2),
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      background: "linear-gradient(135deg, #fff3d7 0%, #ffe7b0 100%)",
      border: "1px solid rgba(247,144,9,0.18)",
    },
    ratingHighlightValue: {
      fontSize: "1.6rem",
      fontWeight: 800,
      color: "#c96c00",
      lineHeight: 1,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    },
    ratingHighlightLabel: {
      marginTop: 6,
      fontSize: "0.78rem",
      fontWeight: 700,
      color: "#8f5a00",
      textTransform: "uppercase",
      letterSpacing: "0.05em",
    },
    tablePaper: {
      borderRadius: 20,
      padding: theme.spacing(2.2),
      background: `${theme.palette.background.paper} !important`,
      boxShadow: "0 8px 28px rgba(15,23,42,0.06)",
      border: "1px solid rgba(0,0,0,0.05)",
    },
    chartPaper: {
      borderRadius: 20,
      padding: theme.spacing(2.2),
      background: `${theme.palette.background.paper} !important`,
      boxShadow: "0 8px 28px rgba(15,23,42,0.06)",
      border: "1px solid rgba(0,0,0,0.05)",
      height: "100%",
    },
    chartHeader: {
      marginBottom: theme.spacing(2),
    },
    chipLike: {
      display: "inline-flex",
      alignItems: "center",
      padding: "7px 10px",
      borderRadius: 999,
      background: isLight ? "#f1f5f9" : "rgba(255,255,255,0.06)",
      color: theme.palette.text.secondary,
      fontSize: "0.78rem",
      fontWeight: 700,
    },
    loadingBarTop: {
      width: "100%",
      marginTop: theme.spacing(2),
      borderRadius: 999,
      overflow: "hidden",
      background: "rgba(255,255,255,0.22)",
    },
  };
});

const Dashboard = () => {
  const theme = useTheme();
  const classes = useStyles();

  const [counters, setCounters] = useState({});
  const [attendants, setAttendants] = useState([]);
  const [filterType, setFilterType] = useState(1);
  const [period, setPeriod] = useState(0);
  const [dateFrom, setDateFrom] = useState(
    moment("1", "D").format("YYYY-MM-DD")
  );
  const [dateTo, setDateTo] = useState(moment().format("YYYY-MM-DD"));
  const [loading, setLoading] = useState(false);
  const { find } = useDashboard();

  const [tab, setTab] = useState("Indicadores");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [selectedQueues, setSelectedQueues] = useState([]);

  let newDate = new Date();
  let date = newDate.getDate();
  let month = newDate.getMonth() + 1;
  let year = newDate.getFullYear();
  let nowIni = `${year}-${month < 10 ? `0${month}` : `${month}`}-01`;
  let now = `${year}-${month < 10 ? `0${month}` : `${month}`}-${date < 10 ? `0${date}` : `${date}`}`;

  const [showFilter, setShowFilter] = useState(false);
  const [dateStartTicket, setDateStartTicket] = useState(nowIni);
  const [dateEndTicket, setDateEndTicket] = useState(now);
  const [queueTicket, setQueueTicket] = useState(false);
  const [fetchDataFilter, setFetchDataFilter] = useState(false);

  const { user } = useContext(AuthContext);

  const exportarGridParaExcel = () => {
    const table =
      document.getElementById("grid-attendants") ||
      document.querySelector("#grid-attendants-wrapper table");

    if (!table) {
      toast.error("Tabela de atendentes não encontrada para exportação.");
      return;
    }

    const ws = XLSX.utils.table_to_sheet(table);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "RelatorioDeAtendentes");
    XLSX.writeFile(wb, "relatorio-de-atendentes.xlsx");
  };

  let userQueueIds = [];

  if (user.queues && user.queues.length > 0) {
    userQueueIds = user.queues.map((q) => q.id);
  }

  useEffect(() => {
    let isMounted = true;

    async function firstLoad() {
      if (isMounted) {
        await fetchData();
      }
    }

    const timeoutId = setTimeout(() => {
      firstLoad();
    }, 500);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchDataFilter]);

  async function fetchData() {
    setLoading(true);

    let params = {};

    if (period > 0) {
      params = {
        days: period,
      };
    } else {
      if (!isEmpty(dateStartTicket) && moment(dateStartTicket).isValid()) {
        params = {
          ...params,
          date_from: moment(dateStartTicket).format("YYYY-MM-DD"),
        };
      }

      if (!isEmpty(dateEndTicket) && moment(dateEndTicket).isValid()) {
        params = {
          ...params,
          date_to: moment(dateEndTicket).format("YYYY-MM-DD"),
        };
      }
    }

    if (Object.keys(params).length === 0) {
      params = { days: 30 };
    }

    try {
      const data = await find(params);

      const safeCounters = data.counters || {};
      setCounters(safeCounters);

      if (isArray(data.attendants)) {
        setAttendants(data.attendants);
      } else {
        setAttendants([]);
      }
    } catch (error) {
      toast.error("Erro ao carregar dados do dashboard");

      setCounters({
        avgSupportTime: 0,
        avgWaitTime: 0,
        supportFinished: 0,
        supportHappening: 0,
        supportPending: 0,
        supportGroups: 0,
        leads: 0,
        activeTickets: 0,
        passiveTickets: 0,
        tickets: 0,
        waitRating: 0,
        withoutRating: 0,
        withRating: 0,
        percRating: 0,
        npsPromotersPerc: 0,
        npsPassivePerc: 0,
        npsDetractorsPerc: 0,
        npsScore: 0,
      });
      setAttendants([]);
    } finally {
      setLoading(false);
    }
  }

  const handleSelectedUsers = (selecteds) => {
    const users = selecteds.map((t) => t.id);
    setSelectedUsers(users);
  };

  const handleChangeTab = (e, newValue) => {
    setTab(newValue);
  };

  function formatTime(minutes) {
    return moment()
      .startOf("day")
      .add(Number(minutes) || 0, "minutes")
      .format("HH[h] mm[m]");
  }

  const GetUsers = () => {
    let count;
    let userOnline = 0;
    attendants.forEach((user) => {
      if (user.online === true) {
        userOnline = userOnline + 1;
      }
    });
    count = userOnline === 0 ? 0 : userOnline;
    return count;
  };

  const GetContacts = (all) => {
    let props = {};
    if (all) {
      props = {};
    } else {
      props = {
        dateStart: dateStartTicket,
        dateEnd: dateEndTicket,
      };
    }
    const { count } = useContacts(props);
    return count;
  };

  const GetMessages = (all, fromMe) => {
    let props = {};
    if (all) {
      if (fromMe) {
        props = {
          fromMe: true,
        };
      } else {
        props = {
          fromMe: false,
        };
      }
    } else {
      if (fromMe) {
        props = {
          fromMe: true,
          dateStart: dateStartTicket,
          dateEnd: dateEndTicket,
        };
      } else {
        props = {
          fromMe: false,
          dateStart: dateStartTicket,
          dateEnd: dateEndTicket,
        };
      }
    }
    const { count } = useMessages(props);
    return count;
  };

  function toggleShowFilter() {
    setShowFilter(!showFilter);
  }

  const safeNumber = (value) => Number(value) || 0;
  const dateRangeLabel =
    period > 0
      ? i18n.t("analytics.dashboard.lastDays", { count: period })
      : `${moment(dateStartTicket).format("DD/MM/YYYY")} ${i18n.t("analytics.dashboard.until")} ${moment(dateEndTicket).format("DD/MM/YYYY")}`;

  const summaryCards = [
    {
      label: i18n.t("analytics.dashboard.totalAttendances"),
      value: safeNumber(counters.tickets),
      icon: <CallIcon />,
      bg: "linear-gradient(135deg, rgba(1,187,172,0.16) 0%, rgba(1,187,172,0.06) 100%)",
      color: "#01BBAC",
    },
    {
      label: i18n.t("analytics.dashboard.inService"),
      value: safeNumber(counters.supportHappening),
      icon: <RecordVoiceOverIcon />,
      bg: "linear-gradient(135deg, rgba(88,82,171,0.16) 0%, rgba(88,82,171,0.06) 100%)",
      color: "#5852ab",
    },
    {
      label: "NPS Score",
      value: `${safeNumber(counters.npsScore)}%`,
      icon: <CheckCircleIcon />,
      bg: "linear-gradient(135deg, rgba(46,168,90,0.16) 0%, rgba(46,168,90,0.06) 100%)",
      color: "#2EA85A",
    },
    {
      label: i18n.t("analytics.dashboard.ratingIndex"),
      value: `${safeNumber(counters.percRating)}%`,
      icon: <AccessAlarmIcon />,
      bg: "linear-gradient(135deg, rgba(247,144,9,0.16) 0%, rgba(247,144,9,0.06) 100%)",
      color: "#F79009",
    },
  ];

  const generalIndicators = [
    {
      label: i18n.t("analytics.dashboard.inService"),
      value: safeNumber(counters.supportHappening),
      icon: <CallIcon />,
      color: "#01BBAC",
      bg: "rgba(1,187,172,0.16)",
    },
    {
      label: i18n.t("analytics.dashboard.waiting"),
      value: safeNumber(counters.supportPending),
      icon: <HourglassEmptyIcon />,
      color: "#47606e",
      bg: "rgba(71,96,110,0.14)",
    },
    {
      label: i18n.t("analytics.dashboard.finished"),
      value: safeNumber(counters.supportFinished),
      icon: <CheckCircleIcon />,
      color: "#5852ab",
      bg: "rgba(88,82,171,0.14)",
    },
    {
      label: i18n.t("analytics.dashboard.groups"),
      value: safeNumber(counters.supportGroups),
      icon: <Groups />,
      color: "#01BBAC",
      bg: "rgba(1,187,172,0.16)",
    },
    {
      label: i18n.t("analytics.dashboard.activeAgents"),
      value: `${GetUsers()}/${attendants.length}`,
      icon: <RecordVoiceOverIcon />,
      color: "#805753",
      bg: "rgba(128,87,83,0.16)",
    },
    {
      label: i18n.t("analytics.dashboard.newContacts"),
      value: safeNumber(counters.leads),
      icon: <GroupAddIcon />,
      color: "#8c6b19",
      bg: "rgba(140,107,25,0.16)",
    },
    {
      label: i18n.t("analytics.dashboard.receivedMessages"),
      value: `${GetMessages(false, false)}/${GetMessages(true, false)}`,
      icon: <MessageIcon />,
      color: "#333133",
      bg: "rgba(51,49,51,0.12)",
    },
    {
      label: i18n.t("analytics.dashboard.sentMessages"),
      value: `${GetMessages(false, true)}/${GetMessages(true, true)}`,
      icon: <SendIcon />,
      color: "#558a59",
      bg: "rgba(85,138,89,0.15)",
    },
    {
      label: i18n.t("analytics.dashboard.avgServiceTime"),
      value: formatTime(counters.avgSupportTime),
      icon: <AccessAlarmIcon />,
      color: "#F79009",
      bg: "rgba(247,144,9,0.16)",
    },
    {
      label: i18n.t("analytics.dashboard.avgWaitTime"),
      value: formatTime(counters.avgWaitTime),
      icon: <TimerIcon />,
      color: "#8a2c40",
      bg: "rgba(138,44,64,0.16)",
    },
    {
      label: i18n.t("analytics.dashboard.activeTickets"),
      value: safeNumber(counters.activeTickets),
      icon: <ArrowUpward />,
      color: "#EE4512",
      bg: "rgba(238,69,18,0.16)",
    },
    {
      label: i18n.t("analytics.dashboard.passiveTickets"),
      value: safeNumber(counters.passiveTickets),
      icon: <ArrowDownward />,
      color: "#28C037",
      bg: "rgba(40,192,55,0.16)",
    },
  ];

  const npsIndicators = [
    {
      label: i18n.t("analytics.dashboard.score"),
      description: i18n.t("analytics.dashboard.scoreHelp"),
      value: safeNumber(counters.npsScore),
      color: "#0F172A",
    },
    {
      label: i18n.t("analytics.dashboard.promoters"),
      description: i18n.t("analytics.dashboard.percentageHelp", { label: i18n.t("analytics.dashboard.promoters").toLowerCase() }),
      value: safeNumber(counters.npsPromotersPerc),
      color: "#2EA85A",
    },
    {
      label: i18n.t("analytics.dashboard.passives"),
      description: i18n.t("analytics.dashboard.percentageHelp", { label: i18n.t("analytics.dashboard.passives").toLowerCase() }),
      value: safeNumber(counters.npsPassivePerc),
      color: "#EAB308",
    },
    {
      label: i18n.t("analytics.dashboard.detractors"),
      description: i18n.t("analytics.dashboard.percentageHelp", { label: i18n.t("analytics.dashboard.detractors").toLowerCase() }),
      value: safeNumber(counters.npsDetractorsPerc),
      color: "#EF4444",
    },
  ];

  const attendanceCards = [
    {
      label: i18n.t("analytics.dashboard.totalAttendances"),
      value: safeNumber(counters.tickets),
      icon: <CallIcon />,
      color: "#01BBAC",
      bg: "rgba(1,187,172,0.16)",
    },
    {
      label: i18n.t("analytics.dashboard.waitingRating"),
      value: safeNumber(counters.waitRating),
      icon: <HourglassEmptyIcon />,
      color: "#47606e",
      bg: "rgba(71,96,110,0.14)",
    },
    {
      label: i18n.t("analytics.dashboard.withoutRating"),
      value: safeNumber(counters.withoutRating),
      icon: <ErrorOutlineIcon />,
      color: "#8a2c40",
      bg: "rgba(138,44,64,0.16)",
    },
    {
      label: i18n.t("analytics.dashboard.ratedAttendances"),
      value: safeNumber(counters.withRating),
      icon: <CheckCircleOutlineIcon />,
      color: "#805753",
      bg: "rgba(128,87,83,0.16)",
    },
  ];

  return (
    <>
      {user.profile === "user" && user.showDashboard === "disabled" ? (
        <ForbiddenPage />
      ) : (
        <MainContainer>
          <Paper className={classes.mainPaper} variant="outlined">
            <Container
              maxWidth={false}
              className={classes.container}
              style={{ padding: "18px 14px", maxWidth: "100%", overflowX: "hidden" }}
            >
              <Grid2 container spacing={2.5}>
                <Grid2 xs={12}>
                  <div className={classes.heroCard}>
                    <div className={classes.heroGlow} />
                    <div className={classes.heroGlowSmall} />

                    <div className={classes.heroTop}>
                      <div>
                        <Typography className={classes.heroTitle}>
                          {i18n.t("analytics.dashboard.title")}
                        </Typography>
                        <Typography className={classes.heroText}>
                          {i18n.t("analytics.dashboard.subtitle")}
                        </Typography>

                        <div className={classes.heroBadgeRow}>
                          <span className={classes.heroBadge}>
                            {i18n.t("analytics.dashboard.period")}: {dateRangeLabel}
                          </span>
                          <span className={classes.heroBadge}>
                            {i18n.t("analytics.dashboard.onlineAgents")}: {GetUsers()}
                          </span>
                          <span className={classes.heroBadge}>
                            {i18n.t("analytics.dashboard.totalTickets")}: {safeNumber(counters.tickets)}
                          </span>
                        </div>
                      </div>

                      <div className={classes.heroActions}>
                        <Button
                          onClick={toggleShowFilter}
                          startIcon={!showFilter ? <FilterListIcon /> : <ClearIcon />}
                          className={`${classes.actionButton} ${classes.actionButtonLight}`}
                        >
                          {showFilter ? i18n.t("analytics.dashboard.hideFilters") : i18n.t("analytics.dashboard.showFilters")}
                        </Button>

                        <MuiButton
                          onClick={exportarGridParaExcel}
                          startIcon={<SaveAlt />}
                          className={`${classes.actionButton} ${classes.actionButtonLight}`}
                        >
                          {i18n.t("analytics.dashboard.exportAgents")}
                        </MuiButton>
                      </div>
                    </div>

                    {loading && (
                      <div className={classes.loadingBarTop}>
                        <LinearProgress color="inherit" />
                      </div>
                    )}
                  </div>
                </Grid2>

                {showFilter && (
                  <Grid2 xs={12}>
                    <div className={classes.filtersWrapper}>
                      <Filters
                        classes={classes}
                        setDateStartTicket={setDateStartTicket}
                        setDateEndTicket={setDateEndTicket}
                        dateStartTicket={dateStartTicket}
                        dateEndTicket={dateEndTicket}
                        setQueueTicket={setQueueTicket}
                        queueTicket={queueTicket}
                        fetchData={setFetchDataFilter}
                      />
                    </div>
                  </Grid2>
                )}

                {summaryCards.map((card, index) => (
                  <Grid2 xs={12} sm={6} lg={3} key={`summary-${index}`}>
                    <Card className={classes.summaryCard}>
                      <div
                        className={classes.summaryStripe}
                        style={{ background: card.color }}
                      />
                      <div className={classes.summaryContent}>
                        <Avatar
                          style={{
                            background: card.bg,
                            color: card.color,
                            width: 56,
                            height: 56,
                            borderRadius: 18,
                          }}
                        >
                          {card.icon}
                        </Avatar>
                        <Box>
                          <Typography className={classes.metricValue}>
                            {card.value}
                          </Typography>
                          <Typography className={classes.metricLabel}>
                            {card.label}
                          </Typography>
                        </Box>
                      </div>
                    </Card>
                  </Grid2>
                ))}

                <Grid2 xs={12}>
                  <div className={classes.blockHeader}>
                    <div className={classes.blockTitleWrap}>
                      <Typography className={classes.blockEyebrow}>
                        {i18n.t("analytics.dashboard.overview")}
                      </Typography>
                      <Typography className={classes.blockTitle}>
                        {i18n.t("analytics.dashboard.mainIndicators")}
                      </Typography>
                      <Typography className={classes.blockDescription}>
                        {i18n.t("analytics.dashboard.mainIndicatorsHelp")}
                      </Typography>
                    </div>
                    <span className={classes.chipLike}>{i18n.t("analytics.dashboard.autoRefresh")}</span>
                  </div>
                </Grid2>

                {generalIndicators.map((indicator, index) => (
                  <Grid2 xs={12} sm={6} md={4} lg={3} key={`indicator-${index}`}>
                    <Card className={classes.metricCard}>
                      <CardContent className={classes.metricCardContent}>
                        <Avatar
                          className={classes.metricAvatar}
                          style={{
                            background: indicator.bg,
                            color: indicator.color,
                          }}
                        >
                          {indicator.icon}
                        </Avatar>

                        <Box>
                          <Typography className={classes.metricValue}>
                            {indicator.value}
                          </Typography>
                          <Typography className={classes.metricLabel}>
                            {indicator.label}
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid2>
                ))}

                <Grid2 xs={12}>
                  <div className={classes.blockHeader}>
                    <div className={classes.blockTitleWrap}>
                      <Typography className={classes.blockEyebrow}>
                        {i18n.t("analytics.dashboard.customerExperience")}
                      </Typography>
                      <Typography className={classes.blockTitle}>
                        {i18n.t("analytics.dashboard.satisfactionSurvey")}
                      </Typography>
                      <Typography className={classes.blockDescription}>
                        {i18n.t("analytics.dashboard.npsHelp")}
                      </Typography>
                    </div>
                  </div>
                </Grid2>

                {npsIndicators.map((item, index) => (
                  <Grid2 xs={12} md={6} lg={3} key={`nps-${index}`}>
                    <div className={classes.npsCard}>
                      <div className={classes.npsHead}>
                        <Typography className={classes.npsLabel}>
                          {item.label}
                        </Typography>
                        <Typography className={classes.npsValue}>
                          {item.value}%
                        </Typography>
                      </div>

                      <LinearProgress
                        variant="determinate"
                        value={item.value}
                        className={classes.progressBar}
                        classes={{ colorPrimary: classes.progressTrack }}
                        style={{ color: item.color }}
                      />

                      <Box mt={1.5}>
                        <Typography className={classes.metricLabel}>
                          {item.description}
                        </Typography>
                      </Box>
                    </div>
                  </Grid2>
                ))}

                <Grid2 xs={12}>
                  <div className={classes.blockHeader}>
                    <div className={classes.blockTitleWrap}>
                      <Typography className={classes.blockEyebrow}>
                        {i18n.t("analytics.dashboard.operation")}
                      </Typography>
                      <Typography className={classes.blockTitle}>
                        {i18n.t("analytics.dashboard.attendances")}
                      </Typography>
                      <Typography className={classes.blockDescription}>
                        {i18n.t("analytics.dashboard.attendancesHelp")}
                      </Typography>
                    </div>
                  </div>
                </Grid2>

                {attendanceCards.map((item, index) => (
                  <Grid2 xs={12} sm={6} md={3} key={`attendance-${index}`}>
                    <Card className={classes.metricCard}>
                      <CardContent className={classes.metricCardContent}>
                        <Avatar
                          className={classes.metricAvatar}
                          style={{
                            background: item.bg,
                            color: item.color,
                          }}
                        >
                          {item.icon}
                        </Avatar>

                        <Box>
                          <Typography className={classes.metricValue}>
                            {item.value}
                          </Typography>
                          <Typography className={classes.metricLabel}>
                            {item.label}
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid2>
                ))}

                <Grid2 xs={12}>
                  <div className={classes.ratingCard}>
                    <div className={classes.blockHeader} style={{ marginTop: 0 }}>
                      <div className={classes.blockTitleWrap}>
                        <Typography className={classes.blockEyebrow}>
                          {i18n.t("analytics.dashboard.performance")}
                        </Typography>
                        <Typography className={classes.blockTitle}>
                          {i18n.t("dashboard.assessments.evaluationIndex")}
                        </Typography>
                        <Typography className={classes.blockDescription}>
                          {i18n.t("analytics.dashboard.evaluationHelp")}
                        </Typography>
                      </div>
                    </div>

                    <Grid2 container spacing={2} alignItems="center">
                      <Grid2 xs={12} md={3}>
                        <div className={classes.ratingHighlight}>
                          <Typography className={classes.ratingHighlightValue}>
                            {safeNumber(counters.percRating)}%
                          </Typography>
                          <Typography className={classes.ratingHighlightLabel}>
                            {i18n.t("analytics.dashboard.evaluation")}
                          </Typography>
                        </div>
                      </Grid2>

                      <Grid2 xs={12} md={9}>
                        <LinearProgress
                          variant="determinate"
                          value={safeNumber(counters.percRating)}
                          className={classes.progressBar}
                          classes={{ colorPrimary: classes.progressTrack }}
                          style={{ color: "#F79009", height: 14 }}
                        />
                        <Box mt={1.5}>
                          <Typography className={classes.metricLabel}>
                            {i18n.t("analytics.dashboard.evaluationExplanation")}
                          </Typography>
                        </Box>
                      </Grid2>
                    </Grid2>
                  </div>
                </Grid2>

                <Grid2 xs={12}>
                  <div className={classes.blockHeader}>
                    <div className={classes.blockTitleWrap}>
                      <Typography className={classes.blockEyebrow}>
                        {i18n.t("analytics.dashboard.team")}
                      </Typography>
                      <Typography className={classes.blockTitle}>
                        {i18n.t("analytics.dashboard.agents")}
                      </Typography>
                      <Typography className={classes.blockDescription}>
                        {i18n.t("analytics.dashboard.teamHelp")}
                      </Typography>
                    </div>
                  </div>
                </Grid2>

                <Grid2 xs={12}>
                  <div className={classes.tablePaper} id="grid-attendants-wrapper">
                    <TableAttendantsStatus attendants={attendants} loading={loading} />
                  </div>
                </Grid2>

                <Grid2 xs={12}>
                  <div className={classes.blockHeader}>
                    <div className={classes.blockTitleWrap}>
                      <Typography className={classes.blockEyebrow}>
                        {i18n.t("analytics.dashboard.analytics")}
                      </Typography>
                      <Typography className={classes.blockTitle}>
                        {i18n.t("analytics.dashboard.charts")}
                      </Typography>
                      <Typography className={classes.blockDescription}>
                        {i18n.t("analytics.dashboard.chartsHelp")}
                      </Typography>
                    </div>
                  </div>
                </Grid2>

                <Grid2 xs={12} md={6}>
                  <div className={classes.chartPaper}>
                    <div className={classes.chartHeader}>
                      <Typography className={classes.sectionTitle}>
                        {i18n.t("analytics.dashboard.byUser")}
                      </Typography>
                      <Typography className={classes.sectionSubtitle}>
                        {i18n.t("analytics.dashboard.byUserHelp")}
                      </Typography>
                    </div>
                    <ChatsUser />
                  </div>
                </Grid2>

                <Grid2 xs={12} md={6}>
                  <div className={classes.chartPaper}>
                    <div className={classes.chartHeader}>
                      <Typography className={classes.sectionTitle}>
                        {i18n.t("analytics.dashboard.byDate")}
                      </Typography>
                      <Typography className={classes.sectionSubtitle}>
                        {i18n.t("analytics.dashboard.byDateHelp")}
                      </Typography>
                    </div>
                    <ChartsDate />
                  </div>
                </Grid2>
              </Grid2>
            </Container>
          </Paper>
        </MainContainer>
      )}
    </>
  );
};

export default Dashboard;
