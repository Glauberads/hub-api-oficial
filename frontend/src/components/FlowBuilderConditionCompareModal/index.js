import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
  Popover,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  InputAdornment,
  Chip,
  Divider,
  Box,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import {
  Close as CloseIcon,
  CompareArrows as CompareArrowsIcon,
  Code as CodeIcon,
  Search as SearchIcon,
  Tag as TagIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  ConfirmationNumber as TicketIcon,
  DataObject as VarIcon,
  QuestionAnswer as InputIcon,
} from "@mui/icons-material";
import { i18n } from "../../translate/i18n";

const OPERATORS = [
  // Igualdade
  { value: "equals",       label: "Igual a",            icon: "=",   group: "Igualdade" },
  { value: "notEquals",    label: "Diferente de",        icon: "≠",   group: "Igualdade" },
  // Texto
  { value: "contains",     label: "Contém texto",        icon: "∈",   group: "Texto" },
  { value: "notContains",  label: "Não contém",          icon: "∉",   group: "Texto" },
  { value: "containsAny",  label: "Contém qualquer (,)", icon: "∈…",  group: "Texto" },
  { value: "startsWith",   label: "Começa com",          icon: "⊰",   group: "Texto" },
  { value: "endsWith",     label: "Termina com",         icon: "⊱",   group: "Texto" },
  // Numérico
  { value: "greaterThan",  label: "Maior que",           icon: ">",   group: "Numérico" },
  { value: "lessThan",     label: "Menor que",           icon: "<",   group: "Numérico" },
  { value: "greaterOrEqual",label:"Maior ou igual a",    icon: "≥",   group: "Numérico" },
  { value: "lessOrEqual",  label: "Menor ou igual a",    icon: "≤",   group: "Numérico" },
  // Estado
  { value: "isEmpty",      label: "Está vazio",          icon: "∅",   group: "Estado" },
  { value: "isNotEmpty",   label: "Não está vazio",      icon: "¬∅",  group: "Estado" },
  // Avançado
  { value: "regex",        label: "Expressão regular",   icon: ".*",  group: "Avançado" },
];

// Variáveis fixas de contato e ticket
const STATIC_VARIABLES = [
  { name: "nome", description: "Nome do contato", category: "Contato", icon: "person" },
  { name: "email", description: "Email do contato", category: "Contato", icon: "person" },
  { name: "telefone", description: "Telefone / número do contato", category: "Contato", icon: "person" },
  { name: "ultimaMensagem", description: "Última mensagem recebida", category: "Contato", icon: "person" },
  { name: "ticketId", description: "ID do ticket atual", category: "Ticket", icon: "ticket" },
  { name: "ticketStatus", description: "Status do ticket (open/pending/closed)", category: "Ticket", icon: "ticket" },
  { name: "ticketQueue", description: "Fila atual do ticket", category: "Ticket", icon: "ticket" },
  { name: "apiResponse", description: "Resposta da última requisição HTTP", category: "API", icon: "var" },
];

const CATEGORY_ORDER = ["Contato", "Ticket", "Variável Global", "Input Capturado", "Menu", "HTTP / API", "API"];

const CATEGORY_ICONS = {
  "Contato": <PersonIcon sx={{ fontSize: 15, color: "#1976d2" }} />,
  "Ticket": <TicketIcon sx={{ fontSize: 15, color: "#f57c00" }} />,
  "Variável Global": <VarIcon sx={{ fontSize: 15, color: "#388e3c" }} />,
  "Input Capturado": <InputIcon sx={{ fontSize: 15, color: "#7b1fa2" }} />,
  "Menu": <InputIcon sx={{ fontSize: 15, color: "#e65100" }} />,
  "HTTP / API": <TagIcon sx={{ fontSize: 15, color: "#0288d1" }} />,
  "API": <TagIcon sx={{ fontSize: 15, color: "#9c27b0" }} />,
};

const isUnary = (op) => op === "isEmpty" || op === "isNotEmpty";

const emptyCondition = () => ({
  id: Date.now() + Math.random(),
  leftValue: "",
  operator: "equals",
  rightValue: "",
});

/** Extrai variáveis dinâmicas dos nós do fluxo */
const extractDynamicVariables = (nodes = []) => {
  const dynamic = [];

  nodes.forEach((node) => {
    if (!node || !node.data) return;

    // ── Variável Global
    if (node.type === "variableNode" || node.type === "variable") {
      const name = node.data.variableName;
      if (name) {
        dynamic.push({
          name,
          description: node.data.variableValue
            ? `Valor: "${String(node.data.variableValue).slice(0, 40)}"`
            : "Variável global do fluxo",
          category: "Variável Global",
        });
      }
    }

    // ── Input (pergunta ao usuário — captura resposta em variável)
    if (node.type === "input") {
      const varName = node.data.variableName || node.data.saveAs || node.data.variable;
      const label = node.data.question || node.data.label || node.data.placeholder;
      if (varName) {
        dynamic.push({
          name: varName,
          description: label
            ? `Resposta de: "${String(label).slice(0, 45)}"`
            : "Resposta capturada do usuário",
          category: "Input Capturado",
        });
      }
    }

    // ── Menu (cada opção pode ser capturada via pressKey — variável padrão "menuResponse")
    if (node.type === "menu") {
      const options = node.data.arrayOption || [];
      if (options.length > 0) {
        dynamic.push({
          name: "menuResponse",
          description: `Resposta do menu: "${String(node.data.message || "").slice(0, 40)}"`,
          category: "Menu",
        });
        // Opções individuais como variáveis de contexto
        options.forEach((opt) => {
          if (opt.value) {
            dynamic.push({
              name: `menuOption_${opt.number}`,
              description: `Opção [${opt.number}] do menu: "${String(opt.value).slice(0, 35)}"`,
              category: "Menu",
            });
          }
        });
      }
    }

    // ── HTTP — variáveis mapeadas da resposta
    if (node.type === "httpRequest") {
      const saveVars = node.data.saveVariables || node.data.responseVariables || [];
      saveVars.forEach((sv) => {
        const varName = sv.variable || sv.variableName;
        const path = sv.path || "";
        if (varName) {
          dynamic.push({
            name: varName,
            description: path ? `Mapeado de: ${path}` : "Variável da resposta HTTP",
            category: "HTTP / API",
          });
        }
      });
    }
  });

  // Remover duplicatas por nome
  const seen = new Set();
  return dynamic.filter((v) => {
    if (seen.has(v.name)) return false;
    seen.add(v.name);
    return true;
  });
};

// ── Hook de autocomplete inline com $ ────────────────────────────────────────
const useInlineAutocomplete = (allVariables) => {
  const [acAnchor, setAcAnchor] = useState(null);
  const [acQuery, setAcQuery] = useState("");
  const [acTarget, setAcTarget] = useState(null);
  const inputRefs = useRef({});

  const acResults = useMemo(() => {
    if (acQuery === "") return allVariables.slice(0, 20);
    return allVariables
      .filter(
        (v) =>
          v.name.toLowerCase().includes(acQuery.toLowerCase()) ||
          v.category.toLowerCase().includes(acQuery.toLowerCase())
      )
      .slice(0, 20);
  }, [acQuery, allVariables]);

  const handleKeyChange = useCallback(
    (e, index, field, onChange) => {
      const input = e.target;
      const val = input.value;
      const cursor = input.selectionStart;
      onChange(index, field, val);

      // Detecta $ e abre autocomplete
      const textBefore = val.slice(0, cursor);
      const dollarIdx = textBefore.lastIndexOf("$");
      if (dollarIdx !== -1 && !textBefore.slice(dollarIdx).includes("}")) {
        const query = textBefore.slice(dollarIdx + 1).replace("{", "");
        setAcQuery(query);
        setAcTarget({ index, field, triggerStart: dollarIdx, cursorPos: cursor });
        setAcAnchor(inputRefs.current[`${index}_${field}`] || null);
      } else {
        setAcAnchor(null);
        setAcTarget(null);
      }
    },
    []
  );

  const selectVariable = useCallback(
    (varName, conditions, onChange) => {
      if (!acTarget) return;
      const { index, field, triggerStart, cursorPos } = acTarget;
      const current = conditions[index][field] || "";
      const before = current.slice(0, triggerStart);
      const after = current.slice(cursorPos);
      const inserted = "${" + varName + "}";
      onChange(index, field, before + inserted + after);
      setAcAnchor(null);
      setAcTarget(null);
      setAcQuery("");
      setTimeout(() => {
        const ref = inputRefs.current[`${index}_${field}`];
        if (ref) {
          const inp = ref.querySelector("input") || ref.querySelector("textarea");
          if (inp) {
            const pos = before.length + inserted.length;
            inp.focus();
            inp.setSelectionRange(pos, pos);
          }
        }
      }, 50);
    },
    [acTarget]
  );

  const closeAc = useCallback(() => {
    setAcAnchor(null);
    setAcTarget(null);
  }, []);

  return { acAnchor, acResults, acQuery, handleKeyChange, selectVariable, closeAc, inputRefs };
};

// ── Linha de condição individual ──────────────────────────────────────────────
const OPERATOR_GROUPS = ["Igualdade", "Texto", "Numérico", "Estado", "Avançado"];

const GROUP_COLORS = {
  "Igualdade": "#1976d2",
  "Texto":     "#7b1fa2",
  "Numérico":  "#f57c00",
  "Estado":    "#388e3c",
  "Avançado":  "#c62828",
};

const ConditionRow = ({ condition, index, total, onChange, onRemove, onOpenVar, inputRefs, onKeyChange }) => {
  const unary = isUnary(condition.operator);

  // Operadores agrupados para o Select
  const groupedOperators = OPERATOR_GROUPS.reduce((acc, g) => {
    acc[g] = OPERATORS.filter(op => op.group === g);
    return acc;
  }, {});

  const currentOp = OPERATORS.find(op => op.value === condition.operator);

  return (
    <Box sx={{
      border: "1px solid",
      borderColor: "divider",
      borderRadius: 2,
      p: 2,
      bgcolor: "background.paper",
      position: "relative",
    }}>
      {total > 1 && (
        <IconButton
          size="small"
          onClick={() => onRemove(index)}
          sx={{ position: "absolute", top: 6, right: 6, color: "text.secondary", "&:hover": { color: "error.main" } }}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      )}

      <Stack spacing={1.5}>
        <TextField
          fullWidth
          label="Variável / Campo"
          value={condition.leftValue}
          onChange={(e) => onKeyChange(e, index, "leftValue", onChange)}
          placeholder="Digite $ para ver variáveis disponíveis"
          variant="outlined"
          size="small"
          helperText="Digite $ para autocompletar variáveis do fluxo"
          ref={(el) => { if (inputRefs) inputRefs.current[`${index}_leftValue`] = el; }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <Tooltip title="Inserir variável pelo seletor">
                  <IconButton size="small" onClick={(e) => onOpenVar(e, index, "leftValue")} sx={{ color: "#9c27b0" }}>
                    <CodeIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </InputAdornment>
            ),
          }}
        />

        <FormControl fullWidth size="small">
          <InputLabel>Tipo de condição</InputLabel>
          <Select
            value={condition.operator}
            onChange={(e) => onChange(index, "operator", e.target.value)}
            label="Tipo de condição"
            renderValue={() => (
              <Stack direction="row" alignItems="center" spacing={1}>
                <Chip
                  label={currentOp?.icon || "="}
                  size="small"
                  sx={{ bgcolor: "rgba(156,39,176,0.1)", color: "#9c27b0", fontWeight: "bold", minWidth: 32 }}
                />
                <span>{currentOp?.label || condition.operator}</span>
              </Stack>
            )}
          >
            {OPERATOR_GROUPS.map((group) => {
              const ops = groupedOperators[group];
              if (!ops || ops.length === 0) return null;
              return [
                <MenuItem key={`header_${group}`} disabled sx={{ opacity: 1, fontWeight: 700, fontSize: 10, color: GROUP_COLORS[group], py: 0.3, letterSpacing: 1 }}>
                  ── {group.toUpperCase()} ──
                </MenuItem>,
                ...ops.map(op => (
                  <MenuItem key={op.value} value={op.value} sx={{ display: "flex", alignItems: "center", gap: 1, pl: 2 }}>
                    <Chip
                      label={op.icon}
                      size="small"
                      sx={{ bgcolor: `${GROUP_COLORS[group]}18`, color: GROUP_COLORS[group], fontWeight: "bold", minWidth: 32 }}
                    />
                    {op.label}
                  </MenuItem>
                ))
              ];
            })}
          </Select>
        </FormControl>

        {!unary && (
          <TextField
            fullWidth
            label={condition.operator === "containsAny" ? "Valores separados por vírgula" : "Valor da comparação"}
            value={condition.rightValue}
            onChange={(e) => onKeyChange(e, index, "rightValue", onChange)}
            placeholder={condition.operator === "containsAny" ? "sim, s, yes, 1" : "Digite $ para ver variáveis disponíveis"}
            variant="outlined"
            size="small"
            helperText={
              condition.operator === "regex"
                ? "Ex: ^[0-9]{11}$ — expressão regular JavaScript"
                : condition.operator === "containsAny"
                ? "Qualquer token da lista dispara Verdadeiro"
                : "Valor fixo ou variável com $"
            }
            ref={(el) => { if (inputRefs) inputRefs.current[`${index}_rightValue`] = el; }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Tooltip title="Inserir variável pelo seletor">
                    <IconButton size="small" onClick={(e) => onOpenVar(e, index, "rightValue")} sx={{ color: "#9c27b0" }}>
                      <CodeIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </InputAdornment>
              ),
            }}
          />
        )}
      </Stack>
    </Box>
  );
};

// ── Modal principal ───────────────────────────────────────────────────────────
const FlowBuilderConditionCompareModal = ({ open, onSave, data, onUpdate, close, nodes = [] }) => {
  const [conditions, setConditions] = useState([emptyCondition()]);
  const [logicOperator, setLogicOperator] = useState("AND");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Popover variáveis
  const [anchorEl, setAnchorEl] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTarget, setActiveTarget] = useState(null); // { index, field }

  // Variáveis dinâmicas extraídas dos nós do fluxo
  const dynamicVariables = useMemo(() => extractDynamicVariables(nodes), [nodes]);

  // Lista completa = variáveis dinâmicas + fixas (sem duplicatas)
  const allVariables = useMemo(() => {
    const dynamicNames = new Set(dynamicVariables.map((v) => v.name));
    const filtered = STATIC_VARIABLES.filter((v) => !dynamicNames.has(v.name));
    return [...dynamicVariables, ...filtered];
  }, [dynamicVariables]);

  // ── Inline autocomplete ──
  const { acAnchor, acResults, acQuery, handleKeyChange, selectVariable, closeAc, inputRefs } =
    useInlineAutocomplete(allVariables);

  /* ── Reset ao abrir ── */
  useEffect(() => {
    if (open === "edit" && data) {
      // data pode ser o nó completo { id, type, data: {...} } ou apenas o conteúdo interno
      const d = data.data || data;
      if (d.conditions && Array.isArray(d.conditions)) {
        setConditions(d.conditions.map((c) => ({ ...c, id: c.id || Date.now() + Math.random() })));
        setLogicOperator(d.logicOperator || "AND");
      } else {
        setConditions([{
          id: Date.now(),
          leftValue: d.leftValue || "",
          operator: d.operator || "equals",
          rightValue: d.rightValue || "",
        }]);
        setLogicOperator("AND");
      }
    } else {
      setConditions([emptyCondition()]);
      setLogicOperator("AND");
    }
    setError("");
  }, [open, data]);

  /* ── Handlers ── */
  const handleConditionChange = (index, field, value) => {
    setConditions((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  };

  const handleAddCondition = () => setConditions((prev) => [...prev, emptyCondition()]);

  const handleRemoveCondition = (index) => setConditions((prev) => prev.filter((_, i) => i !== index));

  const handleOpenVar = (event, index, field) => {
    setActiveTarget({ index, field });
    setAnchorEl(event.currentTarget);
    setSearchTerm("");
  };

  const insertVariable = (variableName) => {
    if (!activeTarget) return;
    const snippet = "${" + variableName + "}";
    handleConditionChange(
      activeTarget.index,
      activeTarget.field,
      (conditions[activeTarget.index][activeTarget.field] || "") + snippet
    );
    setAnchorEl(null);
  };

  const filteredVariables = allVariables.filter(
    (v) =>
      v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groupedVariables = filteredVariables.reduce((acc, v) => {
    if (!acc[v.category]) acc[v.category] = [];
    acc[v.category].push(v);
    return acc;
  }, {});

  /* ── Salvar ── */
  const handleSave = () => {
    for (let i = 0; i < conditions.length; i++) {
      const c = conditions[i];
      if (!c.leftValue.trim()) {
        setError(`Condição ${i + 1}: o campo "Variável / Campo" é obrigatório`);
        return;
      }
      if (!isUnary(c.operator) && !c.rightValue.trim()) {
        setError(`Condição ${i + 1}: o campo "Valor da comparação" é obrigatório`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const conditionData = {
        conditions,
        logicOperator,
        // legado (compatibilidade com backend que lê leftValue/operator/rightValue diretamente)
        leftValue: conditions[0].leftValue,
        operator: conditions[0].operator,
        rightValue: conditions[0].rightValue,
      };

      if (open === "edit" && data) {
        // data é o nó completo — preservar id, type, position etc.
        // e substituir apenas os dados internos (data.data)
        const nodeComplete = data.id
          ? { ...data, data: conditionData }
          : { ...data, data: conditionData };
        onUpdate(nodeComplete);
      } else {
        onSave(conditionData);
      }
      setIsSubmitting(false);
      setConditions([emptyCondition()]);
      setLogicOperator("AND");
      setError("");
      close(false);
    } catch (err) {
      setError("Ocorreu um erro ao salvar. Tente novamente.");
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setConditions([emptyCondition()]);
    setLogicOperator("AND");
    setError("");
    close(false);
  };

  return (
    <>
      <Dialog
        open={open !== false && open !== null}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, boxShadow: "0 8px 32px rgba(0,0,0,0.12)" } }}
      >
        {/* Título */}
        <DialogTitle
          sx={{ bgcolor: "background.paper", display: "flex", alignItems: "center", justifyContent: "space-between", p: 2, borderBottom: "1px solid", borderColor: "divider" }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <CompareArrowsIcon sx={{ color: "#9c27b0" }} />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {open === "edit" ? "Editar Condição" : "Nova Condição"}
            </Typography>
          </Stack>
          <IconButton size="small" onClick={handleClose} sx={{ color: "text.secondary" }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 2.5, pb: 1 }}>
          <Stack spacing={2}>
            {conditions.map((cond, index) => (
              <React.Fragment key={cond.id}>
                {index > 0 && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Divider sx={{ flex: 1 }} />
                    <ToggleButtonGroup
                      value={logicOperator}
                      exclusive
                      onChange={(_, val) => val && setLogicOperator(val)}
                      size="small"
                      sx={{ bgcolor: "background.paper", border: "1px solid", borderColor: "divider", borderRadius: 2 }}
                    >
                      <ToggleButton
                        value="AND"
                        sx={{
                          px: 2, py: 0.3, fontWeight: 700, fontSize: 12, border: "none", borderRadius: "8px !important",
                          color: logicOperator === "AND" ? "#fff" : "#9c27b0",
                          bgcolor: logicOperator === "AND" ? "#9c27b0 !important" : "transparent",
                          "&.Mui-selected": { bgcolor: "#9c27b0", color: "#fff" },
                        }}
                      >
                        E (AND)
                      </ToggleButton>
                      <ToggleButton
                        value="OR"
                        sx={{
                          px: 2, py: 0.3, fontWeight: 700, fontSize: 12, border: "none", borderRadius: "8px !important",
                          color: logicOperator === "OR" ? "#fff" : "#9c27b0",
                          bgcolor: logicOperator === "OR" ? "#9c27b0 !important" : "transparent",
                          "&.Mui-selected": { bgcolor: "#9c27b0", color: "#fff" },
                        }}
                      >
                        OU (OR)
                      </ToggleButton>
                    </ToggleButtonGroup>
                    <Divider sx={{ flex: 1 }} />
                  </Box>
                )}

                <ConditionRow
                  condition={cond}
                  index={index}
                  total={conditions.length}
                  onChange={handleConditionChange}
                  onRemove={handleRemoveCondition}
                  onOpenVar={handleOpenVar}
                  inputRefs={inputRefs}
                  onKeyChange={handleKeyChange}
                />
              </React.Fragment>
            ))}

            <Button
              startIcon={<AddIcon />}
              onClick={handleAddCondition}
              variant="outlined"
              size="small"
              sx={{
                borderStyle: "dashed", borderColor: "#9c27b0", color: "#9c27b0",
                borderRadius: 2, textTransform: "none", "&:hover": { bgcolor: "rgba(156,39,176,0.08)" },
              }}
            >
              Adicionar condição
            </Button>

            {conditions.length > 1 && (
              <Box sx={{ bgcolor: "rgba(156,39,176,0.08)", borderRadius: 2, p: 1.5, border: "1px solid rgba(156,39,176,0.2)" }}>
                <Typography variant="caption" sx={{ color: "#9c27b0", fontWeight: 600 }}>
                  Lógica: Verdadeiro se{" "}
                  <strong>{logicOperator === "AND" ? "TODAS as condições" : "QUALQUER condição"}</strong>{" "}
                  forem satisfeitas
                </Typography>
              </Box>
            )}

            {/* Dica rápida sobre operadores */}
            <Box sx={{ bgcolor: "action.hover", borderRadius: 2, p: 1.5, border: "1px solid", borderColor: "divider" }}>
              <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 0.5, fontWeight: 700 }}>
                💡 Dicas rápidas
              </Typography>
              <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                • <strong>Contém qualquer (,)</strong>: separe tokens por vírgula → <em>sim, s, yes, 1</em>
              </Typography>
              <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                • <strong>Regex</strong>: use expressão JS → <em>^[0-9]&#123;11&#125;$</em> para validar CPF
              </Typography>
              <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                • Use <strong>$&#123;variavel&#125;</strong> em qualquer campo para referenciar valores dinâmicos
              </Typography>
            </Box>

            {error && (
              <Typography color="error" variant="body2" sx={{ bgcolor: "rgba(211,47,47,0.08)", py: 1, px: 1.5, borderRadius: 1 }}>
                {error}
              </Typography>
            )}
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, bgcolor: "background.paper", borderTop: "1px solid", borderColor: "divider" }}>
          <Button onClick={handleClose} variant="outlined" sx={{ borderRadius: 2, textTransform: "none", color: "text.secondary", borderColor: "divider" }}>
            {i18n.t("wallets.cancel")}
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={isSubmitting}
            sx={{ borderRadius: 2, textTransform: "none", bgcolor: "#9c27b0", "&:hover": { bgcolor: "#7b1fa2" } }}
          >
            {isSubmitting ? "Salvando..." : open === "edit" ? "Salvar alterações" : i18n.t("todo.add")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Popover de variáveis */}
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        PaperProps={{ sx: { width: 320, mt: 1, borderRadius: 2, boxShadow: "0 4px 20px rgba(0,0,0,0.1)" } }}
      >
        <Paper sx={{ p: 2 }}>
          <Stack spacing={1.5}>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Selecionar variável
              </Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                {dynamicVariables.length > 0
                  ? `${dynamicVariables.length} variável(is) encontrada(s) no fluxo`
                  : "Adicione nós de Variável Global ou Input para variáveis dinâmicas"}
              </Typography>
            </Box>

            <TextField
              fullWidth
              size="small"
              placeholder="Buscar variável..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: "text.secondary", fontSize: 18 }} />
                  </InputAdornment>
                ),
              }}
            />

            <Divider />

            <List dense sx={{ maxHeight: 300, overflow: "auto", p: 0 }}>
              {CATEGORY_ORDER.map((cat) => {
                const vars = groupedVariables[cat];
                if (!vars || vars.length === 0) return null;
                return (
                  <React.Fragment key={cat}>
                    <ListItem sx={{ py: 0.4, bgcolor: "rgba(0,0,0,0.02)", borderRadius: 1, mb: 0.5 }}>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        {CATEGORY_ICONS[cat]}
                        <Typography variant="overline" sx={{ color: "text.secondary", fontWeight: 700, fontSize: "0.65rem", lineHeight: 1 }}>
                          {cat}
                        </Typography>
                        <Chip label={vars.length} size="small" sx={{ height: 16, fontSize: 10, ml: 0.5 }} />
                      </Stack>
                    </ListItem>
                    {vars.map((v) => (
                      <ListItem
                        key={v.name}
                        button
                        onClick={() => insertVariable(v.name)}
                        sx={{ borderRadius: 1, mb: 0.3, pl: 1.5, "&:hover": { bgcolor: "rgba(156,39,176,0.06)" } }}
                      >
                        <ListItemIcon sx={{ minWidth: 28 }}>
                          {CATEGORY_ICONS[cat] || <TagIcon sx={{ fontSize: 15, color: "#9c27b0" }} />}
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Stack direction="row" alignItems="center" spacing={0.5}>
                              <Typography variant="body2" fontWeight={600}>{v.name}</Typography>
                              <Chip
                                label={"${" + v.name + "}"}
                                size="small"
                                sx={{ height: 16, fontSize: 9, bgcolor: "rgba(156,39,176,0.08)", color: "#7b1fa2" }}
                              />
                            </Stack>
                          }
                          secondary={
                            <Typography variant="caption" sx={{ color: "text.secondary" }}>
                              {v.description}
                            </Typography>
                          }
                        />
                      </ListItem>
                    ))}
                  </React.Fragment>
                );
              })}
              {filteredVariables.length === 0 && (
                <ListItem>
                  <ListItemText secondary="Nenhuma variável encontrada" secondaryTypographyProps={{ align: "center" }} />
                </ListItem>
              )}
            </List>
          </Stack>
        </Paper>
      </Popover>

      {/* Autocomplete inline com $ */}
      <Popover
        open={Boolean(acAnchor)}
        anchorEl={acAnchor}
        onClose={closeAc}
        disableAutoFocus
        disableEnforceFocus
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        PaperProps={{
          sx: {
            width: 300,
            mt: 0.5,
            borderRadius: 2,
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
            border: "1px solid rgba(156,39,176,0.2)",
          },
        }}
      >
        <Box sx={{ p: 1 }}>
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ px: 1, pb: 0.5 }}>
            <CodeIcon sx={{ fontSize: 14, color: "#9c27b0" }} />
            <Typography variant="caption" sx={{ fontWeight: 700, color: "#7b1fa2" }}>
              Variáveis do fluxo
            </Typography>
            {acQuery && (
              <Chip
                label={`"${acQuery}"`}
                size="small"
                sx={{ height: 16, fontSize: 9, ml: 0.5, bgcolor: "rgba(156,39,176,0.08)", color: "#7b1fa2" }}
              />
            )}
          </Stack>
          <Divider sx={{ mb: 0.5 }} />
          <List dense sx={{ maxHeight: 240, overflow: "auto", p: 0 }}>
            {acResults.length === 0 && (
              <ListItem>
                <ListItemText secondary="Nenhuma variável encontrada" secondaryTypographyProps={{ align: "center" }} />
              </ListItem>
            )}
            {acResults.map((v) => (
              <ListItem
                key={v.name}
                button
                onClick={() => selectVariable(v.name, conditions, handleConditionChange)}
                sx={{
                  borderRadius: 1,
                  mb: 0.2,
                  cursor: "pointer",
                  "&:hover": { bgcolor: "rgba(156,39,176,0.08)" },
                }}
              >
                <ListItemIcon sx={{ minWidth: 26 }}>
                  {CATEGORY_ICONS[v.category] || <TagIcon sx={{ fontSize: 14, color: "#9c27b0" }} />}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <Typography variant="body2" fontWeight={600} sx={{ fontSize: 12 }}>
                        {v.name}
                      </Typography>
                      <Chip
                        label={v.category}
                        size="small"
                        sx={{ height: 14, fontSize: 8, bgcolor: "rgba(0,0,0,0.05)" }}
                      />
                    </Stack>
                  }
                  secondary={
                    <Typography variant="caption" sx={{ color: "text.secondary", fontSize: 10 }}>
                      {v.description}
                    </Typography>
                  }
                />
              </ListItem>
            ))}
          </List>
        </Box>
      </Popover>
    </>
  );
};

export default FlowBuilderConditionCompareModal;
