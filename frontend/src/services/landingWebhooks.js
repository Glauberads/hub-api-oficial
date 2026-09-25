import api from "./api";

export const listLandingWebhooks = async params => {
  const { data } = await api.get("/landing-webhooks", {
    params
  });

  return data;
};

export const showLandingWebhook = async id => {
  const { data } = await api.get(`/landing-webhooks/${id}`);

  return data;
};

export const createLandingWebhook = async payload => {
  const { data } = await api.post("/landing-webhooks", payload);

  return data;
};

export const updateLandingWebhook = async (id, payload) => {
  const { data } = await api.put(`/landing-webhooks/${id}`, payload);

  return data;
};

export const deleteLandingWebhook = async id => {
  const { data } = await api.delete(`/landing-webhooks/${id}`);

  return data;
};

export const listLandingWebhookLogs = async params => {
  const { data } = await api.get("/landing-webhook-logs", {
    params
  });

  return data;
};