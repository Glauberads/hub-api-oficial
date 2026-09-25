import axios from "axios";
import { ICreateConnectionWhatsAppOficial, ICreateConnectionWhatsAppOficialWhatsApp, IDataCreateUserApiOficial, IPayloadAPIWhatsAppOficial, IResultTemplates, IReturnConnectionCreateAPIWhatsAppOficial, IReturnCreateCompanyAPIWhatsAppOficial, IReturnMessageMeta, ISendMessageOficial, IUpdateonnectionWhatsAppOficialWhatsApp, IUserApiOficial } from "./IWhatsAppOficial.interfaces";
import fs from 'fs';
import mime from "mime-types";
import FormData from "form-data";

const useOficial = process.env.USE_WHATSAPP_OFICIAL;
const urlApi = process.env.URL_API_OFICIAL;
const token = process.env.TOKEN_API_OFICIAL;

// ==================== HELPER ADICIONADO ====================
const normalizeReactionEmoji = (value?: string): string => {
  const emoji = String(value || "").trim();

  if (!emoji) {
    throw new Error("Emoji da reação não informado.");
  }

  return emoji;
};
// ==========================================================

export const sendMessageWhatsAppOficial = async (
    filePath: string,
    token: string,
    data: ISendMessageOficial
): Promise<IReturnMessageMeta> => {

    try {

        checkAPIOficial();

        console.log(`[sendMessageWhatsAppOficial] payload:`, JSON.stringify(data, null, 2));

        const formData = new FormData();

        if (filePath) {
            const file = fs.readFileSync(filePath);
            const mimeType = mime.lookup(filePath);
            formData.append('file', file, {
                filename: filePath.split('/').pop(),
                contentType: mimeType
            });
        }

        formData.append('data', JSON.stringify(data));

        const res = await axios.post(`${urlApi}/v1/send-message-whatsapp/${token}`, formData, {
            headers: {
                ...formData.getHeaders(),
            },
        });

        console.log(`[sendMessageWhatsAppOficial] response status: ${res.status}, data:`, JSON.stringify(res.data));

        if (res.status == 200 || res.status == 201) return res.data as IReturnMessageMeta;

        throw new Error('Falha em enviar a mensagem para a API da Meta');

    } catch (error) {
        const resStatus = error?.response?.status || 'N/A';
        const resData = error?.response?.data ? JSON.stringify(error.response.data, null, 2) : 'sem response';
        const resHeaders = error?.response?.headers ? JSON.stringify(error.response.headers) : '';
        console.error(`[sendMessageWhatsAppOficial] ===== ERRO DETALHADO =====`);
        console.error(`[sendMessageWhatsAppOficial] Status HTTP: ${resStatus}`);
        console.error(`[sendMessageWhatsAppOficial] URL chamada: ${urlApi}/v1/send-message-whatsapp/${token}`);
        console.error(`[sendMessageWhatsAppOficial] Response body: ${resData}`);
        console.error(`[sendMessageWhatsAppOficial] Payload enviado: ${JSON.stringify(data, null, 2)}`);
        const metaErrorMsg = error?.response?.data?.error?.message
            || error?.response?.data?.message
            || error?.response?.data?.error
            || error?.message
            || 'erro desconhecido';
        throw new Error(`Mensagem não enviada para a meta: ${metaErrorMsg}`);
    }

}

export const CreateCompanyConnectionOficial = async (data: ICreateConnectionWhatsAppOficial) => {
    try {

        const { company, whatsApp } = data;

        const companySaved = await CreateCompanyWhatsAppOficial(company.companyId, company.companyName);

        console.log(`Empresa: ${companySaved.id}`)

        const connection = await CreateConnectionWhatsAppOficial(whatsApp);

        console.log(`Conexão criada: ${JSON.stringify(connection)}`);

        const webhookLink = `${urlApi}/v1/webhook/${companySaved.id}/${connection.id}`;

        // salvar o webhook no banco? se for salvar tem que salvar o id da company e o da connection ou somente o link o token do webhook é do mult100
        return { webhookLink, connectionId: connection.id };

    } catch (error) {
        console.log(`CreateCompanyConnectionOficial: ${error.message}`);
        throw new Error(error.message || `Falha ao criar a empresa `);
    }
}

export const checkAPIOficial = () => {
    if (!useOficial || !urlApi || !token) {
        throw new Error('API oficial não configurada. Verifique as variáveis USE_WHATSAPP_OFICIAL, URL_API_OFICIAL e TOKEN_API_OFICIAL.');
    }
}

export const CreateCompanyWhatsAppOficial = async (companyId: string, companyName: string) => {
    try {

        const resCompanies = await axios.get(`${urlApi}/v1/companies`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const companies = resCompanies.data as Array<IReturnCreateCompanyAPIWhatsAppOficial>;

        const company = companies.find(c => String(c.idEmpresaMult100) == companyId);

        if (!!company) {
            console.log(`CreateCompanyWhatsAppOficial: data ${JSON.stringify(company)}`);
            return company
        }

        const res = await axios.post(`${urlApi}/v1/companies`, {
            idEmpresaMult100: +companyId,
            name: companyName
        },
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );

        if (res.status == 200 || res.status == 201) {
            const data = res.data as IReturnCreateCompanyAPIWhatsAppOficial;
            console.log(`CreateCompanyWhatsAppOficial: data ${JSON.stringify(data)}`);
            return data;
        }

        throw new Error('Falha em criar a empresa na API Oficial do WhatsApp');

    } catch (error) {
        console.log(`CreateCompanyWhatsAppOficial: ${JSON.stringify(error?.response?.data || error?.message)}`);
        throw new Error(error.message || `Não foi possível criar a empresa na API Oficial do WhatsApp`);
    }
}

export const CreateConnectionWhatsAppOficial = async (data: ICreateConnectionWhatsAppOficialWhatsApp) => {
    try {

        const res = await axios.post(`${urlApi}/v1/whatsapp-oficial`, { ...data },
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );

        if (res.status == 200 || res.status == 201) {
            const data = res.data as IReturnConnectionCreateAPIWhatsAppOficial;
            console.log(`CreateConnectionWhatsAppOficial: data ${JSON.stringify(data)}`);
            return data;
        }

        throw new Error(res.data.message || 'Falha em criar a empresa na API Oficial do WhatsApp');

    } catch (error) {
        console.log(`CreateConnectionWhatsAppOficial: ${JSON.stringify(error?.response?.data || error?.message)}`);
        throw new Error(error.message || `Não foi possível criar a empresa na API Oficial do WhatsApp`);
    }
}

export const UpdateConnectionWhatsAppOficial = async (idWhatsApp: number, data: IUpdateonnectionWhatsAppOficialWhatsApp) => {
    try {
        console.log(`UpdateConnectionWhatsAppOficial ${idWhatsApp}: data ${JSON.stringify(data)}`);
        const res = await axios.put(`${urlApi}/v1/whatsapp-oficial/${idWhatsApp}`, { ...data },
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );

        if (res.status == 200 || res.status == 201) {
            const data = res.data as IReturnConnectionCreateAPIWhatsAppOficial;
            console.log(`UpdateConnectionWhatsAppOficial: data ${JSON.stringify(data)}`);
            return data;
        }

        throw new Error(res.data.message || 'Falha em criar a empresa na API Oficial do WhatsApp');

    } catch (error) {
        console.log(`UpdateConnectionWhatsAppOficial: ${JSON.stringify(error?.response?.data || error?.message)}`);
        throw new Error(error.message || `Não foi possível atualizar a empresa na API Oficial do WhatsApp`);
    }
}

export const DeleteConnectionWhatsAppOficial = async (idWhatsapp: number) => {
    try {
        const res = await axios.delete(`${urlApi}/v1/whatsapp-oficial/${idWhatsapp}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );

        if (res.status == 200 || res.status == 201) {
            const data = res.data as IReturnConnectionCreateAPIWhatsAppOficial;
            console.log(`DeleteConnectionWhatsAppOficial: data ${JSON.stringify(data)}`);
            return data;
        }

        throw new Error(res.data.message || 'Falha em criar a empresa na API Oficial do WhatsApp');

    } catch (error) {
        console.log(`DeleteConnectionWhatsAppOficial: ${JSON.stringify(error?.response?.data || error?.message)}`);
        throw new Error(error.message || `Não foi possível deletar a empresa na API Oficial do WhatsApp`);
    }
}

export const getTemplatesWhatsAppOficial = async (multi100_token: string) => {
    try {
        console.log(`${urlApi}/v1/templates-whatsapp/${multi100_token}`)
        const res = await axios.get(`${urlApi}/v1/templates-whatsapp/${multi100_token}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );

        if (res.status == 200 || res.status == 201) {
            const data = res.data as IResultTemplates;
            console.log(`getTemplatesWhatsAppOficial: data ${JSON.stringify(data)}`);
            return data;
        }

        throw new Error(res.data.message || 'Falha em listar os templates da API Oficial do WhatsApp');

    } catch (error) {
        const errDetail = error?.response?.data
            ? JSON.stringify(error.response.data)
            : error?.message || "sem detalhes";
        console.log(`getTemplatesWhatsAppOficial error: ${errDetail}`);

        const errorMsg =
            error?.response?.data?.message ||
            error?.response?.data?.error ||
            error?.message ||
            `Falha em listar os templates da API Oficial do WhatsApp`;

        // Propagar indicador de token expirado
        if (errorMsg.includes('TOKEN_EXPIRED') || error?.response?.status === 401) {
            throw new Error('TOKEN_EXPIRED: O token de acesso da Meta expirou ou é inválido. Atualize o token na configuração da conexão.');
        }

        throw new Error(errorMsg);
    }
}

export const createTemplateWhatsAppOficial = async (
  multi100_token: string,
  templateData: {
    name: string;
    language: string;
    category: string;
    components: Array<any>;
  },
  filePath?: string
) => {
  try {
    const formData = new FormData();

    formData.append("data", JSON.stringify(templateData));

    if (filePath) {
      const file = fs.readFileSync(filePath);
      const mimeType = mime.lookup(filePath) || "application/octet-stream";

      formData.append("file", file, {
        filename: filePath.split("/").pop(),
        contentType: mimeType
      });
    }

    const res = await axios.post(
      `${urlApi}/v1/templates-whatsapp/${multi100_token}`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          ...formData.getHeaders()
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );

    if (res.status == 200 || res.status == 201) {
      return res.data;
    }

    throw new Error(
      res.data.message || "Falha em criar o template na API Oficial do WhatsApp"
    );
  } catch (error) {
    console.log(
      `createTemplateWhatsAppOficial: ${JSON.stringify(
        error?.response?.data || error.message
      )}`
    );

    const errorMsg =
      error?.response?.data?.message ||
      error?.response?.data?.error?.message ||
      error?.response?.data?.error ||
      error.message ||
      "Falha em criar o template na API Oficial do WhatsApp";

    if (errorMsg.includes("TOKEN_EXPIRED") || error?.response?.status === 401) {
      throw new Error(
        "TOKEN_EXPIRED: O token de acesso da Meta expirou ou é inválido. Atualize o token na configuração da conexão."
      );
    }

    throw new Error(errorMsg);
  }
};

export const deleteTemplateWhatsAppOficial = async (
    multi100_token: string,
    templateName: string
) => {
    try {
        const res = await axios.delete(
            `${urlApi}/v1/templates-whatsapp/${multi100_token}/${templateName}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );

        if (res.status == 200 || res.status == 201) {
            return res.data;
        }

        throw new Error(res.data.message || 'Falha em deletar o template na API Oficial do WhatsApp');
    } catch (error) {
        console.log(`deleteTemplateWhatsAppOficial: ${JSON.stringify(error?.response?.data || error.message)}`);
        const errorMsg = error?.response?.data?.message || error.message || 'Falha em deletar o template na API Oficial do WhatsApp';
        if (errorMsg.includes('TOKEN_EXPIRED') || error?.response?.status === 401) {
            throw new Error('TOKEN_EXPIRED: O token de acesso da Meta expirou ou é inválido. Atualize o token na configuração da conexão.');
        }
        throw new Error(errorMsg);
    }
}

export const setReadMessageWhatsAppOficial = async (token: string, messageId: string) => {
    try {

        const res = await axios.post(`${urlApi}/v1/send-message-whatsapp/read-message/${token}/${messageId}`,

        );

        if (res.status == 200 || res.status == 201) {
            const data = res.data as { success: string };
            console.log(`setReadMessageWhatsAppOficial: data ${JSON.stringify(data)}`);
            return data;
        }

        throw new Error(res.data.message || 'Falha em marcar a mensagem como lida API Oficial do WhatsApp');

    } catch (error) {
        console.log(`setReadMessageWhatsAppOficial: ${JSON.stringify(error.response.data)}`);
        throw new Error(error.message || `Falha em marcar a mensagem como lida API Oficial do WhatsApp`);
    }
}
