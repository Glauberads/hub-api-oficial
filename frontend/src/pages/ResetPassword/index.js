import React, { useState, useContext } from "react";
import {
  Button,
  CssBaseline,
  TextField,
  Typography,
  Paper,
  IconButton,
  InputAdornment
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import Visibility from "@material-ui/icons/Visibility";
import VisibilityOff from "@material-ui/icons/VisibilityOff";
import { useHistory, Link as RouterLink } from "react-router-dom";
import { Helmet } from "react-helmet";
import ColorModeContext from "../../layout/themeContext";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  root: {
    width: "100vw",
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#0a0a0a",
    padding: 16
  },
  paper: {
    width: "100%",
    maxWidth: 420,
    padding: 32,
    borderRadius: 18,
    backgroundColor: "rgba(18, 20, 28, 0.92)",
    boxShadow: "0 18px 60px rgba(0,0,0,0.45)"
  },
  title: {
    marginBottom: 8,
    fontWeight: 700,
    color: "#e6edf3"
  },
  subtitle: {
    marginBottom: 20,
    color: "#8b949e"
  },
  textField: {
    marginBottom: 16,
    "& .MuiOutlinedInput-root": {
      borderRadius: 8,
      backgroundColor: "rgba(255,255,255,0.05)",
      color: "#e6edf3",
      "& fieldset": {
        borderColor: "rgba(255,255,255,0.12)"
      },
      "&:hover fieldset": {
        borderColor: "rgba(255,255,255,0.22)"
      },
      "&.Mui-focused fieldset": {
        borderColor: theme.palette.primary.main
      }
    },
    "& .MuiInputLabel-outlined": {
      color: "#8b949e"
    },
    "& .MuiInputBase-input": {
      color: "#e6edf3"
    }
  },
  button: {
    marginTop: 8,
    marginBottom: 16,
    height: 44,
    borderRadius: 8,
    textTransform: "none",
    fontWeight: 700
  },
  success: {
    marginTop: 12,
    color: "#7ee787"
  },
  error: {
    marginTop: 12,
    color: "#ff7b72"
  },
  link: {
    textDecoration: "none",
    fontWeight: 600,
    color: theme.palette.primary.main
  }
}));

const ResetPassword = () => {
  const classes = useStyles();
  const history = useHistory();
  const { colorMode } = useContext(ColorModeContext);
  const { appName } = colorMode;

  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async e => {
    e.preventDefault();
    setMessage("");
    setError("");

    if (!token) {
      setError(i18n.t("publicAccess.reset.invalidToken"));
      return;
    }

    if (!password || password.length < 6) {
      setError(i18n.t("publicAccess.reset.shortPassword"));
      return;
    }

    if (password !== confirmPassword) {
      setError(i18n.t("publicAccess.reset.mismatch"));
      return;
    }

    setLoading(true);

    try {
      const { data } = await api.post("/password-reset/reset", {
        token,
        password
      });

      setMessage(i18n.t("publicAccess.reset.success"));

      setTimeout(() => {
        history.push("/login");
      }, 2000);
    } catch (err) {
      setError(i18n.t("publicAccess.reset.invalidLink"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>{appName || i18n.t("publicAccess.common.system")} - {i18n.t("publicAccess.reset.pageTitle")}</title>
      </Helmet>

      <div className={classes.root}>
        <CssBaseline />

        <Paper elevation={8} className={classes.paper}>
          <Typography variant="h5" className={classes.title}>
            {i18n.t("publicAccess.reset.title")}
          </Typography>

          <Typography variant="body2" className={classes.subtitle}>
            {i18n.t("publicAccess.reset.subtitle")}
          </Typography>

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              variant="outlined"
              label={i18n.t("publicAccess.reset.newPassword")}
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className={classes.textField}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(s => !s)}
                      edge="end"
                      size="small"
                      style={{ color: "#9ca3af" }}
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />

            <TextField
              fullWidth
              variant="outlined"
              label={i18n.t("publicAccess.reset.confirmPassword")}
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className={classes.textField}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              color="primary"
              disabled={loading}
              className={classes.button}
            >
              {loading ? i18n.t("publicAccess.reset.saving") : i18n.t("publicAccess.reset.submit")}
            </Button>
          </form>

          {message ? (
            <Typography variant="body2" className={classes.success}>
              {message}
            </Typography>
          ) : null}

          {error ? (
            <Typography variant="body2" className={classes.error}>
              {error}
            </Typography>
          ) : null}

          <RouterLink to="/login" className={classes.link}>
            {i18n.t("publicAccess.reset.back")}
          </RouterLink>
        </Paper>
      </div>
    </>
  );
};

export default ResetPassword;
