import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { DragDropContext, Droppable } from 'react-beautiful-dnd';
import KanbanColumn from './KanbanColumn';

const useStyles = makeStyles(theme => ({
  board: {
    display: 'flex',
    overflowX: 'auto',
    ...theme.scrollbarStyles,
    padding: theme.spacing(1),
    minHeight: '100%',
  },
}));

const KanbanBoard = ({ lanes, onCardMove, onLaneReorder, updateTicket, isAdmin }) => {
  const classes = useStyles();

  const handleDragEnd = result => {
    if (!result.destination) return;

    const { source, destination, draggableId, type } = result;

    if (type === 'LANE') {
      if (source.index !== destination.index) {
        onLaneReorder(source.index, destination.index);
      }
      return;
    }

    if (source.droppableId === destination.droppableId) {
      return;
    }

    onCardMove(
      draggableId,
      destination.droppableId,
      source.droppableId,
      source.index,
      destination.index
    );
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="lanes" direction="horizontal" type="LANE">
        {(provided) => (
          <div
            className={classes.board}
            ref={provided.innerRef}
            {...provided.droppableProps}
          >
            {lanes.map((lane, index) => (
              <KanbanColumn
                key={lane.id}
                id={lane.id}
                title={lane.title}
                tickets={lane.tickets}
                color={lane.color}
                index={index}
                updateTicket={updateTicket}
                isAdmin={isAdmin}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
};

export default KanbanBoard;