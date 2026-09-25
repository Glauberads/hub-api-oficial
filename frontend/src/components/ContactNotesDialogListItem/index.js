import React from 'react';
import PropTypes from 'prop-types';
import IconButton from '@material-ui/core/IconButton';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import ListItemAvatar from '@material-ui/core/ListItemAvatar';
import ListItemSecondaryAction from '@material-ui/core/ListItemSecondaryAction';
import Avatar from '@material-ui/core/Avatar';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import DeleteIcon from '@material-ui/icons/Delete';
import moment from 'moment';
import EditIcon from "@material-ui/icons/Edit";

const useStyles = makeStyles((theme) => ({
    inline: {
        width: '100%'
    }
}));

export default function ContactNotesDialogListItem(props) {
    const { note, deleteItem, editItem } = props;
    const classes = useStyles();

    const handleDelete = (item) => {
        console.log('[ContactNotesDialogListItem] handleDelete chamado com item:', item);
        if (item && deleteItem) {
            deleteItem(item);
        } else {
            console.error('[ContactNotesDialogListItem] Erro: item ou deleteItem não definido', { item, deleteItem });
        }
    }

    const handleEdit = (item) => {
        editItem(item);
    }
    return (
        <ListItem 
            alignItems="flex-start"
            style={{ 
                pointerEvents: 'auto',
                position: 'relative',
                zIndex: 1
            }}
            button={false}
        >
            <ListItemAvatar>
                <Avatar alt={note.user.name} src="/static/images/avatar/1.jpg" />
            </ListItemAvatar>
            <ListItemText
                primary={
                    <>
                        <Typography
                            component="span"
                            variant="body2"
                            className={classes.inline}
                            color="textPrimary"
                        >
                            {note.note}
                        </Typography>
                    </>
                }
                secondary={
                    <>
                        {note.user.name}, {moment(note.createdAt).format('DD/MM/YY HH:mm')}
                    </>
                }
            />
            <ListItemSecondaryAction 
                style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    pointerEvents: 'auto', 
                    zIndex: 100,
                    position: 'relative',
                    right: 0,
                    top: 0
                }}
                onClick={(e) => {
                    // Não bloquear eventos aqui
                    e.stopPropagation();
                }}
            >
                {/* <IconButton onClick={() => handleEdit(note)} edge="end" aria-label="edit">
                    <EditIcon />
                </IconButton> */}
                <IconButton 
                    onClick={(e) => {
                        console.log('[ContactNotesDialogListItem] Botão deletar onClick');
                        e.preventDefault();
                        e.stopPropagation();
                        handleDelete(note);
                    }}
                    onTouchStart={(e) => {
                        console.log('[ContactNotesDialogListItem] Botão deletar touch start');
                        e.stopPropagation();
                    }}
                    onTouchEnd={(e) => {
                        console.log('[ContactNotesDialogListItem] Botão deletar touch end - chamando handleDelete');
                        e.preventDefault();
                        e.stopPropagation();
                        // Chamar diretamente sem setTimeout
                        handleDelete(note);
                    }}
                    onMouseDown={(e) => {
                        console.log('[ContactNotesDialogListItem] Botão deletar mouseDown');
                        e.stopPropagation();
                    }}
                    edge="end" 
                    aria-label="delete"
                    style={{
                        pointerEvents: 'auto',
                        zIndex: 101,
                        touchAction: 'manipulation',
                        position: 'relative',
                        minWidth: '48px',
                        minHeight: '48px',
                        padding: '12px'
                    }}
                >
                    <DeleteIcon style={{ pointerEvents: 'none' }} />
                </IconButton>
            </ListItemSecondaryAction>

        </ListItem>
    )
}

ContactNotesDialogListItem.propTypes = {
    note: PropTypes.object.isRequired,
    deleteItem: PropTypes.func.isRequired
}