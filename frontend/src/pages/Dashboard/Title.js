import React from "react";
import Typography from "@material-ui/core/Typography";
import { useTheme } from "@material-ui/core/styles";

const Title = ({ children, subtitle, style = {}, ...rest }) => {
  const theme = useTheme();

  return (
    <div style={{ marginBottom: 12 }}>
      <Typography
        component="h2"
        variant="h6"
        gutterBottom
        {...rest}
        style={{
          color: theme.palette.text.primary,
          fontWeight: 800,
          fontSize: "1.05rem",
          lineHeight: 1.2,
          marginBottom: subtitle ? 4 : 0,
          ...style,
        }}
      >
        {children}
      </Typography>

      {subtitle ? (
        <Typography
          variant="body2"
          style={{
            color: theme.palette.text.secondary,
            fontSize: "0.86rem",
            lineHeight: 1.4,
          }}
        >
          {subtitle}
        </Typography>
      ) : null}
    </div>
  );
};

export default Title;