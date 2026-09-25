import React, { useEffect, useState, useContext } from 'react';
import { Dialog, DialogTitle, DialogActions, Button, Box, CircularProgress, Backdrop } from '@material-ui/core';
import { i18n } from '../../translate/i18n';
import { makeStyles } from "@material-ui/core/styles";
import api from "../../services/api";
import { Can } from "../Can";
import { toast } from "react-toastify";
import { AuthContext } from "../../context/Auth/AuthContext";
import * as XLSX from "xlsx";
import { useHistory } from 'react-router-dom/cjs/react-router-dom.min';
import toastError from '../../errors/toastError';

const useStyles = makeStyles((theme) => ({
  multFieldLine: {
    display: "flex",
    marginTop: 8,
  },
  uploadInput: {
    display: "none",
  },
  btns: {
    margin: 15,
  },
  label: {
    padding: 18,
    width: "100%",
    textTransform: 'uppercase',
    display: 'block',
    marginTop: 10,
    border: "solid 2px grey",
    textAlign: 'center',
    cursor: 'pointer',
    borderRadius: 8
  },
}));

const normalizeUsername = (value) => {
  return String(value || "").replace(/^@+/, "").trim().toLowerCase();
};

const readUsernameFromRow = (item) => {
  return normalizeUsername(
    item.whatsappUsername ||
    item.username ||
    item.Username ||
    item.usuario ||
    item["usuário"] ||
    item.Usuario ||
    item["Username do WhatsApp"] ||
    item["username do whatsapp"] ||
    ""
  );
};

const ContactImportWpModal = ({ isOpen, handleClose, selectedTags, hideNum, userProfile }) => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const history = useHistory();

  const initialContact = { name: "", number: "", error: "" };

  const [contactsToImport, setContactsToImport] = useState([]);
  const [statusMessage, setStatusMessage] = useState("");
  const [currentContact, setCurrentContact] = useState(initialContact);
  const [importingPhone, setImportingPhone] = useState(false);

  const handleClosed = () => {
    setContactsToImport([]);
    setStatusMessage("");
    setCurrentContact(initialContact);
    handleClose();
  };

  useEffect(() => {
    if (contactsToImport?.length) {
      contactsToImport.map(async (item, index) => {
        setTimeout(async () => {
          try {
            if (index >= contactsToImport?.length - 1) {
              setStatusMessage(`importação concluída com exito a importação`);
              setCurrentContact(initialContact);

              setTimeout(() => {
                handleClosed();
              }, 15000);
            }

            if (index % 5 === 0) {
              setStatusMessage(`importação em andamento ${index} de ${contactsToImport?.length} não saia desta tela até concluir a importação`);
            }

            const whatsappUsername = readUsernameFromRow(item);

            await api.post(`/contactsImport`, {
              name: item.name || item.nome,
              number: String(item.number || item.numero || ""),
              email: item.email,
              birthDate: item.birthDate,
              tags: item.tags,
              carteira: item.carteira,
              whatsappUsername
            });

            setCurrentContact({
              name: item.name || item.nome,
              number: item.number || item.numero,
              error: "success"
            });
          } catch (err) {
            setCurrentContact({
              name: item.name || item.nome,
              number: item.number || item.numero,
              error: err
            });
          }
        }, 330 * index);
      });
    }
  }, [contactsToImport]);

  const handleOnExportContacts = async (model = false) => {
    const allDatas = [];

    if (!model) {
      let i = 1;
      let totalPages = 1;

      do {
        const { data } = await api.get("/contacts/", {
          params: { searchParam: "", pageNumber: i, contactTag: JSON.stringify(selectedTags) },
        });

        data.contacts.forEach((element) => {
          const tagsContact = element?.tags?.map(tag => tag?.name).join(', ');
          const carteira = element?.contactWallets && element.contactWallets.length > 0
            ? element.contactWallets[0].wallet?.email
            : "";
          allDatas.push({ ...element, tags: tagsContact, carteira });
        });

        totalPages = Math.ceil((data?.count || 0) / 20);
        i++;
      } while (i <= totalPages);
    } else {
      allDatas.push({
        nome: "Nome Contato",
        username: "@testusername",
        numero: "5599999999999",
        email: "email-contato@email.com",
        birthDate: "15-05-1990",
        tags: "tag1, tag2",
        carteira: "funcionario-empresa@email.com",
      });
    }

    const exportData = allDatas.map((e) => {
      const numero = hideNum && userProfile === "user"
        ? (e.isGroup ? e.number : e.number.slice(0, -6) + "**-**" + e.number.slice(-2))
        : e.number;

      const username = e.whatsappUsername
        ? `@${String(e.whatsappUsername).replace(/^@+/, "")}`
        : (e.username || "");

      return {
        nome: e.name || e.nome || "",
        username: username,
        numero: numero || e.numero || "",
        email: e.email || "",
        birthDate: e.birthDate || "",
        tags: e.tags || "",
        carteira: e.carteira || "",
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(wb, ws, "Contatos");
    XLSX.writeFile(wb, "backup_contatos.xlsx");
  };

  const handleImportChange = (e) => {
    const [file] = e.target.files;
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        setContactsToImport(data);
      } catch (err) {
        console.log(err);
        setContactsToImport([]);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleimportContact = async () => {
    try {
      history.push('/contacts/import');
    } catch (err) {
      toastError(err);
    }
  };

  const handleImportFromPhone = async () => {
    setImportingPhone(true);
    try {
      await api.post("/contacts/import");
      toast.success("Contatos do telefone importados com sucesso!");
      handleClosed();
    } catch (err) {
      toastError(err);
    } finally {
      setImportingPhone(false);
    }
  };

  return (
    <>
      <Backdrop open={importingPhone} style={{ zIndex: 9999, color: "#fff", flexDirection: "column", gap: 16 }}>
        <CircularProgress color="inherit" />
        <span style={{ fontSize: 16 }}>Importando contatos do telefone...</span>
      </Backdrop>
      <Dialog fullWidth open={isOpen} onClose={handleClosed}>
        <DialogTitle>{i18n.t("i18nFix.contactImportExport")}</DialogTitle>
        <div>
          <Box style={{ padding: "0px 10px 10px" }}>
            <Can
              role={user.profile}
              perform="contacts-page:deleteContact"
              yes={() => (
                <div className={classes.multFieldLine}>
                  <Button
                    fullWidth
                    size="small"
                    color="primary"
                    variant="contained"
                    onClick={() => handleOnExportContacts(false)}
                  >
                    {i18n.t("contactImportWpModal.title")}
                  </Button>
                </div>
              )}
            />
            <div className={classes.multFieldLine}>
              <Button
                fullWidth
                size="small"
                color="primary"
                variant="contained"
                onClick={() => handleOnExportContacts(true)}
              >
                {i18n.t("contactImportWpModal.buttons.downloadModel")}
              </Button>
            </div>
            <div className={classes.multFieldLine}>
              <Button
                fullWidth
                size="small"
                color="primary"
                variant="contained"
                onClick={() => handleimportContact()}
              >
                {i18n.t("contactImportWpModal.buttons.import")}
              </Button>
            </div>
            <div className={classes.multFieldLine}>
              <Button
                fullWidth
                size="small"
                color="secondary"
                variant="contained"
                onClick={handleImportFromPhone}
                disabled={importingPhone}
              >
                📱 Importar contatos do telefone (WhatsApp)
              </Button>
            </div>
          </Box>
        </div>

        <DialogActions>
          <Button onClick={handleClose} color="primary">
            {i18n.t("contactImportWpModal.buttons.closed")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ContactImportWpModal;
