import api from "./api";

export const getEmailSettings = async (provider = "sendgrid") => {
  const { data } = await api.get("/email-settings", {
    params: {
      provider
    }
  });

  return data;
};

export const updateEmailSettings = async values => {
  const payload = {
    ...values,
    provider: values.provider || "sendgrid"
  };

  const { data } = await api.put("/email-settings", payload);
  return data;
};

export const testEmailSettings = async (to, provider = "sendgrid") => {
  const { data } = await api.post("/email-marketing/test", {
    to,
    provider
  });

  return data;
};