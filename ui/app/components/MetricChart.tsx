import React from "react";
import { Heading } from "@dynatrace/strato-components/typography";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";

export interface ChartDataPoint {
  month: string;
  value: number;
}

interface MetricChartProps {
  title: string;
  data: ChartDataPoint[];
  color: string;
  type: "bar" | "line";
  formatValue?: (v: number) => string;
  formatYAxis?: (v: number) => string;
}

const GRID_COLOR = "rgba(255,255,255,0.06)";
const AXIS_COLOR = "rgba(255,255,255,0.35)";

const CustomTooltip = ({
  active,
  payload,
  label,
  formatValue,
}: {
  active?: boolean;
  payload?: { value: number; color: string }[];
  label?: string;
  formatValue: (v: number) => string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "var(--dt-color-background-container-raised)",
        border: "1px solid var(--dt-color-border-neutral-default)",
        borderRadius: 6,
        padding: "8px 14px",
      }}
    >
      <div style={{ fontSize: 11, color: AXIS_COLOR, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: payload[0].color }}>
        {formatValue(payload[0].value)}
      </div>
    </div>
  );
};

export const MetricChart: React.FC<MetricChartProps> = ({
  title,
  data,
  color,
  type,
  formatValue = (v) => v.toLocaleString(),
  formatYAxis = (v) => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
    return String(v);
  },
}) => {
  const lastIndex = data.length - 1;

  return (
    <div
      style={{
        background: "var(--dt-color-background-container-default)",
        border: "1px solid var(--dt-color-border-neutral-default)",
        borderRadius: 8,
        padding: "20px 24px 16px",
        flex: "1 1 0",
        minWidth: 300,
        minHeight: 260,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <Heading level={5} style={{ margin: 0, color: "var(--dt-color-text-default)", fontWeight: 600 }}>
        {title}
      </Heading>
      <div style={{ flex: 1, minHeight: 200 }}>
        <ResponsiveContainer width="100%" height={200}>
          {type === "bar" ? (
            <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID_COLOR} />
              <XAxis
                dataKey="month"
                tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                axisLine={{ stroke: GRID_COLOR }}
                tickLine={false}
              />
              <YAxis
                tickFormatter={formatYAxis}
                tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <Tooltip
                content={<CustomTooltip formatValue={formatValue} />}
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
              />
              <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={40}>
                {data.map((_, index) => (
                  <Cell
                    key={index}
                    fill={index === lastIndex ? color : `${color}99`}
                    opacity={index === lastIndex ? 1 : 0.75}
                  />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID_COLOR} />
              <XAxis
                dataKey="month"
                tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                axisLine={{ stroke: GRID_COLOR }}
                tickLine={false}
              />
              <YAxis
                tickFormatter={formatYAxis}
                tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <Tooltip
                content={<CustomTooltip formatValue={formatValue} />}
                cursor={{ stroke: "rgba(255,255,255,0.15)", strokeWidth: 1 }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2.5}
                dot={{ fill: color, strokeWidth: 0, r: 4 }}
                activeDot={{ r: 6, fill: color, strokeWidth: 0 }}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};
