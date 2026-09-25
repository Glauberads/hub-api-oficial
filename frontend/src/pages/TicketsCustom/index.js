import React, { useState, useCallback, useContext, useEffect, useRef, Suspense } from "react";
import { useParams, useHistory } from "react-router-dom";
import Paper from "@material-ui/core/Paper";
import Hidden from "@material-ui/core/Hidden";
import { makeStyles } from "@material-ui/core/styles";
import TicketsManagerTabs from "../../components/TicketsManagerTabs";
import { QueueSelectedProvider } from "../../context/QueuesSelected/QueuesSelectedContext";
import { TicketsContext } from "../../context/Tickets/TicketsContext";
import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";
import api from "../../services/api";
import { CircularProgress } from "@material-ui/core";
import { getBackendUrl } from "../../config";
import logo from "../../assets/logo1.png";
import logoDark from "../../assets/logo2.png";

const Ticket = React.lazy(() => import("../../components/Ticket"));

const defaultTicketsManagerWidth = 550;
const minTicketsManagerWidth = 404;
const maxTicketsManagerWidth = 700;

const useStyles = makeStyles((theme) => ({
	chatContainer: {
		flex: 1,
		padding: "2px",
		height: `calc(100% - 48px)`,
		overflowY: "hidden",
	},
	chatPapper: {
		display: "flex",
		height: "100%",
	},
	contactsWrapper: {
		display: "flex",
		height: "100%",
		flexDirection: "column",
		overflowY: "hidden",
		position: "relative",
		minWidth: `${minTicketsManagerWidth}px`,
		[theme.breakpoints.down("sm")]: {
			minWidth: "100%",
			width: "100% !important",
			maxWidth: "100% !important",
		},
	},
	messagesWrapper: {
		display: "flex",
		height: "100%",
		flexDirection: "column",
		flexGrow: 1,
		[theme.breakpoints.down("sm")]: {
			display: (props) => props.ticketId ? "flex" : "none",
			position: "fixed",
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
			zIndex: 1200,
			backgroundColor: theme.palette.background?.default || "#fff",
		},
	},
	welcomeMsg: {
		background: theme.palette.background.default,
		display: "flex",
		justifyContent: "space-evenly",
		alignItems: "center",
		height: "100%",
		textAlign: "center",
	},
	dragger: {
		width: "5px",
		cursor: "ew-resize",
		padding: "4px 0 0",
		borderTop: `1px solid ${theme.palette.divider}`,
		position: "absolute",
		top: 0,
		right: 0,
		bottom: 0,
		zIndex: 100,
		backgroundColor: theme.palette.background.paper,
		userSelect: "none",
		[theme.breakpoints.down("sm")]: {
			display: "none",
		},
	},
	logo: {
		logo: theme.logo,
		content: "url(" + (theme.mode === "light" 
			? theme.calculatedLogoLight() 
			: theme.calculatedLogoDark()) + ")"
	},
}));

const TicketsCustom = () => {
	const { user } = useContext(AuthContext);
	const { ticketId } = useParams();
	
	// ⚠️ CORREÇÃO PRINCIPAL: Inicializar com largura padrão adequada
	const [ticketsManagerWidth, setTicketsManagerWidth] = useState(
		user?.defaultTicketsManagerWidth || defaultTicketsManagerWidth
	);
	
	const classes = useStyles({ ticketsManagerWidth, ticketId });
	const ticketsManagerWidthRef = useRef(ticketsManagerWidth);

	// ⚠️ CORREÇÃO: useEffect mais robusto para inicialização
	useEffect(() => {
		// Definir largura baseada no usuário ou padrão
		const initialWidth = user?.defaultTicketsManagerWidth || defaultTicketsManagerWidth;
		
		// Garantir que a largura esteja dentro dos limites
		const validWidth = Math.max(
			minTicketsManagerWidth,
			Math.min(maxTicketsManagerWidth, initialWidth)
		);
		
		setTicketsManagerWidth(validWidth);
		ticketsManagerWidthRef.current = validWidth;
	}, [user]);

	const handleMouseDown = (e) => {
		document.addEventListener("mouseup", handleMouseUp, true);
		document.addEventListener("mousemove", handleMouseMove, true);
	};

	const handleSaveContact = async (value) => {
		// Garantir largura mínima antes de salvar
		const validValue = Math.max(minTicketsManagerWidth, value);
		
		try {
			await api.put(`/users/toggleChangeWidht/${user.id}`, { 
				defaultTicketsManagerWidth: validValue 
			});
		} catch (error) {
			console.error("Erro ao salvar largura:", error);
		}
	};

	const handleMouseMove = useCallback((e) => {
		const newWidth = e.clientX - document.body.offsetLeft;
		
		if (newWidth >= minTicketsManagerWidth && newWidth <= maxTicketsManagerWidth) {
			ticketsManagerWidthRef.current = newWidth;
			setTicketsManagerWidth(newWidth);
		}
	}, []);

	const handleMouseUp = async () => {
		document.removeEventListener("mouseup", handleMouseUp, true);
		document.removeEventListener("mousemove", handleMouseMove, true);

		const newWidth = ticketsManagerWidthRef.current;

		if (newWidth !== ticketsManagerWidth) {
			await handleSaveContact(newWidth);
		}
	};

	// ⚠️ CORREÇÃO: Garantir que a largura nunca seja 0 ou inválida
	const effectiveWidth = Math.max(minTicketsManagerWidth, ticketsManagerWidth);

	return (
		<QueueSelectedProvider>
			<div className={classes.chatContainer}>
				<div className={classes.chatPapper}>
					<div
						className={classes.contactsWrapper}
						style={{ 
							width: `${effectiveWidth}px`,
							// Adicionar fallbacks importantes
							minWidth: `${minTicketsManagerWidth}px`,
							maxWidth: `${maxTicketsManagerWidth}px`,
							// Garantir visibilidade
							opacity: effectiveWidth > 0 ? 1 : 0,
							visibility: effectiveWidth > 0 ? 'visible' : 'hidden'
						}}
					>
						<TicketsManagerTabs />
						<div 
							onMouseDown={handleMouseDown} 
							className={classes.dragger} 
						/>
					</div>
					<div className={classes.messagesWrapper}>
						{ticketId ? (
							<Suspense fallback={<div style={{display:'flex',justifyContent:'center',alignItems:'center',height:'100%'}}><CircularProgress /></div>}>
								<Ticket />
							</Suspense>
						) : (
							<Hidden only={["sm", "xs"]}>
								<Paper square variant="outlined" className={classes.welcomeMsg}>
									<span>
										<center>
											<img className={classes.logo} width="50%" alt="" />
										</center>
										{i18n.t("chat.noTicketMessage")}
									</span>
								</Paper>
							</Hidden>
						)}
					</div>
				</div>
			</div>
		</QueueSelectedProvider>
	);
};

export default TicketsCustom;