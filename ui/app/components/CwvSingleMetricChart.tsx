import React, { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

export interface CwvDailyDevicePoint {
  day: string;
  dayTs: number;
  lcp: number;
  inp: number;
  cls: number;
  deviceType: string;
}

const DEVICE_COLORS: Record<string, string> = {
  desktop: "#7B61FF",
  mobile: "#2ECC85",
  tablet: "#00B8E0",
  other: "#888EA8",
};

const THRESHOLDS = {
  lcp: { good: 2500, poor: 4000 },
  inp: { good: 200, poor: 500 },
  cls: { good: 0.1, poor: 0.25 },
};

const FONT = "'DT Flow', 'Helvetica Neue', Arial, sans-serif";
const TOKEN = { textSubtle: "rgba(255,255,255,0.4)", surface: "#1c1e2e", border: "rgba(255,255,255,0.12)", grid: "rgba(255,255,255,0.06)" };

function fmtMs(v: number): string {
  if (v === 0) return "0";
  return v >= 1000 ? `${(v / 1000).toFixed(2)}s` : `${Math.round(v)}ms`;
}
function fmtCls(v: number): string {
  return v === 0 ? "0" : v.toFixed(3);
}

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

interface PivotedRow {
  day: string;
  dayTs: number;
  [device: string]: string | number | null;
}

interface Props {
  data: CwvDailyDevicePoint[];
  metric: "lcp" | "inp" | "cls";
  fillRange?: [number, number];
}

export const CwvSingleMetricChart: React.FC<Props> = ({ data, metric, fillRange }) => {
  const { rows, deviceTypes } = useMemo(() => {
    // Build per-day, per-device map
    const dayDeviceMap = new Map<number, Map<string, number>>();
    const dtSet = new Set<string>();

    data.forEach((d) => {
      if (!d.dayTs) return;
      const aligned = new Date(d.dayTs);
      aligned.setUTCHours(0, 0, 0, 0);
      const ts = aligned.getTime();
      const dt = d.deviceType.toLowerCase();
      dtSet.add(dt);
      if (!dayDeviceMap.has(ts)) dayDeviceMap.set(ts, new Map());
      dayDeviceMap.get(ts)!.set(dt, d[metric]);
    });

    const KNOWN_ORDER = ["desktop", "mobile", "tablet", "other"];
    const allDt = Array.from(dtSet);
    const deviceTypes = [
      ...KNOWN_ORDER.filter((k) => allDt.includes(k)),
      ...allDt.filter((d) => !KNOWN_ORDER.includes(d)).sort(),
    ];

    const dayTsList = fillRange
      ? allDaysInRange(fillRange[0], fillRange[1])
      : Array.from(dayDeviceMap.keys()).sort((a, b) => a - b);

    const pivotedRows: PivotedRow[] = dayTsList.map((ts) => {
      const row: PivotedRow = {
        day: new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
        dayTs: ts,
      };
      const devMap = dayDeviceMap.get(ts);
      deviceTypes.forEach((dt) => {
        row[dt] = devMap?.has(dt) ? (devMap.get(dt) ?? null) : null;
      });
      return row;
    });

    return { rows: pivotedRows, deviceTypes };
  }, [data, metric, fillRange]);

  if (rows.length === 0) return null;

  const tickInterval = Math.max(1, Math.ceil(rows.length / 7)) - 1;
  const { good, poor } = THRESHOLDS[metric];
  const fmt = metric === "cls" ? fmtCls : fmtMs;
  const axisStyle = { fontSize: 11, fill: TOKEN.textSubtle, fontFamily: FONT };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: TOKEN.surface, border: `1px solid ${TOKEN.border}`, borderRadius: 6, padding: "8px 12px", fontSize: 12, fontFamily: FONT }}>
        <div style={{ color: TOKEN.textSubtle, marginBottom: 4, fontSize: 11 }}>{label}</div>
        {payload.map((p: any) => (
          <div key={p.dataKey} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 2 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, flexShrink: 0, display: "inline-block" }} />
            <span style={{ color: "rgba(255,255,255,0.7)", textTransform: "capitalize" }}>{p.dataKey}</span>
            <span style={{ color: "#fff", fontWeight: 600, marginLeft: "auto", paddingLeft: 12 }}>
              {p.value != null ? fmt(p.value) : "—"}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={TOKEN.grid} vertical={false} />
        <XAxis dataKey="day" tick={axisStyle} axisLine={false} tickLine={false} interval={tickInterval} />
        <YAxis tickFormatter={fmt} tick={axisStyle} axisLine={false} tickLine={false} width={50} />
        <Tooltip content={<CustomTooltip />} wrapperStyle={{ zIndex: 9999 }} />
        <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, paddingTop: 6, fontFamily: FONT, color: "rgba(255,255,255,0.6)" }} />
        <ReferenceLine y={good} stroke="rgba(46,204,133,0.4)" strokeDasharray="4 4" />
        <ReferenceLine y={poor} stroke="rgba(232,52,90,0.4)" strokeDasharray="4 4" />
        {deviceTypes.map((dt) => (
          <Line
            key={dt}
            type="monotone"
            dataKey={dt}
            name={dt.charAt(0).toUpperCase() + dt.slice(1)}
            stroke={DEVICE_COLORS[dt] ?? "#888EA8"}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
            isAnimationActive={false}
            connectNulls={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
};
