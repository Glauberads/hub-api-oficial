import React, { useState, useEffect, useContext, Suspense } from "react";
import { useParams } from "react-router-dom";
import { makeStyles } from "@material-ui/core/styles";
import Button from '@material-ui/core/Button';
import Box from '@material-ui/core/Box';
import BottomNavigation from '@material-ui/core/BottomNavigation';
import BottomNavigationAction from '@material-ui/core/BottomNavigationAction';
import QuestionAnswerIcon from '@material-ui/icons/QuestionAnswer';
import ChatIcon from '@material-ui/icons/Chat';
import CircularProgress from '@material-ui/core/CircularProgress';

import TicketsManagerTabs from "../../components/TicketsManagerTabs/";
import TicketAdvancedLayout from "../../components/TicketAdvancedLayout";
import { TicketsContext } from "../../context/Tickets/TicketsContext";
import { i18n } from "../../translate/i18n";
import { QueueSelectedProvider } from "../../context/QueuesSelected/QueuesSelectedContext";

const Ticket = React.lazy(() => import("../../components/Ticket/"));

const useStyles = makeStyles(theme => ({
    header: {
    },
    content: {
        overflow: "auto"
    },
    placeholderContainer: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        // backgroundColor: "#eee"
        background: theme.palette.background.default,
    },
    placeholderItem: {
    }
}));

const TicketAdvanced = (props) => {
    const classes = useStyles();
    const { ticketId } = useParams();
    const [option, setOption] = useState(0);
    const { currentTicket, setCurrentTicket } = useContext(TicketsContext)

    useEffect(() => {
        if (currentTicket.id !== null) {
            setCurrentTicket({ id: currentTicket.id, code: '#open' })
        }
        if (!ticketId) {
            setOption(1)
        }
        return () => {
            setCurrentTicket({ id: null, code: null })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        if (currentTicket.id !== null) {
            setOption(0)
        }
    }, [currentTicket])

    const renderPlaceholder = () => {
        return <Box className={classes.placeholderContainer}>
            <div className={classes.placeholderItem}>{i18n.t("chat.noTicketMessage")}</div><br />
            <Button onClick={() => setOption(1)} variant="contained" color="primary">
                Selecionar Ticket
            </Button>
        </Box>
    }

    const renderMessageContext = () => {
        if (ticketId && ticketId !== "undefined") {
            return <Suspense fallback={<Box display="flex" justifyContent="center" alignItems="center" height="100%"><CircularProgress /></Box>}><Ticket /></Suspense>
        }
        return renderPlaceholder()
    }

    const renderTicketsManagerTabs = () => {
        return <TicketsManagerTabs
        />
    }

    return (
        <QueueSelectedProvider>

            <TicketAdvancedLayout>
                <Box className={classes.header}>
                    <BottomNavigation
                        value={option}
                        onChange={(event, newValue) => {
                            setOption(newValue);
                        }}
                        showLabels
                        className={classes.root}
                    >
                        <BottomNavigationAction label={i18n.t("reports.table.id")} icon={<ChatIcon />} />
                        <BottomNavigationAction label={i18n.t("mainDrawer.listItems.tickets")} icon={<QuestionAnswerIcon />} />
                    </BottomNavigation>
                </Box>
                <Box className={classes.content}>
                    {option === 0 ? renderMessageContext() : renderTicketsManagerTabs()}
                </Box>
            </TicketAdvancedLayout>
        </QueueSelectedProvider>
    );
};

export default TicketAdvanced;
