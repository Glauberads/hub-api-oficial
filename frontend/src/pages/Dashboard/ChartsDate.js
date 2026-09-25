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
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import brLocale from "date-fns/locale/pt-BR";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { Button, Grid, TextField } from "@material-ui/core";
import Typography from "@material-ui/core/Typography";
import api from "../../services/api";
import { format } from "date-fns";
import { toast } from "react-toastify";
import "./button.css";
import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";
import { useTheme } from "@material-ui/core";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export const ChartsDate = () => {
  const theme = useTheme();
  const [initialDate, setInitialDate] = useState(new Date());
  const [finalDate, setFinalDate] = useState(new Date());
  const [ticketsData, setTicketsData] = useState({ data: [], count: 0 });
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

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          top: 10,
          right: 10,
          bottom: 0,
          left: 0,
        },
      },
      interaction: {
        mode: "index",
        intersect: false,
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
              return ` ${context.parsed.y} ticket(s)`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: {
            display: false,
            drawBorder: false,
          },
          ticks: {
            color: theme.palette.text.secondary,
            font: {
              size: 11,
              weight: "600",
            },
          },
        },
        y: {
          beginAtZero: true,
          grid: {
            color: isDark
              ? "rgba(255,255,255,0.08)"
              : "rgba(15, 23, 42, 0.08)",
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
      },
    }),
    [theme, isDark]
  );

  const dataCharts = useMemo(
    () => ({
      labels:
        ticketsData &&
        ticketsData?.data.length > 0 &&
        ticketsData?.data.map((item) =>
          item.hasOwnProperty("horario")
            ? `Das ${item.horario}:00 às ${item.horario}:59`
            : item.data
        ),
      datasets: [
        {
          label: "Tickets",
          data:
            ticketsData?.data.length > 0
              ? ticketsData?.data.map((item) => item.total)
              : [],
          backgroundColor: theme.palette.primary.main,
          borderRadius: 10,
          borderSkipped: false,
          maxBarThickness: 44,
          hoverBackgroundColor: theme.palette.primary.dark || theme.palette.primary.main,
        },
      ],
    }),
    [ticketsData, theme]
  );

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
        `/dashboard/ticketsDay?initialDate=${format(
          initialDate,
          "yyyy-MM-dd"
        )}&finalDate=${format(finalDate, "yyyy-MM-dd")}&companyId=${companyId}`
      );

      setTicketsData(data || { data: [], count: 0 });
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
            {i18n.t("dashboard.users.totalAttendances")} ({ticketsData?.count || 0})
          </Typography>

          <Typography
            variant="body2"
            style={{
              color: theme.palette.text.secondary,
            }}
          >
            {i18n.t("analytics.dashboard.dateTicketsHelp")}
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
          {i18n.t("analytics.dashboard.totalPeriod")}: {ticketsData?.count || 0}
        </div>
      </div>

      <div
        style={{
          borderRadius: 18,
          padding: 16,
          marginBottom: 18,
          background: isDark ? "rgba(255,255,255,0.03)" : "#f8fafc",
          border: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={4}>
            <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={brLocale}>
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
            <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={brLocale}>
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

      <div
        style={{
          width: "100%",
          height: 320,
          padding: "4px 0 0 0",
        }}
      >
        <Bar data={dataCharts} options={chartOptions} />
      </div>
    </>
  );
};
