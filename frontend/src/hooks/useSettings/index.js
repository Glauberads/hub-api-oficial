import axios from "axios";
import api, { openApi } from "../../services/api";
import { getBackendUrl } from "../../config";

const useSettings = () => {
  const getAll = async (params) => {
    const { data } = await api.request({
      url: "/settings",
      method: "GET",
      params,
    });
    return data;
  };

  const update = async (data) => {
    const { data: responseData } = await api.request({
      url: `/settings/${data.key}`,
      method: "PUT",
      data,
    });
    return responseData;
  };

  const get = async (param) => {
    const { data } = await api.request({
      url: `/setting/${param}`,
      method: "GET",
    });
    return data;
  };

  const getPublicSetting = async (key, companyId = null) => {
    const params = companyId ? { companyId } : {};
    const { data } = await openApi.request({
      url: `/public-settings/${key}`,
      method: "GET",
      params,
    });
    return data;
  };

  const resolveToken = () => {
    const rawToken = localStorage.getItem("token");
    if (rawToken) return rawToken;

    const rawUser = localStorage.getItem("user");
    if (!rawUser) return "";

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
  };

  const uploadPublicFile = async ({ settingKey, file }) => {
  const formData = new FormData();
  formData.append("settingKey", settingKey);
  formData.append("file", file);

  const { data } = await api.post("/settings/publicFile", formData);

  return data;
};

  return {
    getAll,
    update,
    get,
    getPublicSetting,
    uploadPublicFile,
  };
};

export default useSettings;