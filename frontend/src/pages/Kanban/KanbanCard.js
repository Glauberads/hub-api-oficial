import React, { useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import {
  Avatar,
  Button,
  Tooltip,
  Typography,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
} from '@material-ui/core';
import CloseIcon from '@material-ui/icons/Close';
import DragIndicatorIcon from '@material-ui/icons/DragIndicator';
import { format, parseISO, isSameDay, differenceInMinutes, differenceInHours, differenceInDays } from 'date-fns';
import { useHistory } from 'react-router-dom';
import { Draggable } from 'react-beautiful-dnd';
import { toast } from 'react-toastify';
import api from '../../services/api';
import { i18n } from "../../translate/i18n";
import { useCurrency } from '../../context/Currency/CurrencyContext';

const useStyles = makeStyles(theme => ({
  card: {
    padding: theme.spacing(1.2),
    background: '#fff',
    borderRadius: 12,
    boxShadow: '0px 8px 18px rgba(16, 24, 40, 0.10)',
    marginBottom: theme.spacing(1),
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    border: '1px solid #eaecf0',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
    '&:hover': {
      transform: 'translateY(-1px)',
      boxShadow: '0px 12px 24px rgba(16, 24, 40, 0.14)',
    },
  },
  cardDragging: {
    boxShadow: '0px 18px 36px rgba(16, 24, 40, 0.18)',
  },
  cardClickableArea: {
    cursor: 'pointer',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(0.75),
    gap: theme.spacing(1),
  },
  leftHeader: {
    display: 'flex',
    alignItems: 'center',
    minWidth: 0,
    flex: 1,
  },
  avatar: {
    marginRight: theme.spacing(1),
    width: theme.spacing(4),
    height: theme.spacing(4),
    fontSize: '0.8rem',
  },
  contactInfo: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  cardTitle: {
    fontSize: '0.95rem',
    fontWeight: 'bold',
    color: '#101828',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: 160,
  },
  ticketNumber: {
    fontSize: '0.72rem',
    fontWeight: 600,
    color: '#667085',
  },
  rightHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(0.75),
  },
  dragHandle: {
    cursor: 'grab',
    color: '#98a2b3',
    padding: 4,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    '&:hover': {
      background: '#f2f4f7',
      color: '#344054',
    },
  },
  topBadges: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 6,
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    background: '#2563eb',
    color: '#fff',
    fontSize: '0.72rem',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 7px',
  },
  timeBadge: {
    fontSize: '0.72rem',
    color: '#667085',
    fontWeight: 600,
  },
  timeBadgeUnread: {
    fontSize: '0.72rem',
    color: '#2563eb',
    fontWeight: 'bold',
  },
  divider: {
    background: '#eaecf0',
    marginBottom: theme.spacing(0.75),
  },
  lastMessage: {
    fontSize: '0.85rem',
    color: '#475467',
    lineHeight: 1.35,
    marginBottom: theme.spacing(1),
    display: '-webkit-box',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    minHeight: 36,
  },
  metaRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0.75),
    marginBottom: theme.spacing(1),
  },
  metaChip: {
    fontSize: '0.72rem',
    fontWeight: 700,
    borderRadius: 999,
    padding: '4px 8px',
    background: '#f2f4f7',
    color: '#344054',
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  assigneeChip: {
    background: '#101828',
    color: '#fff',
  },
  unreadChip: {
    background: '#eff6ff',
    color: '#1d4ed8',
  },
  valueChip: {
    background: '#ecfdf3',
    color: '#027a48',
    cursor: 'pointer',
  },
  waitingInfo: {
    fontSize: '0.75rem',
    color: '#667085',
    marginBottom: theme.spacing(1),
    fontWeight: 600,
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    marginTop: 'auto',
  },
  cardButton: {
    fontSize: '0.75rem',
    padding: '6px 10px',
    color: '#fff',
    backgroundColor: theme.palette.primary.main,
    borderRadius: '10px',
    textTransform: 'none',
    fontWeight: 'bold',
    '&:hover': {
      backgroundColor: theme.palette.primary.dark,
    },
  },
  secondaryButton: {
    fontSize: '0.75rem',
    padding: '6px 10px',
    borderRadius: '10px',
    textTransform: 'none',
    fontWeight: 'bold',
  },
  removeValueButton: {
    padding: 0,
    marginLeft: 2,
    color: theme.palette.error.main,
  },
  textField: {
    '& .MuiOutlinedInput-root': {
      borderRadius: '10px',
    },
  },
  dialogPaper: {
    borderRadius: '10px',
  },
  dialogButton: {
    borderRadius: '10px',
  },
}));

const KanbanCard = ({ ticket, index, updateTicket }) => {
  const { formatCurrency } = useCurrency();
  const classes = useStyles();
  const history = useHistory();

  const [open, setOpen] = useState(false);
  const [newValue, setNewValue] = useState('');

  const parseTicketDate = () => {
    try {
      return parseISO(ticket.updatedAt);
    } catch (error) {
      return new Date();
    }
  };

  const ticketDate = parseTicketDate();

  const handleCardClick = () => {
    history.push(`/tickets/${ticket.uuid}`);
  };

  const handleStopPropagation = event => {
    event.stopPropagation();
  };

  const lastMessageTimeClass =
    Number(ticket.unreadMessages) > 0
      ? classes.timeBadgeUnread
      : classes.timeBadge;

  const customFields = Array.isArray(ticket?.contact?.extraInfo)
    ? [...ticket.contact.extraInfo]
    : [];

  const valueFieldIndex = customFields.findIndex(field => field.name === 'valor');
  const valueField = valueFieldIndex !== -1 ? customFields[valueFieldIndex] : null;
  const opportunityValue = valueField ? parseFloat(valueField.value) : null;

  const handleOpenModal = event => {
    handleStopPropagation(event);
    setNewValue(valueField ? valueField.value.toString() : '');
    setOpen(true);
  };

  const handleCloseModal = () => {
    setOpen(false);
  };

  const buildExtraInfoWithoutValue = () => {
    return customFields.filter(field => field && field.name !== 'valor');
  };

  const updateContactValue = async (contactId, value) => {
    const nextExtraInfo = [...buildExtraInfoWithoutValue()];

    if (value !== '' && value !== null && value !== undefined) {
      nextExtraInfo.push({ name: 'valor', value: value.toString() });
    }

    await api.put(`/contacts/${contactId}`, {
      extraInfo: nextExtraInfo,
    });

    return nextExtraInfo;
  };

  const removeContactValue = async event => {
    handleStopPropagation(event);

    try {
      const nextExtraInfo = buildExtraInfoWithoutValue();

      await api.put(`/contacts/${ticket.contact.id}`, {
        extraInfo: nextExtraInfo,
      });

      updateTicket({
        ...ticket,
        contact: {
          ...ticket.contact,
          extraInfo: nextExtraInfo,
        },
      });

      toast.success(i18n.t("operations.kanban.valueRemoved"));
    } catch (error) {
      console.error('Erro ao remover o valor:', error);
      toast.error(i18n.t("operations.kanban.valueRemoveError"));
    }
  };

  const handleSaveValue = async () => {
    try {
      const nextExtraInfo = await updateContactValue(ticket.contact.id, newValue);

      updateTicket({
        ...ticket,
        contact: {
          ...ticket.contact,
          extraInfo: nextExtraInfo,
        },
      });

      setOpen(false);
      toast.success(i18n.t("operations.kanban.valueUpdated"));
    } catch (error) {
      console.error('Erro ao atualizar o valor:', error);
      toast.error(i18n.t("operations.kanban.valueUpdateError"));
    }
  };

  const getWaitingLabel = () => {
    const now = new Date();
    const minutes = differenceInMinutes(now, ticketDate);

    if (minutes < 60) {
      return i18n.t("operations.kanban.waitingMinutes", {
        count: Math.max(minutes, 1)
      });
    }

    const hours = differenceInHours(now, ticketDate);
    if (hours < 24) {
      return i18n.t("operations.kanban.waitingHours", { count: hours });
    }

    const days = differenceInDays(now, ticketDate);
    return i18n.t("operations.kanban.waitingDays", { count: days });
  };

  const getDisplayTime = () => {
    return isSameDay(ticketDate, new Date())
      ? format(ticketDate, 'HH:mm')
      : format(ticketDate, 'dd/MM/yyyy');
  };

  const getBorderColor = () => {
    if (Number(ticket.unreadMessages || 0) > 0) {
      return '#2563eb';
    }

    if (!ticket.user) {
      return '#f59e0b';
    }

    return '#12b76a';
  };

  const initials = !ticket.contact?.urlPicture && ticket.contact?.name
    ? ticket.contact.name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(word => word[0]?.toUpperCase())
        .join('')
    : null;

  return (
    <Draggable draggableId={ticket.id.toString()} index={index}>
      {(provided, snapshot) => (
        <div
          className={`${classes.card} ${snapshot.isDragging ? classes.cardDragging : ''}`}
          ref={provided.innerRef}
          {...provided.draggableProps}
          style={{
            ...provided.draggableProps.style,
            borderLeft: `4px solid ${getBorderColor()}`,
          }}
        >
          <div className={classes.cardClickableArea} onClick={handleCardClick}>
            <div className={classes.header}>
              <div className={classes.leftHeader}>
                <Avatar
                  src={ticket.contact?.urlPicture}
                  className={classes.avatar}
                  style={{
                    backgroundColor: !ticket.contact?.urlPicture ? '#3f51b5' : undefined,
                    color: '#fff',
                    fontWeight: 'bold',
                  }}
                >
                  {initials}
                </Avatar>

                <div className={classes.contactInfo}>
                  <Tooltip title={ticket.contact?.name || ''}>
                    <Typography className={classes.cardTitle}>
                      {ticket.contact?.name || 'Contato sem nome'}
                    </Typography>
                  </Tooltip>

                  <Typography className={classes.ticketNumber}>
                    {i18n.t("operations.kanban.ticketPrefix")}{ticket.id}
                  </Typography>
                </div>
              </div>

              <div className={classes.rightHeader}>
                <div
                  {...provided.dragHandleProps}
                  className={classes.dragHandle}
                  onClick={handleStopPropagation}
                  title={i18n.t("operations.kanban.moveTicket")}
                >
                  <DragIndicatorIcon fontSize="small" />
                </div>

                <div className={classes.topBadges}>
                  {Number(ticket.unreadMessages || 0) > 0 && (
                    <div className={classes.unreadBadge}>
                      {ticket.unreadMessages}
                    </div>
                  )}

                  <Typography className={lastMessageTimeClass}>
                    {getDisplayTime()}
                  </Typography>
                </div>
              </div>
            </div>

            <Divider className={classes.divider} />

            <Tooltip title={ticket.lastMessage || 'Sem mensagem recente'}>
              <Typography className={classes.lastMessage}>
                {ticket.lastMessage || 'Sem mensagem recente'}
              </Typography>
            </Tooltip>

            <Typography className={classes.waitingInfo}>
              {getWaitingLabel()}
            </Typography>

            <div className={classes.metaRow}>
              {ticket.user ? (
                <div className={`${classes.metaChip} ${classes.assigneeChip}`}>
                  {ticket.user.name}
                </div>
              ) : (
                <div className={`${classes.metaChip} ${classes.unreadChip}`}>
                  {i18n.t("operations.kanban.unassigned")}
                </div>
              )}

              {ticket.queue?.name && (
                <div className={classes.metaChip}>
                  {i18n.t("operations.kanban.queueLabel")} {ticket.queue.name}
                </div>
              )}

              {ticket.whatsapp?.name && (
                <div className={classes.metaChip}>
                  {i18n.t("operations.kanban.connectionLabel")} {ticket.whatsapp.name}
                </div>
              )}

              {Number(ticket.unreadMessages || 0) > 0 && (
                <div className={`${classes.metaChip} ${classes.unreadChip}`}>
                  {ticket.unreadMessages} {i18n.t("operations.kanban.unread")}{Number(ticket.unreadMessages) === 1 ? '' : 's'}
                </div>
              )}

              <div
                className={`${classes.metaChip} ${classes.valueChip}`}
                onClick={handleOpenModal}
              >
                {opportunityValue !== null
                  ? `Valor: ${formatCurrency(opportunityValue)}`
                  : i18n.t("operations.kanban.assignValue")}
              </div>

              {opportunityValue !== null && (
                <Tooltip title={i18n.t("operations.kanban.removeValue")}>
                  <IconButton
                    className={classes.removeValueButton}
                    onClick={removeContactValue}
                    size="small"
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </div>
          </div>

          <div className={classes.footer}>
            <Button
              size="small"
              className={classes.cardButton}
              onClick={event => {
                handleStopPropagation(event);
                handleCardClick();
              }}
            >
              {i18n.t("campaigns.dialog.form.openTicket")}
            </Button>

            <Button
              size="small"
              variant="outlined"
              color="primary"
              className={classes.secondaryButton}
              onClick={handleOpenModal}
            >
              {i18n.t("operations.kanban.editValue")}
            </Button>
          </div>

          <Dialog
            open={open}
            onClose={handleCloseModal}
            classes={{ paper: classes.dialogPaper }}
          >
            <DialogTitle>
              {valueField ? i18n.t("chatList.edit") : i18n.t("operations.kanban.assign")} {i18n.t("operations.kanban.opportunityValue")}
            </DialogTitle>

            <DialogContent>
              <TextField
                label={i18n.t("financial.value")}
                type="number"
                fullWidth
                value={newValue}
                onChange={e => setNewValue(e.target.value)}
                variant="outlined"
                size="small"
                className={classes.textField}
              />
            </DialogContent>

            <DialogActions>
              <Button
                onClick={handleCloseModal}
                color="secondary"
                variant="outlined"
                className={classes.dialogButton}
              >
                {i18n.t("wallets.cancel")}
              </Button>
              <Button
                onClick={handleSaveValue}
                color="primary"
                variant="outlined"
                className={classes.dialogButton}
              >
                {i18n.t("wallets.save")}
              </Button>
            </DialogActions>
          </Dialog>
        </div>
      )}
    </Draggable>
  );
};

export default KanbanCard;
