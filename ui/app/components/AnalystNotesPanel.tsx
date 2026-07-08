import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from "react";
import { DavisAIIcon } from "@dynatrace/strato-icons";
import { httpClient } from "@dynatrace-sdk/http-client";

export interface AnalystNotesPanelHandle {
  getValue: () => string;
}

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

interface AnalystNotesPanelProps {
  context?: AnalystNotesContext;
}

const COLLAPSED_HEIGHT = 0;
const EXPANDED_HEIGHT = 260;
const TAB_HEIGHT = 36;

function fmtMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms.toFixed(0)}ms`;
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

  // Aggregate browser data by browser+device for the most recent month
  if (browserTrend.length > 0) {
    const months = [...new Set(browserTrend.map(r => r.month))].sort();
    const latestMonth = months[months.length - 1];
    const latestRows = browserTrend.filter(r => r.month === latestMonth);
    // Sort by visits desc, top 8
    const top = [...latestRows].sort((a, b) => b.visits - a.visits).slice(0, 8);
    lines.push(`\n--- Browser Performance — ${latestMonth} (top segments by visits) ---`);
    lines.push("Browser | Device | Visits | LCP p75 | INP p75 | CLS p75");
    for (const r of top) {
      lines.push(`${r.browserName} | ${r.deviceType} | ${r.visits.toLocaleString()} | ${fmtMs(r.lcpMs)} | ${fmtMs(r.inpMs)} | ${r.cls.toFixed(3)}`);
    }
  }

  return lines.join("\n");
}

async function generateNotes(context: AnalystNotesContext): Promise<string> {
  const { frontendName, trafficTrend } = context;
  const latestMonth = trafficTrend[trafficTrend.length - 1]?.month ?? "";

  const dataBlock = buildSupplementary(context);

  const payload = {
    text: `You are a web performance analyst writing an internal monthly review for ${frontendName}. Below is the real metric data for the last 6 months (ending ${latestMonth}). Analyze ONLY these numbers — do not provide general Dynatrace guidance or product help. Identify month-over-month changes, flag Core Web Vitals threshold violations (LCP good <2.5s/poor >4s, INP good <200ms/poor >500ms, CLS good <0.1/poor >0.25), and note sustained trends.

${dataBlock}

Respond ONLY in markdown bullet points (- item). One short sentence per bullet. Include 3-4 bullet points under each heading ONLY IF there are that many notable findings — use fewer bullets if there is genuinely less to say. Group under three headings: ## Traffic, ## Core Web Vitals, ## Browser & Device. No preamble, no conclusion, no general advice.`,
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
  // Response shape: { message: { content: string } } or { content: string } — handle both
  const content: string = data?.text ?? JSON.stringify(data);
  return content;
}

export const AnalystNotesPanel = forwardRef<AnalystNotesPanelHandle, AnalystNotesPanelProps>(
  ({ context }, ref) => {
    const [value, setValue] = useState(`## Traffic
- Sessions increased significantly from Jan (68,873) to Jun (226,851), with a peak in Feb (234,689).
- User Actions spiked in Jun (2,199), more than doubling the previous high in Mar (1,034).
- Page Loads showed steady growth, with a notable jump in Jun (1,126) from May (710).

## Core Web Vitals
- **LCP** remained consistently good (<2.5s) across all months, improving slightly from Jan (302ms) to Jun (172ms).
- **INP** consistently violated the poor threshold (>500ms), with minimal improvement from Jan (4.99s) to Jun (4.91s).
- **CLS** stayed within the good threshold (<0.1) throughout, with no violations.

## Browser & Device
- Opera had the highest visits in May (55,536) with an INP of 4.93s, slightly better than Chrome (5.13s).
- Chrome showed the worst INP performance in May (5.13s) among top browsers.
- All browsers maintained good LCP (<2.5s) and CLS (<0.1) in May.`);
    const [expanded, setExpanded] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [generateError, setGenerateError] = useState<string | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useImperativeHandle(ref, () => ({ getValue: () => value }), [value]);

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
      setGenerateError(null);
      try {
        const result = await generateNotes(context);
        setValue(result);
      } catch (err) {
        setGenerateError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setGenerating(false);
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
                onChange={(e) => setValue(e.target.value)}
                placeholder={"## Summary\n- Key insight one\n  - Nested detail\n- Key insight two\n\n**Notable trend:** ..."}
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
  }
);
