import React, { useEffect, useRef } from "react";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Dialog from "@material-ui/core/Dialog";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Typography from "@material-ui/core/Typography";
import IconButton from "@material-ui/core/IconButton";
import Divider from "@material-ui/core/Divider";
import CloseIcon from "@material-ui/icons/Close";
import ReceiptIcon from "@material-ui/icons/Receipt";
import CheckoutPage from "../CheckoutPage/";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexWrap: "wrap",
  },

  dialogPaper: {
    borderRadius: 16,
    overflow: "hidden",
    boxShadow: "0 18px 50px rgba(15, 23, 42, 0.18)",
  },

  dialogTitleRoot: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: theme.spacing(2, 3),
    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
    color: "#fff",
  },

  titleLeft: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.25),
  },

  titleIconBox: {
    width: 38,
    height: 38,
    minWidth: 38,
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(255,255,255,0.14)",
  },

  titleText: {
    fontWeight: 700,
    fontSize: 18,
    lineHeight: 1.1,
  },

  titleSubText: {
    color: "rgba(255,255,255,0.82)",
    marginTop: 4,
    fontSize: 13,
  },

  closeButton: {
    color: "#fff",
  },

  dialogBody: {
    padding: 0,
    background: "#f8fafc",
  },

  infoBox: {
    padding: theme.spacing(2, 3),
    background: "#ffffff",
  },

  infoText: {
    color: "#475569",
    fontSize: 14,
    lineHeight: 1.6,
  },

  textField: {
    marginRight: theme.spacing(1),
    flex: 1,
  },

  extraAttr: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
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
}));

const ContactModal = ({ open, onClose, Invoice, contactId, initialValues, onSave }) => {
  const classes = useStyles();
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleClose = () => {
    onClose();
  };

  return (
    <div className={classes.root}>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="md"
        fullWidth
        scroll="paper"
        aria-labelledby="subscription-dialog-title"
        PaperProps={{
          className: classes.dialogPaper,
        }}
      >
        <DialogTitle disableTypography className={classes.dialogTitleRoot} id="subscription-dialog-title">
          <div className={classes.titleLeft}>
            <div className={classes.titleIconBox}>
              <ReceiptIcon />
            </div>

            <div>
              <Typography className={classes.titleText}>
                {i18n.t("finalTouches.checkout.subscriptionPayment")}
              </Typography>
              <Typography className={classes.titleSubText}>
                {i18n.t("finalTouches.checkout.subscriptionPaymentHelp")}
              </Typography>
            </div>
          </div>

          <IconButton className={classes.closeButton} onClick={handleClose}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers className={classes.dialogBody}>
          <div className={classes.infoBox}>
            <Typography className={classes.infoText}>
              {i18n.t("finalTouches.checkout.providerHelp")}
            </Typography>
          </div>

          <Divider />

          <CheckoutPage
            Invoice={Invoice}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ContactModal;
