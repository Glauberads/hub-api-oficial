import React from "react";

import MenuItem from "@material-ui/core/MenuItem";
import FormControl from "@material-ui/core/FormControl";
import Select from "@material-ui/core/Select";
import { Checkbox, ListItemText, Typography } from "@material-ui/core";
import { i18n } from "../../translate/i18n";
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles((theme) => {
  const isDark = theme.palette.type === "dark" || theme.palette.mode === "dark";

  return {
    menuListItem: {
      paddingTop: 6,
      paddingBottom: 6,
    },

    menuItem: {
      minHeight: 42,
      borderRadius: 10,
      margin: "2px 6px",
      paddingLeft: 6,
      paddingRight: 8,
      "&:hover": {
        backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.04)",
      },
      "&.Mui-selected": {
        backgroundColor: isDark ? "rgba(16,170,98,0.12)" : "rgba(16,170,98,0.08)",
      },
      "&.Mui-selected:hover": {
        backgroundColor: isDark ? "rgba(16,170,98,0.16)" : "rgba(16,170,98,0.12)",
      },
    },

    queueSelectContainer: {
      minWidth: 150,
      maxWidth: 240,
      width: "100%",
      marginTop: 0,
      [theme.breakpoints.down("sm")]: {
        minWidth: 120,
        maxWidth: 180,
      },
    },

    formControl: {
      width: "100%",
      margin: 0,
    },

    selectRoot: {
      borderRadius: 12,
      minHeight: 38,
      background: isDark ? "rgba(255,255,255,0.04)" : "#fff",
      boxShadow: isDark
        ? "0 4px 10px rgba(0,0,0,0.18)"
        : "0 4px 10px rgba(15,23,42,0.05)",
      "& .MuiOutlinedInput-notchedOutline": {
        borderColor: theme.palette.divider,
      },
      "&:hover .MuiOutlinedInput-notchedOutline": {
        borderColor: isDark ? "#FFF" : theme.palette.primary.main,
      },
      "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
        borderColor: isDark ? "#FFF" : theme.palette.primary.main,
        borderWidth: 1,
      },
      [theme.breakpoints.down("sm")]: {
        minHeight: 34,
      },
    },

    select: {
      display: "flex",
      alignItems: "center",
      paddingTop: 8,
      paddingBottom: 8,
      paddingLeft: 12,
      paddingRight: 32,
      fontSize: "0.92rem",
      fontWeight: 600,
      color: theme.palette.text.primary,
      [theme.breakpoints.down("sm")]: {
        fontSize: "0.84rem",
        paddingLeft: 10,
      },
    },

    placeholderText: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      minWidth: 0,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      color: theme.palette.text.primary,
      fontWeight: 600,
    },

    countText: {
      color: isDark ? "#d1d5db" : "#64748b",
      fontWeight: 700,
      fontSize: "0.78rem",
      marginLeft: 4,
      flexShrink: 0,
    },

    listItemText: {
      fontSize: "0.88rem",
      fontWeight: 500,
      color: theme.palette.text.primary,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },

    checkboxRoot: {
      padding: 6,
      marginRight: 6,
    },

    menuPaper: {
      marginTop: 6,
      borderRadius: 14,
      background: isDark ? "#1f2937" : "#ffffff",
      border: `1px solid ${theme.palette.divider}`,
      boxShadow: isDark
        ? "0 12px 28px rgba(0,0,0,0.32)"
        : "0 12px 28px rgba(15,23,42,0.12)",
      overflow: "hidden",
    },
  };
});

const TicketsQueueSelect = ({
  userQueues,
  selectedQueueIds = [],
  onChange,
}) => {
  const classes = useStyles();

  const handleChange = (e) => {
    onChange(e.target.value);
  };

  const renderSelectedValue = () => {
    const total = selectedQueueIds?.length || 0;
    const placeholder = i18n.t("ticketsQueueSelect.placeholder");

    return (
      <div className={classes.placeholderText}>
        <span>{placeholder}</span>
        {total > 0 && (
          <Typography component="span" className={classes.countText}>
            ({total})
          </Typography>
        )}
      </div>
    );
  };

  return (
    <div className={classes.queueSelectContainer}>
      <FormControl className={classes.formControl} variant="outlined">
        <Select
          multiple
          displayEmpty
          variant="outlined"
          value={selectedQueueIds}
          onChange={handleChange}
          className={classes.selectRoot}
          classes={{
            select: classes.select,
          }}
          MenuProps={{
            anchorOrigin: {
              vertical: "bottom",
              horizontal: "center",
            },
            transformOrigin: {
              vertical: "top",
              horizontal: "center",
            },
            getContentAnchorEl: null,
            PaperProps: {
              className: classes.menuPaper,
            },
            MenuListProps: {
              className: classes.menuListItem,
            },
          }}
          renderValue={renderSelectedValue}
        >
          {userQueues?.length > 0 &&
            userQueues.map((queue) => (
              <MenuItem
                dense
                key={queue.id}
                value={queue.id}
                className={classes.menuItem}
              >
                <Checkbox
                  className={classes.checkboxRoot}
                  style={{
                    color: queue.color,
                  }}
                  size="small"
                  color="primary"
                  checked={selectedQueueIds.indexOf(queue.id) > -1}
                />
                <ListItemText
                  primary={queue.name}
                  classes={{ primary: classes.listItemText }}
                />
              </MenuItem>
            ))}
        </Select>
      </FormControl>
    </div>
  );
};

export default TicketsQueueSelect;