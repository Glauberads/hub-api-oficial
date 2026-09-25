import api from "../services/api";

const PUSH_SERVICE_WORKER_URL = "/service-worker.js";

function createPushError(message, userMessage, cause) {
  const error = new Error(message);
  error.userMessage = userMessage;
  error.cause = cause;
  return error;
}

async function waitForActiveServiceWorker(registration) {
  if (registration.active) return registration;

  const worker = registration.installing || registration.waiting;
  if (!worker) return registration;

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("SERVICE_WORKER_TIMEOUT")),
      10000
    );

    worker.addEventListener("statechange", () => {
      if (worker.state === "activated") {
        clearTimeout(timeout);
        resolve();
      } else if (worker.state === "redundant") {
        clearTimeout(timeout);
        reject(new Error("SERVICE_WORKER_REDUNDANT"));
      }
    });
  });

  return registration;
}

async function getServiceWorkerRegistration() {
  let registration = await navigator.serviceWorker.getRegistration("/");

  if (!registration) {
    registration = await navigator.serviceWorker.register(
      PUSH_SERVICE_WORKER_URL,
      { scope: "/" }
    );
  }

  await waitForActiveServiceWorker(registration);
  return navigator.serviceWorker.ready;
}

// Converte base64 URL-safe para Uint8Array (necessário para applicationServerKey)
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeToPush() {
  try {
    if (!window.isSecureContext) {
      throw createPushError(
        "PUSH_REQUIRES_HTTPS",
        "Notificações push só funcionam em HTTPS ou localhost. Acesse o sistema pelo domínio seguro."
      );
    }

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      console.warn("[PUSH] Push notifications não suportadas neste navegador");
      throw createPushError(
        "PUSH_NOT_SUPPORTED",
        "Este navegador ou dispositivo não oferece suporte a notificações push."
      );
    }

    if (!("Notification" in window)) {
      throw createPushError(
        "PUSH_NOT_SUPPORTED",
        "Este navegador ou dispositivo não oferece suporte a notificações."
      );
    }

    const registration = await getServiceWorkerRegistration();

    // Pedir permissão
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("[PUSH] Permissão de notificação negada");
      throw createPushError(
        "PUSH_PERMISSION_DENIED",
        "A permissão de notificação está bloqueada. Libere-a nas configurações do site e tente novamente."
      );
    }

    // Buscar VAPID public key do backend
    const { data } = await api.get("/push/vapid-public-key");
    if (!data.publicKey) {
      console.warn("[PUSH] VAPID public key não configurada no servidor");
      throw createPushError(
        "VAPID_NOT_CONFIGURED",
        "Push não está configurado no servidor. Configure as chaves VAPID no backend e reinicie o serviço."
      );
    }

    const currentKey = urlBase64ToUint8Array(data.publicKey);
    if (!currentKey.length) {
      throw createPushError(
        "PUSH_INVALID_VAPID_KEY",
        "A chave pública VAPID configurada no servidor é inválida."
      );
    }

    let subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const existingKey = subscription.options?.applicationServerKey
        ? new Uint8Array(subscription.options.applicationServerKey)
        : null;
      const sameKey =
        existingKey &&
        existingKey.length === currentKey.length &&
        existingKey.every((byte, index) => byte === currentKey[index]);

      if (!sameKey) {
        try {
          await api.post("/push/unsubscribe", {
            endpoint: subscription.endpoint
          });
        } catch (_) {}

        await subscription.unsubscribe().catch(() => undefined);
        subscription = null;
      }
    }

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: currentKey,
      });
    }

    // Enviar subscription para o backend
    const subscriptionJSON = subscription.toJSON();
    await api.post("/push/subscribe", {
      endpoint: subscriptionJSON.endpoint,
      keys: {
        p256dh: subscriptionJSON.keys.p256dh,
        auth: subscriptionJSON.keys.auth,
      },
    });

    console.log("[PUSH] Subscription criada com sucesso!");
    return true;
  } catch (err) {
    console.error("[PUSH] Erro ao criar subscription:", err);
    if (err?.userMessage) throw err;
    throw createPushError(
      "PUSH_SUBSCRIBE_FAILED",
      "Não foi possível ativar o push neste navegador. Atualize a página e tente novamente.",
      err
    );
  }
}

export async function unsubscribeFromPush() {
  try {
    if (!("serviceWorker" in navigator)) return true;

    const registration = await navigator.serviceWorker.getRegistration("/");
    if (!registration) return true;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await api.post("/push/unsubscribe", {
        endpoint: subscription.endpoint,
      });
      await subscription.unsubscribe();
      console.log("[PUSH] Unsubscribed com sucesso");
    }
    return true;
  } catch (err) {
    console.error("[PUSH] Erro ao cancelar subscription:", err);
    return false;
  }
}

export async function isPushSubscribed() {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return false;
    }
    const registration = await navigator.serviceWorker.getRegistration("/");
    if (!registration) return false;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch {
    return false;
  }
}
