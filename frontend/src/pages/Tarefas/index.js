import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { makeStyles } from "@material-ui/core/styles";
import {
  Badge, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, IconButton, InputAdornment, InputLabel, MenuItem, Paper, Select,
  TextField, Tooltip, Typography
} from "@material-ui/core";
import {
  Add, Assignment, CalendarToday, CheckCircle, Delete, Edit, FileCopy,
  HourglassEmpty, Loop, Person, Search, SwapHoriz, Warning
} from "@material-ui/icons";
import { DragDropContext, Draggable, Droppable } from "react-beautiful-dnd";
import { toast } from "react-toastify";
import { format, parseISO } from "date-fns";
import api from "../../services/api";
import { AuthContext } from "../../context/Auth/AuthContext";
import MainContainer from "../../components/MainContainer";
import { i18n } from "../../translate/i18n";

const COLUNAS = [
  { id: "recusada", titleKey: "operations.tasks.columns.rejected", cor: "#e74c3c", Icon: Warning },
  { id: "aguardando", titleKey: "operations.tasks.columns.waiting", cor: "#f39c12", Icon: HourglassEmpty },
  { id: "andamento", titleKey: "operations.tasks.columns.inProgress", cor: "#3498db", Icon: Loop },
  { id: "completa", titleKey: "operations.tasks.columns.completed", cor: "#27ae60", Icon: CheckCircle }
];

const PRIORIDADES = {
  baixa: { labelKey: "operations.tasks.priorities.low", color: "#27ae60" },
  media: { labelKey: "operations.tasks.priorities.medium", color: "#3498db" },
  alta: { labelKey: "operations.tasks.priorities.high", color: "#f39c12" },
  urgente: { labelKey: "operations.tasks.priorities.urgent", color: "#e74c3c" }
};

const initialForm = { nome: "", descricao: "", dataLimite: "", prioridade: "media", comentarios: "", responsibleUserId: "" };

const useStyles = makeStyles(theme => {
  const dark = theme.palette.type === "dark" || theme.mode === "dark";
  return {
    root: {
      minHeight: 0,
      height: "100%",
      overflowY: "auto",
      overflowX: "hidden",
      WebkitOverflowScrolling: "touch",
      padding: `${theme.spacing(1.5)}px !important`,
      ...theme.scrollbarStyles
    },
    topPanel: {
      padding: theme.spacing(1.5), marginBottom: theme.spacing(1.5), borderRadius: 18,
      background: dark ? "#101827" : "linear-gradient(115deg, #ffffff 0%, #edf7ff 55%, #edfff5 100%)",
      border: `1px solid ${dark ? "#2c3a50" : "#dce7e5"}`,
      boxShadow: dark ? "none" : "0 5px 18px rgba(16,24,40,.06)"
    },
    titleRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: theme.spacing(1.25) },
    titleWrap: { display: "flex", alignItems: "center", gap: 10 },
    titleIcon: { width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", color: "#173b8f", background: dark ? "#162b57" : "#dce8ff" },
    pageTitle: { fontSize: "1.1rem", fontWeight: 800, color: dark ? "#f4f7fb" : "#101828" },
    toolbar: {
      display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1.5fr", alignItems: "center", gap: theme.spacing(1),
      width: "100%", [theme.breakpoints.down("md")]: { gridTemplateColumns: "1fr 1fr" },
      [theme.breakpoints.down("xs")]: { gridTemplateColumns: "1fr" }
    },
    search: { minWidth: 0 },
    filter: { minWidth: 0 },
    addButton: { height: 42, borderRadius: 12, background: dark ? "#3cb3f5" : "#007c91", color: dark ? "#07131d" : "#fff", fontWeight: 800, padding: "0 22px" },
    boardPaper: {
      flex: 1,
      minHeight: 0,

      overflowX: "auto",
      overflowY: "hidden",

      padding: 0,

      background: dark
        ? "#15171b"
        : theme.palette.background.default,

      border: `1px solid ${
        dark ? "#333841" : "#e5e7eb"
      }`,

      WebkitOverflowScrolling: "touch",

      ...theme.scrollbarStyles,

      [theme.breakpoints.down("sm")]: {
        flex: "0 0 auto",
        width: "100%"
      },

      "@media (max-height: 760px)": {
        flex: "0 0 auto"
      }
    },
    board: {
      display: "flex",

      width: "100%",
      minWidth: 1180,

      height: "calc(100dvh - 245px)",
      minHeight: 420,

      overflow: "visible",

      gap: theme.spacing(1.5),
      padding: 0,

      [theme.breakpoints.down("sm")]: {
        height: 520,
        minHeight: 520
      },

      "@media (max-height: 760px)": {
        height: 500,
        minHeight: 500
      }
    },
    column: {
      flex: "1 1 0",
      minWidth: 285,
      height: "100%",

      display: "flex",
      flexDirection: "column",

      borderRadius: 12,
      overflow: "hidden",

      background: dark
        ? "#202329"
        : "#f5f6f8",

      border: `1px solid ${
        dark ? "#353a43" : "#e4e7ec"
      }`
    },
    columnHeader: props => ({
      display: "flex", alignItems: "center", gap: 8, padding: theme.spacing(1.25),
      background: dark ? `${props.columnColor}12` : `${props.columnColor}12`,
      borderTop: `4px solid ${props.columnColor || "#64748b"}`,
      borderBottom: `1px solid ${dark ? "#354154" : "#d9dee8"}`,
      color: props.columnColor || "#64748b", fontWeight: 700
    }),
    columnTitle: { flex: 1, color: "inherit", fontSize: ".95rem", fontWeight: 700 },
    count: { "& .MuiBadge-badge": { background: "rgba(0,0,0,.28)", color: "#fff", fontWeight: 700 } },
    cardList: { flex: 1, minHeight: 160, overflowY: "auto", padding: theme.spacing(1), ...theme.scrollbarStyles },
    dropActive: { background: dark ? "#292e37" : "#eaf2ff" },
    empty: { padding: theme.spacing(3, 1), textAlign: "center", color: dark ? "#8f98a6" : "#98a2b3" },
    card: {
      background: dark ? "#292d34" : "#fff", color: dark ? "#f3f4f6" : "#172033",
      borderRadius: 10, border: `1px solid ${dark ? "#3b414c" : "#e5e7eb"}`,
      padding: theme.spacing(1.25), marginBottom: theme.spacing(1), cursor: "grab",
      boxShadow: dark ? "0 5px 16px rgba(0,0,0,.25)" : "0 4px 14px rgba(16,24,40,.08)",
      transition: "transform .15s ease, box-shadow .15s ease",
      "&:hover": { transform: "translateY(-2px)", boxShadow: "0 10px 24px rgba(0,0,0,.24)" },
      "&:active": { cursor: "grabbing" }
    },
    dragging: { opacity: .88, boxShadow: "0 16px 34px rgba(0,0,0,.32)" },
    cardName: { fontSize: ".96rem", fontWeight: 700, color: "inherit", marginBottom: 6, wordBreak: "break-word" },
    description: { fontSize: ".82rem", color: dark ? "#c2c8d0" : "#667085", lineHeight: 1.4, marginBottom: 10 },
    meta: { display: "flex", alignItems: "center", gap: 6, color: dark ? "#b7bec8" : "#667085", fontSize: ".76rem", marginBottom: 6 },
    overdue: { color: "#ff5f57", fontWeight: 700 },
    overdueBanner: {
      display: "flex",
      alignItems: "center",
      gap: 5,
      marginBottom: 9,
      padding: "5px 8px",
      borderRadius: 7,
      background: dark
        ? "rgba(239,68,68,.16)"
        : "#fff1f2",
      border: "1px solid rgba(239,68,68,.35)",
      color: dark ? "#ff8a8a" : "#c62828",
      fontSize: ".73rem",
      fontWeight: 900,
      letterSpacing: ".02em"
    },
    priority: { display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "4px 8px", fontSize: ".74rem", fontWeight: 700 },
    cardFooter: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, marginTop: 10 },
    actions: { display: "flex", gap: 2 },
    action: { padding: 5, color: dark ? "#d5dae1" : "#667085" },
    dialogPaper: { background: dark ? "#101827" : "#fff", borderRadius: 16, borderTop: "5px solid #54a8ff", overflow: "hidden" },
    dialogTitle: { paddingBottom: 4, fontSize: "1.25rem", fontWeight: 700 },
    dialogGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: theme.spacing(1.5), [theme.breakpoints.down("xs")]: { gridTemplateColumns: "1fr" } },
    dialogField: { marginTop: theme.spacing(1.5) },
    cancel: { borderColor: dark ? "#68707d" : "#98a2b3" },
    save: { background: "#002bfd", color: "#fff", minWidth: 110 },
    dot: { width: 9, height: 9, borderRadius: "50%", display: "inline-block", marginRight: 7 },
    mobileHeader: { [theme.breakpoints.down("sm")]: { alignItems: "stretch" } }
  };
});

const formatDate = value => {
  if (!value) return "Sem prazo";
  try { return format(parseISO(`${value}T12:00:00`), "dd/MM/yyyy"); } catch (_) { return value; }
};

const isOverdue = tarefa =>
  tarefa.dataLimite &&
  !["completa", "recusada"].includes(tarefa.status) &&
  tarefa.dataLimite < format(new Date(), "yyyy-MM-dd");

const getOverdueDays = value => {
  if (!value) return 0;

  const parts = String(value)
    .split("-")
    .map(Number);

  if (parts.length !== 3) return 0;

  const [year, month, day] = parts;

  const deadlineUTC = Date.UTC(
    year,
    month - 1,
    day
  );

  const now = new Date();

  const todayUTC = Date.UTC(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  return Math.max(
    0,
    Math.floor(
      (todayUTC - deadlineUTC) /
        86400000
    )
  );
};

const overdueText = value => {
  const days = getOverdueDays(value);

  if (days <= 0) return "";

  return days === 1
    ? "ATRASADA HÁ 1 DIA"
    : `ATRASADA HÁ ${days} DIAS`;
};
const truncate = value => !value ? "" : value.length > 80 ? `${value.slice(0, 80)}...` : value;

const TaskDialog = ({
  open,
  tarefa,
  users,
  currentUserId,
  currentUserName,
  isAdmin,
  onClose,
  onSaved
}) => {
  const classes = useStyles();
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(tarefa ? {
      nome: tarefa.nome || "", descricao: tarefa.descricao || "", dataLimite: tarefa.dataLimite || "",
      prioridade: tarefa.prioridade || "media", comentarios: tarefa.comentarios || "",
      responsibleUserId: tarefa.responsibleUserId || currentUserId
    } : { ...initialForm, responsibleUserId: currentUserId });
  }, [tarefa, open, currentUserId]);

  const change = event => {
    const { name, value } = event.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };
  const save = async () => {
    if (!form.nome.trim()) return toast.error(i18n.t("operations.tasks.nameRequired"));
    setSaving(true);
    try {
      const payload = {
        ...form,
        nome: form.nome.trim(),
        dataLimite: form.dataLimite || null,
        responsibleUserId: isAdmin
          ? form.responsibleUserId
          : currentUserId
      };

      const { data } = tarefa
        ? await api.put(`/tarefas/${tarefa.id}`, payload)
        : await api.post("/tarefas", payload);
      toast.success(i18n.t(tarefa ? "operations.tasks.updated" : "operations.tasks.added"));
      onSaved(data);
      onClose();
    } catch (err) { toast.error(err?.response?.data?.error || i18n.t("operations.tasks.saveError")); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" classes={{ paper: classes.dialogPaper }}>
      <DialogTitle classes={{ root: classes.dialogTitle }}>{tarefa ? i18n.t("operations.tasks.edit") : i18n.t("operations.tasks.new")}</DialogTitle>
      <DialogContent>
        <TextField className={classes.dialogField} autoFocus fullWidth required variant="outlined" label={i18n.t("plans.form.name")} name="nome" value={form.nome} onChange={change} inputProps={{ maxLength: 255 }} />
        <TextField className={classes.dialogField} fullWidth multiline rows={3} variant="outlined" label={i18n.t("chatIndex.description")} name="descricao" value={form.descricao} onChange={change} />
        <div className={classes.dialogGrid}>
          <TextField className={classes.dialogField} fullWidth type="date" variant="outlined" label={i18n.t("operations.tasks.dueDate")} name="dataLimite" value={form.dataLimite} onChange={change} InputLabelProps={{ shrink: true }} />
          {isAdmin ? (
            <FormControl
              className={classes.dialogField}
              fullWidth
              variant="outlined"
            >
              <InputLabel>
                {i18n.t("operations.tasks.assignee")}
              </InputLabel>

              <Select
                name="responsibleUserId"
                value={form.responsibleUserId}
                onChange={change}
                label={i18n.t("operations.tasks.assignee")}
              >
                {users
                  .filter(item => item && item.id)
                  .map(item => (
                    <MenuItem
                      key={item.id}
                      value={item.id}
                    >
                      {item.name ||
                        i18n.t(
                          "operations.tasks.userNumber",
                          { id: item.id }
                        )}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
          ) : (
            <TextField
              className={classes.dialogField}
              fullWidth
              variant="outlined"
              disabled
              label={i18n.t("operations.tasks.assignee")}
              value={currentUserName || ""}
            />
          )}
          <FormControl className={classes.dialogField} fullWidth variant="outlined"><InputLabel>{i18n.t("announcements.table.priority")}</InputLabel><Select name="prioridade" value={form.prioridade} onChange={change} label={i18n.t("announcements.table.priority")}>{Object.entries(PRIORIDADES).map(([key, item]) => <MenuItem key={key} value={key}><span className={classes.dot} style={{ background: item.color }} />{i18n.t(item.labelKey)}</MenuItem>)}</Select></FormControl>
        </div>
        <TextField className={classes.dialogField} fullWidth multiline rows={3} variant="outlined" label={i18n.t("operations.tasks.comments")} name="comentarios" value={form.comentarios} onChange={change} />
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" className={classes.cancel} onClick={onClose} disabled={saving}>{i18n.t("campaignsPhrase.cancel")}</Button>
        <Button variant="contained" className={classes.save} onClick={save} disabled={saving}>{i18n.t(tarefa ? "operations.tasks.save" : "operations.tasks.add")}</Button>
      </DialogActions>
    </Dialog>
  );
};


const TaskViewDialog = ({
  open,
  tarefa,
  isAdmin,
  currentUserId,
  onClose,
  onEdit
}) => {
  const classes = useStyles();

  if (!tarefa) return null;

  const priority =
    PRIORIDADES[tarefa.prioridade] ||
    PRIORIDADES.media;

  const creator =
    tarefa.user?.name ||
    i18n.t("operations.tasks.removedUser");

  const responsible =
    tarefa.responsibleUser?.name ||
    creator;

  const canEdit =
    isAdmin ||
    Number(tarefa.userId) ===
      Number(currentUserId);

  const overdue = isOverdue(tarefa);

  const statusColumn =
    COLUNAS.find(
      item => item.id === tarefa.status
    );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      classes={{
        paper: classes.dialogPaper
      }}
    >
      <DialogTitle
        classes={{
          root: classes.dialogTitle
        }}
      >
        Detalhes da tarefa
      </DialogTitle>

      <DialogContent>
        <div
          style={{
            padding: "8px 0 18px"
          }}
        >
          <Typography
            style={{
              fontSize: "1.15rem",
              fontWeight: 800,
              marginBottom: 8
            }}
          >
            {tarefa.nome}
          </Typography>

          {!!tarefa.descricao && (
            <Typography
              style={{
                marginBottom: 18,
                whiteSpace: "pre-wrap"
              }}
            >
              {tarefa.descricao}
            </Typography>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit,minmax(210px,1fr))",
              gap: 12
            }}
          >
            <Paper
              variant="outlined"
              style={{ padding: 12 }}
            >
              <Typography
                variant="caption"
                color="textSecondary"
              >
                Responsável
              </Typography>

              <Typography>
                {responsible}
              </Typography>
            </Paper>

            <Paper
              variant="outlined"
              style={{ padding: 12 }}
            >
              <Typography
                variant="caption"
                color="textSecondary"
              >
                Criada por
              </Typography>

              <Typography>
                {creator}
              </Typography>
            </Paper>

            <Paper
              variant="outlined"
              style={{ padding: 12 }}
            >
              <Typography
                variant="caption"
                color="textSecondary"
              >
                Prazo
              </Typography>

              <Typography
                className={
                  overdue
                    ? classes.overdue
                    : undefined
                }
              >
                {formatDate(
                  tarefa.dataLimite
                )}
                {overdue
                  ? ` • ${overdueText(
                      tarefa.dataLimite
                    )}`
                  : ""}
              </Typography>
            </Paper>

            <Paper
              variant="outlined"
              style={{ padding: 12 }}
            >
              <Typography
                variant="caption"
                color="textSecondary"
              >
                Status
              </Typography>

              <Typography>
                {statusColumn
                  ? i18n.t(
                      statusColumn.titleKey
                    )
                  : tarefa.status}
              </Typography>
            </Paper>

            <Paper
              variant="outlined"
              style={{ padding: 12 }}
            >
              <Typography
                variant="caption"
                color="textSecondary"
              >
                Prioridade
              </Typography>

              <Typography
                style={{
                  color: priority.color,
                  fontWeight: 700
                }}
              >
                ●{" "}
                {i18n.t(
                  priority.labelKey
                )}
              </Typography>
            </Paper>
          </div>

          {!!tarefa.comentarios && (
            <Paper
              variant="outlined"
              style={{
                padding: 12,
                marginTop: 12
              }}
            >
              <Typography
                variant="caption"
                color="textSecondary"
              >
                Comentários
              </Typography>

              <Typography
                style={{
                  whiteSpace: "pre-wrap"
                }}
              >
                {tarefa.comentarios}
              </Typography>
            </Paper>
          )}

          {!canEdit && (
            <Typography
              variant="caption"
              color="textSecondary"
              style={{
                display: "block",
                marginTop: 16
              }}
            >
              Esta tarefa foi atribuída a você.
              Os dados e o prazo somente podem
              ser alterados por quem criou a
              tarefa ou por um administrador.
            </Typography>
          )}
        </div>
      </DialogContent>

      <DialogActions>
        <Button
          variant="outlined"
          onClick={onClose}
        >
          FECHAR
        </Button>

        {canEdit && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<Edit />}
            onClick={() => {
              onClose();
              onEdit(tarefa);
            }}
          >
            EDITAR
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};


const TaskCard = ({
  tarefa,
  index,
  onView,
  onEdit,
  onDelete,
  onDuplicate,
  onMove,
  isAdmin,
  currentUserId
}) => {
  const classes = useStyles();
  const priority = PRIORIDADES[tarefa.prioridade] || PRIORIDADES.media;
  const creator = tarefa.user?.name || i18n.t("operations.tasks.removedUser");
  const responsible = tarefa.responsibleUser?.name || creator;
  const overdue = isOverdue(tarefa);

  const canEdit =
    isAdmin ||
    Number(tarefa.userId) ===
      Number(currentUserId);

  return (
    <Draggable draggableId={String(tarefa.id)} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`${classes.card} ${snapshot.isDragging ? classes.dragging : ""}`}
          onClick={() => onView(tarefa)}
          role="button"
          tabIndex={0}
          onKeyDown={event => {
            if (
              event.key === "Enter" ||
              event.key === " "
            ) {
              event.preventDefault();
              onView(tarefa);
            }
          }}
        >
          {overdue && (
            <div className={classes.overdueBanner}>
              ⚠ {overdueText(tarefa.dataLimite)}
            </div>
          )}

          <Typography className={classes.cardName}>
            {tarefa.nome}
          </Typography>
          {!!tarefa.descricao && <Typography className={classes.description}>{truncate(tarefa.descricao)}</Typography>}
          <div className={classes.meta}><Person fontSize="small" />{i18n.t("operations.tasks.assigneeLabel")} {responsible}</div>
          <div className={`${classes.meta} ${overdue ? classes.overdue : ""}`}><CalendarToday fontSize="small" />{i18n.t("operations.tasks.deadlineLabel")} {formatDate(tarefa.dataLimite)}{overdue ? i18n.t("operations.tasks.overdue") : ""}</div>
          <div className={classes.meta}><Assignment fontSize="small" />{i18n.t("operations.tasks.createdBy")} {creator}</div>
          <div className={classes.cardFooter}>
            <span className={classes.priority} style={{ color: priority.color, background: `${priority.color}18`, border: `1px solid ${priority.color}55` }}>●&nbsp; {i18n.t(priority.labelKey)}</span>
            <div className={classes.actions}>
              {canEdit && (
                <Tooltip
                  title={i18n.t("chatList.edit")}
                >
                  <IconButton
                    className={classes.action}
                    onClick={event => {
                      event.stopPropagation();
                      onEdit(tarefa);
                    }}
                  >
                    <Edit fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title={i18n.t("chatList.delete")}><IconButton className={classes.action} onClick={event => {
  event.stopPropagation();
  onDelete(tarefa);
}}><Delete fontSize="small" /></IconButton></Tooltip>
              <Tooltip title={i18n.t("operations.tasks.duplicate")}><IconButton className={classes.action} onClick={event => {
  event.stopPropagation();
  onDuplicate(tarefa);
}}><FileCopy fontSize="small" /></IconButton></Tooltip>
              <Tooltip title={i18n.t("operations.tasks.move")}>
                <Select
  displayEmpty
  disableUnderline
  value=""
  onClick={event => event.stopPropagation()}
  onChange={event => {
    event.stopPropagation();
    onMove(tarefa, event.target.value);
  }}
  renderValue={() => (
    <SwapHoriz fontSize="small" />
  )}
  className={classes.action}
>
                  {COLUNAS.filter(c => c.id !== tarefa.status).map(c => <MenuItem key={c.id} value={c.id}>{i18n.t(c.titleKey)}</MenuItem>)}
                </Select>
              </Tooltip>
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
};

const TaskColumn = props => {
  const { column, tarefas, ...handlers } = props;
  const classes = useStyles({ columnColor: column.cor });
  const Icon = column.Icon;
  return (
    <div className={classes.column}>
      <div className={classes.columnHeader}><Icon fontSize="small" /><Typography className={classes.columnTitle}>{i18n.t(column.titleKey)}</Typography><Badge className={classes.count} badgeContent={tarefas.length} max={999}><span style={{ width: 12 }} /></Badge></div>
      <Droppable droppableId={column.id} type="TASK">
        {(provided, snapshot) => (
          <div ref={provided.innerRef} {...provided.droppableProps} className={`${classes.cardList} ${snapshot.isDraggingOver ? classes.dropActive : ""}`}>
            {tarefas.map((tarefa, index) => <TaskCard key={tarefa.id} tarefa={tarefa} index={index} {...handlers} />)}
            {!tarefas.length && <div className={classes.empty}>{i18n.t("operations.tasks.emptyColumn")}</div>}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
};

const Tarefas = () => {
  const classes = useStyles();
  const { user, socket } = useContext(AuthContext);
  const isAdmin = user?.profile === "admin";

  const [tarefas, setTarefas] = useState([]);
  const [searchParam, setSearchParam] = useState("");
  const [prioridade, setPrioridade] = useState("");
  const [dataFiltro, setDataFiltro] = useState("");
  const [scope, setScope] = useState("mine");
  const [responsibleUserId, setResponsibleUserId] = useState("");

  const [teamSummary, setTeamSummary] = useState({
    pending: 0,
    today: 0,
    overdue: 0,
    future: 0,
    withoutDeadline: 0
  });
  const [users, setUsers] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);

  const [resolvedDeleteType, setResolvedDeleteType] =
    useState("all");

  const [deletingResolved, setDeletingResolved] =
    useState(false);

  const fetchTasks = useCallback(async () => {
    try {
      const { data } = await api.get("/tarefas", {
        params: {
          searchParam: searchParam || undefined,
          prioridade: prioridade || undefined,
          dataFiltro: dataFiltro || undefined,
          scope: isAdmin ? scope : "mine",
          responsibleUserId:
            isAdmin && scope === "all"
              ? responsibleUserId || undefined
              : undefined
        }
      });
      setTarefas(data.tarefas || []);
    } catch (_) { toast.error(i18n.t("operations.tasks.loadError")); }
  }, [
    searchParam,
    prioridade,
    dataFiltro,
    scope,
    responsibleUserId,
    isAdmin
  ]);

  useEffect(() => {
    if (!isAdmin) {
      setUsers([]);
      return;
    }

    api.get("/users/list")
      .then(({ data }) => {
        const list = Array.isArray(data?.users)
          ? data.users
          : Array.isArray(data)
            ? data
            : [];

        setUsers(
          list.filter(item => item && item.id)
        );
      })
      .catch(() => setUsers([]));
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      setScope("all");
    } else {
      setScope("mine");
    }
  }, [isAdmin]);

  useEffect(() => {
    if (scope === "mine") {
      setResponsibleUserId("");
    }
  }, [scope]);

  useEffect(() => { const timer = setTimeout(fetchTasks, 250); return () => clearTimeout(timer); }, [fetchTasks]);
  useEffect(() => {
    const event = `company${user.companyId}-tarefa`;
    const refresh = () => fetchTasks();
    socket.on(event, refresh);
    return () => socket.off(event, refresh);
  }, [socket, user.companyId, fetchTasks]);

  const fetchTeamSummary = useCallback(async () => {
    if (!isAdmin) return;

    try {
      const { data } = await api.get(
        "/tarefas/resumo",
        {
          params: {
            scope: "team"
          }
        }
      );

      setTeamSummary({
        pending: Number(data?.pending || 0),
        today: Number(data?.today || 0),
        overdue: Number(data?.overdue || 0),
        future: Number(data?.future || 0),
        withoutDeadline: Number(
          data?.withoutDeadline || 0
        )
      });
    } catch (_) {
      setTeamSummary({
        pending: 0,
        today: 0,
        overdue: 0,
        future: 0,
        withoutDeadline: 0
      });
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return undefined;

    fetchTeamSummary();

    const event =
      `company${user.companyId}-tarefa`;

    socket.on(event, fetchTeamSummary);

    return () => {
      socket.off(event, fetchTeamSummary);
    };
  }, [
    isAdmin,
    socket,
    user.companyId,
    fetchTeamSummary
  ]);

  const grouped = useMemo(() => COLUNAS.reduce((acc, c) => ({ ...acc, [c.id]: tarefas.filter(t => t.status === c.id) }), {}), [tarefas]);
  const openAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = tarefa => {
    setEditing(tarefa);
    setDialogOpen(true);
  };

  const openView = tarefa => {
    setViewing(tarefa);
  };
  const upsert = tarefa => setTarefas(prev => [tarefa, ...prev.filter(item => item.id !== tarefa.id)]);

  const move = async (tarefa, status) => {
    const previous = tarefas;
    setTarefas(items => items.map(item => item.id === tarefa.id ? { ...item, status } : item));
    try { await api.put(`/tarefas/${tarefa.id}/mover`, { status }); }
    catch (_) { setTarefas(previous); toast.error(i18n.t("operations.tasks.moveError")); }
  };

  const onDragEnd = result => {
    if (!result.destination || result.source.droppableId === result.destination.droppableId) return;
    const tarefa = tarefas.find(item => String(item.id) === result.draggableId);
    if (tarefa) move(tarefa, result.destination.droppableId);
  };

  const removeResolvedTasks = async () => {
    if (!isAdmin || deletingResolved) return;

    const labels = {
      all: i18n.t(
        "taskCleanup.confirmAll"
      ),
      completa: i18n.t(
        "taskCleanup.confirmCompleted"
      ),
      recusada: i18n.t(
        "taskCleanup.confirmRejected"
      )
    };

    const confirmed = window.confirm(
      i18n.t(
        "taskCleanup.confirmQuestion",
        {
          items:
            labels[resolvedDeleteType]
        }
      ) +
      "\n\n" +
      i18n.t(
        "taskCleanup.permanentWarning"
      )
    );

    if (!confirmed) return;

    try {
      setDeletingResolved(true);

      const { data } = await api.delete(
        "/tarefas/resolvidas/limpar",
        {
          params: {
            tipo: resolvedDeleteType
          }
        }
      );

      await fetchTasks();
      await fetchTeamSummary();

      const total = Number(
        data?.count || 0
      );

      if (total === 0) {
        toast.info(
          i18n.t(
            "taskCleanup.noneFound"
          )
        );
      } else if (total === 1) {
        toast.success(
          i18n.t(
            "taskCleanup.oneDeleted"
          )
        );
      } else {
        toast.success(
          i18n.t(
            "taskCleanup.manyDeleted",
            {
              count: total
            }
          )
        );
      }
    } catch (err) {
      console.error(
        "[TAREFAS] Erro ao excluir resolvidas:",
        err
      );

      toast.error(
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        i18n.t(
          "taskCleanup.deleteError"
        )
      );
    } finally {
      setDeletingResolved(false);
    }
  };

  const remove = async tarefa => {
    if (!window.confirm(i18n.t("operations.tasks.deleteConfirm", { name: tarefa.nome }))) return;
    try { await api.delete(`/tarefas/${tarefa.id}`); setTarefas(prev => prev.filter(item => item.id !== tarefa.id)); toast.success(i18n.t("operations.tasks.deleted")); }
    catch (_) { toast.error(i18n.t("operations.tasks.deleteError")); }
  };

  const duplicate = async tarefa => {
    try { const { data } = await api.post(`/tarefas/${tarefa.id}/duplicar`); upsert(data); toast.success(i18n.t("operations.tasks.duplicated")); }
    catch (_) { toast.error(i18n.t("operations.tasks.duplicateError")); }
  };

  return (
    <MainContainer className={classes.root}>
      <Paper className={classes.topPanel} elevation={0}>
        <div className={classes.titleRow}><div className={classes.titleWrap}><div className={classes.titleIcon}><Assignment /></div><Typography className={classes.pageTitle}>{i18n.t("todo.task")}</Typography></div><Button className={classes.addButton} variant="contained" startIcon={<Add />} onClick={openAdd}>{i18n.t("operations.tasks.add")}</Button></div>
        {isAdmin && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
              marginBottom: 12,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(120,130,150,.20)",
              background: "rgba(120,130,150,.06)"
            }}
          >
            <Typography
              style={{
                fontWeight: 800,
                marginRight: 6
              }}
            >
              {i18n.t("taskCleanup.team")}
            </Typography>

            <Chip
              size="small"
              label={`${i18n.t("taskCleanup.pending")}: ${teamSummary.pending}`}
              style={{
                fontWeight: 700
              }}
            />

            <Chip
              size="small"
              label={`${i18n.t("taskCleanup.today")}: ${teamSummary.today}`}
              style={{
                fontWeight: 700,
                color: "#d97706"
              }}
            />

            <Chip
              size="small"
              label={`${i18n.t("taskCleanup.overdue")}: ${teamSummary.overdue}`}
              style={{
                fontWeight: 700,
                color: teamSummary.overdue
                  ? "#dc2626"
                  : undefined
              }}
            />

            {!!teamSummary.withoutDeadline && (
              <Chip
                size="small"
                label={`${i18n.t("taskCleanup.withoutDeadline")}: ${teamSummary.withoutDeadline}`}
                style={{
                  fontWeight: 700
                }}
              />
            )}
          </div>
        )}

        {isAdmin && (
          <div
            data-testid="resolved-task-cleanup"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
              marginBottom: 12,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(220,38,38,.22)",
              background: "rgba(220,38,38,.045)"
            }}
          >
            <Typography
              style={{
                fontWeight: 800,
                marginRight: "auto"
              }}
            >
              {i18n.t(
                "taskCleanup.cleanResolved"
              )}
            </Typography>

            <FormControl
              size="small"
              variant="outlined"
              style={{
                minWidth: 230
              }}
            >
              <InputLabel>
                {i18n.t(
                  "taskCleanup.tasks"
                )}
              </InputLabel>

              <Select
                value={resolvedDeleteType}
                onChange={e =>
                  setResolvedDeleteType(
                    e.target.value
                  )
                }
                label={i18n.t(
                  "taskCleanup.tasks"
                )}
              >
                <MenuItem value="all">
                  {i18n.t(
                    "taskCleanup.allResolved"
                  )}
                </MenuItem>

                <MenuItem value="completa">
                  {i18n.t(
                    "taskCleanup.allCompleted"
                  )}
                </MenuItem>

                <MenuItem value="recusada">
                  {i18n.t(
                    "taskCleanup.allRejected"
                  )}
                </MenuItem>
              </Select>
            </FormControl>

            <Button
              variant="contained"
              color="secondary"
              startIcon={<Delete />}
              disabled={deletingResolved}
              onClick={removeResolvedTasks}
              style={{
                height: 40,
                fontWeight: 800
              }}
            >
              {deletingResolved
                ? i18n.t(
                    "taskCleanup.deleting"
                  )
                : i18n.t(
                    "taskCleanup.delete"
                  )}
            </Button>
          </div>
        )}

        <div
          className={classes.toolbar}
          style={
            !isAdmin
              ? {
                  gridTemplateColumns:
                    "minmax(260px, 1.5fr) minmax(160px, 1fr) minmax(180px, 1fr)"
                }
              : undefined
          }
        >
          <TextField className={classes.search} size="small" variant="outlined" label={i18n.t("operations.tasks.search")} placeholder={i18n.t("operations.tasks.searchPlaceholder")} value={searchParam} onChange={e => setSearchParam(e.target.value)} InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }} />
          {isAdmin && (
            <>
              <FormControl
                className={classes.filter}
                size="small"
                variant="outlined"
              >
                <InputLabel>
                  {i18n.t("operations.tasks.filter")}
                </InputLabel>

                <Select
                  value={scope}
                  onChange={e => setScope(e.target.value)}
                  label={i18n.t("operations.tasks.filter")}
                >
                  <MenuItem value="mine">
                    {i18n.t("operations.tasks.mine")}
                  </MenuItem>

                  <MenuItem value="all">
                    {i18n.t("operations.tasks.allTasks")}
                  </MenuItem>
                </Select>
              </FormControl>

              <FormControl
                className={classes.filter}
                size="small"
                variant="outlined"
                disabled={scope === "mine"}
              >
                <InputLabel>
                  {i18n.t("wallets.user")}
                </InputLabel>

                <Select
                  value={responsibleUserId}
                  onChange={e =>
                    setResponsibleUserId(e.target.value)
                  }
                  label={i18n.t("wallets.user")}
                >
                  <MenuItem value="">
                    {i18n.t("wallets.allUsers")}
                  </MenuItem>

                  {users
                    .filter(item => item && item.id)
                    .map(item => (
                      <MenuItem
                        key={item.id}
                        value={item.id}
                      >
                        {item.name ||
                          i18n.t(
                            "operations.tasks.userNumber",
                            { id: item.id }
                          )}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
            </>
          )}
          <FormControl className={classes.filter} size="small" variant="outlined"><InputLabel>{i18n.t("announcements.table.priority")}</InputLabel><Select value={prioridade} onChange={e => setPrioridade(e.target.value)} label={i18n.t("announcements.table.priority")}><MenuItem value="">{i18n.t("operations.tasks.all")}</MenuItem>{Object.entries(PRIORIDADES).map(([key, item]) => <MenuItem key={key} value={key}><span className={classes.dot} style={{ background: item.color }} />{i18n.t(item.labelKey)}</MenuItem>)}</Select></FormControl>
          <FormControl className={classes.filter} size="small" variant="outlined"><InputLabel>{i18n.t("schedules.date")}</InputLabel><Select value={dataFiltro} onChange={e => setDataFiltro(e.target.value)} label={i18n.t("schedules.date")}><MenuItem value="">{i18n.t("operations.tasks.allDates")}</MenuItem><MenuItem value="hoje">{i18n.t("schedules.today")}</MenuItem><MenuItem value="semana">{i18n.t("operations.tasks.thisWeek")}</MenuItem><MenuItem value="mes">{i18n.t("operations.tasks.thisMonth")}</MenuItem><MenuItem value="atrasadas">{i18n.t("operations.tasks.overdueFilter")}</MenuItem></Select></FormControl>
        </div>
      </Paper>
      <Paper className={classes.boardPaper} variant="outlined">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className={classes.board}>{COLUNAS.map(column => <TaskColumn
  key={column.id}
  column={column}
  tarefas={grouped[column.id] || []}
  onView={openView}
  onEdit={openEdit}
  onDelete={remove}
  onDuplicate={duplicate}
  onMove={move}
  isAdmin={isAdmin}
  currentUserId={user.id}
/>)}</div>
        </DragDropContext>
      </Paper>
      <TaskViewDialog
        open={!!viewing}
        tarefa={viewing}
        isAdmin={isAdmin}
        currentUserId={user.id}
        onClose={() => setViewing(null)}
        onEdit={openEdit}
      />

      <TaskDialog
        open={dialogOpen}
        tarefa={editing}
        users={users}
        currentUserId={user.id}
        currentUserName={user.name}
        isAdmin={isAdmin}
        onClose={() => setDialogOpen(false)}
        onSaved={upsert}
      />
    </MainContainer>
  );
};

export default Tarefas;
