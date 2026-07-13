import React, { useState, useRef, useEffect } from "react";
import { DavisAIIcon } from "@dynatrace/strato-icons";
import { httpClient } from "@dynatrace-sdk/http-client";

export interface TrendMonthPoint {
  month: string;
  sessions: number;
  userActions: number;
  pageLoads: number;
  pctDesktop: number;
  pctMobile: number;
}

export interface VitalsMonthPoint {
  month: string;
  lcpMs: number;
  inpMs: number;
  cls: number;
}

export interface BrowserMonthPoint {
  month: string;
  deviceType: string;
  browserName: string;
  visits: number;
  lcpMs: number;
  inpMs: number;
  cls: number;
}

export interface AnalystNotesContext {
  frontendName: string;
  trafficTrend: TrendMonthPoint[];
  vitalsTrend: VitalsMonthPoint[];
  browserTrend: BrowserMonthPoint[];
}

export interface CurrentMonthAnalystContext {
  type: 'last-month';
  frontendName: string;
  dailyByDevice: Array<{ day: string; deviceType: string; sessions: number }>;
  dailyCwv: Array<{ day: string; lcpMs: number; inpMs: number; cls: number }>;
  dailyErrors: Array<{ day: string; jsErrorSessions: number; reqErrorSessions: number }>;
  deviceCompare: Array<{ deviceType: string; sessions: number; pageLoads: number; lcpMs: number; inpMs: number; cls: number }>;
  topPages: Array<{ name: string; count: number; lcp: number | null; inp: number | null; cls: number | null; exceptions: number | null; requestErrors: number | null }>;
}

interface AnalystNotesPanelProps {
  value: string;
  onChange: (v: string) => void;
  onGeneratingChange?: (v: boolean) => void;
  context?: AnalystNotesContext | CurrentMonthAnalystContext;
}

const COLLAPSED_HEIGHT = 0;
const EXPANDED_HEIGHT = 260;
const TAB_HEIGHT = 36;

function fmtMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms.toFixed(0)}ms`;
}

function isCmContext(ctx: any): ctx is CurrentMonthAnalystContext {
  return ctx?.type === 'last-month';
}

function buildSupplementary(context: AnalystNotesContext): string {
  const { frontendName, trafficTrend, vitalsTrend, browserTrend } = context;
  const lines: string[] = [];

  lines.push(`Frontend: ${frontendName}`);
  lines.push(`Data covers ${trafficTrend.length} months: ${trafficTrend.map(r => r.month).join(", ")}`);

  lines.push("\n--- Traffic by Month ---");
  lines.push("Month | Sessions | User Actions | Page Loads | % Desktop | % Mobile");
  for (const r of trafficTrend) {
    lines.push(`${r.month} | ${r.sessions.toLocaleString()} | ${r.userActions.toLocaleString()} | ${r.pageLoads.toLocaleString()} | ${r.pctDesktop.toFixed(1)}% | ${r.pctMobile.toFixed(1)}%`);
  }

  lines.push("\n--- Core Web Vitals by Month (p75) ---");
  lines.push("Thresholds: LCP good <2.5s / poor >4s | INP good <200ms / poor >500ms | CLS good <0.1 / poor >0.25");
  lines.push("Month | LCP p75 | INP p75 | CLS p75");
  for (const r of vitalsTrend) {
    lines.push(`${r.month} | ${fmtMs(r.lcpMs)} | ${fmtMs(r.inpMs)} | ${r.cls.toFixed(3)}`);
  }

  if (browserTrend.length > 0) {
    const months = [...new Set(browserTrend.map(r => r.month))].sort();
    const latestMonth = months[months.length - 1];
    const latestRows = browserTrend.filter(r => r.month === latestMonth);
    const top = [...latestRows].sort((a, b) => b.visits - a.visits).slice(0, 8);
    lines.push(`\n--- Browser Performance — ${latestMonth} (top segments by visits) ---`);
    lines.push("Browser | Device | Visits | LCP p75 | INP p75 | CLS p75");
    for (const r of top) {
      lines.push(`${r.browserName} | ${r.deviceType} | ${r.visits.toLocaleString()} | ${fmtMs(r.lcpMs)} | ${fmtMs(r.inpMs)} | ${r.cls.toFixed(3)}`);
    }
  }

  return lines.join("\n");
}

function buildCmSupplementary(context: CurrentMonthAnalystContext): string {
  const { frontendName, dailyByDevice, dailyCwv, dailyErrors, deviceCompare, topPages } = context;
  const lines: string[] = [];

  lines.push(`Frontend: ${frontendName} — Current Month (MTD)`);

  const byDay = new Map<string, number>();
  dailyByDevice.forEach(r => byDay.set(r.day, (byDay.get(r.day) ?? 0) + r.sessions));
  const dayKeys = Array.from(byDay.keys()).sort();

  lines.push(`\n--- Daily Sessions (MTD, ${dayKeys.length} days) ---`);
  lines.push("Day | Sessions");
  dayKeys.forEach(day => lines.push(`${day} | ${(byDay.get(day) ?? 0).toLocaleString()}`));

  if (dailyCwv.length > 0) {
    lines.push("\n--- Daily Core Web Vitals p75 ---");
    lines.push("Thresholds: LCP good <2.5s / poor >4s | INP good <200ms / poor >500ms | CLS good <0.1 / poor >0.25");
    lines.push("Day | LCP p75 | INP p75 | CLS p75");
    dailyCwv.forEach(r => lines.push(`${r.day} | ${fmtMs(r.lcpMs)} | ${fmtMs(r.inpMs)} | ${r.cls.toFixed(3)}`));
  }

  if (dailyErrors.length > 0) {
    lines.push("\n--- Daily Error Sessions ---");
    lines.push("Day | JS Error Sessions | Request Error Sessions");
    dailyErrors.forEach(r => lines.push(`${r.day} | ${r.jsErrorSessions.toLocaleString()} | ${r.reqErrorSessions.toLocaleString()}`));
  }

  if (deviceCompare.length > 0) {
    lines.push("\n--- Device Comparison (MTD) ---");
    lines.push("Thresholds: LCP good <2.5s / poor >4s | INP good <200ms / poor >500ms | CLS good <0.1 / poor >0.25");
    lines.push("Device | Sessions | Page Loads | LCP p75 | INP p75 | CLS p75");
    deviceCompare.forEach(r => lines.push(
      `${r.deviceType} | ${r.sessions.toLocaleString()} | ${r.pageLoads.toLocaleString()} | ${fmtMs(r.lcpMs)} | ${fmtMs(r.inpMs)} | ${r.cls.toFixed(3)}`
    ));
  }

  if (topPages && topPages.length > 0) {
    lines.push("\n--- Top Pages by Visit Volume ---");
    lines.push("Thresholds: LCP good <2.5s / poor >4s | INP good <200ms / poor >500ms | CLS good <0.1 / poor >0.25");
    lines.push("Page | Visits | LCP p75 | INP p75 | CLS p75 | Avg Exceptions | Avg Req Errors");
    topPages.forEach(r => lines.push(
      `${r.name} | ${r.count.toLocaleString()} | ${r.lcp != null ? fmtMs(r.lcp) : "—"} | ${r.inp != null ? fmtMs(r.inp) : "—"} | ${r.cls != null ? r.cls.toFixed(3) : "—"} | ${r.exceptions != null ? r.exceptions.toFixed(2) : "—"} | ${r.requestErrors != null ? r.requestErrors.toFixed(2) : "—"}`
    ));
  }

  return lines.join("\n");
}

async function generateNotes(context: AnalystNotesContext | CurrentMonthAnalystContext): Promise<string> {
  let promptText: string;

  if (isCmContext(context)) {
    const dataBlock = buildCmSupplementary(context);
    promptText = `You are a web performance analyst writing an internal last month review for ${context.frontendName}. Below is the real metric data for last month. Analyze ONLY these numbers — do not provide general Dynatrace guidance or product help. Identify day-over-day trends, flag Core Web Vitals threshold violations (LCP good <2.5s/poor >4s, INP good <200ms/poor >500ms, CLS good <0.1/poor >0.25), note error session spikes, and compare mobile vs desktop performance.

${dataBlock}

Respond ONLY in markdown bullet points (- item). One short sentence per bullet. Include 3-4 bullet points under each heading ONLY IF there are that many notable findings — use fewer bullets if there is genuinely less to say. Group under four headings: ## Traffic, ## Core Web Vitals, ## Top Pages, ## Error Rates. No preamble, no conclusion, no general advice.`;
  } else {
    const { frontendName, trafficTrend } = context;
    const latestMonth = trafficTrend[trafficTrend.length - 1]?.month ?? "";
    const dataBlock = buildSupplementary(context);
    promptText = `You are a web performance analyst writing an internal monthly review for ${frontendName}. Below is the real metric data for the last 6 months (ending ${latestMonth}). Analyze ONLY these numbers — do not provide general Dynatrace guidance or product help. Identify month-over-month changes, flag Core Web Vitals threshold violations (LCP good <2.5s/poor >4s, INP good <200ms/poor >500ms, CLS good <0.1/poor >0.25), and note sustained trends.

${dataBlock}

Respond ONLY in markdown bullet points (- item). One short sentence per bullet. Include 3-4 bullet points under each heading ONLY IF there are that many notable findings — use fewer bullets if there is genuinely less to say. Group under three headings: ## Traffic, ## Core Web Vitals, ## Browser & Device. No preamble, no conclusion, no general advice.`;
  }

  const payload = {
    text: promptText,
    "document-retrieval": "disabled",
  };

  const response = await httpClient.send({
    method: "POST",
    url: "/platform/davis/copilot/v1/skills/conversations:message",
    headers: { Accept: "application/json" },
    body: payload,
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Davis CoPilot returned ${response.status}`);
  }

  const data = await response.body();
  const content: string = data?.text ?? JSON.stringify(data);
  return content;
}

export const CM_PLACEHOLDER = `## Traffic
- Significant session spikes on Jun 3 (22,132) and Jun 11 (20,602), with a sharp drop on Jun 13 (1,131).
- Minimal traffic on Jun 14 (90), Jun 16 (41), and Jun 28 (42).
- No sessions recorded on Jun 6–8, indicating potential data gaps or outages.

## Core Web Vitals
- LCP remained consistently good (<2.5s) except Jun 16 (525ms, poor).
- INP consistently poor (>500ms) across all days, peaking at 5.34s on Jun 28.
- CLS remained excellent (0.000) throughout the month.

## Top Pages
- \`/checkout\` violated all thresholds: LCP 4.80s, INP 520ms, CLS 0.310 (all poor).
- \`/search\` and \`/category/:slug\` had poor INP (340ms, 300ms) and CLS nearing poor thresholds.
- \`/home\` and \`/login\` performed well across all Core Web Vitals metrics.

## Error Rates
- Request error sessions spiked on Jun 11 (7,899) and Jun 20 (7,244).
- JS error sessions peaked on Jun 18 (5,851) and Jun 29 (3,893).
- Minimal errors on Jun 14 (25 request errors, 0 JS errors).`;

export const AnalystNotesPanel: React.FC<AnalystNotesPanelProps> = ({ value, onChange, onGeneratingChange, context }) => {
  const [expanded, setExpanded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (expanded) {
      setTimeout(() => textareaRef.current?.focus(), 180);
    }
  }, [expanded]);

  const hasContent = value.trim().length > 0;
  const canGenerate = !!context;

  const handleGenerate = async () => {
    if (!context || generating) return;
    setGenerating(true);
    onGeneratingChange?.(true);
    setGenerateError(null);
    try {
      const result = await generateNotes(context);
      onChange(result);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setGenerating(false);
      onGeneratingChange?.(false);
    }
  };

  return (
    <div style={{
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 200,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      pointerEvents: "none",
    }}>
      {/* Floating sheet */}
      <div style={{
        width: "min(860px, 92vw)",
        pointerEvents: "all",
        borderRadius: "12px 12px 0 0",
        background: "var(--dt-colors-background-surface-default, #1c1e2e)",
        border: "1px solid var(--dt-colors-border-neutral-default, rgba(255,255,255,0.1))",
        borderBottom: "none",
        boxShadow: "0 -8px 32px rgba(0,0,0,0.45)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}>
        {/* Tab / handle — always visible */}
        <button
          onClick={() => setExpanded((prev) => !prev)}
          style={{
            all: "unset",
            cursor: "pointer",
            height: TAB_HEIGHT,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 16px",
            userSelect: "none",
            borderBottom: expanded
              ? "1px solid var(--dt-colors-border-neutral-default, rgba(255,255,255,0.1))"
              : "none",
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, opacity: 0.35 }}>
              <div style={{ width: 24, height: 2, borderRadius: 1, background: "currentColor" }} />
              <div style={{ width: 24, height: 2, borderRadius: 1, background: "currentColor" }} />
            </div>
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--dt-colors-text-neutral-subdued, #b1b2d2)",
            }}>
              Analyst Notes
            </span>
            {hasContent && !expanded && (
              <span style={{
                fontSize: 10,
                fontWeight: 600,
                background: "#1496ff",
                color: "#fff",
                borderRadius: 10,
                padding: "1px 7px",
                letterSpacing: "0.03em",
              }}>
                {value.trim().split("\n").filter(Boolean).length} line{value.trim().split("\n").filter(Boolean).length !== 1 ? "s" : ""}
              </span>
            )}
            {!hasContent && !expanded && (
              <span style={{ fontSize: 11, color: "var(--dt-colors-text-neutral-subdued, #b1b2d2)", opacity: 0.5 }}>
                — click to add notes for the PDF
              </span>
            )}
          </div>

          <svg
            width="14" height="14" viewBox="0 0 14 14" fill="none"
            style={{
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease",
              opacity: 0.5,
            }}
          >
            <path d="M2 5l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Expandable body */}
        <div style={{
          height: expanded ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT,
          overflow: "hidden",
          transition: "height 0.22s cubic-bezier(0.4,0,0.2,1)",
        }}>
          <div style={{ padding: "10px 16px 14px", display: "flex", flexDirection: "column", height: EXPANDED_HEIGHT, boxSizing: "border-box" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--dt-colors-text-neutral-subdued, #b1b2d2)", opacity: 0.7 }}>
                Supports markdown — bullets, <strong>bold</strong>, headers. Included in the PDF export.
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: 12 }}>
                {generateError && (
                  <span style={{ fontSize: 11, color: "#f05a5a", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={generateError}>
                    {generateError}
                  </span>
                )}
                <button
                  onClick={handleGenerate}
                  disabled={!canGenerate || generating}
                  title={!canGenerate ? "Select a frontend first" : "Generate bullet points using Davis CoPilot"}
                  style={{
                    all: "unset",
                    cursor: canGenerate && !generating ? "pointer" : "not-allowed",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 12px",
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    border: "1px solid",
                    borderColor: canGenerate && !generating ? "#1496ff" : "rgba(255,255,255,0.15)",
                    color: canGenerate && !generating ? "#1496ff" : "rgba(255,255,255,0.3)",
                    background: generating ? "rgba(20,150,255,0.08)" : "transparent",
                    transition: "background 0.15s, opacity 0.15s",
                    whiteSpace: "nowrap",
                  }}
                  onMouseEnter={(e) => {
                    if (canGenerate && !generating)
                      (e.currentTarget as HTMLButtonElement).style.background = "rgba(20,150,255,0.12)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = generating ? "rgba(20,150,255,0.08)" : "transparent";
                  }}
                >
                  {generating ? (
                    <>
                      <span style={{ display: "inline-block", width: 10, height: 10, border: "2px solid #1496ff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                      Generating…
                    </>
                  ) : (
                    <><DavisAIIcon size="small" /> Generate with Davis AI</>
                  )}
                </button>
              </div>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={isCmContext(context) ? CM_PLACEHOLDER : ""}
              style={{
                flex: 1,
                background: "var(--dt-colors-background-surface-sunken, #0f1117)",
                color: "var(--dt-colors-text-neutral-default, rgba(255,255,255,0.9))",
                border: "1px solid var(--dt-colors-border-neutral-default, rgba(255,255,255,0.1))",
                borderRadius: 6,
                padding: "10px 12px",
                fontFamily: "'DT Flow', 'Helvetica Neue', Arial, sans-serif",
                fontSize: "0.875rem",
                lineHeight: 1.65,
                resize: "none",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
