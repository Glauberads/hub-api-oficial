import React, { useEffect, useState, useContext } from "react";
import { useHistory } from "react-router-dom";
import toastError from "../../errors/toastError";
import api from "../../services/api";

import Avatar from "@material-ui/core/Avatar";
import Typography from "@material-ui/core/Typography";
import Grid from "@material-ui/core/Grid";

import { AuthContext } from "../../context/Auth/AuthContext";

import { Button, Divider } from "@material-ui/core";
import { isNil } from "lodash";
import ShowTicketOpen from "../ShowTicketOpenModal";

const normalizePhone = value => {
  if (isNil(value)) return "";
  return String(value).replace(/\D/g, "");
};

const buildFallbackName = (name, number) => {
  const safeName = typeof name === "string" ? name.trim() : "";
  if (safeName) return safeName;

  const safeNumber = normalizePhone(number);
  if (safeNumber) return `Contato ${safeNumber}`;

  return "Contato compartilhado";
};

const parseSharedContact = (contact, numbers) => {
  const fallbackNumber = normalizePhone(numbers);
  const fallbackName = buildFallbackName(contact, fallbackNumber);

  if (typeof contact !== "string") {
    return {
      name: fallbackName,
      number: fallbackNumber
    };
  }

  const trimmed = contact.trim();

  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return {
      name: buildFallbackName(trimmed, fallbackNumber),
      number: fallbackNumber
    };
  }

  try {
    const parsed = JSON.parse(trimmed);
    const sharedContact = parsed?.contacts?.[0];

    const parsedName =
      sharedContact?.name?.formatted_name ||
      [
        sharedContact?.name?.first_name,
        sharedContact?.name?.middle_name,
        sharedContact?.name?.last_name
      ]
        .filter(Boolean)
        .join(" ")
        .trim();

    const parsedNumber =
      normalizePhone(sharedContact?.phones?.[0]?.wa_id) ||
      normalizePhone(sharedContact?.phones?.[0]?.phone) ||
      fallbackNumber;

    return {
      name: buildFallbackName(parsedName, parsedNumber),
      number: parsedNumber
    };
  } catch (error) {
    return {
      name: fallbackName,
      number: fallbackNumber
    };
  }
};

const getBackendBaseUrl = () => {
  const apiBase =
    api?.defaults?.baseURL ||
    process.env.REACT_APP_BACKEND_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");

  return String(apiBase)
    .replace(/\/+$/, "")
    .replace(/\/api$/, "");
};

const buildContactAvatarUrl = (contact, companyId) => {
  const urlPicture = String(contact?.urlPicture || "").trim();
  const profilePicUrl = String(contact?.profilePicUrl || "").trim();
  const backendBaseUrl = getBackendBaseUrl();

  if (urlPicture && urlPicture !== "nopicture.png") {
    if (/^https?:\/\//i.test(urlPicture)) {
      return urlPicture;
    }

    if (/^public\//i.test(urlPicture)) {
      return `${backendBaseUrl}/${urlPicture.replace(/^\/+/, "")}`;
    }

    if (/^company\d+\//i.test(urlPicture)) {
      return `${backendBaseUrl}/public/${urlPicture.replace(/^\/+/, "")}`;
    }

    if (urlPicture.includes("/contacts/")) {
      return `${backendBaseUrl}/${urlPicture.replace(/^\/+/, "")}`;
    }

    return `${backendBaseUrl}/public/company${companyId}/contacts/${urlPicture.replace(/^\/+/, "")}`;
  }

  if (profilePicUrl && !profilePicUrl.includes("nopicture.png")) {
    return profilePicUrl;
  }

  return undefined;
};

const VcardPreview = ({ contact, numbers, queueId, whatsappId, channel }) => {
  const history = useHistory();
  const { user } = useContext(AuthContext);

  const companyId = user.companyId;

  const [openAlert, setOpenAlert] = useState(false);
  const [userTicketOpen, setUserTicketOpen] = useState("");
  const [queueTicketOpen, setQueueTicketOpen] = useState("");
  const [loading, setLoading] = useState(false);

  const [selectedContact, setContact] = useState({
    id: 0,
    name: "",
    number: "",
    profilePicUrl: "",
    urlPicture: ""
  });

  const findExistingContact = async number => {
    const { data } = await api.get("/contacts", {
      params: {
        searchParam: number,
        pageNumber: 1
      }
    });

    const contacts = data?.contacts || [];

    const exactMatch = contacts.find(item => {
      const itemNumber = normalizePhone(item.number);
      return itemNumber === number;
    });

    return exactMatch || null;
  };

  const ensureLocalContact = async () => {
    const parsedShared = parseSharedContact(contact, numbers);
    const safeNumber = normalizePhone(parsedShared.number);
    const safeName = buildFallbackName(parsedShared.name, safeNumber);

    if (!safeNumber) {
      return null;
    }

    let existingContact = null;

    try {
      existingContact = await findExistingContact(safeNumber);
    } catch (err) {
      // ignora e tenta criar
    }

    if (existingContact) {
      const normalizedExisting = {
        id: existingContact.id || 0,
        name: existingContact.name || safeName,
        number: normalizePhone(existingContact.number || safeNumber),
        urlPicture: existingContact.urlPicture || "",
        profilePicUrl: existingContact.profilePicUrl || ""
      };

      setContact(normalizedExisting);
      return normalizedExisting;
    }

    const contactObj = {
      name: safeName,
      number: safeNumber,
      email: "",
      companyId
    };

    try {
      const { data } = await api.post("/contacts", contactObj);

      const created = {
        id: data.id || data.contactId || 0,
        name: data.name || safeName,
        number: normalizePhone(data.number || safeNumber),
        urlPicture: data.urlPicture || "",
        profilePicUrl: data.profilePicUrl || ""
      };

      setContact(created);
      return created;
    } catch (err) {
      try {
        const duplicated = await findExistingContact(safeNumber);

        if (duplicated) {
          const normalizedDuplicated = {
            id: duplicated.id || 0,
            name: duplicated.name || safeName,
            number: normalizePhone(duplicated.number || safeNumber),
            urlPicture: duplicated.urlPicture || "",
            profilePicUrl: duplicated.profilePicUrl || ""
          };

          setContact(normalizedDuplicated);
          return normalizedDuplicated;
        }
      } catch (searchErr) {
        // segue para erro original
      }

      throw err;
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      const fetchContacts = async () => {
        try {
          const ensured = await ensureLocalContact();

          if (!ensured) {
            const parsedShared = parseSharedContact(contact, numbers);
            setContact({
              id: 0,
              name: buildFallbackName(parsedShared.name, parsedShared.number),
              number: normalizePhone(parsedShared.number),
              profilePicUrl: "",
              urlPicture: ""
            });
          }
        } catch (err) {
          console.log(err);
          toastError(err);
        }
      };

      fetchContacts();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [companyId, contact, numbers]);

  const handleCloseAlert = () => {
    setOpenAlert(false);
    setUserTicketOpen("");
    setQueueTicketOpen("");
  };

  const handleNewChat = async () => {
    try {
      setLoading(true);

      let ensuredContact = selectedContact;

      if (!ensuredContact?.id) {
        ensuredContact = await ensureLocalContact();
      }

      if (!ensuredContact?.id) {
        setLoading(false);
        return;
      }

      const { data: ticket } = await api.post("/tickets", {
        contactId: ensuredContact.id,
        userId: user.id,
        status: "open",
        queueId,
        companyId: companyId,
        whatsappId
      });

      if (ticket?.uuid) {
        history.push(`/tickets/${ticket.uuid}`);
      } else if (ticket?.id) {
        history.push(`/tickets/${ticket.id}`);
      }
    } catch (err) {
      try {
        const ticket = JSON.parse(err.response.data.error);

        if (ticket.userId !== user?.id) {
          setOpenAlert(true);
          setUserTicketOpen(ticket?.user?.name);
          setQueueTicketOpen(ticket?.queue?.name);
        } else {
          setOpenAlert(false);
          setUserTicketOpen("");
          setQueueTicketOpen("");

          if (ticket?.uuid) {
            history.push(`/tickets/${ticket.uuid}`);
          } else if (ticket?.id) {
            history.push(`/tickets/${ticket.id}`);
          }
        }
      } catch (parseError) {
        toastError(err);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div
        style={{
          minWidth: "250px"
        }}
      >
        <ShowTicketOpen
          isOpen={openAlert}
          handleClose={handleCloseAlert}
          user={userTicketOpen}
          queue={queueTicketOpen}
        />
        <Grid container spacing={1}>
          <Grid item xs={2}>
            <Avatar
              src={buildContactAvatarUrl(selectedContact, companyId)}
            />
          </Grid>
          <Grid item xs={9}>
            <Typography
              style={{ marginTop: "12px", marginLeft: "10px" }}
              color="primary"
              variant="subtitle1"
              gutterBottom
            >
              {buildFallbackName(selectedContact.name, selectedContact.number)}
            </Typography>
          </Grid>
          <Grid item xs={12}>
            <Divider />
            <Button
              fullWidth
              color="primary"
              onClick={handleNewChat}
              disabled={!selectedContact.number || loading}
            >
              {loading ? "Abrindo..." : "Conversar"}
            </Button>
          </Grid>
        </Grid>
      </div>
    </>
  );
};

export default VcardPreview;