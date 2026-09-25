import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Card, CardContent, Chip, CircularProgress, Grid, IconButton, InputAdornment, Paper, TextField, Typography } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import RefreshIcon from "@material-ui/icons/Refresh";
import SearchIcon from "@material-ui/icons/Search";
import WhatsAppIcon from "@material-ui/icons/WhatsApp";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";

const labels = {
  pt: { title: "Saúde dos números oficiais", search: "Buscar conexão ou número", updated: "Atualizado", total: "Conexões", green: "Qualidade alta", yellow: "Qualidade média", attention: "Requer atenção", empty: "Nenhuma conexão oficial encontrada.", verified: "Nome verificado", phone: "Número", quality: "Qualidade", limit: "Limite diário", usage: "Uso nas últimas 24h", sent: "enviadas", delivered: "entregues", account: "Análise da conta", business: "Verificação empresarial", platform: "Plataforma", error: "Diagnóstico" },
  en: { title: "Official number health", search: "Search connection or number", updated: "Updated", total: "Connections", green: "High quality", yellow: "Medium quality", attention: "Needs attention", empty: "No official connection found.", verified: "Verified name", phone: "Number", quality: "Quality", limit: "Daily limit", usage: "Usage in the last 24h", sent: "sent", delivered: "delivered", account: "Account review", business: "Business verification", platform: "Platform", error: "Diagnostic" },
  es: { title: "Salud de números oficiales", search: "Buscar conexión o número", updated: "Actualizado", total: "Conexiones", green: "Calidad alta", yellow: "Calidad media", attention: "Requiere atención", empty: "No se encontraron conexiones oficiales.", verified: "Nombre verificado", phone: "Número", quality: "Calidad", limit: "Límite diario", usage: "Uso en las últimas 24h", sent: "enviados", delivered: "entregados", account: "Revisión de cuenta", business: "Verificación empresarial", platform: "Plataforma", error: "Diagnóstico" }
};

const useStyles = makeStyles(theme => ({
  header: { display: "flex", alignItems: "center", gap: theme.spacing(1), flexWrap: "wrap" },
  search: { minWidth: 260, flex: 1 },
  content: { flex: 1, padding: theme.spacing(2), overflowY: "auto", ...theme.scrollbarStyles },
  stat: { height: "100%", borderRadius: 12 },
  statBody: { display: "flex", alignItems: "center", gap: 12 },
  number: { fontSize: 26, fontWeight: 700 },
  card: { height: "100%", borderRadius: 12, borderTop: "4px solid" },
  row: { display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderBottom: `1px solid ${theme.palette.divider}` },
  label: { color: theme.palette.text.secondary },
  value: { textAlign: "right", fontWeight: 500, overflowWrap: "anywhere" },
  error: { marginTop: 12, padding: 10, borderRadius: 6, background: theme.palette.error.main + "18", color: theme.palette.error.main, overflowWrap: "anywhere" }
}));

const qualityData = quality => {
  const value = String(quality || "UNKNOWN").toUpperCase();
  if (value === "GREEN") return { color: "#16a34a", text: "GREEN" };
  if (value === "YELLOW") return { color: "#d97706", text: "YELLOW" };
  if (value === "RED") return { color: "#dc2626", text: "RED" };
  return { color: "#64748b", text: value };
};

const Row = ({ label, value, classes }) => (
  <div className={classes.row}><span className={classes.label}>{label}</span><span className={classes.value}>{value || "—"}</span></div>
);

const WhatsappHealth = () => {
  const classes = useStyles();
  const lang = String(i18n.language || "pt").split("-")[0];
  const t = labels[lang] || labels.pt;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);

  const load = useCallback(async manual => {
    if (manual) setRefreshing(true);
    try {
      const { data } = await api.get("/whatsapp-oficial/health");
      setItems(Array.isArray(data) ? data : []);
      setUpdatedAt(new Date());
    } catch (error) {
      toastError(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(false);
    const timer = setInterval(() => load(false), 60000);
    return () => clearInterval(timer);
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter(item => [item.name, item.display_phone_number, item.phone_number, item.verified_name, item.waba_name].some(value => String(value || "").toLowerCase().includes(term)));
  }, [items, search]);

  const stats = useMemo(() => ({
    total: items.length,
    green: items.filter(item => item.quality_rating === "GREEN").length,
    yellow: items.filter(item => item.quality_rating === "YELLOW").length,
    attention: items.filter(item => item.quality_rating === "RED" || item.error).length
  }), [items]);

  const tiles = [[stats.total, t.total, "#2563eb"], [stats.green, t.green, "#16a34a"], [stats.yellow, t.yellow, "#d97706"], [stats.attention, t.attention, "#dc2626"]];

  return (
    <MainContainer>
      <MainHeader>
        <Title>{t.title}</Title>
        <div className={classes.header}>
          <TextField className={classes.search} size="small" variant="outlined" placeholder={t.search} value={search} onChange={event => setSearch(event.target.value)} InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }} />
          {updatedAt && <Typography variant="caption">{t.updated}: {updatedAt.toLocaleTimeString()}</Typography>}
          <IconButton onClick={() => load(true)} disabled={refreshing}>{refreshing ? <CircularProgress size={22} /> : <RefreshIcon />}</IconButton>
        </div>
      </MainHeader>
      <Paper className={classes.content} variant="outlined">
        <Grid container spacing={2}>
          {tiles.map(([value, label, color]) => <Grid item xs={6} md={3} key={label}><Card className={classes.stat} variant="outlined"><CardContent className={classes.statBody}><WhatsAppIcon style={{ color, fontSize: 34 }} /><div><div className={classes.number}>{value}</div><Typography variant="caption">{label}</Typography></div></CardContent></Card></Grid>)}
        </Grid>
        {loading ? <Box py={8} textAlign="center"><CircularProgress /></Box> : (
          <Grid container spacing={2} style={{ marginTop: 8 }}>
            {!filtered.length && <Grid item xs={12}><Box py={6} textAlign="center">{t.empty}</Box></Grid>}
            {filtered.map(item => {
              const quality = qualityData(item.quality_rating);
              const limit = item.limit_24h === -1 ? "∞" : item.limit_24h?.toLocaleString() || "—";
              return <Grid item xs={12} md={6} xl={4} key={item.whatsappId}><Card className={classes.card} variant="outlined" style={{ borderTopColor: quality.color }}><CardContent><Box display="flex" justifyContent="space-between" alignItems="center" mb={1}><Typography variant="h6">{item.name}</Typography><Chip size="small" label={quality.text} style={{ background: quality.color, color: "#fff" }} /></Box><Row classes={classes} label={t.verified} value={item.verified_name} /><Row classes={classes} label={t.phone} value={item.display_phone_number || item.phone_number} /><Row classes={classes} label={t.quality} value={item.quality_rating} /><Row classes={classes} label={t.limit} value={limit} /><Row classes={classes} label={t.usage} value={`${Number(item.sent_24h || 0).toLocaleString()} ${t.sent} / ${Number(item.delivered_24h || 0).toLocaleString()} ${t.delivered}`} /><Row classes={classes} label={t.account} value={item.account_review_status} /><Row classes={classes} label={t.business} value={item.business_verification_status} /><Row classes={classes} label={t.platform} value={item.platform_type} />{item.error && <div className={classes.error}><strong>{t.error}:</strong> {item.error}</div>}</CardContent></Card></Grid>;
            })}
          </Grid>
        )}
      </Paper>
    </MainContainer>
  );
};

export default WhatsappHealth;
