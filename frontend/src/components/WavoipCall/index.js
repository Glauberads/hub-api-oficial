import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTheme } from "@material-ui/core/styles";
import Wavoip from "wavoip-api";
import { Wavoip as WavoipV2 } from "@wavoip/wavoip-api";
import api from "../../services/api";
import SoundCalling from "./calling.mp3";
import SoundRinging from "./ring.mp3";

const extractWavoipCallId = value => {
  const seen = new Set();

  const walk = item => {
    if (!item) return "";

    if (typeof item === "string") {
      const direct = item.trim();
      if (/^[A-Fa-f0-9]{24,64}$/.test(direct)) return direct;

      const match = direct.match(/[A-Fa-f0-9]{24,64}/);
      return match ? match[0] : "";
    }

    if (typeof item === "number") return "";

    if (Array.isArray(item)) {
      for (const child of item) {
        const found = walk(child);
        if (found) return found;
      }
      return "";
    }

    if (typeof item === "object") {
      if (seen.has(item)) return "";
      seen.add(item);

      const keys = [
        "call_id",
        "callId",
        "callID",
        "id",
        "room",
        "call",
        "callUuid",
        "uuid"
      ];

      for (const key of keys) {
        if (item[key]) {
          const found = walk(item[key]);
          if (found) return found;
        }
      }

      for (const key of Object.keys(item)) {
        const found = walk(item[key]);
        if (found) return found;
      }
    }

    return "";
  };

  return walk(value);
};


const extractWavoipPhone = value => {
  const seen = new Set();

  const normalize = raw => {
    const digits = String(raw || "").replace(/\D/g, "");

    // BR com DDI: 55 + DDD + número
    if (/^55\d{10,11}$/.test(digits)) return digits;

    // Sem DDI: DDD + número
    if (/^\d{10,11}$/.test(digits)) return `55${digits}`;

    return "";
  };

  const walk = item => {
    if (!item) return "";

    if (typeof item === "string" || typeof item === "number") {
      return normalize(item);
    }

    if (Array.isArray(item)) {
      for (const child of item) {
        const found = walk(child);
        if (found) return found;
      }
      return "";
    }

    if (typeof item === "object") {
      if (seen.has(item)) return "";
      seen.add(item);

      const priorityKeys = [
        "phone",
        "phone_to",
        "number",
        "from",
        "fromNumber",
        "caller",
        "callerId",
        "callerNumber",
        "remoteJid",
        "jid",
        "waId",
        "whatsapp",
        "contact"
      ];

      for (const key of priorityKeys) {
        if (item[key]) {
          const found = walk(item[key]);
          if (found) return found;
        }
      }

      for (const key of Object.keys(item)) {
        const found = walk(item[key]);
        if (found) return found;
      }
    }

    return "";
  };

  return walk(value);
};

const extractWavoipName = value => {
  if (!value || typeof value !== "object") return "";

  return (
    value.name ||
    value.pushName ||
    value.displayName ||
    value.callerName ||
    value?.contact?.name ||
    value?.caller?.name ||
    ""
  );
};


const buildWavoipRecordingUrl = callId => {
  const cleanCallId = extractWavoipCallId(callId);
  if (!cleanCallId) return "";
  return `https://storage.wavoip.com/${cleanCallId}`;
};

const WavoipPhoneWidget = ({
  token,
  position = "bottom-right",
  name = "MultiFlow Phone",
  country = "BR",
  autoConnect = true,
  onCallStart,
  onCallEnd,
  onConnectionStatus,
  onError
}) => {
  const muiTheme = useTheme();

  const whiteLabelColors = useMemo(() => {
    const getCssVar = (name) => {
      if (typeof window === "undefined") return "";
      return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    };

    const getLocalColor = (keys) => {
      try {
        const user = JSON.parse(localStorage.getItem("user") || "{}");
        const company = user?.company || user?.Company || user?.companyData || {};

        for (const key of keys) {
          if (user?.[key]) return user[key];
          if (company?.[key]) return company[key];
        }
      } catch (error) {
        return "";
      }

      return "";
    };

    const primary =
      muiTheme?.palette?.primary?.main ||
      getLocalColor(["primaryColor", "colorPrimary", "mainColor", "themeColor"]) ||
      getCssVar("--primary-color") ||
      getCssVar("--color-primary") ||
      getCssVar("--main-color") ||
      getCssVar("--theme-color") ||
      "#00339E";

    const primaryText =
      muiTheme?.palette?.primary?.contrastText ||
      getCssVar("--primary-contrast-text") ||
      "#ffffff";

    const surface =
      muiTheme?.palette?.background?.paper ||
      getCssVar("--paper-color") ||
      getCssVar("--background-paper") ||
      "#ffffff";

    const text =
      muiTheme?.palette?.text?.primary ||
      getCssVar("--text-primary") ||
      "#222222";

    const muted =
      muiTheme?.palette?.text?.secondary ||
      getCssVar("--text-secondary") ||
      "#666666";

    const border =
      muiTheme?.palette?.divider ||
      getCssVar("--divider-color") ||
      "#dddddd";

    const paletteMode =
      muiTheme?.palette?.type ||
      muiTheme?.palette?.mode ||
      "light";

    const isDark = paletteMode === "dark";

    return {
      primary,
      primaryText,
      surface,
      text,
      muted,
      border,
      success: "#28a745",
      danger: "#dc3545",
      neutral: "#6c757d",
      softBackground: isDark ? "#383a3e" : "#f8f9fa",
      historyBackground: isDark ? "#303134" : "#fafafa"
    };
  }, [muiTheme]);

  const [isMinimized, setIsMinimized] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [currentNumber, setCurrentNumber] = useState("");
  const [callStatus, setCallStatus] = useState("");
  const [callDuration, setCallDuration] = useState(0);
  const [incomingCall, setIncomingCall] = useState(null);
  const [numberError, setNumberError] = useState("");
  const [callerName, setCallerName] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [callHistory, setCallHistory] = useState([]);

  // 1. Adicione este estado antes de:
  const countryUpper = String(country || "BR").toUpperCase();

  const [isMobileView, setIsMobileView] = useState(false);


  useEffect(() => {
    // limpeza preventiva de chamada pendente antiga
    // nunca iniciar ligação automaticamente ao abrir/recarregar o sistema
    try {
      localStorage.removeItem("multizap_wavoip_pending_call");
    } catch (error) {
      console.warn("[WAVOIP WIDGET] erro ao limpar chamada pendente antiga:", error);
    }
  }, []);

  useEffect(() => {
    const updateMobileView = () => {
      setIsMobileView(window.innerWidth <= 600);
    };

    updateMobileView();

    window.addEventListener("resize", updateMobileView);

    return () => {
      window.removeEventListener("resize", updateMobileView);
    };
  }, []);

  const getWidgetPositionStyle = () => {
    if (isMobileView) {
      if (position === "bottom-left") {
        return {
          bottom: "calc(145px + env(safe-area-inset-bottom, 0px))",
          left: "12px"
        };
      }

      if (position === "top-right") {
        return {
          top: "72px",
          right: "12px"
        };
      }

      if (position === "top-left") {
        return {
          top: "72px",
          left: "12px"
        };
      }

      return {
        bottom: "calc(145px + env(safe-area-inset-bottom, 0px))",
        right: "12px"
      };
    }

    if (position === "bottom-left") {
      return {
        bottom: "calc(105px + env(safe-area-inset-bottom, 0px))",
        left: "12px"
      };
    }

    if (position === "top-right") {
      return {
        top: "20px",
        right: "20px"
      };
    }

    if (position === "top-left") {
      return {
        top: "20px",
        left: "20px"
      };
    }

    return {
      bottom: "calc(105px + env(safe-area-inset-bottom, 0px))",
      right: "12px"
    };
  };

  const wavoipInstanceRef = useRef(null);
  const wavoipV2Ref = useRef(null);
  const lastWavoipCallIdRef = useRef("");
  const lastWavoipPhoneRef = useRef("");
  const lastWavoipDirectionRef = useRef("");
  const incomingWavoipMetaRef = useRef(null);
  const incomingOfferRef = useRef(null);
  const activeCallRef = useRef(null);
  const incomingCallIdRef = useRef("");
  const activeCallMetaRef = useRef(null);
  const callEndAlreadySavedRef = useRef(false);
  const incomingStartedAtRef = useRef("");
  const outgoingStartedAtRef = useRef("");
  const durationIntervalRef = useRef(null);
  const widgetRef = useRef(null);
  const audioRef = useRef(null);
  const callingSoundRef = useRef(null);
  const ringingSoundRef = useRef(null);
  const callStartTimeRef = useRef(null);

  const isMinimizedRef = useRef(isMinimized);
  const currentNumberRef = useRef(currentNumber);
  const callerNameRef = useRef(callerName);
  const isCallingRef = useRef(isCalling);
  const isInCallRef = useRef(false);
  const isConnectedCallRef = useRef(false);
  const wavoipRingingTimeoutRef = useRef(null);
  const callInProgressRef = useRef(false);
  const lastOutgoingNumberRef = useRef("");
  const callConfirmTimeoutRef = useRef(null);

  const callbacksRef = useRef({
    onCallStart,
    onCallEnd,
    onConnectionStatus,
    onError
  });

  useEffect(() => {
    callbacksRef.current = {
      onCallStart,
      onCallEnd,
      onConnectionStatus,
      onError
    };
  }, [onCallStart, onCallEnd, onConnectionStatus, onError]);

  useEffect(() => {
    isMinimizedRef.current = isMinimized;
  }, [isMinimized]);

  useEffect(() => {
    currentNumberRef.current = currentNumber;
  }, [currentNumber]);

  useEffect(() => {
    callerNameRef.current = callerName;
  }, [callerName]);

  useEffect(() => {
    isCallingRef.current = isCalling;
  }, [isCalling]);

  useEffect(() => {
    isInCallRef.current = isInCall;
  }, [isInCall]);

  const clearWavoipRingingTimeout = useCallback(() => {
    if (wavoipRingingTimeoutRef.current) {
      clearTimeout(wavoipRingingTimeoutRef.current);
      wavoipRingingTimeoutRef.current = null;
    }
  }, []);

  const keypadRows = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["*", "0", "#"]
  ];

  const styles = {
    widget: {
      position: "fixed",
      zIndex: 9999,
      fontFamily: "Arial, sans-serif",
      fontSize: "14px",
      ...getWidgetPositionStyle()
    },
    minimized: {
      width: "46px",
      height: "44px",
      backgroundColor: isInCall ? whiteLabelColors.danger : whiteLabelColors.primary,
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      transition: "all 0.3s ease",
      border: "none",
      outline: "none",
      position: "relative",
      color: whiteLabelColors.primaryText,
      fontSize: "20px"
    },
    expanded: {
      width: isMobileView ? "calc(100vw - 24px)" : "340px",
      maxWidth: isMobileView ? "340px" : "340px",
      maxHeight: isMobileView ? "calc(100vh - 190px)" : "none",
      backgroundColor: whiteLabelColors.surface,
      borderRadius: "12px",
      boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
      overflow: isMobileView ? "auto" : "hidden",
      transition: "all 0.3s ease"
    },
    header: {
      backgroundColor: whiteLabelColors.primary,
      color: whiteLabelColors.primaryText,
      padding: "15px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between"
    },
    connectionStatus: {
      display: "flex",
      alignItems: "center",
      gap: "8px"
    },
    statusIcon: {
      fontSize: "16px"
    },
    statusText: {
      fontSize: "14px",
      fontWeight: "bold"
    },
    minimizeBtn: {
      background: "none",
      border: "none",
      color: whiteLabelColors.primaryText,
      fontSize: "18px",
      cursor: "pointer",
      padding: "5px"
    },
    display: {
      padding: "18px 20px",
      textAlign: "center",
      minHeight: "135px",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center"
    },
    callInfo: {
      marginBottom: "10px"
    },
    callStatus: {
      fontSize: "16px",
      fontWeight: "bold",
      marginBottom: "5px"
    },
    phoneInput: {
      width: "100%",
      height: "42px",
      border: `1px solid ${whiteLabelColors.border}`,
      borderRadius: "8px",
      fontSize: "18px",
      fontWeight: "bold",
      textAlign: "center",
      outline: "none",
      boxSizing: "border-box",
      marginTop: "10px",
      marginBottom: "8px",
      backgroundColor: whiteLabelColors.surface,
      color: whiteLabelColors.text
    },
    callerName: {
      fontSize: "14px",
      color: whiteLabelColors.muted,
      marginBottom: "5px",
      wordBreak: "break-word"
    },
    callDuration: {
      fontSize: "14px",
      color: whiteLabelColors.muted
    },
    welcomeText: {
      fontSize: "16px",
      fontWeight: "bold",
      marginBottom: "5px"
    },
    subtitle: {
      fontSize: "12px",
      color: whiteLabelColors.muted,
      marginBottom: "5px"
    },
    numberError: {
      fontSize: "12px",
      color: whiteLabelColors.danger,
      marginTop: "5px"
    },
    keypad: {
      padding: "0 20px 15px"
    },
    keypadRow: {
      display: "flex",
      gap: "10px",
      marginBottom: "10px"
    },
    keypadKey: {
      flex: 1,
      height: "50px",
      border: `1px solid ${whiteLabelColors.border}`,
      borderRadius: "8px",
      background: whiteLabelColors.surface,
      fontSize: "18px",
      fontWeight: "bold",
      cursor: "pointer",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      transition: "all 0.2s ease",
      color: whiteLabelColors.text
    },
    keyNumber: {
      fontSize: "18px"
    },
    keySymbol: {
      fontSize: "12px",
      marginTop: "2px"
    },
    actions: {
      padding: "0 20px 14px",
      display: "flex",
      gap: "10px"
    },
    actionBtn: {
      flex: 1,
      height: "50px",
      border: "none",
      borderRadius: "8px",
      fontSize: "18px",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "all 0.2s ease"
    },
    callBtn: {
      backgroundColor: whiteLabelColors.primary,
      color: whiteLabelColors.primaryText
    },
    endCallBtn: {
      backgroundColor: whiteLabelColors.danger,
      color: "#ffffff"
    },
    clearBtn: {
      backgroundColor: whiteLabelColors.neutral,
      color: "#ffffff"
    },
    historyBtn: {
      backgroundColor: whiteLabelColors.softBackground,
      color: whiteLabelColors.text,
      border: `1px solid ${whiteLabelColors.border}`,
      borderRadius: "8px",
      height: "38px",
      cursor: "pointer",
      margin: "0 20px 16px",
      width: "calc(100% - 40px)",
      fontWeight: "bold"
    },
    historyBox: {
      margin: "0 20px 16px",
      border: `1px solid ${whiteLabelColors.border}`,
      borderRadius: "8px",
      maxHeight: "150px",
      overflowY: "auto",
      padding: "8px",
      backgroundColor: whiteLabelColors.historyBackground
    },
    historyItem: {
      fontSize: "12px",
      padding: "6px 4px",
      color: whiteLabelColors.text,
      borderBottom: `1px solid ${whiteLabelColors.border}`
    },
    incomingCallOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.82)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000
    },
    incomingCallContent: {
      backgroundColor: whiteLabelColors.surface,
      borderRadius: "12px",
      padding: "30px",
      textAlign: "center",
      maxWidth: "280px",
      color: whiteLabelColors.text
    },
    incomingCallIcon: {
      fontSize: "48px",
      color: whiteLabelColors.primary,
      marginBottom: "20px"
    },
    incomingCallInfo: {
      marginBottom: "20px"
    },
    incomingNumber: {
      fontSize: "18px",
      fontWeight: "bold",
      marginBottom: "5px",
      wordBreak: "break-word"
    },
    incomingLabel: {
      fontSize: "14px",
      color: whiteLabelColors.muted
    },
    incomingCallActions: {
      display: "flex",
      gap: "10px"
    },
    answerBtn: {
      flex: 1,
      height: "50px",
      backgroundColor: whiteLabelColors.success,
      color: "#ffffff",
      border: "none",
      borderRadius: "8px",
      fontSize: "18px",
      cursor: "pointer"
    },
    rejectBtn: {
      flex: 1,
      height: "50px",
      backgroundColor: whiteLabelColors.danger,
      color: "#ffffff",
      border: "none",
      borderRadius: "8px",
      fontSize: "18px",
      cursor: "pointer"
    },
    pulse: {
      animation: "pulse 1s infinite"
    }
  };

  const safeCallback = useCallback((callbackName, payload) => {
    const callback = callbacksRef.current?.[callbackName];

    if (typeof callback === "function") {
      callback(payload);
    }
  }, []);

  const reportError = useCallback(
    (error) => {
      console.error("[WAVOIP WIDGET] erro:", error);
      safeCallback("onError", error);
    },
    [safeCallback]
  );

  const getCallDurationSeconds = useCallback((startedAt) => {
    if (!startedAt) return 0;

    const started = new Date(startedAt).getTime();

    if (!started || Number.isNaN(started)) return 0;

    return Math.max(0, Math.floor((Date.now() - started) / 1000));
  }, []);

  const saveCallHistoryBackend = useCallback(
    async (payload) => {
      try {
        const body = {
          token_wavoip: payload.token_wavoip || token || "",
          whatsapp_id: payload.whatsapp_id || payload.whatsappId || null,
          contact_id: payload.contact_id || payload.contactId || null,
          phone_to: payload.phone_to || payload.number || "",
          name: payload.name || payload.phone_to || payload.number || "Número desconhecido",
          url: payload.url || "",

          direction: payload.direction || "outgoing",
          status: payload.status || "created",
          source: payload.source || "wavoip-widget",
          duration: payload.duration || 0,
          call_id: payload.call_id || "",
          started_at: payload.started_at || new Date().toISOString(),
          ended_at: payload.ended_at || null
        };

        console.log("[WAVOIP HISTORY] salvando no backend:", body);

        const { data } = await api.post("/call/historical/wavoip", body);

        console.log("[WAVOIP HISTORY] salvo:", data);

        return data?.callHistorical;
      } catch (error) {
        console.error(
          "[WAVOIP HISTORY] erro ao salvar:",
          error?.response?.data || error
        );

        return null;
      }
    },
    [token]
  );

  const saveEndedCallHistoryBackend = useCallback(
    async (extra = {}) => {
      try {
        if (callEndAlreadySavedRef.current) return;

        const meta = activeCallMetaRef.current || {};

        const startedAt =
          meta.started_at ||
          incomingStartedAtRef.current ||
          outgoingStartedAtRef.current ||
          new Date().toISOString();

        const callId =
          meta.call_id ||
          incomingCallIdRef.current ||
          extra.call_id ||
          "";

        const duration =
          extra.duration ||
          getCallDurationSeconds(startedAt);

        callEndAlreadySavedRef.current = true;

        await saveCallHistoryBackend({
          direction: meta.direction || extra.direction || "incoming",
          status: extra.status || "ended",
          source: extra.source || "wavoip-v2-call",
          phone_to: meta.phone_to || extra.phone_to || "",
          name: meta.name || extra.name || "",
          call_id: callId,
          started_at: startedAt,
          ended_at: new Date().toISOString(),
          duration,
          url: callId && duration > 0 ? `https://storage.wavoip.com/${callId}` : ""
        });

        localStorage.removeItem("wavoip_active_call");
          incomingWavoipMetaRef.current = null;
          lastWavoipDirectionRef.current = "";
      } catch (error) {
        console.error("[WAVOIP HISTORY] erro ao finalizar chamada:", error);
      }
    },
    [getCallDurationSeconds, saveCallHistoryBackend]
  );

  // 1. Funções auxiliares para token e base URL
  const getStoredAuthToken = useCallback(() => {
    try {
      const rawToken = localStorage.getItem("token");

      if (rawToken) {
        try {
          return JSON.parse(rawToken);
        } catch (error) {
          return String(rawToken).replace(/^"+|"+$/g, "");
        }
      }

      const rawUser = localStorage.getItem("user");

      if (rawUser) {
        const parsedUser = JSON.parse(rawUser);
        return (
          parsedUser?.token ||
          parsedUser?.accessToken ||
          parsedUser?.authToken ||
          ""
        );
      }

      return "";
    } catch (error) {
      return "";
    }
  }, []);

  const getBackendBaseUrl = useCallback(() => {
    return process.env.REACT_APP_BACKEND_URL || "";
  }, []);

  const savePendingCallBeforeUnload = useCallback(() => {
    try {
      if (callEndAlreadySavedRef.current) return;

      const meta = activeCallMetaRef.current;

      if (!meta?.call_id || !meta?.started_at) return;

      const startedAt = meta.started_at;
      const duration = getCallDurationSeconds(startedAt);

      if (duration <= 0) return;

      callEndAlreadySavedRef.current = true;

      const authToken = getStoredAuthToken();
      const backendBaseUrl = getBackendBaseUrl();

      if (!backendBaseUrl || !authToken) return;

      const body = {
        token_wavoip: token || "",
        phone_to: meta.phone_to || "",
        name: meta.name || meta.phone_to || "Número desconhecido",
        direction: meta.direction || "incoming",
        status: "ended",
        source: "browser-refresh",
        duration,
        call_id: meta.call_id,
        started_at: startedAt,
        ended_at: new Date().toISOString(),
        url: `https://storage.wavoip.com/${meta.call_id}`
      };

      fetch(`${backendBaseUrl}/call/historical/wavoip`, {
        method: "POST",
        keepalive: true,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify(body)
      });
    } catch (error) {
      console.error("[WAVOIP HISTORY] erro ao salvar antes do refresh:", error);
    }
  }, [getCallDurationSeconds, getStoredAuthToken, getBackendBaseUrl, token]);

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      const hasActiveCall =
        activeCallRef.current ||
        activeCallMetaRef.current ||
        incomingCall ||
        isInCall;

      if (!hasActiveCall) return;

      savePendingCallBeforeUnload();

      event.preventDefault();
      event.returnValue = "";

      return "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [incomingCall, isInCall, savePendingCallBeforeUnload]);

  const addLocalHistory = useCallback((item) => {
    const record = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      createdAt: new Date().toISOString(),
      ...item
    };

    setCallHistory((prev) => {
      const next = [record, ...prev].slice(0, 20);

      try {
        localStorage.setItem("wavoip_call_history", JSON.stringify(next));
      } catch (error) {
        console.warn("[WAVOIP WIDGET] não foi possível salvar histórico local:", error);
      }

      return next;
    });
  }, []);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("wavoip_call_history") || "[]");

      if (Array.isArray(saved)) {
        setCallHistory(saved.slice(0, 20));
      }
    } catch (error) {
      console.warn("[WAVOIP WIDGET] histórico local inválido:", error);
    }
  }, []);

  // 5. Recuperar chamadas pendentes ao abrir o widget
  useEffect(() => {
    const recoverPendingCall = async () => {
      try {
        const raw = localStorage.getItem("wavoip_active_call");

        if (!raw) return;

        const meta = JSON.parse(raw);

        if (!meta?.call_id || !meta?.started_at) {
          localStorage.removeItem("wavoip_active_call");
          return;
        }

        const duration = getCallDurationSeconds(meta.started_at);

        if (duration <= 0) return;

        await saveCallHistoryBackend({
          token_wavoip: token || "",
          phone_to: meta.phone_to || "",
          name: meta.name || meta.phone_to || "Número desconhecido",
          direction: meta.direction || "incoming",
          status: "ended",
          source: "browser-refresh-recovered",
          duration,
          call_id: meta.call_id,
          started_at: meta.started_at,
          ended_at: new Date().toISOString(),
          url: `https://storage.wavoip.com/${meta.call_id}`
        });

        localStorage.removeItem("wavoip_active_call");
      } catch (error) {
        console.error("[WAVOIP HISTORY] erro ao recuperar chamada pendente:", error);
      }
    };

    recoverPendingCall();
  }, [getCallDurationSeconds, saveCallHistoryBackend, token]);

  const clearCallConfirmTimeout = useCallback(() => {
    if (callConfirmTimeoutRef.current) {
      clearTimeout(callConfirmTimeoutRef.current);
      callConfirmTimeoutRef.current = null;
    }
  }, []);

  
  const rememberIncomingWavoipCall = (rawPayload, meta = {}) => {
    const callId =
      extractWavoipCallId(rawPayload) ||
      extractWavoipCallId(meta.call_id) ||
      extractWavoipCallId(meta.callId) ||
      "";

    const phone =
      extractWavoipPhone(rawPayload) ||
      extractWavoipPhone(meta.phone) ||
      extractWavoipPhone(meta.number) ||
      "";

    const displayName =
      extractWavoipName(rawPayload) ||
      meta.name ||
      phone ||
      "Chamada recebida";

    const incomingMeta = {
      call_id: callId,
      number: phone,
      phone_to: phone,
      name: displayName,
      direction: "in",
      source: meta.source || "wavoip-incoming",
      token_wavoip: token || "",
      started_at: new Date().toISOString(),
      url: callId ? buildWavoipRecordingUrl(callId) : ""
    };

    incomingWavoipMetaRef.current = incomingMeta;

    if (phone) {
      lastWavoipPhoneRef.current = phone;
    }

    if (callId) {
      lastWavoipCallIdRef.current = callId;
    }

    lastWavoipDirectionRef.current = "in";

    try {
      localStorage.setItem("wavoip_active_call", JSON.stringify(incomingMeta));
    } catch (error) {
      console.warn("[WAVOIP HISTORY] erro ao salvar metadados da chamada recebida:", error);
    }

    console.log("[WAVOIP HISTORY] chamada recebida registrada:", incomingMeta);

    return incomingMeta;
  };

  const rememberWavoipCallId = (rawCallId, meta = {}) => {
    const finalCallId = extractWavoipCallId(rawCallId);
    if (!finalCallId) return "";

    lastWavoipCallIdRef.current = finalCallId;

    try {
      const oldMeta = JSON.parse(localStorage.getItem("wavoip_active_call") || "{}");
      const activeCall = {
        ...oldMeta,
        call_id: finalCallId,
        number: meta.number || oldMeta.number || currentNumber || "",
        name: meta.name || oldMeta.name || currentNumber || "",
        token_wavoip: token || oldMeta.token_wavoip || "",
        started_at: oldMeta.started_at || new Date().toISOString(),
        source: meta.source || oldMeta.source || "wavoip-widget",
        url: buildWavoipRecordingUrl(finalCallId)
      };

      localStorage.setItem("wavoip_active_call", JSON.stringify(activeCall));
      console.log("[WAVOIP HISTORY] call_id capturado:", activeCall);
    } catch (error) {
      console.warn("[WAVOIP HISTORY] erro ao guardar call_id:", error);
    }

    return finalCallId;
  };

  const stopCalling = useCallback(() => {
    const audio = callingSoundRef.current;

    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      callingSoundRef.current = null;
      console.log("[WAVOIP WIDGET] som de chamada parado");
    }
  }, []);

  const stopRinging = useCallback(() => {
    const audio = ringingSoundRef.current;

    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      ringingSoundRef.current = null;
      console.log("[WAVOIP WIDGET] som de toque parado");
    }
  }, []);

  const unlockAudio = useCallback(() => {
    if (!audioRef.current) return;

    audioRef.current
      .play()
      .then(() => {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        console.log("[WAVOIP WIDGET] áudio desbloqueado");
      })
      .catch((error) => {
        console.warn("[WAVOIP WIDGET] navegador bloqueou desbloqueio de áudio:", error);
      });
  }, []);

  const playCalling = useCallback(async () => {
    stopCalling();
    unlockAudio();

    const audio = new Audio(SoundCalling);
    audio.loop = true;
    audio.onplay = () => console.log("[WAVOIP WIDGET] chamando tocando");
    audio.onpause = () => console.log("[WAVOIP WIDGET] chamando pausado");
    audio.onerror = (error) => console.error("[WAVOIP WIDGET] erro no som de chamada:", error);

    callingSoundRef.current = audio;

    try {
      await audio.play();
    } catch (error) {
      console.warn("[WAVOIP WIDGET] não foi possível tocar som de chamada:", error);
    }
  }, [stopCalling, unlockAudio]);

  const playRinging = useCallback(async () => {
    stopRinging();
    unlockAudio();

    const audio = new Audio(SoundRinging);
    audio.loop = true;
    audio.onplay = () => console.log("[WAVOIP WIDGET] toque tocando");
    audio.onpause = () => console.log("[WAVOIP WIDGET] toque pausado");
    audio.onerror = (error) => console.error("[WAVOIP WIDGET] erro no toque:", error);

    ringingSoundRef.current = audio;

    try {
      await audio.play();
    } catch (error) {
      console.warn("[WAVOIP WIDGET] não foi possível tocar toque:", error);
    }
  }, [stopRinging, unlockAudio]);

  const requestNotificationPermission = useCallback(() => {
    if (!("Notification" in window)) return;

    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => { });
    }
  }, []);

  const showBrowserNotification = useCallback((number) => {
    if (!("Notification" in window)) return;

    if (Notification.permission === "granted") {
      try {
        new Notification("Chamada recebida", {
          body: number || "Número desconhecido",
          icon: "/favicon.ico"
        });
      } catch (error) {
        console.warn("[WAVOIP WIDGET] erro ao mostrar notificação:", error);
      }
    }
  }, []);

  const extractIncomingNumber = useCallback((data) => {
    return (
      data?.content?.from_tag ||
      data?.content?.from ||
      data?.content?.caller ||
      data?.content?.phone ||
      data?.from_tag ||
      data?.from ||
      data?.caller ||
      data?.phone ||
      data?.number ||
      "Número desconhecido"
    );
  }, []);

  const startDurationTimer = useCallback((startTime = Date.now()) => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    callStartTimeRef.current = startTime;
    setCallDuration(0);

    durationIntervalRef.current = setInterval(() => {
      if (callStartTimeRef.current) {
        setCallDuration(Math.floor((Date.now() - callStartTimeRef.current) / 1000));
      }
    }, 1000);
  }, []);

  const stopDurationTimer = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    setCallDuration(0);
    callStartTimeRef.current = null;
  }, []);

  const handleIncomingCall = useCallback(
    (data, source = "unknown") => {
      const number = extractIncomingNumber(data);

      console.log(`[WAVOIP WIDGET] chamada recebida via ${source}:`, data);

      setIncomingCall({
        number,
        data,
        source
      });

      setCallerName(number);
      setCallStatus("Chamada recebida");

      if (isMinimizedRef.current) {
        setIsMinimized(false);
      }

      playRinging();
      showBrowserNotification(number);

      addLocalHistory({
        direction: "incoming",
        number,
        status: "received",
        source
      });

      safeCallback("onCallStart", {
        direction: "incoming",
        source,
        number,
        raw: data
      });
    },
    [
      addLocalHistory,
      extractIncomingNumber,
      playRinging,
      safeCallback,
      showBrowserNotification
    ]
  );

  const resetCallState = useCallback(
    (payload = {}) => {
      clearCallConfirmTimeout();

      callInProgressRef.current = false;
      setIsCalling(false);
      setIsInCall(false);
      setCallStatus("");
      setCallerName("");
      setCurrentNumber("");
      setIncomingCall(null);

      stopDurationTimer();
      stopRinging();
      stopCalling();

      safeCallback("onCallEnd", payload);
    },
    [
      clearCallConfirmTimeout,
      safeCallback,
      stopCalling,
      stopDurationTimer,
      stopRinging
    ]
  );

  const attachActiveCallEvents = useCallback(
    (call, direction = "incoming") => {
      if (!call) return;

      activeCallRef.current = call;

      console.log("[WAVOIP V2] chamada ativa:", call);

      const handleCallEnded = async () => {
        console.log("[WAVOIP V2] chamada encerrada");

        await saveEndedCallHistoryBackend({
          status: "ended",
          source: "wavoip-v2-call"
        });

        const number =
          activeCallMetaRef.current?.phone_to ||
          callerNameRef.current ||
          currentNumberRef.current ||
          "Número desconhecido";

        addLocalHistory({
          direction,
          number,
          status: "ended",
          source: "wavoip-v2-call"
        });

        activeCallRef.current = null;
        incomingOfferRef.current = null;

        resetCallState({
          action: "wavoip_v2_call_ended"
        });
      };

      if (typeof call.on === "function") {
        call.on("ended", handleCallEnded);
        call.on("hangup", handleCallEnded);
        call.on("close", handleCallEnded);
        call.on("disconnect", handleCallEnded);
        call.on("disconnected", handleCallEnded);
        call.on("terminated", handleCallEnded);

        call.on("status", (status) => {
          console.log("[WAVOIP V2] status:", status);
          setCallStatus(status || "Em chamada");
        });

        call.on("connectionStatus", (status) => {
          console.log("[WAVOIP V2] connectionStatus:", status);

          if (status === "connected") {
            setCallStatus("Em chamada");
          } else if (status === "connecting") {
            setCallStatus("Conectando...");
          } else if (status === "reconnecting") {
            setCallStatus("Reconectando...");
          } else if (status === "disconnected") {
            setCallStatus("Desconectado");
          }
        });

        call.on("error", (err) => {
          console.error("[WAVOIP V2] erro na chamada:", err);
          setNumberError(String(err || "Erro na chamada"));
        });
      }
    },
    [addLocalHistory, resetCallState, saveEndedCallHistoryBackend]
  );

  const connectIncomingWavoipV2 = useCallback(() => {
    if (!token) {
      console.warn("[WAVOIP V2] token ausente");
      return;
    }

    if (wavoipV2Ref.current) {
      console.log("[WAVOIP V2] já inicializado");
      return;
    }

    try {
      console.log("[WAVOIP V2] inicializando recebimento com token:", `${String(token).slice(0, 8)}...`);

      const wavoip = new WavoipV2({
        tokens: [token]
      });

      wavoipV2Ref.current = wavoip;

      if (typeof wavoip.on === "function") {
        wavoip.on("offer", (offer) => {
          console.log("[WAVOIP V2] offer recebida:", offer);

          const number =
            offer?.peer?.phone ||
            offer?.peer?.displayName ||
            "Número desconhecido";

          const displayName =
            offer?.peer?.displayName ||
            offer?.peer?.phone ||
            "Número desconhecido";

          const callId =
            offer?.id ||
            offer?.callId ||
            offer?.call_id ||
            offer?.whatsapp_call_id ||
            `incoming-${Date.now()}`;

          incomingCallIdRef.current = callId;

          rememberIncomingWavoipCall(offer, {
            call_id: callId,
            source: "wavoip-v2-offer"
          });
          incomingStartedAtRef.current = new Date().toISOString();
          callEndAlreadySavedRef.current = false;

          activeCallMetaRef.current = {
            direction: "incoming",
            source: "wavoip-v2-offer",
            phone_to: number,
            name: displayName,
            call_id: callId,
            started_at: incomingStartedAtRef.current
          };

          saveCallHistoryBackend({
            direction: "incoming",
            status: "received",
            source: "wavoip-v2-offer",
            phone_to: number,
            name: displayName,
            call_id: callId,
            started_at: incomingStartedAtRef.current
          });

          incomingOfferRef.current = offer;

          setIncomingCall({
            number,
            name: displayName,
            offer,
            callId,
            source: "wavoip-v2-offer",
            data: offer
          });

          setCallerName(displayName);
          setCallStatus("Chamada recebida");

          if (isMinimizedRef.current) {
            setIsMinimized(false);
          }

          playRinging();
          showBrowserNotification(number);

          addLocalHistory({
            direction: "incoming",
            number,
            status: "offer",
            source: "wavoip-v2-offer"
          });

          if (typeof offer.on === "function") {
            offer.on("acceptedElsewhere", () => {
              console.log("[WAVOIP V2] chamada atendida em outro lugar");
              incomingOfferRef.current = null;
              resetCallState({ action: "accepted_elsewhere" });
            });

            offer.on("rejectedElsewhere", () => {
              console.log("[WAVOIP V2] chamada rejeitada em outro lugar");
              incomingOfferRef.current = null;
              resetCallState({ action: "rejected_elsewhere" });
            });

            offer.on("unanswered", () => {
              console.log("[WAVOIP V2] chamada não atendida");
              incomingOfferRef.current = null;
              resetCallState({ action: "unanswered" });
            });

            offer.on("ended", () => {
              console.log("[WAVOIP V2] oferta encerrada");
              incomingOfferRef.current = null;
              resetCallState({ action: "offer_ended" });
            });

            offer.on("status", (status) => {
              console.log("[WAVOIP V2] offer status:", status);
              setCallStatus(status || "Chamada recebida");
            });
          }

          safeCallback("onCallStart", {
            direction: "incoming",
            source: "wavoip-v2-offer",
            number,
            offer
          });
        });
      }
    } catch (error) {
      console.error("[WAVOIP V2] erro ao inicializar recebimento:", error);
      reportError(error);
    }
  }, [
    addLocalHistory,
    playRinging,
    reportError,
    resetCallState,
    safeCallback,
    saveCallHistoryBackend,
    showBrowserNotification,
    token
  ]);

  const validateNumber = useCallback(
    (number) => {
      const cleanNumber = String(number || "").replace(/\D/g, "");

      if (!cleanNumber) {
        return { isValid: false, error: "", formatted: "", canType: true };
      }

      if (cleanNumber.length < 8) {
        return {
          isValid: false,
          error: "Número muito curto",
          formatted: cleanNumber,
          canType: true
        };
      }

      if (cleanNumber.length > 15) {
        return {
          isValid: false,
          error: "Número muito longo",
          formatted: cleanNumber,
          canType: false
        };
      }

      if (!/^[0-9]+$/.test(cleanNumber)) {
        return {
          isValid: false,
          error: "Número inválido",
          formatted: cleanNumber,
          canType: true
        };
      }

      if (countryUpper === "BR") {
        return {
          isValid: true,
          error: "",
          formatted: cleanNumber,
          canType: cleanNumber.length < 15
        };
      }

      return {
        isValid: true,
        error: "",
        formatted: cleanNumber,
        canType: cleanNumber.length < 15
      };
    },
    [countryUpper]
  );

  const validateCurrentNumber = useCallback(() => {
    if (!currentNumber) {
      setNumberError("");
      return;
    }

    const validation = validateNumber(currentNumber);
    setNumberError(validation.error);
  }, [currentNumber, validateNumber]);

  const formatDuration = useCallback((seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
      .toString()
      .padStart(2, "0")}`;
  }, []);

  const handleNumberChange = useCallback((event) => {
    const value = event.target.value || "";
    const cleanValue = value.replace(/[^\d*#]/g, "").slice(0, 15);

    setCurrentNumber(cleanValue);
  }, []);

  const clearNumber = useCallback(() => {
    setCurrentNumber((prev) => prev.slice(0, -1));
  }, []);

  const handleKeyPress = useCallback(
    (key) => {
      if (isInCall || isCallingRef.current) return;

      requestNotificationPermission();
      unlockAudio();

      setCurrentNumber((prev) => {
        const next = `${prev}${key}`.replace(/[^\d*#]/g, "");
        return next.slice(0, 15);
      });
    },
    [isInCall, requestNotificationPermission, unlockAudio]
  );

  const connectToWavoip = useCallback(async () => {
    if (!token) {
      console.warn("[WAVOIP WIDGET] token ausente, não conectou");
      return;
    }

    if (wavoipInstanceRef.current) {
      console.log("[WAVOIP WIDGET] já existe instância, evitando reconexão duplicada");
      return;
    }

    try {
      console.log("[WAVOIP WIDGET] tentando conectar com token:", `${String(token).slice(0, 8)}...`);

      const WAV = new Wavoip();
      const instance = WAV.connect(token);

      wavoipInstanceRef.current = instance;

      console.log("[WAVOIP WIDGET] instância criada:", instance);

      const markConnected = (source) => {
        console.log(`[WAVOIP WIDGET] conectado/pronto via ${source}`);
        setIsConnected(true);
        safeCallback("onConnectionStatus", "connected");
      };

      if (instance?.socket?.connected) {
        markConnected("socket.connected");
      }

      setTimeout(() => {
        if (wavoipInstanceRef.current === instance && instance?.socket?.connected) {
          markConnected("checagem 1s");
        }
      }, 1000);

      if (instance?.socket?.onAny) {
        instance.socket.onAny((eventName, ...args) => {
          console.log("[WAVOIP SOCKET EVENT]", eventName, ...args);

          const anyCallId = rememberWavoipCallId([eventName, ...args], {
            source: `socket.onAny:${eventName}`,
            number: currentNumber
          });

          if (anyCallId) {
            console.log("[WAVOIP HISTORY] call_id capturado via onAny:", anyCallId);
          }
        });
      }

      instance.socket.on("connect", () => {
        markConnected("socket.connect");
      });

      instance.socket.on("device:init", (...args) => {
        console.log("[WAVOIP WIDGET] device:init:", ...args);
        markConnected("device:init");
      });

      instance.socket.on("device:open", (...args) => {
        console.log("[WAVOIP WIDGET] device:open:", ...args);
        markConnected("device:open");
      });

      instance.socket.on("disconnect", (reason) => {
        console.log("[WAVOIP WIDGET] socket desconectado:", reason);
        setIsConnected(false);
        resetCallState({ action: "socket_disconnected", reason });
        safeCallback("onConnectionStatus", "disconnected");
      });

      instance.socket.on("connect_error", (error) => {
        console.error("[WAVOIP WIDGET] erro de conexão socket:", error);
        setIsConnected(false);
        reportError(error);
      });

      instance.socket.on("error", (error) => {
        console.error("[WAVOIP WIDGET] erro socket:", error);
        reportError(error);
      });

      instance.socket.on("signaling", (data) => {
        console.log("[WAVOIP WIDGET] signaling:", data);

        let wavoipSignalText = "";
        try {
          wavoipSignalText = JSON.stringify(data || {}).toLowerCase();
        } catch (error) {
          wavoipSignalText = String(data || "").toLowerCase();
        }

        if (
          wavoipSignalText.includes("answer") ||
          wavoipSignalText.includes("answered") ||
          wavoipSignalText.includes("accept") ||
          wavoipSignalText.includes("accepted") ||
          wavoipSignalText.includes("connect") ||
          wavoipSignalText.includes("connected") ||
          wavoipSignalText.includes("active") ||
          wavoipSignalText.includes("in_call") ||
          wavoipSignalText.includes("incall")
        ) {
          console.log("[WAVOIP WIDGET] chamada conectada via signaling");
          isConnectedCallRef.current = true;
          isInCallRef.current = true;
          clearWavoipRingingTimeout();
          setIsCalling(false);
          setIsInCall(true);
          setCallStatus("Em chamada");
          stopCalling();
          stopRinging();
          return;
        }

        const tag = data?.tag;

        if (tag === "offer") {
          handleIncomingCall(data, "socket.signaling.offer");
          return;
        }

        if (["answer", "accept_elsewhere", "accept"].includes(tag)) {
          clearCallConfirmTimeout();
          callInProgressRef.current = false;
          setIsCalling(false);
          setIsInCall(true);
          setIncomingCall(null);
          setCallStatus("Em chamada");
          startDurationTimer(Date.now());
          stopRinging();
          stopCalling();

          safeCallback("onCallStart", data);
          return;
        }

        if (["bye", "terminate", "reject_elsewhere", "reject"].includes(tag)) {
          const number =
            callerNameRef.current ||
            currentNumberRef.current ||
            extractIncomingNumber(data);

          addLocalHistory({
            direction: "unknown",
            number,
            status: tag,
            source: "socket.signaling"
          });

          resetCallState({
            action: "ended_by_signaling",
            tag,
            data
          });
        }
      });

      instance.socket.on("audio_transport:create", ({ room, sampleRate }) => {
        console.log("[WAVOIP WIDGET] audio_transport:create:", { room, sampleRate });

        rememberWavoipCallId(room, {
          source: "audio_transport:create",
          number: currentNumber
        });

        console.log("[WAVOIP WIDGET] chamada conectada via audio_transport");
        isConnectedCallRef.current = true;
        isInCallRef.current = true;
        clearWavoipRingingTimeout();
        setIsCalling(false);
        setIsInCall(true);
        setCallStatus("Em chamada");
        stopCalling();
        stopRinging();

        // Quando cria o transporte de áudio, a chamada já saiu do estado "chamando"
        setIsCalling(false);
        setIsInCall(true);
        setCallStatus("Em ligação");
        stopCalling();
        stopRinging();
        setIsInCall(true);
        setCallStatus("Conectando...");
      });

      instance.socket.on("audio_transport:terminate", ({ room }) => {
        console.log("[WAVOIP WIDGET] audio_transport:terminate:", { room });
        isConnectedCallRef.current = false;
        isInCallRef.current = false;
        clearWavoipRingingTimeout();
        resetCallState({ action: "audio_transport_terminate", room });
      });

      instance.socket.on("call:ringing", async (callId, socketRef) => {
        const number = lastOutgoingNumberRef.current || currentNumberRef.current;

        console.log("[WAVOIP WIDGET] call:ringing:", { callId, socketRef, number });

        const ringingCallId = rememberWavoipCallId([callId, socketRef], {
          source: "socket.call:ringing",
          number
        });

        if (ringingCallId) {
          try {
            await saveCallHistoryBackend({
              name: name || number || currentNumber || "",
              number: number || currentNumber || "",
              phone_to: number || currentNumber || "",
              status: "ringing",
              duration: 0,
              call_id: ringingCallId,
              url: buildWavoipRecordingUrl(ringingCallId),
              source: "socket.call:ringing"
            });
          } catch (error) {
            console.warn("[WAVOIP HISTORY] erro ao salvar call:ringing:", error);
          }
        }

        if (isConnectedCallRef.current || isInCallRef.current) {
          console.log("[WAVOIP WIDGET] call:ringing ignorado: chamada já conectada");
          setIsCalling(false);
          setCallStatus("Em chamada");
          stopCalling();
          stopRinging();
          return;
        }

        clearWavoipRingingTimeout();

        wavoipRingingTimeoutRef.current = setTimeout(() => {
          if (!isConnectedCallRef.current && !isInCallRef.current) {
            console.log("[WAVOIP WIDGET] parando status Chamando por timeout");
            setIsCalling(false);
            setCallStatus("Aberto no Wavoip");
            stopCalling();
            stopRinging();
          }
        }, 12000);

        clearCallConfirmTimeout();
        callInProgressRef.current = false;

        setIsCalling(false);
        setNumberError("");
        setIsInCall(true);
        setCallStatus("Chamando...");
        setCallerName(number);

        startDurationTimer(Date.now());
        stopCalling();

        addLocalHistory({
          direction: "outgoing",
          number,
          status: "ringing",
          source: "socket.call:ringing",
          callId
        });

        safeCallback("onCallStart", {
          direction: "outgoing",
          status: "ringing",
          number,
          callId
        });
      });

      instance.socket.on("call:ended", async (callId, socketRef) => {
        const number =
          lastOutgoingNumberRef.current ||
          callerNameRef.current ||
          currentNumberRef.current;

        console.log("[WAVOIP WIDGET] call:ended:", { callId, socketRef, number });

        try {
          let activeMeta = {};
          try {
            activeMeta = JSON.parse(localStorage.getItem("wavoip_active_call") || "{}");
          } catch (error) {
            activeMeta = {};
          }

          const endedCallId =
            rememberWavoipCallId([callId, socketRef], {
              source: "socket.call:ended",
              direction: lastWavoipDirectionRef.current || "out",
              number
            }) ||
            lastWavoipCallIdRef.current ||
            activeMeta.call_id ||
            "";

          if (endedCallId) {
            const startedAt = activeMeta.started_at
              ? new Date(activeMeta.started_at).getTime()
              : Date.now();

            const duration = Math.max(1, Math.round((Date.now() - startedAt) / 1000));

            const incomingMeta = incomingWavoipMetaRef.current || {};
            const finalDirection =
              activeMeta.direction ||
              incomingMeta.direction ||
              lastWavoipDirectionRef.current ||
              "out";

            const finalPhone =
              finalDirection === "in"
                ? (
                    incomingMeta.number ||
                    incomingMeta.phone_to ||
                    activeMeta.number ||
                    lastWavoipPhoneRef.current ||
                    number ||
                    currentNumber ||
                    ""
                  )
                : (
                    activeMeta.number ||
                    number ||
                    currentNumber ||
                    lastWavoipPhoneRef.current ||
                    ""
                  );

            const finalName =
              finalDirection === "in"
                ? (
                    incomingMeta.name ||
                    activeMeta.name ||
                    finalPhone ||
                    "Chamada recebida"
                  )
                : (
                    activeMeta.name ||
                    name ||
                    finalPhone ||
                    ""
                  );

            await saveCallHistoryBackend({
              name: finalName,
              number: finalPhone,
              phone_to: finalPhone,
              status: "ended",
              duration,
              call_id: endedCallId,
              url: buildWavoipRecordingUrl(endedCallId),
              source: "socket.call:ended",
              ended_at: new Date().toISOString()
            });

            console.log("[WAVOIP HISTORY] chamada finalizada com gravação:", endedCallId);
          } else {
            console.warn("[WAVOIP HISTORY] call:ended sem call_id. Não foi possível gerar URL da gravação.");
          }

          localStorage.removeItem("wavoip_active_call");
        } catch (error) {
          console.error("[WAVOIP HISTORY] erro ao finalizar com gravação:", error);
        }
        isConnectedCallRef.current = false;
        isInCallRef.current = false;
        clearWavoipRingingTimeout();

        addLocalHistory({
          direction: "outgoing",
          number,
          status: "ended",
          source: "socket.call:ended",
          callId
        });

        resetCallState({
          action: "call_ended",
          callId,
          socketRef
        });
      });

      instance.socket.on("call:rejected", (callId, socketRef) => {
        const number =
          lastOutgoingNumberRef.current ||
          callerNameRef.current ||
          currentNumberRef.current;

        console.log("[WAVOIP WIDGET] call:rejected:", { callId, socketRef, number });
        isConnectedCallRef.current = false;
        isInCallRef.current = false;
        clearWavoipRingingTimeout();

        addLocalHistory({
          direction: "outgoing",
          number,
          status: "rejected",
          source: "socket.call:rejected",
          callId
        });

        resetCallState({
          action: "call_rejected",
          callId,
          socketRef
        });
      });

      if (instance?.deviceEmitter?.on) {
        instance.deviceEmitter.on("incoming_call", (data) => {
          handleIncomingCall(data, "deviceEmitter.incoming_call");
        });

        instance.deviceEmitter.on("call:start", (data) => {
          console.log("[WAVOIP DEVICE EVENT] call:start:", data);
        });

        instance.deviceEmitter.on("call:end", (data) => {
          console.log("[WAVOIP DEVICE EVENT] call:end:", data);
          resetCallState({ action: "device_call_end", data });
        });

        instance.deviceEmitter.on("call:status", (data) => {
          console.log("[WAVOIP DEVICE EVENT] call:status:", data);
        });

        instance.deviceEmitter.on("error", (error) => {
          console.error("[WAVOIP DEVICE EVENT] error:", error);
          reportError(error);
        });
      }
    } catch (error) {
      reportError(error);
    }
  }, [
    addLocalHistory,
    clearCallConfirmTimeout,
    extractIncomingNumber,
    handleIncomingCall,
    playCalling,
    reportError,
    resetCallState,
    safeCallback,
    startDurationTimer,
    stopCalling,
    stopRinging,
    token
  ]);

  const openWavoipAppCall = useCallback((rawNumber, options = {}) => {
    requestNotificationPermission();
    unlockAudio();

    if (!rawNumber) {
      setNumberError("Digite um número");
      return false;
    }

    const validation = validateNumber(rawNumber);

    if (!validation.isValid) {
      console.error("[WAVOIP WIDGET] makeCall: número inválido:", validation);
      setNumberError(validation.error || "Número inválido");
      return false;
    }

    const callToken = String(options.callToken || token || "").trim();

    if (!callToken) {
      setNumberError("Token Wavoip não encontrado");
      return false;
    }

    const phone = validation.formatted;
    const displayName = options.displayName || phone;

    try {
      console.log("[WAVOIP WIDGET] abrindo chamada via app Wavoip:", phone);

      const url = `https://app.wavoip.com/call?token=${encodeURIComponent(
        callToken
      )}&phone=${encodeURIComponent(
        phone
      )}&name=${encodeURIComponent(
        displayName
      )}&start_if_ready=true&close_after_call=true`;

      const popup = window.open(
        url,
        "wavoip-call",
        "width=430,height=720,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes"
      );

      if (!popup) {
        setNumberError("Pop-up bloqueado. Libere pop-ups para este site.");
        return false;
      }

      popup.focus();

      outgoingStartedAtRef.current = new Date().toISOString();

      saveCallHistoryBackend({
        direction: "outgoing",
        status: "opened",
        source: "widget_app_url",
        phone_to: phone,
        name: displayName,
        token_wavoip: callToken,
        whatsapp_id: options.whatsappId || null,
        contact_id: options.contactId || null,
        url,
        started_at: outgoingStartedAtRef.current
      });

      clearCallConfirmTimeout();

      callInProgressRef.current = false;
      lastOutgoingNumberRef.current = phone;

      setIsCalling(false);
      setIsInCall(true);
      setNumberError("");
      setCallStatus("Aberto no Wavoip");
      setCallerName(displayName);

      startDurationTimer(Date.now());

      addLocalHistory({
        direction: "outgoing",
        number: phone,
        status: "opened_wavoip_app",
        source: "widget_app_url"
      });

      safeCallback("onCallStart", {
        direction: "outgoing",
        status: "opened_wavoip_app",
        number: phone,
        url,
        whatsappId: options.whatsappId || null
      });
      return true;
    } catch (error) {
      console.error("[WAVOIP WIDGET] erro ao abrir chamada Wavoip:", error);

      callInProgressRef.current = false;
      setIsCalling(false);
      setIsInCall(false);
      setCallStatus("");
      setNumberError(error?.message || "Erro ao abrir chamada");

      reportError(error);
      return false;
    }
  }, [
    addLocalHistory,
    clearCallConfirmTimeout,
    reportError,
    requestNotificationPermission,
    safeCallback,
    saveCallHistoryBackend,
    startDurationTimer,
    token,
    unlockAudio,
    validateNumber
  ]);

  const makeCall = useCallback(() => {
    openWavoipAppCall(currentNumber);
  }, [currentNumber, openWavoipAppCall]);

  const endCall = useCallback(async () => {
    try {
      console.log("[WAVOIP WIDGET] finalizando chamada");

      if (activeCallRef.current && typeof activeCallRef.current.hangup === "function") {
        await activeCallRef.current.hangup();
      } else if (activeCallRef.current && typeof activeCallRef.current.end === "function") {
        await activeCallRef.current.end();
        activeCallRef.current = null;
      }

      if (wavoipInstanceRef.current && typeof wavoipInstanceRef.current.endCall === "function") {
        wavoipInstanceRef.current.endCall();
      }

      await saveEndedCallHistoryBackend({
        status: "ended",
        source: "wavoip-v2-call"
      });

      addLocalHistory({
        direction: "outgoing",
        number: callerNameRef.current || currentNumberRef.current,
        status: "ended",
        source: "widget"
      });

      resetCallState({ action: "ended" });
    } catch (error) {
      reportError(error);
    }
  }, [addLocalHistory, reportError, resetCallState, saveEndedCallHistoryBackend]);

  const answerCall = useCallback(async () => {
    requestNotificationPermission();
    unlockAudio();

    const offer = incomingCall?.offer || incomingOfferRef.current;

    try {
      if (offer && typeof offer.accept === "function") {
        console.log("[WAVOIP V2] atendendo offer:", offer);

        rememberIncomingWavoipCall(offer, {
          source: "wavoip-v2-accept"
        });

        stopCalling();
        stopRinging();

        const { call, err } = await offer.accept();

        if (err || !call) {
          console.error("[WAVOIP V2] falha ao aceitar:", err);
          setNumberError(String(err || "Falha ao aceitar chamada"));
          return;
        }

        const number =
          offer?.peer?.phone ||
          incomingCall?.number ||
          "Número desconhecido";

        // 3. Preencher activeCallMetaRef ao atender
        activeCallMetaRef.current = {
          direction: "incoming",
          source: "wavoip-v2-call",
          phone_to: number,
          name: incomingCall?.name || number,
          call_id: incomingCall?.callId || incomingCallIdRef.current,
          started_at: incomingStartedAtRef.current || new Date().toISOString()
        };

        callEndAlreadySavedRef.current = false;

        // 4. Salvar no localStorage para segurança extra
        localStorage.setItem(
          "wavoip_active_call",
          JSON.stringify(activeCallMetaRef.current)
        );

        incomingOfferRef.current = null;

        setIncomingCall(null);
        setIsInCall(true);
        setIsCalling(false);
        setCallStatus("Em chamada");
        setCallerName(number);

        callInProgressRef.current = false;

        startDurationTimer(Date.now());
        attachActiveCallEvents(call, "incoming");

        addLocalHistory({
          direction: "incoming",
          number,
          status: "answered",
          source: "wavoip-v2-offer"
        });

        saveCallHistoryBackend({
          direction: "incoming",
          status: "answered",
          source: "wavoip-v2-offer",
          phone_to: number,
          name: number,
          call_id: incomingCall?.callId || incomingCallIdRef.current,
          started_at: incomingStartedAtRef.current || new Date().toISOString()
        });

        safeCallback("onCallStart", {
          direction: "incoming",
          action: "answered",
          number,
          call
        });

        return;
      }

      if (!wavoipInstanceRef.current || !incomingCall) return;

      console.log("[WAVOIP WIDGET] atendendo chamada pelo fallback antigo:", incomingCall);

      if (typeof wavoipInstanceRef.current.acceptCall === "function") {
        wavoipInstanceRef.current.acceptCall();
      }

      setIncomingCall(null);
      setIsInCall(true);
      setIsCalling(false);
      setCallStatus("Em chamada");
      setCallerName(incomingCall.number);

      callInProgressRef.current = false;

      startDurationTimer(Date.now());
      stopCalling();
      stopRinging();

      addLocalHistory({
        direction: "incoming",
        number: incomingCall.number,
        status: "answered",
        source: incomingCall.source
      });

      safeCallback("onCallStart", {
        direction: "incoming",
        action: "answered",
        number: incomingCall.number,
        raw: incomingCall.data
      });
    } catch (error) {
      console.error("[WAVOIP V2] erro ao atender:", error);
      reportError(error);
    }
  }, [
    addLocalHistory,
    attachActiveCallEvents,
    incomingCall,
    reportError,
    requestNotificationPermission,
    safeCallback,
    saveCallHistoryBackend,
    startDurationTimer,
    stopCalling,
    stopRinging,
    unlockAudio
  ]);

  const rejectCall = useCallback(async () => {
    const offer = incomingCall?.offer || incomingOfferRef.current;

    try {
      stopCalling();
      stopRinging();

      if (offer && typeof offer.reject === "function") {
        console.log("[WAVOIP V2] rejeitando offer:", offer);

        const { err } = await offer.reject();

        if (err) {
          console.error("[WAVOIP V2] erro ao rejeitar:", err);
          setNumberError(String(err));
          return;
        }

        const number =
          offer?.peer?.phone ||
          incomingCall?.number ||
          "Número desconhecido";

        incomingOfferRef.current = null;

        addLocalHistory({
          direction: "incoming",
          number,
          status: "rejected",
          source: "wavoip-v2-offer"
        });

        saveCallHistoryBackend({
          direction: "incoming",
          status: "rejected",
          source: "wavoip-v2-offer",
          phone_to: number,
          name: number,
          call_id: incomingCall?.callId || incomingCallIdRef.current,
          started_at: incomingStartedAtRef.current || new Date().toISOString(),
          ended_at: new Date().toISOString(),
          duration: getCallDurationSeconds(incomingStartedAtRef.current)
        });

        setIncomingCall(null);
        setCallerName("");
        setCallStatus("");

        safeCallback("onCallEnd", {
          direction: "incoming",
          action: "rejected",
          number
        });

        return;
      }

      if (!wavoipInstanceRef.current || !incomingCall) return;

      console.log("[WAVOIP WIDGET] rejeitando chamada pelo fallback antigo:", incomingCall);

      if (typeof wavoipInstanceRef.current.rejectCall === "function") {
        wavoipInstanceRef.current.rejectCall();
      }

      addLocalHistory({
        direction: "incoming",
        number: incomingCall.number,
        status: "rejected",
        source: incomingCall.source
      });

      setIncomingCall(null);
      setCallerName("");

      safeCallback("onCallEnd", {
        direction: "incoming",
        action: "rejected",
        number: incomingCall.number
      });
    } catch (error) {
      console.error("[WAVOIP V2] erro ao rejeitar:", error);
      reportError(error);
    }
  }, [
    addLocalHistory,
    getCallDurationSeconds,
    incomingCall,
    reportError,
    safeCallback,
    saveCallHistoryBackend,
    stopCalling,
    stopRinging
  ]);

  const toggleWidget = useCallback(() => {
    requestNotificationPermission();
    unlockAudio();
    setIsMinimized((prev) => !prev);
  }, [requestNotificationPermission, unlockAudio]);

  const handleKeyboardInput = useCallback(
    (event) => {
      if (isMinimized || isInCall || isCallingRef.current) return;

      const target = event.target;
      const isTypingInField =
        target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);

      if (isTypingInField && target.id !== "wavoip-phone-input") {
        return;
      }

      const key = event.key;

      if (/^[0-9]$/.test(key) || key === "*" || key === "#") {
        event.preventDefault();
        handleKeyPress(key);
      } else if (key === "Backspace" && target.id !== "wavoip-phone-input") {
        event.preventDefault();
        clearNumber();
      } else if (key === "Enter") {
        event.preventDefault();

        if (currentNumber && !numberError && !isCallingRef.current) {
          makeCall();
        }
      } else if (key === "Escape") {
        event.preventDefault();
        setCurrentNumber("");
        setNumberError("");
      }
    },
    [
      clearNumber,
      currentNumber,
      handleKeyPress,
      isInCall,
      isMinimized,
      makeCall,
      numberError
    ]
  );

  useEffect(() => {
    validateCurrentNumber();
  }, [currentNumber, validateCurrentNumber]);


  useEffect(() => {
    const handleConversationWavoipCall = event => {
      const detail = event?.detail || {};

      const requestedAt = Number(detail.requestedAt || 0);
      const isRecentManualRequest =
        detail.__wavoipManualRequest === true &&
        requestedAt > 0 &&
        Date.now() - requestedAt <= 15000;

      if (!isRecentManualRequest) {
        console.warn("[WAVOIP WIDGET] chamada externa ignorada por não ser clique manual recente:", detail);
        try {
          localStorage.removeItem("multizap_wavoip_pending_call");
        } catch (error) {}
        return;
      }

      const phone = String(
        detail.phone ||
        detail.number ||
        ""
      ).replace(/\D/g, "");

      const name = detail.name || phone;

      if (!phone) {
        console.warn("[WAVOIP WIDGET] pedido externo sem telefone:", detail);
        return;
      }

      console.log("[WAVOIP WIDGET] chamada recebida da conversa:", detail);
      try {
        localStorage.removeItem("multizap_wavoip_pending_call");
      } catch (error) {}

      setCurrentNumber(phone);
      setNumberError("");
      setIsMinimized(false);
      setCallStatus(`Preparando chamada para ${name}`);

      // A abertura precisa ocorrer ainda na pilha do clique original para não ser
      // bloqueada pelo navegador. O token/WhatsApp do histórico tem prioridade.
      openWavoipAppCall(phone, {
        callToken: detail.token,
        displayName: name,
        whatsappId: detail.whatsappId,
        contactId: detail.contactId
      });
    };

    window.addEventListener("multizap:wavoip-call", handleConversationWavoipCall);
    try {
      localStorage.removeItem("multizap_wavoip_pending_call");
    } catch (error) {
      console.warn("[WAVOIP WIDGET] erro ao limpar chamada pendente antiga:", error);
    }

    return () => {
      window.removeEventListener("multizap:wavoip-call", handleConversationWavoipCall);
    };
  }, [openWavoipAppCall]);

  useEffect(() => {
    if (autoConnect && token) {
      connectToWavoip();
    }
  }, [autoConnect, token, connectToWavoip]);

  useEffect(() => {
    if (autoConnect && token) {
      connectIncomingWavoipV2();
    }
  }, [autoConnect, token, connectIncomingWavoipV2]);

  useEffect(() => {
    const handleToolbarToggle = () => {
      requestNotificationPermission();
      unlockAudio();
      setIsMinimized(previous => !previous);
    };

    window.addEventListener(
      "multizap:wavoip-toggle-widget",
      handleToolbarToggle
    );

    return () => {
      window.removeEventListener(
        "multizap:wavoip-toggle-widget",
        handleToolbarToggle
      );
    };
  }, [requestNotificationPermission, unlockAudio]);

  useEffect(() => {
    if (isMinimized) return;

    document.addEventListener("keydown", handleKeyboardInput);

    return () => {
      document.removeEventListener("keydown", handleKeyboardInput);
    };
  }, [handleKeyboardInput, isMinimized]);

  useEffect(() => {
    return () => {
      clearCallConfirmTimeout();

      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      stopCalling();
      stopRinging();

      if (wavoipInstanceRef.current?.socket?.disconnect) {
        wavoipInstanceRef.current.socket.disconnect();
      }

      wavoipInstanceRef.current = null;
      wavoipV2Ref.current = null;
    };
  }, [clearCallConfirmTimeout, stopCalling, stopRinging]);

  if (isMinimized) {
    return null;
  }

  return (
    <div style={styles.widget} ref={widgetRef}>
      <style>
        {`
          @keyframes pulse {
            0% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.12); opacity: .75; }
            100% { transform: scale(1); opacity: 1; }
          }
        `}
      </style>

      <audio ref={audioRef} src={SoundRinging} preload="auto" />

      <div style={styles.expanded}>
        <div style={styles.header}>
          <div style={styles.connectionStatus}>
            <span style={styles.statusIcon}>{isConnected ? "✅" : "❌"}</span>
            <span style={styles.statusText}>
              {isConnected ? "Conectado" : "Desconectado"}
            </span>
          </div>

          <button style={styles.minimizeBtn} onClick={toggleWidget} title="Minimizar">
            −
          </button>
        </div>

        <div style={styles.display}>
          {isInCall ? (
            <div style={styles.callInfo}>
              <div style={styles.callStatus}>{callStatus}</div>

              {callerName && <div style={styles.callerName}>{callerName}</div>}

              {callDuration > 0 && (
                <div style={styles.callDuration}>{formatDuration(callDuration)}</div>
              )}
            </div>
          ) : (
            <div>
              <div style={styles.welcomeText}>{name}</div>

              <input
                id="wavoip-phone-input"
                style={styles.phoneInput}
                value={currentNumber}
                onChange={handleNumberChange}
                placeholder="Ex: 5511999999999"
                maxLength={15}
                inputMode="tel"
                disabled={isInCall || isCalling}
                onFocus={() => {
                  requestNotificationPermission();
                  unlockAudio();
                }}
              />

              <div style={{ fontSize: "12px", color: whiteLabelColors.muted, textAlign: "center" }}>
                {isCalling ? "Iniciando chamada..." : "Digite ou cole o número com DDI"}
              </div>

              {numberError && <div style={styles.numberError}>{numberError}</div>}
            </div>
          )}
        </div>

        <div style={styles.keypad}>
          {keypadRows.map((row, rowIndex) => (
            <div key={rowIndex} style={styles.keypadRow}>
              {row.map((key) => (
                <button
                  key={key}
                  style={styles.keypadKey}
                  onClick={() => handleKeyPress(key)}
                  disabled={isInCall || isCalling}
                >
                  <span style={styles.keyNumber}>{key}</span>
                  {(key === "*" || key === "#") && (
                    <span style={styles.keySymbol}>{key}</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>

        <div style={styles.actions}>
          {!isInCall ? (
            <button
              style={{ ...styles.actionBtn, ...styles.callBtn }}
              id="wavoip-start-call-button"
              onClick={makeCall}
              disabled={!currentNumber || isCalling}
              title="Ligar"
            >
              {isCalling ? "⏳" : "📞"}
            </button>
          ) : (
            <button
              style={{ ...styles.actionBtn, ...styles.endCallBtn }}
              onClick={endCall}
              title="Finalizar"
            >
              🔴
            </button>
          )}

          <button
            style={{ ...styles.actionBtn, ...styles.clearBtn }}
            onClick={clearNumber}
            disabled={isInCall || isCalling || !currentNumber}
            title="Apagar"
          >
            ⌫
          </button>
        </div>

        <button style={styles.historyBtn} onClick={() => setShowHistory((prev) => !prev)}>
          {showHistory ? "Ocultar histórico" : "Histórico local"}
        </button>

        {showHistory && (
          <div style={styles.historyBox}>
            {callHistory.length === 0 ? (
              <div style={{ fontSize: "12px", color: whiteLabelColors.muted, textAlign: "center" }}>
                Nenhum histórico local ainda
              </div>
            ) : (
              callHistory.map((item) => (
                <div key={item.id} style={styles.historyItem}>
                  <strong>
                    {item.direction === "incoming" ? "Recebida" : "Realizada"}
                  </strong>{" "}
                  - {item.number || "Número desconhecido"}
                  <br />
                  <span>
                    {item.status} - {new Date(item.createdAt).toLocaleString("pt-BR")}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {incomingCall && (
          <div style={styles.incomingCallOverlay}>
            <div style={styles.incomingCallContent}>
              <div style={styles.incomingCallIcon}>
                <span style={styles.pulse}>📞</span>
              </div>

              <div style={styles.incomingCallInfo}>
                <div style={styles.incomingNumber}>{incomingCall.number}</div>
                <div style={styles.incomingLabel}>Chamada recebida</div>
              </div>

              <div style={styles.incomingCallActions}>
                <button style={styles.answerBtn} onClick={answerCall}>
                  ✅
                </button>
                <button style={styles.rejectBtn} onClick={rejectCall}>
                  ❌
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WavoipPhoneWidget;
