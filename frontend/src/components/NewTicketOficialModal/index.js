import React, { useState, useEffect, useContext } from "react";
import { useHistory } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Typography from "@material-ui/core/Typography";
import Autocomplete, { createFilterOptions } from "@material-ui/lab/Autocomplete";
import CircularProgress from "@material-ui/core/CircularProgress";
import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import ButtonWithSpinner from "../ButtonWithSpinner";
import ContactModal from "../ContactModal";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { Grid, ListItemText, MenuItem, Select, Chip } from "@material-ui/core";
import { toast } from "react-toastify";
import { WhatsApp } from "@material-ui/icons";
import ShowTicketOpen from "../ShowTicketOpenModal";
import TemplateModal from "../TemplateMetaModal";

const useStyles = makeStyles((theme) => ({
  online: {
    fontSize: 11,
    color: "#25d366"
  },
  offline: {
    fontSize: 11,
    color: "#e1306c"
  }
}));

const filter = createFilterOptions({
  trim: true,
});

const NewTicketOficialModal = ({ modalOpen, onClose, initialContact }) => {
  const classes = useStyles();
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [selectedContact, setSelectedContact] = useState(null);
  const [selectedQueue, setSelectedQueue] = useState("");
  const [selectedWhatsapp, setSelectedWhatsapp] = useState("");
  const [newContact, setNewContact] = useState({});
  const [whatsapps, setWhatsapps] = useState([]);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const { user } = useContext(AuthContext);
  const { companyId } = user;

  const [openAlert, setOpenAlert] = useState(false);
  const [userTicketOpen, setUserTicketOpen] = useState("");
  const [queueTicketOpen, setQueueTicketOpen] = useState("");

  // Template modal
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [createdTicket, setCreatedTicket] = useState(null);

  useEffect(() => {
    if (initialContact?.id !== undefined) {
      setOptions([initialContact]);
      setSelectedContact(initialContact);
    }
  }, [initialContact]);

  // Buscar apenas conexões whatsapp_oficial
  const canSeeAllConnections = user.profile === "admin" || user.allowConnections === "enabled";

  useEffect(() => {
    if (!modalOpen) return;
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      api
        .get(`/whatsapp`, { params: { companyId, session: 0 } })
        .then(({ data }) => {
          let oficialWhatsapps = data.filter(w => w.channel === "whatsapp_oficial");
          if (!canSeeAllConnections) {
            const userWhatsappIds = (user.whatsapps || []).map(w => w.id);
            oficialWhatsapps = userWhatsappIds.length > 0
              ? oficialWhatsapps.filter(w => userWhatsappIds.includes(w.id))
              : (user.whatsappId ? oficialWhatsapps.filter(w => w.id === user.whatsappId) : []);
          }
          setWhatsapps(oficialWhatsapps);
          if (oficialWhatsapps.length === 1) {
            setSelectedWhatsapp(oficialWhatsapps[0].id);
          }
        });

      if (user.queues.length === 1) {
        setSelectedQueue(user.queues[0].id);
      }
      setLoading(false);
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [modalOpen]);

  // Buscar templates aprovados
  useEffect(() => {
    if (!modalOpen) return;
    const fetchTemplates = async () => {
      try {
        const { data } = await api.get("/quick-messages/list", {
          params: {
            isOficial: "true",
            userId: user.id,
            companyId: user.companyId,
            status: "APPROVED",
          },
        });
        setTemplates(data || []);
      } catch (err) {
        console.error("Erro ao buscar templates:", err);
      }
    };
    fetchTemplates();
  }, [modalOpen]);

  useEffect(() => {
    if (!modalOpen || searchParam.length < 3) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchContacts = async () => {
        try {
          const { data } = await api.get("contacts", {
            params: { searchParam },
          });
          setOptions(data.contacts);
          setLoading(false);
        } catch (err) {
          setLoading(false);
          toastError(err);
        }
      };
      fetchContacts();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchParam, modalOpen]);

  const handleClose = () => {
    onClose();
    setSearchParam("");
    setOpenAlert(false);
    setUserTicketOpen("");
    setQueueTicketOpen("");
    setSelectedContact(null);
    setTemplateModalOpen(false);
    setCreatedTicket(null);
  };

  const handleCloseAlert = () => {
    setOpenAlert(false);
    setLoading(false);
    setUserTicketOpen("");
    setQueueTicketOpen("");
  };

  const handleSaveTicket = async (contactId) => {
    if (!contactId) return;
    if (selectedQueue === "") {
      toast.error(i18n.t("transferTicketModal.fieldQueuePlaceholder"));
      return;
    }
    if (selectedWhatsapp === "") {
      toast.error("Selecione uma conexão oficial");
      return;
    }

    setLoading(true);
    try {
      const queueId = selectedQueue !== "" ? selectedQueue : null;
      const whatsappId = selectedWhatsapp !== "" ? selectedWhatsapp : null;
      const { data: ticket } = await api.post("/tickets", {
        contactId: contactId,
        queueId,
        whatsappId,
        userId: user.id,
        status: "open",
      });

      setCreatedTicket(ticket);
      // Abrir modal de template após criar o ticket
      setTemplateModalOpen(true);
    } catch (err) {
      setLoading(false);
      
      if (err.response?.status === 403) {
        const errorData = err.response.data;
        setOpenAlert(true);
        setUserTicketOpen(errorData.ticket?.user?.name || "Outro usuário");
        setQueueTicketOpen(errorData.ticket?.queue?.name || "Sem fila");
        return;
      }

      if (err.response?.status === 409) {
        const ticket = JSON.parse(err.response.data.error);
        if (ticket.userId !== user?.id) {
          setOpenAlert(true);
          setUserTicketOpen(ticket?.user?.name);
          setQueueTicketOpen(ticket?.queue?.name);
        } else {
          // Ticket já existe, abrir template modal
          setCreatedTicket(ticket);
          setTemplateModalOpen(true);
        }
      } else {
        toastError(err);
      }
    }
    setLoading(false);
  };

  const handleSendMessageTemplate = async (e) => {
    if (!createdTicket || e.id === "") return;
    setLoading(true);
    const message = {
      templateId: e.id,
      variables: e.variables,
      bodyToSave: e.bodyToSave,
      mediaUrl: "",
    };
    try {
      await api.post(`/messages-template/${createdTicket.id}`, message);
      toast.success("Template enviado com sucesso!");
    } catch (err) {
      toastError(err);
    }
    setLoading(false);
    setTemplateModalOpen(false);
    onClose(createdTicket);
  };

  const handleSkipTemplate = () => {
    setTemplateModalOpen(false);
    if (createdTicket) {
      onClose(createdTicket);
    }
  };

  const handleSelectOption = (e, newValue) => {
    if (newValue?.number) {
      setSelectedContact(newValue);
    } else if (newValue?.name) {
      setNewContact({ name: newValue.name });
      setContactModalOpen(true);
    }
  };

  const handleCloseContactModal = () => {
    setContactModalOpen(false);
  };

  const handleAddNewContactTicket = (contact) => {
    setSelectedContact(contact);
  };

  const createAddContactOption = (filterOptions, params) => {
    const filtered = filter(filterOptions, params);
    if (params.inputValue !== "" && !loading && searchParam.length >= 3) {
      filtered.push({
        name: `${params.inputValue}`,
      });
    }
    return filtered;
  };

  const renderOption = (option) => {
    if (option.number) {
      return (
        <>
          <WhatsApp style={{ color: "#128C7E", verticalAlign: "middle" }} />
          <Typography component="span" style={{ fontSize: 14, marginLeft: "10px", display: "inline-flex", alignItems: "center", lineHeight: "2" }}>
            {option.name} - {option.number}
          </Typography>
        </>
      );
    } else {
      return `${i18n.t("newTicketModal.add")} ${option.name}`;
    }
  };

  const renderOptionLabel = (option) => {
    if (option.number) {
      return `${option.name} - ${option.number}`;
    } else {
      return `${option.name}`;
    }
  };

  const renderContactAutocomplete = () => {
    if (initialContact === undefined || initialContact.id === undefined) {
      return (
        <Grid xs={12} item>
          <Autocomplete
            fullWidth
            options={options}
            loading={loading}
            clearOnBlur
            autoHighlight
            freeSolo
            clearOnEscape
            getOptionLabel={renderOptionLabel}
            renderOption={renderOption}
            filterOptions={createAddContactOption}
            onChange={(e, newValue) => handleSelectOption(e, newValue)}
            renderInput={(params) => (
              <TextField
                {...params}
                label={i18n.t("newTicketModal.fieldLabel")}
                variant="outlined"
                autoFocus
                onChange={(e) => setSearchParam(e.target.value)}
                onKeyPress={(e) => {
                  if (loading || !selectedContact) return;
                  else if (e.key === "Enter") {
                    handleSaveTicket(selectedContact.id);
                  }
                }}
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <React.Fragment>
                      {loading ? <CircularProgress color="inherit" size={20} /> : null}
                      {params.InputProps.endAdornment}
                    </React.Fragment>
                  ),
                }}
              />
            )}
          />
        </Grid>
      );
    }
    return null;
  };

  return (
    <>
      <Dialog open={modalOpen && !templateModalOpen} onClose={handleClose}>
        <DialogTitle id="form-dialog-title">
          Nova Conversa - API Oficial
        </DialogTitle>
        <DialogContent dividers>
          <Grid style={{ width: 300 }} container spacing={2}>
            {renderContactAutocomplete()}
            <Grid xs={12} item>
              <Select
                required
                fullWidth
                displayEmpty
                variant="outlined"
                value={selectedQueue}
                onChange={(e) => setSelectedQueue(e.target.value)}
                MenuProps={{
                  anchorOrigin: { vertical: "bottom", horizontal: "left" },
                  transformOrigin: { vertical: "top", horizontal: "left" },
                  getContentAnchorEl: null,
                }}
                renderValue={() => {
                  if (selectedQueue === "") return "Selecione uma fila";
                  const queue = user.queues.find((q) => q.id === selectedQueue);
                  return queue?.name;
                }}
              >
                {user.queues?.length > 0 &&
                  user.queues.map((queue, key) => (
                    <MenuItem dense key={key} value={queue.id}>
                      <ListItemText primary={queue.name} />
                    </MenuItem>
                  ))}
              </Select>
            </Grid>
            <Grid xs={12} item>
              <Select
                required
                fullWidth
                displayEmpty
                variant="outlined"
                value={selectedWhatsapp}
                onChange={(e) => setSelectedWhatsapp(e.target.value)}
                MenuProps={{
                  anchorOrigin: { vertical: "bottom", horizontal: "left" },
                  transformOrigin: { vertical: "top", horizontal: "left" },
                  getContentAnchorEl: null,
                }}
                renderValue={() => {
                  if (selectedWhatsapp === "") return "Selecione uma Conexão Oficial";
                  const whatsapp = whatsapps.find((w) => w.id === selectedWhatsapp);
                  if (!whatsapp) return "";
                  return (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      {whatsapp.name}
                      <Chip size="small" label="API Oficial" style={{ backgroundColor: "#25d366", color: "#fff", height: 18, fontSize: "0.65rem" }} />
                    </span>
                  );
                }}
              >
                {whatsapps?.length > 0 &&
                  whatsapps.map((whatsapp, key) => (
                    <MenuItem dense key={key} value={whatsapp.id}>
                      <ListItemText
                        primary={
                          <>
                            <WhatsApp style={{ color: "#128C7E", verticalAlign: "middle" }} />
                            <Typography component="span" style={{ fontSize: 14, marginLeft: "10px", display: "inline-flex", alignItems: "center", lineHeight: "2" }}>
                              {whatsapp.name}
                              <Chip size="small" label="API Oficial" style={{ marginLeft: 8, backgroundColor: "#25d366", color: "#fff", height: 18, fontSize: "0.65rem" }} />
                              &nbsp;
                              <span className={whatsapp.status === "CONNECTED" ? classes.online : classes.offline}>
                                ({whatsapp.status})
                              </span>
                            </Typography>
                          </>
                        }
                      />
                    </MenuItem>
                  ))}
              </Select>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} color="secondary" disabled={loading} variant="outlined">
            {i18n.t("newTicketModal.buttons.cancel")}
          </Button>
          <ButtonWithSpinner
            variant="contained"
            type="button"
            disabled={!selectedContact}
            onClick={() => handleSaveTicket(selectedContact.id)}
            color="primary"
            loading={loading}
          >
            Criar e Enviar Template
          </ButtonWithSpinner>
        </DialogActions>
        {contactModalOpen && (
          <ContactModal
            open={contactModalOpen}
            initialValues={newContact}
            onClose={handleCloseContactModal}
            onSave={handleAddNewContactTicket}
          />
        )}
        {openAlert && (
          <ShowTicketOpen
            isOpen={openAlert}
            handleClose={handleCloseAlert}
            user={userTicketOpen}
            queue={queueTicketOpen}
          />
        )}
      </Dialog>

      {templateModalOpen && (
        <TemplateModal
          open={templateModalOpen}
          handleClose={handleSkipTemplate}
          onSelectTemplate={handleSendMessageTemplate}
          templates={templates}
        />
      )}
    </>
  );
};

export default NewTicketOficialModal;
