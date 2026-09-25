import React, { useState, useEffect, useContext, useCallback } from "react";
import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import IconButton from "@material-ui/core/IconButton";
import SearchIcon from "@material-ui/icons/Search";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";
import PhoneIcon from "@material-ui/icons/Phone";
import DownloadIcon from "@material-ui/icons/CloudDownload";
import CallMadeIcon from "@material-ui/icons/CallMade";
import CallReceivedIcon from "@material-ui/icons/CallReceived";
import Chip from "@material-ui/core/Chip";
import Card from "@material-ui/core/Card";
import CardContent from "@material-ui/core/CardContent";
import Typography from "@material-ui/core/Typography";
import MenuItem from "@material-ui/core/MenuItem";
import RefreshIcon from "@material-ui/icons/Refresh";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import api from "../../services/api";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";
import { Grid } from "@material-ui/core";
import { AuthContext } from "../../context/Auth/AuthContext";
import Checkbox from "@material-ui/core/Checkbox";
import Button from "@material-ui/core/Button";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(1),
    overflowY: "auto",
    ...theme.scrollbarStyles
  },

  filtersContainer: {
    marginBottom: theme.spacing(2)
  },

  phoneChip: {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    fontWeight: 600
  },

  actionButton: {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    "&:hover": {
      backgroundColor: theme.palette.primary.dark || theme.palette.primary.main
    }
  },

  deleteButton: {
    backgroundColor: "#f44336",
    color: "#fff",
    marginLeft: 6,
    "&:hover": {
      backgroundColor: "#d32f2f"
    }
  },

  downloadButton: {
    backgroundColor: "#4caf50",
    color: "#fff",
    "&:hover": {
      backgroundColor: "#43a047"
    }
  },

  statusChip: {
    minWidth: 95,
    fontWeight: 600
  },

  statusOpened: {
    backgroundColor: "#e3f2fd",
    color: "#1565c0"
  },

  statusAnswered: {
    backgroundColor: "#e8f5e9",
    color: "#2e7d32"
  },

  statusEnded: {
    backgroundColor: "#fff3e0",
    color: "#ef6c00"
  },

  statusRejected: {
    backgroundColor: "#ffebee",
    color: "#c62828"
  },

  statusMissed: {
    backgroundColor: "#f3e5f5",
    color: "#6a1b9a"
  },

  statusDefault: {
    backgroundColor: "#eeeeee",
    color: "#424242"
  },

  directionWrapper: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 4
  },

  outgoingIcon: {
    color: "#1976d2"
  },

  incomingIcon: {
    color: "#2e7d32"
  },

  statsCard: {
    minHeight: 86,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    borderRadius: 12,
    boxShadow: "0 4px 16px rgba(0,0,0,0.12)"
  },

  statsTotal: {
    background: `linear-gradient(45deg, ${theme.palette.primary.main} 30%, ${theme.palette.primary.light || theme.palette.primary.main} 90%)`
  },

  statsOutgoing: {
    background: "linear-gradient(45deg, #1976d2 30%, #64b5f6 90%)"
  },

  statsIncoming: {
    background: "linear-gradient(45deg, #2e7d32 30%, #81c784 90%)"
  },

  statsRejected: {
    background: "linear-gradient(45deg, #c62828 30%, #ef5350 90%)"
  },

  statsContent: {
    textAlign: "center",
    padding: "10px !important"
  },

  statsNumber: {
    fontSize: "2rem",
    fontWeight: "bold",
    lineHeight: 1.1
  },

  statsLabel: {
    fontSize: "0.85rem",
    opacity: 0.95
  },

  emptyCell: {
    padding: theme.spacing(4),
    color: theme.palette.text.secondary
  },

  mutedText: {
    color: theme.palette.text.secondary,
    fontSize: 12
  }
}));

const normalizeText = (value) => String(value || "").toLowerCase().trim();

const getRawDirection = (call) => {


  return (
    call?.direction ||
    call?.devices?.direction ||
    call?.devices?.callDirection ||
    ""
  );
};

const getDirection = (call) => {
  const value = normalizeText(getRawDirection(call));

  if (
    value === "incoming" ||
    value === "in" ||
    value === "received" ||
    value === "entrada"
  ) {
    return "incoming";
  }

  if (
    value === "outcoming" ||
    value === "outgoing" ||
    value === "out" ||
    value === "saida" ||
    value === "saída"
  ) {
    return "outgoing";
  }

  return "outgoing";
};

const getRawStatus = (call) => {
  return (
    call?.status ||
    call?.devices?.status ||
    call?.devices?.callStatus ||
    "created"
  );
};

const getStatus = (call) => normalizeText(getRawStatus(call));

const getCallNumber = (call) => {
  return (
    call?.phone_to ||
    call?.devices?.phone ||
    call?.devices?.caller ||
    call?.contact?.number ||
    ""
  );
};

const getCallName = (call) => {
  return (
    call?.contact?.name ||
    call?.name ||
    call?.devices?.name ||
    (getDirection(call) === "incoming" ? i18n.t("analytics.calls.received") : i18n.t("analytics.calls.outgoing"))
  );
};

const getCallDate = (call) => {
  return (
    call?.started_at ||
    call?.createdAt ||
    call?.devices?.started_at ||
    call?.devices?.created_date ||
    call?.ended_at
  );
};

const getCallDuration = (call) => {
  return Number(call?.duration || call?.devices?.duration || 0);
};

const getCallSource = (call) => {
  return call?.source || call?.devices?.source || "wavoip";
};

const isMetaOfficialSource = (source) => {
  const value = String(source || "").toLowerCase();

  return (
    value.includes("meta_official") ||
    value.includes("meta_oficial") ||
    (value.includes("meta") && (value.includes("official") || value.includes("oficial")))
  );
};

const isRecordingUrl = (url) => {
  const value = String(url || "").toLowerCase();

  return (
    value.includes("storage.wavoip.com") ||
    value.includes("/official-call-recordings/") ||
    value.includes("/recording") ||
    value.includes("/records") ||
    value.endsWith(".mp3") ||
    value.endsWith(".ogg") ||
    value.endsWith(".wav") ||
    value.endsWith(".webm")
  );
};

const getRecordingUrl = (call) => {
  const candidates = [
    call?.callSaveUrl,
    call?.call_save_url,
    call?.recordingUrl,
    call?.recording_url,
    call?.recording,
    call?.url
  ].filter(Boolean);

  return candidates.find((url) => isRecordingUrl(url)) || "";
};

const isWavoipSource = (source) => {
  const value = String(source || "").toLowerCase();

  return (
    value.includes("wavoip") ||
    value.includes("widget_app_url") ||
    value.includes("conversation-button") ||
    value.includes("wavoip-widget") ||
    value.includes("wavoip-v2")
  );
};

const getCallBackUrl = (call) => {
  const candidates = [
    call?.callUrl,
    call?.call_url,
    call?.callbackUrl,
    call?.callback_url,
    call?.widgetUrl,
    call?.widget_url,
    call?.url
  ].filter(Boolean);

  const validCallUrl = candidates.find((url) => {
    const value = String(url || "");

    if (!value) return false;
    if (isRecordingUrl(value)) return false;

    return true;
  });

  return validCallUrl || "";
};

const formatDate = (dateString) => {
  if (!dateString) return "N/A";

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) return "N/A";

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

const formatPhone = (phone) => {
  const cleaned = String(phone || "").replace(/\D/g, "");

  if (!cleaned) return "N/A";

  if (cleaned.startsWith("55") && cleaned.length >= 12) {
    const ddd = cleaned.substring(2, 4);
    const number = cleaned.substring(4);

    if (number.length === 9) {
      return `+55 (${ddd}) ${number.substring(0, 5)}-${number.substring(5)}`;
    }

    if (number.length === 8) {
      return `+55 (${ddd}) ${number.substring(0, 4)}-${number.substring(4)}`;
    }
  }

  return cleaned;
};

const formatDuration = (duration) => {
  const totalSeconds = Number(duration || 0);

  if (!totalSeconds) return "00:00";

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
};

const getStatusLabel = (status) => {
  const value = normalizeText(status);

  switch (value) {
    case "opened":
      return i18n.t("analytics.calls.opened");
    case "created":
      return i18n.t("analytics.calls.created");
    case "received":
    case "offer":
      return i18n.t("analytics.calls.received");
    case "answered":
    case "served":
    case "active":
      return i18n.t("analytics.calls.answered");
    case "ringing":
      return i18n.t("analytics.calls.ringing");
    case "ended":
    case "finish":
    case "finished":
    case "completed":
      return i18n.t("analytics.calls.finished");
    case "rejected":
    case "reject":
      return i18n.t("analytics.calls.rejectedSingle");
    case "missed":
    case "unanswered":
    case "timeout":
    case "no_answer":
      return i18n.t("analytics.calls.missed");
    case "busy":
      return i18n.t("analytics.calls.busy");
    default:
      return status ? String(status).toUpperCase() : "N/A";
  }
};

const getStatusClassName = (classes, status) => {
  const value = normalizeText(status);

  if (["opened", "created", "received", "offer", "ringing"].includes(value)) {
    return `${classes.statusChip} ${classes.statusOpened}`;
  }

  if (["answered", "served", "active"].includes(value)) {
    return `${classes.statusChip} ${classes.statusAnswered}`;
  }

  if (["ended", "finish", "finished", "completed"].includes(value)) {
    return `${classes.statusChip} ${classes.statusEnded}`;
  }

  if (["rejected", "reject", "busy"].includes(value)) {
    return `${classes.statusChip} ${classes.statusRejected}`;
  }

  if (["missed", "unanswered", "timeout", "no_answer"].includes(value)) {
    return `${classes.statusChip} ${classes.statusMissed}`;
  }

  return `${classes.statusChip} ${classes.statusDefault}`;
};

const getDirectionLabel = (direction) => {
  return direction === "incoming" ? i18n.t("analytics.calls.entry") : i18n.t("analytics.calls.exit");
};

const CallHistoricals = () => {
  const classes = useStyles();
  const { user, socket } = useContext(AuthContext);

  const [loading, setLoading] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [directionFilter, setDirectionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [callHistory, setCallHistory] = useState([]);
  const [selectedCallIds, setSelectedCallIds] = useState([]);
  const [statistics, setStatistics] = useState({
    total: 0,
    totalReject: 0,
    totalServed: 0,
    totalFinish: 0,
    totalIncoming: 0,
    totalOutgoing: 0,
    totalMissed: 0
  });

  const fetchCallHistory = useCallback(async () => {
    try {
      setLoading(true);

      const { data } = await api.get("/call/historical");

      const historical = data?.historical || {};
      const resultFinal = Array.isArray(historical.resultFinal)
        ? historical.resultFinal
        : [];

      setCallHistory(resultFinal);
      setSelectedCallIds([]);

      setStatistics({
        total: historical.total || resultFinal.length || 0,
        totalReject: historical.totalReject || 0,
        totalServed: historical.totalServed || 0,
        totalFinish: historical.totalFinish || 0,
        totalIncoming:
          historical.totalIncoming ||
          resultFinal.filter((call) => getDirection(call) === "incoming").length,
        totalOutgoing:
          historical.totalOutgoing ||
          resultFinal.filter((call) => getDirection(call) === "outgoing").length,
        totalMissed: historical.totalMissed || 0
      });
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCallHistory();
  }, [fetchCallHistory]);

  useEffect(() => {
    const companyId = user?.companyId;

    if (!socket || !companyId) return undefined;

    const onCallHistoryEvent = (data) => {
      if (!data?.record) return;

      if (data.action === "update" || data.action === "create") {
        setCallHistory((prev) => {
          const index = prev.findIndex((item) => item.id === data.record.id);

          if (index !== -1) {
            const next = [...prev];
            next[index] = data.record;
            return next;
          }

          return [data.record, ...prev];
        });
      }
    };

    socket.on(`company-${companyId}-call-history`, onCallHistoryEvent);

    return () => {
      socket.off(`company-${companyId}-call-history`, onCallHistoryEvent);
    };
  }, [socket, user?.companyId]);

  const filteredCallHistory = callHistory.filter((call) => {
    const name = normalizeText(getCallName(call));
    const phone = normalizeText(getCallNumber(call));
    const attendant = normalizeText(call?.user?.name);
    const source = normalizeText(getCallSource(call));
    const status = getStatus(call);
    const direction = getDirection(call);

    const search = normalizeText(searchParam);

    const matchesSearch =
      !search ||
      name.includes(search) ||
      phone.includes(search) ||
      attendant.includes(search) ||
      source.includes(search);

    const matchesDirection =
      directionFilter === "all" || direction === directionFilter;

    const matchesStatus =
      statusFilter === "all" ||
      status === statusFilter ||
      getStatusLabel(status).toLowerCase().includes(statusFilter);

    return matchesSearch && matchesDirection && matchesStatus;
  });

  const handleSearch = (event) => {
    setSearchParam(event.target.value);
  };

  const handleMakeCall = (call) => {
    const source = getCallSource(call);
    const number = getCallNumber(call);
    const cleanNumber = String(number || "").replace(/\D/g, "");
    const name = getCallName(call);

    if (!cleanNumber) {
      toast.warning("Número da chamada não encontrado.");
      return;
    }

    if (isMetaOfficialSource(source)) {
      const backendWhatsappId =
        call?.whatsapp_id ||
        call?.whatsappId ||
        call?.whatsapp?.id ||
        call?.devices?.whatsapp_id ||
        call?.devices?.whatsappId ||
        null;

      const detail = {
        phone: cleanNumber,
        number: cleanNumber,
        phone_to: cleanNumber,
        to: cleanNumber,
        name,
        contactName: name,
        contactId:
          call?.contact_id ||
          call?.contactId ||
          call?.contact?.id ||
          call?.devices?.contact_id ||
          null,
        whatsappId: backendWhatsappId,
        backendWhatsappId,
        conexaoId: backendWhatsappId,
        connectionId: backendWhatsappId,
        companyId:
          call?.company_id ||
          call?.companyId ||
          call?.devices?.company_id ||
          user?.companyId,
        userId: user?.id,
        user_id: user?.id,
        attendantId: user?.id,
        source: "call-history-official",
        direction: "BUSINESS_INITIATED",
        requestedAt: Date.now()
      };

      console.log("[CallHistoricals] evento start-official-call disparado:", detail);

      window.dispatchEvent(
        new CustomEvent("start-official-call", {
          detail
        })
      );

      return;
    }

    if (isWavoipSource(source)) {
      const token =
        call?.token_wavoip ||
        call?.tokenWavoip ||
        call?.whatsapp?.wavoip ||
        call?.devices?.token_wavoip ||
        call?.devices?.tokenWavoip ||
        "";

      const detail = {
        token,
        phone: cleanNumber,
        number: cleanNumber,
        phone_to: cleanNumber,
        name,
        contactName: name,
        contactId:
          call?.contact_id ||
          call?.contactId ||
          call?.contact?.id ||
          call?.devices?.contact_id ||
          null,
        whatsappId:
          call?.whatsapp_id ||
          call?.whatsappId ||
          call?.whatsapp?.id ||
          call?.devices?.whatsapp_id ||
          call?.devices?.whatsappId ||
          null,
        companyId:
          call?.company_id ||
          call?.companyId ||
          call?.devices?.company_id ||
          user?.companyId,
        userId: user?.id,
        user_id: user?.id,
        source: "call-history-wavoip",
        __wavoipManualRequest: true,
        requestedAt: Date.now()
      };

      console.log("[CallHistoricals] evento multizap:wavoip-call disparado:", detail);

      try {
        localStorage.removeItem("multizap_wavoip_pending_call");
      } catch (error) {
        console.warn("[CallHistoricals] erro ao limpar chamada pendente Wavoip:", error);
      }

      window.dispatchEvent(
        new CustomEvent("multizap:wavoip-call", {
          detail
        })
      );

      return;
    }

    const callUrl = getCallBackUrl(call);

    if (!callUrl) {
      console.warn("[CallHistoricals] sem URL de retorno para ligação", call);
      return;
    }

    window.open(callUrl, "_blank");
  };

  const handleDownload = (url) => {
    if (!url) return;

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "audio-chamada.mp3");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteCall = async (call) => {
    try {
      if (!call?.id) return;

      const confirmDelete = window.confirm(
        i18n.t("analytics.calls.confirmDelete")
      );

      if (!confirmDelete) return;

      await api.delete(`/call/historical/${call.id}`);

      toast.success(i18n.t("analytics.calls.deleted"));

      fetchCallHistory();
    } catch (err) {
      toastError(err);
    }
  };

  const handleToggleSelectCall = (callId) => {
    const id = Number(callId || 0);
    if (!id) return;

    setSelectedCallIds((prev) =>
      prev.includes(id)
        ? prev.filter((selectedId) => selectedId !== id)
        : [...prev, id]
    );
  };

  const getFilteredCallIds = () => {
    return (filteredCallHistory || [])
      .map((call) => Number(call?.id || call?.devices?.id || 0))
      .filter((id) => id > 0);
  };

  const handleToggleSelectAllCalls = () => {
    const ids = getFilteredCallIds();

    if (!ids.length) return;

    const allSelected = ids.every((id) => selectedCallIds.includes(id));

    setSelectedCallIds(allSelected ? [] : ids);
  };

  const handleDeleteSelectedCalls = async () => {
    try {
      if (!selectedCallIds.length) {
        toast.warning(i18n.t("analytics.calls.selectWarning"));
        return;
      }

      const confirmDelete = window.confirm(
        i18n.t("analytics.calls.confirmSelected", { count: selectedCallIds.length })
      );

      if (!confirmDelete) return;

      await api.delete("/call/historical", {
        data: {
          ids: selectedCallIds
        }
      });

      toast.success(i18n.t("analytics.calls.selectedDeleted"));
      setSelectedCallIds([]);
      fetchCallHistory();
    } catch (err) {
      toastError(err);
    }
  };

  const handleDeleteAllFilteredCalls = async () => {
    try {
      const ids = getFilteredCallIds();

      if (!ids.length) {
        toast.warning(i18n.t("analytics.calls.noneToDelete"));
        return;
      }

      const confirmDelete = window.confirm(
        i18n.t("analytics.calls.confirmAll", { count: ids.length })
      );

      if (!confirmDelete) return;

      await api.delete("/call/historical", {
        data: {
          ids
        }
      });

      toast.success(i18n.t("analytics.calls.allDeleted"));
      setSelectedCallIds([]);
      fetchCallHistory();
    } catch (err) {
      toastError(err);
    }
  };

  const filteredCallIds = getFilteredCallIds();
  const allFilteredSelected =
    filteredCallIds.length > 0 &&
    filteredCallIds.every((id) => selectedCallIds.includes(id));

  return (
    <MainContainer>
      <MainHeader>
        <Grid style={{ width: "99.6%" }} container spacing={2}>
          <Grid xs={12} item>
            <Title>{i18n.t("analytics.calls.title")}</Title>
          </Grid>

          <Grid xs={12} item>
            <Grid container spacing={2}>
              <Grid xs={12} sm={6} md={3} item>
                <Card className={`${classes.statsCard} ${classes.statsTotal}`}>
                  <CardContent className={classes.statsContent}>
                    <Typography className={classes.statsNumber}>
                      {statistics.total}
                    </Typography>
                    <Typography className={classes.statsLabel}>
                      {i18n.t("analytics.calls.total")}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid xs={12} sm={6} md={3} item>
                <Card className={`${classes.statsCard} ${classes.statsOutgoing}`}>
                  <CardContent className={classes.statsContent}>
                    <Typography className={classes.statsNumber}>
                      {statistics.totalOutgoing}
                    </Typography>
                    <Typography className={classes.statsLabel}>
                      {i18n.t("analytics.calls.outgoing")}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid xs={12} sm={6} md={3} item>
                <Card className={`${classes.statsCard} ${classes.statsIncoming}`}>
                  <CardContent className={classes.statsContent}>
                    <Typography className={classes.statsNumber}>
                      {statistics.totalIncoming}
                    </Typography>
                    <Typography className={classes.statsLabel}>
                      {i18n.t("analytics.calls.incoming")}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid xs={12} sm={6} md={3} item>
                <Card className={`${classes.statsCard} ${classes.statsRejected}`}>
                  <CardContent className={classes.statsContent}>
                    <Typography className={classes.statsNumber}>
                      {statistics.totalReject}
                    </Typography>
                    <Typography className={classes.statsLabel}>
                      {i18n.t("analytics.calls.rejected")}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Grid>

          <Grid xs={12} item className={classes.filtersContainer}>
            <Grid container spacing={2} alignItems="center">
              <Grid xs={12} sm={5} md={5} item>
                <TextField
                  fullWidth
                  placeholder={i18n.t("analytics.calls.search")}
                  type="search"
                  value={searchParam}
                  onChange={handleSearch}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon style={{ color: "gray" }} />
                      </InputAdornment>
                    )
                  }}
                />
              </Grid>

              <Grid xs={12} sm={3} md={3} item>
                <TextField
                  select
                  fullWidth
                  label={i18n.t("analytics.calls.direction")}
                  value={directionFilter}
                  onChange={(event) => setDirectionFilter(event.target.value)}
                >
                  <MenuItem value="all">{i18n.t("analytics.calls.allDirections")}</MenuItem>
                  <MenuItem value="outgoing">{i18n.t("analytics.calls.outgoing")}</MenuItem>
                  <MenuItem value="incoming">{i18n.t("analytics.calls.incoming")}</MenuItem>
                </TextField>
              </Grid>

              <Grid xs={12} sm={3} md={3} item>
                <TextField
                  select
                  fullWidth
                  label={i18n.t("financial.status")}
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <MenuItem value="all">{i18n.t("tickets.buttons.showAll")}</MenuItem>
                  <MenuItem value="opened">{i18n.t("analytics.calls.opened")}</MenuItem>
                  <MenuItem value="received">{i18n.t("analytics.calls.received")}</MenuItem>
                  <MenuItem value="answered">{i18n.t("analytics.calls.answered")}</MenuItem>
                  <MenuItem value="ended">{i18n.t("analytics.calls.finished")}</MenuItem>
                  <MenuItem value="rejected">{i18n.t("analytics.calls.rejectedSingle")}</MenuItem>
                  <MenuItem value="missed">{i18n.t("analytics.calls.missed")}</MenuItem>
                </TextField>
              </Grid>

              <Grid xs={12} sm={1} md={1} item>
                <IconButton
                  onClick={fetchCallHistory}
                  title={i18n.t("mainDrawer.appBar.refresh")}
                  color="primary"
                >
                  <RefreshIcon />
                </IconButton>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </MainHeader>

      <Paper className={classes.mainPaper} variant="outlined">
        <Grid container spacing={1} style={{ marginBottom: 8 }}>
          <Grid item>
            <Button
              variant="contained"
              color="secondary"
              disabled={!selectedCallIds.length}
              onClick={handleDeleteSelectedCalls}
              startIcon={<DeleteOutlineIcon />}
            >
              {i18n.t("analytics.calls.deleteSelected")} ({selectedCallIds.length})
            </Button>
          </Grid>

          <Grid item>
            <Button
              variant="outlined"
              color="secondary"
              disabled={!filteredCallIds.length}
              onClick={handleDeleteAllFilteredCalls}
              startIcon={<DeleteOutlineIcon />}
            >
              {i18n.t("analytics.calls.deleteDisplayed")} ({filteredCallIds.length})
            </Button>
          </Grid>
        </Grid>

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox" align="center">
                <Checkbox
                  color="primary"
                  checked={allFilteredSelected}
                  indeterminate={
                    selectedCallIds.length > 0 && !allFilteredSelected
                  }
                  onChange={handleToggleSelectAllCalls}
                  title={i18n.t("analytics.calls.selectAll")}
                />
              </TableCell>
              <TableCell align="center">{i18n.t("plans.form.name")}</TableCell>
              <TableCell align="center">{i18n.t("wallets.phone")}</TableCell>
              <TableCell align="center">{i18n.t("queueModal.bot.attendent")}</TableCell>
              <TableCell align="center">{i18n.t("reports.table.whatsapp")}</TableCell>
              <TableCell align="center">{i18n.t("analytics.calls.dateTime")}</TableCell>
              <TableCell align="center">{i18n.t("analytics.calls.direction")}</TableCell>
              <TableCell align="center">{i18n.t("financial.status")}</TableCell>
              <TableCell align="center">{i18n.t("analytics.calls.duration")}</TableCell>
              <TableCell align="center">{i18n.t("analytics.calls.source")}</TableCell>
              <TableCell align="center">{i18n.t("analytics.calls.recording")}</TableCell>
              <TableCell align="center">{i18n.t("wallets.actions")}</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {filteredCallHistory.map((call) => {
              const direction = getDirection(call);
              const status = getStatus(call);
              const number = getCallNumber(call);
              const name = getCallName(call);
              const callDate = getCallDate(call);
              const duration = getCallDuration(call);
              const source = getCallSource(call);
              const recordingUrl = getRecordingUrl(call);
              const callUrl = getCallBackUrl(call);

              return (
                <TableRow key={call.id || call.devices?.id}>
                  <TableCell padding="checkbox" align="center">
                    <Checkbox
                      color="primary"
                      checked={selectedCallIds.includes(Number(call.id || call.devices?.id))}
                      onChange={() => handleToggleSelectCall(call.id || call.devices?.id)}
                    />
                  </TableCell>

                  <TableCell align="center">
                    <strong>{name}</strong>
                    {number && (
                      <div className={classes.mutedText}>{formatPhone(number)}</div>
                    )}
                  </TableCell>

                  <TableCell align="center">
                    <Chip
                      label={formatPhone(number)}
                      className={classes.phoneChip}
                      size="small"
                    />
                  </TableCell>

                  <TableCell align="center">
                    {call.user?.name || "N/A"}
                  </TableCell>

                  <TableCell align="center">
                    {call.whatsapp?.name || "N/A"}
                  </TableCell>

                  <TableCell align="center">
                    {formatDate(callDate)}
                  </TableCell>

                  <TableCell align="center">
                    <div className={classes.directionWrapper}>
                      {direction === "incoming" ? (
                        <CallReceivedIcon className={classes.incomingIcon} />
                      ) : (
                        <CallMadeIcon className={classes.outgoingIcon} />
                      )}
                      {getDirectionLabel(direction)}
                    </div>
                  </TableCell>

                  <TableCell align="center">
                    <Chip
                      label={getStatusLabel(status)}
                      size="small"
                      className={getStatusClassName(classes, status)}
                    />
                  </TableCell>

                  <TableCell align="center">
                    {formatDuration(duration)}
                  </TableCell>

                  <TableCell align="center">
                    <Chip label={source} variant="outlined" size="small" />
                  </TableCell>

                  <TableCell align="center">
                    {recordingUrl ? (
                      <IconButton
                        size="small"
                        className={classes.downloadButton}
                        onClick={() => handleDownload(recordingUrl)}
                        title={i18n.t("analytics.calls.downloadRecording")}
                      >
                        <DownloadIcon />
                      </IconButton>
                    ) : (
                      <span className={classes.mutedText}>{i18n.t("analytics.calls.noRecording")}</span>
                    )}
                  </TableCell>

                  <TableCell align="center">
                    {callUrl || isMetaOfficialSource(source) || isWavoipSource(source) ? (
                      <IconButton
                        size="small"
                        className={classes.actionButton}
                        onClick={() => handleMakeCall(call)}
                        title={i18n.t("analytics.calls.callAgain")}
                      >
                        <PhoneIcon />
                      </IconButton>
                    ) : (
                      <span className={classes.mutedText}>N/A</span>
                    )}

                    <IconButton
                      size="small"
                      className={classes.deleteButton}
                      onClick={() => handleDeleteCall(call)}
                      title={i18n.t("analytics.calls.deleteRecord")}
                    >
                      <DeleteOutlineIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}

            {loading && <TableRowSkeleton columns={11} />}

            {!loading && filteredCallHistory.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} align="center" className={classes.emptyCell}>
                  {i18n.t("analytics.calls.empty")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </MainContainer>
  );
};

export default CallHistoricals;
