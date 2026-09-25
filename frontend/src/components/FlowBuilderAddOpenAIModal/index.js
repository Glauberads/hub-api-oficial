// frontend/openaiModal.jsx
import React, { useState, useEffect, useRef } from "react";
import * as Yup from "yup";
import { Formik, Form, Field, FieldArray } from "formik";
import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import {
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  FormControlLabel,
  RadioGroup,
  Radio,
  FormLabel,
  Checkbox,
  Chip,
  Box,
  Typography,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Tooltip
} from "@material-ui/core";
import {
  Visibility,
  VisibilityOff,
  ExpandMore,
  Add,
  Delete,
  Info,
  Settings,
  Timer,
  Chat
} from "@material-ui/icons";
import { InputAdornment } from "@material-ui/core";
import { i18n } from "../../translate/i18n";

// Lista de modelos OpenAI suportados
const openAiModels = [
  "gpt-3.5-turbo",
  "gpt-3.5-turbo-1106",
  "gpt-3.5-turbo-16k",
  "gpt-4",
  "gpt-4-turbo",
  "gpt-4o",
  "gpt-4o-mini"
];

// Lista de vozes disponíveis para OpenAI
const availableVoices = [
  "texto",
  "pt-BR-FabioNeural",
  "pt-BR-FranciscaNeural",
  "pt-BR-AntonioNeural",
  "pt-BR-BrendaNeural",
  "pt-BR-DonatoNeural",
  "pt-BR-ElzaNeural",
  "pt-BR-GiovannaNeural",
  "pt-BR-HumbertoNeural",
  "pt-BR-JulioNeural",
  "pt-BR-LeilaNeural",
  "pt-BR-LeticiaNeural",
  "pt-BR-ManuelaNeural",
  "pt-BR-NicolauNeural",
  "pt-BR-ValerioNeural",
  "pt-BR-YaraNeural"
];

const openAiTtsVoices = [
  { value: "alloy", label: "Alloy - Neutra" },
  { value: "ash", label: "Ash - Grave" },
  { value: "ballad", label: "Ballad - Suave" },
  { value: "coral", label: "Coral - Natural" },
  { value: "echo", label: "Echo - Clara" },
  { value: "fable", label: "Fable - Narrativa" },
  { value: "onyx", label: "Onyx - Forte" },
  { value: "nova", label: "Nova - Jovem" },
  { value: "sage", label: "Sage - Calma" },
  { value: "shimmer", label: "Shimmer - Leve" },
  { value: "verse", label: "Verse - Expressiva" }
];

const openAiTtsVoiceValues = openAiTtsVoices.map((voice) => voice.value);

const openAiTtsModels = [
  "gpt-4o-mini-tts",
  "tts-1",
  "tts-1-hd"
];

const openAiPromptTemplates = [
  {
    id: "atendimento_comercial",
    label: "Atendimento comercial",
    description: "Responder clientes com foco em venda, persuasão, clareza e fechamento.",
    prompt: `Você é um Especialista de Vendas e Atendimento Comercial de alta performance.
Sua missão é conduzir o cliente desde o interesse inicial até o fechamento da venda, garantindo uma experiência excepcional.

DIRETRIZES DE COMPORTAMENTO E TOM:
1. Tom de Voz: Profissional, acolhedor, humano, persuasivo e empático. Aja de forma natural e evite parecer um robô.
2. Formato: Respostas curtas, diretas e divididas em parágrafos pequenos (ideal para leitura em aplicativos de mensagens como WhatsApp). 
3. Uso de Emojis: Use com moderação, apenas para dar um tom amigável (máximo de 1 a 2 por mensagem).

REGRAS ESTRITAS (NÃO QUEBRE):
- NUNCA invente preços, planos, prazos, condições de pagamento ou promoções. Baseie-se APENAS nas informações fornecidas no seu contexto.
- Se o cliente perguntar algo que você não sabe ou não está no seu contexto, diga educadamente que irá confirmar essa informação com a equipe técnica/comercial.
- Não envie blocos de texto gigantes. Seja conciso.

ESTRUTURA DA CONVERSA:
- Saudação: Seja receptivo e tente chamar o cliente pelo nome.
- Descoberta: Faça perguntas curtas e abertas para entender a dor/necessidade real do cliente (O que ele busca resolver?).
- Apresentação de Valor: Fale dos benefícios antes das características. Explique como o produto/serviço resolve o problema específico dele.
- Tratamento de Objeções: Se o cliente achar caro, foque no retorno sobre o investimento e no valor agregado. Demonstre empatia.
- Fechamento: SEMPRE termine a mensagem com uma pergunta amigável ou um "Call to Action" leve para manter a conversa fluindo (Ex: "Ficou alguma dúvida sobre os planos?", "Qual dessas opções faz mais sentido para o seu momento atual?", "Podemos seguir com a simulação?").`
  },
  {
    id: "suporte_tecnico",
    label: "Suporte técnico",
    description: "Triagem detalhada, diagnóstico guiado e orientação técnica inicial.",
    prompt: `Você é um Analista de Suporte Técnico Sênior.
Sua missão é acolher o cliente que está enfrentando problemas, identificar a causa raiz por meio de triagem e oferecer soluções iniciais ou preparar um relatório claro para o suporte humano.

DIRETRIZES DE COMPORTAMENTO E TOM:
1. Tom de Voz: Paciente, claro, didático, técnico (mas acessível) e tranquilizador. O cliente pode estar frustrado, demonstre empatia.
2. Formato: Use listas estruturadas (bullet points) para instruções de passo a passo. Respostas curtas e escaneáveis.

REGRAS ESTRITAS (NÃO QUEBRE):
- NUNCA afirme que executou uma ação no sistema (ex: "já resetei sua senha") se você não tem essa integração. Diga "Vou orientar como resetar" ou "Posso abrir um chamado para isso".
- Nunca invente soluções ou prometa prazos de correção irreais.
- Faça APENAS UMA pergunta de diagnóstico por vez. Não sobrecarregue o cliente com múltiplas questões na mesma mensagem.

ESTRUTURA DA CONVERSA:
- Acolhimento: Valide a frustração do cliente (Ex: "Entendo como isso pode ser chato, vou te ajudar a resolver isso agora.").
- Coleta de Dados: Peça informações básicas necessárias (Ex: email da conta, versão do sistema, mensagem de erro exata).
- Diagnóstico Guiado: Oriente passos de resolução simples de forma numerada (Ex: 1. Faça X, 2. Faça Y).
- Escalada: Se o problema não for resolvido com passos básicos ou fugir do seu conhecimento, informe claramente que os dados já foram coletados e o caso será transferido para um especialista humano.`
  },
  {
    id: "qualificacao_lead",
    label: "Qualificação de lead",
    description: "Descobrir interesse, necessidade, orçamento e urgência do lead de forma fluida.",
    prompt: `Você é um Especialista em Qualificação de Leads (SDR - Sales Development Representative).
Sua missão é conversar com novos contatos para descobrir o nível de interesse, a real necessidade e a urgência, preparando o terreno para a equipe de fechamento.

DIRETRIZES DE COMPORTAMENTO E TOM:
1. Tom de Voz: Curioso, consultivo, amigável e profissional. Você não é um questionário robótico; você é um consultor interessado no sucesso do cliente.
2. Formato: Mensagens muito curtas e diretas. Conversa em formato de ping-pong.

REGRAS ESTRITAS (NÃO QUEBRE):
- Faça UMA pergunta de cada vez. Nunca envie duas perguntas na mesma mensagem.
- Não empurre a venda ainda. Seu objetivo é apenas extrair informações e gerar valor inicial.
- Adapte-se às respostas do cliente. Se ele já deu uma informação, não pergunte de novo.

FRAMEWORK DE QUALIFICAÇÃO (Foque em descobrir de forma natural):
- Necessidade (Need): Qual é o desafio ou problema que ele está tentando resolver hoje?
- Prazo (Timeline): Qual a urgência? Para quando ele precisa dessa solução?
- Orçamento (Budget) - Opcional e sutil: Ele já investe em algo parecido? 
- Perfil: É o decisor ou está apenas pesquisando?

FLUXO DA CONVERSA:
Agradeça o contato -> Faça uma pergunta leve sobre o contexto do cliente -> Investigue a dor principal -> Valide se nossa solução atende -> Direcione para o próximo passo (ex: agendar uma reunião, passar para um consultor).`
  },
  {
    id: "agendamento",
    label: "Agendamento",
    description: "Conduzir conversas rápidas e sem atrito para marcação de horários.",
    prompt: `Você é um Assistente Executivo de Agendamento.
Sua missão é ajudar o cliente a marcar, reagendar ou cancelar compromissos da forma mais rápida e com o menor esforço possível.

DIRETRIZES DE COMPORTAMENTO E TOM:
1. Tom de Voz: Direto, solícito, extremamente organizado e cortês.
2. Formato: Informações estruturadas. Use listas para mostrar opções de horários.

REGRAS ESTRITAS (NÃO QUEBRE):
- Confirme SEMPRE as informações antes de dar o agendamento como finalizado (Nome, Serviço, Data e Horário).
- Se o cliente sugerir um horário fora do padrão fornecido no contexto, informe as limitações e sugira os horários mais próximos disponíveis.
- Seja sensível a fusos horários (se aplicável, confirme qual é a região do cliente).
- Não faça promessas de atendimento que a agenda não possa cumprir.

ESTRUTURA DA CONVERSA:
- Identifique rapidamente qual é o serviço desejado.
- Ofereça 2 a 3 opções de datas/horários para facilitar a escolha, em vez de perguntar abertamente "quando você quer?".
- Confirme os detalhes de forma clara (Ex: "Perfeito, João! Ficou agendado para o dia 10/05 às 14h. Posso confirmar?").
- Finalize com instruções úteis (ex: o que levar, antecedência para chegar, link da reunião).`
  },
  {
    id: "cobranca_educada",
    label: "Cobrança educada",
    description: "Lembrete de pagamento e negociação focados em preservar a relação com o cliente.",
    prompt: `Você é um Analista de Sucesso do Cliente focado no setor financeiro.
Sua missão é realizar lembretes de vencimento e cobranças de forma extremamente educada, preservando a relação comercial e oferecendo facilidades para o pagamento.

DIRETRIZES DE COMPORTAMENTO E TOM:
1. Tom de Voz: Respeitoso, compreensivo, prestativo e neutro. NUNCA utilize tom acusatório, agressivo ou ameaçador.
2. Formato: Direto ao ponto, mas envolto em muita cordialidade.

REGRAS ESTRITAS (NÃO QUEBRE):
- Trate o atraso inicial como um "possível esquecimento" ou "falha de sistema".
- Se o cliente informar que já pagou, não discuta. Agradeça, peça educadamente o comprovante para acelerar a baixa no sistema e informe que o setor responsável irá verificar.
- Se o cliente relatar dificuldades financeiras, demonstre empatia e pergunte se gostaria de avaliar opções de parcelamento ou novas datas (conforme contexto).

ESTRUTURA DA CONVERSA:
- Abordagem: Saudações cordiais.
- O Motivo: Informe de forma clara sobre a fatura/boleto pendente, citando valor e data de vencimento.
- A Oferta de Ajuda: Pergunte se houve algum problema com o recebimento do boleto ou se precisa de uma segunda via.
- Fechamento: Deixe a chave PIX, link ou código de barras de fácil acesso, para que o cliente pague na hora sem atrito.`
  },
  {
    id: "secretaria_virtual",
    label: "Secretária virtual",
    description: "Recepção amigável, roteamento inteligente e triagem eficiente de contatos iniciais.",
    prompt: `Você é a Secretária Virtual e Concierge principal da empresa.
Sua missão é ser a primeira impressão do cliente, oferecendo uma recepção calorosa, entendendo o motivo do contato e roteando o usuário rapidamente para o departamento ou fluxo correto.

DIRETRIZES DE COMPORTAMENTO E TOM:
1. Tom de Voz: Simpático, ágil, prestativo e altamente profissional.
2. Formato: Mensagens curtas, de boas-vindas. Evite textos densos.

REGRAS ESTRITAS (NÃO QUEBRE):
- Seu foco é TRIAGEM. Não tente resolver problemas complexos técnicos ou vender diretamente.
- Não invente informações sobre os departamentos da empresa.
- Ao identificar o problema, explique brevemente para onde você está direcionando o cliente para gerar previsibilidade.

ESTRUTURA DA CONVERSA:
- Saudação inicial calorosa e identificação da empresa.
- Pergunta chave de descoberta (Ex: "Como posso facilitar o seu dia hoje?", "Com qual assunto posso te ajudar agora?").
- Compreensão do pedido: Resuma em uma linha o que ele pediu para confirmar o entendimento.
- Ação: Confirme o direcionamento (Ex: "Entendido! Vou te transferir agora mesmo para nossa equipe de Suporte Financeiro. É rapidinho.").`
  },
  {
    id: "pos_venda",
    label: "Pós-venda e Fidelização",
    description: "Acompanhamento após compra, coleta de feedback e fortalecimento de relacionamento.",
    prompt: `Você é um Especialista em Sucesso do Cliente (Customer Success) e Pós-Venda.
Sua missão é entrar em contato com o cliente após uma compra ou serviço realizado para garantir a máxima satisfação, coletar feedback (positivo ou negativo) e abrir portas para futuras interações (fidelização).

DIRETRIZES DE COMPORTAMENTO E TOM:
1. Tom de Voz: Entusiástico, proativo, extremamente cuidadoso e aberto a ouvir.
2. Formato: Uma mensagem leve e convidativa.

REGRAS ESTRITAS (NÃO QUEBRE):
- Se o feedback for negativo, NUNCA dê desculpas ou jogue a culpa em terceiros. Peça desculpas em nome da empresa, demonstre urgência e ofereça direcionamento para a resolução do problema.
- Não empurre agressivamente uma nova venda. O foco primário é o relacionamento e a satisfação da compra atual.
- Agradeça sinceramente pelo tempo do cliente ao responder.

ESTRUTURA DA CONVERSA:
- Quebra de Gelo: Agradeça pela compra/confiança recente.
- Check-in de Valor: Pergunte abertamente sobre a experiência (Ex: "Conseguiu usar o produto X?", "Como foi o atendimento ontem?").
- Coleta de Feedback: Incentive uma nota ou comentário breve.
- Próximos Passos: Se estiver tudo bem, coloque-se à disposição ou deixe um gancho amigável para o futuro. Se houver problemas, guie para a resolução imediata.`
  }
];

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexWrap: "wrap",
  },
  multFieldLine: {
    display: "flex",
    "& > *:not(:last-child)": {
      marginRight: theme.spacing(1),
    },
  },
  btnWrapper: {
    position: "relative",
  },
  buttonProgress: {
    color: green[500],
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -12,
    marginLeft: -12,
  },
  formControl: {
    margin: theme.spacing(1),
    minWidth: 120,
  },
  sectionTitle: {
    fontWeight: "bold",
    color: theme.palette.primary.main,
    marginBottom: theme.spacing(1),
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1)
  },
  flowModeCard: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.spacing(1),
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
    backgroundColor: theme.palette.background.default
  },
  temporarySettings: {
    marginTop: theme.spacing(2),
    padding: theme.spacing(2),
    backgroundColor: theme.palette.grey[50],
    borderRadius: theme.spacing(1),
    border: `1px dashed ${theme.palette.primary.light}`
  },
  keywordChip: {
    margin: theme.spacing(0.5),
  },
  helpText: {
    fontSize: "0.75rem",
    color: theme.palette.text.secondary,
    marginTop: theme.spacing(0.5)
  },
  accordion: {
    marginBottom: theme.spacing(1),
    "&:before": {
      display: "none",
    }
  },
  accordionSummary: {
    backgroundColor: theme.palette.grey[50],
    borderRadius: theme.spacing(0.5),
    minHeight: 48,
    "&.Mui-expanded": {
      minHeight: 48,
    }
  },
  accordionDetails: {
    padding: theme.spacing(2),
    flexDirection: "column"
  }
}));

// Esquema de validação para OpenAI
const OpenAiSchema = Yup.object().shape({
  name: Yup.string()
    .min(5, "Muito curto!")
    .max(100, "Muito longo!")
    .required("Obrigatório"),
  prompt: Yup.string()
    .min(50, "Muito curto!")
    .required("Descreva o treinamento para Inteligência Artificial"),
  model: Yup.string()
    .oneOf(openAiModels, "Modelo inválido")
    .required("Informe o modelo"),
  maxTokens: Yup.number()
    .min(10, "Mínimo 10 tokens")
    .max(4000, "Máximo 4000 tokens")
    .required("Informe o número máximo de tokens"),
  temperature: Yup.number()
    .min(0, "Mínimo 0")
    .max(2, "Máximo 2")
    .required("Informe a temperatura"),
  apiKey: Yup.string().required("Informe a API Key"),
  maxMessages: Yup.number()
    .min(1, "Mínimo 1 mensagem")
    .max(100, "Máximo 100 mensagens")
    .required("Informe o número máximo de mensagens"),
  voice: Yup.string().required("Informe o modo para Voz"),
  voiceKey: Yup.string().when("voice", {
    is: (voice) => voice !== "texto",
    then: Yup.string().required("Voice Key é obrigatória para síntese de voz"),
    otherwise: Yup.string().notRequired()
  }),
  voiceRegion: Yup.string().when("voice", {
    is: (voice) => voice !== "texto",
    then: Yup.string().required("Voice Region é obrigatória para síntese de voz"),
    otherwise: Yup.string().notRequired()
  }),
  flowMode: Yup.string()
    .oneOf(["permanent", "temporary"], "Modo de fluxo inválido")
    .required("Selecione o modo de fluxo"),
  maxInteractions: Yup.number().when("flowMode", {
    is: "temporary",
    then: Yup.number()
      .min(1, "Mínimo 1 interação")
      .max(50, "Máximo 50 interações")
      .nullable(),
    otherwise: Yup.number().nullable()
  }),
  completionTimeout: Yup.number().when("flowMode", {
    is: "temporary",
    then: Yup.number()
      .min(1, "Mínimo 1 minuto")
      .max(60, "Máximo 60 minutos")
      .nullable(),
    otherwise: Yup.number().nullable()
  }),
  continueKeywords: Yup.array().when("flowMode", {
    is: "temporary",
    then: Yup.array()
      .of(Yup.string().required("Palavra-chave não pode estar vazia"))
      .min(1, "Pelo menos uma palavra-chave é obrigatória no modo temporário"),
    otherwise: Yup.array()
  }),
  objective: Yup.string().when(["flowMode", "autoCompleteOnObjective"], {
    is: (flowMode, autoComplete) => flowMode === "temporary" && autoComplete,
    then: Yup.string().required("Objetivo é obrigatório quando auto completar está ativo"),
    otherwise: Yup.string()
  }),
  aiAudioReplyModel: Yup.string().oneOf(openAiTtsModels, "Modelo de áudio inválido"),
  aiAudioReplyVoice: Yup.string().oneOf(openAiTtsVoiceValues, "Voz OpenAI inválida"),
  aiAudioReplySpeed: Yup.number()
    .min(0.25, "Mínimo 0.25")
    .max(4, "Máximo 4"),
  aiAudioReplyMaxChars: Yup.number()
    .min(100, "Mínimo 100 caracteres")
    .max(4000, "Máximo 4000 caracteres")
});

const FlowBuilderOpenAIModal = ({ open, onSave, data, onUpdate, close }) => {
  const classes = useStyles();
  const isMounted = useRef(true);

  const initialState = {
    name: "",
    prompt: "",
    promptTemplateId: "",
    model: "gpt-4o",
    voice: "texto",
    voiceKey: "",
    voiceRegion: "",
    maxTokens: 1000,
    temperature: 0.7,
    apiKey: "",
    maxMessages: 10,
    queueId: 0,

    // Campos para controle de fluxo
    flowMode: "permanent",
    maxInteractions: 5,
    completionTimeout: 10,
    continueKeywords: ["continuar", "próximo", "avançar"],
    objective: "",
    autoCompleteOnObjective: false,

    // Resposta automática em áudio quando cliente enviar áudio
    aiAudioReplyEnabled: false,
    aiAudioReplyOnlyWhenInputAudio: true,
    aiAudioReplyModel: "gpt-4o-mini-tts",
    aiAudioReplyVoice: "coral",
    aiAudioReplySpeed: 1,
    aiAudioReplyMaxChars: 700,
    aiAudioReplySendTextWithLinks: true,
    aiAudioReplyFallbackToText: true,
    aiAudioReplyInstructions: "Fale em português do Brasil, com tom natural, simpático, consultivo e objetivo."
  };

  const [showApiKey, setShowApiKey] = useState(false);
  const [integration, setIntegration] = useState(initialState);
  const [labels, setLabels] = useState({
    title: i18n.t("automation.ai.addOpenAI"),
    btn: "Adicionar",
  });
  const [newKeyword, setNewKeyword] = useState("");

  useEffect(() => {
    if (open === "edit") {
      setLabels({
        title: "Editar OpenAI do fluxo",
        btn: "Salvar",
      });
      const typebotIntegration = data?.data?.typebotIntegration || {};
      setIntegration({
        ...initialState,
        ...typebotIntegration,
        promptTemplateId: typebotIntegration.promptTemplateId || "",
        model: openAiModels.includes(typebotIntegration.model)
          ? typebotIntegration.model
          : "gpt-4o",
        flowMode: typebotIntegration.flowMode || "permanent",
        continueKeywords: typebotIntegration.continueKeywords || ["continuar", "próximo", "avançar"],
        maxInteractions: typebotIntegration.maxInteractions || 5,
        completionTimeout: typebotIntegration.completionTimeout || 10,
        objective: typebotIntegration.objective || "",
        autoCompleteOnObjective: typebotIntegration.autoCompleteOnObjective || false,
        aiAudioReplyEnabled: typebotIntegration.aiAudioReplyEnabled || false,
        aiAudioReplyOnlyWhenInputAudio: typebotIntegration.aiAudioReplyOnlyWhenInputAudio !== undefined ? typebotIntegration.aiAudioReplyOnlyWhenInputAudio : true,
        aiAudioReplyModel: typebotIntegration.aiAudioReplyModel || "gpt-4o-mini-tts",
        aiAudioReplyVoice: typebotIntegration.aiAudioReplyVoice || "coral",
        aiAudioReplySpeed: typebotIntegration.aiAudioReplySpeed || 1,
        aiAudioReplyMaxChars: typebotIntegration.aiAudioReplyMaxChars || 700,
        aiAudioReplySendTextWithLinks: typebotIntegration.aiAudioReplySendTextWithLinks !== undefined ? typebotIntegration.aiAudioReplySendTextWithLinks : true,
        aiAudioReplyFallbackToText: typebotIntegration.aiAudioReplyFallbackToText !== undefined ? typebotIntegration.aiAudioReplyFallbackToText : true,
        aiAudioReplyInstructions: typebotIntegration.aiAudioReplyInstructions || "Fale em português do Brasil, com tom natural, simpático, consultivo e objetivo."
      });
    } else if (open === "create") {
      setLabels({
        title: i18n.t("automation.ai.addOpenAI"),
        btn: "Adicionar",
      });
      setIntegration(initialState);
    }

    return () => {
      isMounted.current = false;
    };
  }, [open, data]);

  const handleClose = () => {
    setNewKeyword("");
    close(null);
  };

  const handleSavePrompt = (values, { setSubmitting }) => {
    const promptData = {
      ...values,
      // Garantir que campos do modo temporário sejam nulos se modo for permanente
      maxInteractions: values.flowMode === "temporary" ? values.maxInteractions : null,
      completionTimeout: values.flowMode === "temporary" ? values.completionTimeout : null,
      continueKeywords: values.flowMode === "temporary" ? values.continueKeywords : [],
      objective: values.flowMode === "temporary" ? values.objective : "",
      autoCompleteOnObjective: values.flowMode === "temporary" ? values.autoCompleteOnObjective : false,
      // Forçar provider como openai
      provider: "openai"
    };

    if (open === "edit") {
      onUpdate({
        ...data,
        data: { typebotIntegration: promptData },
      });
    } else if (open === "create") {
      promptData.projectName = promptData.name;
      onSave({
        typebotIntegration: promptData,
      });
    }
    handleClose();
    setSubmitting(false);
  };

  const addKeyword = (arrayHelpers, keyword, currentKeywords = []) => {
    const normalizedKeyword = keyword.trim();
    if (normalizedKeyword && !currentKeywords.includes(normalizedKeyword)) {
      arrayHelpers.push(normalizedKeyword);
      setNewKeyword("");
    }
  };

  const removeKeyword = (arrayHelpers, index) => {
    arrayHelpers.remove(index);
  };

  const handleApplyPromptTemplate = (templateId, setFieldValue) => {
    const selectedTemplate = openAiPromptTemplates.find(
      (item) => item.id === templateId
    );

    setFieldValue("promptTemplateId", templateId || "");

    if (selectedTemplate) {
      setFieldValue("prompt", selectedTemplate.prompt);
    }
  };

  const getSelectedTemplate = (templateId) => {
    return openAiPromptTemplates.find((item) => item.id === templateId);
  };

  const getModelDisplayName = (model) => {
    const modelNames = {
      "gpt-3.5-turbo": "GPT 3.5 Turbo",
      "gpt-3.5-turbo-1106": "GPT 3.5 Turbo (1106)",
      "gpt-3.5-turbo-16k": "GPT 3.5 Turbo 16K",
      "gpt-4": "GPT 4",
      "gpt-4-turbo": "GPT 4 Turbo",
      "gpt-4o": "GPT 4o",
      "gpt-4o-mini": "GPT 4o Mini"
    };
    return modelNames[model] || model;
  };

  const getVoiceDisplayName = (voice) => {
    if (voice === "texto") return "Apenas Texto";
    return voice.replace("pt-BR-", "").replace("Neural", "");
  };

  return (
    <div className={classes.root}>
      <Dialog
        open={open === "create" || open === "edit"}
        onClose={handleClose}
        fullWidth
        maxWidth="lg"
        scroll="paper"
      >
        <DialogTitle id="form-dialog-title">
          {labels.title}
        </DialogTitle>
        <Formik
          initialValues={integration}
          enableReinitialize={true}
          validationSchema={OpenAiSchema}
          onSubmit={handleSavePrompt}
        >
          {({ touched, errors, isSubmitting, values, setFieldValue }) => (
            <Form style={{ width: "100%" }}>
              <DialogContent dividers>

                {/* CONFIGURAÇÕES BÁSICAS */}
                <Accordion className={classes.accordion} defaultExpanded>
                  <AccordionSummary
                    expandIcon={<ExpandMore />}
                    className={classes.accordionSummary}
                  >
                    <Typography className={classes.sectionTitle}>
                      <Settings />
                      {i18n.t("automation.ai.basicOpenAI")}
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails className={classes.accordionDetails}>

                    <Field
                      as={TextField}
                      label={i18n.t("automation.ai.assistantName")}
                      name="name"
                      error={touched.name && Boolean(errors.name)}
                      helperText={touched.name && errors.name}
                      variant="outlined"
                      margin="dense"
                      fullWidth
                      required
                    />

                    <FormControl fullWidth margin="dense" variant="outlined">
                      <Field
                        as={TextField}
                        label={i18n.t("automation.ai.openAiKey")}
                        name="apiKey"
                        type={showApiKey ? "text" : "password"}
                        error={touched.apiKey && Boolean(errors.apiKey)}
                        helperText={touched.apiKey && errors.apiKey}
                        variant="outlined"
                        margin="dense"
                        fullWidth
                        required
                        InputProps={{
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton onClick={() => setShowApiKey(!showApiKey)}>
                                {showApiKey ? <VisibilityOff /> : <Visibility />}
                              </IconButton>
                            </InputAdornment>
                          ),
                        }}
                      />
                    </FormControl>

                    <FormControl
                      fullWidth
                      margin="dense"
                      variant="outlined"
                      error={touched.model && Boolean(errors.model)}
                    >
                      <InputLabel>{i18n.t("automation.ai.openAiModel")}</InputLabel>
                      <Field
                        as={Select}
                        label={i18n.t("automation.ai.openAiModel")}
                        name="model"
                      >
                        {openAiModels.map((model) => (
                          <MenuItem key={model} value={model}>
                            {getModelDisplayName(model)}
                          </MenuItem>
                        ))}
                      </Field>
                      {touched.model && errors.model && (
                        <div style={{ color: "red", fontSize: "12px" }}>
                          {errors.model}
                        </div>
                      )}
                    </FormControl>

                    <FormControl fullWidth margin="dense" variant="outlined">
                      <InputLabel>{i18n.t("automation.ai.promptTemplate")}</InputLabel>
                      <Select
                        value={values.promptTemplateId || ""}
                        onChange={(e) => handleApplyPromptTemplate(e.target.value, setFieldValue)}
                        label={i18n.t("automation.ai.promptTemplate")}
                      >
                        <MenuItem value="">
                          <em>{i18n.t("automation.common.none")}</em>
                        </MenuItem>

                        {openAiPromptTemplates.map((template) => (
                          <MenuItem key={template.id} value={template.id}>
                            {template.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    {values.promptTemplateId && (
                      <Box mt={1} mb={1}>
                        <Typography variant="caption" color="textSecondary">
                          {getSelectedTemplate(values.promptTemplateId)?.description || ""}
                        </Typography>
                        <Box mt={1}>
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() =>
                              handleApplyPromptTemplate(values.promptTemplateId, setFieldValue)
                            }
                          >
                            Restaurar modelo
                          </Button>
                        </Box>
                      </Box>
                    )}

                    <Field
                      as={TextField}
                      label={i18n.t("automation.ai.systemPrompt")}
                      name="prompt"
                      error={touched.prompt && Boolean(errors.prompt)}
                      helperText={touched.prompt && errors.prompt}
                      variant="outlined"
                      margin="dense"
                      fullWidth
                      required
                      rows={6}
                      multiline
                      placeholder="Descreva como a IA deve se comportar, que informações deve coletar, como deve responder..."
                    />

                    <div className={classes.multFieldLine}>
                      <Field
                        as={TextField}
                        label={i18n.t("promptModal.form.temperature")}
                        name="temperature"
                        error={touched.temperature && Boolean(errors.temperature)}
                        helperText={touched.temperature && errors.temperature || "0 = conservador, 2 = criativo"}
                        variant="outlined"
                        margin="dense"
                        fullWidth
                        type="number"
                        inputProps={{
                          step: "0.1",
                          min: "0",
                          max: "2",
                        }}
                      />
                      <Field
                        as={TextField}
                        label={i18n.t("automation.ai.maxTokens")}
                        name="maxTokens"
                        error={touched.maxTokens && Boolean(errors.maxTokens)}
                        helperText={touched.maxTokens && errors.maxTokens || i18n.t("automation.ai.maxTokensHelp")}
                        variant="outlined"
                        margin="dense"
                        fullWidth
                        type="number"
                      />
                      <Field
                        as={TextField}
                        label={i18n.t("automation.ai.maxMessages")}
                        name="maxMessages"
                        error={touched.maxMessages && Boolean(errors.maxMessages)}
                        helperText={touched.maxMessages && errors.maxMessages || i18n.t("automation.ai.contextHistory")}
                        variant="outlined"
                        margin="dense"
                        fullWidth
                        type="number"
                      />
                    </div>

                  </AccordionDetails>
                </Accordion>

                {/* CONFIGURAÇÕES DE VOZ */}
                <Accordion className={classes.accordion}>
                  <AccordionSummary
                    expandIcon={<ExpandMore />}
                    className={classes.accordionSummary}
                  >
                    <Typography className={classes.sectionTitle}>
                      <Chat />
                      {i18n.t("automation.ai.voiceSettings")}
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails className={classes.accordionDetails}>

                    <FormControl
                      fullWidth
                      margin="dense"
                      variant="outlined"
                      error={touched.voice && Boolean(errors.voice)}
                    >
                      <InputLabel>Tipo de Resposta</InputLabel>
                      <Field
                        as={Select}
                        label="Tipo de Resposta"
                        name="voice"
                      >
                        {availableVoices.map((voice) => (
                          <MenuItem key={voice} value={voice}>
                            {getVoiceDisplayName(voice)}
                          </MenuItem>
                        ))}
                      </Field>
                      {touched.voice && errors.voice && (
                        <div style={{ color: "red", fontSize: "12px" }}>
                          {errors.voice}
                        </div>
                      )}
                    </FormControl>

                    {values.voice !== "texto" && (
                      <div className={classes.multFieldLine}>
                        <Field
                          as={TextField}
                          label="Voice Key (Azure)"
                          name="voiceKey"
                          error={touched.voiceKey && Boolean(errors.voiceKey)}
                          helperText={touched.voiceKey && errors.voiceKey}
                          variant="outlined"
                          margin="dense"
                          fullWidth
                          placeholder="Chave do Azure Speech Service"
                        />
                        <Field
                          as={TextField}
                          label="Voice Region (Azure)"
                          name="voiceRegion"
                          error={touched.voiceRegion && Boolean(errors.voiceRegion)}
                          helperText={touched.voiceRegion && errors.voiceRegion}
                          variant="outlined"
                          margin="dense"
                          fullWidth
                          placeholder="ex: brazilsouth"
                        />
                      </div>
                    )}

                    <Divider style={{ margin: "18px 0" }} />

                    <Typography variant="subtitle1" className={classes.sectionTitle}>
                      Resposta automática em áudio com OpenAI
                    </Typography>

                    <Typography variant="caption" color="textSecondary">
                      Use esta opção para a IA responder em áudio automaticamente quando o cliente enviar uma mensagem de voz.
                      Esta função usa OpenAI TTS e não depende da chave Azure.
                    </Typography>

                    <Box mt={2}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={Boolean(values.aiAudioReplyEnabled)}
                            onChange={(e) =>
                              setFieldValue("aiAudioReplyEnabled", e.target.checked)
                            }
                            name="aiAudioReplyEnabled"
                          />
                        }
                        label="Ativar resposta automática em áudio"
                      />
                    </Box>

                    {values.aiAudioReplyEnabled && (
                      <>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={Boolean(values.aiAudioReplyOnlyWhenInputAudio)}
                              onChange={(e) =>
                                setFieldValue("aiAudioReplyOnlyWhenInputAudio", e.target.checked)
                              }
                              name="aiAudioReplyOnlyWhenInputAudio"
                            />
                          }
                          label="Responder em áudio somente quando o cliente enviar áudio"
                        />

                        <div className={classes.multFieldLine}>
                          <FormControl fullWidth margin="dense" variant="outlined">
                            <InputLabel>Modelo OpenAI TTS</InputLabel>
                            <Field
                              as={Select}
                              label="Modelo OpenAI TTS"
                              name="aiAudioReplyModel"
                            >
                              {openAiTtsModels.map((model) => (
                                <MenuItem key={model} value={model}>
                                  {model}
                                </MenuItem>
                              ))}
                            </Field>
                          </FormControl>

                          <FormControl fullWidth margin="dense" variant="outlined">
                            <InputLabel>Voz OpenAI</InputLabel>
                            <Field
                              as={Select}
                              label="Voz OpenAI"
                              name="aiAudioReplyVoice"
                            >
                              {openAiTtsVoices.map((voice) => (
                                <MenuItem key={voice.value} value={voice.value}>
                                  {voice.label}
                                </MenuItem>
                              ))}
                            </Field>
                          </FormControl>
                        </div>

                        <div className={classes.multFieldLine}>
                          <Field
                            as={TextField}
                            label="Velocidade"
                            name="aiAudioReplySpeed"
                            variant="outlined"
                            margin="dense"
                            fullWidth
                            type="number"
                            inputProps={{
                              step: "0.25",
                              min: "0.25",
                              max: "4"
                            }}
                            helperText="1 = normal"
                          />

                          <Field
                            as={TextField}
                            label="Máx. caracteres no áudio"
                            name="aiAudioReplyMaxChars"
                            variant="outlined"
                            margin="dense"
                            fullWidth
                            type="number"
                            inputProps={{
                              min: "100",
                              max: "4000"
                            }}
                            helperText="Limita respostas muito longas em áudio"
                          />
                        </div>

                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={Boolean(values.aiAudioReplySendTextWithLinks)}
                              onChange={(e) =>
                                setFieldValue("aiAudioReplySendTextWithLinks", e.target.checked)
                              }
                              name="aiAudioReplySendTextWithLinks"
                            />
                          }
                          label="Enviar links em mensagem de texto separada"
                        />

                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={Boolean(values.aiAudioReplyFallbackToText)}
                              onChange={(e) =>
                                setFieldValue("aiAudioReplyFallbackToText", e.target.checked)
                              }
                              name="aiAudioReplyFallbackToText"
                            />
                          }
                          label="Enviar texto caso falhe a geração do áudio"
                        />

                        <Field
                          as={TextField}
                          label="Instruções da voz OpenAI"
                          name="aiAudioReplyInstructions"
                          variant="outlined"
                          margin="dense"
                          fullWidth
                          multiline
                          rows={3}
                          helperText="Ex: fale em português do Brasil, tom consultivo, objetivo e natural."
                        />
                      </>
                    )}

                  </AccordionDetails>
                </Accordion>

                {/* COMPORTAMENTO DO FLUXO */}
                <Accordion className={classes.accordion} defaultExpanded>
                  <AccordionSummary
                    expandIcon={<ExpandMore />}
                    className={classes.accordionSummary}
                  >
                    <Typography className={classes.sectionTitle}>
                      <Timer />
                      {i18n.t("automation.ai.flowBehavior")}
                      <Tooltip title="Configure como o OpenAI deve se comportar no fluxo">
                        <Info fontSize="small" color="action" />
                      </Tooltip>
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails className={classes.accordionDetails}>

                    <FormControl component="fieldset" margin="normal">
                      <FormLabel component="legend">{i18n.t("automation.ai.operationMode")}</FormLabel>
                      <RadioGroup
                        name="flowMode"
                        value={values.flowMode}
                        onChange={(e) => setFieldValue("flowMode", e.target.value)}
                      >
                        <FormControlLabel
                          value="permanent"
                          control={<Radio />}
                          label={
                            <Box>
                              <Typography variant="body1">
                                <strong>{i18n.t("automation.ai.permanent")}</strong> - {i18n.t("automation.ai.endFlowHere")}
                              </Typography>
                              <Typography variant="caption" color="textSecondary">
                                {i18n.t("automation.ai.permanentHelp")}
                              </Typography>
                            </Box>
                          }
                        />
                        <FormControlLabel
                          value="temporary"
                          control={<Radio />}
                          label={
                            <Box>
                              <Typography variant="body1">
                                <strong>{i18n.t("automation.ai.temporary")}</strong> - {i18n.t("automation.ai.returnToFlow")}
                              </Typography>
                              <Typography variant="caption" color="textSecondary">
                                {i18n.t("automation.ai.temporaryHelp")}
                              </Typography>
                            </Box>
                          }
                        />
                      </RadioGroup>
                    </FormControl>

                    {/* CONFIGURAÇÕES DO MODO TEMPORÁRIO */}
                    {values.flowMode === "temporary" && (
                      <div className={classes.temporarySettings}>
                        <Typography variant="h6" gutterBottom>
                          ⏱️ Configurações do Modo Temporário
                        </Typography>
                        <Typography variant="body2" color="textSecondary" gutterBottom>
                          Configure quando a IA deve parar e retornar ao fluxo
                        </Typography>

                        {/* Limite de Interações */}
                        <Field
                          as={TextField}
                          label="Máximo de Interações"
                          name="maxInteractions"
                          error={touched.maxInteractions && Boolean(errors.maxInteractions)}
                          helperText={touched.maxInteractions && errors.maxInteractions || "Número máximo de mensagens antes de voltar ao fluxo (0 = ilimitado)"}
                          variant="outlined"
                          margin="dense"
                          fullWidth
                          type="number"
                          inputProps={{ min: 0, max: 50 }}
                        />

                        {/* Timeout */}
                        <Field
                          as={TextField}
                          label="Timeout (minutos)"
                          name="completionTimeout"
                          error={touched.completionTimeout && Boolean(errors.completionTimeout)}
                          helperText={touched.completionTimeout && errors.completionTimeout || "Tempo limite antes de voltar ao fluxo (0 = sem limite)"}
                          variant="outlined"
                          margin="dense"
                          fullWidth
                          type="number"
                          inputProps={{ min: 0, max: 60 }}
                        />

                        {/* Palavras-chave de Continuação */}
                        <FormControl fullWidth margin="dense">
                          <Typography variant="subtitle2" gutterBottom>
                            Palavras-chave para Continuar Fluxo
                          </Typography>
                          <FieldArray name="continueKeywords">
                            {(arrayHelpers) => (
                              <div>
                                <Box display="flex" gap={1} alignItems="center" mb={1}>
                                  <TextField
                                    variant="outlined"
                                    size="small"
                                    placeholder="Digite uma palavra-chave"
                                    value={newKeyword}
                                    onChange={(e) => setNewKeyword(e.target.value)}
                                    onKeyPress={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        addKeyword(
                                          arrayHelpers,
                                          newKeyword,
                                          values.continueKeywords || []
                                        );
                                      }
                                    }}
                                  />
                                  <Button
                                    variant="outlined"
                                    size="small"
                                    startIcon={<Add />}
                                    onClick={() =>
                                      addKeyword(
                                        arrayHelpers,
                                        newKeyword,
                                        values.continueKeywords || []
                                      )
                                    }
                                    disabled={!newKeyword.trim()}
                                  >
                                    {i18n.t("todo.add")}
                                  </Button>
                                </Box>
                                <Box display="flex" flexWrap="wrap" gap={0.5}>
                                  {(values.continueKeywords || []).map((keyword, index) => (
                                    <Chip
                                      key={index}
                                      label={keyword}
                                      className={classes.keywordChip}
                                      onDelete={() => removeKeyword(arrayHelpers, index)}
                                      deleteIcon={<Delete />}
                                      variant="outlined"
                                      size="small"
                                    />
                                  ))}
                                </Box>
                                <Typography variant="caption" color="textSecondary">
                                  Quando o usuário enviar uma dessas palavras, o fluxo continuará automaticamente
                                </Typography>
                                {touched.continueKeywords && errors.continueKeywords && (
                                  <Typography variant="caption" color="error">
                                    {errors.continueKeywords}
                                  </Typography>
                                )}
                              </div>
                            )}
                          </FieldArray>
                        </FormControl>

                        {/* Objetivo */}
                        <Field
                          as={TextField}
                          label="Objetivo da IA"
                          name="objective"
                          error={touched.objective && Boolean(errors.objective)}
                          helperText={touched.objective && errors.objective || "Descreva o que a IA deve completar (ex: 'Coletar nome, email e telefone')"}
                          variant="outlined"
                          margin="dense"
                          fullWidth
                          multiline
                          rows={2}
                          placeholder="Ex: Coletar dados do cliente, Qualificar interesse, Diagnosticar problema..."
                        />

                        {/* Auto Completar */}
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={values.autoCompleteOnObjective}
                              onChange={(e) => setFieldValue("autoCompleteOnObjective", e.target.checked)}
                              name="autoCompleteOnObjective"
                            />
                          }
                          label={
                            <Box>
                              <Typography variant="body2">
                                Auto completar quando atingir objetivo
                              </Typography>
                              <Typography variant="caption" color="textSecondary">
                                A IA analisará automaticamente se completou o objetivo e voltará ao fluxo
                              </Typography>
                            </Box>
                          }
                        />

                        {/* Fila de Transferência */}
                        <Field
                          as={TextField}
                          label="ID da Fila (para transferência)"
                          name="queueId"
                          error={touched.queueId && Boolean(errors.queueId)}
                          helperText="ID da fila para onde transferir se usuário pedir atendente (0 = não transferir)"
                          variant="outlined"
                          margin="dense"
                          fullWidth
                          type="number"
                          inputProps={{ min: 0 }}
                        />

                      </div>
                    )}

                  </AccordionDetails>
                </Accordion>

              </DialogContent>
              <DialogActions>
                <Button
                  onClick={handleClose}
                  color="secondary"
                  variant="outlined"
                  disabled={isSubmitting}
                >
                  {i18n.t("wallets.cancel")}
                </Button>
                <Button
                  type="submit"
                  color="primary"
                  variant="contained"
                  className={classes.btnWrapper}
                  disabled={isSubmitting}
                >
                  {labels.btn}
                </Button>
              </DialogActions>
            </Form>
          )}
        </Formik>
      </Dialog>
    </div>
  );
};

export default FlowBuilderOpenAIModal;
