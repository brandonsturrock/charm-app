import React, { useRef, useImperativeHandle, forwardRef } from "react";
import { marked } from "marked";
import { UserTrafficChart, type UserTrafficDataPoint } from "./UserTrafficChart";
import { CoreWebVitalsChart, type WebVitalsDataPoint } from "./CoreWebVitalsChart";
import { CwvTrendChart, type CwvWeeklyDataPoint } from "./CwvTrendChart";
import { BrowserPerformanceChart, type BrowserPerfDataPoint } from "./BrowserPerformanceChart";
import { type KpiTile } from "./PdfLayout";

export interface PdfLayout3PageHandle {
  getPages: () => [HTMLDivElement | null, HTMLDivElement | null, HTMLDivElement | null];
}

interface PdfLayout3PageProps {
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

function extractMarkdownSection(markdown: string, keyword: string): string {
  const lines = markdown.split("\n");
  let inSection = false;
  const result: string[] = [];
  for (const line of lines) {
    if (/^##\s/.test(line)) {
      if (inSection) break;
      if (line.toLowerCase().includes(keyword.toLowerCase())) {
        inSection = true;
      }
    } else if (inSection) {
      result.push(line);
    }
  }
  return result.join("\n").trim();
}

// ── Shared sub-components ──────────────────────────────────────────────────────

const BigKpiTile: React.FC<{ kpi: KpiTile }> = ({ kpi }) => {
  const { label, value, change, color, lowerIsBetter = false } = kpi;
  const changePositive = change !== null && (lowerIsBetter ? change < 0 : change > 0);
  const changeNeutral = change === null || change === 0;
  const changeColor = changeNeutral ? S.textSecondary : changePositive ? "#6fc3ba" : "#ff999c";
  const arrow = change === null ? "" : change >= 0 ? "▲" : "▼";

  return (
    <div style={{
      flex: 1,
      background: S.card,
      border: `1px solid ${S.cardBorder}`,
      borderTop: `3px solid ${color}`,
      borderRadius: 12,
      padding: "28px 32px 24px",
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
      gap: 12,
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{
        fontSize: 13,
        fontWeight: 700,
        color: S.textSecondary,
        textTransform: "uppercase",
        letterSpacing: "0.12em",
      }}>
        {label}
      </div>
      <div style={{ fontSize: 58, fontWeight: 700, color: S.textPrimary, lineHeight: 1, letterSpacing: "-0.02em" }}>
        {value}
      </div>
      {change !== null && (
        <div style={{ fontSize: 16, color: changeColor, fontWeight: 600 }}>
          {arrow} {Math.abs(change).toFixed(1)}% vs prior month
        </div>
      )}
    </div>
  );
};

const BigChartCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{
    height: "100%",
    background: S.card,
    borderRadius: 12,
    border: `1px solid ${S.cardBorder}`,
    padding: "18px 22px 16px",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    position: "relative",
    boxSizing: "border-box",
  }}>
    <div style={{
      position: "absolute", top: 0, left: 0, right: 0, height: 2,
      background: "linear-gradient(90deg, rgba(20,150,255,0.5) 0%, transparent 60%)",
      borderRadius: "12px 12px 0 0",
    }} />
    <div style={{
      fontSize: 14, fontWeight: 700, color: S.textPrimary,
      letterSpacing: "0.06em", marginBottom: 16, textTransform: "uppercase", opacity: 0.85,
    }}>
      {title}
    </div>
    <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
      {children}
    </div>
  </div>
);

const NotesSection: React.FC<{ html: string }> = ({ html }) => {
  if (!html.trim()) return null;
  return (
    <div style={{
      flexShrink: 0,
      background: S.card,
      border: `1px solid ${S.cardBorder}`,
      borderRadius: 12,
      padding: "18px 26px 22px",
      boxSizing: "border-box",
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: "linear-gradient(90deg, rgba(20,150,255,0.5) 0%, transparent 60%)",
        borderRadius: "12px 12px 0 0",
      }} />
      <div style={{ fontSize: 13, fontWeight: 700, color: S.textSecondary, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
        Analysis
      </div>
      <div
        dangerouslySetInnerHTML={{ __html: html }}
        style={{ fontFamily: S.font, fontSize: 16, lineHeight: 1.75, color: S.textPrimary, overflow: "hidden" }}
      />
    </div>
  );
};

// ── Page shell ─────────────────────────────────────────────────────────────────

interface PageShellProps {
  divRef: React.Ref<HTMLDivElement>;
  frontendName: string;
  environmentName: string;
  month: string;
  pageNum: number;
  children: React.ReactNode;
}

const PageShell: React.FC<PageShellProps> = ({ divRef, frontendName, environmentName, month, pageNum, children }) => (
  <div
    ref={divRef}
    style={{
      width: PDF_W,
      height: PDF_H,
      background: S.bg,
      fontFamily: S.font,
      color: S.textPrimary,
      boxSizing: "border-box",
      padding: "40px 52px 32px",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      position: "relative",
    }}
  >
    {/* Background texture */}
    <div style={{
      position: "absolute", inset: 0, pointerEvents: "none",
      backgroundImage: "radial-gradient(circle, rgba(20,150,255,0.04) 1px, transparent 1px)",
      backgroundSize: "32px 32px",
    }} />
    {/* Glow orb */}
    <div style={{
      position: "absolute", top: -120, right: -80, width: 400, height: 400,
      borderRadius: "50%",
      background: "radial-gradient(circle, rgba(20,150,255,0.08) 0%, transparent 70%)",
      pointerEvents: "none",
    }} />

    {/* Header */}
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, position: "relative", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <svg viewBox="0 0 800 142" style={{ height: 32, width: "auto", color: "#ffffff", flexShrink: 0 }} xmlns="http://www.w3.org/2000/svg">
          {DT_LOGO_PATHS}
        </svg>
        <div style={{ width: 1, height: 32, background: "rgba(255,255,255,0.18)", flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.2em", color: S.textMuted, textTransform: "uppercase" }}>
          Business Insights
        </span>
      </div>

      <div style={{
        position: "absolute", left: "50%", transform: "translateX(-50%)",
        textAlign: "center", pointerEvents: "none",
      }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "0.28em", color: "#ffffff", textTransform: "uppercase" }}>
          Trending
        </div>
        <div style={{ fontSize: 12, fontWeight: 500, color: S.textSecondary, letterSpacing: "0.16em", textTransform: "uppercase", marginTop: 4 }}>
          {pageNum === 1 ? "Traffic" : pageNum === 2 ? "Core Web Vitals" : "Browser Performance"}
        </div>
      </div>

      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: S.textPrimary, letterSpacing: "0.01em", lineHeight: 1.2 }}>
          {frontendName}
        </div>
        {environmentName && (
          <div style={{ fontSize: 12, color: S.accent, marginTop: 4, letterSpacing: "0.06em", fontWeight: 500 }}>
            {environmentName}
          </div>
        )}
        <div style={{ fontSize: 13, color: S.textSecondary, marginTop: 4, letterSpacing: "0.04em" }}>
          {month}
        </div>
      </div>
    </div>

    {/* Accent line */}
    <div style={{ height: 2, background: S.gradientLine, borderRadius: 1, marginBottom: 28, position: "relative", flexShrink: 0 }}>
      <div style={{ position: "absolute", left: 0, top: -1, width: 4, height: 4, borderRadius: "50%", background: S.accent, boxShadow: `0 0 8px ${S.accentGlow}` }} />
    </div>

    {/* Content */}
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, minHeight: 0, overflow: "hidden" }}>
      {children}
    </div>

    {/* Footer */}
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      marginTop: 20, paddingTop: 16,
      borderTop: `1px solid ${S.divider}`,
      flexShrink: 0,
    }}>
      <span style={{ fontSize: 11, color: S.textMuted, letterSpacing: "0.06em" }}>
        CONFIDENTIAL · FOR CUSTOMER USE ONLY
      </span>
      <span style={{ fontSize: 11, color: S.textMuted, letterSpacing: "0.04em" }}>
        Page {pageNum} of 3 · Powered by{" "}
        <span style={{ color: S.accent, fontWeight: 600 }}>Dynatrace</span>
      </span>
    </div>
  </div>
);

// ── Main export ────────────────────────────────────────────────────────────────

export const PdfLayout3Page = forwardRef<PdfLayout3PageHandle, PdfLayout3PageProps>(
  ({ frontendName, environmentName, month, kpis, analystNotes, userTrafficData, vitalsData, cwvWeeklyData, browserPerfData, browserPerfLatestMonth }, ref) => {
    const page1Ref = useRef<HTMLDivElement>(null);
    const page2Ref = useRef<HTMLDivElement>(null);
    const page3Ref = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
      getPages: () => [page1Ref.current, page2Ref.current, page3Ref.current],
    }));

    const trafficMd = extractMarkdownSection(analystNotes, "traffic");
    const cwvMd = extractMarkdownSection(analystNotes, "core web vitals");
    const browserMd = extractMarkdownSection(analystNotes, "browser");

    const trafficHtml = trafficMd ? (marked(trafficMd) as string) : "";
    const cwvHtml = cwvMd ? (marked(cwvMd) as string) : "";
    const browserHtml = browserMd ? (marked(browserMd) as string) : "";

    const shellProps = { frontendName, environmentName, month };

    // Dynamic browser chart sizing: scale rows to fill the 770px container
    const BROWSER_COLS = 2;
    const BROWSER_AVAILABLE_H = 770 - 64; // subtract card chrome
    const numBrowserGroups = browserPerfData.length > 0
      ? new Set(browserPerfData.map(d => `${d.browserName}\x00${d.deviceType}`)).size
      : 1;
    const numBrowserGroupRows = Math.max(1, Math.ceil(numBrowserGroups / BROWSER_COLS));
    const numBrowserMonths = browserPerfData.length > 0
      ? new Set(browserPerfData.map(d => d.month)).size
      : 6;
    const browserRowH = Math.min(80, Math.max(18, Math.floor(
      (BROWSER_AVAILABLE_H - numBrowserGroupRows * 54 - Math.max(0, numBrowserGroupRows - 1) * 8)
      / (numBrowserGroupRows * numBrowserMonths)
    )));
    const browserBarH = Math.max(10, Math.round(browserRowH * 0.65));

    return (
      <div style={{ position: "fixed", left: -(PDF_W + 120), top: 0, zIndex: -1 }}>

        {/* ── Page 1: Traffic ─────────────────────────────────────────────────── */}
        <PageShell divRef={page1Ref} pageNum={1} {...shellProps}>
          {/* KPI tiles — fixed height so chart below gets a deterministic pixel height */}
          <div style={{ display: "flex", gap: 20, height: 180, flexShrink: 0 }}>
            {kpis.map((kpi) => <BigKpiTile key={kpi.label} kpi={kpi} />)}
          </div>

          {/* User Traffic chart — explicit px height; rowHeight/barHeight scale bars to fill space */}
          <div style={{ height: 580 }}>
            <BigChartCard title="User Traffic">
              <UserTrafficChart data={userTrafficData} rowHeight={79} barHeight={52} fontScale={1.4} />
            </BigChartCard>
          </div>

          {/* Traffic notes */}
          <NotesSection html={trafficHtml} />
        </PageShell>

        {/* ── Page 2: Core Web Vitals ──────────────────────────────────────────── */}
        <PageShell divRef={page2Ref} pageNum={2} {...shellProps}>
          {/* CWV bar chart — explicit px height; scaled rows fill the card */}
          <div style={{ height: 390 }}>
            <BigChartCard title="Core Web Vitals">
              <CoreWebVitalsChart data={vitalsData} rowHeight={47} barHeight={30} fontScale={1.4} />
            </BigChartCard>
          </div>

          {/* CWV trend line chart — explicit px width+height bypass ResponsiveContainer race */}
          <div style={{ height: 390 }}>
            <BigChartCard title="Core Web Vitals Trend (Weekly)">
              <CwvTrendChart data={cwvWeeklyData} pdfWidth={1600} pdfHeight={326} fontScale={1.4} />
            </BigChartCard>
          </div>

          {/* CWV notes */}
          <NotesSection html={cwvHtml} />
        </PageShell>

        {/* ── Page 3: Browser Performance ─────────────────────────────────────── */}
        <PageShell divRef={page3Ref} pageNum={3} {...shellProps}>
          {/* Full browser chart — explicit px height, no group limit, 3 columns */}
          <div style={{ height: 770 }}>
            <BigChartCard title="Browser Performance">
              <BrowserPerformanceChart
                data={browserPerfData}
                latestMonth={browserPerfLatestMonth}
                shortLabels
                columns={2}
                rowHeight={browserRowH}
                barHeight={browserBarH}
                fontScale={1.0}
              />
            </BigChartCard>
          </div>

          {/* Browser notes */}
          <NotesSection html={browserHtml} />
        </PageShell>

      </div>
    );
  }
);
