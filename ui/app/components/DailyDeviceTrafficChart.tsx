import React, { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
} from "recharts";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Text } from "@dynatrace/strato-components/typography";

export interface DailyDevicePoint {
  day: string | number | null;
  deviceType: string;
  sessions: number;
}

interface PivotedDay {
  day: string;
  dayTs: number;
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
  const total = payload.reduce((s, p) => s + (p.value ?? 0), 0);
  return (
    <div style={{
      boxSizing: "border-box",
      padding: "4px",
      borderRadius: TOKEN.radiusSubdued,
      background: TOKEN.surfaceDefault,
      boxShadow: TOKEN.shadowFloating,
      minWidth: 160,
      pointerEvents: "none",
      fontFamily: TOKEN.font,
    }}>
      <div style={{ padding: "4px 6px", color: TOKEN.textSubtle, fontSize: 12, fontWeight: 500 }}>{label}</div>
      {[...payload].reverse().map((p) => (
        <div key={p.name} style={{ padding: "3px 6px", display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
          <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: p.fill, flexShrink: 0 }} />
          <span style={{ color: TOKEN.textSubtle, fontSize: 11, textTransform: "capitalize" }}>{p.name}</span>
          <span style={{ fontWeight: 700, color: TOKEN.textDefault, marginLeft: "auto" }}>
            {(p.value as number).toLocaleString()}
          </span>
        </div>
      ))}
      <div style={{ padding: "3px 6px 4px", display: "flex", gap: 8, fontSize: 12, borderTop: `1px solid ${TOKEN.borderDefault}`, marginTop: 2 }}>
        <span style={{ color: TOKEN.textSubtle, fontSize: 11 }}>Total</span>
        <span style={{ fontWeight: 700, color: TOKEN.textDefault, marginLeft: "auto" }}>{total.toLocaleString()}</span>
      </div>
    </div>
  );
};

function allDaysInRange(startTs: number, endTs: number): number[] {
  const days: number[] = [];
  const d = new Date(startTs);
  d.setUTCHours(0, 0, 0, 0);
  while (d.getTime() <= endTs) {
    days.push(d.getTime());
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return days;
}

interface Props {
  data: DailyDevicePoint[];
  fillRange?: [number, number];
}

export const DailyDeviceTrafficChart: React.FC<Props> = ({ data, fillRange }) => {
  const { pivoted, deviceTypes } = useMemo(() => {
    const dayMap = new Map<number, { label: string; totals: Map<string, number> }>();
    const dtSet = new Set<string>();

    data.forEach((d) => {
      const ts = typeof d.day === "number" ? d.day : d.day ? new Date(d.day as string).getTime() : null;
      if (ts === null) return;
      const aligned = new Date(ts);
      aligned.setUTCHours(0, 0, 0, 0);
      const alignedTs = aligned.getTime();
      const label = new Date(alignedTs).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
      if (!dayMap.has(alignedTs)) dayMap.set(alignedTs, { label, totals: new Map() });
      const entry = dayMap.get(alignedTs)!;
      const dt = (d.deviceType ?? "other").toLowerCase();
      dtSet.add(dt);
      entry.totals.set(dt, (entry.totals.get(dt) ?? 0) + d.sessions);
    });

    const KNOWN_ORDER = ["desktop", "mobile", "tablet", "other"];
    const allDt = Array.from(dtSet);
    const orderedDt = [
      ...KNOWN_ORDER.filter((k) => allDt.includes(k)),
      ...allDt.filter((d) => !KNOWN_ORDER.includes(d)).sort(),
    ];

    const dayTsList = fillRange
      ? allDaysInRange(fillRange[0], fillRange[1])
      : Array.from(dayMap.keys()).sort((a, b) => a - b);

    // Ensure every day in range exists in the map (with empty totals for zero days)
    dayTsList.forEach((ts) => {
      if (!dayMap.has(ts)) {
        dayMap.set(ts, {
          label: new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
          totals: new Map(),
        });
      }
    });

    const pivotedRows: PivotedDay[] = dayTsList.map((ts) => {
      const { label, totals } = dayMap.get(ts)!;
      const row: PivotedDay = { day: label, dayTs: ts };
      orderedDt.forEach((dt) => { row[dt] = totals.get(dt) ?? 0; });
      return row;
    });

    return { pivoted: pivotedRows, deviceTypes: orderedDt };
  }, [data, fillRange]);

  if (pivoted.length === 0) return null;

  const tickInterval = Math.max(1, Math.ceil(pivoted.length / 7)) - 1;

  const RETENTION_MS = 35 * 24 * 60 * 60 * 1000;
  const retentionCutoff = Date.now() - RETENTION_MS;
  const staleRows = pivoted.filter(r => r.dayTs < retentionCutoff);
  const retentionZone = staleRows.length > 0 ? (
    <ReferenceArea
      x1={pivoted[0].day}
      x2={staleRows[staleRows.length - 1].day}
      fill="rgba(255,255,255,0.04)"
      stroke="rgba(255,255,255,0.12)"
      strokeDasharray="3 3"
      label={{ value: "No data", position: "insideTopLeft", fontSize: 10, fill: "rgba(255,255,255,0.25)" }}
    />
  ) : null;

  return (
    <Flex width="100%" alignItems="stretch" style={{ userSelect: "none" }} className="dt-chart-nofocus">
      <div style={{ flex: 1, minWidth: 0 }}>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={pivoted} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="20%">
            <CartesianGrid vertical={false} stroke={TOKEN.borderDefault} strokeOpacity={0.6} />
            <XAxis
              dataKey="day"
              tick={{ fill: TOKEN.textDefault, fontFamily: TOKEN.font, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              interval={tickInterval}
            />
            <YAxis
              tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)}
              tick={{ fill: TOKEN.textSubtle, fontFamily: TOKEN.font, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: TOKEN.containerSubdued }} wrapperStyle={{ zIndex: 9999 }} />
            {retentionZone}
            {deviceTypes.map((dt, i) => (
              <Bar key={dt} dataKey={dt} stackId="device" fill={deviceColor(dt)} radius={i === deviceTypes.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend deviceTypes={deviceTypes} />
    </Flex>
  );
};
