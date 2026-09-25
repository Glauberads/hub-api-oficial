import React, { createContext, useState, useEffect, useContext } from "react";
import { toast } from "react-toastify";
import api from "../../services/api";
import useWhatsApps from "../../hooks/useWhatsApps";
import WavoipPhoneWidget from "../../components/WavoipCall";
import { AuthContext } from "../Auth/AuthContext";

const WhatsAppsContext = createContext();

const WhatsAppsProvider = ({ children }) => {
  const whatsAppData = useWhatsApps();
  const { loading = false, whatsApps = [], refetch } = whatsAppData || {};
  const { user, socket } = useContext(AuthContext);

  const [wavoipToken, setWavoipToken] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [error, setError] = useState(null);

  const maskToken = (token) => {
    if (!token) return null;

    const value = String(token);

    if (value.length <= 12) return "***";

    return `${value.substring(0, 8)}...${value.substring(value.length - 6)}`;
  };

  const normalizeWhatsappList = (payload) => {
    if (!payload) return [];

    if (Array.isArray(payload)) return payload;

    if (Array.isArray(payload?.whatsapps)) return payload.whatsapps;
    if (Array.isArray(payload?.whatsApps)) return payload.whatsApps;
    if (Array.isArray(payload?.whatsapp)) return payload.whatsapp;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.records)) return payload.records;
    if (Array.isArray(payload?.rows)) return payload.rows;

    return [];
  };

  const findWhatsappWithWavoip = (list = []) => {
    const validList = Array.isArray(list) ? list : [];

    const connectedWithWavoip = validList.find((item) => {
      return (
        item?.status === "CONNECTED" &&
        item?.wavoip &&
        String(item.wavoip).trim() !== ""
      );
    });

    if (connectedWithWavoip) return connectedWithWavoip;

    return validList.find((item) => {
      return item?.wavoip && String(item.wavoip).trim() !== "";
    });
  };

  useEffect(() => {
    let mounted = true;

    const fetchSession = async () => {
      if (!user?.id) {
        if (mounted) {
          setLoadingSession(false);
        }

        return;
      }

      try {
        setLoadingSession(true);
        setError(null);

        let tokenWavoip = null;
        let selectedWhatsapp = null;

        // 1. Prioridade: buscar conexão Baileys com Wavoip configurado
        try {
          const responseBaileys = await api.get("/whatsapp/?session=0");
          const listaBaileys = normalizeWhatsappList(responseBaileys.data);

          selectedWhatsapp = findWhatsappWithWavoip(listaBaileys);
          tokenWavoip = selectedWhatsapp?.wavoip || null;

          console.log("[WAVOIP CONTEXT] conexões Baileys:", listaBaileys);
          console.log("[WAVOIP CONTEXT] conexão Baileys com Wavoip:", selectedWhatsapp);
        } catch (errBaileys) {
          console.warn(
            "[WAVOIP CONTEXT] erro ao buscar conexões Baileys em /whatsapp/?session=0:",
            errBaileys
          );
        }

        // 2. Fallback: buscar em /whatsapp geral
        if (!tokenWavoip) {
          try {
            const responseWhatsapps = await api.get("/whatsapp");
            const listaWhatsapps = normalizeWhatsappList(responseWhatsapps.data);

            selectedWhatsapp = findWhatsappWithWavoip(listaWhatsapps);
            tokenWavoip = selectedWhatsapp?.wavoip || null;

            console.log("[WAVOIP CONTEXT] conexões gerais /whatsapp:", listaWhatsapps);
            console.log("[WAVOIP CONTEXT] conexão geral com Wavoip:", selectedWhatsapp);
          } catch (errWhatsapps) {
            console.warn(
              "[WAVOIP CONTEXT] erro ao buscar conexões em /whatsapp:",
              errWhatsapps
            );
          }
        }

        // 3. Último fallback: rota antiga vinculada ao usuário
        if (!tokenWavoip) {
          const { data } = await api.get("/call/historical/user/whatsapp");

          tokenWavoip =
            data?.whatsapp?.wavoip ||
            data?.whatsapps?.wavoip ||
            data?.wavoip ||
            null;

          console.log("[WAVOIP CONTEXT] fallback retorno usuário:", data);
          console.log("[WAVOIP CONTEXT] fallback data.whatsapp:", data?.whatsapp);
          console.log("[WAVOIP CONTEXT] fallback data.whatsapps:", data?.whatsapps);
        }

        console.log("[WAVOIP CONTEXT] token encontrado:", maskToken(tokenWavoip));

        if (mounted) {
          setWavoipToken(tokenWavoip);
        }
      } catch (err) {
        console.error("[WAVOIP CONTEXT] Erro fetchSession:", err);

        if (mounted) {
          setError(err);
          setWavoipToken(null);
        }
      } finally {
        if (mounted) {
          setLoadingSession(false);
        }
      }
    };

    fetchSession();

    return () => {
      mounted = false;
    };
  }, [user?.id, user?.companyId]);

  useEffect(() => {
    if (!user?.companyId || !socket || typeof socket.on !== "function") return;

    const companyId = user.companyId;
    const eventName = `company-${companyId}-templateStatus`;

    const onTemplateStatusChange = (data) => {
      if (data.action === "statusChange" && data.changes) {
        data.changes.forEach((change) => {
          if (change.newStatus === "APPROVED") {
            toast.success(`🎉 Template "${change.name}" aprovado pela Meta!`, {
              autoClose: 8000
            });
          } else if (change.newStatus === "REJECTED") {
            toast.error(`❌ Template "${change.name}" rejeitado pela Meta`, {
              autoClose: 10000
            });
          } else {
            toast.info(
              `Template "${change.name}": ${change.oldStatus} → ${change.newStatus}`,
              { autoClose: 6000 }
            );
          }
        });
      }
    };

    socket.on(eventName, onTemplateStatusChange);

    return () => {
      if (socket && typeof socket.off === "function") {
        socket.off(eventName, onTemplateStatusChange);
      }
    };
  }, [socket, user?.companyId]);

  if (error) {
    console.warn("WhatsAppsProvider error:", error);
  }

  return (
    <WhatsAppsContext.Provider
      value={{
        whatsApps,
        loading,
        loadingSession,
        error,
        refetch,
        wavoipAvailable: Boolean(wavoipToken)
      }}
    >
      {children}

      {wavoipToken && (
        <WavoipPhoneWidget
          token={wavoipToken}
          position="bottom-right"
          name={user?.company?.name || "waVoip"}
          country="BR"
          autoConnect={true}
          onCallStart={(data) => console.log("[WAVOIP] Chamada iniciada:", data)}
          onCallEnd={(data) => console.log("[WAVOIP] Chamada finalizada:", data)}
          onConnectionStatus={(status) => console.log("[WAVOIP] Status:", status)}
          onError={(widgetError) => console.error("[WAVOIP] Erro:", widgetError)}
        />
      )}
    </WhatsAppsContext.Provider>
  );
};

export { WhatsAppsContext, WhatsAppsProvider };