import React from 'react';
import { Typography, Grid } from '@material-ui/core';
import useStyles from './styles';
import { i18n } from '../../../translate/i18n';

function PaymentDetails(props) {
  const { formValues } = props;
  const classes = useStyles();
  const { plan } = formValues;

  const newPlan = JSON.parse(plan);

  const { users, connections, queues } = newPlan;
  return (
    <Grid item xs={12} sm={6}>
      <Typography variant="h6" gutterBottom className={classes.title}>
        {i18n.t("finalTouches.checkout.planDetails")}
      </Typography>
      <Typography gutterBottom>{i18n.t("finalTouches.checkout.users")}: {users}</Typography>
      <Typography gutterBottom>{i18n.t("finalTouches.checkout.connections")}: {connections}</Typography>
      <Typography gutterBottom>{i18n.t("finalTouches.checkout.queues")}: {queues}</Typography>
      <Typography gutterBottom>{i18n.t("finalTouches.checkout.billing")}: {i18n.t("finalTouches.checkout.monthly")}</Typography>
    </Grid>
  );
}

export default PaymentDetails;
