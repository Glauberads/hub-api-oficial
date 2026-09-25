/* eslint-disable no-unused-vars */

import React, { useState, useEffect, useReducer, useContext } from "react";
import { toast } from "react-toastify";
import { useHistory } from "react-router-dom";
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
import Tooltip from "@material-ui/core/Tooltip";
import Chip from "@material-ui/core/Chip";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";
import DescriptionIcon from "@material-ui/icons/Description";
import PlayCircleOutlineIcon from "@material-ui/icons/PlayCircleOutline";
import PauseCircleOutlineIcon from "@material-ui/icons/PauseCircleOutline";
import RepeatIcon from "@material-ui/icons/Repeat";
import StopIcon from "@material-ui/icons/Stop";
import ScheduleIcon from "@material-ui/icons/Schedule";
import EmailIcon from "@material-ui/icons/Email";
import WhatsAppIcon from "@material-ui/icons/WhatsApp";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import CampaignModal from "../../components/CampaignModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import toastError from "../../errors/toastError";
import { Grid, FormControl, InputLabel, Select, MenuItem, TablePagination, Box } from "@material-ui/core";
import { isArray } from "lodash";
import { useDate } from "../../hooks/useDate";
import ForbiddenPage from "../../components/ForbiddenPage";
import usePlans from "../../hooks/usePlans";
import { AuthContext } from "../../context/Auth/AuthContext";

const reducer = (state, action) => {
  if (action.type === "LOAD_CAMPAIGNS") {
    const campaigns = action.payload;
    const newCampaigns = [];
    if (isArray(campaigns)) {
      campaigns.forEach((campaign) => {
        const idx = state.findIndex((u) => u.id === campaign.id);
        if (idx !== -1) {
          state[idx] = campaign;
        } else {
          newCampaigns.push(campaign);
        }
      });
    }
    return [...state, ...newCampaigns];
  }

  if (action.type === "UPDATE_CAMPAIGNS") {
    const campaign = action.payload;
    const idx = state.findIndex((u) => u.id === campaign.id);
    if (idx !== -1) {
      const updated = [...state];
      updated[idx] = campaign;
      return updated;
    }
    return [campaign, ...state];
  }

  if (action.type === "DELETE_CAMPAIGN") {
    return state.filter((u) => u.id !== action.payload);
  }

  if (action.type === "RESET") {
    return [];
  }
};

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: 0,
    overflowY: "auto",
    borderRadius: 8,
    ...theme.scrollbarStyles,
  },
  recurringChip: {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    fontSize: "0.7rem",
    height: 20,
  },
  statusChip: {
    fontSize: "0.7rem",
    height: 20,
  },
  nextExecutionCell: {
    fontWeight: 500,
    color: theme.palette.text.secondary,
    fontSize: "0.8rem",
  },
  filterContainer: {
    padding: theme.spacing(1.5, 2),
    marginBottom: theme.spacing(1.5),
    borderRadius: 8,
  },
  tableHeader: {
    fontWeight: 700,
    backgroundColor: theme.palette.type === "dark" ? "#3c4043" : theme.palette.grey[100],
    fontSize: "0.78rem",
    color: theme.palette.text.secondary,
    padding: theme.spacing(1, 1.5),
    whiteSpace: "nowrap",
  },
  tableCell: {
    color: theme.palette.text.primary,
    fontSize: "0.82rem",
    padding: theme.spacing(0.8, 1.5),
  },
}));

const Campaigns = () => {
  const classes = useStyles();
  const history = useHistory();

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [deletingCampaign, setDeletingCampaign] = useState(null);
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [stopRecurrenceModalOpen, setStopRecurrenceModalOpen] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [recurrenceFilter, setRecurrenceFilter] = useState("");
  const [campaigns, dispatch] = useReducer(reducer, []);
  const { user, socket } = useContext(AuthContext);
  const { datetimeToClient } = useDate();
  const { getPlanCompany } = usePlans();

  useEffect(() => {
    async function fetchData() {
      const companyId = user.companyId;
      const planConfigs = await getPlanCompany(undefined, companyId);
      if (!planConfigs.plan.useCampaigns) {
        toast.error(i18n.t("marketing.campaigns.noPermission"));
        setTimeout(() => { history.push(`/`); }, 1000);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam, statusFilter, recurrenceFilter, pageSize]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => { fetchCampaigns(); }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchParam, pageNumber, statusFilter, recurrenceFilter, pageSize]);

  useEffect(() => {
    const companyId = user.companyId;
    const onCompanyCampaign = (data) => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_CAMPAIGNS", payload: data.record });
      }
      if (data.action === "delete") {
        dispatch({ type: "DELETE_CAMPAIGN", payload: +data.id });
      }
    };
    socket.on(`company-${companyId}-campaign`, onCompanyCampaign);
    return () => { socket.off(`company-${companyId}-campaign`, onCompanyCampaign); };
  }, [user]);

  const fetchCampaigns = async () => {
    try {
      const { data } = await api.get("/campaigns/", {
        params: { searchParam, pageNumber, pageSize, status: statusFilter, isRecurring: recurrenceFilter },
      });
      if (pageNumber === 1) { dispatch({ type: "RESET" }); }
      dispatch({ type: "LOAD_CAMPAIGNS", payload: data.records });
      setHasMore(data.hasMore);
      setTotalPages(data.totalPages || 1);
      setTotalCount(data.count || 0);
      setLoading(false);
    } catch (err) {
      toastError(err);
    }
  };

  // Auto-refresh a cada 15s quando há campanhas Em Andamento
  useEffect(() => {
    const hasCampaignInProgress = campaigns.some(c => c.status === "EM_ANDAMENTO");
    if (!hasCampaignInProgress) return;
    const interval = setInterval(() => { fetchCampaigns(); }, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaigns]);


  const handleOpenCampaignModal = () => { setSelectedCampaign(null); setCampaignModalOpen(true); };
  const handleCloseCampaignModal = () => { setSelectedCampaign(null); setCampaignModalOpen(false); };
  const handleSearch = (event) => { setSearchParam(event.target.value.toLowerCase()); };
  const handleStatusFilterChange = (event) => { setStatusFilter(event.target.value); };
  const handleRecurrenceFilterChange = (event) => { setRecurrenceFilter(event.target.value); };
  const handleEditCampaign = (campaign) => { setSelectedCampaign(campaign); setCampaignModalOpen(true); };

  const handleDeleteCampaign = async (campaignId) => {
    try {
      await api.delete(`/campaigns/${campaignId}`);
      toast.success(i18n.t("campaigns.toasts.deleted"));
    } catch (err) {
      toastError(err);
    }
    setDeletingCampaign(null);
    setSearchParam("");
    setPageNumber(1);
  };

  const handleStopRecurrence = async (campaignId) => {
    try {
      await api.post(`/campaigns/${campaignId}/stop-recurrence`);
      toast.success(i18n.t("marketing.campaigns.recurrenceStopped"));
      setPageNumber(1);
      fetchCampaigns();
    } catch (err) {
      toastError(err);
    }
    setStopRecurrenceModalOpen(false);
    setSelectedCampaign(null);
  };

  const handlePageChange = (event, newPage) => { setPageNumber(newPage + 1); };
  const handlePageSizeChange = (event) => { setPageSize(parseInt(event.target.value, 10)); setPageNumber(1); };

  const formatStatus = (val) => {
    const map = { INATIVA: "inactive", PROGRAMADA: "scheduled", EM_ANDAMENTO: "inProgress", CANCELADA: "cancelled", FINALIZADA: "finished" };
    return map[val] ? i18n.t(`marketing.campaigns.status.${map[val]}`) : val;
  };

  const getStatusColor = (status) => {
    if (status === "PROGRAMADA") return "primary";
    if (status === "EM_ANDAMENTO") return "secondary";
    return "default";
  };

  const formatRecurrenceType = (type) => {
    return ["minutely", "hourly", "daily", "weekly", "biweekly", "monthly", "yearly"].includes(type)
      ? i18n.t(`marketing.campaigns.recurrence.${type}`)
      : type;
  };

  const cancelCampaign = async (campaign) => {
    try {
      await api.post(`/campaigns/${campaign.id}/cancel`);
      toast.success(i18n.t("campaigns.toasts.cancel"));
      setPageNumber(1);
      fetchCampaigns();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const restartCampaign = async (campaign) => {
    try {
      await api.post(`/campaigns/${campaign.id}/restart`);
      toast.success(i18n.t("campaigns.toasts.restart"));
      setPageNumber(1);
      fetchCampaigns();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (user.showCampaign !== "enabled") {
    return <ForbiddenPage />;
  }

  return (
    <MainContainer>
      <ConfirmationModal
        title={deletingCampaign && `${i18n.t("campaigns.confirmationModal.deleteTitle")} ${deletingCampaign.name}?`}
        open={confirmModalOpen}
        onClose={setConfirmModalOpen}
        onConfirm={() => handleDeleteCampaign(deletingCampaign.id)}
      >
        {i18n.t("campaigns.confirmationModal.deleteMessage")}
      </ConfirmationModal>

      <ConfirmationModal
        title={i18n.t("marketing.campaigns.stopRecurrence")}
        open={stopRecurrenceModalOpen}
        onClose={() => setStopRecurrenceModalOpen(false)}
        onConfirm={() => handleStopRecurrence(selectedCampaign?.id)}
      >
        {i18n.t("marketing.campaigns.stopConfirmation")}
      </ConfirmationModal>

      {campaignModalOpen && (
        <CampaignModal
          resetPagination={() => { setPageNumber(1); fetchCampaigns(); }}
          open={campaignModalOpen}
          onClose={handleCloseCampaignModal}
          aria-labelledby="form-dialog-title"
          campaignId={selectedCampaign && selectedCampaign.id}
        />
      )}

      {user.profile === "user" && user?.showCampaign === "disabled" ? (
        <ForbiddenPage />
      ) : (
        <>
          <MainHeader>
            <Grid style={{ width: "99.6%" }} container>
              <Grid xs={12} sm={8} item>
                <Title>{i18n.t("campaigns.title")}</Title>
              </Grid>
              <Grid xs={12} sm={4} item>
                <Grid spacing={2} container>
                  <Grid xs={6} sm={6} item>
                    <TextField
                      fullWidth
                      placeholder={i18n.t("campaigns.searchPlaceholder")}
                      type="search"
                      value={searchParam}
                      onChange={handleSearch}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon style={{ color: "gray" }} />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                  <Grid xs={6} sm={6} item>
                    <Button fullWidth variant="contained" onClick={handleOpenCampaignModal} color="primary">
                      {i18n.t("campaigns.buttons.add")}
                    </Button>
                  </Grid>
                </Grid>
              </Grid>
            </Grid>
          </MainHeader>

          {/* Filtros */}
          <Paper className={classes.filterContainer} variant="outlined">
            <Grid spacing={2} container alignItems="center">
              <Grid xs={12} sm={4} item>
                <FormControl fullWidth variant="outlined" size="small">
                  <InputLabel>{i18n.t("financial.status")}</InputLabel>
                  <Select value={statusFilter} onChange={handleStatusFilterChange} label={i18n.t("financial.status")}>
                    <MenuItem value="">{i18n.t("tickets.buttons.showAll")}</MenuItem>
                    <MenuItem value="INATIVA">{i18n.t("campaignReport.inactive")}</MenuItem>
                    <MenuItem value="PROGRAMADA">{i18n.t("campaignReport.scheduled")}</MenuItem>
                    <MenuItem value="EM_ANDAMENTO">{i18n.t("campaignReport.process")}</MenuItem>
                    <MenuItem value="CANCELADA">{i18n.t("campaignReport.cancelled")}</MenuItem>
                    <MenuItem value="FINALIZADA">{i18n.t("campaignReport.finished")}</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid xs={12} sm={4} item>
                <FormControl fullWidth variant="outlined" size="small">
                  <InputLabel>{i18n.t("recurrenceSection.title")}</InputLabel>
                  <Select value={recurrenceFilter} onChange={handleRecurrenceFilterChange} label={i18n.t("recurrenceSection.title")}>
                    <MenuItem value="">{i18n.t("marketing.campaigns.all")}</MenuItem>
                    <MenuItem value="true">{i18n.t("marketing.campaigns.recurring")}</MenuItem>
                    <MenuItem value="false">{i18n.t("marketing.campaigns.oneTimePlural")}</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Paper>

          <Paper className={classes.mainPaper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell align="left" className={classes.tableHeader}>{i18n.t("campaigns.table.name")}</TableCell>
                  <TableCell align="center" className={classes.tableHeader}>{i18n.t("queueIntegration.table.type")}</TableCell>
                  <TableCell align="center" className={classes.tableHeader}>{i18n.t("campaigns.table.status")}</TableCell>
                  <TableCell align="center" className={classes.tableHeader}>{i18n.t("recurrenceSection.title")}</TableCell>
                  <TableCell align="center" className={classes.tableHeader}>{i18n.t("campaigns.table.contactList")}</TableCell>
                  <TableCell align="center" className={classes.tableHeader}>{i18n.t("marketing.campaigns.channelProvider")}</TableCell>
                  <TableCell align="center" className={classes.tableHeader}>{i18n.t("campaigns.table.scheduledAt")}</TableCell>
                  <TableCell align="center" className={classes.tableHeader}>{i18n.t("marketing.campaigns.nextExecution")}</TableCell>
                  <TableCell align="center" className={classes.tableHeader}>{i18n.t("campaigns.table.completedAt")}</TableCell>
                  <TableCell align="center" className={classes.tableHeader}>{i18n.t("campaigns.table.actions")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <>
                  {campaigns.map((campaign) => (
                    <TableRow key={campaign.id} hover>
                      <TableCell align="left" className={classes.tableCell}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {campaign.isRecurring && (
                            <Tooltip title={i18n.t("marketing.campaigns.recurringCampaign")}>
                              <RepeatIcon color="primary" style={{ fontSize: 16 }} />
                            </Tooltip>
                          )}
                          <span style={{ fontWeight: 500 }}>{campaign.name}</span>
                        </div>
                      </TableCell>
                      <TableCell align="center" className={classes.tableCell}>
                        {campaign.campaignType === "email" ? (
                          <Chip
                            icon={<EmailIcon />}
                            label={i18n.t("wallets.email")}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        ) : (
                          <Chip
                            icon={<WhatsAppIcon />}
                            label={i18n.t("marketing.campaigns.whatsapp")}
                            size="small"
                            color="secondary"
                            variant="outlined"
                          />
                        )}
                      </TableCell>
                      <TableCell align="center" className={classes.tableCell}>
                        <Chip
                          label={formatStatus(campaign.status)}
                          color={getStatusColor(campaign.status)}
                          size="small"
                          className={classes.statusChip}
                        />
                      </TableCell>
                      <TableCell align="center" className={classes.tableCell}>
                        {campaign.isRecurring ? (
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                            <Chip label={formatRecurrenceType(campaign.recurrenceType)} className={classes.recurringChip} size="small" />
                            <span style={{ fontSize: "0.7rem", color: "#888" }}>{campaign.executionCount || 0}x</span>
                          </div>
                        ) : (
                          <Chip label={i18n.t("marketing.campaigns.oneTime")} variant="outlined" size="small" className={classes.statusChip} />
                        )}
                      </TableCell>
                      <TableCell align="center" className={classes.tableCell}>
                        {campaign.contactListId
                          ? campaign.contactList?.name || i18n.t("marketing.campaigns.removedList")
                          : campaign.tagListId && campaign.tagListId !== "Nenhuma"
                            ? i18n.t("marketing.campaigns.tagPrefix", { tag: campaign.tagListId })
                            : "—"}
                      </TableCell>
                      <TableCell align="center" className={classes.tableCell}>
                        {campaign.campaignType === "email"
                          ? campaign.emailProvider || "sendgrid"
                          : campaign.whatsapp?.name || (campaign.whatsappId ? i18n.t("marketing.campaigns.removed") : "—")}
                      </TableCell>
                      <TableCell align="center" className={classes.tableCell} style={{ whiteSpace: "nowrap" }}>
                        {campaign.scheduledAt ? datetimeToClient(campaign.scheduledAt) : "—"}
                      </TableCell>
                      <TableCell
                        align="center"
                        className={classes.nextExecutionCell}
                        style={{ whiteSpace: "nowrap" }}
                      >
                        {campaign.isRecurring && campaign.nextScheduledAt ? (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 4
                            }}
                          >
                            <ScheduleIcon style={{ fontSize: 14 }} color="primary" />
                            {datetimeToClient(campaign.nextScheduledAt)}
                          </div>
                        ) : campaign.campaignType === "email" &&
                          campaign.status === "EM_ANDAMENTO" &&
                          campaign.emailContinueHour ? (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 4
                            }}
                          >
                            <ScheduleIcon style={{ fontSize: 14 }} color="secondary" />
                            {i18n.t("marketing.campaigns.continuesAt")} {campaign.emailContinueHour}
                          </div>
                        ) : campaign.status === "PROGRAMADA" &&
                          campaign.scheduledAt ? (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 4
                            }}
                          >
                            <ScheduleIcon style={{ fontSize: 14 }} color="primary" />
                            {datetimeToClient(campaign.scheduledAt)}
                          </div>
                        ) : campaign.isRecurring &&
                          campaign.status === "FINALIZADA" ? (
                          <span style={{ color: "#999", fontSize: "0.75rem" }}>
                            {i18n.t("campaignReport.finished")}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell align="center" className={classes.tableCell} style={{ whiteSpace: "nowrap" }}>
                        {campaign.completedAt ? datetimeToClient(campaign.completedAt) : i18n.t("marketing.campaigns.notCompleted")}
                      </TableCell>
                      <TableCell align="center" className={classes.tableCell}>
                        <div style={{ display: "flex", justifyContent: "center", gap: 2 }}>
                          {campaign.status === "EM_ANDAMENTO" && (
                            <Tooltip title={i18n.t("marketing.campaigns.stopCampaign")}>
                              <IconButton onClick={() => cancelCampaign(campaign)} size="small">
                                <PauseCircleOutlineIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {campaign.status === "CANCELADA" && (
                            <Tooltip title={i18n.t("marketing.campaigns.restartCampaign")}>
                              <IconButton onClick={() => restartCampaign(campaign)} size="small">
                                <PlayCircleOutlineIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {campaign.isRecurring && campaign.status !== "FINALIZADA" && (
                            <Tooltip title={i18n.t("marketing.campaigns.stopRecurrence")}>
                              <IconButton
                                onClick={() => { setSelectedCampaign(campaign); setStopRecurrenceModalOpen(true); }}
                                size="small"
                                color="secondary"
                              >
                                <StopIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title={i18n.t("marketing.campaigns.report")}>
                            <IconButton onClick={() => history.push(`/campaign/${campaign.id}/report`)} size="small">
                              <DescriptionIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={i18n.t("chatList.edit")}>
                            <IconButton size="small" onClick={() => handleEditCampaign(campaign)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={i18n.t("chatList.delete")}>
                            <IconButton
                              size="small"
                              onClick={() => { setConfirmModalOpen(true); setDeletingCampaign(campaign); }}
                            >
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {loading && <TableRowSkeleton columns={10} />}
                </>
              </TableBody>
            </Table>

            {/* Paginação */}
            <Box display="flex" justifyContent="space-between" alignItems="center" p={2}>
              <Box color="text.secondary" fontSize="0.875rem">
                {i18n.t("marketing.campaigns.total")} {totalCount} {i18n.t("marketing.campaigns.campaigns")}
              </Box>
              <TablePagination
                component="div"
                count={totalCount}
                page={pageNumber - 1}
                onPageChange={handlePageChange}
                rowsPerPage={pageSize}
                onRowsPerPageChange={handlePageSizeChange}
                rowsPerPageOptions={[5, 10, 25, 50, 100]}
                labelRowsPerPage={i18n.t("marketing.campaigns.rowsPerPage")}
                labelDisplayedRows={({ from, to, count }) =>
                  i18n.t("marketing.campaigns.displayedRows", {
                    from,
                    to,
                    count: count !== -1
                      ? count
                      : i18n.t("marketing.campaigns.moreThan", { count: to })
                  })
                }
              />
            </Box>
          </Paper>
        </>
      )}
    </MainContainer>
  );
};

export default Campaigns;
