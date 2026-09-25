import axios from "axios";

const baseURL = process.env.REACT_APP_BACKEND_URL;

const api = axios.create({
  baseURL,
  withCredentials: true
});

export const openApi = axios.create({
  baseURL
});

const getStoredToken = () => {
  const rawToken = localStorage.getItem("token");

  if (rawToken) {
    try {
      const parsedToken = JSON.parse(rawToken);

      if (typeof parsedToken === "string") {
        return parsedToken;
      }

      return (
        parsedToken?.token ||
        parsedToken?.accessToken ||
        parsedToken?.authToken ||
        ""
      );
    } catch (error) {
      return String(rawToken).replace(/^"+|"+$/g, "");
    }
  }

  const rawUser = localStorage.getItem("user");

  if (rawUser) {
    try {
      const parsedUser = JSON.parse(rawUser);

      return (
        parsedUser?.token ||
        parsedUser?.accessToken ||
        parsedUser?.authToken ||
        ""
      );
    } catch (error) {
      return "";
    }
  }

  return "";
};

const clearAuthData = () => {
  localStorage.removeItem("token");

  delete api.defaults.headers.common.Authorization;
};

const setAuthorizationHeader = (headers, token) => {
  const authValue = `Bearer ${token}`;

  if (!headers) {
    return { Authorization: authValue };
  }

  if (typeof headers.set === "function") {
    headers.set("Authorization", authValue);
    return headers;
  }

  headers.Authorization = authValue;
  return headers;
};

const getErrorMessage = error => {
  return (
    error?.response?.data?.error ||
    error?.response?.data?.message ||
    error?.message ||
    ""
  );
};

const isRefreshTokenRequest = config => {
  return String(config?.url || "").includes("/auth/refresh_token");
};

const shouldTryRefreshToken = error => {
  const status = error?.response?.status;
  const message = String(getErrorMessage(error));

  if (status !== 403) {
    return false;
  }

  if (
    message.includes("Invalid token") ||
    message.includes("ERR_INVALID_TOKEN") ||
    message.includes("jwt expired") ||
    message.includes("invalid signature")
  ) {
    return true;
  }

  return false;
};

const isExpiredSessionError = error => {
  const status = error?.response?.status;
  const message = String(getErrorMessage(error));

  if (status === 401) {
    return true;
  }

  if (
    status === 403 &&
    (
      message.includes("ERR_SESSION_EXPIRED") ||
      message.includes("Refresh token") ||
      message.includes("Invalid refresh token")
    )
  ) {
    return true;
  }

  return false;
};

// ============================================================
// Interceptors registrados UMA ÚNICA VEZ no nível do módulo
// ============================================================

let onUnauthorized = null;
let unauthorizedAlreadyHandled = false;

export const setOnUnauthorized = cb => {
  onUnauthorized = cb;
};

const notifyUnauthorizedOnce = () => {
  if (unauthorizedAlreadyHandled) {
    return;
  }

  unauthorizedAlreadyHandled = true;
  clearAuthData();

  if (typeof onUnauthorized === "function") {
    onUnauthorized();
  }
};

api.interceptors.request.use(
  config => {
    const token = getStoredToken();

    config.headers = config.headers || {};

    if (token) {
      config.headers = setAuthorizationHeader(config.headers, token);
    }

    return config;
  },
  error => Promise.reject(error)
);

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

api.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error?.config;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    if (isRefreshTokenRequest(originalRequest)) {
      notifyUnauthorizedOnce();
      return Promise.reject(error);
    }

    if (shouldTryRefreshToken(error) && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(token => {
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers = setAuthorizationHeader(
              originalRequest.headers,
              token
            );

            return api(originalRequest);
          })
          .catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshResponse = await axios.post(
          `${baseURL}/auth/refresh_token`,
          {},
          {
            withCredentials: true
          }
        );

        const newToken = refreshResponse?.data?.token;

        if (!newToken) {
          throw new Error("Refresh token retornou sem token.");
        }

        unauthorizedAlreadyHandled = false;

        localStorage.setItem("token", JSON.stringify(newToken));

        api.defaults.headers.common.Authorization = `Bearer ${newToken}`;

        processQueue(null, newToken);

        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers = setAuthorizationHeader(
          originalRequest.headers,
          newToken
        );

        return api(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        notifyUnauthorizedOnce();

        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    if (isExpiredSessionError(error)) {
      notifyUnauthorizedOnce();
    }

    return Promise.reject(error);
  }
);

export default api;