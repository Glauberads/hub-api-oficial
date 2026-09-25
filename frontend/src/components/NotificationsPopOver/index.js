import React, { useState, useRef, useEffect, useContext, useMemo } from "react";
import { useTheme } from "@material-ui/core/styles";

import { useHistory } from "react-router-dom";
import { format } from "date-fns";
// import { SocketContext } from "../../context/Socket/SocketContext";

import useSound from "use-sound";

import Popover from "@material-ui/core/Popover";
import IconButton from "@material-ui/core/IconButton";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import { makeStyles } from "@material-ui/core/styles";
import Badge from "@material-ui/core/Badge";
import ChatIcon from "@material-ui/icons/Chat";

import TicketListItem from "../TicketListItem";
import useTickets from "../../hooks/useTickets";
import alertSound from "../../assets/sound.mp3";
import { AuthContext } from "../../context/Auth/AuthContext";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import { subscribeToPush } from "../../services/pushNotification";
import useCompanySettings from "../../hooks/useSettings/companySettings";
import Favicon from "react-favicon";
import { getBackendUrl } from "../../config";
import { TicketsContext } from "../../context/Tickets/TicketsContext";

const defaultLogoFavicon = "/favicon.ico";

const useStyles = makeStyles(theme => ({
	tabContainer: {
		overflowY: "auto",
		maxHeight: 350,
		...theme.scrollbarStyles,
	},
	popoverPaper: {
		width: "100%",
		maxWidth: 350,
		marginLeft: theme.spacing(2),
		marginRight: theme.spacing(1),
		[theme.breakpoints.down("sm")]: {
			maxWidth: 270,
		},
	},
	noShadow: {
		boxShadow: "none !important",
	},
}));

const NotificationsPopOver = (volume) => {
	const classes = useStyles();
	const theme = useTheme();

	const history = useHistory();
	// const socketManager = useContext(SocketContext);
	const { user, socket } = useContext(AuthContext);
	const { profile, queues } = user;

	const ticketIdUrl = +history.location.pathname.split("/")[2];
	const ticketIdRef = useRef(ticketIdUrl);
	const anchorEl = useRef();
	const [isOpen, setIsOpen] = useState(false);
	const [notifications, setNotifications] = useState([]);
	const queueIds = useMemo(() => queues.map((q) => q.id), [queues]);
	const { get: getSetting } = useCompanySettings();
    const { setCurrentTicket, setTabOpen } = useContext(TicketsContext);

	const [showTicketWithoutQueue, setShowTicketWithoutQueue] = useState(false);
	const [showNotificationPending, setShowNotificationPending] = useState(false);
	const [showGroupNotification, setShowGroupNotification] = useState(false);

	const [, setDesktopNotifications] = useState([]);

	const { tickets } = useTickets({
		withUnreadMessages: "true"
		// showAll: showTicketWithoutQueue ? "true" : "false"
	});

	const [play] = useSound(alertSound, volume);
        const soundAlertRef = useRef();

        const safePlayNotificationSound = () => {
                try {
                        if (typeof soundAlertRef.current === "function") {
                                soundAlertRef.current();
                        }
                } catch (error) {
                        console.warn("[NotificationsPopOver] erro ao tocar som:", error);
                }
        };

        const historyRef = useRef(history);

	useEffect(() => {
		const fetchSettings = async () => {
			try {
				const setting = await getSetting(
					{
						"column": "showNotificationPending"
					}
				);



				if (setting.showNotificationPending === true) {
					setShowNotificationPending(true);
				}

				if (user.allTicket === "enable") {
					setShowTicketWithoutQueue(true);
				}
				if (user.allowGroup === true) {
					setShowGroupNotification(true);
				}
			} catch (err) {
				toastError(err);
			}
		}

		fetchSettings();
	}, [setShowTicketWithoutQueue, setShowNotificationPending]);

	useEffect(() => {
		soundAlertRef.current = play;

		if (!("Notification" in window)) {
			console.log("This browser doesn't support notifications");
		} else {
			Notification.requestPermission().then((permission) => {
				if (permission === "granted") {
					// Subscribir automaticamente ao push quando permissão concedida
					subscribeToPush().catch(err => console.error("[PUSH] Erro ao subscribir:", err));
				}
			});
		}
	}, [play]);

	useEffect(() => {
		const processNotifications = () => {
			// Obter conexões vinculadas ao usuário
			const userWhatsappIds = (user?.whatsapps || []).map(w => w.id);
			const allowedWhatsappIds = userWhatsappIds.length > 0
				? userWhatsappIds
				: (user?.whatsappId ? [user.whatsappId] : []);

			const filtered = tickets.filter(ticket => {
				const isGroup = ticket.isGroup || ticket.status === "group";

				if (isGroup) {
					if (!showGroupNotification) return false;
				}

				// Filtrar pela conexão vinculada ao usuário (se houver conexões vinculadas)
				if (allowedWhatsappIds.length > 0 && ticket.whatsappId) {
					if (!allowedWhatsappIds.includes(ticket.whatsappId)) return false;
				}

				// Filtrar pela fila do usuário
				if (ticket.queueId) {
					if (!queueIds.includes(ticket.queueId)) return false;
				}

				return true;
			});
			setNotifications(filtered);
		}

		processNotifications();
	}, [tickets, user, showGroupNotification, queueIds]);

	useEffect(() => {
		ticketIdRef.current = ticketIdUrl;
	}, [ticketIdUrl]);

	useEffect(() => {
		const companyId = user.companyId;
		// const socket = socketManager.GetSocket();
		if (user.id && socket) {
			const queueIds = queues.map((q) => q.id);

			const onConnectNotificationsPopover = () => {
				socket.emit("joinNotification");
			}

			const onCompanyTicketNotificationsPopover = (data) => {
				if (data.action === "updateUnread" || data.action === "delete") {
					setNotifications(prevState => {
						const ticketIndex = prevState.findIndex(t => t.id === data.ticketId);
						if (ticketIndex !== -1) {
							prevState.splice(ticketIndex, 1);
							return [...prevState];
						}
						return prevState;
					});

					setDesktopNotifications(prevState => {
						const notfiticationIndex = prevState.findIndex(
							n => n.tag === String(data.ticketId)
						);
						if (notfiticationIndex !== -1) {
							prevState[notfiticationIndex].close();
							prevState.splice(notfiticationIndex, 1);
							return [...prevState];
						}
						return prevState;
					});
				}
			};


const onCompanyAppMessageNotificationsPopover = (data) => {
                                if (data.action !== "create" || data.message?.fromMe) return;

                                const isTelegramTicket =
                                        data.ticket?.channel === "telegram" ||
                                        data.ticket?.whatsapp?.channel === "telegram" ||
                                        data.ticket?.contact?.channel === "telegram" ||
                                        data.contact?.channel === "telegram" ||
                                        String(data.message?.wid || "").startsWith("telegram-") ||
                                        String(data.message?.wid || "").startsWith("telegram_personal-") ||
                                        String(data.message?.wid || "").startsWith("telegram-personal-");

                                if (isTelegramTicket) {
                                        safePlayNotificationSound();
                                        data.__telegramSoundPlayed = true;
                                }

                                if (data.message?.read && !isTelegramTicket) return;

                                const userWhatsappIds = (user?.whatsapps || []).map(w => w.id);
                                const allowedWhatsappIds = userWhatsappIds.length > 0
                                        ? userWhatsappIds
                                        : (user?.whatsappId ? [user.whatsappId] : []);

                                if (allowedWhatsappIds.length > 0 && data.ticket?.whatsappId) {
                                        if (!allowedWhatsappIds.includes(data.ticket.whatsappId)) return;
                                }

                                const isGroupTicket = data.ticket?.isGroup || data.ticket?.status === "group";

                                if (isGroupTicket && !showGroupNotification) return;
                                if (isGroupTicket && data.ticket?.whatsapp?.groupAsTicket !== "enabled") return;

                                if (data.ticket?.userId && data.ticket.userId !== user?.id) return;

                                const ticketQueueId = data.ticket?.queueId;
                                if (ticketQueueId) {
                                        if (!queueIds.includes(ticketQueueId)) return;
                                } else if (!showTicketWithoutQueue && !isTelegramTicket) {
                                        return;
                                }

                                if (!isGroupTicket && ["pending", "lgpd", "nps"].includes(data.ticket?.status)) {
                                        if (data.ticket?.status === "pending" && !showNotificationPending && !isTelegramTicket) return;
                                        if (data.ticket?.status !== "pending") return;
                                }

                                const shouldBlurMessages =
                                        data.ticket.status === "pending" &&
                                        user.allowSeeMessagesInPendingTickets === "disabled";

                                const ticketToAdd = shouldBlurMessages
                                        ? {
                                                ...data.ticket,
                                                lastMessage: i18n.t("notifications.messageHidden")
                                        }
                                        : data.ticket;

                                setNotifications(prevState => {
                                        const ticketIndex = prevState.findIndex(t => t.id === ticketToAdd.id);
                                        if (ticketIndex !== -1) {
                                                prevState[ticketIndex] = ticketToAdd;
                                                return [...prevState];
                                        }
                                        return [ticketToAdd, ...prevState];
                                });

                                const shouldNotNotificate =
                                        (data.message.ticketId === ticketIdRef.current &&
                                                document.visibilityState === "visible") ||
                                        (data.ticket.userId && data.ticket.userId !== user?.id) ||
                                        (data.ticket.isGroup &&
                                                data.ticket?.whatsapp?.groupAsTicket === "disabled" &&
                                                showGroupNotification === false);

                                if (shouldNotNotificate === true) return;

                                const messageBody = shouldBlurMessages
                                        ? i18n.t("notifications.messageHidden")
                                        : data.message.body;

                                handleNotifications({
                                        ...data,
                                        message: {
                                                ...data.message,
                                                body: messageBody
                                        }
                                });
                        };

                        socket.on("connect", onConnectNotificationsPopover);
			socket.on(`company-${companyId}-ticket`, onCompanyTicketNotificationsPopover);
			socket.on(`company-${companyId}-appMessage`, onCompanyAppMessageNotificationsPopover);

			return () => {
				socket.off("connect", onConnectNotificationsPopover);
				socket.off(`company-${companyId}-ticket`, onCompanyTicketNotificationsPopover);
				socket.off(`company-${companyId}-appMessage`, onCompanyAppMessageNotificationsPopover);
			};
		}
		return undefined;
	}, [user, profile, queues, showTicketWithoutQueue, socket, showNotificationPending, showGroupNotification]);

	const handleNotifications = data => {
                const { message, ticket } = data;
                const contact = data.contact || data.ticket?.contact || {};
                const contactName = contact?.name || ticket?.contact?.name || "Contato";
                const contactIcon =
                        contact?.profilePicUrl ||
                        contact?.urlPicture ||
                        ticket?.contact?.profilePicUrl ||
                        ticket?.contact?.urlPicture ||
                        "";

                if (!("Notification" in window) || Notification.permission !== "granted") {
                        if (!data.__telegramSoundPlayed) {
                                safePlayNotificationSound();
                        }
                        return;
                }

                const options = {
                        body: `${message.body} - ${format(new Date(), "HH:mm")}`,
                        icon: contactIcon,
                        tag: ticket.id,
                        renotify: true,
                };

                const notification = new Notification(
                        `${i18n.t("tickets.notification.message")} ${contactName}`,
                        options
                );

                notification.onclick = e => {
                        e.preventDefault();
                        window.focus();
                        setTabOpen(ticket.status);
                        historyRef.current.push(`/tickets/${ticket.uuid}`);
                };

                setDesktopNotifications(prevState => {
                        const notfiticationIndex = prevState.findIndex(
                                n => n.tag === notification.tag
                        );
                        if (notfiticationIndex !== -1) {
                                prevState[notfiticationIndex] = notification;
                                return [...prevState];
                        }
                        return [notification, ...prevState];
                });

                if (!data.__telegramSoundPlayed) {
                        safePlayNotificationSound();
                }
        };

        const handleClick = () => {
		setIsOpen(prevState => !prevState);
	};

	const handleClickAway = () => {
		setIsOpen(false);
	};

	const NotificationTicket = ({ children }) => {
		return <div onClick={handleClickAway}>{children}</div>;
	};

	const browserNotification = () => {
		const numbers = "⓿➊➋➌➍➎➏➐➑➒➓⓫⓬⓭⓮⓯⓰⓱⓲⓳⓴";
		if (notifications.length > 0) {
			if (notifications.length < 21) {
				document.title = numbers.substring(notifications.length, notifications.length + 1) + " - " + (theme.appName || "...");
			} else {
				document.title = "(" + notifications.length + ")" + (theme.appName || "...");
			}
		} else {
			document.title = theme.appName || "...";
		}
		return (
			<>
				<Favicon
					animated={true}
					url={(theme?.appLogoFavicon) ? theme.appLogoFavicon : defaultLogoFavicon}
					alertCount={notifications.length}
					iconSize={195}
				/>
			</>
		);
	};

	return (
		<>
			{browserNotification()}

			<IconButton
				onClick={handleClick}
				ref={anchorEl}
				aria-label="Open Notifications"
				color="inherit"
				style={{ color: "white" }}
			>
				<Badge overlap="rectangular" badgeContent={notifications.length} color="secondary">
					<ChatIcon />
				</Badge>
			</IconButton>
			<Popover
				disableScrollLock
				open={isOpen}
				anchorEl={anchorEl.current}
				anchorOrigin={{
					vertical: "bottom",
					horizontal: "right",
				}}
				transformOrigin={{
					vertical: "top",
					horizontal: "right",
				}}
				classes={{ paper: classes.popoverPaper }}
				onClose={handleClickAway}
			>
				<List dense className={classes.tabContainer}>
					{notifications.length === 0 ? (
						<ListItem>
							<ListItemText>{i18n.t("notifications.noTickets")}</ListItemText>
						</ListItem>
					) : (
						notifications.map(ticket => (
							<NotificationTicket key={ticket.id}>
								<TicketListItem ticket={ticket} />
							</NotificationTicket>
						))
					)}
				</List>
			</Popover>
		</>
	);
};

export default NotificationsPopOver;