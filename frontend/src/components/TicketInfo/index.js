import React, { useState, useContext, useEffect, useRef } from "react";
import { i18n } from "../../translate/i18n";
import {
    Avatar,
    CardHeader,
    Dialog,
    DialogContent,
    Typography,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { AuthContext } from "../../context/Auth/AuthContext";
import { getContactAvatarUrl } from "../../utils/getContactAvatarUrl";

const useStyles = makeStyles((theme) => ({
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
    },
    ticketInfoContainer: {
        display: "flex",
        alignItems: "center",
        overflow: "hidden",
        flexShrink: 1,
        minWidth: 0,
        flex: 1,
        "& .MuiCardHeader-root": {
            padding: "6px 8px",
            overflow: "hidden",
            width: "100%",
        },
        "& .MuiCardHeader-content": {
            overflow: "hidden",
            minWidth: 0,
        },
        "& .MuiCardHeader-title": {
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            fontSize: "0.95rem",
            maxWidth: "100%",
            display: "block",
        },
        "& .MuiCardHeader-subheader": {
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            fontSize: "0.75rem",
            maxWidth: "100%",
            display: "block",
        },
    },
    typingIndicator: {
        color: "#25D366",
        fontSize: "0.75rem",
        fontStyle: "italic",
        animation: "$blink 1.4s infinite",
        marginTop: -2,
    },
    "@keyframes blink": {
        "0%, 100%": { opacity: 1 },
        "50%": { opacity: 0.4 },
    },
}));

const TicketInfo = ({ contact, ticket, onClick, presenceState }) => {
    const classes = useStyles();
    const [amount, setAmount] = useState("");
    const { user } = useContext(AuthContext);
    const [imageModalOpen, setImageModalOpen] = useState(false);

    const avatarSrc = getContactAvatarUrl(contact, ticket?.companyId || user?.companyId);

    const handleImageClick = (e) => {
        e.stopPropagation();
        if (avatarSrc) {
            setImageModalOpen(true);
        }
    };

    const handleImageModalClose = () => {
        setImageModalOpen(false);
    };

    const getPresenceLabel = () => {
        switch (presenceState) {
            case "composing": return "digitando...";
            case "recording": return "gravando áudio...";
            default: return null;
        }
    };

    const presenceLabel = getPresenceLabel();

    const buildSubheader = () => {
        const parts = [
            ticket?.user && `${i18n.t("messagesList.header.assignedTo")} ${ticket?.user?.name}`,
            contact?.contactWallets && contact.contactWallets.length > 0
                ? `• ${i18n.t("wallets.wallet")}: ${contact.contactWallets[0].wallet?.name || 'N/A'}`
                : null
        ].filter(Boolean).join(' ');

        if (presenceLabel) {
            return (
                <span>
                    {parts && <>{parts} · </>}
                    <span className={classes.typingIndicator}>{presenceLabel}</span>
                </span>
            );
        }
        return parts;
    };

    const renderCardReader = () => {
        return (
            <CardHeader
                onClick={onClick}
                style={{ cursor: "pointer" }}
                titleTypographyProps={{ noWrap: true }}
                subheaderTypographyProps={{ noWrap: true }}
                avatar={
                    <Avatar
                        src={avatarSrc || undefined}
                        alt="contact_image"
                        className={classes.clickableAvatar}
                        onClick={handleImageClick}
                        style={{
                            backgroundColor: !avatarSrc ? "#3f51b5" : undefined,
                            color: "#fff",
                            fontWeight: "bold"
                        }}
                    >
                        {!avatarSrc && contact?.name
                            ? contact.name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join('')
                            : null}
                    </Avatar>
                }
                title={`${contact?.name || '(sem contato)'} #${ticket?.id}`}
                subheader={buildSubheader()}
            />
        );
    }

    const handleChange = (event) => {
        const value = event.target.value;
        setAmount(value);
    }

    return (
        <React.Fragment>
            <div className={classes.ticketInfoContainer}>
                {renderCardReader()}
            </div>

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
                        alt={contact?.name || "Foto do contato"}
                        className={classes.expandedImage}
                    />
                </DialogContent>
            </Dialog>
        </React.Fragment>
    );
};

export default TicketInfo;