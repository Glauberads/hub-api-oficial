// src/components/ContactDeleteConfirmModal/index.js
import React from "react";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Typography from "@material-ui/core/Typography";
import { makeStyles } from "@material-ui/core/styles";
import { Alert } from "@material-ui/lab";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  dialogContent: {
    minWidth: 400,
    paddingTop: theme.spacing(2),
  },
  alert: {
    marginBottom: theme.spacing(2),
  },
}));

const ContactDeleteConfirmModal = ({
  open,
  onClose,
  onConfirm,
  deleteType, // 'selected' ou 'all'
  selectedCount,
  totalCount,
}) => {
  const classes = useStyles();

  const handleConfirm = () => {
    onConfirm();
  };

  const getTitle = () => {
    if (deleteType === "all") {
      return `Excluir TODOS os ${totalCount} contatos?`;
    }
    return `Excluir ${selectedCount} contatos selecionados?`;
  };

  const getMessage = () => {
    if (deleteType === "all") {
      return (
        <>
          <Alert severity="error" className={classes.alert}>
            ⚠️ ATENÇÃO: Esta ação irá excluir TODOS os {totalCount} contatos da
            empresa permanentemente!
          </Alert>
          <Typography variant="body2">
            Esta operação não pode ser desfeita. Todos os contatos, seus
            históricos de mensagens, tags e relacionamentos serão perdidos
            definitivamente.
          </Typography>
        </>
      );
    }

    return (
      <>
        <Alert severity="warning" className={classes.alert}>
          Esta ação irá excluir {selectedCount} contatos selecionados
          permanentemente.
        </Alert>
        <Typography variant="body2">
          Os contatos selecionados e seus dados relacionados serão excluídos
          definitivamente.
        </Typography>
      </>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="delete-confirm-dialog"
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle id="delete-confirm-dialog">
        {getTitle()}
      </DialogTitle>

      <DialogContent className={classes.dialogContent}>
        {getMessage()}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} color="default">
          {i18n.t("wallets.cancel")}
        </Button>
        <Button
          onClick={handleConfirm}
          color="secondary"
          variant="contained"
        >
          {deleteType === "all" ? "Excluir Todos" : "Excluir Selecionados"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ContactDeleteConfirmModal;