import React, { useEffect, useState } from "react";
import {
  makeStyles,
  Paper,
  Typography,
  Button,
  Grid,
  CircularProgress,
  Divider,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@material-ui/core";
import {
  Backup as BackupIcon,
  Restore as RestoreIcon,
  GetApp as DownloadIcon,
  CloudUpload as UploadIcon,
} from "@material-ui/icons";
import { toast } from "react-toastify";
import api from "../../../services/api";
import { i18n } from "../../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  root: {
    padding: theme.spacing(3),
  },
  section: {
    padding: theme.spacing(3),
    marginBottom: theme.spacing(3),
  },
  sectionTitle: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    marginBottom: theme.spacing(2),
  },
  description: {
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(2),
  },
  buttonGroup: {
    display: "flex",
    gap: theme.spacing(2),
    flexWrap: "wrap",
  },
  dangerZone: {
    borderColor: theme.palette.error.main,
    border: "1px solid",
  },
  dangerTitle: {
    color: theme.palette.error.main,
  },
  hiddenInput: {
    display: "none",
  },
}));

const BackupRestore = () => {
  const classes = useStyles();
  const [loadingSQL, setLoadingSQL] = useState(false);
  const [loadingJSON, setLoadingJSON] = useState(false);
  const [loadingRestore, setLoadingRestore] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [loadingCompanyBackup, setLoadingCompanyBackup] = useState("");

  useEffect(() => {
    api.get("/companies/list")
      .then(({ data }) => setCompanies(Array.isArray(data) ? data : []))
      .catch(() => toast.error(i18n.t("settingsSuite.backup.companyListError")));
  }, []);

  const downloadBlob = (response, fallbackName) => {
    const contentDisposition = response.headers["content-disposition"];
    const filename = contentDisposition
      ? contentDisposition.split("filename=")[1]?.replace(/"/g, "")
      : fallbackName;
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleCompanyBackup = async (format) => {
    if (!selectedCompanyId) {
      toast.error(i18n.t("settingsSuite.backup.selectCompanyError"));
      return;
    }

    setLoadingCompanyBackup(format);
    try {
      const response = await api.get(
        `/backup/company/${selectedCompanyId}/${format}`,
        { responseType: "blob", timeout: 300000 }
      );
      downloadBlob(response, `backup_empresa_${selectedCompanyId}.${format}`);
      toast.success(i18n.t("settingsSuite.backup.companySuccess"));
    } catch (err) {
      toast.error(i18n.t("settingsSuite.backup.companyError"));
    } finally {
      setLoadingCompanyBackup("");
    }
  };

  const handleBackupSQL = async () => {
    setLoadingSQL(true);
    try {
      const response = await api.get("/backup/sql", {
        responseType: "blob",
      });

      const contentDisposition = response.headers["content-disposition"];
      const filename = contentDisposition
        ? contentDisposition.split("filename=")[1]?.replace(/"/g, "")
        : `backup_${new Date().toISOString().replace(/[:.]/g, "-")}.sql`;

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success(i18n.t("settingsSuite.backup.sqlSuccess"));
    } catch (err) {
      toast.error(i18n.t("settingsSuite.backup.sqlError"));
    }
    setLoadingSQL(false);
  };

  const handleBackupJSON = async () => {
    setLoadingJSON(true);
    try {
      const response = await api.get("/backup/json", {
        responseType: "blob",
      });

      const contentDisposition = response.headers["content-disposition"];
      const filename = contentDisposition
        ? contentDisposition.split("filename=")[1]?.replace(/"/g, "")
        : `backup_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success(i18n.t("settingsSuite.backup.jsonSuccess"));
    } catch (err) {
      toast.error(i18n.t("settingsSuite.backup.jsonError"));
    }
    setLoadingJSON(false);
  };

  const handleRestore = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith(".sql")) {
      toast.error(i18n.t("settingsSuite.backup.sqlOnly"));
      return;
    }

    const confirmRestore = window.confirm(i18n.t("settingsSuite.backup.confirm"));

    if (!confirmRestore) {
      e.target.value = "";
      return;
    }

    setLoadingRestore(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      await api.post("/backup/restore", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 300000, // 5 min para restaurações grandes
      });

      toast.success(i18n.t("settingsSuite.backup.restoreSuccess"));
    } catch (err) {
      toast.error(i18n.t("settingsSuite.backup.restoreError"));
    }
    setLoadingRestore(false);
    e.target.value = "";
  };

  return (
    <div className={classes.root}>
      {/* Seção de Backup */}
      <Paper className={classes.section} elevation={1}>
        <div className={classes.sectionTitle}>
          <BackupIcon color="primary" />
          <Typography variant="h6">{i18n.t("settingsSuite.backup.title")}</Typography>
        </div>
        <Typography className={classes.description}>
          {i18n.t("settingsSuite.backup.description")}
        </Typography>

        <Grid container spacing={2}>
          <Grid item>
            <Button
              variant="contained"
              color="primary"
              startIcon={
                loadingSQL ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  <DownloadIcon />
                )
              }
              onClick={handleBackupSQL}
              disabled={loadingSQL || loadingJSON}
            >
              {loadingSQL ? i18n.t("settingsSuite.common.generating") : i18n.t("settingsSuite.backup.sql")}
            </Button>
          </Grid>
          <Grid item>
            <Button
              variant="outlined"
              color="primary"
              startIcon={
                loadingJSON ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  <DownloadIcon />
                )
              }
              onClick={handleBackupJSON}
              disabled={loadingSQL || loadingJSON}
            >
              {loadingJSON ? i18n.t("settingsSuite.common.generating") : i18n.t("settingsSuite.backup.json")}
            </Button>
          </Grid>
        </Grid>

        <Box mt={2}>
          <Typography variant="caption" color="textSecondary">
            💡 {i18n.t("settingsSuite.backup.tip")}
          </Typography>
        </Box>
      </Paper>

      <Paper className={classes.section} elevation={1}>
        <div className={classes.sectionTitle}>
          <BackupIcon color="primary" />
          <Typography variant="h6">
            {i18n.t("settingsSuite.backup.companyTitle")}
          </Typography>
        </div>
        <Typography className={classes.description}>
          {i18n.t("settingsSuite.backup.companyDescription")}
        </Typography>

        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={5}>
            <FormControl variant="outlined" fullWidth size="small">
              <InputLabel>{i18n.t("settingsSuite.backup.selectCompany")}</InputLabel>
              <Select
                value={selectedCompanyId}
                onChange={(event) => setSelectedCompanyId(event.target.value)}
                label={i18n.t("settingsSuite.backup.selectCompany")}
              >
                <MenuItem value=""><em>—</em></MenuItem>
                {companies.map(company => (
                  <MenuItem key={company.id} value={company.id}>
                    #{company.id} — {company.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item>
            <Button
              variant="contained"
              color="primary"
              startIcon={loadingCompanyBackup === "sql" ? <CircularProgress size={20} color="inherit" /> : <DownloadIcon />}
              disabled={Boolean(loadingCompanyBackup)}
              onClick={() => handleCompanyBackup("sql")}
            >
              {i18n.t("settingsSuite.backup.companySQL")}
            </Button>
          </Grid>
          <Grid item>
            <Button
              variant="outlined"
              color="primary"
              startIcon={loadingCompanyBackup === "json" ? <CircularProgress size={20} color="inherit" /> : <DownloadIcon />}
              disabled={Boolean(loadingCompanyBackup)}
              onClick={() => handleCompanyBackup("json")}
            >
              {i18n.t("settingsSuite.backup.companyJSON")}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Seção de Restauração */}
      <Paper
        className={`${classes.section} ${classes.dangerZone}`}
        elevation={1}
      >
        <div className={classes.sectionTitle}>
          <RestoreIcon color="error" />
          <Typography variant="h6" className={classes.dangerTitle}>
            {i18n.t("settingsSuite.backup.restoreTitle")}
          </Typography>
        </div>
        <Typography className={classes.description}>
          ⚠️ <strong>{i18n.t("settingsSuite.backup.danger")}</strong>{" "}
          {i18n.t("settingsSuite.backup.dangerHelp")}
        </Typography>

        <input
          accept=".sql"
          className={classes.hiddenInput}
          id="restore-file-input"
          type="file"
          onChange={handleRestore}
          disabled={loadingRestore}
        />
        <label htmlFor="restore-file-input">
          <Button
            variant="contained"
            color="secondary"
            component="span"
            startIcon={
              loadingRestore ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                <UploadIcon />
              )
            }
            disabled={loadingRestore}
          >
            {loadingRestore ? i18n.t("settingsSuite.common.restoring") : i18n.t("settingsSuite.backup.upload")}
          </Button>
        </label>
      </Paper>
    </div>
  );
};

export default BackupRestore;
