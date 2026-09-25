// Service Worker para Web Push Notifications - MultiFLOW
const CACHE_NAME = "multiflow-v3";

const DEFAULT_ICON = "/android-chrome-512x512.png";
const DEFAULT_BADGE = "/android-chrome-192x192.png";

self.addEventListener("install", (event) => {
  console.log("[SW] Service Worker instalado");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("[SW] Service Worker ativado");
  event.waitUntil(
    (async () => {
      await self.clients.claim();
    })()
  );
});

const notifyAllClients = async (message) => {
  const clientList = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true
  });

  for (const client of clientList) {
    try {
      client.postMessage(message);
    } catch (error) {
      console.error("[SW] Erro ao enviar postMessage para client:", error);
    }
  }
};

const getTenantIdFromClients = async () => {
  try {
    const clientList = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true
    });

    for (const client of clientList) {
      if (!client.url) continue;

      const url = new URL(client.url);
      const tenantId =
        url.searchParams.get("tenantId") ||
        url.searchParams.get("companyId");

      if (tenantId) {
        return tenantId;
      }
    }
  } catch (error) {
    console.error("[SW] Erro ao detectar tenantId:", error);
  }

  return "";
};

const addCacheBuster = (url) => {
  if (!url) return "";

  const separator = String(url).includes("?") ? "&" : "?";
  return `${url}${separator}sw=${Date.now()}`;
};

const getDynamicPwaIcon = async () => {
  try {
    const tenantId = await getTenantIdFromClients();

    const manifestUrl = `/manifest.json?tenantId=${encodeURIComponent(
      tenantId || ""
    )}&t=${Date.now()}`;

    const response = await fetch(manifestUrl, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Manifest retornou status ${response.status}`);
    }

    const manifest = await response.json();

    if (!manifest.icons || !Array.isArray(manifest.icons) || !manifest.icons.length) {
      return {
        icon: DEFAULT_ICON,
        badge: DEFAULT_BADGE
      };
    }

    const icon512 =
      manifest.icons.find((icon) =>
        String(icon.sizes || "").includes("512x512")
      ) || null;

    const icon192 =
      manifest.icons.find((icon) =>
        String(icon.sizes || "").includes("192x192")
      ) || null;

    const selectedIcon = icon512 || icon192 || manifest.icons[0];

    return {
      icon: selectedIcon && selectedIcon.src ? addCacheBuster(selectedIcon.src) : DEFAULT_ICON,
      badge:
        icon192 && icon192.src
          ? addCacheBuster(icon192.src)
          : selectedIcon && selectedIcon.src
            ? addCacheBuster(selectedIcon.src)
            : DEFAULT_BADGE
    };
  } catch (error) {
    console.error("[SW] Erro ao buscar ícone dinâmico do manifest:", error);

    return {
      icon: DEFAULT_ICON,
      badge: DEFAULT_BADGE
    };
  }
};

self.addEventListener("push", (event) => {
  console.log("[SW] Push recebido:", event);

  let data = {
    title: "MultiFLOW",
    body: "Nova mensagem recebida",
    icon: "",
    badge: "",
    tag: "default",
    url: "/",
    ticketId: null,
    ticketUuid: null
  };

  try {
    if (event.data) {
      const payload = event.data.json();
      data = { ...data, ...payload };
    }
  } catch (e) {
    console.error("[SW] Erro ao parsear dados do push:", e);

    try {
      if (event.data) {
        data.body = event.data.text();
      }
    } catch (_) {}
  }

  event.waitUntil(
    (async () => {
      const dynamicIcons = await getDynamicPwaIcon();

      const finalIcon = data.icon || dynamicIcons.icon || DEFAULT_ICON;
      const finalBadge = data.badge || dynamicIcons.badge || DEFAULT_BADGE;

      const options = {
        body: data.body,
        icon: finalIcon,
        badge: finalBadge,
        tag: data.tag || "default",
        renotify: true,
        vibrate: [200, 100, 200],
        data: {
          url: data.url || "/",
          ticketId: data.ticketId || null,
          ticketUuid: data.ticketUuid || null
        },
        actions: [
          { action: "open", title: "Abrir" },
          { action: "close", title: "Fechar" }
        ]
      };

      await notifyAllClients({
        type: "PUSH_NEW_MESSAGE",
        payload: {
          title: data.title,
          body: data.body,
          icon: finalIcon,
          badge: finalBadge,
          tag: data.tag || "default",
          url: data.url || "/",
          ticketId: data.ticketId || null,
          ticketUuid: data.ticketUuid || null
        }
      });

      await self.registration.showNotification(data.title, options);
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  console.log("[SW] Notificação clicada:", event.notification.tag);
  event.notification.close();

  if (event.action === "close") return;

  const notificationData = event.notification.data || {};
  const urlToOpen = notificationData.url || "/";

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true
      });

      for (const client of clientList) {
        try {
          await client.focus();

          client.postMessage({
            type: "PUSH_NOTIFICATION_CLICKED",
            payload: {
              url: urlToOpen,
              ticketId: notificationData.ticketId || null,
              ticketUuid: notificationData.ticketUuid || null
            }
          });

          if ("navigate" in client && urlToOpen) {
            await client.navigate(urlToOpen);
          }

          return;
        } catch (error) {
          console.error("[SW] Erro ao focar/navegar client:", error);
        }
      }

      if (self.clients.openWindow) {
        await self.clients.openWindow(urlToOpen);
      }
    })()
  );
});

self.addEventListener("notificationclose", () => {
  console.log("[SW] Notificação fechada");
});