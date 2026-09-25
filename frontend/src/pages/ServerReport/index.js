import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  LinearProgress,
  Paper,
  Typography,
  makeStyles
} from "@material-ui/core";
import RefreshIcon from "@material-ui/icons/Refresh";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import WarningIcon from "@material-ui/icons/Warning";
import ErrorIcon from "@material-ui/icons/Error";
import StorageIcon from "@material-ui/icons/Storage";
import MemoryIcon from "@material-ui/icons/Memory";
import DnsIcon from "@material-ui/icons/Dns";
import ExtensionIcon from "@material-ui/icons/Extension";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  root: {
    height: "100%",
    minHeight: "100%",
    width: "100%",
    padding: 24,
    overflowY: "auto",
    overflowX: "hidden",
    boxSizing: "border-box",
    WebkitOverflowScrolling: "touch",
    paddingBottom: 48,
    background:
      theme.mode === "dark"
        ? "linear-gradient(135deg, #08111f 0%, #0f172a 45%, #111827 100%)"
        : "linear-gradient(135deg, #eef7ff 0%, #f8fafc 45%, #ffffff 100%)",
    ...theme.scrollbarStyles,
    "&::-webkit-scrollbar": {
      width: "6px"
    },
    "&::-webkit-scrollbar-thumb": {
      backgroundColor: theme.palette.primary.main,
      borderRadius: "4px"
    },
    [theme.breakpoints.down("sm")]: {
      padding: 12,
      paddingBottom: 72
    }
  },
  hero: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 24,
    padding: 28,
    color: "#fff",
    background: theme.palette.barraSuperior || theme.palette.primary.main,
    boxShadow:
      theme.mode === "dark"
        ? "0 22px 55px rgba(0, 0, 0, .35)"
        : `0 22px 55px ${theme.palette.primary.main}35`,
    marginBottom: 20
  },
  heroTitle: {
    fontWeight: 900,
    letterSpacing: "-.04em",
    fontSize: 34,
    [theme.breakpoints.down("sm")]: {
      fontSize: 25
    }
  },
  heroSubtitle: {
    marginTop: 8,
    maxWidth: 820,
    color: "rgba(255,255,255,.78)",
    fontSize: 15
  },
  heroActions: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 18
  },
  card: {
    borderRadius: 20,
    padding: 20,
    height: "100%",
    border:
      theme.mode === "dark"
        ? "1px solid rgba(255,255,255,.08)"
        : "1px solid rgba(15,23,42,.08)",
    boxShadow:
      theme.mode === "dark"
        ? "0 12px 32px rgba(0,0,0,.25)"
        : "0 12px 32px rgba(15,23,42,.08)",
    background:
      theme.mode === "dark"
        ? "rgba(17,24,39,.86)"
        : "rgba(255,255,255,.92)"
  },
  sectionTitle: {
    fontWeight: 800,
    marginBottom: 14,
    letterSpacing: "-.02em"
  },
  metricHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 12
  },
  metricIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(16,170,98,.12)",
    color: "#10aa62"
  },
  metricValue: {
    fontSize: 30,
    fontWeight: 900,
    letterSpacing: "-.04em"
  },
  muted: {
    color: theme.palette.text.secondary
  },
  progress: {
    height: 10,
    borderRadius: 999,
    marginTop: 12,
    backgroundColor:
      theme.mode === "dark"
        ? "rgba(255,255,255,.10)"
        : "rgba(15,23,42,.08)"
  },
  progressBar: {
    borderRadius: 999
  },
  statusList: {
    display: "flex",
    flexDirection: "column",
    gap: 10
  },
  statusItem: {
    padding: 14,
    borderRadius: 16,
    border:
      theme.mode === "dark"
        ? "1px solid rgba(255,255,255,.08)"
        : "1px solid rgba(15,23,42,.08)",
    background:
      theme.mode === "dark"
        ? "rgba(255,255,255,.035)"
        : "rgba(15,23,42,.025)"
  },
  statusItemTop: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  serviceName: {
    fontWeight: 800
  },
  detailText: {
    marginTop: 4,
    fontSize: 12,
    color: theme.palette.text.secondary
  },
  featureGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
    gap: 12
  },
  featureCard: {
    padding: 16,
    borderRadius: 18,
    border:
      theme.mode === "dark"
        ? "1px solid rgba(255,255,255,.08)"
        : "1px solid rgba(15,23,42,.08)",
    background:
      theme.mode === "dark"
        ? "rgba(255,255,255,.035)"
        : "rgba(15,23,42,.025)"
  },
  featureTop: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 8
  },
  featureIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(16,170,98,.12)",
    color: "#10aa62"
  },
  accessDenied: {
    padding: 32,
    margin: 24,
    borderRadius: 20,
    textAlign: "center"
  }
}));

const statusMap = {
  online: {
    labelKey: "online",
    color: "#047857",
    background: "rgba(16,185,129,.14)",
    icon: <CheckCircleIcon />
  },
  available: {
    labelKey: "available",
    color: "#047857",
    background: "rgba(16,185,129,.14)",
    icon: <CheckCircleIcon />
  },
  warning: {
    labelKey: "warning",
    color: "#b45309",
    background: "rgba(245,158,11,.16)",
    icon: <WarningIcon />
  },
  critical: {
    labelKey: "critical",
    color: "#b91c1c",
    background: "rgba(239,68,68,.16)",
    icon: <ErrorIcon />
  },
  offline: {
    labelKey: "offline",
    color: "#b91c1c",
    background: "rgba(239,68,68,.16)",
    icon: <ErrorIcon />
  },
  unknown: {
    labelKey: "unknown",
    color: "#475569",
    background: "rgba(100,116,139,.16)",
    icon: <WarningIcon />
  }
};

const getStatus = (status) => statusMap[status] || statusMap.unknown;

const StatusChip = ({ status }) => {
  const config = getStatus(status);

  return (
    <Chip
      size="small"
      icon={React.cloneElement(config.icon, { style: { color: config.color, fontSize: 16 } })}
      label={i18n.t(`adminOps.server.${config.labelKey}`)}
      style={{
        background: config.background,
        color: config.color,
        fontWeight: 800
      }}
    />
  );
};

const MetricCard = ({ title, value, subtitle, percent, status, icon }) => {
  const classes = useStyles();

  return (
    <Paper className={classes.card}>
      <Box className={classes.metricHeader}>
        <Box display="flex" alignItems="center" style={{ gap: 12 }}>
          <Box className={classes.metricIcon}>{icon}</Box>
          <Box>
            <Typography variant="subtitle2" className={classes.muted}>
              {title}
            </Typography>
            <Typography className={classes.metricValue}>{value}</Typography>
          </Box>
        </Box>
        <StatusChip status={status} />
      </Box>

      <Typography variant="body2" className={classes.muted}>
        {subtitle}
      </Typography>

      {typeof percent === "number" && (
        <LinearProgress
          variant="determinate"
          value={Math.min(100, Math.max(0, percent))}
          classes={{
            root: classes.progress,
            bar: classes.progressBar
          }}
        />
      )}
    </Paper>
  );
};

const reportItemKey = item => {
  const value = `${item?.key || ""} ${item?.name || ""}`.toLowerCase();
  if (value.includes("frontend")) return "frontend";
  if (value.includes("backend")) return "backend";
  if (value.includes("oficial") || value.includes("official")) return "official";
  if (value.includes("transcri") || value.includes("transcription")) return "transcription";
  if (value.includes("postgres")) return "postgresql";
  if (value.includes("redis")) return "redis";
  if (value.includes("nginx")) return "nginx";
  if (value.includes("pm2")) return "pm2";
  if (value.includes("follow")) return "followup";
  if (value.includes("aquec") || value.includes("warm")) return "warmup";
  if (value.includes("email") || value.includes("e-mail")) return "email";
  if (value.includes("wavoip")) return "wavoip";
  if (value.includes("landing")) return "landing";
  if (value.includes("flow")) return "flowbuilder";
  if (value.includes("asaas") || value.includes("boleto")) return "asaas";
  if (value.includes("radar") || value.includes("oportun")) return "radar";
  if (value.includes("campanh") || value.includes("campaign")) return "campaigns";
  return null;
};

const ServiceItem = ({ item }) => {
  const classes = useStyles();
  const key = reportItemKey(item);
  const serviceKey = ["backend", "frontend", "official", "transcription"].includes(key)
    ? `adminOps.server.service.${key}`
    : null;
  const infrastructureKey = ["postgresql", "redis", "nginx", "pm2"].includes(key)
    ? `adminOps.server.infrastructure.${key === "postgresql" ? "database" : key}`
    : null;
  const name = serviceKey ? i18n.t(`${serviceKey}.name`) : item.name;
  const description = serviceKey
    ? i18n.t(`${serviceKey}.description`)
    : infrastructureKey
    ? i18n.t(infrastructureKey)
    : item.description;

  return (
    <Box className={classes.statusItem}>
      <Box className={classes.statusItemTop}>
        <Box>
          <Typography className={classes.serviceName}>{name}</Typography>
          <Typography variant="body2" className={classes.muted}>
            {description}
          </Typography>
          <Typography className={classes.detailText}>
            {item.detail || i18n.t("adminOps.server.noDetails")}
            {item.uptime ? ` • uptime ${item.uptime}` : ""}
            {item.memory ? ` • ${i18n.t("adminOps.server.memoryDetail")} ${item.memory}` : ""}
            {item.cpu ? ` • CPU ${item.cpu}` : ""}
          </Typography>
        </Box>
        <StatusChip status={item.status} />
      </Box>
    </Box>
  );
};

const FeatureCard = ({ item }) => {
  const classes = useStyles();
  const key = reportItemKey(item);
  const description = key ? i18n.t(`adminOps.server.feature.${key}`) : item.description;
  const name = key ? i18n.t(`adminOps.server.featureName.${key}`) : item.name;
  const detail = /configurado/i.test(item.detail || "")
    ? i18n.t("adminOps.server.feature.configured")
    : i18n.t("adminOps.server.feature.codeModule");

  return (
    <Box className={classes.featureCard}>
      <Box className={classes.featureTop}>
        <Box className={classes.featureIcon}>
          <ExtensionIcon fontSize="small" />
        </Box>
        <Box flex={1}>
          <Typography className={classes.serviceName}>{name}</Typography>
        </Box>
        <StatusChip status={item.status} />
      </Box>

      <Typography variant="body2" className={classes.muted}>
        {description}
      </Typography>

      <Typography className={classes.detailText}>{detail}</Typography>
    </Box>
  );
};

const ServerReport = () => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadReport = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/server-report");
      setReport(data);
    } catch (error) {
      toastError(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.super) {
      loadReport();
    }
  }, [loadReport, user]);

  const generatedAt = useMemo(() => {
    if (!report?.generatedAt) return "—";
    return new Date(report.generatedAt).toLocaleString(i18n.language || "pt-BR");
  }, [report]);

  if (!user?.super) {
    return (
      <Paper className={classes.accessDenied}>
        <Typography variant="h5" style={{ fontWeight: 900 }}>
          {i18n.t("adminOps.server.restricted")}
        </Typography>
        <Typography className={classes.muted}>
          {i18n.t("adminOps.server.restrictedHelp")}
        </Typography>
      </Paper>
    );
  }

  if (loading && !report) {
    return (
      <Box className={classes.root} display="flex" alignItems="center" justifyContent="center">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box className={classes.root}>
      <Box className={classes.hero}>
        <Typography className={classes.heroTitle}>
          {i18n.t("adminOps.server.title")}
        </Typography>

        <Typography className={classes.heroSubtitle}>
          {i18n.t("adminOps.server.subtitle")}
        </Typography>

        <Box className={classes.heroActions}>
          {report?.overall && <StatusChip status={report.overall.status} />}

          <Typography variant="body2" style={{ color: "rgba(255,255,255,.82)" }}>
            {report?.overall?.status === "online"
              ? i18n.t("adminOps.server.overallHealthy")
              : report?.overall?.message || i18n.t("adminOps.server.loading")}
          </Typography>

          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={loadReport}
            disabled={loading}
            style={{
              marginLeft: "auto",
              borderRadius: 12,
              fontWeight: 800,
              textTransform: "none",
              background: "#fff",
              color: "#0f172a"
            }}
          >
            {i18n.t("mainDrawer.appBar.refresh")}
          </Button>
        </Box>
      </Box>

      {report && (
        <>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <MetricCard
                title="CPU"
                value={`${report.server.cpu.percent}%`}
                subtitle={`${i18n.t("adminOps.server.cores", { count: report.server.cpu.cores })} • ${report.server.cpu.model}`}
                percent={report.server.cpu.percent}
                status={report.server.cpu.status}
                icon={<MemoryIcon />}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <MetricCard
                title={i18n.t("adminOps.server.memory")}
                value={`${report.server.memory.percent}%`}
                subtitle={i18n.t("adminOps.server.usedOf", { used: report.server.memory.usedGB, total: report.server.memory.totalGB })}
                percent={report.server.memory.percent}
                status={report.server.memory.status}
                icon={<StorageIcon />}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <MetricCard
                title={i18n.t("adminOps.server.disk")}
                value={`${report.server.disk.percent}%`}
                subtitle={i18n.t("adminOps.server.usedOf", { used: report.server.disk.usedGB, total: report.server.disk.totalGB })}
                percent={report.server.disk.percent}
                status={report.server.disk.status}
                icon={<DnsIcon />}
              />
            </Grid>
          </Grid>

          <Grid container spacing={2} style={{ marginTop: 4 }}>
            <Grid item xs={12} md={6}>
              <Paper className={classes.card}>
                <Typography variant="h6" className={classes.sectionTitle}>
                  {i18n.t("adminOps.server.environment")}
                </Typography>

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography className={classes.muted}>{i18n.t("adminOps.server.product")}</Typography>
                    <Typography style={{ fontWeight: 800 }}>{report.product.name}</Typography>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Typography className={classes.muted}>{i18n.t("adminOps.server.module")}</Typography>
                    <Typography style={{ fontWeight: 800 }}>{report.product.version}</Typography>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Typography className={classes.muted}>{i18n.t("adminOps.server.server")}</Typography>
                    <Typography style={{ fontWeight: 800 }}>{report.server.hostname}</Typography>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Typography className={classes.muted}>{i18n.t("adminOps.server.system")}</Typography>
                    <Typography style={{ fontWeight: 800 }}>{report.server.os}</Typography>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Typography className={classes.muted}>{i18n.t("adminOps.server.serverUptime")}</Typography>
                    <Typography style={{ fontWeight: 800 }}>{report.server.uptime}</Typography>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Typography className={classes.muted}>{i18n.t("adminOps.server.backendUptime")}</Typography>
                    <Typography style={{ fontWeight: 800 }}>{report.server.backendUptime}</Typography>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Typography className={classes.muted}>Node.js</Typography>
                    <Typography style={{ fontWeight: 800 }}>{report.server.runtime.node}</Typography>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Typography className={classes.muted}>{i18n.t("adminOps.server.updatedAt")}</Typography>
                    <Typography style={{ fontWeight: 800 }}>{generatedAt}</Typography>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>

            <Grid item xs={12} md={6}>
              <Paper className={classes.card}>
                <Typography variant="h6" className={classes.sectionTitle}>
                  {i18n.t("adminOps.server.pm2Services")}
                </Typography>

                <Box className={classes.statusList}>
                  {report.services.pm2.map(item => (
                    <ServiceItem key={item.key} item={item} />
                  ))}
                </Box>
              </Paper>
            </Grid>
          </Grid>

          <Grid container spacing={2} style={{ marginTop: 4 }}>
            <Grid item xs={12} md={5}>
              <Paper className={classes.card}>
                <Typography variant="h6" className={classes.sectionTitle}>
                  {i18n.t("adminOps.server.infrastructureTitle")}
                </Typography>

                <Box className={classes.statusList}>
                  {report.services.infrastructure.map(item => (
                    <ServiceItem key={item.key} item={item} />
                  ))}
                </Box>
              </Paper>
            </Grid>

            <Grid item xs={12} md={7}>
              <Paper className={classes.card}>
                <Typography variant="h6" className={classes.sectionTitle}>
                  {i18n.t("adminOps.server.systemModules")}
                </Typography>

                <Typography variant="body2" className={classes.muted} style={{ marginBottom: 14 }}>
                  {i18n.t("adminOps.server.modulesHelp")}
                </Typography>

                <Divider style={{ marginBottom: 14 }} />

                <Box className={classes.featureGrid}>
                  {report.features.map(item => (
                    <FeatureCard key={item.key} item={item} />
                  ))}
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
};

export default ServerReport;
