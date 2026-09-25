const DEFAULT_TIMEOUT = 5 * 60 * 1000;

let sdkLoadingPromise = null;

const normalizeMode = (mode) => {
  if (mode === "coexistence") {
    return "coexistence";
  }

  return "cloudapi_new";
};

const parseMessageData = (event) => {
  if (!event || !event.data) {
    return null;
  }

  if (typeof event.data === "string") {
    try {
      return JSON.parse(event.data);
    } catch (error) {
      return null;
    }
  }

  if (typeof event.data === "object") {
    return event.data;
  }

  return null;
};

export const loadMetaSdk = ({ appId, version = "v25.0" }) => {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Janela do navegador não disponível."));
  }

  if (window.FB) {
    return Promise.resolve(window.FB);
  }

  if (sdkLoadingPromise) {
    return sdkLoadingPromise;
  }

  sdkLoadingPromise = new Promise((resolve, reject) => {
    window.fbAsyncInit = function fbAsyncInit() {
      try {
        window.FB.init({
          appId,
          cookie: true,
          xfbml: false,
          version
        });

        resolve(window.FB);
      } catch (error) {
        reject(error);
      }
    };

    const existingScript = document.getElementById("facebook-jssdk");
    if (existingScript) {
      return;
    }

    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    script.src = "https://connect.facebook.net/pt_BR/sdk.js";
    script.onerror = () => reject(new Error("Falha ao carregar o SDK da Meta."));
    document.body.appendChild(script);
  });

  return sdkLoadingPromise;
};

export const launchEmbeddedSignup = async ({
  appId,
  configId,
  apiVersion = "v25.0",
  mode = "cloudapi_new",
  setup = {},
  feature = "whatsapp_embedded_signup"
}) => {
  if (!appId) {
    throw new Error("META_APP_ID não informado.");
  }

  if (!configId) {
    throw new Error("META_EMBEDDED_SIGNUP_CONFIG_ID não informado.");
  }

  const FB = await loadMetaSdk({ appId, version: apiVersion });

  return new Promise((resolve, reject) => {
    let resolved = false;
    let timeoutId = null;
    let sessionPayload = null;
    let authorizationCode = null;

    const cleanup = () => {
      resolved = true;

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      window.removeEventListener("message", handleMessage);
    };

    const resolveOnce = (payload) => {
      if (resolved) {
        return;
      }

      cleanup();
      resolve(payload);
    };

    const rejectOnce = (error) => {
      if (resolved) {
        return;
      }

      cleanup();
      reject(error);
    };

    const hasSessionIdentifiers = (payload) => {
      const source = payload?.data || payload || {};
      return Boolean(
        (source.waba_id || source.wabaId || source.whatsapp_business_account_id) &&
        (source.phone_number_id ||
          source.phoneNumberId ||
          source.business_phone_number_id)
      );
    };

    const tryResolve = () => {
      if (!authorizationCode || !hasSessionIdentifiers(sessionPayload)) {
        return;
      }

      resolveOnce({
        authResponse: {
          code: authorizationCode
        },
        sessionInfo: sessionPayload
      });
    };

    const handleMessage = (event) => {
      try {
        const origin = new URL(event.origin);
        const hostname = origin.hostname.toLowerCase();
        if (
          hostname !== "facebook.com" &&
          !hostname.endsWith(".facebook.com")
        ) {
          return;
        }
      } catch (error) {
        return;
      }

      const data = parseMessageData(event);

      if (!data) {
        return;
      }

      const eventName =
        data.type ||
        data.event ||
        data.eventName ||
        data.name ||
        "";

      const isEmbeddedEvent =
        String(eventName).toLowerCase().includes("embedded") ||
        String(eventName).toLowerCase().includes("signup") ||
        hasSessionIdentifiers(data);

      if (!isEmbeddedEvent) {
        return;
      }

      sessionPayload = data;

      const finished =
        data.finished === true ||
        data.success === true ||
        String(data.event).toLowerCase() === "finished" ||
        String(data.eventName).toLowerCase() === "finished";

      const cancelled =
        data.cancelled === true ||
        data.canceled === true ||
        String(data.event).toLowerCase() === "cancelled" ||
        String(data.event).toLowerCase() === "canceled";

      if (cancelled) {
        rejectOnce(new Error("Onboarding cancelado pelo usuário."));
        return;
      }

      if (finished) {
        tryResolve();
      }
    };

    window.addEventListener("message", handleMessage);

    timeoutId = setTimeout(() => {
      rejectOnce(new Error("Tempo esgotado ao aguardar o retorno da Meta."));
    }, DEFAULT_TIMEOUT);

    const normalizedMode = normalizeMode(mode);
    const extras =
      normalizedMode === "coexistence"
        ? {
            featureType: "whatsapp_business_app_onboarding",
            sessionInfoVersion: "3"
          }
        : {
            feature,
            sessionInfoVersion: "3",
            setup: {
              ...(setup || {})
            }
          };

    FB.login(
      (response) => {
        const authResponse = response?.authResponse || null;
        authorizationCode =
          response?.code ||
          authResponse?.code ||
          response?.authResponse?.authorizationCode ||
          null;

        const declined =
          response?.status === "not_authorized" ||
          response?.status === "unknown";

        if (declined && !sessionPayload) {
          rejectOnce(new Error("Autorização da Meta não concluída."));
          return;
        }

        if (authorizationCode) {
          tryResolve();
          return;
        }

        rejectOnce(new Error("A Meta não retornou os dados do onboarding."));
      },
      {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        extras
      }
    );
  });
};

export const extractEmbeddedSignupData = (payload) => {
  const authResponse = payload?.authResponse || {};
  const sessionInfo = payload?.sessionInfo || {};
  const sessionData = sessionInfo?.data || sessionInfo;

  const code =
    authResponse?.code ||
    sessionInfo?.code ||
    sessionInfo?.authorization_code ||
    "";

  const wabaId =
    sessionData?.waba_id ||
    sessionData?.wabaId ||
    sessionData?.whatsapp_business_account_id ||
    "";

  const phoneNumberId =
    sessionData?.phone_number_id ||
    sessionData?.phoneNumberId ||
    sessionData?.business_phone_number_id ||
    "";

  const businessId =
    sessionData?.business_id ||
    sessionData?.businessId ||
    "";

  return {
    code,
    wabaId,
    phoneNumberId,
    businessId,
    raw: payload
  };
};

export default {
  loadMetaSdk,
  launchEmbeddedSignup,
  extractEmbeddedSignupData
};
