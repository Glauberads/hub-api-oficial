import React from "react";
import { useTheme } from "@material-ui/core/styles";

import {
  Button,
  Grid,
  Paper,
  TextField,
} from "@material-ui/core";

import Title from "./Title";
import { i18n } from "../../translate/i18n";

const Filters = ({
  classes,
  setDateStartTicket,
  setDateEndTicket,
  dateStartTicket,
  dateEndTicket,
  setQueueTicket,
  queueTicket,
  fetchData,
}) => {
  const theme = useTheme();

  const [queues] = React.useState(queueTicket);
  const [dateStart, setDateStart] = React.useState(dateStartTicket);
  const [dateEnd, setDateEnd] = React.useState(dateEndTicket);
  const [fetchDataFilter, setFetchDataFilter] = React.useState(false);

  return (
    <Grid item xs={12}>
      <Paper
        className={classes.customFixedHeightPaperLg}
        elevation={0}
        style={{
          borderRadius: 20,
          border: `1px solid ${theme.palette.divider}`,
          boxShadow: "0 8px 28px rgba(15,23,42,0.06)",
          background: theme.palette.background.paper,
          padding: 20,
        }}
      >
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
            <Title>{i18n.t("analytics.dashboard.filtersTitle")}</Title>
            <div
              style={{
                fontSize: 13,
                color: theme.palette.text.secondary,
                marginTop: 4,
              }}
            >
              {i18n.t("analytics.dashboard.filtersHelp")}
            </div>
          </div>

          <div
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              background:
                (theme.palette.type || theme.palette.mode || "light") === "dark"
                  ? "rgba(255,255,255,0.06)"
                  : "#f8fafc",
              border: `1px solid ${theme.palette.divider}`,
              color: theme.palette.text.secondary,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {i18n.t("analytics.dashboard.quickFilter")}
          </div>
        </div>

        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={5}>
            <TextField
              fullWidth
              variant="outlined"
              size="small"
              name="dateStart"
              label={i18n.t("dashboard.date.initialDate")}
              InputLabelProps={{
                shrink: true,
              }}
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={5}>
            <TextField
              fullWidth
              variant="outlined"
              size="small"
              name="dateEnd"
              label={i18n.t("dashboard.date.finalDate")}
              InputLabelProps={{
                shrink: true,
              }}
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <Button
              fullWidth
              variant="contained"
              color="primary"
              style={{
                height: 40,
                borderRadius: 10,
                textTransform: "none",
                fontWeight: 700,
                boxShadow: "none",
              }}
              onClick={() => {
                setQueueTicket(queues);
                setDateStartTicket(dateStart);
                setDateEndTicket(dateEnd);
                setFetchDataFilter(!fetchDataFilter);
                fetchData(!fetchDataFilter);
              }}
            >
              {i18n.t("analytics.dashboard.filter")}
            </Button>
          </Grid>
        </Grid>
      </Paper>
    </Grid>
  );
};

export default Filters;
