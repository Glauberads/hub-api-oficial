import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { Droppable, Draggable } from 'react-beautiful-dnd';
import KanbanCard from './KanbanCard';
import { Typography } from '@material-ui/core';
import DragIndicatorIcon from '@material-ui/icons/DragIndicator';
import { i18n } from "../../translate/i18n";
import { useCurrency } from '../../context/Currency/CurrencyContext';

const useStyles = makeStyles(theme => ({
  column: props => ({
    backgroundColor: '#f8f9fb',
    borderRadius: 12,
    minWidth: 320,
    maxWidth: 320,
    padding: theme.spacing(1),
    marginRight: theme.spacing(1),
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    borderTop: `4px solid ${props.color || '#ebecf0'}`,
    boxShadow: '0px 8px 24px rgba(16, 24, 40, 0.08)',
    border: '1px solid #e6e9ef',
  }),
  columnDragging: {
    boxShadow: '0px 14px 32px rgba(16, 24, 40, 0.16)',
  },
  columnTitle: {
    fontWeight: 'bold',
    fontSize: '1rem',
    color: '#101828',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: 170,
  },
  cardList: {
    flexGrow: 1,
    overflowY: 'auto',
    ...theme.scrollbarStyles,
    maxHeight: 'calc(100vh - 260px)',
    paddingTop: theme.spacing(0.5),
    borderRadius: 10,
    transition: 'background-color 0.2s ease',
  },
  dropActive: {
    backgroundColor: '#eef4ff',
  },
  totalValue: {
    fontSize: '0.75rem',
    color: '#667085',
    fontWeight: 600,
  },
  columnHeader: {
    marginBottom: theme.spacing(1),
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
  },
  dragHandle: {
    cursor: 'grab',
    color: '#667085',
    padding: theme.spacing(0.5),
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    '&:hover': {
      background: '#eef2f6',
      color: '#101828',
    },
  },
  columnContent: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    flex: 1,
    minWidth: 0,
  },
  countBadge: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    background: '#101828',
    color: '#fff',
    fontWeight: 'bold',
    fontSize: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 8px',
  },
  headerMeta: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 2,
  },
  unreadMeta: {
    fontSize: '0.75rem',
    color: '#2563eb',
    fontWeight: 'bold',
  },
  emptyState: {
    minHeight: 100,
    borderRadius: 10,
    border: '1px dashed #d0d5dd',
    background: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(2),
    textAlign: 'center',
    color: '#98a2b3',
    fontSize: '0.85rem',
  },
}));

const KanbanColumn = ({ id, title, tickets, color, index, updateTicket, isAdmin }) => {
  const { formatCurrency } = useCurrency();
  const classes = useStyles({ color });

  const totalValue = tickets.reduce((acc, ticket) => {
    const customFields = ticket?.contact?.extraInfo || [];
    const valueField = customFields.find(field => field.name === 'valor');
    const opportunityValue = valueField ? parseFloat(valueField.value) : 0;
    return acc + (Number.isNaN(opportunityValue) ? 0 : opportunityValue);
  }, 0);

  const unreadCount = tickets.reduce(
    (acc, ticket) => acc + Number(ticket?.unreadMessages || 0),
    0
  );

  return (
    <Draggable draggableId={id} index={index}>
      {(provided, snapshot) => (
        <div
          className={`${classes.column} ${snapshot.isDragging ? classes.columnDragging : ''}`}
          ref={provided.innerRef}
          {...provided.draggableProps}
        >
          <div className={classes.columnContent}>
            <div className={classes.columnHeader}>
              <div className={classes.titleRow}>
                {isAdmin && (
                  <div
                    {...provided.dragHandleProps}
                    className={classes.dragHandle}
                    title={i18n.t("operations.kanban.reorderColumn")}
                  >
                    <DragIndicatorIcon fontSize="small" />
                  </div>
                )}

                <Typography className={classes.columnTitle}>{title}</Typography>

                <div className={classes.countBadge}>
                  {tickets.length}
                </div>
              </div>

              <div className={classes.headerMeta}>
                <Typography className={classes.totalValue}>
                  {formatCurrency(totalValue)}
                </Typography>
                <Typography className={classes.unreadMeta}>
                  {unreadCount} {i18n.t("operations.kanban.unread")}{unreadCount === 1 ? '' : 's'}
                </Typography>
              </div>
            </div>

            <Droppable droppableId={id} type="CARD">
              {(provided, snapshot) => (
                <div
                  className={`${classes.cardList} ${snapshot.isDraggingOver ? classes.dropActive : ''}`}
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                >
                  {tickets.map((ticket, ticketIndex) => (
                    <KanbanCard
                      key={ticket.id}
                      ticket={ticket}
                      index={ticketIndex}
                      updateTicket={updateTicket}
                    />
                  ))}

                  {tickets.length === 0 && (
                    <div className={classes.emptyState}>
                      {i18n.t("operations.kanban.emptyStage")}
                    </div>
                  )}

                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        </div>
      )}
    </Draggable>
  );
};

export default KanbanColumn;
