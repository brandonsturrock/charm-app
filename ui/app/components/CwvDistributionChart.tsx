import React, { useState } from "react";

export interface CwvDistributionRecord {
  lcp_b0: number | null; lcp_b1: number | null; lcp_b2: number | null; lcp_b3: number | null;
  lcp_b4: number | null; lcp_b5: number | null; lcp_b6: number | null; lcp_b7: number | null;
  lcp_b8: number | null; lcp_b9: number | null; lcp_b10: number | null;
  lcp_total: number | null; lcp_p50: number | null;
  inp_b0: number | null; inp_b1: number | null; inp_b2: number | null; inp_b3: number | null;
  inp_b4: number | null; inp_b5: number | null; inp_b6: number | null; inp_b7: number | null;
  inp_b8: number | null; inp_b9: number | null; inp_b10: number | null;
  inp_total: number | null; inp_p50: number | null;
}

interface Bucket { label: string; count: number; pct: number; color: string; }
interface Metric  { name: string; p50Label: string; buckets: Bucket[]; }

const FONT = "'DT Flow', 'Helvetica Neue', Arial, sans-serif";
const BAR_H = 96;
const LABEL_W = 90;

const BIN_LABELS = ["0–1s","1–2s","2–3s","3–4s","4–5s","5–6s","6–7s","7–8s","8–9s","9–10s","10s+"];

// Blue (fast) → neutral → orange → red (slow); LCP good < 2.5s, NI < 4s
const BIN_COLORS = [
  "#1c5cab", // 0–1s
  "#2563b0", // 1–2s
  "#6da7ec", // 2–3s (LCP good/NI boundary at 2.5s)
  "#888ea8", // 3–4s (LCP NI/poor boundary at 4s)
  "#c9956a", // 4–5s
  "#F5A623", // 5–6s
  "#eb8234", // 6–7s
  "#eb6834", // 7–8s
  "#e04545", // 8–9s
  "#d03b3b", // 9–10s
  "#a82020", // 10s+
];

function formatP50(ms: number | null): string {
  if (ms == null) return "—";
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}

function buildBuckets(counts: (number | null)[], total: number | null): Bucket[] {
  const t = total ?? 0;
  return counts.map((c, i) => ({
    label: BIN_LABELS[i],
    count: c ?? 0,
    pct: t > 0 ? ((c ?? 0) / t) * 100 : 0,
    color: BIN_COLORS[i],
  }));
}

function buildMetrics(d: CwvDistributionRecord): Metric[] {
  const lcpCounts = [d.lcp_b0,d.lcp_b1,d.lcp_b2,d.lcp_b3,d.lcp_b4,d.lcp_b5,d.lcp_b6,d.lcp_b7,d.lcp_b8,d.lcp_b9,d.lcp_b10];
  const inpCounts = [d.inp_b0,d.inp_b1,d.inp_b2,d.inp_b3,d.inp_b4,d.inp_b5,d.inp_b6,d.inp_b7,d.inp_b8,d.inp_b9,d.inp_b10];
  return [
    { name: "LCP", p50Label: formatP50(d.lcp_p50), buckets: buildBuckets(lcpCounts, d.lcp_total) },
    { name: "INP", p50Label: formatP50(d.inp_p50), buckets: buildBuckets(inpCounts, d.inp_total) },
  ];
}

const HoverTooltip: React.FC<{ label: string; pct: number; count: number; color: string }> = ({ label, pct, count, color }) => (
  <div style={{
    position: "absolute", bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)",
    background: "#1c1e2e", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6,
    padding: "6px 10px", fontSize: 11, fontFamily: FONT, whiteSpace: "nowrap", zIndex: 100,
    pointerEvents: "none",
  }}>
    <div style={{ color: "rgba(255,255,255,0.5)", marginBottom: 2 }}>{label}</div>
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0, display: "inline-block" }} />
      <span style={{ color: "#fff", fontWeight: 700 }}>{pct.toFixed(1)}%</span>
      <span style={{ color: "rgba(255,255,255,0.4)" }}>({count.toLocaleString()})</span>
    </div>
  </div>
);

const MetricRow: React.FC<{ metric: Metric }> = ({ metric }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const maxPct = Math.max(...metric.buckets.map((b) => b.pct), 1);

  return (
    <div style={{ display: "flex", alignItems: "stretch" }}>
      <div style={{
        width: LABEL_W, flexShrink: 0, display: "flex", flexDirection: "column",
        justifyContent: "center", alignItems: "flex-end", paddingRight: 12,
        borderRight: "1px solid rgba(255,255,255,0.08)",
      }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: "#fff", fontFamily: FONT, lineHeight: 1 }}>
          {metric.p50Label}
        </span>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: FONT, marginTop: 3 }}>
          Median {metric.name}
        </span>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "flex-end", paddingLeft: 8, paddingRight: 4, gap: 3 }}>
        {metric.buckets.map((b, i) => {
          const barH = Math.max((b.pct / maxPct) * BAR_H, b.pct > 0 ? 3 : 0);
          const isHovered = hoveredIdx === i;
          const pctLabel = b.pct === 0 ? "0%" : b.pct < 1 ? `${b.pct.toFixed(1)}%` : `${Math.round(b.pct)}%`;

          return (
            <div
              key={i}
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
                       height: BAR_H + 20, justifyContent: "flex-end", position: "relative", cursor: "default" }}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {isHovered && <HoverTooltip label={b.label} pct={b.pct} count={b.count} color={b.color} />}
              <span style={{
                fontSize: 10, fontFamily: FONT, marginBottom: 3,
                color: b.pct === 0 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.7)",
                fontWeight: b.pct >= 10 ? 600 : 400,
              }}>
                {pctLabel}
              </span>
              <div style={{
                width: "100%", height: barH, background: b.color,
                borderRadius: "3px 3px 0 0",
                opacity: isHovered ? 1 : b.pct === 0 ? 0.2 : 0.85,
                transition: "opacity 0.1s",
              }} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const CwvDistributionChart: React.FC<{ data: CwvDistributionRecord }> = ({ data }) => {
  const metrics = buildMetrics(data);

  return (
    <div style={{ fontFamily: FONT, userSelect: "none" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {metrics.map((m, i) => (
          <div key={m.name} style={{
            background: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent",
            borderRadius: 4, padding: "10px 0",
          }}>
            <MetricRow metric={m} />
          </div>
        ))}
      </div>

      {/* X-axis labels */}
      <div style={{ display: "flex", paddingLeft: LABEL_W + 8, paddingRight: 4, gap: 3, marginTop: 4 }}>
        {BIN_LABELS.map((label) => (
          <div key={label} style={{ flex: 1, textAlign: "center", fontSize: 10, color: "rgba(255,255,255,0.35)", fontFamily: FONT }}>
            {label}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 14 }}>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: FONT }}>Faster</span>
        <div style={{ display: "flex", gap: 2 }}>
          {BIN_COLORS.map((c) => (
            <div key={c} style={{ width: 14, height: 8, background: c, borderRadius: 2 }} />
          ))}
        </div>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: FONT }}>Slower</span>
      </div>
    </div>
  );
};
