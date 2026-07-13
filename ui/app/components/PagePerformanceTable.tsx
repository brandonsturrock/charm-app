import React, { useMemo, useState } from "react";

export interface PagePerfRow {
  name: string;
  count: number;
  lcp: number | null;          // ms
  inp: number | null;          // ms
  cls: number | null;          // decimal (e.g. 0.05)
  exceptions: number | null;
  requestErrors: number | null;
}

const TOKEN = {
  textDefault: "rgba(255,255,255,0.85)",
  textSubtle: "rgba(255,255,255,0.4)",
  textMuted: "rgba(255,255,255,0.2)",
  border: "rgba(255,255,255,0.08)",
  rowHover: "rgba(255,255,255,0.04)",
  font: "'DT Flow', 'Helvetica Neue', Arial, sans-serif",
};

const GOOD = "#2ECC85";
const WARN = "#F5A623";
const POOR = "#E8345A";
const NEUTRAL = "rgba(255,255,255,0.6)";
const VISITS_BAR = "rgba(123,97,255,0.55)";

function lcpColor(v: number | null) { return v == null ? NEUTRAL : v < 2500 ? GOOD : v < 4000 ? WARN : POOR; }
function inpColor(v: number | null) { return v == null ? NEUTRAL : v < 200 ? GOOD : v < 500 ? WARN : POOR; }
function clsColor(v: number | null) { return v == null ? NEUTRAL : v < 0.1 ? GOOD : v < 0.25 ? WARN : POOR; }
function excColor(v: number | null) { return v == null ? NEUTRAL : v < 0.5 ? NEUTRAL : v < 2 ? WARN : POOR; }
function reqColor(v: number | null) { return v == null ? NEUTRAL : v < 0.3 ? NEUTRAL : v < 1 ? WARN : POOR; }

function fmtMs(v: number | null): string {
  if (v == null) return "—";
  return v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${Math.round(v)}ms`;
}

const SparkBar: React.FC<{ pct: number; color: string }> = ({ pct, color }) => (
  <div style={{ height: 3, borderRadius: 2, background: TOKEN.border, marginTop: 4, overflow: "hidden" }}>
    <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", borderRadius: 2, background: color }} />
  </div>
);

const TH: React.FC<{ children: React.ReactNode; width?: number | string; align?: "left" | "right" }> = ({ children, width, align = "left" }) => (
  <th style={{
    padding: "7px 10px",
    textAlign: align,
    fontSize: 11,
    fontWeight: 600,
    color: TOKEN.textSubtle,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
    width,
  }}>{children}</th>
);

interface Props { rows: PagePerfRow[] }

export const PagePerformanceTable: React.FC<Props> = ({ rows }) => {
  const [hovered, setHovered] = useState<number | null>(null);

  const maxCount = useMemo(() => Math.max(...rows.map(r => r.count), 1), [rows]);
  const maxLcp   = useMemo(() => Math.max(...rows.map(r => r.lcp ?? 0), 1), [rows]);
  const maxInp   = useMemo(() => Math.max(...rows.map(r => r.inp ?? 0), 1), [rows]);
  const maxCls   = useMemo(() => Math.max(...rows.map(r => r.cls ?? 0), 0.01), [rows]);
  const maxExc   = useMemo(() => Math.max(...rows.map(r => r.exceptions ?? 0), 0.01), [rows]);
  const maxReq   = useMemo(() => Math.max(...rows.map(r => r.requestErrors ?? 0), 0.01), [rows]);

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: TOKEN.font }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${TOKEN.border}` }}>
            <TH width={28}>#</TH>
            <TH>Page</TH>
            <TH width={90} align="right">Visits</TH>
            <TH width={100}>LCP p75</TH>
            <TH width={100}>INP p75</TH>
            <TH width={90}>CLS p75</TH>
            <TH width={110}>Avg Exceptions</TH>
            <TH width={110}>Avg Req Errors</TH>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={`${row.name}-${i}`}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{
                background: hovered === i ? TOKEN.rowHover : "transparent",
                borderBottom: `1px solid ${TOKEN.border}`,
                transition: "background 0.1s",
              }}
            >
              <td style={{ padding: "9px 10px", fontSize: 11, color: TOKEN.textMuted, fontWeight: 600, textAlign: "right" }}>{i + 1}</td>

              <td style={{ padding: "9px 10px", maxWidth: 240, minWidth: 140 }}>
                <div style={{ fontSize: 13, color: TOKEN.textDefault, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {row.name}
                </div>
                <SparkBar pct={(row.count / maxCount) * 100} color={VISITS_BAR} />
              </td>

              <td style={{ padding: "9px 10px", fontSize: 13, color: TOKEN.textDefault, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                {row.count.toLocaleString()}
              </td>

              {/* LCP */}
              <td style={{ padding: "9px 10px" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: lcpColor(row.lcp), fontVariantNumeric: "tabular-nums" }}>{fmtMs(row.lcp)}</div>
                <SparkBar pct={((row.lcp ?? 0) / maxLcp) * 100} color={lcpColor(row.lcp)} />
              </td>

              {/* INP */}
              <td style={{ padding: "9px 10px" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: inpColor(row.inp), fontVariantNumeric: "tabular-nums" }}>{fmtMs(row.inp)}</div>
                <SparkBar pct={((row.inp ?? 0) / maxInp) * 100} color={inpColor(row.inp)} />
              </td>

              {/* CLS */}
              <td style={{ padding: "9px 10px" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: clsColor(row.cls), fontVariantNumeric: "tabular-nums" }}>
                  {row.cls != null ? row.cls.toFixed(3) : "—"}
                </div>
                <SparkBar pct={((row.cls ?? 0) / maxCls) * 100} color={clsColor(row.cls)} />
              </td>

              {/* Exceptions */}
              <td style={{ padding: "9px 10px" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: excColor(row.exceptions), fontVariantNumeric: "tabular-nums" }}>
                  {row.exceptions != null ? row.exceptions.toFixed(2) : "—"}
                </div>
                <SparkBar pct={((row.exceptions ?? 0) / maxExc) * 100} color={excColor(row.exceptions)} />
              </td>

              {/* Request Errors */}
              <td style={{ padding: "9px 10px" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: reqColor(row.requestErrors), fontVariantNumeric: "tabular-nums" }}>
                  {row.requestErrors != null ? row.requestErrors.toFixed(2) : "—"}
                </div>
                <SparkBar pct={((row.requestErrors ?? 0) / maxReq) * 100} color={reqColor(row.requestErrors)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
