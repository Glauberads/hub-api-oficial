import { useState, useEffect, useRef } from "react";
import { useHistory } from "react-router-dom";
import { has, isArray } from "lodash";

import { toast } from "react-toastify";

import { i18n } from "../../translate/i18n";
import api, { setOnUnauthorized } from "../../services/api";
import toastError from "../../errors/toastError";
import { socketConnection } from "../../services/socket";
import moment from "moment";

const useAuth = () => {
  const history = useHistory();
  const [isAuth, setIsAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState({});
  const [socket, setSocket] = useState(null);

  const listenersRef = useRef(new Set());
  const socketRef = useRef(null);

  useEffect(() => {
    setOnUnauthorized(() => {
      setIsAuth(false);
      if (history.location.pathname !== "/login") {
        history.push("/login");
      }
    });
    return () => setOnUnauthorized(null);
  }, [history]);

  useEffect(() => {
    const token = localStorage.getItem("token");

    (async () => {
      if (token) {
        try {
          const { data } = await api.post("/auth/refresh_token");
          api.defaults.headers.Authorization = `Bearer ${data.token}`;
          localStorage.setItem("token", data.token);
          setIsAuth(true);
          setUser(data.user || data);
        } catch (err) {
          toastError(err);
          localStorage.removeItem("token");
        }
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!user?.id || !user?.companyId) {
      return;
    }

    console.log("[SOCKET] Configurando socket para user", user.id, "company", user.companyId);

    if (socketRef.current) {
      listenersRef.current.forEach(eventName => {
        if (socketRef.current.off) {
          socketRef.current.off(eventName);
        }
      });
      listenersRef.current.clear();

      if (typeof socketRef.current.disconnect === "function") {
        socketRef.current.disconnect();
      }

      socketRef.current = null;
      setSocket(null);
    }

    const socketInstance = socketConnection({
      user: {
        companyId: user.companyId,
        id: user.id
      }
    });

    if (!socketInstance) {
      return;
    }

    socketRef.current = socketInstance;
    setSocket(socketInstance);

    const eventName = `company-${user.companyId}-user`;

    const handleUserUpdate = data => {
      if (data.action === "update" && data.user.id === user.id) {
        setUser(data.user);
      }
    };

    const handleConnect = () => {
      console.log("[SOCKET] conectado", {
        userId: user.id,
        companyId: user.companyId,
        socketId: socketInstance.id
      });
    };

    const handleConnectError = err => {
      console.error("[SOCKET] connect_error", {
        message: err?.message,
        userId: user.id,
        companyId: user.companyId
      });
    };

    if (typeof socketInstance.on === "function") {
      socketInstance.on("connect", handleConnect);
      socketInstance.on("connect_error", handleConnectError);
      socketInstance.on(eventName, handleUserUpdate);

      listenersRef.current.add("connect");
      listenersRef.current.add("connect_error");
      listenersRef.current.add(eventName);
    }

    return () => {
      if (socketRef.current) {
        listenersRef.current.forEach(listenerName => {
          if (socketRef.current.off) {
            socketRef.current.off(listenerName);
          }
        });
        listenersRef.current.clear();

        if (typeof socketRef.current.disconnect === "function") {
          socketRef.current.disconnect();
        }

        socketRef.current = null;
      }

      setSocket(null);
    };
  }, [user?.id, user?.companyId]);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const { data } = await api.get("/auth/me");
        setUser(data.user || data);
      } catch (err) {
        console.log("Erro ao buscar usuário atual:", err);
      }
    };

    if (isAuth) {
      fetchCurrentUser();
    }
  }, [isAuth]);

  const handleLogin = async userData => {
    setLoading(true);

    try {
      const { data } = await api.post("/auth/login", userData);
      const {
        user: { company }
      } = data;

      if (
        has(company, "companieSettings") &&
        isArray(company.companieSettings[0])
      ) {
        const setting = company.companieSettings[0].find(
          s => s.key === "campaignsEnabled"
        );
        if (setting && setting.value === "true") {
          localStorage.setItem("cshow", null);
        }
      }

      if (
        has(company, "companieSettings") &&
        isArray(company.companieSettings[0])
      ) {
        const setting = company.companieSettings[0].find(
          s => s.key === "sendSignMessage"
        );

        const signEnable = setting?.value === "enabled";

        if (setting) {
          localStorage.setItem("sendSignMessage", signEnable ? "true" : "false");
        }
      }

      localStorage.setItem("profileImage", data.user.profileImage || "");

      moment.locale("pt-br");
      let dueDate;
      if (data.user.company.id === 1) {
        dueDate = "2999-12-31T00:00:00.000Z";
      } else {
        dueDate = data.user.company.dueDate;
      }

      const vencimento = moment(dueDate).format("DD/MM/yyyy");
      const hojeInicio = moment().startOf("day");
      const vencimentoInicio = moment(dueDate).startOf("day");

      const diff = vencimentoInicio.diff(hojeInicio, "days");
      const before = hojeInicio.isSameOrBefore(vencimentoInicio, "day");
      const dias = diff;

      if (before === true) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("companyDueDate", vencimento);

        api.defaults.headers.Authorization = `Bearer ${data.token}`;
        setUser(data.user || data);
        setIsAuth(true);

        toast.success(i18n.t("auth.toasts.success"));

        if (Math.round(dias) < 5) {
          toast.warn(
            `Sua assinatura vence em ${Math.round(dias)} ${Math.round(dias) === 1 ? "dia" : "dias"} `
          );
        }

        history.push("/tickets");
        setLoading(false);
      } else {
        localStorage.setItem("token", data.token);
        api.defaults.headers.Authorization = `Bearer ${data.token}`;
        setUser(data.user || data);
        setIsAuth(true);

        toastError(`Opss! Sua assinatura venceu ${vencimento}.
Entre em contato com o Suporte para mais informações! `);

        history.push("/financeiro-aberto");
        setLoading(false);
      }
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const handleLogout = async () => {
    setLoading(true);

    try {
      if (socketRef.current) {
        listenersRef.current.forEach(eventName => {
          if (socketRef.current.off) {
            socketRef.current.off(eventName);
          }
        });
        listenersRef.current.clear();

        if (typeof socketRef.current.disconnect === "function") {
          socketRef.current.disconnect();
        }

        socketRef.current = null;
      }

      await api.delete("/auth/logout");
      setIsAuth(false);
      setUser({});
      setSocket(null);
      localStorage.removeItem("token");
      localStorage.removeItem("cshow");
      api.defaults.headers.Authorization = undefined;
      setLoading(false);
      history.push("/login");
    } catch (err) {
      toastError(err);
      setLoading(false);
    }
  };

  const getCurrentUserInfo = async () => {
    try {
      const { data } = await api.get("/auth/me");
      console.log(data);
      return data;
    } catch (_) {
      return null;
    }
  };

  return {
    isAuth,
    user,
    loading,
    handleLogin,
    handleLogout,
    getCurrentUserInfo,
    socket
  };
};

export default useAuth;