import React, { useMemo } from "react";
import { useTheme } from "@material-ui/core/styles";
import {
	CartesianGrid,
	XAxis,
	YAxis,
	Label,
	ResponsiveContainer,
	LineChart,
	Line,
	Tooltip,
	Legend,
} from "recharts";
import { startOfHour, parseISO, format } from "date-fns";

import Title from "./Title";
import useTickets from "../../hooks/useTickets";
import { i18n } from "../../translate/i18n";

const HOURS_TEMPLATE = Array.from({ length: 24 }, (_, index) => ({
	time: `${String(index).padStart(2, "0")}:00`,
	amount: 0,
}));

const CustomTooltip = ({ active, payload, label, theme }) => {
	if (!active || !payload || !payload.length) return null;

	return (
		<div
			style={{
				background:
					(theme.palette.type || theme.palette.mode) === "dark"
						? "rgba(20, 24, 31, 0.96)"
						: "rgba(255,255,255,0.98)",
				border: `1px solid ${theme.palette.divider}`,
				borderRadius: 14,
				padding: "10px 12px",
				boxShadow: "0 12px 30px rgba(0,0,0,0.12)",
				backdropFilter: "blur(8px)",
				minWidth: 140,
			}}
		>
			<div
				style={{
					fontSize: 12,
					fontWeight: 700,
					color: theme.palette.text.secondary,
					marginBottom: 4,
					textTransform: "uppercase",
					letterSpacing: "0.04em",
				}}
			>
				Horário
			</div>

			<div
				style={{
					fontSize: 16,
					fontWeight: 800,
					color: theme.palette.text.primary,
					marginBottom: 6,
				}}
			>
				{label}
			</div>

			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: 8,
					fontSize: 13,
					color: theme.palette.text.primary,
				}}
			>
				<span
					style={{
						width: 10,
						height: 10,
						borderRadius: "50%",
						background: theme.palette.primary.main,
						display: "inline-block",
					}}
				/>
				<strong>{payload[0].value}</strong> atendimento(s)
			</div>
		</div>
	);
};

const Chart = ({ dateStartTicket, dateEndTicket, queueTicket }) => {
	const theme = useTheme();

	const { tickets, count } = useTickets({
		dateStart: dateStartTicket,
		dateEnd: dateEndTicket,
		queueIds: queueTicket ? `[${queueTicket}]` : "[]",
	});

	const chartData = useMemo(() => {
		const base = HOURS_TEMPLATE.map((item) => ({ ...item }));

		(tickets || []).forEach((ticket) => {
			try {
				if (!ticket?.createdAt) return;

				const hourLabel = format(
					startOfHour(parseISO(ticket.createdAt)),
					"HH:mm"
				);

				const foundIndex = base.findIndex((item) => item.time === hourLabel);

				if (foundIndex !== -1) {
					base[foundIndex].amount += 1;
				}
			} catch (error) {
				// ignora datas inválidas
			}
		});

		return base;
	}, [tickets]);

	const totalTickets = Number(count) || 0;
	const busiestHour =
		chartData.reduce(
			(acc, current) =>
				current.amount > acc.amount ? current : acc,
			{ time: "00:00", amount: 0 }
		) || { time: "00:00", amount: 0 };

	return (
		<React.Fragment>
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "flex-start",
					gap: 12,
					marginBottom: 16,
					flexWrap: "wrap",
				}}
			>
				<div>
					<Title>{`Atendimentos Criados: ${totalTickets}`}</Title>
					<div
						style={{
							fontSize: 13,
							color: theme.palette.text.secondary,
							marginTop: 4,
						}}
					>
						Distribuição dos tickets por hora no período selecionado
					</div>
				</div>

				<div
					style={{
						display: "flex",
						gap: 8,
						flexWrap: "wrap",
					}}
				>
					<div
						style={{
							padding: "8px 12px",
							borderRadius: 999,
							background:
								(theme.palette.type || theme.palette.mode) === "dark"
									? "rgba(255,255,255,0.06)"
									: "rgba(15,23,42,0.05)",
							border: `1px solid ${theme.palette.divider}`,
							fontSize: 12,
							fontWeight: 700,
							color: theme.palette.text.secondary,
						}}
					>
						Pico: {busiestHour.time}
					</div>

					<div
						style={{
							padding: "8px 12px",
							borderRadius: 999,
							background:
								(theme.palette.type || theme.palette.mode) === "dark"
									? "rgba(255,255,255,0.06)"
									: "rgba(15,23,42,0.05)",
							border: `1px solid ${theme.palette.divider}`,
							fontSize: 12,
							fontWeight: 700,
							color: theme.palette.text.secondary,
						}}
					>
						Máximo/hora: {busiestHour.amount}
					</div>
				</div>
			</div>

			<div
				style={{
					width: "100%",
					height: 320,
					padding: "6px 0 0 0",
				}}
			>
				<ResponsiveContainer width="100%" height="100%">
					<LineChart
						data={chartData}
						margin={{
							top: 12,
							right: 18,
							left: 0,
							bottom: 8,
						}}
					>
						<CartesianGrid
							strokeDasharray="4 4"
							stroke={theme.palette.divider}
							opacity={0.45}
						/>

						<XAxis
							dataKey="time"
							stroke={theme.palette.text.secondary}
							tick={{ fontSize: 12 }}
							axisLine={false}
							tickLine={false}
						/>

						<YAxis
							type="number"
							allowDecimals={false}
							stroke={theme.palette.text.secondary}
							tick={{ fontSize: 12 }}
							axisLine={false}
							tickLine={false}
							width={36}
						>
							<Label
								angle={270}
								position="left"
								offset={-2}
								style={{
									textAnchor: "middle",
									fill: theme.palette.text.primary,
									fontSize: 12,
									fontWeight: 700,
								}}
							>
								{i18n.t("tagsKanban.table.tickets")}
							</Label>
						</YAxis>

						<Tooltip content={<CustomTooltip theme={theme} />} />

						<Legend
							verticalAlign="top"
							align="right"
							iconType="circle"
							wrapperStyle={{
								paddingBottom: 10,
								fontSize: 12,
								fontWeight: 600,
							}}
						/>

						<Line
							name="Atendimentos"
							type="monotone"
							dataKey="amount"
							stroke={theme.palette.primary.main}
							strokeWidth={3}
							dot={{
								r: 3,
								strokeWidth: 2,
								fill: theme.palette.background.paper,
							}}
							activeDot={{
								r: 6,
								stroke: theme.palette.primary.main,
								strokeWidth: 2,
								fill: theme.palette.background.paper,
							}}
						/>
					</LineChart>
				</ResponsiveContainer>
			</div>
		</React.Fragment>
	);
};

export default Chart;