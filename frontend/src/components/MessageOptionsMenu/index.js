import React, { useState, useContext } from "react";

import MenuItem from "@material-ui/core/MenuItem";
import Popover from "@material-ui/core/Popover";
import Typography from "@material-ui/core/Typography";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import ConfirmationModal from "../ConfirmationModal";
import { Menu } from "@material-ui/core";
import { ReplyMessageContext } from "../../context/ReplyingMessage/ReplyingMessageContext";
import { ForwardMessageContext } from "../../context/ForwarMessage/ForwardMessageContext";
import { EditMessageContext } from "../../context/EditingMessage/EditingMessageContext";

import { TicketsContext } from "../../context/Tickets/TicketsContext";
import toastError from "../../errors/toastError";
import { useHistory } from "react-router-dom";
import { AuthContext } from "../../context/Auth/AuthContext";
import ForwardModal from "../../components/ForwardMessageModal";
import ShowTicketOpen from "../ShowTicketOpenModal";
import AcceptTicketWithoutQueue from "../AcceptTicketWithoutQueueModal";

const REACTION_EMOJIS = [
  "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "🥲", "☺️", "😊", "😇", "🙂", "🙃", 
  "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛", "😝", "😜", "🤪", 
  "🤨", "🧐", "🤓", "😎", "🥸", "🤩", "🥳", "😏", "😒", "😞", "😔", "😟", "😕", 
  "🙁", "☹️", "😣", "😖", "😫", "😩", "🥺", "😭", "😤", "😠", "😡", "🤬", "🤯", 
  "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😓", "🤗", "🤔", "🫣", "🤭", "🤫", 
  "🤥", "😶", "😶‍🌫️", "😐", "😑", "😬", "🙄", "😯", "😦", "😧", "😲", "🥱", "😴", 
  "🤤", "😪", "😵", "😵‍💫", "🤐", "🥴", "🤢", "🤮", "🤧", "😷", "🤒", "🤕", "🤑", 
  "🤠", "😈", "👿", "👹", "👺", "🤡", "💩", "👻", "💀", "☠️", "👽", "👾", "🤖", 
  "🎃", "👐", "🤲", "🙌", "🤝", "🤛", "🤜", "🤞", "✌️", "🫰", "🤟", "🤘", "👌", 
  "🤌", "🤏", "👈", "👉", "👆", "👇", "☝️", "✋", "🤚", "🖐️", "🖖", "👋", "🤙", 
  "💪", "🦾", "🖕", "✍️", "🤳", "💅", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", 
  "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "✨", "⭐", 
  "🌟", "💫", "💥", "💯", "💢", "💬", "👁️‍🗨️", "🗨️", "🗯️", "💭", "💤", "🐵", "🐒", 
  "🦍", "🦧", "🐶", "🐕", "🦮", "🐕‍🦺", "🐩", "🐺", "🦊", "🦝", "🐱", "🐈", "🐈‍⬛", 
  "🦁", "🐯", "🐅", "🐆", "🐴", "🐎", "🦄", "🦓", "🦌", "🦬", "🐮", "🐂", "🐃", 
  "🐄", "🐷", "🐖", "🐗", "🐽", "🐏", "🐑", "🐐", "🐪", "🐫", "🦙", "🦒", "🐘", 
  "🦣", "🦏", "🦛", "🐭", "🐁", "🐀", "🐹", "🐰", "🐇", "🐿️", "🦫", "🦔", "🦇", 
  "🐻", "🐻‍❄️", "🐨", "🐼", "🦥", "🦦", "🦨", "🦘", "🦡", "🐾", "🦃", "🐔", "🐓", 
  "🐣", "🐤", "🐥", "🐦", "🐧", "🕊️", "🦅", "🦆", "🦢", "🦉", "🦤", "🪶", "🦩", 
  "🦚", "🦜", "🐸", "🐊", "🐢", "🦎", "🐍", "🐲", "🐉", "🦕", "🦖", "🐳", "🐋", 
  "🐬", "🦭", "🐟", "🐠", "🐡", "🦈", "🐙", "🐚", "🐌", "🦋", "🐛", "🐜", "🐝", 
  "🪲", "🐞", "🦗", "🪳", "🕷️", "🕸️", "🦂", "🦟", "🪰", "🪱", "🦠", "💐", "🌸", 
  "💮", "🪷", "🏵️", "🌹", "🥀", "🌺", "🌻", "🌼", "🌷", "🌱", "🪴", "🌲", "🌳", 
  "🌴", "🌵", "🌾", "🌿", "☘️", "🍀", "🍁", "🍂", "🍃", "🍇", "🍈", "🍉", "🍊", 
  "🍋", "🍌", "🍍", "🥭", "🍎", "🍏", "🍐", "🍑", "🍒", "🍓", "🫐", "🥝", "🍅", 
  "🫒", "🥥", "🥑", "🍆", "🥔", "🥕", "🌽", "🌶️", "🫑", "🥒", "🥬", "🥦", "🧄", 
  "🧅", "🍄", "🥜", "🌰", "🍞", "🥐", "🥖", "🫓", "🥨", "🥯", "🥞", "🧇", "🧀", 
  "🍖", "🍗", "🥩", "🥓", "🍔", "🍟", "🍕", "🌭", "🥪", "🌮", "🌯", "🫔", "🥙", 
  "🧆", "🥚", "🍳", "🥘", "🍲", "🫕", "🥣", "🥗", "🍿", "🧈", "🧂", "🥫", "🍱", 
  "🍘", "🍙", "🍚", "🍛", "🍜", "🍝", "🍠", "🍢", "🍣", "🍤", "🍥", "🥮", "🍡", 
  "🥟", "🥠", "🥡", "🦀", "🦞", "🦐", "🦑", "🦪", "🍦", "🍧", "🍨", "🍩", "🍪", 
  "🎂", "🍰", "🧁", "🥧", "🍫", "🍬", "🍭", "🍮", "🍯", "🍼", "🥛", "☕", "🫖", 
  "🍵", "🍶", "🍾", "🍷", "🍸", "🍹", "🍺", "🍻", "🥂", "🥃", "🥤", "🧋", "🧃"
];

const MessageOptionsMenu = ({
  message,
  menuOpen,
  handleClose,
  anchorEl,
  isGroup,
  queueId,
  whatsappId,
  onReactMessage,
  onDownloadMessage
}) => {
  const { setReplyingMessage } = useContext(ReplyMessageContext);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);
  const [reactionAnchorPosition, setReactionAnchorPosition] = useState(null);

  const { user } = useContext(AuthContext);
  const editingContext = useContext(EditMessageContext);
  const setEditingMessage = editingContext ? editingContext.setEditingMessage : null;
  const { setTabOpen } = useContext(TicketsContext);
  const history = useHistory();

  const [openAlert, setOpenAlert] = useState(false);
  const [userTicketOpen, setUserTicketOpen] = useState("");
  const [queueTicketOpen, setQueueTicketOpen] = useState("");
  const [acceptTicketWithouSelectQueueOpen, setAcceptTicketWithouSelectQueueOpen] = useState(false);

  const [ticketOpen, setTicketOpen] = useState(null);

  const {
    showSelectMessageCheckbox,
    setShowSelectMessageCheckbox,
    selectedMessages,
    forwardMessageModalOpen,
    setForwardMessageModalOpen
  } = useContext(ForwardMessageContext);

  const handleSaveTicket = async (contactId) => {
    if (!contactId) return;

    try {
      const { data: ticket } = await api.post("/tickets", {
        contactId: contactId,
        userId: user?.id,
        status: "open",
        queueId: queueId,
        whatsappId: whatsappId
      });

      setTicketOpen(ticket);
      if (ticket.queueId === null) {
        setAcceptTicketWithouSelectQueueOpen(true);
      } else {
        setTabOpen("open");
        history.push(`/tickets/${ticket.uuid}`);
      }
    } catch (err) {
      const ticket = JSON.parse(err.response.data.error);

      if (ticket.userId !== user?.id) {
        setOpenAlert(true);
        setUserTicketOpen(ticket.user.name);
        setQueueTicketOpen(ticket.queue.name);
      } else {
        setOpenAlert(false);
        setUserTicketOpen("");
        setQueueTicketOpen("");

        setTabOpen(ticket.status);
        history.push(`/tickets/${ticket.uuid}`);
      }
    }

    handleClose();
  };

  const handleCloseAlert = () => {
    setOpenAlert(false);
    setUserTicketOpen("");
    setQueueTicketOpen("");
  };

  const handleSetShowSelectCheckbox = () => {
    setShowSelectMessageCheckbox(!showSelectMessageCheckbox);
    handleClose();
  };

  const handleDeleteMessage = async () => {
    try {
      await api.delete(`/messages/${message.id}`);
    } catch (err) {
      toastError(err);
    }
  };

  const handleEditMessage = async () => {
    if (setEditingMessage) {
      setEditingMessage(message);
    }
    handleClose();
  };

  const hanldeReplyMessage = () => {
    setReplyingMessage(message);
    handleClose();
  };

  const isWithinFifteenMinutes = () => {
    const fifteenMinutesInMilliseconds = 15 * 60 * 1000;
    const currentTime = new Date();
    const messageTime = new Date(message.createdAt);

    return currentTime - messageTime <= fifteenMinutesInMilliseconds;
  };

  const handleOpenConfirmationModal = () => {
    setConfirmationOpen(true);
    handleClose();
  };

  const getDownloadName = () => {
    const body = String(message?.body || "").trim();
    const mediaUrl = String(message?.mediaUrl || "").trim();

    const urlName = mediaUrl
      ? mediaUrl.split("?")[0].split("#")[0].split("/").pop()
      : "";

    if (body && /\.[a-z0-9]{2,8}$/i.test(body)) {
      return body;
    }

    if (urlName) {
      return urlName;
    }

    if (body) {
      return body;
    }

    return "arquivo";
  };

  const canDownloadMessage = () => {
    if (!message?.id || !message?.mediaUrl || message?.isDeleted) {
      return false;
    }

    return true;
  };

  const handleDownloadMessage = async () => {
    try {
      if (!message?.id) return;

      if (typeof onDownloadMessage === "function") {
        await onDownloadMessage(message);
        handleClose();
        return;
      }

      const response = await api.get(`/messages/${message.id}/download`, {
        responseType: "blob"
      });

      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = getDownloadName();
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      window.URL.revokeObjectURL(url);
      handleClose();
    } catch (err) {
      toastError(err);
    }
  };

  const canReactMessage = () => {
    return !message?.isDeleted;
  };

  const handleOpenReactionPicker = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();

    setReactionAnchorPosition({
      top: rect.top + window.scrollY - 8,
      left: rect.right + window.scrollX + 8
    });

    setReactionPickerOpen(true);
    handleClose();
  };

  const handleCloseReactionPicker = () => {
    setReactionPickerOpen(false);
    setReactionAnchorPosition(null);
  };

  const handleSelectReaction = async (emoji) => {
    try {
      if (typeof onReactMessage === "function") {
        await onReactMessage(message, emoji);
      }
    } finally {
      handleCloseReactionPicker();
    }
  };

  return (
    <>
      <AcceptTicketWithoutQueue
        modalOpen={acceptTicketWithouSelectQueueOpen}
        onClose={(e) => setAcceptTicketWithouSelectQueueOpen(false)}
        ticket={ticketOpen}
        ticketId={ticketOpen?.id}
      />

      <ShowTicketOpen
        isOpen={openAlert}
        handleClose={handleCloseAlert}
        user={userTicketOpen}
        queue={queueTicketOpen}
      />

      <ConfirmationModal
        title={i18n.t("messageOptionsMenu.confirmationModal.title")}
        open={confirmationOpen}
        onClose={setConfirmationOpen}
        onConfirm={handleDeleteMessage}
      >
        {i18n.t("messageOptionsMenu.confirmationModal.message")}
      </ConfirmationModal>

      <ForwardModal
        modalOpen={forwardMessageModalOpen}
        messages={selectedMessages}
        onClose={(e) => {
          setForwardMessageModalOpen(false);
          setShowSelectMessageCheckbox(false);
        }}
      />

      <Menu
        anchorEl={anchorEl}
        getContentAnchorEl={null}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        open={menuOpen}
        onClose={handleClose}
      >
        {message.fromMe && (
          <MenuItem key="delete" onClick={handleOpenConfirmationModal}>
            {i18n.t("messageOptionsMenu.delete")}
          </MenuItem>
        )}

        {message.fromMe && isWithinFifteenMinutes() && (
          <MenuItem key="edit" onClick={handleEditMessage}>
            {i18n.t("messageOptionsMenu.edit")}
          </MenuItem>
        )}

        <MenuItem onClick={hanldeReplyMessage}>
          {i18n.t("messageOptionsMenu.reply")}
        </MenuItem>

        <MenuItem onClick={handleSetShowSelectCheckbox}>
          {i18n.t("messageOptionsMenu.forward")}
        </MenuItem>

        {canDownloadMessage() && (
          <MenuItem onClick={handleDownloadMessage}>
            Baixar
          </MenuItem>
        )}

        {canReactMessage() && (
          <MenuItem onClick={handleOpenReactionPicker}>
            Reagir
          </MenuItem>
        )}

        {!message.fromMe && isGroup && (
          <MenuItem onClick={() => handleSaveTicket(message?.contact?.id)}>
            {i18n.t("messageOptionsMenu.talkTo")}
          </MenuItem>
        )}
      </Menu>

      <Popover
        open={reactionPickerOpen}
        onClose={handleCloseReactionPicker}
        anchorReference="anchorPosition"
        anchorPosition={reactionAnchorPosition || { top: 0, left: 0 }}
        transformOrigin={{
          vertical: "top",
          horizontal: "left"
        }}
        PaperProps={{
          style: {
            borderRadius: 12,
            padding: 8,
            maxWidth: 320
          }
        }}
      >
        <div style={{ padding: 4 }}>
          <Typography
            variant="body2"
            style={{ fontWeight: 600, marginBottom: 8, paddingLeft: 4 }}
          >
            Escolha uma reação
          </Typography>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(8, 1fr)",
              gap: 6
            }}
          >
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleSelectReaction(emoji)}
                style={{
                  fontSize: 24,
                  width: 34,
                  height: 34,
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  borderRadius: 8
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = "rgba(0,0,0,0.08)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </Popover>
    </>
  );
};

export default MessageOptionsMenu;