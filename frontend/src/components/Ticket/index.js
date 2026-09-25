import React, { useState, useEffect, useContext, useRef, useCallback, Suspense } from "react";
import { useParams, useHistory } from "react-router-dom";

import clsx from "clsx";

import { makeStyles, Paper, useMediaQuery, CircularProgress } from "@material-ui/core";
import { useTheme } from "@material-ui/core/styles";

import api from "../../services/api";
import { ReplyMessageProvider } from "../../context/ReplyingMessage/ReplyingMessageContext";
import { ForwardMessageProvider } from "../../context/ForwarMessage/ForwardMessageContext";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { TagsContainer } from "../TagsContainer";
import { isNil } from "lodash";
import { EditMessageProvider } from "../../context/EditingMessage/EditingMessageContext";
import { TicketsContext } from "../../context/Tickets/TicketsContext";

const ContactDrawer = React.lazy(() => import("../ContactDrawer"));
const MessageInput = React.lazy(() => import("../MessageInput/"));
const TicketHeader = React.lazy(() => import("../TicketHeader"));
const TicketInfo = React.lazy(() => import("../TicketInfo"));
const MessagesList = React.lazy(() => import("../MessagesList"));
const TicketActionButtons = React.lazy(() => import("../TicketActionButtonsCustom"));

const drawerWidth = 320;

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    height: "100%",
    position: "relative",
    overflow: "hidden",
  },

  mainWrapper: {
    flex: 1,
    height: "100%",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderLeft: "0",
    marginRight: -drawerWidth,
    transition: theme.transitions.create("margin", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
    [theme.breakpoints.down("md")]: {
      marginRight: 0,
    },
  },

  mainWrapperShift: {
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    transition: theme.transitions.create("margin", {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
    marginRight: 0,
    [theme.breakpoints.down("md")]: {
      marginRight: 0,
    },
  },
}));

const Ticket = () => {
  const { ticketId } = useParams();
  const history = useHistory();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const classes = useStyles();

  const { user, socket } = useContext(AuthContext);
  const { setTabOpen } = useContext(TicketsContext);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contact, setContact] = useState({});
  const [ticket, setTicket] = useState({});
  const [dragDropFiles, setDragDropFiles] = useState([]);
  const [presenceState, setPresenceState] = useState(null);
  const presenceTimeoutRef = useRef(null);
  const { companyId } = user;

  useEffect(() => {
    setLoading(true);

    const delayDebounceFn = setTimeout(() => {
      const fetchTicket = async () => {
        try {
          if (!isNil(ticketId) && ticketId !== "undefined") {
            const { data } = await api.get("/tickets/u/" + ticketId);

            setContact(data.contact || {});
            setTicket(data || {});

            const urlParams = new URLSearchParams(window.location.search);
            const tabParam = urlParams.get("tab");

            if (tabParam && ["pending", "open", "group", "closed"].includes(tabParam)) {
              setTimeout(() => {
                setTabOpen(tabParam);
              }, 200);
            } else {
              if (["pending", "open", "group"].includes(data.status)) {
                setTimeout(() => {
                  setTabOpen(data.status);
                }, 200);
              }
            }

            setLoading(false);
          }
        } catch (err) {
          history.push("/tickets");
          setLoading(false);
          toastError(err);
        }
      };

      fetchTicket();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [ticketId, history, setTabOpen]);

  useEffect(() => {
    if ((!ticket || !ticket.id) && ticketId === "undefined") {
      return;
    }

    if (user.companyId && socket) {
      const roomKey = String(ticket?.uuid || ticketId || "");

      const onConnectTicket = () => {
        if (roomKey) {
          socket.emit("joinChatBox", roomKey);
        }
      };

      const onCompanyTicket = (data) => {
        if (data.action === "update" && data.ticket.id === ticket?.id) {
          setTicket(data.ticket);
        }

        if (data.action === "delete" && data.ticketId === ticket?.id) {
          history.push("/tickets");
        }
      };

      const onCompanyContactTicket = (data) => {
        if (data.action === "update") {
          setContact((prevState) => {
            if (prevState.id === data.contact?.id) {
              return { ...prevState, ...data.contact };
            }
            return prevState;
          });
        }
      };

      const onPresenceUpdate = (data) => {
        if (data.ticketId === ticket?.id) {
          setPresenceState(
            data.presence === "composing" || data.presence === "recording"
              ? data.presence
              : null
          );

          if (data.presence === "composing" || data.presence === "recording") {
            clearTimeout(presenceTimeoutRef.current);
            presenceTimeoutRef.current = setTimeout(() => setPresenceState(null), 15000);
          }
        }
      };

      socket.on("connect", onConnectTicket);
      socket.on(`company-${companyId}-ticket`, onCompanyTicket);
      socket.on(`company-${companyId}-contact`, onCompanyContactTicket);
      socket.on(`company-${companyId}-presence`, onPresenceUpdate);

      if (roomKey) {
        socket.emit("joinChatBox", roomKey);
      }

      if (ticket?.id && ticket?.contact?.number && ticket?.whatsappId) {
        socket.emit("presenceSubscribe", {
          ticketId: ticket.id,
          contactNumber: ticket.contact.number,
          whatsappId: ticket.whatsappId,
          isGroup: ticket.isGroup,
        });
      }

      return () => {
        if (roomKey) {
          socket.emit("joinChatBoxLeave", roomKey);
        }
        socket.off("connect", onConnectTicket);
        socket.off(`company-${companyId}-ticket`, onCompanyTicket);
        socket.off(`company-${companyId}-contact`, onCompanyContactTicket);
        socket.off(`company-${companyId}-presence`, onPresenceUpdate);
        clearTimeout(presenceTimeoutRef.current);
      };
    }
  }, [ticketId, ticket, history, user.companyId, socket, companyId]);

  const handleDrawerOpen = useCallback(() => {
    setDrawerOpen(true);
  }, []);

  const handleDrawerClose = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  const handleQuickMessageSelect = (quickMessage) => {
    try {
      if (quickMessage.message) {
        const event = new CustomEvent("insertQuickMessage", {
          detail: { message: quickMessage.message }
        });
        window.dispatchEvent(event);
      }

      if (quickMessage.mediaPath) {
      }
    } catch (error) {
      console.error("Erro ao inserir resposta rápida:", error);
      toastError("Erro ao inserir resposta rápida");
    }
  };

  const renderMessagesList = () => {
    return (
      <>
        <Suspense fallback={<CircularProgress size={24} />}>
          <MessagesList
            isGroup={ticket.isGroup}
            onDrop={setDragDropFiles}
            whatsappId={ticket.whatsappId}
            queueId={ticket.queueId}
            channel={ticket.channel}
            ticketStatus={ticket.status}
            ticketDbId={ticket.id}
            ticketUuid={ticket.uuid || ticketId}
          />
        </Suspense>

        <Suspense fallback={<CircularProgress size={24} />}>
          <MessageInput
            ticketId={ticket.id}
            ticketStatus={ticket.status}
            ticketChannel={ticket.channel}
            droppedFiles={dragDropFiles}
            contactId={contact.id}
            whatsappId={ticket.whatsappId}
            isGroup={ticket.isGroup}
          />
        </Suspense>
      </>
    );
  };

  return (
    <div className={classes.root} id="drawer-container">
      <Paper
        variant="outlined"
        elevation={0}
        className={clsx(classes.mainWrapper, {
          [classes.mainWrapperShift]: drawerOpen && !isMobile,
        })}
      >
        <Suspense fallback={<CircularProgress size={24} />}>
          <TicketHeader loading={loading}>
            {ticket.contact !== undefined && (
              <div
                id="TicketHeader"
                style={{
                  overflow: "hidden",
                  flexShrink: 1,
                  minWidth: 0,
                  maxWidth: "calc(100% - 120px)"
                }}
              >
                <Suspense fallback={null}>
                  <TicketInfo
                    contact={contact}
                    ticket={ticket}
                    onClick={handleDrawerOpen}
                    presenceState={presenceState}
                  />
                </Suspense>
              </div>
            )}

            <Suspense fallback={<CircularProgress size={24} />}>
              <TicketActionButtons
                ticket={ticket}
                contact={contact}
                onQuickMessageSelect={handleQuickMessageSelect}
              />
            </Suspense>
          </TicketHeader>
        </Suspense>

        <Paper>
          <TagsContainer contact={contact} />
        </Paper>

        <ReplyMessageProvider>
          <ForwardMessageProvider>
            <EditMessageProvider>
              {renderMessagesList()}
            </EditMessageProvider>
          </ForwardMessageProvider>
        </ReplyMessageProvider>
      </Paper>

      <Suspense fallback={null}>
        <ContactDrawer
          open={drawerOpen}
          handleDrawerClose={handleDrawerClose}
          contact={contact}
          loading={loading}
          ticket={ticket}
        />
      </Suspense>
    </div>
  );
};

export default Ticket;