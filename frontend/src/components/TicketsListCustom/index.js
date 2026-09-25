import React, { useState, useEffect, useReducer, useContext, useMemo } from "react";

import { makeStyles } from "@material-ui/core/styles";
import List from "@material-ui/core/List";
import Paper from "@material-ui/core/Paper";

import TicketListItem from "../TicketListItemCustom";
import TicketsListSkeleton from "../TicketsListSkeleton";

import useTickets from "../../hooks/useTickets";
import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";

const useStyles = makeStyles((theme) => ({
    ticketsListWrapper: {
        position: "relative",
        display: "flex",
        height: "100%",
        flexDirection: "column",
        overflow: "hidden",
        borderTopRightRadius: 18,
        borderBottomRightRadius: 18,
        borderTopLeftRadius: 18,
        borderBottomLeftRadius: 18,
        background:
            theme.palette.type === "dark" || theme.palette.mode === "dark"
                ? "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)"
                : "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
        border: `1px solid ${theme.palette.divider}`,
        boxShadow:
            theme.palette.type === "dark" || theme.palette.mode === "dark"
                ? "0 10px 30px rgba(0,0,0,0.30)"
                : "0 10px 30px rgba(15, 23, 42, 0.08)",
        backdropFilter: "blur(6px)",
    },

    ticketsList: {
        flex: 1,
        maxHeight: "100%",
        overflowY: "auto",
        overflowX: "hidden",
        ...theme.scrollbarStyles,
        borderTop: "none",
        background: "transparent",
        scrollBehavior: "smooth",
        padding: theme.spacing(1),
        [theme.breakpoints.down("sm")]: {
            padding: theme.spacing(0.75),
        },
    },

    listContent: {
        paddingTop: 0,
        paddingBottom: theme.spacing(1),
    },

    ticketsListHeader: {
        color: "rgb(67, 83, 105)",
        zIndex: 2,
        backgroundColor:
            theme.palette.type === "dark" || theme.palette.mode === "dark"
                ? "rgba(255,255,255,0.02)"
                : "rgba(255,255,255,0.9)",
        borderBottom: `1px solid ${theme.palette.divider}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: theme.spacing(1.25, 1.5),
        backdropFilter: "blur(8px)",
    },

    ticketsCount: {
        fontWeight: 500,
        color: "rgb(104, 121, 146)",
        marginLeft: "8px",
        fontSize: "14px",
    },

    noTicketsText: {
        textAlign: "center",
        color: "rgb(104, 121, 146)",
        fontSize: "14px",
        lineHeight: "1.6",
        maxWidth: 280,
        margin: 0,
    },

    noTicketsTitle: {
        textAlign: "center",
        fontSize: "18px",
        fontWeight: 700,
        margin: "0 0 8px 0",
        color: theme.palette.text.primary,
    },

    noTicketsDiv: {
        display: "flex",
        margin: "56px 24px",
        padding: theme.spacing(4, 2),
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 18,
        border: `1px dashed ${theme.palette.divider}`,
        background:
            theme.palette.type === "dark" || theme.palette.mode === "dark"
                ? "rgba(255,255,255,0.02)"
                : "rgba(248, 250, 252, 0.95)",
        boxShadow:
            theme.palette.type === "dark" || theme.palette.mode === "dark"
                ? "inset 0 1px 0 rgba(255,255,255,0.02)"
                : "inset 0 1px 0 rgba(255,255,255,0.8)",
    },
}));

const ticketSortAsc = (a, b) => {
    if (a.updatedAt < b.updatedAt) {
        return -1;
    }
    if (a.updatedAt > b.updatedAt) {
        return 1;
    }
    return 0;
};

const ticketSortDesc = (a, b) => {
    if (a.updatedAt > b.updatedAt) {
        return -1;
    }
    if (a.updatedAt < b.updatedAt) {
        return 1;
    }
    return 0;
};

const reducer = (state, action) => {
    const sortDir = action.sortDir;

    if (action.type === "LOAD_TICKETS") {
        const newTickets = action.payload;

        newTickets.forEach((ticket) => {
            const ticketIndex = state.findIndex((t) => t.id === ticket.id);
            if (ticketIndex !== -1) {
                state[ticketIndex] = ticket;
                if (ticket.unreadMessages > 0) {
                    state.unshift(state.splice(ticketIndex, 1)[0]);
                }
            } else {
                state.push(ticket);
            }
        });

        if (sortDir && ["ASC", "DESC"].includes(sortDir)) {
            sortDir === "ASC" ? state.sort(ticketSortAsc) : state.sort(ticketSortDesc);
        }

        return [...state];
    }

    if (action.type === "RESET_UNREAD") {
        const ticketId = action.payload;

        const ticketIndex = state.findIndex((t) => t.id === ticketId);
        if (ticketIndex !== -1) {
            state[ticketIndex].unreadMessages = 0;
        }

        if (sortDir && ["ASC", "DESC"].includes(sortDir)) {
            sortDir === "ASC" ? state.sort(ticketSortAsc) : state.sort(ticketSortDesc);
        }

        return [...state];
    }

    if (action.type === "UPDATE_TICKET") {
        const ticket = action.payload;

        const ticketIndex = state.findIndex((t) => t.id === ticket.id);
        if (ticketIndex !== -1) {
            state[ticketIndex] = ticket;
        } else {
            state.unshift(ticket);
        }

        if (sortDir && ["ASC", "DESC"].includes(sortDir)) {
            sortDir === "ASC" ? state.sort(ticketSortAsc) : state.sort(ticketSortDesc);
        }

        return [...state];
    }

    if (action.type === "UPDATE_TICKET_UNREAD_MESSAGES") {
        const ticket = action.payload;

        const ticketIndex = state.findIndex((t) => t.id === ticket.id);
        if (ticketIndex !== -1) {
            state[ticketIndex] = ticket;
            state.unshift(state.splice(ticketIndex, 1)[0]);
        } else {
            if (action.status === action.payload.status) {
                state.unshift(ticket);
            }
        }

        if (sortDir && ["ASC", "DESC"].includes(sortDir)) {
            sortDir === "ASC" ? state.sort(ticketSortAsc) : state.sort(ticketSortDesc);
        }

        return [...state];
    }

    if (action.type === "UPDATE_TICKET_CONTACT") {
        const contact = action.payload;
        const ticketIndex = state.findIndex((t) => t.contactId === contact.id);
        if (ticketIndex !== -1) {
            state[ticketIndex].contact = contact;
        }
        return [...state];
    }

    if (action.type === "DELETE_TICKET") {
        const ticketId = action.payload;
        const ticketIndex = state.findIndex((t) => t.id === ticketId);
        if (ticketIndex !== -1) {
            state.splice(ticketIndex, 1);
        }

        if (sortDir && ["ASC", "DESC"].includes(sortDir)) {
            sortDir === "ASC" ? state.sort(ticketSortAsc) : state.sort(ticketSortDesc);
        }

        return [...state];
    }

    if (action.type === "RESET") {
        return [];
    }

    return state;
};

const TicketsListCustom = (props) => {
    const {
        setTabOpen,
        status,
        searchParam,
        searchOnMessages,
        tags,
        users,
        showAll,
        selectedQueueIds,
        updateCount,
        style,
        whatsappIds,
        forceSearch,
        statusFilter,
        userFilter,
        sortTickets
    } = props;

    const classes = useStyles();
    const [pageNumber, setPageNumber] = useState(1);
    let [ticketsList, dispatch] = useReducer(reducer, []);
    const { user, socket } = useContext(AuthContext);

    const { profile, queues } = user;
    const showTicketWithoutQueue = user.allTicket === "enable";
    const companyId = user.companyId;

    useEffect(() => {
        dispatch({ type: "RESET" });
        setPageNumber(1);
    }, [
        status,
        searchParam,
        dispatch,
        showAll,
        tags,
        users,
        forceSearch,
        selectedQueueIds,
        whatsappIds,
        statusFilter,
        sortTickets,
        searchOnMessages
    ]);

    const { tickets, hasMore, loading } = useTickets({
        pageNumber,
        searchParam,
        status,
        showAll,
        searchOnMessages: searchOnMessages ? "true" : "false",
        tags: JSON.stringify(tags),
        users: JSON.stringify(users),
        queueIds: JSON.stringify(selectedQueueIds),
        whatsappIds: JSON.stringify(whatsappIds),
        statusFilter: JSON.stringify(statusFilter),
        userFilter,
        sortTickets
    });

    useEffect(() => {
        if (companyId) {
            dispatch({
                type: "LOAD_TICKETS",
                payload: tickets,
                status,
                sortDir: sortTickets
            });
        }
    }, [tickets, companyId, status, sortTickets]);

    useEffect(() => {
        const shouldUpdateTicket = (ticket) => {
            const isGroupTicket = ticket?.status === "group" || ticket?.isGroup;

            if (isGroupTicket) {
                const userWhatsappIds = (user?.whatsapps || []).map((w) => w.id);
                if (userWhatsappIds.length === 0 && !user?.whatsappId) return false;

                const allowedIds = userWhatsappIds.length > 0
                    ? userWhatsappIds
                    : (user?.whatsappId ? [user.whatsappId] : []);

                if (!allowedIds.includes(ticket?.whatsappId)) return false;
            }

            const canSeeWithoutQueue = showTicketWithoutQueue || (isGroupTicket && user?.allowGroup);

            return (!ticket?.userId || ticket?.userId === user?.id || showAll) &&
                ((!ticket?.queueId && canSeeWithoutQueue) || selectedQueueIds.indexOf(ticket?.queueId) > -1);
        };

        const notBelongsToUserQueues = (ticket) =>
            ticket.queueId && selectedQueueIds.indexOf(ticket.queueId) === -1;

        const onCompanyTicketTicketsList = (data) => {
            if (data.action === "updateUnread") {
                dispatch({
                    type: "RESET_UNREAD",
                    payload: data.ticketId,
                    status: status,
                    sortDir: sortTickets
                });
            }

            if (
                data.action === "update" &&
                shouldUpdateTicket(data.ticket) &&
                data.ticket.status === status
            ) {
                dispatch({
                    type: "UPDATE_TICKET",
                    payload: data.ticket,
                    status: status,
                    sortDir: sortTickets
                });
            }

            if (data.action === "update" && notBelongsToUserQueues(data.ticket)) {
                dispatch({
                    type: "DELETE_TICKET",
                    payload: data.ticket?.id,
                    status: status,
                    sortDir: sortTickets
                });
            }

            if (data.action === "delete") {
                dispatch({
                    type: "DELETE_TICKET",
                    payload: data?.ticketId,
                    status: status,
                    sortDir: sortTickets
                });
            }
        };

        const onCompanyAppMessageTicketsList = (data) => {
            if (
                data.action === "create" &&
                shouldUpdateTicket(data.ticket) &&
                data.ticket.status === status
            ) {
                const updatedTicket = {
                    ...data.ticket,
                    lastMessage: data.message?.body || data.ticket.lastMessage,
                    updatedAt: new Date().toISOString(),
                };

                dispatch({
                    type: "UPDATE_TICKET_UNREAD_MESSAGES",
                    payload: updatedTicket,
                    status: status,
                    sortDir: sortTickets
                });
            }
        };

        const onCompanyContactTicketsList = (data) => {
            if (data.action === "update" && data.contact) {
                dispatch({
                    type: "UPDATE_TICKET_CONTACT",
                    payload: data.contact,
                    status: status,
                    sortDir: sortTickets
                });
            }
        };

        const onConnectTicketsList = () => {
            if (status) {
                socket.emit("joinTickets", status);
            } else {
                socket.emit("joinNotification");
            }
        };

        if (socket.connected) {
            onConnectTicketsList();
        }

        socket.on("connect", onConnectTicketsList);
        socket.on(`company-${companyId}-ticket`, onCompanyTicketTicketsList);
        socket.on(`company-${companyId}-appMessage`, onCompanyAppMessageTicketsList);
        socket.on(`company-${companyId}-contact`, onCompanyContactTicketsList);

        return () => {
            if (status) {
                socket.emit("leaveTickets", status);
            } else {
                socket.emit("leaveNotification");
            }
            socket.off("connect", onConnectTicketsList);
            socket.off(`company-${companyId}-ticket`, onCompanyTicketTicketsList);
            socket.off(`company-${companyId}-appMessage`, onCompanyAppMessageTicketsList);
            socket.off(`company-${companyId}-contact`, onCompanyContactTicketsList);
        };

    }, [
        status,
        showAll,
        user,
        selectedQueueIds,
        tags,
        users,
        profile,
        queues,
        sortTickets,
        showTicketWithoutQueue,
        socket,
        companyId
    ]);

    useEffect(() => {
        if (typeof updateCount === "function") {
            updateCount(ticketsList.length);
        }
    }, [ticketsList, updateCount]);

    const loadMore = () => {
        setPageNumber((prevState) => prevState + 1);
    };

    const handleScroll = (e) => {
        if (!hasMore || loading) return;

        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;

        if (scrollHeight - (scrollTop + 100) < clientHeight) {
            loadMore();
        }
    };

    const visibleTickets = useMemo(() => {
        if (status && status !== "search") {
            return ticketsList.filter((ticket) => ticket.status === status);
        }
        return ticketsList;
    }, [ticketsList, status]);

    return (
        <Paper className={classes.ticketsListWrapper} style={style} elevation={0}>
            <Paper
                square
                name="closed"
                elevation={0}
                className={classes.ticketsList}
                onScroll={handleScroll}
            >
                <List className={classes.listContent}>
                    {visibleTickets.length === 0 && !loading ? (
                        <div className={classes.noTicketsDiv}>
                            <span className={classes.noTicketsTitle}>
                                {i18n.t("ticketsList.noTicketsTitle")}
                            </span>
                            <p className={classes.noTicketsText}>
                                {i18n.t("ticketsList.noTicketsMessage")}
                            </p>
                        </div>
                    ) : (
                        <>
                            {visibleTickets.map((ticket) => (
                                <TicketListItem
                                    ticket={ticket}
                                    key={ticket.id}
                                    setTabOpen={setTabOpen}
                                />
                            ))}
                        </>
                    )}

                    {loading && <TicketsListSkeleton />}
                </List>
            </Paper>
        </Paper>
    );
};

export default TicketsListCustom;