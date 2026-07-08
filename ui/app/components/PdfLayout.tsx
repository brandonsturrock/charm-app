import React from "react";
import { marked } from "marked";
import { UserTrafficChart, type UserTrafficDataPoint } from "./UserTrafficChart";
import { CoreWebVitalsChart, type WebVitalsDataPoint } from "./CoreWebVitalsChart";
import { CwvTrendChart, type CwvWeeklyDataPoint } from "./CwvTrendChart";
import { BrowserPerformanceChart, type BrowserPerfDataPoint } from "./BrowserPerformanceChart";

export interface KpiTile {
  label: string;
  value: string;
  change: number | null;
  color: string;
  lowerIsBetter?: boolean;
}

interface PdfLayoutProps {
  frontendName: string;
  environmentName: string;
  month: string;
  kpis: KpiTile[];
  analystNotes: string;
  userTrafficData: UserTrafficDataPoint[];
  vitalsData: WebVitalsDataPoint[];
  cwvWeeklyData: CwvWeeklyDataPoint[];
  browserPerfData: BrowserPerfDataPoint[];
  browserPerfLatestMonth: string;
}

const DT_LOGO_PATHS = (
  <>
    <g fill="currentColor" id="text">
      <path d="m578.6 37.2h-18.4c-5.2 0-8.8 1-11 3.2-2.2 2.1-3.3 5.8-3.3 10.8v63.6h-11v-64.4c.1-4.9.9-10.2 3.5-14.2 4.7-7.5 13.7-8.9 20.4-8.9h19.9v9.9z" />
      <path d="m507.6 104.8c-5.2 0-8.8-1-11-3.2-2.2-2.1-3.3-5.6-3.3-10.6v-53.8h23.1v-9.9h-23.1v-26.3h-11v90.6c.1 4.9.9 10.2 3.5 14.2 4.7 7.5 13.7 8.9 20.4 8.9h19.9v-9.9z" />
      <path d="m219.3 1v26.2h-23.1c-14 0-22.5 4.2-27.8 9.3-8.1 7.9-8.1 19.2-8.1 20.4v28.2c0 1.2 0 12.5 8.1 20.4 5.2 5.1 13.7 9.3 27.8 9.3h10.3c6.7 0 15.7-1.5 20.4-8.9 2.5-4 3.4-9.3 3.5-14.2v-90.7zm-3.3 100.7c-2.2 2.1-5.8 3.2-11 3.2h-10c-9.1 0-14.8-2.6-18.2-6-4.1-4-5.5-9.3-5.5-13.4v-28.9c0-4.1 1.4-9.4 5.5-13.4 3.5-3.4 9.1-6 18.2-6h24.2v53.9c.1 4.9-1 8.4-3.2 10.6z" />
      <path d="m678.2 43.2c3.5-3.4 9.1-6 18.2-6h26.5v-9.9h-25.4c-14 0-22.5 4.2-27.8 9.3-8.1 7.9-8.1 19.2-8.1 20.4v28.2c0 1.2 0 12.5 8.1 20.4 5.2 5.1 13.7 9.3 27.8 9.3h25.4v-9.9h-26.5c-9.1 0-14.8-2.6-18.2-6-4.1-4-5.5-9.3-5.5-13.4v-29c0-4.1 1.4-9.5 5.5-13.4z" />
      <path d="m470.9 56.9c0-1.2 0-12.5-8.1-20.4-5.2-5.1-13.7-9.3-27.8-9.3h-24.5v9.9h25.6c9.1 0 14.8 2.6 18.2 6 4.1 4 5.5 9.3 5.5 13.4v8.5h-35.1c-6.7 0-15.7 1.5-20.4 8.9-2.5 4-3.4 9.3-3.5 14.2v3.5c.1 4.9.9 10.2 3.5 14.2 4.7 7.5 13.7 8.9 20.4 8.9h22.3c6.7 0 15.7-1.5 20.4-8.9 2.5-4 3.4-9.3 3.5-14.2 0 0 0-29 0-34.7zm-14.3 44.8c-2.2 2.1-5.8 3.2-11 3.2h-19.4c-5.2 0-8.8-1-11-3.2s-3.2-5.7-3.2-10.6v-2.4c0-5 1.1-8.5 3.3-10.6s5.8-3.2 11-3.2h33.6v16.2c0 4.9-1.1 8.4-3.3 10.6z" />
      <path d="m652.9 56.9c0-1.2 0-12.5-8.1-20.4-5.2-5.1-13.7-9.3-27.8-9.3h-24.5v9.9h25.6c9.1 0 14.8 2.6 18.2 6 4.1 4 5.5 9.3 5.5 13.4v8.5h-35.1c-6.7 0-15.7 1.5-20.4 8.9-2.5 4-3.4 9.3-3.5 14.2v3.5c.1 4.9.9 10.2 3.5 14.2 4.7 7.5 13.7 8.9 20.4 8.9h22.3c6.7 0 15.7-1.5 20.4-8.9 2.5-4 3.4-9.3 3.5-14.2 0 0 0-29 0-34.7zm-14.3 44.8c-2.2 2.1-5.8 3.2-11 3.2h-19.4c-5.2 0-8.8-1-11-3.2s-3.2-5.7-3.2-10.6v-2.4c0-5 1.1-8.5 3.3-10.6s5.8-3.2 11-3.2h33.6v16.2c0 4.9-1.1 8.4-3.3 10.6z" />
      <path d="m317.8 27.2h-11.5l-27.9 72.6-27.9-72.6h-11.4l33.6 87.5-10.1 26.3h11.5z" />
      <path d="m392.2 56.9c0-1.2 0-12.5-8-20.4-5.1-5-13.2-9.1-26.4-9.3h-1.2c-13.2.2-21.3 4.3-26.4 9.3-8 7.9-8 19.2-8 20.4v57.9h11v-58.2c0-4.1 1.3-9.4 5.4-13.4 3.4-3.3 9.9-5.9 18.6-6 8.7.1 15.2 2.7 18.6 6 4 4 5.4 9.3 5.4 13.4v58.2h11c0-4.5 0-56.5 0-57.9z" />
      <path d="m791 36.5c-5.1-5-13.2-9.1-26.4-9.3h-1.2c-13.2.2-21.3 4.3-26.4 9.3-8 7.9-8 19.2-8 20.4v28.2c0 1.2 0 12.5 8 20.4 5.1 5 13.2 9.1 26.4 9.3h26v-10h-25.4c-8.7-.1-15.2-2.7-18.6-6-4-4-5.4-9.3-5.4-13.4v-10.3h59v-18.2c.1-1.2.1-12.5-8-20.4zm-50.9 28.7v-8.6c0-4.1 1.3-9.4 5.4-13.4 3.4-3.3 9.9-5.9 18.6-6 8.7.1 15.2 2.7 18.6 6 4 4 5.4 9.3 5.4 13.4v8.6z" />
    </g>
    <g id="logo">
      <path d="m47.7 12.7c-1.8 9.5-4 23.6-5.2 37.9-2.1 25.2-.8 42.1-.8 42.1l-35.5 33.7s-2.7-18.9-4.1-40.2c-.8-13.2-1.1-24.8-1.1-31.8 0-.4.2-.8.2-1.2 0-.5.6-5.2 5.2-9.6 5-4.8 41.9-33.7 41.3-30.9z" fill="#1496ff" />
      <path d="m47.7 12.7c-1.8 9.5-4 23.6-5.2 37.9 0 0-39.3-4.7-41.5 4.8 0-.5.7-6.3 5.3-10.7 5-4.8 42-34.8 41.4-32z" fill="#1284ea" />
      <path d="m1 53.1v2.2c.4-1.7 1.1-2.9 2.5-4.8 2.9-3.7 7.6-4.7 9.5-4.9 9.6-1.3 23.8-2.8 38.1-3.2 25.3-.8 42 1.3 42 1.3l35.5-33.7s-18.6-3.5-39.8-6c-13.9-1.7-26.1-2.6-33-3-.5 0-5.4-.6-10 3.8-5 4.8-30.4 28.9-40.6 38.6-4.6 4.4-4.2 9.3-4.2 9.7z" fill="#b4dc00" />
      <path d="m127.3 96.2c-9.6 1.3-23.8 2.9-38.1 3.4-25.3.8-42.1-1.3-42.1-1.3l-35.5 33.8s18.8 3.7 40 6.1c13 1.5 24.5 2.3 31.5 2.7.5 0 1.3-.4 1.8-.4s5.4-.9 10-5.3c5-4.8 35.2-39.3 32.4-39z" fill="#6f2da8" />
      <path d="m127.3 96.2c-9.6 1.3-23.8 2.9-38.1 3.4 0 0 2.7 39.5-6.8 41.2.5 0 7-.3 11.6-4.7 5-4.8 36.1-40.2 33.3-39.9z" fill="#591f91" />
      <path d="m84.5 141c-.7 0-1.4-.1-2.2-.1 1.8-.3 3-.9 4.9-2.3 3.8-2.7 5-7.4 5.4-9.3 1.7-9.5 4-23.6 5.1-37.9 2-25.2.8-42 .8-42l35.5-33.8s2.6 18.8 4.1 40.1c.9 13.9 1.2 26.2 1.3 33 0 .5.4 5.4-4.2 9.8-5 4.8-30.4 29-40.5 38.7-4.8 4.4-9.7 3.8-10.2 3.8z" fill="#73be28" />
    </g>
  </>
);

const PDF_W = 1748;
const PDF_H = 1240;

const S = {
  bg: "#0f1117",
  card: "#161b27",
  cardBorder: "rgba(20,150,255,0.14)",
  accent: "#1496ff",
  accentGlow: "rgba(20,150,255,0.35)",
  textPrimary: "#e8edf5",
  textSecondary: "#8899bb",
  textMuted: "#4a5568",
  divider: "rgba(255,255,255,0.07)",
  gradientLine: "linear-gradient(90deg, #1496ff 0%, rgba(20,150,255,0.4) 40%, rgba(20,150,255,0) 100%)",
  font: "'DT Flow', 'Helvetica Neue', Arial, sans-serif",
} as const;

export const PdfLayout = React.forwardRef<HTMLDivElement, PdfLayoutProps>(
  ({ frontendName, environmentName, month, kpis, analystNotes, userTrafficData, vitalsData, cwvWeeklyData, browserPerfData, browserPerfLatestMonth }, ref) => {
    const notesHtml = analystNotes.trim() ? marked(analystNotes) as string : "";
    return (
      <div
        ref={ref}
        style={{
          width: PDF_W,
          height: PDF_H,
          background: S.bg,
          fontFamily: S.font,
          color: S.textPrimary,
          boxSizing: "border-box",
          padding: "36px 44px 28px",
          display: "flex",
          flexDirection: "column",
          position: "fixed",
          left: -PDF_W - 100,
          top: 0,
          zIndex: -1,
          overflow: "hidden",
        }}
      >
        {/* Subtle background texture dots */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: "radial-gradient(circle, rgba(20,150,255,0.04) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }} />

        {/* Top-right glow orb */}
        <div style={{
          position: "absolute", top: -120, right: -80, width: 400, height: 400,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(20,150,255,0.08) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        {/* ── HEADER ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22, position: "relative" }}>
          {/* Left: Logo + divider + BUSINESS INSIGHTS */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <svg
              viewBox="0 0 800 142"
              style={{ height: 26, width: "auto", color: "#ffffff", flexShrink: 0 }}
              xmlns="http://www.w3.org/2000/svg"
            >
              {DT_LOGO_PATHS}
            </svg>
            <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.18)", flexShrink: 0 }} />
            <span style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.2em",
              color: S.textMuted,
              textTransform: "uppercase",
            }}>
              Business Insights
            </span>
          </div>

          {/* Center: TRENDING — absolutely centered in the header */}
          <span style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: "0.28em",
            color: "#ffffff",
            textTransform: "uppercase",
            pointerEvents: "none",
          }}>
            Trending
          </span>

          {/* Right: App name + env + month */}
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: S.textPrimary, letterSpacing: "0.01em", lineHeight: 1.2 }}>
              {frontendName}
            </div>
            {environmentName && (
              <div style={{ fontSize: 10, color: S.accent, marginTop: 3, letterSpacing: "0.06em", fontWeight: 500 }}>
                {environmentName}
              </div>
            )}
            <div style={{ fontSize: 11, color: S.textSecondary, marginTop: 3, letterSpacing: "0.04em" }}>
              {month}
            </div>
          </div>
        </div>

        {/* Accent separator line */}
        <div style={{ height: 2, background: S.gradientLine, borderRadius: 1, marginBottom: 22, position: "relative" }}>
          <div style={{ position: "absolute", left: 0, top: -1, width: 4, height: 4, borderRadius: "50%", background: S.accent, boxShadow: `0 0 8px ${S.accentGlow}` }} />
        </div>

        {/* ── CONTENT LAYOUT ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>

          {/* Row 1: KPI overview table + User Traffic + Core Web Vitals */}
          <div style={{ flex: "0 0 26%", display: "flex", gap: 12, minHeight: 0 }}>
            {/* KPI overview */}
            <div style={{ flex: "0 0 26%" }}>
              <ChartCard title="Overview" fullHeight>
                <KpiOverviewTable kpis={kpis} />
              </ChartCard>
            </div>
            {/* User Traffic */}
            <div style={{ flex: 1 }}>
              <ChartCard title="User Traffic" fullHeight>
                <UserTrafficChart data={userTrafficData} />
              </ChartCard>
            </div>
            {/* Core Web Vitals (bar chart) */}
            <div style={{ flex: 1 }}>
              <ChartCard title="Core Web Vitals" fullHeight>
                <CoreWebVitalsChart data={vitalsData} shortLabels />
              </ChartCard>
            </div>
          </div>

          {/* Row 2: CWV Weekly Trend — full width, shorter */}
          <div style={{ flex: "0 0 22%", display: "flex", minHeight: 0 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <ChartCard title="Core Web Vitals Trend (Weekly)" fullHeight>
                <CwvTrendChart data={cwvWeeklyData} />
              </ChartCard>
            </div>
          </div>

          {/* Row 3: Browser Performance chart + Summary */}
          <div style={{ flex: 1, display: "flex", gap: 12, minHeight: 0 }}>
            <div style={{ flex: "0 0 68%" }}>
              <ChartCard title="Browser Performance" fullHeight>
                <BrowserPerformanceChart data={browserPerfData} latestMonth={browserPerfLatestMonth} shortLabels columns={2} />
              </ChartCard>
            </div>
            {/* Summary */}
            <div style={{ flex: 1 }}>
              <div style={{
                height: "100%",
                background: S.card,
                border: `1px solid ${S.cardBorder}`,
                borderRadius: 10,
                padding: "12px 16px",
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                position: "relative",
              }}>
                <div style={{
                  position: "absolute", top: 0, left: 0, right: 0, height: 2,
                  background: "linear-gradient(90deg, rgba(20,150,255,0.5) 0%, transparent 60%)",
                  borderRadius: "10px 10px 0 0",
                }} />
                <div style={{ fontSize: 10, fontWeight: 700, color: S.textSecondary, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8, flexShrink: 0 }}>
                  Summary
                </div>
                {notesHtml ? (
                  <div
                    dangerouslySetInnerHTML={{ __html: notesHtml }}
                    style={{ fontFamily: S.font, fontSize: 11, lineHeight: 1.6, color: S.textPrimary, overflow: "hidden" }}
                  />
                ) : (
                  <div style={{ fontFamily: S.font, fontSize: 11, color: S.textMuted, fontStyle: "italic" }}>
                    No analyst notes provided.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 18,
          paddingTop: 14,
          borderTop: `1px solid ${S.divider}`,
          position: "relative",
        }}>
          <span style={{ fontSize: 9.5, color: S.textMuted, letterSpacing: "0.06em" }}>
            CONFIDENTIAL · FOR CUSTOMER USE ONLY
          </span>
          <span style={{ fontSize: 9.5, color: S.textMuted, letterSpacing: "0.04em" }}>
            Powered by{" "}
            <span style={{ color: S.accent, fontWeight: 600 }}>Dynatrace</span>
          </span>
        </div>
      </div>
    );
  }
);

const KpiOverviewTable: React.FC<{ kpis: KpiTile[] }> = ({ kpis }) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
      {kpis.map((kpi, i) => {
        const { label, value, change, color, lowerIsBetter = false } = kpi;
        const changePositive = change !== null && (lowerIsBetter ? change < 0 : change > 0);
        const changeColor = change === null || change === 0
          ? S.textSecondary
          : changePositive ? "#6fc3ba" : "#ff999c";
        return (
          <div
            key={label}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 4px",
              borderBottom: i < kpis.length - 1 ? `1px solid ${S.divider}` : "none",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <span style={{ display: "inline-block", width: 3, height: 22, borderRadius: 2, background: color, flexShrink: 0 }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: S.textSecondary, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {label}
              </span>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: S.textPrimary, lineHeight: 1.1, letterSpacing: "-0.01em" }}>
                {value}
              </div>
              {change !== null && (
                <div style={{ fontSize: 9.5, color: changeColor, fontWeight: 600 }}>
                  {change >= 0 ? "+" : ""}{change.toFixed(1)}%
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const ChartCard: React.FC<{ title: string; children: React.ReactNode; fullHeight?: boolean }> = ({ title, children, fullHeight }) => (
  <div style={{
    flex: fullHeight ? undefined : 1,
    height: fullHeight ? "100%" : undefined,
    background: S.card,
    borderRadius: 10,
    border: `1px solid ${S.cardBorder}`,
    padding: "14px 18px 12px",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    position: "relative",
    boxSizing: "border-box",
  }}>
    {/* Card top-left accent */}
    <div style={{
      position: "absolute", top: 0, left: 0, right: 0, height: 2,
      background: "linear-gradient(90deg, rgba(20,150,255,0.5) 0%, transparent 60%)",
      borderRadius: "10px 10px 0 0",
    }} />

    <div style={{
      fontSize: 12,
      fontWeight: 600,
      color: S.textPrimary,
      letterSpacing: "0.05em",
      marginBottom: 12,
      textTransform: "uppercase",
      opacity: 0.85,
    }}>
      {title}
    </div>

    <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
      {children}
    </div>
  </div>
);
