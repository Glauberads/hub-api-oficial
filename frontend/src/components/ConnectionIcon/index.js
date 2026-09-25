import React from "react";
import TelegramIcon from "../TelegramIcon";

import { grey } from "@material-ui/core/colors";
import WhatsAppIcon from "@material-ui/icons/WhatsApp";
import InstagramIcon from "@material-ui/icons/Instagram";
import FacebookIcon from "@material-ui/icons/Facebook";

const ConnectionIcon = ({ connectionType, width, height, className, style }) => {

  if (connectionType === "telegram") {
    return (
      <TelegramIcon
        size={parseInt(width || height, 10) || 18}
        className={className}
        style={style}
      />
    );
  }

  return (
        <React.Fragment>
            {connectionType === 'whatsapp' && <WhatsAppIcon fontSize="small" style={{ marginBottom: '-5px', color: "#25D366" }} />}
            {connectionType === 'instagram' && <InstagramIcon fontSize="small" style={{ marginBottom: '-5px', color: "#e1306c" }} />}
            {connectionType === 'facebook' && <FacebookIcon fontSize="small" style={{ marginBottom: '-5px', color: "#3b5998" }} />}
        </React.Fragment>
    );
};

export default ConnectionIcon;
