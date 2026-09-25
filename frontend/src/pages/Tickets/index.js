import React, { Suspense } from "react";
import { useParams } from "react-router-dom";
import Grid from "@material-ui/core/Grid";
import Paper from "@material-ui/core/Paper";
import CircularProgress from "@material-ui/core/CircularProgress";
import { makeStyles } from "@material-ui/core/styles";
import { i18n } from "../../translate/i18n";
import { getBackendUrl } from "../../config";
import logo from "../../assets/logo1.png";
import logoDark from "../../assets/logo2.png";

import TicketsManagerTabs from "../../components/TicketsManagerTabs";

const Ticket = React.lazy(() => import("../../components/Ticket"));

const useStyles = makeStyles(theme => ({
	chatContainer: {
		flex: 1,
		// backgroundColor: "#eee",
		// padding: theme.spacing(4),
		padding: theme.padding,
		height: `calc(100% - 48px)`,
		overflowY: "hidden",
		// Ajuste para monitores pequenos (11-13 polegadas)
		'@media (max-width: 1366px)': {
			padding: theme.spacing(1),
		},
	},

	chatPapper: {
		// backgroundColor: "red",
		display: "flex",
		height: "100%",
	},

	contactsWrapper: {
		display: "flex",
		height: "100%",
		flexDirection: "column",
		overflowY: "hidden",
	},
	messagessWrapper: {
		display: "flex",
		height: "100%",
		flexDirection: "column",
	},
	welcomeMsg: {
		// backgroundColor: "#eee",
		background: theme.palette.background.default,
		display: "flex",
		justifyContent: "space-evenly",
		alignItems: "center",
		height: "100%",
		textAlign: "center",
	},
	logo: {
		logo: theme.logo,
		content: "url(" + ((theme.appLogoLight || theme.appLogoDark) ? getBackendUrl() + "/public/" + (theme.mode === "light" ? theme.appLogoLight || theme.appLogoDark : theme.appLogoDark || theme.appLogoLight) : (theme.mode === "light" ? logo : logoDark)) + ")"
	},
}));

const Chat = () => {
	const classes = useStyles();
	const { ticketId } = useParams();

	return (
		<div className={classes.chatContainer}>
			<div className={classes.chatPapper}>
				<Grid container spacing={0}>
					<Grid item xs={4} className={classes.contactsWrapper}>
						<TicketsManagerTabs />
					</Grid>
					<Grid item xs={8} className={classes.messagessWrapper}>
						{ticketId ? (
						<Suspense fallback={<CircularProgress size={24} />}>
							<Ticket />
						</Suspense>
						) : (
							<Paper square variant="outlined" className={classes.welcomeMsg}>
								<span>
									<center>
										<img className={classes.logo} width="50%" alt="" />
									</center>
									{i18n.t("chat.noTicketMessage")}
								</span>
							</Paper>
						)}
					</Grid>
				</Grid>
			</div>
		</div>
	);
};

export default Chat;
