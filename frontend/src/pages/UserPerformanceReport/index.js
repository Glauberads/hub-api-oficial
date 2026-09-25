import React, { useEffect, useState } from "react";
import { Button, Card, CardContent, Grid, Paper, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import GetAppIcon from "@material-ui/icons/GetApp";
import SearchIcon from "@material-ui/icons/Search";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";

const words = {
  pt: ["Desempenho dos atendentes", "Início", "Fim", "Consultar", "Exportar CSV", "Atendente", "Total", "Abertos", "Pendentes", "Fechados", "Atendimento médio", "Espera média", "Avaliação", "Atendentes ativos", "Sem dados no período"],
  en: ["Agent performance", "Start", "End", "Search", "Export CSV", "Agent", "Total", "Open", "Pending", "Closed", "Average service", "Average wait", "Rating", "Active agents", "No data for this period"],
  es: ["Rendimiento de agentes", "Inicio", "Fin", "Consultar", "Exportar CSV", "Agente", "Total", "Abiertos", "Pendientes", "Cerrados", "Atención media", "Espera media", "Evaluación", "Agentes activos", "Sin datos en el período"]
};
const useStyles = makeStyles(theme => ({ content: { flex: 1, padding: theme.spacing(2), overflow: "auto", ...theme.scrollbarStyles }, filters: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }, card: { height: "100%", borderRadius: 10 }, number: { fontSize: 26, fontWeight: 700 }, table: { marginTop: 16 }, name: { fontWeight: 600 } }));
const iso = date => date.toISOString().slice(0, 10);
const minutes = value => `${Math.round(Number(value || 0))} min`;

const UserPerformanceReport = () => {
  const classes = useStyles();
  const lang = String(i18n.language || "pt").split("-")[0];
  const w = words[lang] || words.pt;
  const today = new Date();
  const ago = new Date(); ago.setDate(today.getDate() - 30);
  const [initialDate, setInitialDate] = useState(iso(ago));
  const [finalDate, setFinalDate] = useState(iso(today));
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const response = await api.get("/dashboard/user-performance", { params: { initialDate, finalDate } });
      setData(response.data?.data || []); setSummary(response.data?.summary || {});
    } catch (error) { toastError(error); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const exportCsv = () => {
    const header = w.slice(5, 13);
    const rows = data.map(item => [item.userName, item.totalTickets, item.openTickets, item.pendingTickets, item.closedTickets, Math.round(item.avgSupportTime), Math.round(item.avgWaitTime), Number(item.avgRating || 0).toFixed(1)]);
    const csv = [header, ...rows].map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(";")).join("\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" })); link.download = `desempenho-${initialDate}-${finalDate}.csv`; link.click(); URL.revokeObjectURL(link.href);
  };
  const cards = [[summary.totalTickets || 0, w[6]], [summary.totalUsers || 0, w[13]], [minutes(summary.avgSupportTime), w[10]], [Number(summary.avgRating || 0).toFixed(1), w[12]]];

  return <MainContainer><MainHeader><Title>{w[0]}</Title><div className={classes.filters}><TextField type="date" size="small" variant="outlined" label={w[1]} value={initialDate} onChange={e => setInitialDate(e.target.value)} InputLabelProps={{ shrink: true }} /><TextField type="date" size="small" variant="outlined" label={w[2]} value={finalDate} onChange={e => setFinalDate(e.target.value)} InputLabelProps={{ shrink: true }} /><Button variant="contained" color="primary" startIcon={<SearchIcon />} onClick={load} disabled={loading}>{w[3]}</Button><Button variant="outlined" startIcon={<GetAppIcon />} onClick={exportCsv} disabled={!data.length}>{w[4]}</Button></div></MainHeader><Paper className={classes.content} variant="outlined"><Grid container spacing={2}>{cards.map(([value, label]) => <Grid item xs={6} md={3} key={label}><Card className={classes.card} variant="outlined"><CardContent><div className={classes.number}>{value}</div><Typography color="textSecondary">{label}</Typography></CardContent></Card></Grid>)}</Grid><Table className={classes.table} size="small"><TableHead><TableRow>{w.slice(5, 13).map(label => <TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead><TableBody>{data.map(item => <TableRow key={item.userId}><TableCell className={classes.name}>{item.userName}</TableCell><TableCell>{item.totalTickets}</TableCell><TableCell>{item.openTickets}</TableCell><TableCell>{item.pendingTickets}</TableCell><TableCell>{item.closedTickets}</TableCell><TableCell>{minutes(item.avgSupportTime)}</TableCell><TableCell>{minutes(item.avgWaitTime)}</TableCell><TableCell>{Number(item.avgRating || 0).toFixed(1)} ({item.totalRatings})</TableCell></TableRow>)}{!loading && !data.length && <TableRow><TableCell colSpan={8} align="center">{w[14]}</TableCell></TableRow>}</TableBody></Table></Paper></MainContainer>;
};
export default UserPerformanceReport;
