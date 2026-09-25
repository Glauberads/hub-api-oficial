import React, { useMemo } from "react";
import { useTheme } from "@material-ui/core/styles";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

const DonutChart = (props) => {
  const theme = useTheme();
  const { title, value, data, color } = props;

  const data1 = useMemo(() => {
    try {
      if (Array.isArray(data)) {
        return data.map((item) => ({
          ...item,
          value: Number(item?.value) || 0,
        }));
      }

      if (typeof data === "string") {
        const parsed = JSON.parse(`[${String(data).replace(/'/g, '"')}]`);
        return parsed.map((item) => ({
          ...item,
          value: Number(item?.value) || 0,
        }));
      }

      return [];
    } catch (error) {
      return [];
    }
  }, [data]);

  const COLORS = useMemo(() => {
    if (Array.isArray(color) && color.length > 0) {
      return color;
    }

    return [
      color || theme.palette.primary.main,
      theme.palette.type === "dark" || theme.palette.mode === "dark"
        ? "rgba(255,255,255,0.12)"
        : "#E9EEF5",
      "#DCE4EE",
      "#CBD5E1",
    ];
  }, [color, theme]);

  const centerTextColor = theme.palette.text.primary;
  const subTextColor = theme.palette.text.secondary;

  const renderCenterLabel = ({ viewBox }) => {
    const { cx, cy } = viewBox || {};
    if (cx == null || cy == null) return null;

    return (
      <g>
        <text
          x={cx}
          y={cy - 10}
          textAnchor="middle"
          dominantBaseline="central"
          style={{
            fontSize: 14,
            fontWeight: 700,
            fill: subTextColor,
          }}
        >
          {title}
        </text>

        <text
          x={cx}
          y={cy + 18}
          textAnchor="middle"
          dominantBaseline="central"
          style={{
            fontSize: 28,
            fontWeight: 800,
            fill: centerTextColor,
          }}
        >
          {`${Number(value) || 0}%`}
        </text>
      </g>
    );
  };

  return (
    <div style={{ width: "100%", height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data1}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={104}
            innerRadius={72}
            paddingAngle={data1.length > 1 ? 2 : 0}
            cornerRadius={10}
            stroke="none"
            isAnimationActive
            animationDuration={700}
            labelLine={false}
            label={renderCenterLabel}
          >
            {data1.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default DonutChart;