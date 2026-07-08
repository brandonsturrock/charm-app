import React, { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  Cell,
} from "recharts";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Text } from "@dynatrace/strato-components/typography";

export interface DeviceMonthPoint {
  month: string;
  monthTs: number;
  deviceType: string;
  sessions: number;
}

interface PivotedMonth {
  month: string;
  [deviceType: string]: string | number;
}

const TOKEN = {
  textSubtle: "var(--dt-colors-text-neutral-subdued, rgba(255,255,255,0.45))",
  textDefault: "var(--dt-colors-text-neutral-default, rgba(255,255,255,0.85))",
  borderDefault: "var(--dt-colors-border-neutral-default, rgba(255,255,255,0.1))",
  surfaceDefault: "var(--dt-colors-background-surface-default, #1c1e2e)",
  containerSubdued: "var(--dt-colors-background-container-neutral-subdued, rgba(255,255,255,0.04))",
  shadowFloating: "var(--dt-box-shadows-surface-floating-rest, 0 4px 16px rgba(0,0,0,0.35))",
  radiusSubdued: "var(--dt-borders-radius-surface-subdued, 9px)",
  font: "var(--dt-typography-text-small-default-family, DynatraceFlow, Roboto, Helvetica, sans-serif)",
};

const DEVICE_COLORS: Record<string, string> = {
  desktop: "#7B61FF",
  mobile: "#2ECC85",
  tablet: "#00B8E0",
  other: "#888EA8",
};

function deviceColor(type: string): string {
  return DEVICE_COLORS[type.toLowerCase()] ?? "#888EA8";
}

// Tooltip
const ChartTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; fill: string }[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        boxSizing: "border-box",
        padding: "4px",
        borderRadius: TOKEN.radiusSubdued,
        background: TOKEN.surfaceDefault,
        boxShadow: TOKEN.shadowFloating,
        minWidth: 140,
        pointerEvents: "none",
        fontFamily: TOKEN.font,
      }}
    >
      <div style={{ padding: "4px 6px", color: TOKEN.textSubtle, fontSize: 12, fontWeight: 500 }}>
        {label}
      </div>
      {[...payload].reverse().map((p) => (
        <div key={p.name} style={{ padding: "3px 6px", display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
          <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: p.fill, flexShrink: 0 }} />
          <span style={{ color: TOKEN.textSubtle, fontSize: 11, textTransform: "capitalize" }}>{p.name}</span>
          <span style={{ fontWeight: 700, color: TOKEN.textDefault, marginLeft: "auto" }}>
            {(p.value as number).toFixed(1)}%
          </span>
        </div>
      ))}
    </div>
  );
};

// Legend
const ChartLegend: React.FC<{ deviceTypes: string[] }> = ({ deviceTypes }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingLeft: 16, justifyContent: "center" }}>
    <Text style={{ margin: 0, color: TOKEN.textSubtle, fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
      Device Type
    </Text>
    {deviceTypes.map((dt) => (
      <div key={dt} style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 2, background: deviceColor(dt), flexShrink: 0 }} />
        <Text style={{ margin: 0, color: TOKEN.textDefault, fontSize: 11, textTransform: "capitalize" }}>
          {dt.charAt(0).toUpperCase() + dt.slice(1).toLowerCase()}
        </Text>
      </div>
    ))}
  </div>
);

interface DeviceDistributionChartProps {
  data: DeviceMonthPoint[];
}

export const DeviceDistributionChart: React.FC<DeviceDistributionChartProps> = ({ data }) => {
  // Pivot: one entry per month with pct per device type
  const { pivoted, deviceTypes, months } = useMemo(() => {
    // Collect ordered months (by ts) and all device types
    const monthMap = new Map<string, { ts: number; totals: Map<string, number> }>();
    const dtSet = new Set<string>();

    data.forEach((d) => {
      const key = d.month;
      if (!monthMap.has(key)) monthMap.set(key, { ts: d.monthTs, totals: new Map() });
      const m = monthMap.get(key)!;
      const dt = d.deviceType.toLowerCase();
      dtSet.add(dt);
      m.totals.set(dt, (m.totals.get(dt) ?? 0) + d.sessions);
    });

    // Sort months chronologically
    const orderedMonths = Array.from(monthMap.entries()).sort((a, b) => a[1].ts - b[1].ts);

    // Device type order: desktop, mobile, tablet, other (known first, rest alphabetical)
    const KNOWN_ORDER = ["desktop", "mobile", "tablet", "other"];
    const allDt = Array.from(dtSet);
    const orderedDt = [
      ...KNOWN_ORDER.filter((k) => allDt.includes(k)),
      ...allDt.filter((d) => !KNOWN_ORDER.includes(d)).sort(),
    ];

    // Build pivot rows with percentages
    const pivotedRows: PivotedMonth[] = orderedMonths.map(([month, { totals }]) => {
      const total = Array.from(totals.values()).reduce((s, v) => s + v, 0);
      const row: PivotedMonth = { month };
      orderedDt.forEach((dt) => {
        row[dt] = total > 0 ? ((totals.get(dt) ?? 0) / total) * 100 : 0;
      });
      return row;
    });

    return {
      pivoted: pivotedRows,
      deviceTypes: orderedDt,
      months: orderedMonths.map(([m]) => m),
    };
  }, [data]);

  if (pivoted.length === 0) return null;

  return (
    <Flex width="100%" alignItems="stretch" style={{ userSelect: "none" }} className="dt-chart-nofocus">
      <div style={{ flex: 1, minWidth: 0 }}>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={pivoted}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            barCategoryGap="20%"
          >
            <CartesianGrid vertical={false} stroke={TOKEN.borderDefault} strokeOpacity={0.6} />
            <XAxis
              dataKey="month"
              tick={{ fill: TOKEN.textDefault, fontFamily: TOKEN.font, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fill: TOKEN.textSubtle, fontFamily: TOKEN.font, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: TOKEN.containerSubdued }} wrapperStyle={{ zIndex: 9999 }} />
            {deviceTypes.map((dt, i) => (
              <Bar key={dt} dataKey={dt} stackId="device" fill={deviceColor(dt)} radius={i === deviceTypes.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}>
                <LabelList
                  dataKey={dt}
                  position="center"
                  formatter={(v: number) => (v >= 8 ? `${Math.round(v)}%` : "")}
                  style={{ fontSize: 12, fontWeight: 700, fill: "#fff", fontFamily: TOKEN.font }}
                />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend deviceTypes={deviceTypes} />
    </Flex>
  );
};
