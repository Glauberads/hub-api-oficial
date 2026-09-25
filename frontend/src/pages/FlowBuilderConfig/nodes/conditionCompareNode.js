import React, { memo } from "react";
import { useTheme } from "@material-ui/core/styles";
import { Handle } from "react-flow-renderer";
import { CompareArrows } from "@mui/icons-material";

const operatorLabel = (op) => {
  const map = {
    equals: "==",
    notEquals: "≠",
    contains: "contém",
    notContains: "não contém",
    containsAny: "contém algum",
    greaterThan: ">",
    lessThan: "<",
    greaterOrEqual: "≥",
    lessOrEqual: "≤",
    startsWith: "inicia com",
    endsWith: "termina com",
    isEmpty: "vazio",
    isNotEmpty: "não vazio",
    regex: "regex",
  };
  return map[op] || op;
};

const ConditionLine = ({ condition, theme, isDark }) => {
  const unary = condition.operator === "isEmpty" || condition.operator === "isNotEmpty";

  return (
    <div style={{ fontSize: 11, color: theme.palette.text.primary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ color: "#2563eb", fontWeight: 700 }}>{condition.leftValue || "campo"}</span>
      <span style={{ color: "#7c3aed", fontWeight: 700, background: isDark ? "rgba(124,58,237,0.16)" : "rgba(124,58,237,0.08)", padding: "2px 8px", borderRadius: 999 }}>
        {operatorLabel(condition.operator)}
      </span>
      {!unary && <span style={{ color: "#059669", fontWeight: 700 }}>{condition.rightValue || "valor"}</span>}
    </div>
  );
};

export default memo(({ data, isConnectable }) => {
  const theme = useTheme();
  const isDark = (theme.palette.type || theme.palette.mode) === "dark";

  const conditions = data.conditions && data.conditions.length > 0
    ? data.conditions
    : [{ id: "0", leftValue: data.leftValue, operator: data.operator || "equals", rightValue: data.rightValue }];

  const logicOperator = data.logicOperator || "AND";
  const isMultiple = conditions.length > 1;
  const accent = "#7c3aed";

  const handleStyle = {
    width: 14,
    height: 14,
    borderRadius: "50%",
    border: "2px solid #fff",
    boxShadow: "0 0 0 2px rgba(124,58,237,0.16)"
  };

  return (
    <div style={{ position: "relative", background: isDark ? "rgba(15, 23, 42, 0.92)" : "rgba(255,255,255,0.96)", border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"}`, padding: "14px", borderRadius: "16px", minWidth: 230, maxWidth: 290, boxShadow: isDark ? "0 14px 32px rgba(0,0,0,0.22)" : "0 14px 32px rgba(15,23,42,0.08)", backdropFilter: "blur(10px)" }}>
      <Handle type="target" position="left" style={{ ...handleStyle, background: accent, top: "24px", left: "-10px" }} isConnectable={isConnectable} />

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <CompareArrows sx={{ color: accent, width: 16, height: 16 }} />
        <span style={{ color: theme.palette.text.primary, fontWeight: 700, fontSize: 14 }}>Se / Senão</span>
        {isMultiple && (
          <span style={{ marginLeft: "auto", background: logicOperator === "AND" ? (isDark ? "rgba(124,58,237,0.16)" : "rgba(124,58,237,0.08)") : (isDark ? "rgba(37,99,235,0.16)" : "rgba(37,99,235,0.08)"), color: logicOperator === "AND" ? "#7c3aed" : "#2563eb", fontSize: 10, fontWeight: "bold", borderRadius: 999, padding: "4px 8px", letterSpacing: 1 }}>
            {logicOperator}
          </span>
        )}
      </div>

      <div style={{ background: isDark ? "rgba(255,255,255,0.04)" : "rgba(248,250,252,0.95)", border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)"}`, borderRadius: 12, padding: "10px 12px", marginBottom: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {conditions.map((cond, i) => (
          <React.Fragment key={cond.id || i}>
            {i > 0 && (
              <div style={{ textAlign: "center", fontSize: 10, color: logicOperator === "AND" ? "#7c3aed" : "#2563eb", fontWeight: "bold", letterSpacing: 1, borderTop: `1px dashed ${isDark ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.12)"}`, paddingTop: 6 }}>
                {logicOperator === "AND" ? "E" : "OU"}
              </div>
            )}
            <ConditionLine condition={cond} theme={theme} isDark={isDark} />
          </React.Fragment>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginBottom: 8 }}>
        <span style={{ color: "#16a34a", fontSize: 11, marginRight: 8, fontWeight: "bold" }}>Verdadeiro</span>
        <Handle type="source" position="right" id="true" style={{ ...handleStyle, background: "#16a34a", position: "relative", transform: "none", top: "auto", right: "auto" }} isConnectable={isConnectable} />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
        <span style={{ color: "#ef4444", fontSize: 11, marginRight: 8, fontWeight: "bold" }}>Falso</span>
        <Handle type="source" position="right" id="false" style={{ ...handleStyle, background: "#ef4444", position: "relative", transform: "none", top: "auto", right: "auto" }} isConnectable={isConnectable} />
      </div>
    </div>
  );
});
