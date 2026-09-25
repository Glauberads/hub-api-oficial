import React, { useState, useEffect, useRef } from "react";
import { parseISO, format } from "date-fns";
import * as Yup from "yup";
import { Formik, FieldArray, Form, Field } from "formik";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Typography from "@material-ui/core/Typography";
import IconButton from "@material-ui/core/IconButton";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import CircularProgress from "@material-ui/core/CircularProgress";
import Switch from "@material-ui/core/Switch";

import Grid from '@mui/material/Grid';
import Autocomplete from '@mui/material/Autocomplete';
import { createFilterOptions } from '@mui/material/Autocomplete';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';

import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { TagsContainer } from "../TagsContainer";
import useQueues from "../../hooks/useQueues";
// import AsyncSelect from "../AsyncSelect";

const useStyles = makeStyles(theme => ({
	root: {
		display: "flex",
		flexWrap: "wrap",
	},
	textField: {
		marginRight: theme.spacing(1),
		flex: 1,
	},

	extraAttr: {
		display: "flex",
		justifyContent: "center",
		alignItems: "center",
	},

	btnWrapper: {
		position: "relative",
	},

	buttonProgress: {
		color: green[500],
		position: "absolute",
		top: "50%",
		left: "50%",
		marginTop: -12,
		marginLeft: -12,
	},

	readonlyField: {
		marginTop: theme.spacing(1),
		"& .MuiInputBase-input.Mui-disabled": {
			WebkitTextFillColor: "rgba(0, 0, 0, 0.78)",
		},
	},
}));

const formatDateForInput = (date) => {
	if (!date) return '';
	
	// Se já está no formato YYYY-MM-DD, retorna como está
	if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
		return date;
	}
	
	// Se é uma data ISO ou objeto Date, converte para YYYY-MM-DD
	const d = new Date(date);
	if (isNaN(d.getTime())) return '';
	
	// Usar métodos locais para evitar problemas de timezone
	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	
	return `${year}-${month}-${day}`;
};
  
const parseDateFromInput = (dateString) => {
	if (!dateString) return null;
	
	// Se já está no formato YYYY-MM-DD, retorna como está
	if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
		return dateString;
	}
	
	// Se é uma data ISO, extrai apenas a parte da data
	if (dateString.includes('T')) {
		return dateString.split('T')[0];
	}
	
	return dateString;
};

const filterOptions = createFilterOptions({
	trim: true,
});

const ContactSchema = Yup.object().shape({
	name: Yup.string()
		.min(2, "Too Short!")
		.max(250, "Too Long!")
		.required("Required"),
	number: Yup.string().min(8, "Too Short!").max(50, "Too Long!"),
	email: Yup.string().email("Invalid email"),
});

const ContactModal = ({ open, onClose, contactId, initialValues, onSave }) => {
	const classes = useStyles();
	const isMounted = useRef(true);
	const { findAll: findAllQueues } = useQueues();

	const initialState = {
		name: "",
		number: "",
		whatsappUsername: "",
		email: "",
		disableBot: false,
		lgpdAcceptedAt: "",
		birthDate: ""
	};

	const [contact, setContact] = useState(initialState);
	const [disableBot, setDisableBot] = useState(false);
	const [selectedUser, setSelectedUser] = useState(null);
	const [selectedQueue, setSelectedQueue] = useState(null);
	const [queues, setQueues] = useState([]);
	const [allQueues, setAllQueues] = useState([]);
	const [options, setOptions] = useState([]);
	const [loading, setLoading] = useState(false);
	const [searchParam, setSearchParam] = useState("");
	const [activeFloup, setActiveFloup] = useState(null);
	const [loadingFloup, setLoadingFloup] = useState(false);

	useEffect(() => {
		return () => {
			isMounted.current = false;
		};
	}, []);

	// Carregar todas as filas quando o modal abrir
	useEffect(() => {
		if (!open) return;
		
		const loadAllQueues = async () => {
			try {
				const list = await findAllQueues();
				if (isMounted.current) {
					setAllQueues(list);
					// Se não há usuário selecionado, mostrar todas as filas
					if (!selectedUser) {
						setQueues(list);
					}
				}
			} catch (err) {
				if (isMounted.current) {
					toastError(err);
				}
			}
		};

		loadAllQueues();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open]);

	// Buscar usuários quando o searchParam mudar
	useEffect(() => {
		if (!open) {
			setOptions([]);
			setLoading(false);
			return;
		}
		
		if (searchParam.length < 3) {
			setOptions([]);
			setLoading(false);
			return;
		}
		
		const delayDebounceFn = setTimeout(() => {
			setLoading(true);
			const fetchUsers = async () => {
				try {
					const { data } = await api.get("/users/", {
						params: { searchParam },
					});
					if (isMounted.current) {
						setOptions(data.users || []);
						setLoading(false);
					}
				} catch (err) {
					if (isMounted.current) {
						setLoading(false);
						toastError(err);
					}
				}
			};

			fetchUsers();
		}, 500);
		return () => clearTimeout(delayDebounceFn);
	}, [searchParam, open]);

	useEffect(() => {
		const fetchContact = async () => {
		  if (initialValues) {
			setContact(prevState => {
			  return { 
				...prevState, 
				...initialValues,
				// Formatar a data corretamente
				birthDate: formatDateForInput(initialValues.birthDate)
			  };
			});
		  }

			if (!contactId) {
				setActiveFloup(null);
				return;
			}

			try {
				const { data } = await api.get(`/contacts/${contactId}`);
				if (isMounted.current) {
					setContact({
						...data,
						birthDate: formatDateForInput(data.birthDate)
					});
					setDisableBot(data.disableBot);

					// Preenche automaticamente os campos de Wallet e Queue
					if (data.contactWallets && data.contactWallets.length > 0) {
						const wallet = data.contactWallets[0].wallet;
						const queue = data.contactWallets[0].queue;

						// Buscar as filas do usuário para permitir mudança
						const fetchUserQueues = async () => {
							try {
								const { data: userData } = await api.get("/users/", {
									params: { searchParam: wallet.name },
								});
								const user = userData.users?.find(u => u.id === wallet.id);
								if (user && Array.isArray(user.queues) && user.queues.length > 0) {
									setQueues(user.queues);
								} else {
									// Se não encontrar filas do usuário, usar apenas a fila atual
									setQueues([{ id: queue.id, name: queue.name }]);
								}
							} catch (err) {
								// Em caso de erro, usar apenas a fila atual
								setQueues([{ id: queue.id, name: queue.name }]);
							}
						};

						setSelectedUser({
							id: wallet.id,
							name: wallet.name,
						});
						setSelectedQueue(queue.id);

						// Buscar filas do usuário
						fetchUserQueues();
					} else {
						// Limpa os valores quando não há contactWallets
						setSelectedUser(null);
						setSelectedQueue(null);
						// Mostrar todas as filas quando não há usuário selecionado
						if (allQueues.length > 0) {
							setQueues(allQueues);
						}
					}
				}

				// Buscar Floup ativo do contato
				setLoadingFloup(true);
				try {
					const floupResponse = await api.get(`/plugins/floup/contact/${contactId}/active`);
					if (isMounted.current) {
						setActiveFloup(floupResponse.data);
					}
				} catch (floupErr) {
					// Se não encontrar Floup ativo, não é erro, apenas não há Floup
					if (isMounted.current) {
						setActiveFloup(null);
					}
				} finally {
					if (isMounted.current) {
						setLoadingFloup(false);
					}
				}
			} catch (err) {
				toastError(err);
			}
		};

		fetchContact();
	}, [contactId, open, initialValues]);

	const handleClose = () => {
		onClose();
		setContact(initialState);
		setSelectedUser(null);
		setSelectedQueue(null);
		setQueues([]);
		setAllQueues([]);
		setSearchParam("");
		setOptions([]);
		setActiveFloup(null);
	};

	const handleSaveContact = async values => {
		try {
		  // Preparar os dados com a data corretamente formatada
		  const contactData = {
			...values,
			disableBot: disableBot,
			birthDate: parseDateFromInput(values.birthDate)
		  };
	  
		  if (contactId) {
			if (!selectedUser && !selectedQueue) {
			  delete contact.contactWallets;
			  await api.delete(`/contacts/wallet/${contactId}`);
			}
	  
			const { contactWallets, ...valuesWithoutWallets } = contactData;
			delete contact.contactWallets;
	  
			await api.put(`/contacts/${contactId}`, contactData);
	  
			if (selectedUser && selectedQueue && selectedUser !== null && selectedQueue !== null) {
			  await api.put(`/contacts/wallet/${contactId}`, {
				wallets: {
				  userId: selectedUser.id,
				  queueId: selectedQueue,
				},
			  });
			}
	  
			handleClose();
	  
		  } else {
			delete contactData.contactWallets;
	  
			const { data } = await api.post("/contacts", contactData);
	  
			if (data.id && selectedUser && selectedQueue) {
			  await api.put(`/contacts/wallet/${data.id}`, {
				wallets: {
				  userId: selectedUser.id,
				  queueId: selectedQueue,
				},
			  });
			}
	  
			if (onSave) {
			  onSave(data);
			}
	  
			handleClose();
		  }
		  toast.success(i18n.t("contactModal.success"));
		} catch (err) {
		  toastError(err);
		}
	  };

	return (
		<div className={classes.root}>
			<Dialog 
				open={open} 
				onClose={handleClose} 
				maxWidth="lg" 
				scroll="paper"
				disableEnforceFocus={true}
				disableAutoFocus={true}
				disableRestoreFocus={true}
				PaperProps={{
					style: {
						zIndex: 10003,
						position: 'fixed'
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
				<DialogTitle id="form-dialog-title">
					{contactId
						? `${i18n.t("contactModal.title.edit")}`
						: `${i18n.t("contactModal.title.add")}`}
				</DialogTitle>
				<Formik
					initialValues={contact}
					enableReinitialize={true}
					validationSchema={ContactSchema}
					onSubmit={(values, actions) => {
						setTimeout(() => {
							handleSaveContact(values);
							actions.setSubmitting(false);
						}, 400);
					}}
				>
					{({ values, errors, touched, isSubmitting, setFieldValue }) => (
						<Form>
							<DialogContent dividers>
								<Typography variant="subtitle1" gutterBottom>
									{i18n.t("contactModal.form.mainInfo")}
								</Typography>
								<Field
									as={TextField}
									label={i18n.t("contactModal.form.name")}
									name="name"
									autoFocus={!contact.number}
									error={touched.name && Boolean(errors.name)}
									helperText={touched.name && errors.name}
									variant="outlined"
									margin="dense"
									className={classes.textField}
									fullWidth
								/>
								<Grid container spacing={2}>
									<Grid item xs={12} sm={6}>
										<Field
											as={TextField}
											label={i18n.t("contactModal.form.number")}
											name="number"
											autoFocus={!!contact.number}
											error={touched.number && Boolean(errors.number)}
											helperText={touched.number && errors.number}
											placeholder="5513912344321"
											variant="outlined"
											margin="dense"
											fullWidth
										/>
									</Grid>
									<Grid item xs={12} sm={6}>
										<TextField
											label="LID (Linked Device ID)"
											value={contact.lid || ""}
											disabled
											fullWidth
											margin="dense"
											variant="outlined"
											helperText="Identificador do dispositivo vinculado"
										/>
									</Grid>
								</Grid>

								{!!values.whatsappUsername && (
									<TextField
										label="Username do WhatsApp"
										value={`@${String(values.whatsappUsername).replace(/^@+/, "")}`}
										variant="outlined"
										margin="dense"
										fullWidth
										disabled
										className={classes.readonlyField}
										helperText="Preenchido automaticamente pela API Oficial"
									/>
								)}

								<div>
									<Field
										as={TextField}
										label={i18n.t("contactModal.form.email")}
										name="email"
										error={touched.email && Boolean(errors.email)}
										helperText={touched.email && errors.email}
										placeholder="Email address"
										fullWidth
										margin="dense"
										variant="outlined"
									/>
								</div>
								<div>
									<Field
										as={TextField}
										label="Data de Nascimento"
										name="birthDate"
										type="date"
										InputLabelProps={{
											shrink: true,
										}}
										fullWidth
										margin="dense"
										variant="outlined"
										helperText="Data de nascimento para mensagens automáticas de aniversário"
										onChange={(e) => {
											const formattedDate = parseDateFromInput(e.target.value);
											setFieldValue('birthDate', formattedDate);
										}}
									/>
								</div>

								<div>
									<TagsContainer contact={contact} className={classes.textField} />
								</div>

								<Grid item>
									<Typography
										variant="subtitle1"
										gutterBottom
										style={{ marginTop: 24, marginBottom: 8 }}
									>
										<b>{i18n.t("contactModal.form.assignWallet")}</b>
									</Typography>
								</Grid>

								<Grid container spacing={2}>
									<Grid xs={12} sm={6} xl={6} item>
										<Autocomplete
											value={selectedUser}
											fullWidth
											getOptionLabel={(option) => option?.name || ""}
											onChange={(e, newValue) => {
												setSelectedUser(newValue);
												if (
													newValue != null &&
													Array.isArray(newValue.queues) &&
													newValue.queues.length > 0
												) {
													if (newValue.queues.length === 1) {
														setSelectedQueue(newValue.queues[0].id);
													} else {
														if (selectedQueue && !newValue.queues.some(q => q.id === selectedQueue)) {
															setSelectedQueue(null);
														}
													}
													setQueues(newValue.queues);
												} else {
													setQueues(allQueues);
													if (!newValue) {
														setSelectedQueue(null);
													}
												}
											}}
											options={options}
											filterOptions={filterOptions}
											freeSolo
											autoHighlight
											noOptionsText={
												searchParam.length < 3 
													? "Digite pelo menos 3 caracteres para buscar" 
													: loading 
														? "Buscando..." 
														: i18n.t("transferTicketModal.noOptions")
											}
											loading={loading}
											renderOption={(props, option) => (
												<li {...props} key={option.id}>
													<span style={{ marginLeft: 8 }}>{option.name}</span>
												</li>
											)}
											renderInput={(params) => (
												<TextField
													{...params}
													label={i18n.t("transferTicketModal.fieldLabel")}
													variant="outlined"
													onChange={(e) => setSearchParam(e.target.value)}
													InputProps={{
														...params.InputProps,
														endAdornment: (
															<React.Fragment>
																{loading ? (
																	<CircularProgress color="inherit" size={20} />
																) : null}
																{params.InputProps.endAdornment}
															</React.Fragment>
														),
													}}
												/>
											)}
										/>
									</Grid>

									<Grid xs={12} sm={6} xl={6} item>
										<FormControl variant="outlined" fullWidth>
											<InputLabel>
												{i18n.t("transferTicketModal.fieldQueueLabel")}
											</InputLabel>
											<Select
												value={selectedQueue || ""}
												onChange={(e) => setSelectedQueue(e.target.value)}
												label={i18n.t(
													"transferTicketModal.fieldQueueLabel"
												)}
											>
												{queues.length > 0 ? (
													queues.map((queue) => (
														<MenuItem key={queue.id} value={queue.id}>
															{queue.name}
														</MenuItem>
													))
												) : (
													<MenuItem disabled>
														{selectedUser 
															? i18n.t("contactModal.walletError")
															: "Selecione um usuário primeiro"}
													</MenuItem>
												)}
											</Select>
										</FormControl>
									</Grid>
								</Grid>

								<Typography
									style={{ marginBottom: 8, marginTop: 12 }}
									variant="subtitle1"
								>
									<Switch
										size="small"
										checked={disableBot}
										onChange={() =>
											setDisableBot(!disableBot)
										}
										name="disableBot"
									/>
									{i18n.t("contactModal.form.chatBotContact")}
								</Typography>
								<Typography
									style={{ marginBottom: 8, marginTop: 12 }}
									variant="subtitle1"
								>
									{i18n.t("contactModal.form.whatsapp")} {contact?.whatsapp ? contact?.whatsapp.name : ""}
								</Typography>
								<Typography
									style={{ marginBottom: 8, marginTop: 12 }}
									variant="subtitle1"
								>
									{i18n.t("contactModal.form.termsLGDP")} {contact?.lgpdAcceptedAt ? format(new Date(contact?.lgpdAcceptedAt), "dd/MM/yyyy 'às' HH:mm") : ""}
								</Typography>
								
								<div style={{ marginTop: 12, marginBottom: 8 }}>
									<Typography variant="subtitle1" gutterBottom>
										<b>Floup</b>
									</Typography>
									{loadingFloup ? (
										<CircularProgress size={20} />
									) : activeFloup ? (
										<TextField
											fullWidth
											disabled
											variant="outlined"
											margin="dense"
											value={`${activeFloup.name || 'Floup'} - Etapa ${(activeFloup.activeSchedule?.currentStepIndex || 0) + 1} de ${(activeFloup.steps || []).length}`}
											helperText={
												activeFloup.activeSchedule?.nextRunAt 
													? `Próxima execução: ${format(new Date(activeFloup.activeSchedule.nextRunAt), "dd/MM/yyyy 'às' HH:mm")}`
													: "Floup ativo"
											}
											InputProps={{
												style: {
													borderColor: '#ff9800',
													borderWidth: '2px',
													borderStyle: 'solid'
												}
											}}
										/>
									) : (
										<TextField
											fullWidth
											disabled
											variant="outlined"
											margin="dense"
											value="Nenhum Floup ativo"
											helperText="Este contato não está em nenhum Floup no momento"
											InputProps={{
												style: {
													borderColor: '#ccc',
													borderWidth: '1px',
													borderStyle: 'solid'
												}
											}}
										/>
									)}
								</div>

								<Typography
									style={{ marginBottom: 8, marginTop: 12 }}
									variant="subtitle1"
								>
									{i18n.t("contactModal.form.extraInfo")}
								</Typography>

								<FieldArray name="extraInfo">
									{({ push, remove }) => (
										<>
											{values.extraInfo &&
												values.extraInfo.length > 0 &&
												values.extraInfo.map((info, index) => (
													<div
														className={classes.extraAttr}
														key={`${index}-info`}
													>
														<Field
															as={TextField}
															label={i18n.t("contactModal.form.extraName")}
															name={`extraInfo[${index}].name`}
															variant="outlined"
															margin="dense"
															className={classes.textField}
														/>
														<Field
															as={TextField}
															label={i18n.t("contactModal.form.extraValue")}
															name={`extraInfo[${index}].value`}
															variant="outlined"
															margin="dense"
															className={classes.textField}
														/>
														<IconButton
															size="small"
															onClick={() => remove(index)}
														>
															<DeleteOutlineIcon />
														</IconButton>
													</div>
												))}
											<div className={classes.extraAttr}>
												<Button
													style={{ flex: 1, marginTop: 8 }}
													variant="outlined"
													color="primary"
													onClick={() => push({ name: "", value: "" })}
												>
													{`+ ${i18n.t("contactModal.buttons.addExtraInfo")}`}
												</Button>
											</div>
										</>
									)}
								</FieldArray>
							</DialogContent>
							<DialogActions>
								<Button
									onClick={handleClose}
									color="secondary"
									disabled={isSubmitting}
									variant="outlined"
								>
									{i18n.t("contactModal.buttons.cancel")}
								</Button>
								<Button
									type="submit"
									color="primary"
									disabled={isSubmitting}
									variant="contained"
									className={classes.btnWrapper}
								>
									{contactId
										? `${i18n.t("contactModal.buttons.okEdit")}`
										: `${i18n.t("contactModal.buttons.okAdd")}`}
									{isSubmitting && (
										<CircularProgress
											size={24}
											className={classes.buttonProgress}
										/>
									)}
								</Button>
							</DialogActions>
						</Form>
					)}
				</Formik>
			</Dialog>
		</div>
	);
};

export default ContactModal;