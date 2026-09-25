import React, { useContext } from 'react';
import { Typography, Grid } from '@material-ui/core';
import useStyles from './styles';
import { AuthContext } from "../../../context/Auth/AuthContext";
import { i18n } from "../../../translate/i18n";
import { formatCurrencyValue } from "../../../context/Currency/CurrencyContext";

function PaymentDetails(props) {
  const { formValues } = props;
  const classes = useStyles();
  const { firstName, address2, city, zipcode, state, country, plan } = formValues;
  const { user } = useContext(AuthContext);


  const newPlan = JSON.parse(plan);
  const { price, currency = 'BRL' } = newPlan;

  return (
    <Grid item container direction="column" xs={6} sm={12}>
      <Typography variant="h6" gutterBottom className={classes.title}>
        {i18n.t("finalTouches.checkout.paymentInformation")}
      </Typography>
      <Grid container>
        <React.Fragment>
          <Grid item xs={6}>
            <Typography gutterBottom>{i18n.t("finalTouches.checkout.email")}:</Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography gutterBottom>{user.email}</Typography>
          </Grid>
        </React.Fragment>
        <React.Fragment>
          <Grid item xs={6}>
            <Typography gutterBottom>{i18n.t("finalTouches.checkout.name")}:</Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography gutterBottom>{firstName}</Typography>
          </Grid>
        </React.Fragment>
        <React.Fragment>
          <Grid item xs={6}>
            <Typography gutterBottom>{i18n.t("finalTouches.checkout.taxId")}:</Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography gutterBottom>{zipcode}</Typography>
          </Grid>
        </React.Fragment>
        <React.Fragment>
          <Grid item xs={6}>
            <Typography gutterBottom>{i18n.t("finalTouches.checkout.total")}:</Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography gutterBottom>{formatCurrencyValue(price, currency)}</Typography>
          </Grid>
        </React.Fragment>
      </Grid>
    </Grid>
  );
}

export default PaymentDetails;
