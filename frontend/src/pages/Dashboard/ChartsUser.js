import React, { useEffect, useState, useContext, useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import brLocale from "date-fns/locale/pt-BR";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { Button, Grid, TextField } from "@material-ui/core";
import Typography from "@material-ui/core/Typography";
import api from "../../services/api";
import { format } from "date-fns";
import { toast } from "react-toastify";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import "./button.css";
import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";

const useStyles = makeStyles((theme) => ({
  container: {
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(1),
    paddingLeft: theme.spacing(1),
    paddingRight: theme.spacing(1),
  },
  filterCard: {
    borderRadius: 18,
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
    background:
      (theme.palette.type || theme.palette.mode || "light") === "dark"
        ? "rgba(255,255,255,0.03)"
        : "#f8fafc",
    border: `1px solid ${theme.palette.divider}`,
  },
  chartWrapper: {
    width: "100%",
    height: 360,
  },
}));

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartDataLabels
);

export const ChatsUser = () => {
  const classes = useStyles();
  const theme = useTheme();
  const [initialDate, setInitialDate] = useState(new Date());
  const [finalDate, setFinalDate] = useState(new Date());
  const [ticketsData, setTicketsData] = useState({ data: [] });
  const [loading, setLoading] = useState(false);
  const { user } = useContext(AuthContext);

  const companyId = user.companyId;
  const isDark =
    (theme.palette.type || theme.palette.mode || "light") === "dark";

  useEffect(() => {
    if (companyId) {
      handleGetTicketsInformation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const totalTickets = useMemo(() => {
    if (!ticketsData?.data?.length) return 0;
    return ticketsData.data.reduce(
      (total, item) => total + (Number(item?.quantidade) || 0),
      0
    );
  }, [ticketsData]);

  const dataCharts = useMemo(() => {
    return {
      labels:
        ticketsData && ticketsData?.data.length > 0
          ? ticketsData.data.map((item) => item.nome)
          : [],
      datasets: [
        {
          label: "Tickets",
          data:
            ticketsData?.data.length > 0
              ? ticketsData.data.map((item) => Number(item?.quantidade) || 0)
              : [],
          backgroundColor: theme.palette.primary.main,
          hoverBackgroundColor:
            theme.palette.primary.dark || theme.palette.primary.main,
          borderRadius: 10,
          borderSkipped: false,
          maxBarThickness: 34,
        },
      ],
    };
  }, [ticketsData, theme]);

  const chartOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      layout: {
        padding: {
          top: 8,
          right: 16,
          bottom: 0,
          left: 0,
        },
      },
      interaction: {
        mode: "nearest",
        intersect: true,
      },
      plugins: {
        legend: {
          display: false,
        },
        title: {
          display: false,
        },
        tooltip: {
          backgroundColor: isDark ? "rgba(20, 24, 31, 0.96)" : "#ffffff",
          titleColor: isDark ? "#ffffff" : "#111827",
          bodyColor: isDark ? "#e5e7eb" : "#374151",
          borderColor: isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb",
          borderWidth: 1,
          padding: 12,
          displayColors: true,
          callbacks: {
            label: function (context) {
              return ` ${context.parsed.x} ticket(s)`;
            },
          },
        },
        datalabels: {
          display: true,
          color: isDark ? "#ffffff" : "#111827",
          anchor: "end",
          align: "right",
          offset: 6,
          clamp: true,
          formatter: function (value) {
            return value;
          },
          font: {
            size: 11,
            weight: "bold",
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: {
            color: isDark
              ? "rgba(255,255,255,0.08)"
              : "rgba(15,23,42,0.08)",
            drawBorder: false,
          },
          ticks: {
            precision: 0,
            stepSize: 1,
            color: theme.palette.text.secondary,
            font: {
              size: 11,
              weight: "600",
            },
          },
        },
        y: {
          grid: {
            display: false,
            drawBorder: false,
          },
          ticks: {
            color: theme.palette.text.secondary,
            font: {
              size: 12,
              weight: "600",
            },
          },
        },
      },
    };
  }, [theme, isDark]);

  const handleGetTicketsInformation = async () => {
    try {
      if (!initialDate || !finalDate) {
        toast.error(i18n.t("analytics.dashboard.selectDates"));
        return;
      }

      if (new Date(initialDate) > new Date(finalDate)) {
        toast.error(i18n.t("analytics.dashboard.invalidDates"));
        return;
      }

      setLoading(true);

      const { data } = await api.get(
        `/dashboard/ticketsUsers?initialDate=${format(
          initialDate,
          "yyyy-MM-dd"
        )}&finalDate=${format(finalDate, "yyyy-MM-dd")}&companyId=${companyId}`
      );

      setTicketsData(data || { data: [] });
    } catch (error) {
      toast.error(i18n.t("analytics.dashboard.loadError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          marginBottom: 18,
          flexWrap: "wrap",
        }}
      >
        <div>
          <Typography
            component="h2"
            variant="h6"
            style={{
              color: theme.palette.text.primary,
              fontWeight: 800,
              marginBottom: 4,
            }}
          >
            {i18n.t("dashboard.users.totalCallsUser")}
          </Typography>

          <Typography
            variant="body2"
            style={{
              color: theme.palette.text.secondary,
            }}
          >
            {i18n.t("analytics.dashboard.userRankingHelp")}
          </Typography>
        </div>

        <div
          style={{
            padding: "8px 12px",
            borderRadius: 999,
            background: isDark ? "rgba(255,255,255,0.06)" : "#f8fafc",
            border: `1px solid ${theme.palette.divider}`,
            color: theme.palette.text.secondary,
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {i18n.t("analytics.dashboard.total")}: {totalTickets}
        </div>
      </div>

      <div className={classes.filterCard}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={4}>
            <LocalizationProvider
              dateAdapter={AdapterDateFns}
              adapterLocale={brLocale}
            >
              <DatePicker
                value={initialDate}
                onChange={(newValue) => {
                  setInitialDate(newValue);
                }}
                label={i18n.t("dashboard.date.initialDate")}
                renderInput={(params) => (
                  <TextField
                    fullWidth
                    {...params}
                    variant="outlined"
                    size="small"
                  />
                )}
              />
            </LocalizationProvider>
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <LocalizationProvider
              dateAdapter={AdapterDateFns}
              adapterLocale={brLocale}
            >
              <DatePicker
                value={finalDate}
                onChange={(newValue) => {
                  setFinalDate(newValue);
                }}
                label={i18n.t("dashboard.date.finalDate")}
                renderInput={(params) => (
                  <TextField
                    fullWidth
                    {...params}
                    variant="outlined"
                    size="small"
                  />
                )}
              />
            </LocalizationProvider>
          </Grid>

          <Grid item xs={12} md={4}>
            <Button
              onClick={handleGetTicketsInformation}
              variant="contained"
              fullWidth
              disabled={loading}
              style={{
                background: theme.palette.primary.main,
                color: "#fff",
                height: 40,
                borderRadius: 10,
                textTransform: "none",
                fontWeight: 700,
                boxShadow: "none",
              }}
            >
              {loading ? i18n.t("analytics.dashboard.filtering") : i18n.t("analytics.dashboard.filter")}
            </Button>
          </Grid>
        </Grid>
      </div>

      <div className={classes.chartWrapper}>
        <Bar options={chartOptions} data={dataCharts} />
      </div>
    </>
  );
};
