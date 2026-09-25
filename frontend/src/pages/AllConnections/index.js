import React, { useState, useCallback, useContext, useEffect } from "react";
import { toast } from "react-toastify";
import { format, parseISO, set } from "date-fns";

import Menu from "@material-ui/core/Menu";
import MenuItem from "@material-ui/core/MenuItem";
import PopupState, { bindTrigger, bindMenu } from "material-ui-popup-state";
import { Stack } from "@mui/material";
import { makeStyles } from "@material-ui/core/styles";
import { useHistory } from "react-router-dom";
import { green } from "@material-ui/core/colors";
import {
  Button,
  TableBody,
  TableRow,
  TableCell,
  IconButton,
  Table,
  TableHead,
  Paper,
  Tooltip,
  Typography,
  CircularProgress,
  Divider,
} from "@material-ui/core";
import {
  Edit,
  CheckCircle,
  SignalCellularConnectedNoInternet2Bar,
  SignalCellularConnectedNoInternet0Bar,
  SignalCellular4Bar,
  CropFree,
  DeleteOutline,
  Facebook,
  Instagram,
  WhatsApp,
} from "@material-ui/icons";
import FacebookLogin from "react-facebook-login/dist/facebook-login-render-props";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import { AuthContext } from "../../context/Auth/AuthContext";
import useCompanies from "../../hooks/useCompanies";
import useSettings from "../../hooks/useSettings";
import api from "../../services/api";
import WhatsAppModal from "../../components/WhatsAppModal";
import WhatsAppModalCompany from "../../components/CompanyWhatsapps";
import ConfirmationModal from "../../components/ConfirmationModal";
import QrcodeModal from "../../components/QrcodeModal";
import { i18n } from "../../translate/i18n";
import { WhatsAppsContext } from "../../context/WhatsApp/WhatsAppsContext";
import toastError from "../../errors/toastError";
import ForbiddenPage from "../../components/ForbiddenPage";

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(1),
    overflowY: "scroll",
    borderRadius: "10px",
    boxShadow: "rgba(0, 0, 0, 0.1) 0px 4px 12px",
    ...theme.scrollbarStyles,
  },
  customTableCell: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  tooltip: {
    backgroundColor: "#f5f5f9",
    color: "rgba(0, 0, 0, 0.87)",
    fontSize: theme.typography.pxToRem(14),
    border: "1px solid #dadde9",
    maxWidth: 450,
  },
  tooltipPopper: {
    textAlign: "center",
  },
  buttonProgress: {
    color: green[500],
  },
  TableHead: {
    backgroundColor: theme.palette.barraSuperior,
    color: "textSecondary",
    borderRadius: "5px",
  },
}));

const CustomToolTip = ({ title, content, children }) => {
  const classes = useStyles();

  return (
    <Tooltip
      arrow
      classes={{
        tooltip: classes.tooltip,
        popper: classes.tooltipPopper,
      }}
      title={
        <React.Fragment>
          <Typography gutterBottom color="inherit">
            {title}
          </Typography>
          {content && <Typography>{content}</Typography>}
        </React.Fragment>
      }
    >
      {children}
    </Tooltip>
  );
};

const IconChannel = (channel) => {
  switch (channel) {
    case "facebook":
      return <Facebook />;
    case "instagram":
      return <Instagram />;
    case "whatsapp":
      return <WhatsApp />;
    default:
      return "error";
  }
};

const AllConnections = () => {
  const classes = useStyles();
  const { user, socket } = useContext(AuthContext);
  const { list } = useCompanies();
  const { getAll: getAllSettings } = useSettings();
  const [loadingWhatsapp, setLoadingWhatsapp] = useState(true);
  const [loadingComp, setLoadingComp] = useState(false);
  const [whats, setWhats] = useState([]);
  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [selectedWhatsApp, setSelectedWhatsApp] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [filterConnections, setFilterConnections] = useState([]);
  const [companyWhatsApps, setCompanyWhatsApps] = useState(null);
  const [metaConfig, setMetaConfig] = useState({
    appId: "",
    sdkVersion: "v25.0",
    requireBusinessManagement: true,
    loading: true,
  });

  const confirmationModalInitialState = {
    action: "",
    title: "",
    message: "",
    whatsAppId: "",
    open: false,
  };
  const [confirmModalInfo, setConfirmModalInfo] = useState(
    confirmationModalInitialState
  );

  const history = useHistory();

  if (!user.super) {
    history.push("/tickets");
  }

  const loadWhatsapps = useCallback(async () => {
    setLoadingWhatsapp(true);
    try {
      const { data } = await api.get("/whatsapp/all/?session=0");
      setWhats(data);
    } catch (err) {
      toastError(err);
    } finally {
      setLoadingWhatsapp(false);
    }
  }, []);

  useEffect(() => {
    loadWhatsapps();
  }, [loadWhatsapps]);

  useEffect(() => {
    async function loadMetaConfig() {
      try {
        const settings = await getAllSettings();
        const getValue = (key, fallback = "") => {
          const found = Array.isArray(settings)
            ? settings.find((item) => item.key === key)
            : null;
          return found?.value ?? fallback;
        };
        setMetaConfig({
          appId: getValue("metaAppId", ""),
          sdkVersion: getValue("metaSdkVersion", "v25.0"),
          requireBusinessManagement:
            String(getValue("metaRequireBusinessManagement", "true")).toLowerCase() ===
            "true",
          loading: false,
        });
      } catch (error) {
        setMetaConfig((prev) => ({ ...prev, loading: false }));
      }
    }
    loadMetaConfig();
  }, [getAllSettings]);

  const handleMetaResponse = async (response, addInstagram = false) => {
    if (
      !response ||
      response.status === "unknown" ||
      !response.accessToken ||
      !response.id
    ) {
      toast.warn(i18n.t("connectionSuite.list.metaLoginCancelled"));
      return;
    }

    const { accessToken, id } = response;

    try {
      await api.post("/facebook", {
        addInstagram,
        facebookUserId: id,
        facebookUserToken: accessToken,
      });

      toast.success(i18n.t("i18nFix.facebookConnectionSuccess"));
      await loadWhatsapps();
    } catch (error) {
      toastError(error);
    }
  };

  const responseFacebook = (response) => {
    handleMetaResponse(response, false);
  };

  const responseInstagram = (response) => {
    handleMetaResponse(response, true);
  };

  const handleMetaLoginClick = (event, renderProps, popupState) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();

    if (!metaConfig.appId) {
      toast.error(i18n.t("connectionSuite.list.metaAppIdMissing"));
      return;
    }

    if (renderProps?.isProcessing || renderProps?.isDisabled) {
      return;
    }

    if (
      !renderProps?.isSdkLoaded ||
      typeof window === "undefined" ||
      !window.FB
    ) {
      toast.warn(
        i18n.t("connectionSuite.list.metaStarting")
      );
      return;
    }

    renderProps.onClick(event);
    if (popupState?.close) {
      popupState.close();
    }
  };

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    setLoadingComp(true);
    try {
      const companyList = await list();
      setCompanies(companyList);
    } catch (e) {
      toast.error("Não foi possível carregar a lista de registros");
    }
    setLoadingComp(false);
  };

  const handleStartWhatsAppSession = async (whatsAppId) => {
    try {
      await api.post(`/whatsappsession/${whatsAppId}`);
    } catch (err) {
      toastError(err);
    }
  };

  const handleRequestNewQrCode = async (whatsAppId) => {
    try {
      await api.put(`/whatsappsession/${whatsAppId}`);
    } catch (err) {
      toastError(err);
    }
  };

  const handleOpenWhatsAppModal = (whatsappsFilter, comp) => {
    setSelectedWhatsApp(null);
    setWhatsAppModalOpen(true);
    if (whatsappsFilter?.length > 0) {
      setFilterConnections(whatsappsFilter);
      setCompanyWhatsApps(comp);
    }
  };

  const handleCloseWhatsAppModal = useCallback(() => {
    setWhatsAppModalOpen(false);
    setSelectedWhatsApp(null);
    setFilterConnections([]);
    setCompanyWhatsApps(null);
  }, [setSelectedWhatsApp, setWhatsAppModalOpen]);

  const handleOpenQrModal = (whatsApp) => {
    setSelectedWhatsApp(whatsApp);
    setQrModalOpen(true);
  };

  const handleCloseQrModal = useCallback(() => {
    setSelectedWhatsApp(null);
    setQrModalOpen(false);
  }, [setQrModalOpen, setSelectedWhatsApp]);

  const handleEditWhatsApp = (whatsApp) => {
    setSelectedWhatsApp(whatsApp);
    setWhatsAppModalOpen(true);
  };

  const handleOpenConfirmationModal = (action, whatsAppId) => {
    if (action === "disconnect") {
      setConfirmModalInfo({
        action: action,
        title: i18n.t("connections.confirmationModal.disconnectTitle"),
        message: i18n.t("connections.confirmationModal.disconnectMessage"),
        whatsAppId: whatsAppId,
      });
    }

    if (action === "delete") {
      setConfirmModalInfo({
        action: action,
        title: i18n.t("connections.confirmationModal.deleteTitle"),
        message: i18n.t("connections.confirmationModal.deleteMessage"),
        whatsAppId: whatsAppId,
      });
    }

    setConfirmModalOpen(true);
  };

  const handleSubmitConfirmationModal = async () => {
    if (confirmModalInfo.action === "disconnect") {
      try {
        await api.delete(`/whatsappsession/${confirmModalInfo.whatsAppId}`);
      } catch (err) {
        toastError(err);
      }
    }

    if (confirmModalInfo.action === "delete") {
      try {
        await api.delete(`/whatsapp/${confirmModalInfo.whatsAppId}`);
        toast.success(i18n.t("connections.toasts.deleted"));
      } catch (err) {
        toastError(err);
      }
    }

    setConfirmModalInfo(confirmationModalInitialState);
  };

  const renderActionButtons = (whatsApp) => {
    return (
      <>
        {whatsApp.status === "qrcode" && (
          <Button
            size="small"
            variant="contained"
            color="primary"
            onClick={() => handleOpenQrModal(whatsApp)}
          >
            {i18n.t("connections.buttons.qrcode")}
          </Button>
        )}
        {(whatsApp.status === "DISCONNECTED" || whatsApp.status === "PENDING") && (
          <>
            <Button
              size="small"
              variant="outlined"
              color="primary"
              onClick={() => handleStartWhatsAppSession(whatsApp.id)}
            >
              {i18n.t("connections.buttons.tryAgain")}
            </Button>{" "}
            <Button
              size="small"
              variant="outlined"
              color="secondary"
              onClick={() => handleRequestNewQrCode(whatsApp.id)}
            >
              {i18n.t("connections.buttons.newQr")}
            </Button>
          </>
        )}
        {(whatsApp.status === "CONNECTED" ||
          whatsApp.status === "PAIRING" ||
          whatsApp.status === "TIMEOUT") && (
          <Button
            size="small"
            variant="outlined"
            color="secondary"
            onClick={() => {
              handleOpenConfirmationModal("disconnect", whatsApp.id);
            }}
          >
            {i18n.t("connections.buttons.disconnect")}
          </Button>
        )}
        {whatsApp.status === "OPENING" && (
          <Button size="small" variant="outlined" disabled color="default">
            {i18n.t("connections.buttons.connecting")}
          </Button>
        )}
      </>
    );
  };

  const renderStatusToolTips = (whatsApp) => {
    return (
      <div className={classes.customTableCell}>
        {(whatsApp.status === "DISCONNECTED" || whatsApp.status === "PENDING") && (
          <CustomToolTip
            title={i18n.t("connections.toolTips.disconnected.title")}
            content={i18n.t("connections.toolTips.disconnected.content")}
          >
            <SignalCellularConnectedNoInternet0Bar color="secondary" />
          </CustomToolTip>
        )}
        {whatsApp.status === "OPENING" && (
          <CircularProgress size={24} className={classes.buttonProgress} />
        )}
        {whatsApp.status === "qrcode" && (
          <CustomToolTip
            title={i18n.t("connections.toolTips.qrcode.title")}
            content={i18n.t("connections.toolTips.qrcode.content")}
          >
            <CropFree />
          </CustomToolTip>
        )}
        {whatsApp.status === "CONNECTED" && (
          <CustomToolTip title={i18n.t("connections.toolTips.connected.title")}>
            <SignalCellular4Bar style={{ color: green[500] }} />
          </CustomToolTip>
        )}
        {(whatsApp.status === "TIMEOUT" || whatsApp.status === "PAIRING") && (
          <CustomToolTip
            title={i18n.t("connections.toolTips.timeout.title")}
            content={i18n.t("connections.toolTips.timeout.content")}
          >
            <SignalCellularConnectedNoInternet2Bar color="secondary" />
          </CustomToolTip>
        )}
      </div>
    );
  };

  return (
    <MainContainer>
      <ConfirmationModal
        title={confirmModalInfo.title}
        open={confirmModalOpen}
        onClose={setConfirmModalOpen}
        onConfirm={handleSubmitConfirmationModal}
      >
        {confirmModalInfo.message}
      </ConfirmationModal>
      <QrcodeModal
        open={qrModalOpen}
        onClose={handleCloseQrModal}
        whatsAppId={!whatsAppModalOpen && selectedWhatsApp?.id}
      />
      <WhatsAppModalCompany
        open={whatsAppModalOpen}
        onClose={handleCloseWhatsAppModal}
        filteredWhatsapps={filterConnections}
        companyInfos={companyWhatsApps}
        whatsAppId={!qrModalOpen && selectedWhatsApp?.id}
      />
      {user.profile === "user" ? (
        <ForbiddenPage />
      ) : (
        <>
          <Paper
            className={classes.mainPaper}
            style={{ overflow: "hidden" }}
            variant="outlined"
          >
            <MainHeader>
              <Stack>
                <Typography
                  variant="h5"
                  color="black"
                  style={{
                    fontWeight: "bold",
                    marginLeft: "10px",
                    marginTop: "10px",
                  }}
                  gutterBottom
                >
                  {i18n.t("connections.title")}
                </Typography>
                <Typography
                  style={{ marginTop: "-10px", marginLeft: "10px" }}
                  variant="caption"
                  color="textSecondary"
                >
                  {i18n.t(
                    "connections.connectYourServiceChannelsToReceiveMessagesAndStartConversationsWithYourCustomers"
                  )}
                </Typography>
              </Stack>
              <MainHeaderButtonsWrapper>
                <PopupState variant="popover" popupId="demo-popup-menu">
                  {(popupState) => (
                    <React.Fragment>
                      <Button
                        variant="contained"
                        color="primary"
                        {...bindTrigger(popupState)}
                      >
                        {i18n.t("connections.newConnection")}
                      </Button>
                      <Menu {...bindMenu(popupState)}>
                        <MenuItem
                          onClick={() => {
                            handleOpenWhatsAppModal();
                            popupState.close();
                          }}
                        >
                          <WhatsApp
                            fontSize="small"
                            style={{
                              marginRight: "10px",
                            }}
                          />
                          WhatsApp
                        </MenuItem>
                        <FacebookLogin
                          appId={metaConfig.appId}
                          autoLoad={false}
                          fields="name,email,picture"
                          version={metaConfig.sdkVersion}
                          disableMobileRedirect={true}
                          scope={
                            metaConfig.requireBusinessManagement
                              ? "public_profile,pages_messaging,pages_show_list,pages_manage_metadata,pages_read_engagement,business_management"
                              : "public_profile,pages_messaging,pages_show_list,pages_manage_metadata,pages_read_engagement"
                          }
                          callback={responseFacebook}
                          render={(renderProps) => (
                            <MenuItem
                              disabled={metaConfig.loading || !metaConfig.appId}
                              onClick={(event) =>
                                handleMetaLoginClick(event, renderProps, popupState)
                              }
                            >
                              <Facebook
                                fontSize="small"
                                style={{
                                  marginRight: "10px",
                                  opacity: renderProps?.isSdkLoaded ? 1 : 0.6,
                                }}
                              />
                              {!metaConfig.appId
                                ? "Configure a Meta no sistema"
                                : renderProps?.isProcessing
                                ? "Conectando Facebook..."
                                : !renderProps?.isSdkLoaded
                                ? "Carregando Facebook..."
                                : i18n.t("compaies.table.useFacebook")}
                            </MenuItem>
                          )}
                        />
                        <FacebookLogin
                          appId={metaConfig.appId}
                          autoLoad={false}
                          fields="name,email,picture"
                          version={metaConfig.sdkVersion}
                          disableMobileRedirect={true}
                          scope={
                            metaConfig.requireBusinessManagement
                              ? "public_profile,instagram_basic,instagram_manage_messages,pages_messaging,pages_show_list,pages_manage_metadata,pages_read_engagement,business_management"
                              : "public_profile,instagram_basic,instagram_manage_messages,pages_messaging,pages_show_list,pages_manage_metadata,pages_read_engagement"
                          }
                          callback={responseInstagram}
                          render={(renderProps) => (
                            <MenuItem
                              disabled={metaConfig.loading || !metaConfig.appId}
                              onClick={(event) =>
                                handleMetaLoginClick(event, renderProps, popupState)
                              }
                            >
                              <Instagram
                                fontSize="small"
                                style={{
                                  marginRight: "10px",
                                  opacity: renderProps?.isSdkLoaded ? 1 : 0.6,
                                }}
                              />
                              {!metaConfig.appId
                                ? "Configure a Meta no sistema"
                                : renderProps?.isProcessing
                                ? "Conectando Instagram..."
                                : !renderProps?.isSdkLoaded
                                ? "Carregando Instagram..."
                                : i18n.t("compaies.table.useInstagram")}
                            </MenuItem>
                          )}
                        />
                      </Menu>
                    </React.Fragment>
                  )}
                </PopupState>
              </MainHeaderButtonsWrapper>
            </MainHeader>
            <Stack
              style={{
                overflowY: "auto",
                padding: "20px",
                backgroundColor: "rgb(244 244 244 / 53%)",
                borderRadius: "5px",
                height: "93%",
              }}
            >
              <Paper>
                <Table size="small">
                  <TableHead className={classes.TableHead}>
                    <TableRow style={{ color: "#fff" }}>
                      <TableCell style={{ color: "#fff" }} align="center">
                        {i18n.t("connections.client")}
                      </TableCell>
                      <TableCell style={{ color: "#fff" }} align="center">
                        {i18n.t("connections.connectedConnections")}
                      </TableCell>
                      <TableCell style={{ color: "#fff" }} align="center">
                        {i18n.t("connections.disconnectedConnections")}
                      </TableCell>
                      <TableCell style={{ color: "#fff" }} align="center">
                        {i18n.t("connections.totalConnections")}
                      </TableCell>
                      {user.profile === "admin" && (
                        <TableCell style={{ color: "#fff" }} align="center">
                          {i18n.t("connections.table.actions")}
                        </TableCell>
                      )}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loadingWhatsapp ? (
                      <TableRowSkeleton />
                    ) : (
                      <>
                        {companies?.length > 0 &&
                          companies.map((company) => (
                            <TableRow key={company.id}>
                              <TableCell align="center">{company?.name}</TableCell>
                              <TableCell align="center">
                                {whats?.length &&
                                  whats.filter(
                                    (item) =>
                                      item?.companyId === company?.id &&
                                      item?.status === "CONNECTED"
                                  ).length}
                              </TableCell>
                              <TableCell align="center">
                                {whats?.length &&
                                  whats.filter(
                                    (item) =>
                                      item?.companyId === company?.id &&
                                      item?.status !== "CONNECTED"
                                  ).length}
                              </TableCell>
                              <TableCell align="center">
                                {whats?.length &&
                                  whats.filter(
                                    (item) => item?.companyId === company?.id
                                  ).length}
                              </TableCell>
                              {user.profile === "admin" && (
                                <TableCell align="center">
                                  <IconButton
                                    size="small"
                                    onClick={() =>
                                      handleOpenWhatsAppModal(
                                        whats.filter(
                                          (item) => item?.companyId === company?.id
                                        ),
                                        company
                                      )
                                    }
                                  >
                                    <Edit />
                                  </IconButton>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        <TableRow className={classes.TableHead}>
                          <TableCell style={{ color: "#fff" }} align="center">
                            {i18n.t("connections.total")}
                          </TableCell>
                          <TableCell style={{ color: "#fff" }} align="center">
                            {whats?.length &&
                              whats.filter((item) => item?.status === "CONNECTED")
                                .length}
                          </TableCell>
                          <TableCell style={{ color: "#fff" }} align="center">
                            {whats?.length &&
                              whats.filter((item) => item?.status !== "CONNECTED")
                                .length}
                          </TableCell>
                          <TableCell style={{ color: "#fff" }} align="center">
                            {whats?.length && whats.length}
                          </TableCell>
                          {user.profile === "admin" && (
                            <TableCell
                              style={{ color: "#fff" }}
                              align="center"
                            ></TableCell>
                          )}
                        </TableRow>
                      </>
                    )}
                  </TableBody>
                </Table>
              </Paper>
            </Stack>
          </Paper>
        </>
      )}
    </MainContainer>
  );
};

export default AllConnections;
