import React, { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export interface DailyErrorPoint {
  day: string | number | null;
  deviceType: string | null;
  totalSessions: number | null;
  jsErrorSessions: number | null;
  reqErrorSessions: number | null;
}

interface PivotedRow {
  day: string;
  dayTs: number;
  [key: string]: string | number | null;
}

const DEVICE_COLORS: Record<string, string> = {
  desktop: "#7B61FF",
  mobile: "#2ECC85",
  tablet: "#00B8E0",
  other: "#888EA8",
};

const KNOWN_ORDER = ["desktop", "mobile", "tablet", "other"];

const FONT = "'DT Flow', 'Helvetica Neue', Arial, sans-serif";
const TOKEN = { textSubtle: "rgba(255,255,255,0.4)", surface: "#1c1e2e", border: "rgba(255,255,255,0.12)", grid: "rgba(255,255,255,0.06)" };

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

const PctTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: TOKEN.surface, border: `1px solid ${TOKEN.border}`, borderRadius: 6, padding: "8px 12px", fontSize: 12, fontFamily: FONT }}>
      <div style={{ color: TOKEN.textSubtle, marginBottom: 4, fontSize: 11 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, flexShrink: 0, display: "inline-block" }} />
          <span style={{ color: "rgba(255,255,255,0.7)", textTransform: "capitalize" }}>{p.name}</span>
          <span style={{ color: "#fff", fontWeight: 600, marginLeft: "auto", paddingLeft: 12 }}>
            {p.value != null ? `${(p.value as number).toFixed(1)}%` : "—"}
          </span>
        </div>
      ))}
    </div>
  );
};

interface Props {
  data: DailyErrorPoint[];
  fillRange?: [number, number];
}

export const DailyErrorChart: React.FC<Props> = ({ data, fillRange }) => {
  const { jsRows, reqRows, deviceTypes } = useMemo(() => {
    // per-day per-device: { jsErrorSessions, reqErrorSessions, totalSessions }
    type DayDevice = { js: number; req: number; total: number };
    const dayDeviceMap = new Map<number, Map<string, DayDevice>>();
    const dtSet = new Set<string>();

    data.forEach((d) => {
      const ts = typeof d.day === "number" ? d.day : d.day ? new Date(d.day as string).getTime() : null;
      if (ts === null) return;
      const aligned = new Date(ts);
      aligned.setUTCHours(0, 0, 0, 0);
      const alignedTs = aligned.getTime();
      const dt = (d.deviceType ?? "other").toLowerCase();
      dtSet.add(dt);
      if (!dayDeviceMap.has(alignedTs)) dayDeviceMap.set(alignedTs, new Map());
      dayDeviceMap.get(alignedTs)!.set(dt, {
        js: d.jsErrorSessions ?? 0,
        req: d.reqErrorSessions ?? 0,
        total: d.totalSessions ?? 0,
      });
    });

    const deviceTypes = [
      ...KNOWN_ORDER.filter((k) => dtSet.has(k)),
      ...Array.from(dtSet).filter((d) => !KNOWN_ORDER.includes(d)).sort(),
    ];

    const dayTsList = fillRange
      ? allDaysInRange(fillRange[0], fillRange[1])
      : Array.from(dayDeviceMap.keys()).sort((a, b) => a - b);

    function buildRows(errorKey: "js" | "req"): PivotedRow[] {
      return dayTsList.map((ts) => {
        const row: PivotedRow = {
          day: new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
          dayTs: ts,
        };
        const devMap = dayDeviceMap.get(ts);
        deviceTypes.forEach((dt) => {
          const entry = devMap?.get(dt);
          if (entry && entry.total > 0) {
            row[dt] = (entry[errorKey] / entry.total) * 100;
          } else {
            row[dt] = devMap ? 0 : null;
          }
        });
        return row;
      });
    }

    return { jsRows: buildRows("js"), reqRows: buildRows("req"), deviceTypes };
  }, [data, fillRange]);

  if (jsRows.length === 0) return null;

  const tickInterval = Math.max(1, Math.ceil(jsRows.length / 7)) - 1;
  const axisStyle = { fontSize: 11, fill: TOKEN.textSubtle, fontFamily: FONT };

  const chart = (rows: PivotedRow[], title: string) => (
    <div>
      <div style={{ fontSize: 11, color: TOKEN.textSubtle, fontFamily: FONT, marginBottom: 6, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
        {title}
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={rows} margin={{ top: 4, right: 12, bottom: 0, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={TOKEN.grid} vertical={false} />
          <XAxis dataKey="day" tick={axisStyle} axisLine={false} tickLine={false} interval={tickInterval} />
          <YAxis
            tickFormatter={(v) => `${(v as number).toFixed(0)}%`}
            tick={axisStyle}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip content={<PctTooltip />} wrapperStyle={{ zIndex: 9999 }} />
          <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, paddingTop: 6, fontFamily: FONT, color: "rgba(255,255,255,0.6)" }} />
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
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {chart(jsRows, "JS Error Rate (% of sessions)")}
      {chart(reqRows, "Request Error Rate (% of sessions)")}
    </div>
  );
};
