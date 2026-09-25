import React, { useState, useEffect, createContext } from "react";
import { useHistory } from "react-router-dom";

const TicketsContext = createContext();

const TicketsContextProvider = ({ children }) => {
	const [currentTicket, setCurrentTicket] = useState({ id: null, code: null });
	const [tabOpen, setTabOpenState] = useState(() => {
		return localStorage.getItem("tabOpen") || "open";
	});
	const history = useHistory();

	const setTabOpen = (value) => {
		setTabOpenState(value);
		localStorage.setItem("tabOpen", value);
	};

	useEffect(() => {
		if (currentTicket.id !== null) {
			history.push(`/tickets/${currentTicket.uuid}`);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentTicket])

	return (
		<TicketsContext.Provider
			value={{ currentTicket, setCurrentTicket, tabOpen, setTabOpen }}
		>
			{children}
		</TicketsContext.Provider>
	);
};

export { TicketsContext, TicketsContextProvider };
