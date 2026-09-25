import React from "react";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Typography from "@material-ui/core/Typography";
import Portal from "@material-ui/core/Portal";
import { useTheme, useMediaQuery } from "@material-ui/core";

import { i18n } from "../../translate/i18n";

const ConfirmationModal = ({ title, children, open, onClose, onConfirm }) => {
	const theme = useTheme();
	const isMobile = useMediaQuery(theme.breakpoints.down('md'));

	const handleConfirm = () => {
		console.log('[ConfirmationModal] Confirmando exclusão');
		onClose(false);
		onConfirm();
	};

	const handleCancel = () => {
		console.log('[ConfirmationModal] Cancelando exclusão');
		onClose(false);
	};

	return (
		<Portal container={document.body}>
			<Dialog
				open={open}
				onClose={(event, reason) => {
					console.log('[ConfirmationModal] Dialog onClose, reason:', reason);
					if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
						handleCancel();
					}
				}}
				aria-labelledby="confirm-dialog"
				disableEnforceFocus={true}
				disableAutoFocus={true}
				disableRestoreFocus={true}
				fullWidth={isMobile}
				maxWidth={isMobile ? false : "sm"}
				PaperProps={{
					style: {
						zIndex: 10003,
						position: 'fixed',
						margin: isMobile ? '16px' : '24px',
						maxWidth: isMobile ? 'calc(100% - 32px)' : '400px',
						width: isMobile ? 'calc(100% - 32px)' : 'auto'
					}
				}}
				BackdropProps={{
					style: {
						zIndex: 10002,
						backgroundColor: 'rgba(0, 0, 0, 0.5)',
						position: 'fixed'
					}
				}}
				style={{
					zIndex: 10003,
					position: 'fixed'
				}}
			>
				<DialogTitle id="confirm-dialog" style={{ padding: isMobile ? '16px' : '24px' }}>
					{title}
				</DialogTitle>
				<DialogContent dividers style={{ padding: isMobile ? '16px' : '24px' }}>
					<Typography>{children}</Typography>
				</DialogContent>
				<DialogActions style={{ padding: isMobile ? '8px 16px' : '16px 24px' }}>
					<Button
						variant="contained"
						onClick={handleCancel}
						color="default"
						style={{
							pointerEvents: 'auto',
							touchAction: 'manipulation',
							minWidth: '80px',
							minHeight: '36px'
						}}
					>
						{i18n.t("confirmationModal.buttons.cancel")}
					</Button>
					<Button
						variant="contained"
						onClick={handleConfirm}
						color="secondary"
						style={{
							pointerEvents: 'auto',
							touchAction: 'manipulation',
							minWidth: '80px',
							minHeight: '36px'
						}}
					>
						{i18n.t("confirmationModal.buttons.confirm")}
					</Button>
				</DialogActions>
			</Dialog>
		</Portal>
	);
};

export default ConfirmationModal;
