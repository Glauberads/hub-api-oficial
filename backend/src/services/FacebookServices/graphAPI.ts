import axios from "axios";
import { createReadStream } from "fs";
import FormData from "form-data";
import logger from "../../utils/logger";
import { isNil } from "lodash";
import Setting from "../../models/Setting";

const apiBase = (token: string) =>
  axios.create({
    baseURL: "https://graph.facebook.com/v20.0/",
    params: { access_token: token }
  });

const getSettingValue = async (
  key: string,
  companyId?: number
): Promise<string> => {
  try {
    const setting = await Setting.findOne({
      where: {
        key,
        ...(companyId ? { companyId } : {})
      }
    });

    return setting?.value || "";
  } catch (error) {
    logger.error(`ERR_GETTING_SETTING_${key}: ${error}`);
    return "";
  }
};

const getMetaCredentials = async (
  companyId?: number
): Promise<{ appId: string; appSecret: string }> => {
  const [metaAppId, metaAppSecret] = await Promise.all([
    getSettingValue("metaAppId", companyId),
    getSettingValue("metaAppSecret", companyId)
  ]);

  const appId = metaAppId || process.env.FACEBOOK_APP_ID || "";
  const appSecret = metaAppSecret || process.env.FACEBOOK_APP_SECRET || "";

  if (!appId || !appSecret) {
    throw new Error("ERR_META_APP_CREDENTIALS_NOT_CONFIGURED");
  }

  return { appId, appSecret };
};

export const getAccessToken = async (companyId?: number): Promise<string> => {
  const { appId, appSecret } = await getMetaCredentials(companyId);

  const { data } = await axios.get(
    "https://graph.facebook.com/v20.0/oauth/access_token",
    {
      params: {
        client_id: appId,
        client_secret: appSecret,
        grant_type: "client_credentials"
      }
    }
  );

  return data.access_token;
};

export const exchangeForLongLivedUserToken = async (
  token: string,
  companyId?: number
): Promise<string> => {
  try {
    if (!token) {
      throw new Error("ERR_FETCHING_FB_USER_TOKEN");
    }

    const { appId, appSecret } = await getMetaCredentials(companyId);

    const { data } = await axios.get(
      "https://graph.facebook.com/v20.0/oauth/access_token",
      {
        params: {
          client_id: appId,
          client_secret: appSecret,
          grant_type: "fb_exchange_token",
          fb_exchange_token: token
        }
      }
    );

    return data.access_token;
  } catch (error) {
    console.log(error);
    throw new Error("ERR_FETCHING_FB_USER_TOKEN");
  }
};

export const markSeen = async (id: string, token: string): Promise<void> => {
  await apiBase(token).post(`${id}/messages`, {
    recipient: { id },
    sender_action: "mark_seen"
  });
};

export const showTypingIndicator = async (
  id: string,
  token: string,
  action: string
): Promise<any> => {
  try {
    const { data } = await apiBase(token).post("me/messages", {
      recipient: { id: id },
      sender_action: action
    });
    return data;
  } catch (error) {
    return null;
  }
};

export const getCommentInfo = async (
  commentId: string,
  token: string
): Promise<any> => {
  try {
    let finalCommentId = commentId;

    if (commentId.includes("_")) {
      const parts = commentId.split("_");
      if (parts.length >= 2) {
        const alternativeId = parts[parts.length - 1];
        console.log(
          `[FACEBOOK] 🔍 Tentando buscar comentário com ID alternativo: ${alternativeId}`
        );

        try {
          const { data } = await apiBase(token).get(
            `${alternativeId}?fields=id,from{id,name},message,created_time`
          );
          if (data && data.id) {
            console.log(
              `[FACEBOOK] ✅ Comentário encontrado com ID alternativo: ${data.id}`
            );
            return data;
          }
        } catch (altError: any) {
          console.log(
            `[FACEBOOK] ⚠️ Não foi possível buscar com ID alternativo, tentando formato completo`
          );
        }
      }
    }

    console.log(
      `[FACEBOOK] 🔍 Tentando buscar comentário com ID completo: ${finalCommentId}`
    );
    const { data } = await apiBase(token).get(
      `${finalCommentId}?fields=id,from{id,name},message,created_time`
    );

    if (data && data.id) {
      console.log(`[FACEBOOK] ✅ Comentário encontrado: ${data.id}`);
    }

    return data;
  } catch (error: any) {
    const errorData = error?.response?.data || {};
    console.error(
      `[FACEBOOK] ❌ Erro ao buscar informações do comentário ${commentId}:`
    );
    console.error(`[FACEBOOK] - Código: ${errorData?.error?.code}`);
    console.error(
      `[FACEBOOK] - Mensagem: ${errorData?.error?.message || error.message}`
    );
    return null;
  }
};

export const sendPrivateReplyToComment = async (
  commentId: string,
  message: string,
  token: string
): Promise<any> => {
  try {
    console.log(
      `[FACEBOOK] 🔄 Tentando enviar Private Reply para comentário: ${commentId}`
    );

    let commentInfo = null;
    let finalCommentId = commentId;

    try {
      commentInfo = await getCommentInfo(commentId, token);
      if (commentInfo && commentInfo.id) {
        finalCommentId = commentInfo.id;
        console.log(
          `[FACEBOOK] ✅ Comentário encontrado, usando ID da API: ${finalCommentId}`
        );
      } else {
        console.warn(
          `[FACEBOOK] ⚠️ Não foi possível obter informações do comentário ${commentId}`
        );
        console.warn(
          `[FACEBOOK] ⚠️ Tentando usar o ID do webhook diretamente: ${finalCommentId}`
        );
      }
    } catch (infoError: any) {
      const infoErrorData = infoError?.response?.data || {};
      console.warn(
        `[FACEBOOK] ⚠️ Erro ao buscar informações do comentário (continuando mesmo assim):`
      );
      console.warn(`[FACEBOOK] - Código: ${infoErrorData?.error?.code}`);
      console.warn(
        `[FACEBOOK] - Mensagem: ${infoErrorData?.error?.message || infoError.message}`
      );
      console.warn(
        `[FACEBOOK] ⚠️ Tentando usar o ID do webhook diretamente: ${finalCommentId}`
      );
    }

    console.log(
      `[FACEBOOK] 📋 Tentando enviar Private Reply para comentário: ${finalCommentId}`
    );
    console.log(`[FACEBOOK] 📋 Endpoint: ${finalCommentId}/private_replies`);

    try {
      const { data } = await apiBase(token).post(
        `${finalCommentId}/private_replies`,
        { message: message }
      );

      console.log(
        `[FACEBOOK] ✅ Private Reply enviada com sucesso para comentário ${finalCommentId}`
      );
      console.log(`[FACEBOOK] 📋 Resposta:`, JSON.stringify(data, null, 2));

      return data;
    } catch (privateReplyError: any) {
      const privateReplyErrorData = privateReplyError?.response?.data || {};
      console.error(
        `[FACEBOOK] ❌ Erro ao enviar Private Reply para ${finalCommentId}:`
      );
      console.error(
        `[FACEBOOK] - Código: ${privateReplyErrorData?.error?.code}`
      );
      console.error(
        `[FACEBOOK] - Subcode: ${privateReplyErrorData?.error?.error_subcode}`
      );
      console.error(
        `[FACEBOOK] - Mensagem: ${
          privateReplyErrorData?.error?.message || privateReplyError.message
        }`
      );
      console.error(
        `[FACEBOOK] - Tipo: ${privateReplyErrorData?.error?.type}`
      );
      throw privateReplyError;
    }
  } catch (error: any) {
    const errorData = error?.response?.data || {};
    const errorCode = errorData?.error?.code;
    const errorMessage = errorData?.error?.message || error.message;
    const errorSubcode = errorData?.error?.error_subcode;

    console.error(
      `[FACEBOOK] ❌ Erro ao enviar Private Reply para comentário ${commentId}:`
    );
    console.error(`[FACEBOOK] - Código: ${errorCode}`);
    console.error(`[FACEBOOK] - Subcode: ${errorSubcode}`);
    console.error(`[FACEBOOK] - Mensagem: ${errorMessage}`);

    if (errorCode === 100 && commentId.includes("_")) {
      const parts = commentId.split("_");
      if (parts.length >= 2) {
        const alternativeId = parts[parts.length - 1];
        console.log(
          `[FACEBOOK] 🔄 Tentativa 2: Usando apenas comment_id: ${alternativeId}`
        );

        try {
          const { data } = await apiBase(token).post(
            `${alternativeId}/private_replies`,
            { message: message }
          );
          console.log(
            `[FACEBOOK] ✅ Private Reply enviada com formato alternativo: ${alternativeId}`
          );
          return data;
        } catch (altError: any) {
          const altErrorData = altError?.response?.data || {};
          console.error(`[FACEBOOK] ❌ Erro também com formato alternativo:`);
          console.error(`[FACEBOOK] - Código: ${altErrorData?.error?.code}`);
          console.error(
            `[FACEBOOK] - Mensagem: ${
              altErrorData?.error?.message || altError.message
            }`
          );
          console.error(`[FACEBOOK] ⚠️ A Private Reply API pode requerer:`);
          console.error(
            `[FACEBOOK] - Permissão 'pages_messaging' ou 'pages_manage_metadata'`
          );
          console.error(
            `[FACEBOOK] - O comentário deve existir e ser da página`
          );
          console.error(
            `[FACEBOOK] - A página deve ter Messenger habilitado`
          );
          console.error(
            `[FACEBOOK] - O comentário não pode ter sido removido`
          );
          console.error(
            `[FACEBOOK] - A página precisa estar publicada (não em modo rascunho)`
          );
        }
      }
    }

    return null;
  }
};

export const sendText = async (
  id: string | number,
  text: string,
  token: string,
  tag?: string | null,
  commentId?: string | null
): Promise<any> => {
  try {
    console.log("tag SendText", tag);

    if (!isNil(tag)) {
      const { data } = await apiBase(token).post("me/messages", {
        recipient: { id },
        message: { text: `${text}` },
        messaging_type: "MESSAGE_TAG",
        tag: tag
      });
      return data;
    } else {
      const { data } = await apiBase(token).post("me/messages", {
        recipient: { id },
        message: { text: `${text}` }
      });
      return data;
    }
  } catch (error: any) {
    logger.error(`ERR_SENDING_MESSAGE_TO_FACEBOOK_TRY_3: ${error}`);

    if (error?.response?.status === 400) {
      const errorMessage = error?.response?.data?.error?.message || "";
      const errorCode = error?.response?.data?.error?.code || "";

      console.error(`[FACEBOOK] ❌ Erro ao enviar mensagem direta:`);
      console.error(`[FACEBOOK] - Código: ${errorCode}`);
      console.error(`[FACEBOOK] - Mensagem: ${errorMessage}`);
      console.error(`[FACEBOOK] - Recipient ID: ${id}`);
      console.error(`[FACEBOOK] - Tag: ${tag || "nenhuma"}`);

      if (
        (errorMessage.includes("551") ||
          errorMessage.includes("não está disponível")) &&
        commentId
      ) {
        console.log(
          `[FACEBOOK] ⚠️ ERRO 551: Tentando usar Private Reply API para comentário ${commentId}`
        );
        console.log(`[FACEBOOK] 📋 CommentId recebido: ${commentId}`);

        try {
          console.log(
            `[FACEBOOK] 🔄 Chamando sendPrivateReplyToComment com commentId: ${commentId}`
          );
          const privateReply = await sendPrivateReplyToComment(
            commentId,
            text,
            token
          );

          if (privateReply) {
            console.log(
              `[FACEBOOK] ✅ Mensagem enviada via Private Reply (Direct do contato)`
            );
            console.log(
              `[FACEBOOK] 📋 Resposta da Private Reply:`,
              JSON.stringify(privateReply, null, 2)
            );
            return {
              message_id: privateReply.id || `private-reply-${Date.now()}`,
              id: privateReply.id,
              recipient_id: id,
              private_reply: true
            };
          } else {
            console.error(
              `[FACEBOOK] ❌ Private Reply retornou null - não foi possível enviar`
            );
            console.error(`[FACEBOOK] ⚠️ Possíveis causas:`);
            console.error(
              `[FACEBOOK] - Comment ID pode estar no formato incorreto`
            );
            console.error(
              `[FACEBOOK] - Página pode não ter permissões para Private Replies`
            );
            console.error(
              `[FACEBOOK] - Comentário pode não existir ou ter sido removido`
            );
            console.error(
              `[FACEBOOK] - Usuário pode ter bloqueado mensagens da página`
            );
          }
        } catch (privateReplyError: any) {
          const privateReplyErrorData =
            privateReplyError?.response?.data || {};
          console.error(`[FACEBOOK] ❌ Exceção ao enviar Private Reply:`);
          console.error(
            `[FACEBOOK] - Código: ${privateReplyErrorData?.error?.code}`
          );
          console.error(
            `[FACEBOOK] - Subcode: ${privateReplyErrorData?.error?.error_subcode}`
          );
          console.error(
            `[FACEBOOK] - Mensagem: ${
              privateReplyErrorData?.error?.message ||
              privateReplyError.message
            }`
          );
          console.error(
            `[FACEBOOK] - Tipo: ${privateReplyErrorData?.error?.type}`
          );
          console.error(`[FACEBOOK] ⚠️ Possíveis causas do erro 551:`);
          console.error(`[FACEBOOK] - ID do comentário pode não ser válido`);
          console.error(
            `[FACEBOOK] - Usuário pode ter bloqueado a página ou ter restrições no Messenger`
          );
          console.error(
            `[FACEBOOK] - Tag ACCOUNT_UPDATE pode não estar sendo aceita`
          );
          console.error(
            `[FACEBOOK] - Usuário pode não ter permitido mensagens da página`
          );
          console.error(
            `[FACEBOOK] - A Private Reply API pode não estar disponível para este tipo de comentário`
          );
        }
      }
    }

    try {
      if (!isNil(tag)) {
        const { data } = await apiBase(token).post("me/messages", {
          recipient: { id },
          message: { text: `${text}` },
          messaging_type: "MESSAGE_TAG",
          tag: tag
        });
        return data;
      } else {
        throw new Error("ERR_SENDING_MESSAGE_TO_FACEBOOK_TRY_3");
      }
    } catch (error) {
      console.log(error);
      throw error;
    }
  }
};

export const sendAttachmentFromUrl = async (
  id: string,
  url: string,
  type: string,
  token: string
): Promise<any> => {
  try {
    const { data } = await apiBase(token).post("me/messages", {
      recipient: { id },
      message: {
        attachment: {
          type,
          payload: { url }
        }
      }
    });
    return data;
  } catch (error: any) {
    console.error(
      `[FACEBOOK] Erro ao enviar attachment (${type}):`,
      error?.response?.data || error?.message || error
    );
    throw error;
  }
};

export const sendAttachment = async (
  id: string,
  file: Express.Multer.File,
  type: string,
  token: string
): Promise<any> => {
  const formData = new FormData();

  formData.append(
    "message",
    JSON.stringify({
      attachment: {
        type,
        payload: {
          is_reusable: true
        }
      }
    })
  );

  const fileReaderStream = createReadStream(file.path);

  formData.append("filedata", fileReaderStream, {
    filename: file.originalname || file.filename,
    contentType: file.mimetype || undefined
  });

  try {
    // Descobre o ID explícito da Página associada ao token.
    // O endpoint message_attachments não aceita "me" no POST.
    const pageResponse = await apiBase(token).get("me", {
      params: {
        fields: "id"
      }
    });

    const pageId = pageResponse?.data?.id;

    if (!pageId) {
      console.error(
        "[FACEBOOK] Não foi possível identificar o ID da Página:",
        pageResponse?.data
      );
      throw new Error("META_PAGE_ID_NOT_RETURNED");
    }

    // Primeira etapa: carrega o arquivo nos servidores da Meta.
    const uploadResponse = await apiBase(token).post(
      `${pageId}/message_attachments`,
      formData,
      {
        headers: {
          ...formData.getHeaders()
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );

    const attachmentId = uploadResponse?.data?.attachment_id;

    if (!attachmentId) {
      console.error(
        `[FACEBOOK] Upload concluído sem attachment_id (${type}):`,
        uploadResponse?.data
      );
      throw new Error("META_ATTACHMENT_ID_NOT_RETURNED");
    }


    // Envia vídeo como anexo comum. Nesta conexão, o Media Template
    // é aceito pela API, mas aparece vazio no aplicativo Messenger.
    const { data } = await apiBase(token).post("me/messages", {
      recipient: { id },
      message: {
        attachment: {
          type,
          payload: {
            attachment_id: attachmentId
          }
        }
      }
    });

    console.log("[FACEBOOK] Mídia enviada como anexo comum:", {
      type,
      attachmentId
    });

    return data;
  } catch (error: any) {
    console.error(
      `[FACEBOOK] Erro no upload/envio do attachment (${type}):`,
      error?.response?.data || error?.message || error
    );
    throw error;
  }
};

export const genText = (text: string): any => {
  const response = { text };
  return response;
};

export const getProfile = async (id: string, token: string): Promise<any> => {
  try {
    const { data } = await axios.get(
      `https://graph.facebook.com/v20.0/${id}?fields=first_name,last_name,name,profile_pic&access_token=${token}`
    );

    const fullName =
      data?.name ||
      [data?.first_name, data?.last_name].filter(Boolean).join(" ").trim() ||
      id;

    return {
      ...data,
      id,
      name: fullName,
      username: fullName,
      profile_pic: data?.profile_pic || null
    };
  } catch (error: any) {
    const errorData = error?.response?.data || {};
    console.log(
      `[FACEBOOK] Falha ao buscar perfil Messenger do PSID ${id}:`,
      JSON.stringify(errorData, null, 2)
    );

    try {
      const { data } = await axios.get(
        `https://graph.facebook.com/v20.0/${id}?fields=name,username,profile_pic&access_token=${token}`
      );

      return {
        ...data,
        id,
        name: data?.name || data?.username || id,
        username: data?.username || data?.name || id,
        profile_pic: data?.profile_pic || null
      };
    } catch (error2: any) {
      const errorData2 = error2?.response?.data || {};
      console.log(
        `[FACEBOOK] Falha também no fallback de perfil ${id}:`,
        JSON.stringify(errorData2, null, 2)
      );

      return {
        id,
        name: `Facebook ${id}`,
        username: `Facebook ${id}`,
        profile_pic: null
      };
    }
  }
};

export const getPageProfile = async (
  id: string,
  token: string
): Promise<any> => {
  try {
    const { data } = await apiBase(token).get(
      `${id}/accounts?fields=id,name,access_token,instagram_business_account{id,username,profile_picture_url,name}`
    );
    return data;
  } catch (error) {
    console.log(error);
    throw new Error("ERR_FETCHING_FB_PAGES");
  }
};

export const profilePsid = async (id: string, token: string): Promise<any> => {
  try {
    const { data } = await axios.get(
      `https://graph.facebook.com/v20.0/${id}?fields=first_name,last_name,name,profile_pic&access_token=${token}`
    );

    const fullName =
      data?.name ||
      [data?.first_name, data?.last_name].filter(Boolean).join(" ").trim() ||
      id;

    return {
      ...data,
      id,
      name: fullName,
      username: fullName,
      profile_pic: data?.profile_pic || null
    };
  } catch (error) {
    return await getProfile(id, token);
  }
};

export const getPostData = async (
  postId: string,
  token: string
): Promise<any> => {
  try {
    const { data } = await apiBase(token).get(
      `${postId}?fields=message,story,created_time,permalink_url,full_picture,picture,attachments{media{image{src}},subattachments{media{image{src}}}}`
    );
    return data;
  } catch (error) {
    console.error(`[FACEBOOK] Erro ao buscar dados do post ${postId}:`, error);
    return null;
  }
};

export const getInstagramMediaData = async (
  mediaId: string,
  token: string
): Promise<any> => {
  try {
    const { data } = await apiBase(token).get(
      `${mediaId}?fields=id,caption,media_type,media_url,permalink,timestamp,username`
    );
    return data;
  } catch (error) {
    console.error(
      `[INSTAGRAM] Erro ao buscar dados da mídia ${mediaId}:`,
      error
    );
    try {
      const { data } = await axios.get(
        `https://graph.instagram.com/v20.0/${mediaId}?fields=id,caption,media_type,media_url,permalink,timestamp,username&access_token=${token}`
      );
      return data;
    } catch (error2) {
      console.error(
        `[INSTAGRAM] Erro ao buscar dados da mídia ${mediaId} (tentativa 2):`,
        error2
      );
      return null;
    }
  }
};

const DEFAULT_SUBSCRIBED_FIELDS = [
  "messages",
  "messaging_postbacks",
  "message_deliveries",
  "message_reads",
  "message_echoes",
  "message_reactions",
  "message_mention",
  "mention",
  "feed"
];

const INSTAGRAM_SUBSCRIBED_FIELDS = [
  "messages",
  "comments",
  "mentions",
  "live_comments",
  "message_reactions",
  "messaging_postbacks",
  "messaging_optins",
  "messaging_referral",
  "messaging_seen"
];

export const subscribeApp = async (
  id: string,
  token: string,
  isInstagramAccount: boolean = false
): Promise<any> => {
  try {
    const fieldsToSubscribe = isInstagramAccount
      ? INSTAGRAM_SUBSCRIBED_FIELDS
      : DEFAULT_SUBSCRIBED_FIELDS;

    console.log(
      `[SUBSCRIBE] 🔔 Subscrição em ${
        isInstagramAccount ? "Instagram Business Account" : "Facebook Page"
      }: ${id}`
    );
    console.log(`[SUBSCRIBE] 📋 Campos:`, fieldsToSubscribe);

    const { data } = await axios.post(
      `https://graph.facebook.com/v20.0/${id}/subscribed_apps?access_token=${token}`,
      {
        subscribed_fields: fieldsToSubscribe
      }
    );

    console.log(`[SUBSCRIBE] ✅ Subscrição realizada com sucesso:`, data);
    return data;
  } catch (error: any) {
    const errorData = error?.response?.data || {};
    console.error(`[SUBSCRIBE] ❌ Erro ao subscrever:`, errorData);

    if (isInstagramAccount) {
      console.log(
        `[SUBSCRIBE] ⚠️ Subscrição no Instagram Business Account falhou`
      );
      console.log(
        `[SUBSCRIBE] ⚠️ Comentários do Instagram geralmente chegam via página do Facebook vinculada (campo "feed")`
      );
      console.log(
        `[SUBSCRIBE] ⚠️ Mas também podem chegar diretamente via Instagram Business Account (campo "comments")`
      );
      return null;
    }

    throw new Error("ERR_SUBSCRIBING_PAGE_TO_MESSAGE_WEBHOOKS");
  }
};

export const unsubscribeApp = async (
  id: string,
  token: string
): Promise<any> => {
  try {
    const { data } = await axios.delete(
      `https://graph.facebook.com/v20.0/${id}/subscribed_apps?access_token=${token}`
    );
    return data;
  } catch (error) {
    throw new Error("ERR_UNSUBSCRIBING_PAGE_TO_MESSAGE_WEBHOOKS");
  }
};

export const getSubscribedApps = async (
  id: string,
  token: string
): Promise<any> => {
  try {
    const { data } = await apiBase(token).get(`${id}/subscribed_apps`);
    return data;
  } catch (error) {
    throw new Error("ERR_GETTING_SUBSCRIBED_APPS");
  }
};

export const getAccessTokenFromPage = async (
  pageId: string,
  userToken: string
): Promise<string> => {
  try {
    if (!pageId || !userToken) {
      throw new Error("ERR_FETCHING_FB_PAGE_TOKEN");
    }

    const { data } = await apiBase(userToken).get(
      "me/accounts?fields=id,name,access_token,instagram_business_account{id,username,profile_picture_url,name}"
    );

    const page = data?.data?.find(
      (item: any) => String(item.id) === String(pageId)
    );

    if (!page?.access_token) {
      throw new Error("ERR_FETCHING_FB_PAGE_TOKEN");
    }

    return page.access_token;
  } catch (error) {
    console.log(error);
    throw new Error("ERR_FETCHING_FB_PAGE_TOKEN");
  }
};

export const removeApplcation = async (
  id: string,
  token: string
): Promise<void> => {
  try {
    await axios.delete(`https://graph.facebook.com/v20.0/${id}/permissions`, {
      params: { access_token: token }
    });
  } catch (error) {
    logger.error("ERR_REMOVING_APP_FROM_PAGE");
  }
};