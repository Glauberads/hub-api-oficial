import React, { useState, useEffect, useRef, useContext } from "react";

import { useHistory, useParams } from "react-router-dom";
import { parseISO, format, isSameDay } from "date-fns";
import clsx from "clsx";
import emojiRegex from "emoji-regex";
import { v4 as uuidv4 } from "uuid";

import { makeStyles, withStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import ListItemAvatar from "@material-ui/core/ListItemAvatar";
import Typography from "@material-ui/core/Typography";
import Avatar from "@material-ui/core/Avatar";
import Divider from "@material-ui/core/Divider";
import Badge from "@material-ui/core/Badge";
import IconButton from "@material-ui/core/IconButton";
import { i18n } from "../../translate/i18n";
import VisibilityIcon from "@material-ui/icons/Visibility";
import CheckIcon from "@material-ui/icons/CheckCircle";
import ReplayIcon from "@material-ui/icons/Replay";
import ClearOutlinedIcon from "@material-ui/icons/ClearOutlined";
import api from "../../services/api";
import { Dialog, DialogContent } from "@material-ui/core";

import MarkdownWrapper from "../MarkdownWrapper";
import { Tooltip } from "@material-ui/core";
import { AuthContext } from "../../context/Auth/AuthContext";
import toastError from "../../errors/toastError";

import facebookIcon from "../../assets/facebook.png";
import insatagramIcon from "../../assets/instagram.png";
import whatsappIcon from "../../assets/whatsapp.png";
import { TicketsContext } from "../../context/Tickets/TicketsContext";
import { getContactAvatarUrl } from "../../utils/getContactAvatarUrl";

const useStyles = makeStyles((theme) => ({
    ticket: {
        position: "relative",
        alignItems: "flex-start",
        paddingTop: 10,
        paddingBottom: 10,
        paddingRight: 108,
        [theme.breakpoints.down("sm")]: {
            paddingTop: 10,
            paddingBottom: 10,
            paddingRight: 108,
            minHeight: 88,
        },
    },

    pendingTicket: {
        cursor: "unset",
    },

    noTicketsDiv: {
        display: "flex",
        height: "100px",
        margin: 40,
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
    },

    noTicketsText: {
        textAlign: "center",
        color: "rgb(104, 121, 146)",
        fontSize: "14px",
        lineHeight: "1.4",
    },

    noTicketsTitle: {
        textAlign: "center",
        fontSize: "16px",
        fontWeight: "600",
        margin: "0px",
    },

    listItemTextRoot: {
        flex: 1,
        minWidth: 0,
        width: "100%",
        marginTop: 0,
        marginBottom: 0,
        paddingRight: 0,
    },

    contactNameWrapper: {
        display: "flex",
        flexDirection: "column",
        width: "100%",
        minWidth: 0,
        paddingRight: 0,
    },

    titleRow: {
        display: "flex",
        alignItems: "center",
        gap: 6,
        minWidth: 0,
        width: "100%",
    },

    contactNameText: {
        minWidth: 0,
        maxWidth: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        fontWeight: 500,
        lineHeight: 1.3,
        fontSize: "0.98rem",
    },

    metaRow: {
        display: "flex",
        alignItems: "center",
        gap: 6,
        flexWrap: "wrap",
        minWidth: 0,
        marginTop: 4,
        paddingRight: 0,
    },

    lastMessageTime: {
        color: "#169c43",
        fontWeight: 700,
        fontSize: "0.82rem",
        lineHeight: 1,
        whiteSpace: "nowrap",
        textAlign: "center",
        marginBottom: 8,
    },

    closedBadge: {
        alignSelf: "center",
        justifySelf: "flex-end",
        marginRight: 32,
        marginLeft: "auto",
    },

    secondaryWrapper: {
        display: "flex",
        flexDirection: "column",
        width: "100%",
        minWidth: 0,
        marginTop: 4,
    },

    secondaryRow: {
        display: "flex",
        alignItems: "flex-start",
        width: "100%",
        minWidth: 0,
        paddingRight: 0,
    },

    ratingIcon: {
        flexShrink: 0,
        marginRight: theme.spacing(0.75),
        lineHeight: 1.4,
    },

    contactLastMessage: {
        flex: 1,
        minWidth: 0,
        maxWidth: "100%",
        color: theme.palette.text.primary,
        fontSize: "0.875rem",
        lineHeight: 1.35,
        overflow: "hidden",
        "& p, & div, & span": {
            margin: 0,
        },
        "& *": {
            maxWidth: "100%",
        },
        [theme.breakpoints.up("md")]: {
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
            overflow: "hidden",
        },
        [theme.breakpoints.down("sm")]: {
            display: "-webkit-box",
            WebkitLineClamp: 1,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            whiteSpace: "normal",
            wordBreak: "break-word",
            maxWidth: "calc(100% - 4px)",
        },
    },

    ticketQueueColor: {
        flex: "none",
        width: "8px",
        height: "100%",
        position: "absolute",
        top: "0%",
        left: "0%",
    },

    userTag: {
        position: "static",
        marginRight: 0,
        right: "auto",
        bottom: "auto",
        backgroundColor: theme.palette.background.default,
        color: theme.palette.primary.main,
        border: "1px solid #CCC",
        padding: "1px 6px",
        borderRadius: 10,
        fontSize: "0.75em",
        lineHeight: 1.4,
        maxWidth: "100%",
        whiteSpace: "nowrap",
    },

    divTags: {
        position: "static",
        marginRight: 0,
        left: "auto",
        bottom: "auto",
        flexWrap: "wrap",
        display: "flex",
        flexDirection: "row",
        justifyContent: "flex-start",
        alignItems: "center",
        gap: 4,
        marginTop: 6,
    },

    tags: {
        color: "#FFF",
        border: "1px solid #CCC",
        padding: "1px 6px",
        borderRadius: 4,
        fontSize: "0.65em",
        textAlign: "center",
        lineHeight: 1.4,
        fontWeight: 600,
    },

    divUser: {
        position: "absolute",
        marginRight: 0,
        left: 0,
        top: 0,
        flexWrap: "wrap",
        display: "flex",
        flexDirection: "row",
        justifyContent: "flex-start",
        alignItems: "center",
    },

    user: {
        color: "#eee",
        border: "1px solid #CCC",
        padding: 0,
        paddingLeft: 5,
        paddingRight: 5,
        borderRadius: 0,
        fontSize: "0.6em",
        textAlign: "center",
    },

    tagsWrapper: {
        zIndex: 500,
    },

    rightColumn: {
        position: "absolute",
        top: 10,
        right: 8,
        width: 84,
        minWidth: 84,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        zIndex: 2,
        [theme.breakpoints.down("sm")]: {
            width: 84,
            minWidth: 84,
            right: 6,
        },
    },

    unreadBubble: {
        minWidth: 32,
        height: 32,
        padding: "0 8px",
        borderRadius: 16,
        backgroundColor: green[500],
        color: "#fff",
        fontWeight: 700,
        fontSize: "0.95rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 8,
        boxSizing: "border-box",
    },

    unreadBubbleHidden: {
        height: 32,
        marginBottom: 8,
    },

    actionsRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        width: "100%",
    },

    bottomButton: {
        top: "auto",
        padding: 6,
        margin: 0,
    },

    blueAction: {
        color: "#0f73b8",
    },

    badgeStyle: {
        color: "white",
        backgroundColor: green[500],
    },

    acceptButton: {
        position: "absolute",
        left: "50%",
    },

    badge: {
        backgroundColor: "#44b700",
        color: "#44b700",
        boxShadow: `0 0 0 2px ${theme.palette.background.paper}`,
        "&::after": {
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            animation: "$ripple 1.2s infinite ease-in-out",
            border: "1px solid currentColor",
            content: '""',
        },
    },

    "@keyframes ripple": {
        "0%": {
            transform: "scale(.8)",
            opacity: 1,
        },
        "100%": {
            transform: "scale(2.4)",
            opacity: 0,
        },
    },

    imageModal: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },

    imageModalContent: {
        outline: "none",
        maxWidth: "90vw",
        maxHeight: "90vh",
    },

    expandedImage: {
        width: "100%",
        height: "auto",
        maxWidth: "500px",
        borderRadius: theme.spacing(1),
    },

    clickableAvatar: {
        cursor: "pointer",
        "&:hover": {
            opacity: 0.8,
        },
    }
}));

const SmallAvatar = withStyles((theme) => ({
    root: {
        width: 22,
        height: 22,
        border: `2px solid ${theme.palette.background.paper}`,
    },
}))(Avatar);

const getAvatarChannel = (channel) => {
    if (channel === "facebook") {
        return facebookIcon;
    }

    if (channel === "whatsapp") {
        return whatsappIcon;
    }

    if (channel === "whatsappapi") {
        return whatsappIcon;
    }

    if (channel === "instagram") {
        return insatagramIcon;
    }
};

const TicketListItem = ({ ticket }) => {
    const classes = useStyles();
    const history = useHistory();
    const [loading, setLoading] = useState(false);
    const { ticketId } = useParams();
    const isMounted = useRef(true);
    const { user } = useContext(AuthContext);
    const { setCurrentTicket, setTabOpen } = useContext(TicketsContext);
    const [imageModalOpen, setImageModalOpen] = useState(false);

    const avatarSrc = getContactAvatarUrl(ticket?.contact, user?.companyId);

    useEffect(() => {
        return () => {
            isMounted.current = false;
        };
    }, []);

    const handleImageClick = (e) => {
        e.stopPropagation();
        if (avatarSrc) {
            setImageModalOpen(true);
        }
    };

    const handleImageModalClose = () => {
        setImageModalOpen(false);
    };

    function getRatingIcon(rate) {
        let icon = "";
        if (rate === 1) {
            icon = "😡";
        } else if (rate === 2) {
            icon = "😠";
        } else if (rate === 3) {
            icon = "😐";
        } else if (rate === 4) {
            icon = "😃";
        } else if (rate === 5) {
            icon = "😍";
        }

        return icon;
    }

    const handleAcepptTicket = async (ticket) => {
        setLoading(true);
        try {
            await api.put(`/tickets/${ticket.id}`, {
                status: "open",
                userId: user?.id,
            });
        } catch (err) {
            setLoading(false);
            toastError(err);
        }
        if (isMounted.current) {
            setLoading(false);
        }
        history.push(`/tickets/${ticket.uuid}`);
    };

    const handleAcepptTicketBot = async (ticket) => {
        setLoading(true);
        try {
            await api.put(`/tickets/${ticket.id}`, {
                status: "open",
                userId: user?.id,
            });
        } catch (err) {
            setLoading(false);
            toastError(err);
        }
        if (isMounted.current) {
            setLoading(false);
        }
        history.push(`/tickets/${ticket.uuid}`);
    };

    const handleReopenTicket = async (ticket) => {
        setLoading(true);
        try {
            await api.put(`/tickets/${ticket.id}`, {
                status: "open",
                userId: user?.id,
            });
        } catch (err) {
            setLoading(false);
            toastError(err);
        }
        if (isMounted.current) {
            setLoading(false);
        }
        history.push(`/tickets/${ticket.uuid}`);
    };

    const handleViewTicket = async (ticket) => {
        setLoading(true);
        try {
            await api.put(`/tickets/${ticket.id}`, {
                status: "pending",
            });
        } catch (err) {
            setLoading(false);
            toastError(err);
        }
        if (isMounted.current) {
            setLoading(false);
        }
        history.push(`/tickets/${ticket.uuid}`);
    };

    const handleSelectTicket = (ticket) => {
        const code = uuidv4();
        const { id, uuid } = ticket;
        setTabOpen(ticket.status);
        setCurrentTicket({ id, uuid, code });
    };

    const handleClosedTicket = async (ticket) => {
        setLoading(true);
        try {
            await api.put(`/tickets/${ticket.id}`, {
                status: "closed",
            });
        } catch (err) {
            setLoading(false);
            toastError(err);
        }
        if (isMounted.current) {
            setLoading(false);
        }
    };

    const renderUserName = (name) => {
        let str = (name || "").replace(emojiRegex(), "").trim();
        const firstName = str.split(" ")[0];
        return firstName;
    };

    const formattedUpdatedAt = isSameDay(parseISO(ticket.updatedAt), new Date())
        ? format(parseISO(ticket.updatedAt), "HH:mm")
        : format(parseISO(ticket.updatedAt), "dd/MM/yyyy");

    return (
        <React.Fragment key={ticket.id}>
            <ListItem
                dense
                button
                onClick={() => {
                    handleSelectTicket(ticket);
                }}
                selected={ticketId && +ticketId === ticket.id}
                className={clsx(classes.ticket, {
                    [classes.pendingTicket]: ticket.status === "pending",
                })}
            >
                <Tooltip
                    arrow
                    placement="right"
                    title={ticket.queue?.name || "Sem departamento"}
                >
                    <span
                        style={{
                            backgroundColor: ticket.queue?.color || "#7C7C7C",
                        }}
                        className={classes.ticketQueueColor}
                    ></span>
                </Tooltip>

                <ListItemAvatar>
                    <Badge
                        overlap="circular"
                        anchorOrigin={{
                            vertical: "bottom",
                            horizontal: "right",
                        }}
                        badgeContent={
                            <SmallAvatar
                                alt={ticket?.channel}
                                src={getAvatarChannel(ticket?.channel)}
                            />
                        }
                    >
                        <Avatar
                            alt={ticket?.contact?.name}
                            src={avatarSrc || undefined}
                            className={classes.clickableAvatar}
                            onClick={handleImageClick}
                            style={{
                                backgroundColor: !avatarSrc ? "#3f51b5" : undefined,
                                color: "#fff",
                                fontWeight: "bold"
                            }}
                        >
                            {!avatarSrc && ticket?.contact?.name
                                ? ticket.contact.name
                                      .trim()
                                      .split(/\s+/)
                                      .slice(0, 2)
                                      .map((w) => w[0]?.toUpperCase())
                                      .join("")
                                : null}
                        </Avatar>
                    </Badge>
                </ListItemAvatar>

                <ListItemText
                    disableTypography
                    classes={{ root: classes.listItemTextRoot }}
                    primary={
                        <div className={classes.contactNameWrapper}>
                            <div className={classes.titleRow}>
                                <Typography
                                    className={classes.contactNameText}
                                    component="span"
                                    variant="body2"
                                    color="textPrimary"
                                >
                                    {ticket.contact.name}
                                </Typography>

                                {ticket.status === "open" && (
                                    <VisibilityIcon className={classes.blueAction} fontSize="small" />
                                )}
                            </div>

                            <div className={classes.metaRow}>
                                {ticket.whatsappId && (
                                    <div
                                        className={classes.userTag}
                                        title={i18n.t("i18nFix.connectionTitle")}
                                    >
                                        {ticket.whatsapp?.name}
                                    </div>
                                )}
                            </div>
                        </div>
                    }
                    secondary={
                        <div className={classes.secondaryWrapper}>
                            <div className={classes.secondaryRow}>
                                {ticket.status === "closed" && ticket?.userRating ? (
                                    <span className={classes.ratingIcon}>
                                        {getRatingIcon(ticket?.userRating?.rate)}
                                    </span>
                                ) : null}

                                <div className={classes.contactLastMessage}>
                                    {ticket.lastMessage ? (
                                        <MarkdownWrapper>
                                            {ticket.lastMessage}
                                        </MarkdownWrapper>
                                    ) : (
                                        <br />
                                    )}
                                </div>
                            </div>

                            <div className={classes.divTags}>
                                {ticket.isGroup && (
                                    <div className={classes.tagsWrapper}>
                                        <div
                                            key={ticket.id}
                                            className={classes.tags}
                                            style={{
                                                backgroundColor: "#7C7C7C",
                                            }}
                                        >
                                            Grupo
                                        </div>
                                    </div>
                                )}

                                {ticket.user?.id &&
                                    user.profile.toUpperCase() === "ADMIN" && (
                                        <div className={classes.tagsWrapper}>
                                            <div
                                                key={ticket.user.id}
                                                className={classes.tags}
                                                title={renderUserName(ticket.user.name)}
                                                style={{
                                                    backgroundColor:
                                                        ticket.user.color === "" || !ticket.user.color
                                                            ? "#7C7C7C"
                                                            : ticket.user.color,
                                                }}
                                            >
                                                {renderUserName(ticket.user.name)}
                                            </div>
                                        </div>
                                    )}

                                {ticket.tags?.length > 0 && (
                                    <>
                                        <div className={classes.tagsWrapper}>
                                            <div
                                                key={ticket.tags[0].id}
                                                className={classes.tags}
                                                title={ticket.tags[0].name}
                                                style={{
                                                    backgroundColor: ticket.tags[0].color,
                                                }}
                                            >
                                                {ticket.tags[0].name}
                                            </div>
                                        </div>

                                        {ticket.tags.length > 1 && (
                                            <div
                                                key={ticket.tags[1].id}
                                                className={classes.tags}
                                                title={ticket.tags[1].name}
                                                style={{
                                                    backgroundColor: ticket.tags[1].color,
                                                }}
                                            >
                                                +{ticket.tags.length - 1}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    }
                />

                <div className={classes.rightColumn}>
                    <Typography className={classes.lastMessageTime}>
                        {formattedUpdatedAt}
                    </Typography>

                    {ticket.unreadMessages > 0 ? (
                        <div className={classes.unreadBubble}>
                            {ticket.unreadMessages}
                        </div>
                    ) : (
                        <div className={classes.unreadBubbleHidden} />
                    )}

                    <div className={classes.actionsRow}>
                        {ticket.status === "pending" && (
                            <IconButton
                                className={classes.bottomButton}
                                color="primary"
                                loading={loading.toString()}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    ticket.isBot
                                        ? handleAcepptTicketBot(ticket)
                                        : handleAcepptTicket(ticket);
                                }}
                            >
                                <CheckIcon />
                            </IconButton>
                        )}

                        {ticket.status === "open" && (
                            <IconButton
                                className={classes.bottomButton}
                                color="primary"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleViewTicket(ticket);
                                }}
                            >
                                <ReplayIcon />
                            </IconButton>
                        )}

                        {ticket.status === "closed" && (
                            <IconButton
                                className={classes.bottomButton}
                                color="primary"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleReopenTicket(ticket);
                                }}
                            >
                                <ReplayIcon />
                            </IconButton>
                        )}

                        {(ticket.status === "pending" &&
                            (user.showDashboard === "enabled" || user.profile === "admin")) && (
                            <IconButton
                                className={classes.bottomButton}
                                color="primary"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleClosedTicket(ticket);
                                }}
                            >
                                <ClearOutlinedIcon />
                            </IconButton>
                        )}

                        {ticket.status === "open" && (
                            <IconButton
                                className={classes.bottomButton}
                                color="primary"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleClosedTicket(ticket);
                                }}
                            >
                                <ClearOutlinedIcon />
                            </IconButton>
                        )}

                        {ticket.status === "closed" && (
                            <IconButton
                                className={classes.bottomButton}
                                color="primary"
                                onClick={(e) => e.stopPropagation()}
                            ></IconButton>
                        )}
                    </div>
                </div>
            </ListItem>

            <Divider variant="inset" component="li" />

            <Dialog
                open={imageModalOpen}
                onClose={handleImageModalClose}
                className={classes.imageModal}
                maxWidth="md"
                fullWidth
            >
                <DialogContent className={classes.imageModalContent}>
                    <img
                        src={avatarSrc || undefined}
                        alt={ticket?.contact?.name || "Foto do contato"}
                        className={classes.expandedImage}
                    />
                </DialogContent>
            </Dialog>
        </React.Fragment>
    );
};

export default TicketListItem;
