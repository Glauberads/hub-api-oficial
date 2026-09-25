import React from "react";

import { makeStyles } from "@material-ui/core/styles";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import ListItemAvatar from "@material-ui/core/ListItemAvatar";
import Skeleton from "@material-ui/lab/Skeleton";

const useStyles = makeStyles((theme) => {
  const isDark = theme.palette.type === "dark" || theme.palette.mode === "dark";

  return {
    skeletonWrapper: {
      padding: "4px 6px 10px 6px",
    },

    skeletonCard: {
      position: "relative",
      marginBottom: 12,
      padding: "14px 112px 14px 14px",
      borderRadius: 20,
      border: `1px solid ${theme.palette.divider}`,
      background: isDark ? "rgba(255,255,255,0.03)" : "#ffffff",
      boxShadow: isDark
        ? "0 8px 22px rgba(0,0,0,0.25)"
        : "0 8px 24px rgba(15, 23, 42, 0.08)",
      overflow: "hidden",
      alignItems: "flex-start",
      [theme.breakpoints.down("sm")]: {
        padding: "12px 98px 12px 12px",
        marginBottom: 10,
      },
    },

    queueBar: {
      width: 6,
      height: "calc(100% - 16px)",
      position: "absolute",
      top: 8,
      left: 0,
      borderRadius: "0 999px 999px 0",
      background: isDark ? "rgba(255,255,255,0.10)" : "rgba(15,23,42,0.10)",
    },

    avatarSection: {
      minWidth: 62,
      marginRight: 8,
      marginTop: 2,
      [theme.breakpoints.down("sm")]: {
        minWidth: 58,
        marginRight: 6,
      },
    },

    avatarSkeleton: {
      transform: "none",
      borderRadius: "50%",
    },

    listItemTextRoot: {
      flex: 1,
      minWidth: 0,
      margin: 0,
    },

    titleRow: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginBottom: 8,
      minWidth: 0,
    },

    previewRow: {
      marginBottom: 10,
    },

    chipsRow: {
      display: "flex",
      flexWrap: "wrap",
      gap: 6,
      marginBottom: 6,
    },

    tagsRow: {
      display: "flex",
      flexWrap: "wrap",
      gap: 6,
    },

    chipSkeleton: {
      transform: "none",
      borderRadius: 999,
    },

    rightColumn: {
      position: "absolute",
      top: 12,
      right: 10,
      width: 84,
      minWidth: 84,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      [theme.breakpoints.down("sm")]: {
        width: 74,
        minWidth: 74,
        right: 8,
      },
    },

    timeSkeleton: {
      transform: "none",
      borderRadius: 8,
      marginBottom: 12,
    },

    unreadSkeleton: {
      transform: "none",
      borderRadius: 999,
      marginBottom: 10,
    },

    actionsRow: {
      display: "flex",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: 6,
      width: "100%",
    },

    actionSkeleton: {
      transform: "none",
      borderRadius: "50%",
    },
  };
});

const TicketsListSkeleton = () => {
  const classes = useStyles();

  const items = [1, 2, 3, 4];

  return (
    <div className={classes.skeletonWrapper}>
      {items.map((item) => (
        <ListItem key={item} dense className={classes.skeletonCard}>
          <span className={classes.queueBar} />

          <ListItemAvatar className={classes.avatarSection}>
            <Skeleton
              animation="wave"
              variant="circle"
              width={56}
              height={56}
              className={classes.avatarSkeleton}
            />
          </ListItemAvatar>

          <ListItemText
            classes={{ root: classes.listItemTextRoot }}
            primary={
              <div className={classes.titleRow}>
                <Skeleton animation="wave" height={18} width={18} />
                <Skeleton animation="wave" height={20} width="58%" />
              </div>
            }
            secondary={
              <>
                <div className={classes.previewRow}>
                  <Skeleton animation="wave" height={18} width="88%" />
                </div>

                <div className={classes.chipsRow}>
                  <Skeleton
                    animation="wave"
                    height={24}
                    width={84}
                    className={classes.chipSkeleton}
                  />
                  <Skeleton
                    animation="wave"
                    height={24}
                    width={72}
                    className={classes.chipSkeleton}
                  />
                  <Skeleton
                    animation="wave"
                    height={24}
                    width={66}
                    className={classes.chipSkeleton}
                  />
                </div>

                <div className={classes.tagsRow}>
                  <Skeleton
                    animation="wave"
                    height={22}
                    width={58}
                    className={classes.chipSkeleton}
                  />
                  <Skeleton
                    animation="wave"
                    height={22}
                    width={76}
                    className={classes.chipSkeleton}
                  />
                </div>
              </>
            }
          />

          <div className={classes.rightColumn}>
            <Skeleton
              animation="wave"
              width={52}
              height={16}
              className={classes.timeSkeleton}
            />

            <Skeleton
              animation="wave"
              width={34}
              height={34}
              className={classes.unreadSkeleton}
            />

            <div className={classes.actionsRow}>
              <Skeleton
                animation="wave"
                variant="circle"
                width={34}
                height={34}
                className={classes.actionSkeleton}
              />
              <Skeleton
                animation="wave"
                variant="circle"
                width={34}
                height={34}
                className={classes.actionSkeleton}
              />
            </div>
          </div>
        </ListItem>
      ))}
    </div>
  );
};

export default TicketsListSkeleton;