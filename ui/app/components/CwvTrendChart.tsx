import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

export interface CwvWeeklyDataPoint {
  week: string;       // formatted label e.g. "Jun 2"
  weekTs: number;     // ms timestamp for sorting
  lcp: number;        // ms
  inp: number;        // ms
  cls: number;        // unitless * 1000 stored as-is
}

const COLORS = {
  lcp: "#F5A623",
  inp: "#1496ff",
  cls: "#73be28",
};

const THRESHOLDS = {
  lcp: { good: 2500, poor: 4000 },
  inp: { good: 200, poor: 500 },
  cls: { good: 0.1, poor: 0.25 },
};

function fmtMs(v: number): string {
  if (v === 0) return "0";
  return v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${Math.round(v)}ms`;
}

function fmtCls(v: number): string {
  return v.toFixed(2);
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#1c1e2e",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 6,
      padding: "8px 12px",
      fontSize: 12,
      fontFamily: "'DT Flow', 'Helvetica Neue', Arial, sans-serif",
    }}>
      <div style={{ color: "rgba(255,255,255,0.5)", marginBottom: 6, fontSize: 11 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 3 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, flexShrink: 0, display: "inline-block" }} />
          <span style={{ color: "rgba(255,255,255,0.7)", minWidth: 32 }}>{p.name}</span>
          <span style={{ color: "#fff", fontWeight: 600 }}>
            {p.dataKey === "cls" ? fmtCls(p.value) : fmtMs(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
};

interface Props {
  data: CwvWeeklyDataPoint[];
  pdfWidth?: number;
  pdfHeight?: number;
  fontScale?: number;
}

export const CwvTrendChart: React.FC<Props> = ({ data, pdfWidth, pdfHeight, fontScale = 1 }) => {
  const sorted = [...data].sort((a, b) => a.weekTs - b.weekTs);
  const tickSz = Math.round(10 * fontScale);
  const axisLabelSz = Math.round(10 * fontScale);
  const legendSz = Math.round(11 * fontScale);

  return (
    <ResponsiveContainer width={pdfWidth ?? "100%"} height={pdfHeight ?? "100%"}>
      <LineChart data={sorted} margin={{ top: 8, right: 48, bottom: 4, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />

        <XAxis
          dataKey="week"
          tick={{ fontSize: tickSz, fill: "rgba(255,255,255,0.4)", fontFamily: "'DT Flow', sans-serif" }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />

        {/* Left axis — LCP & INP in ms */}
        <YAxis
          yAxisId="ms"
          tickFormatter={fmtMs}
          tick={{ fontSize: tickSz, fill: "rgba(255,255,255,0.4)", fontFamily: "'DT Flow', sans-serif" }}
          axisLine={false}
          tickLine={false}
          width={56}
          label={{ value: "LCP + INP", angle: -90, position: "insideLeft", offset: 10, style: { fontSize: axisLabelSz, fill: "rgba(255,255,255,0.35)", fontFamily: "'DT Flow', sans-serif" } }}
        />

        {/* Right axis — CLS */}
        <YAxis
          yAxisId="cls"
          orientation="right"
          tickFormatter={fmtCls}
          tick={{ fontSize: tickSz, fill: "rgba(255,255,255,0.4)", fontFamily: "'DT Flow', sans-serif" }}
          axisLine={false}
          tickLine={false}
          width={52}
          domain={[0, "auto"]}
          label={{ value: "CLS", angle: 90, position: "insideRight", dx: 14, style: { fontSize: axisLabelSz, fill: "rgba(255,255,255,0.35)", fontFamily: "'DT Flow', sans-serif" } }}
        />

        <Tooltip content={<CustomTooltip />} wrapperStyle={{ zIndex: 9999 }} />

        <Legend
          iconType="circle"
          iconSize={7}
          wrapperStyle={{ fontSize: legendSz, paddingTop: 8, fontFamily: "'DT Flow', sans-serif", color: "rgba(255,255,255,0.6)" }}
        />

        {/* Good/poor reference lines on the ms axis */}
        <ReferenceLine yAxisId="ms" y={THRESHOLDS.lcp.good} stroke={COLORS.lcp} strokeDasharray="4 4" strokeOpacity={0.25} />
        <ReferenceLine yAxisId="ms" y={THRESHOLDS.inp.good} stroke={COLORS.inp} strokeDasharray="4 4" strokeOpacity={0.25} />

        <Line
          yAxisId="ms"
          type="monotone"
          dataKey="lcp"
          name="LCP"
          stroke={COLORS.lcp}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
          isAnimationActive={false}
        />
        <Line
          yAxisId="ms"
          type="monotone"
          dataKey="inp"
          name="INP"
          stroke={COLORS.inp}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
          isAnimationActive={false}
        />
        <Line
          yAxisId="cls"
          type="monotone"
          dataKey="cls"
          name="CLS"
          stroke={COLORS.cls}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};
