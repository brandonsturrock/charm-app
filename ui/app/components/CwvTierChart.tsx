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
} from "recharts";

export interface CwvTierData {
  lcp_good: number | null; lcp_ni: number | null; lcp_poor: number | null; lcp_total: number | null;
  inp_good: number | null; inp_ni: number | null; inp_poor: number | null; inp_total: number | null;
  cls_good: number | null; cls_ni: number | null; cls_poor: number | null; cls_total: number | null;
}

const TIER_COLORS = {
  good: "#2ECC85",
  ni: "#F5A623",
  poor: "#E8345A",
};

interface TierRow {
  metric: string;
  good: number;
  ni: number;
  poor: number;
  total: number;
  goodN: number;
  niN: number;
  poorN: number;
}

const TOKEN = {
  textSubtle: "rgba(255,255,255,0.4)",
  textDefault: "rgba(255,255,255,0.85)",
  surfaceDefault: "#1c1e2e",
  font: "'DT Flow', 'Helvetica Neue', Arial, sans-serif",
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const row: TierRow = payload[0]?.payload;
  return (
    <div style={{
      background: TOKEN.surfaceDefault,
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 6,
      padding: "8px 12px",
      fontSize: 12,
      fontFamily: TOKEN.font,
      minWidth: 200,
    }}>
      <div style={{ color: TOKEN.textSubtle, marginBottom: 6, fontSize: 11, fontWeight: 600 }}>{label}</div>
      {[
        { key: "good", label: "Good", color: TIER_COLORS.good, n: row?.goodN, pct: row?.good },
        { key: "ni", label: "Needs Improvement", color: TIER_COLORS.ni, n: row?.niN, pct: row?.ni },
        { key: "poor", label: "Poor", color: TIER_COLORS.poor, n: row?.poorN, pct: row?.poor },
      ].map(({ key, label: tierLabel, color, n, pct }) => (
        <div key={key} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 3 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0, display: "inline-block" }} />
          <span style={{ color: TOKEN.textDefault, flex: 1 }}>{tierLabel}</span>
          <span style={{ color: "#fff", fontWeight: 600 }}>{n != null ? n.toLocaleString() : "—"}</span>
          <span style={{ color: TOKEN.textSubtle, fontSize: 11 }}>({pct != null ? `${Math.round(pct)}%` : "—"})</span>
        </div>
      ))}
      {row?.total != null && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", marginTop: 4, paddingTop: 4, color: TOKEN.textSubtle, fontSize: 11 }}>
          n = {row.total.toLocaleString()}
        </div>
      )}
    </div>
  );
};

interface Props {
  data: CwvTierData;
}

export const CwvTierChart: React.FC<Props> = ({ data }) => {
  const rows: TierRow[] = useMemo(() => {
    function pct(n: number | null, total: number | null): number {
      if (!total || total === 0 || n == null) return 0;
      return (n / total) * 100;
    }
    return [
      {
        metric: "LCP",
        good: pct(data.lcp_good, data.lcp_total),
        ni: pct(data.lcp_ni, data.lcp_total),
        poor: pct(data.lcp_poor, data.lcp_total),
        total: data.lcp_total ?? 0,
        goodN: data.lcp_good ?? 0,
        niN: data.lcp_ni ?? 0,
        poorN: data.lcp_poor ?? 0,
      },
      {
        metric: "INP",
        good: pct(data.inp_good, data.inp_total),
        ni: pct(data.inp_ni, data.inp_total),
        poor: pct(data.inp_poor, data.inp_total),
        total: data.inp_total ?? 0,
        goodN: data.inp_good ?? 0,
        niN: data.inp_ni ?? 0,
        poorN: data.inp_poor ?? 0,
      },
      {
        metric: "CLS",
        good: pct(data.cls_good, data.cls_total),
        ni: pct(data.cls_ni, data.cls_total),
        poor: pct(data.cls_poor, data.cls_total),
        total: data.cls_total ?? 0,
        goodN: data.cls_good ?? 0,
        niN: data.cls_ni ?? 0,
        poorN: data.cls_poor ?? 0,
      },
    ];
  }, [data]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ flex: 1, minHeight: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={rows}
          margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
          barSize={44}
        >
          <CartesianGrid horizontal={false} stroke="rgba(255,255,255,0.06)" />
          <XAxis
            type="number"
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 11, fill: TOKEN.textSubtle, fontFamily: TOKEN.font }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="metric"
            width={48}
            tick={{ fontSize: 12, fill: TOKEN.textDefault, fontFamily: TOKEN.font, fontWeight: 600 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} wrapperStyle={{ zIndex: 9999 }} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
          <Bar dataKey="good" stackId="tier" fill={TIER_COLORS.good} radius={[0, 0, 0, 0]}>
            <LabelList
              dataKey="good"
              position="center"
              formatter={(v: number) => v >= 8 ? `${Math.round(v)}%` : ""}
              style={{ fontSize: 11, fontWeight: 700, fill: "#fff", fontFamily: TOKEN.font }}
            />
          </Bar>
          <Bar dataKey="ni" stackId="tier" fill={TIER_COLORS.ni}>
            <LabelList
              dataKey="ni"
              position="center"
              formatter={(v: number) => v >= 8 ? `${Math.round(v)}%` : ""}
              style={{ fontSize: 11, fontWeight: 700, fill: "#fff", fontFamily: TOKEN.font }}
            />
          </Bar>
          <Bar dataKey="poor" stackId="tier" fill={TIER_COLORS.poor} radius={[0, 3, 3, 0]}>
            <LabelList
              dataKey="poor"
              position="center"
              formatter={(v: number) => v >= 8 ? `${Math.round(v)}%` : ""}
              style={{ fontSize: 11, fontWeight: 700, fill: "#fff", fontFamily: TOKEN.font }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
        {[
          { color: TIER_COLORS.good, label: "Good" },
          { color: TIER_COLORS.ni, label: "Needs Improvement" },
          { color: TIER_COLORS.poor, label: "Poor" },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: color }} />
            <span style={{ fontSize: 11, color: TOKEN.textSubtle, fontFamily: TOKEN.font }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
