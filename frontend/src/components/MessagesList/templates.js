import { Divider } from "@material-ui/core";
import { FileCopyOutlined, Language, Phone } from "@material-ui/icons";
import { makeStyles } from "@material-ui/core/styles";
import React from "react";
import MarkdownWrapper from "../MarkdownWrapper";

const useStyles = makeStyles((theme) => ({
  buttonTemplate: {
    backgroundColor: "transparent",
    border: "none",
    color: "#0CADE3",
    cursor: "pointer",
    padding: "8px 0",
    fontSize: "14px",
    fontWeight: 500,
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    borderRadius: 6,
    "&:hover": {
      backgroundColor: "rgba(12, 173, 227, 0.08)",
    },
  },
  media: {
    maxWidth: "100%",
    height: "auto",
    borderRadius: 8,
    marginBottom: 8
  }
}));

const Template = ({ message }) => {
  const classes = useStyles();

  const parseJsonSafe = (value) => {
    if (!value) return null;
    if (typeof value === "object") return value;

    try {
      return JSON.parse(value);
    } catch (error) {
      return null;
    }
  };

  const parseJsonDeep = (value, maxDepth = 3) => {
    let current = value;
    let depth = 0;

    while (typeof current === "string" && depth < maxDepth) {
      const parsed = parseJsonSafe(current);
      if (parsed === null) break;
      current = parsed;
      depth += 1;
    }

    return current;
  };

  const parseDataJson = () => {
    try {
      if (!message?.dataJson) return {};
      // CORREÇÃO: Se for string, tenta parsear, se não for, usa direto
      if (typeof message.dataJson === "string") {
        return JSON.parse(message.dataJson) || {};
      }
      return message.dataJson || {};
    } catch (error) {
      console.error("Erro ao parsear dataJson:", error);
      return {};
    }
  };

  const splitBodyAndButtons = (value) => {
    const raw = String(value || "");
    const separatorIndex = raw.lastIndexOf("||||");

    if (separatorIndex === -1) {
      return {
        body: raw,
        buttonsPart: null
      };
    }

    return {
      body: raw.substring(0, separatorIndex),
      buttonsPart: raw.substring(separatorIndex + 4)
    };
  };

  const flattenButtons = (input) => {
    const result = [];

    const walk = (value) => {
      const parsedValue = parseJsonDeep(value);

      if (parsedValue == null) return;

      if (Array.isArray(parsedValue)) {
        parsedValue.forEach(walk);
        return;
      }

      if (typeof parsedValue === "object") {
        result.push(parsedValue);
      }
    };

    walk(input);

    return result;
  };

  const extractButtonsFromTemplateComponents = (template) => {
    if (!template || typeof template !== "object") return [];
    
    const components = Array.isArray(template?.components) ? template.components : [];

    const buttons = [];

    components.forEach((component) => {
      const componentType = String(component?.type || "").toUpperCase();
      
      // Verifica se é componente de botão (formato da API)
      if (componentType === "BUTTON" && component.sub_type) {
        const firstParam = Array.isArray(component?.parameters) ? component.parameters[0] || {} : {};
        
        buttons.push({
          type: String(component.sub_type).toUpperCase(),
          text: firstParam?.text || component.text || `Botão ${buttons.length + 1}`,
          url: firstParam?.url || component.url || null,
          phone_number: firstParam?.phone_number || component.phone_number || null,
          payload: firstParam?.payload || component.payload || null,
          example: firstParam?.example || component.example || []
        });
      }
      
      // Verifica se tem BUTTONS array (outro formato)
      if (componentType === "BUTTONS" && Array.isArray(component.buttons)) {
        component.buttons.forEach((button, idx) => {
          const firstParam = Array.isArray(button?.parameters) ? button.parameters[0] || {} : {};
          
          buttons.push({
            type: String(button.sub_type || button.type || "QUICK_REPLY").toUpperCase(),
            text: firstParam?.text || button.text || `Botão ${buttons.length + 1}`,
            url: firstParam?.url || button.url || null,
            phone_number: firstParam?.phone_number || button.phone_number || null,
            payload: firstParam?.payload || button.payload || null,
            example: firstParam?.example || button.example || []
          });
        });
      }
    });

    return buttons;
  };

  const normalizeButtons = (rawButtons, template) => {
    let buttons = [];
    
    // PRIORIDADE 1: templateButtons do dataJson (já salvos)
    if (rawButtons && Array.isArray(rawButtons) && rawButtons.length > 0) {
      buttons = rawButtons;
    }
    
    // PRIORIDADE 2: Extrair do template components
    if (buttons.length === 0 && template) {
      buttons = extractButtonsFromTemplateComponents(template);
    }
    
    // PRIORIDADE 3: Tentar flatten se for string
    if (buttons.length === 0 && rawButtons && typeof rawButtons === "string") {
      buttons = flattenButtons(rawButtons);
    }

    // Normaliza cada botão
    return buttons.map((button, index) => {
      const rawType = String(
        button?.type ||
        (button?.url ? "URL" : button?.phone_number ? "PHONE_NUMBER" : button?.example ? "COPY_CODE" : "QUICK_REPLY")
      ).toUpperCase();

      let normalizedType = rawType;

      if (rawType === "QUICK_REPLY" || rawType === "QUICK_REPLY_BUTTON") {
        normalizedType = "QUICK_REPLY";
      } else if (rawType === "URL" || rawType === "MPM" || rawType === "CTA_URL") {
        normalizedType = "URL";
      } else if (rawType === "PHONE_NUMBER" || rawType === "CTA_CALL") {
        normalizedType = "PHONE_NUMBER";
      } else if (rawType === "COPY_CODE" || rawType === "COUPON_CODE") {
        normalizedType = "COPY_CODE";
      }

      return {
        type: normalizedType,
        text: button?.text || button?.label || button?.display_text || button?.title || button?.payload || `Botão ${index + 1}`,
        url: button?.url || button?.link || null,
        payload: button?.payload || null,
        phone_number: button?.phone_number || button?.phoneNumber || null,
        example: Array.isArray(button?.example) ? button.example : (button?.example ? [button.example] : [])
      };
    });
  };

  const removeMediaUrlFromText = (content, url) => {
    if (!content || !url) return String(content || "").trim();

    const escapedUrl = String(url).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return String(content).replace(new RegExp(escapedUrl, "g"), "").trim();
  };

  // CORREÇÃO PRINCIPAL: Parse do dataJson garantindo que pega os botões
  const dataJson = parseDataJson();
  
  console.log("[DEBUG] Template - dataJson completo:", dataJson);
  console.log("[DEBUG] Template - templateButtons:", dataJson?.templateButtons);
  console.log("[DEBUG] Template - template:", dataJson?.template);

  const rawBody = String(message?.body || "");
  const bodySource = typeof dataJson?.body === "string" && dataJson.body
    ? dataJson.body
    : rawBody;

  const { body: cleanBodyFromSource, buttonsPart } = splitBodyAndButtons(bodySource);

  const mediaUrl = dataJson?.mediaUrl || message?.mediaUrl || null;

  const textWithoutMediaUrl = removeMediaUrlFromText(cleanBodyFromSource, mediaUrl);

  // CORREÇÃO: Passa templateButtons do dataJson e o template para extração
  const buttons = normalizeButtons(
    dataJson?.templateButtons,  // Prioridade máxima!
    dataJson?.template           // Fallback
  );

  console.log("[DEBUG] Template - botões extraídos:", buttons);

  const isImage = (url) => /\.(jpeg|jpg|gif|png|webp)$/i.test(url);
  const isVideo = (url) => /\.(mp4|webm|ogg)$/i.test(url);

  const copyToClipboard = async (text) => {
    const safeText = String(text || "").trim();
    if (!safeText) return;

    try {
      await navigator.clipboard.writeText(safeText);
    } catch (error) {}
  };

  const handleCopyCode = async (button) => {
    const code = Array.isArray(button?.example) && button.example[0]
      ? button.example[0]
      : button?.payload || button?.text || "";

    await copyToClipboard(code);
  };

  const handleQuickReply = async (button) => {
    await copyToClipboard(button?.payload || button?.text || "");
  };

  const renderButtonIcon = (buttonType) => {
    if (buttonType === "URL") return <Language fontSize="small" />;
    if (buttonType === "PHONE_NUMBER") return <Phone fontSize="small" />;
    return <FileCopyOutlined fontSize="small" />;
  };

  const ButtonRenderer = ({ buttons: normalizedButtons }) => {
    if (!normalizedButtons || normalizedButtons.length === 0) {
      return null;
    }

    return (
      <div
        style={{
          marginTop: "10px",
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          gap: "2px"
        }}
      >
        {normalizedButtons.map((button, index) => {
          if (button.type === "URL" && button.url) {
            return (
              <button
                key={index}
                onClick={() => window.open(button.url, "_blank")}
                className={classes.buttonTemplate}
              >
                {renderButtonIcon(button.type)}
                {button.text}
              </button>
            );
          }

          if (button.type === "PHONE_NUMBER" && button.phone_number) {
            return (
              <button
                key={index}
                onClick={() =>
                  window.open(
                    `https://wa.me/${String(button.phone_number).replace(/\D/g, "")}`,
                    "_blank"
                  )
                }
                className={classes.buttonTemplate}
              >
                {renderButtonIcon(button.type)}
                {button.text}
              </button>
            );
          }

          if (button.type === "COPY_CODE") {
            return (
              <button
                key={index}
                onClick={() => handleCopyCode(button)}
                className={classes.buttonTemplate}
              >
                {renderButtonIcon(button.type)}
                {button.text}
              </button>
            );
          }

          // QUICK_REPLY ou qualquer outro tipo
          return (
            <button
              key={index}
              onClick={() => handleQuickReply(button)}
              className={classes.buttonTemplate}
            >
              {renderButtonIcon(button.type)}
              {button.text}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <>
      {mediaUrl && (
        <>
          {isImage(mediaUrl) ? (
            <img src={mediaUrl} alt="media content" className={classes.media} />
          ) : isVideo(mediaUrl) ? (
            <video src={mediaUrl} controls className={classes.media} />
          ) : null}
        </>
      )}

      <div>
        {textWithoutMediaUrl && (
          <MarkdownWrapper>{textWithoutMediaUrl}</MarkdownWrapper>
        )}

        {buttons.length > 0 && (
          <>
            <Divider />
            <ButtonRenderer buttons={buttons} />
          </>
        )}
      </div>
    </>
  );
};

export default Template;