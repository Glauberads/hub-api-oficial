import React, { useState, useEffect, useReducer, useContext, useCallback, useRef } from "react";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import IconButton from "@material-ui/core/IconButton";
import SearchIcon from "@material-ui/icons/Search";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import Chip from '@material-ui/core/Chip';
import Box from '@material-ui/core/Box';
import Checkbox from "@material-ui/core/Checkbox";

import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";
import GetAppIcon from "@material-ui/icons/GetApp";
import PublishIcon from "@material-ui/icons/Publish";
import DeleteSweepIcon from "@material-ui/icons/DeleteSweep";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import QuickMessageDialog from "../../components/QuickMessageDialog";
import ConfirmationModal from "../../components/ConfirmationModal";
import toastError from "../../errors/toastError";
import { Grid } from "@material-ui/core";
import { isArray } from "lodash";
import { AuthContext } from "../../context/Auth/AuthContext";

const reducer = (state, action) => {
  if (action.type === "LOAD_QUICKMESSAGES") {
    const quickmessages = action.payload;
    const newQuickmessages = [];

    if (isArray(quickmessages)) {
      quickmessages.forEach((quickemessage) => {
        const quickemessageIndex = state.findIndex(
          (u) => u.id === quickemessage.id
        );
        if (quickemessageIndex !== -1) {
          state[quickemessageIndex] = quickemessage;
        } else {
          newQuickmessages.push(quickemessage);
        }
      });
    }

    return [...state, ...newQuickmessages];
  }

  if (action.type === "UPDATE_QUICKMESSAGES") {
    const quickemessage = action.payload;
    const quickemessageIndex = state.findIndex((u) => u.id === quickemessage.id);

    if (quickemessageIndex !== -1) {
      state[quickemessageIndex] = quickemessage;
      return [...state];
    } else {
      return [quickemessage, ...state];
    }
  }

  if (action.type === "DELETE_QUICKMESSAGE") {
    const quickemessageId = action.payload;

    const quickemessageIndex = state.findIndex((u) => u.id === quickemessageId);
    if (quickemessageIndex !== -1) {
      state.splice(quickemessageIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(1),
    overflowY: "scroll",
    ...theme.scrollbarStyles,
  },
  mediaChip: {
    fontSize: '0.75rem',
    height: 24
  }
}));

const Quickemessages = () => {
  const classes = useStyles();

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedQuickemessage, setSelectedQuickemessage] = useState(null);
  const [deletingQuickemessage, setDeletingQuickemessage] = useState(null);
  const [quickemessageModalOpen, setQuickMessageDialogOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [quickemessages, dispatch] = useReducer(reducer, []);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const importInputRef = useRef(null);
  const { user, socket } = useContext(AuthContext);

  const { profile } = user;

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      fetchQuickemessages();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchParam, pageNumber]);

  useEffect(() => {
    const companyId = user.companyId;

    const onQuickMessageEvent = (data) => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_QUICKMESSAGES", payload: data.record });
      }
      if (data.action === "delete") {
        dispatch({ type: "DELETE_QUICKMESSAGE", payload: +data.id });
      }
    };
    socket.on(`company-${companyId}-quickemessage`, onQuickMessageEvent);

    return () => {
      socket.off(`company-${companyId}-quickemessage`, onQuickMessageEvent);
    };
  }, [socket]);

  const fetchQuickemessages = async () => {
    try {
      const companyId = user.companyId;
      const { data } = await api.get("/quick-messages", {
        params: { searchParam, pageNumber },
      });

      dispatch({ type: "LOAD_QUICKMESSAGES", payload: data.records });
      setHasMore(data.hasMore);
      setLoading(false);
    } catch (err) {
      toastError(err);
    }
  };

  const handleOpenQuickMessageDialog = () => {
    setSelectedQuickemessage(null);
    setQuickMessageDialogOpen(true);
  };

  const handleCloseQuickMessageDialog = () => {
    setSelectedQuickemessage(null);
    setQuickMessageDialogOpen(false);
    fetchQuickemessages();
  };

  const handleSearch = (event) => {
    setSearchParam(event.target.value.toLowerCase());
  };

  const handleEditQuickemessage = (quickemessage) => {
    setSelectedQuickemessage(quickemessage);
    setQuickMessageDialogOpen(true);
  };

  const handleDeleteQuickemessage = async (quickemessageId) => {
    try {
      await api.delete(`/quick-messages/${quickemessageId}`);
      toast.success(i18n.t("i18nFix.quickMessageDeleted"));
    } catch (err) {
      toastError(err);
    }
    setDeletingQuickemessage(null);
    setSearchParam("");
    setPageNumber(1);
    fetchQuickemessages();
    dispatch({ type: "RESET" });
  };


  const handleToggleSelected = quickMessageId => {
    setSelectedIds(current =>
      current.includes(quickMessageId)
        ? current.filter(id => id !== quickMessageId)
        : [...current, quickMessageId]
    );
  };

  const handleToggleSelectAll = () => {
    const visibleIds = quickemessages.map(item => item.id);
    const allVisibleSelected =
      visibleIds.length > 0 &&
      visibleIds.every(id => selectedIds.includes(id));

    if (allVisibleSelected) {
      setSelectedIds(current =>
        current.filter(id => !visibleIds.includes(id))
      );
      return;
    }

    setSelectedIds(current =>
      Array.from(new Set([...current, ...visibleIds]))
    );
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;

    try {
      setBulkDeleting(true);

      const { data } = await api.delete("/quick-messages/bulk", {
        data: {
          ids: selectedIds
        }
      });

      setSelectedIds([]);
      setBulkDeleteModalOpen(false);
      dispatch({ type: "RESET" });
      setPageNumber(1);
      await fetchQuickemessages();

      toast.success(
        `${data.deleted || 0} resposta(s) rápida(s) excluída(s).`
      );
    } catch (err) {
      toastError(err);
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleExportQuickMessages = async () => {
    try {
      setExporting(true);

      const response = await api.get("/quick-messages/export", {
        responseType: "blob"
      });

      const contentType =
        response.headers["content-type"] || "application/zip";

      const blob = new Blob([response.data], {
        type: contentType
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const disposition = response.headers["content-disposition"] || "";
      const fileNameMatch = disposition.match(/filename="?([^"]+)"?/i);

      link.href = url;
      link.setAttribute(
        "download",
        fileNameMatch
          ? fileNameMatch[1]
          : `respostas_rapidas_${new Date()
              .toISOString()
              .slice(0, 10)}.zip`
      );

      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Respostas rápidas exportadas com sucesso.");
    } catch (err) {
      toastError(err);
    } finally {
      setExporting(false);
    }
  };

  const handleImportClick = () => {
    if (!importing && importInputRef.current) {
      importInputRef.current.click();
    }
  };

  const handleImportQuickMessages = async event => {
    const input = event.target;
    const file = input.files && input.files[0];

    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".zip")) {
      toast.error("Selecione um arquivo ZIP exportado pelo sistema.");
      input.value = "";
      return;
    }

    try {
      setImporting(true);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("typeArch", "quickMessage");

      const { data } = await api.post(
        "/quick-messages/import",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data"
          }
        }
      );

      dispatch({ type: "RESET" });
      setSelectedIds([]);
      setSearchParam("");
      setPageNumber(1);
      await fetchQuickemessages();

      const details = [
        `${data.imported || 0} importada(s)`,
        `${data.importedMedia || 0} mídia(s)`
      ];

      if (data.renamed > 0) {
        details.push(`${data.renamed} atalho(s) renomeado(s)`);
      }

      toast.success(
        `Importação concluída: ${details.join(", ")}.`
      );
    } catch (err) {
      toastError(err);
    } finally {
      setImporting(false);
      input.value = "";
    }
  };

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

  const getMediaTypeDisplay = (quickmessage) => {
    if (!quickmessage.mediaName) {
      return i18n.t("quickMessages.noAttachment");
    }

    const mediaType = quickmessage.mediaType || 'document';
    const getIcon = (type) => {
      switch (type) {
        case 'audio': return '🎵';
        case 'image': return '🖼️';
        case 'video': return '🎥';
        default: return '📎';
      }
    };

    const getColor = (type) => {
      switch (type) {
        case 'audio': return 'secondary';
        case 'image': return 'primary';
        case 'video': return 'default';
        default: return 'default';
      }
    };

    return (
      <Box display="flex" alignItems="center" gap={1}>
        <span>{getIcon(mediaType)}</span>
        <Chip 
          size="small" 
          label={mediaType} 
          color={getColor(mediaType)}
          className={classes.mediaChip}
        />
      </Box>
    );
  };

  return (
    <MainContainer>
      <ConfirmationModal
        title={deletingQuickemessage && `${i18n.t("quickMessages.confirmationModal.deleteTitle")} ${deletingQuickemessage.shortcode}?`}
        open={confirmModalOpen}
        onClose={setConfirmModalOpen}
        onConfirm={() => handleDeleteQuickemessage(deletingQuickemessage.id)}
      >
        {i18n.t("quickMessages.confirmationModal.deleteMessage")}
      </ConfirmationModal>

      <ConfirmationModal
        title={`Excluir ${selectedIds.length} resposta(s) rápida(s)?`}
        open={bulkDeleteModalOpen}
        onClose={() => {
          if (!bulkDeleting) {
            setBulkDeleteModalOpen(false);
          }
        }}
        onConfirm={handleBulkDelete}
      >
        Esta ação excluirá as respostas selecionadas, seus botões e suas
        mídias. Essa operação não poderá ser desfeita.
      </ConfirmationModal>

      <QuickMessageDialog
        resetPagination={() => {
          setPageNumber(1);
          fetchQuickemessages();
        }}
        open={quickemessageModalOpen}
        onClose={handleCloseQuickMessageDialog}
        aria-labelledby="form-dialog-title"
        quickemessageId={selectedQuickemessage && selectedQuickemessage.id}
      />
      <MainHeader>
        <Grid
          style={{ width: "99.6%" }}
          container
          spacing={2}
          alignItems="center"
        >
          <Grid xs={12} md={3} item>
            <Title>{i18n.t("quickMessages.title")}</Title>
          </Grid>

          <Grid xs={12} md={9} item>
            <Grid spacing={1} container alignItems="center">
              <Grid xs={12} sm={4} item>
                <TextField
                  fullWidth
                  placeholder={i18n.t("quickMessages.searchPlaceholder")}
                  type="search"
                  value={searchParam}
                  onChange={handleSearch}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon style={{ color: "gray" }} />
                      </InputAdornment>
                    )
                  }}
                />
              </Grid>

              <Grid xs={6} sm={2} item>
                <Button
                  fullWidth
                  variant="outlined"
                  color="primary"
                  startIcon={<PublishIcon />}
                  onClick={handleImportClick}
                  disabled={importing || exporting}
                >
                  {importing ? "Importando..." : i18n.t("contactListItems.buttons.import")}
                </Button>

                <input
                  ref={importInputRef}
                  type="file"
                  accept=".zip,application/zip"
                  style={{ display: "none" }}
                  onChange={handleImportQuickMessages}
                />
              </Grid>

              <Grid xs={6} sm={2} item>
                <Button
                  fullWidth
                  variant="outlined"
                  color="primary"
                  startIcon={<GetAppIcon />}
                  onClick={handleExportQuickMessages}
                  disabled={exporting || importing}
                >
                  {exporting ? "Exportando..." : "Exportar"}
                </Button>
              </Grid>

              <Grid xs={6} sm={2} item>
                <Button
                  fullWidth
                  variant="outlined"
                  color="secondary"
                  startIcon={<DeleteSweepIcon />}
                  onClick={() => setBulkDeleteModalOpen(true)}
                  disabled={
                    selectedIds.length === 0 ||
                    importing ||
                    exporting ||
                    bulkDeleting
                  }
                >
                  {bulkDeleting
                    ? "Excluindo..."
                    : `Excluir (${selectedIds.length})`}
                </Button>
              </Grid>

              <Grid xs={6} sm={2} item>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={handleOpenQuickMessageDialog}
                  color="primary"
                  disabled={importing || exporting}
                >
                  {i18n.t("quickMessages.buttons.add")}
                </Button>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </MainHeader>
      <Paper
        className={classes.mainPaper}
        variant="outlined"
        onScroll={handleScroll}
      >
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox" align="center">
                <Checkbox
                  color="primary"
                  checked={
                    quickemessages.length > 0 &&
                    quickemessages.every(item =>
                      selectedIds.includes(item.id)
                    )
                  }
                  indeterminate={
                    selectedIds.length > 0 &&
                    !(
                      quickemessages.length > 0 &&
                      quickemessages.every(item =>
                        selectedIds.includes(item.id)
                      )
                    )
                  }
                  onChange={handleToggleSelectAll}
                  inputProps={{
                    "aria-label": "Selecionar respostas visíveis"
                  }}
                />
              </TableCell>

              <TableCell align="center">
                {i18n.t("quickMessages.table.shortcode")}
              </TableCell>
              <TableCell align="center">
                {i18n.t("tagModal.form.mediaFiles")}
              </TableCell>
              <TableCell align="center">
                {i18n.t("quickMessages.table.status")}
              </TableCell>
              <TableCell align="center">
                {i18n.t("quickMessages.table.actions")}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <>
              {quickemessages.map((quickemessage) => (
                <TableRow
                  key={quickemessage.id}
                  selected={selectedIds.includes(quickemessage.id)}
                >
                  <TableCell padding="checkbox" align="center">
                    <Checkbox
                      color="primary"
                      checked={selectedIds.includes(quickemessage.id)}
                      onChange={() =>
                        handleToggleSelected(quickemessage.id)
                      }
                      inputProps={{
                        "aria-label": `Selecionar ${quickemessage.shortcode}`
                      }}
                    />
                  </TableCell>

                  <TableCell align="center">{quickemessage.shortcode}</TableCell>
                  <TableCell align="center">
                    {getMediaTypeDisplay(quickemessage)}
                  </TableCell>
                  <TableCell align="center">
                    {quickemessage.geral === true ? (
                      <CheckCircleIcon style={{ color: 'green' }} />
                    ) : (
                      ''
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <IconButton
                      size="small"
                      onClick={() => handleEditQuickemessage(quickemessage)}
                    >
                      <EditIcon />
                    </IconButton>

                    <IconButton
                      size="small"
                      onClick={(e) => {
                        setConfirmModalOpen(true);
                        setDeletingQuickemessage(quickemessage);
                      }}
                    >
                      <DeleteOutlineIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {loading && <TableRowSkeleton columns={5} />}
            </>
          </TableBody>
        </Table>
      </Paper>
    </MainContainer>
  );
};

export default Quickemessages;
