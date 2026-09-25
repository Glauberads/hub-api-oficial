import api from "./api";

export const getWarmupConnections = async () => {
  const { data } = await api.get("/warmup");
  return data;
};

export const createWarmupConnection = async payload => {
  const { data } = await api.post("/warmup", payload);
  return data;
};

export const deleteWarmupConnection = async id => {
  const { data } = await api.delete(`/warmup/${id}`);
  return data;
};

export const getWarmupConfig = async () => {
  const { data } = await api.get("/warmup/config");
  return data;
};

export const updateWarmupConfig = async payload => {
  const { data } = await api.put("/warmup/config", payload);
  return data;
};

export const connectWarmupConnection = async id => {
  const { data } = await api.post(`/warmup/${id}/connect`);
  return data;
};

export const toggleWarmup = async () => {
  const { data } = await api.post("/warmup/toggle");
  return data;
};

export const getWarmupStatus = async () => {
  const { data } = await api.get("/warmup/status");
  return data;
};