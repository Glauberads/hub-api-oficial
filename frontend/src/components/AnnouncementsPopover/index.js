import React, { useEffect, useReducer, useState, useContext, useRef } from "react";
import { makeStyles } from "@material-ui/core/styles";
import toastError from "../../errors/toastError";
import Popover from "@material-ui/core/Popover";
import AnnouncementIcon from "@material-ui/icons/Announcement";
import NotificationsActiveIcon from "@material-ui/icons/NotificationsActive";
import NotificationsNoneIcon from "@material-ui/icons/NotificationsNone";
import PriorityHighIcon from "@material-ui/icons/PriorityHigh";
import FiberManualRecordIcon from "@material-ui/icons/FiberManualRecord";
import CloseIcon from "@material-ui/icons/Close";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";

import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";

import {
  Avatar,
  Badge,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Paper,
  Typography,
  Divider,
  Box,
  Chip,
  Collapse,
  Button,
  Fade,
  useTheme,
  alpha,
} from "@material-ui/core";
import api from "../../services/api";
import { isArray } from "lodash";
import moment from "moment";
import clsx from "clsx";

const useStyles = makeStyles((theme) => ({
  iconButton: {
    transition: "all 0.3s ease",
    "&:hover": {
      transform: "scale(1.05)",
      backgroundColor: alpha(theme.palette.primary.main, 0.1),
    },
  },
  badge: {
    "& .MuiBadge-badge": {
      animation: "$pulse 1.5s infinite",
    },
  },
  "@keyframes pulse": {
    "0%": {
      transform: "scale(0.95)",
      opacity: 0.7,
    },
    "70%": {
      transform: "scale(1.2)",
      opacity: 0.5,
    },
    "100%": {
      transform: "scale(0.95)",
      opacity: 0.7,
    },
  },
  popoverPaper: {
    borderRadius: 16,
    marginTop: theme.spacing(1),
    boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
    overflow: "hidden",
    minWidth: 380,
    maxWidth: 450,
    [theme.breakpoints.down("sm")]: {
      minWidth: 320,
      maxWidth: 380,
    },
  },
  header: {
    padding: theme.spacing(2),
    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
    color: theme.palette.primary.contrastText,
  },
  headerTitle: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitleText: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    fontWeight: 600,
    fontSize: "1.1rem",
  },
  closeButton: {
    color: theme.palette.primary.contrastText,
    "&:hover": {
      backgroundColor: alpha(theme.palette.common.white, 0.2),
    },
  },
  counter: {
    backgroundColor: alpha(theme.palette.common.white, 0.25),
    borderRadius: 20,
    padding: "2px 8px",
    fontSize: "0.75rem",
    fontWeight: 500,
  },
  listContainer: {
    maxHeight: 420,
    overflowY: "auto",
    ...theme.scrollbarStyles,
  },
  listItem: {
    transition: "all 0.2s ease",
    "&:hover": {
      backgroundColor: alpha(theme.palette.primary.main, 0.04),
      transform: "translateX(4px)",
    },
    cursor: "pointer",
    alignItems: "flex-start",
    padding: theme.spacing(2),
    position: "relative",
  },
  listItemSelected: {
    backgroundColor: alpha(theme.palette.primary.main, 0.08),
  },
  priorityIndicator: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderRadius: "2px 0 0 2px",
  },
  priorityChip: {
    height: 24,
    fontSize: "0.7rem",
    marginRight: theme.spacing(1),
  },
  dateChip: {
    backgroundColor: alpha(theme.palette.text.secondary, 0.08),
    fontSize: "0.7rem",
    height: 24,
  },
  expandButton: {
    transition: "transform 0.2s ease",
    marginLeft: "auto",
    padding: theme.spacing(0.5),
    "&:hover": {
      backgroundColor: alpha(theme.palette.primary.main, 0.08),
    },
  },
  expandButtonExpanded: {
    transform: "rotate(180deg)",
  },
  contentCollapse: {
    marginTop: theme.spacing(1.5),
  },
  mediaPreview: {
    marginTop: theme.spacing(1),
    borderRadius: 12,
    overflow: "hidden",
    maxWidth: "100%",
    cursor: "pointer",
    transition: "transform 0.2s ease",
    "&:hover": {
      transform: "scale(1.02)",
    },
  },
  mediaImage: {
    width: "100%",
    height: "auto",
    maxHeight: 200,
    objectFit: "cover",
  },
  emptyState: {
    padding: theme.spacing(4),
    textAlign: "center",
    color: theme.palette.text.secondary,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: theme.spacing(1),
    opacity: 0.5,
  },
  loadMoreButton: {
    margin: theme.spacing(2),
    textAlign: "center",
  },
}));

const getPriorityConfig = (priority) => {
  switch (priority) {
    case 1:
      return { color: "#f44336", label: "Alta", icon: <PriorityHighIcon fontSize="small" /> };
    case 2:
      return { color: "#ff9800", label: "Média", icon: <FiberManualRecordIcon fontSize="small" /> };
    case 3:
      return { color: "#9e9e9e", label: "Baixa", icon: <FiberManualRecordIcon fontSize="small" /> };
    default:
      return { color: "#9e9e9e", label: "Normal", icon: <FiberManualRecordIcon fontSize="small" /> };
  }
};

const renderTextWithLinks = (text = "") => {
  if (!text) return null;

  const urlRegex = /(?:https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;
  const elements = [];
  let lastIndex = 0;
  let match;

  while ((match = urlRegex.exec(text)) !== null) {
    const rawUrl = match[0];
    const start = match.index;

    if (start > lastIndex) {
      elements.push(
        <React.Fragment key={`text-${start}`}>
          {text.slice(lastIndex, start)}
        </React.Fragment>
      );
    }

    let url = rawUrl;
    let trailing = "";

    while (/[),.;!?]$/.test(url)) {
      trailing = url.slice(-1) + trailing;
      url = url.slice(0, -1);
    }

    const href = url.startsWith("http") ? url : `https://${url}`;

    elements.push(
      <a
        key={`link-${start}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        style={{
          color: "#1976d2",
          textDecoration: "underline",
          wordBreak: "break-word",
        }}
      >
        {url}
      </a>
    );

    if (trailing) {
      elements.push(
        <React.Fragment key={`trail-${start}`}>
          {trailing}
        </React.Fragment>
      );
    }

    lastIndex = start + rawUrl.length;
  }

  if (lastIndex < text.length) {
    elements.push(
      <React.Fragment key="text-end">
        {text.slice(lastIndex)}
      </React.Fragment>
    );
  }

  return elements;
};

const reducer = (state, action) => {
  if (action.type === "LOAD_ANNOUNCEMENTS") {
    const announcements = action.payload;
    const newAnnouncements = [];

    if (isArray(announcements)) {
      announcements.forEach((announcement) => {
        const announcementIndex = state.findIndex((u) => u.id === announcement.id);
        if (announcementIndex !== -1) {
          state[announcementIndex] = announcement;
        } else {
          newAnnouncements.push(announcement);
        }
      });
    }

    return [...state, ...newAnnouncements];
  }

  if (action.type === "UPDATE_ANNOUNCEMENTS") {
    const announcement = action.payload;
    const announcementIndex = state.findIndex((u) => u.id === announcement.id);

    if (announcementIndex !== -1) {
      state[announcementIndex] = announcement;
      return [...state];
    } else {
      return [announcement, ...state];
    }
  }

  if (action.type === "DELETE_ANNOUNCEMENT") {
    const announcementId = action.payload;
    const announcementIndex = state.findIndex((u) => u.id === announcementId);

    if (announcementIndex !== -1) {
      state.splice(announcementIndex, 1);
    }

    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }

  return state;
};

export default function AnnouncementsPopover() {
  const classes = useStyles();
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [searchParam] = useState("");
  const [announcements, dispatch] = useReducer(reducer, []);
  const [invisible, setInvisible] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const listRef = useRef(null);

  const { user, socket } = useContext(AuthContext);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      fetchAnnouncements();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParam, pageNumber]);

  useEffect(() => {
    if (user.companyId && socket) {
      const onCompanyAnnouncement = (data) => {
        if (data.action === "update" || data.action === "create") {
          dispatch({ type: "UPDATE_ANNOUNCEMENTS", payload: data.record });
          setInvisible(false);
        }

        if (data.action === "delete") {
          dispatch({ type: "DELETE_ANNOUNCEMENT", payload: +data.id });
        }
      };

      socket.on("company-announcement", onCompanyAnnouncement);

      return () => {
        socket.off("company-announcement", onCompanyAnnouncement);
      };
    }

    return undefined;
  }, [user, socket]);

  const fetchAnnouncements = async () => {
    try {
      const { data } = await api.get("/announcements/for-company", {
        params: { searchParam, pageNumber },
      });

      dispatch({ type: "LOAD_ANNOUNCEMENTS", payload: data.records });
      setHasMore(data.hasMore);
      setLoading(false);
    } catch (err) {
      toastError(err);
      setLoading(false);
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

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
    setInvisible(true);
  };

  const handleClose = () => {
    setAnchorEl(null);
    setExpandedId(null);
  };

  const handleToggleExpand = (id) => (e) => {
    e.stopPropagation();
    setExpandedId(expandedId === id ? null : id);
  };

  const handleItemClick = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const open = Boolean(anchorEl);
  const popoverId = open ? "announcements-popover" : undefined;
  const unreadCount = announcements.length;

  return (
    <>
      <IconButton
        aria-describedby={popoverId}
        onClick={handleClick}
        className={classes.iconButton}
        aria-label="Anúncios"
      >
        <Badge
          color="error"
          variant="dot"
          invisible={invisible || unreadCount === 0}
          className={unreadCount > 0 ? classes.badge : undefined}
          invisible={unreadCount === 0}
        >
          <AnnouncementIcon style={{ color: "white" }} />
        </Badge>
      </IconButton>

      <Popover
        id={popoverId}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        PaperProps={{
          className: classes.popoverPaper,
        }}
        TransitionComponent={Fade}
        TransitionProps={{ timeout: 300 }}
      >
        <div className={classes.header}>
          <div className={classes.headerTitle}>
            <div className={classes.headerTitleText}>
              <NotificationsActiveIcon />
              <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
                Anúncios
              </Typography>
              {unreadCount > 0 && (
                <span className={classes.counter}>
                  {unreadCount} {unreadCount === 1 ? "novo" : "novos"}
                </span>
              )}
            </div>

            <IconButton
              size="small"
              onClick={handleClose}
              className={classes.closeButton}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </div>
        </div>

        <div
          ref={listRef}
          onScroll={handleScroll}
          className={classes.listContainer}
        >
          <List component="nav" disablePadding>
            {announcements.map((item) => {
              const priorityConfig = getPriorityConfig(item.priority);
              const isExpanded = expandedId === item.id;
              const hasMedia = !!item.mediaPath;

              return (
                <React.Fragment key={item.id}>
                  <ListItem
                    button
                    onClick={() => handleItemClick(item.id)}
                    className={clsx(classes.listItem, {
                      [classes.listItemSelected]: isExpanded,
                    })}
                  >
                    <div
                      className={classes.priorityIndicator}
                      style={{ backgroundColor: priorityConfig.color }}
                    />

                    {item.mediaPath && (
                      <ListItemAvatar>
                        <Avatar
                          src={item.mediaPath}
                          variant="rounded"
                          style={{ borderRadius: 12 }}
                        />
                      </ListItemAvatar>
                    )}

                    <ListItemText
                      disableTypography
                      primary={
                        <Box display="flex" alignItems="center" flexWrap="wrap" gridGap={8} mb={0.5}>
                          <Chip
                            size="small"
                            label={priorityConfig.label}
                            icon={priorityConfig.icon}
                            className={classes.priorityChip}
                            style={{
                              backgroundColor: alpha(priorityConfig.color, 0.1),
                              color: priorityConfig.color,
                              borderColor: alpha(priorityConfig.color, 0.3),
                            }}
                            variant="outlined"
                          />
                          <Chip
                            size="small"
                            label={moment(item.createdAt).format("DD/MM/YYYY")}
                            className={classes.dateChip}
                            icon={<NotificationsNoneIcon style={{ fontSize: 14 }} />}
                          />
                        </Box>
                      }
                      secondary={
                        <>
                          <Typography
                            variant="body1"
                            style={{
                              fontWeight: 600,
                              marginBottom: 4,
                              color: theme.palette.text.primary,
                            }}
                          >
                            {item.title}
                          </Typography>

                          <Typography
                            component="div"
                            variant="body2"
                            style={{
                              color: theme.palette.text.secondary,
                              display: "-webkit-box",
                              WebkitLineClamp: isExpanded ? "unset" : 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                              lineHeight: 1.5,
                              wordBreak: "break-word",
                              whiteSpace: "pre-line",
                            }}
                          >
                            {renderTextWithLinks(item.text)}
                          </Typography>

                          <Collapse in={isExpanded} className={classes.contentCollapse}>
                            {hasMedia && (
                              <div
                                className={classes.mediaPreview}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(item.mediaPath, "_blank");
                                }}
                              >
                                {item.mediaPath.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                                  <img
                                    src={item.mediaPath}
                                    alt="Anexo"
                                    className={classes.mediaImage}
                                  />
                                ) : (
                                  <Box
                                    p={2}
                                    bgcolor={alpha(theme.palette.primary.main, 0.08)}
                                    borderRadius={2}
                                    textAlign="center"
                                  >
                                    <Typography variant="caption">
                                      📎 Clique para visualizar anexo
                                    </Typography>
                                  </Box>
                                )}
                              </div>
                            )}
                          </Collapse>
                        </>
                      }
                    />

                    <IconButton
                      size="small"
                      onClick={handleToggleExpand(item.id)}
                      className={clsx(classes.expandButton, {
                        [classes.expandButtonExpanded]: isExpanded,
                      })}
                    >
                      <ExpandMoreIcon fontSize="small" />
                    </IconButton>
                  </ListItem>

                  <Divider variant="inset" component="li" />
                </React.Fragment>
              );
            })}

            {announcements.length === 0 && !loading && (
              <div className={classes.emptyState}>
                <NotificationsNoneIcon className={classes.emptyIcon} />
                <Typography variant="body2" color="textSecondary">
                  {i18n.t("mainDrawer.appBar.notRegister")}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  Novos anúncios aparecerão aqui
                </Typography>
              </div>
            )}

            {loading && (
              <div className={classes.emptyState}>
                <Typography variant="body2" color="textSecondary">
                  Carregando anúncios...
                </Typography>
              </div>
            )}

            {hasMore && !loading && announcements.length > 0 && (
              <div className={classes.loadMoreButton}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={loadMore}
                  disabled={loading}
                >
                  Carregar mais
                </Button>
              </div>
            )}
          </List>
        </div>
      </Popover>
    </>
  );
}