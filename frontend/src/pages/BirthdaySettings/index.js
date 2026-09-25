import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import { Paper } from "@material-ui/core";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import BirthdaySettings from "../../components/BirthdaySettings";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: 0,
    overflowY: "scroll",
    ...theme.scrollbarStyles,
  },
}));

const BirthdaySettingsPage = () => {
  const classes = useStyles();

  return (
    <MainContainer>
      <MainHeader>
        <Title>🎂 {i18n.t("birthday.title")}</Title>
      </MainHeader>
      <Paper className={classes.mainPaper} variant="outlined">
        <BirthdaySettings />
      </Paper>
    </MainContainer>
  );
};

export default BirthdaySettingsPage;
