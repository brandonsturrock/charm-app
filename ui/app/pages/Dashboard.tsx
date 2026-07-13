import React, { useCallback, useMemo, useRef, useState } from "react";
import { getEnvironmentUrl } from "@dynatrace-sdk/app-environment";
import { useDql } from "@dynatrace-sdk/react-hooks";
import { Button } from "@dynatrace/strato-components/buttons";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Surface } from "@dynatrace/strato-components/layouts";
import { TitleBar } from "@dynatrace/strato-components/layouts";
import { Select, Checkbox } from "@dynatrace/strato-components/forms";
import { ProgressCircle } from "@dynatrace/strato-components/content";
import { Heading, Text } from "@dynatrace/strato-components/typography";
import { _Drawer as Drawer } from "@dynatrace/strato-components/overlays";
import { Tabs, Tab } from "@dynatrace/strato-components/navigation";
import { KpiCard } from "../components/KpiCard";
import { UserTrafficChart, type UserTrafficDataPoint } from "../components/UserTrafficChart";
import { CoreWebVitalsChart, type WebVitalsDataPoint } from "../components/CoreWebVitalsChart";
import { BrowserPerformanceChart, type BrowserPerfDataPoint } from "../components/BrowserPerformanceChart";
import { CwvTrendChart, type CwvWeeklyDataPoint } from "../components/CwvTrendChart";
import { DeviceDistributionChart, type DeviceMonthPoint } from "../components/DeviceDistributionChart";
import { PdfLayout, type KpiTile } from "../components/PdfLayout";
import { PdfLayout3Page, type PdfLayout3PageHandle } from "../components/PdfLayout3Page";
import { AnalystNotesPanel, type AnalystNotesContext, type CurrentMonthAnalystContext } from "../components/AnalystNotesPanel";
import { DailyDeviceTrafficChart, type DailyDevicePoint } from "../components/DailyDeviceTrafficChart";
import { DailyErrorChart, type DailyErrorPoint, type DailyErrorCountPoint } from "../components/DailyErrorChart";
import { CwvTierChart, type CwvTierData } from "../components/CwvTierChart";
import { CwvSingleMetricChart, type CwvDailyDevicePoint } from "../components/CwvSingleMetricChart";
import { exportDashboardPdf, exportDashboard3PagePdf } from "../utils/pdfExport";
import { TopErrorsTable, statusCodeRenderer, type TopErrorColumn } from "../components/TopErrorsTable";
import { CwvDistributionChart } from "../components/CwvDistributionChart";
import { PagePerformanceTable, type PagePerfRow } from "../components/PagePerformanceTable";

function dqlEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

const FRONTENDS_QUERY = `fetch user.events, from: -1M
| fields frontend.name
| dedup frontend.name
| sort frontend.name asc`;

const buildMetricsQuery = (frontendName: string) => `timeseries {
    x=countDistinct(dt.frontend.session.active.estimated_count),
    y = count(dt.frontend.user_action.count),
    z = percentile(dt.frontend.web.page.largest_contentful_paint, 75),
    z2 = count(dt.frontend.web.page.largest_contentful_paint),
    t=start()
  }, from: -6M, to: now()@M, interval: 1d, filter: frontend.name == "${dqlEscape(frontendName)}", by:device.type
| fieldsAdd d = record(d = x[], t = t[], y=y[], z=z[], z2=z2[])
| expand d
| summarize
    Sessions = sum(d[d]),
    \`User Actions\` = sum(d[y]),
    \`Page Loads\` = sum(d[z2]),
    Desktop_Sessions = sum(if(device.type == "desktop", d[d], else: 0)),
    Mobile_Sessions  = sum(if(device.type == "mobile",  d[d], else: 0)),
    Total_NonNull    = sum(if(isNotNull(device.type),   d[d], else: 0)),
  by: { t = timeframe(from: (d[t]+interval/2)@M, to: (d[t]+interval/2)@M + 1M) }
| fieldsAdd month = t[start]
| fieldsRemove t
| fieldsAdd
    \`% Desktop\` = if(Total_NonNull > 0, round(toDouble(Desktop_Sessions) / toDouble(Total_NonNull) * 100, decimals: 2), else: null),
    \`% Mobile\`  = if(Total_NonNull > 0, round(toDouble(Mobile_Sessions)  / toDouble(Total_NonNull) * 100, decimals: 2), else: null)
| fieldsRemove Desktop_Sessions, Mobile_Sessions, Total_NonNull
| sort month asc`;

const buildCwvWeeklyQuery = (frontendName: string) => `timeseries {
    lcp = percentile(dt.frontend.web.page.largest_contentful_paint, 75),
    inp = percentile(dt.frontend.web.page.interaction_to_next_paint, 75),
    cls = percentile(dt.frontend.web.page.cumulative_layout_shift, 75),
    t = start()
  }, from: -6M, to: now(), interval: 7d, filter: frontend.name == "${dqlEscape(frontendName)}"
| fieldsAdd d = record(t=t[], lcp=lcp[], inp=inp[], cls=cls[])
| expand d
| fieldsAdd week = d[t], lcp = d[lcp], inp = d[inp], cls = d[cls]
| fieldsRemove d
| filterOut isNull(lcp) and isNull(inp) and isNull(cls)
| sort week asc`;

const buildDeviceDistQuery = (frontendName: string) => `timeseries {
    sessions=countDistinct(dt.frontend.session.active.estimated_count),
    t=start()
  }, from: -6M, to: now()@M, interval: 1d, filter: frontend.name == "${dqlEscape(frontendName)}", by: {device.type}
| fieldsAdd d = record(sessions = sessions[], t = t[])
| expand d
| summarize
    Sessions = sum(d[sessions]),
  by: { t = timeframe(from: (d[t]+interval/2)@M, to: (d[t]+interval/2)@M + 1M), device.type }
| fieldsAdd month = t[start]
| fieldsRemove t
| filterOut isNull(device.type)
| sort month asc`;


const buildBrowserPerfQuery = (frontendName: string) => `timeseries {
    sessions=countDistinct(dt.frontend.session.active.estimated_count),
    lcp = percentile(dt.frontend.web.page.largest_contentful_paint, 75),
    lcp2 = count(dt.frontend.web.page.largest_contentful_paint),
    inp = percentile(dt.frontend.web.page.interaction_to_next_paint, 75),
    inp2 = count(dt.frontend.web.page.interaction_to_next_paint),
    cls = percentile(dt.frontend.web.page.cumulative_layout_shift, 75),
    cls2 = count(dt.frontend.web.page.cumulative_layout_shift),
    t=start()
  }, from: -6M, to: now()@M, interval: 1d, filter: frontend.name == "${dqlEscape(frontendName)}", by: {device.type, browser.name}
| fieldsAdd d = record(sessions = sessions[], t = t[], inp=inp[], inp2=inp2[], lcp=lcp[], lcp2=lcp2[], cls=cls[], cls2=cls2[])
| expand d
| summarize
  \`Visits\` = sum(d[sessions]),
  \`Largest Contentful Paint\` = sum(d[lcp] * d[lcp2]) / sum(d[lcp2]),
  \`Interaction to Next Paint\` = sum(d[inp] * d[inp2]) / sum(d[inp2]),
  \`Cumulative Layout Shift\` = sum(d[cls] * d[cls2]) / sum(d[cls2]),
  by: { t = timeframe(from: (d[t]+interval/2)@M, to: (d[t]+interval/2)@M + 1M), device.type, browser.name }
| fieldsAdd month = t[start]
| fieldsRemove t
| filterOut isNull(device.type)`;

const buildWebVitalsQuery = (frontendName: string) => `timeseries {
    x=countDistinct(dt.frontend.session.active.estimated_count),
    lcp = percentile(dt.frontend.web.page.largest_contentful_paint, 75),
    lcp2 = count(dt.frontend.web.page.largest_contentful_paint),
    inp = percentile(dt.frontend.web.page.interaction_to_next_paint, 75),
    inp2 = count(dt.frontend.web.page.interaction_to_next_paint),
    cls = percentile(dt.frontend.web.page.cumulative_layout_shift, 75),
    cls2 = count(dt.frontend.web.page.cumulative_layout_shift),
    t=start()
  }, from: -6M, to: now()@M, interval: 1d, filter: frontend.name == "${dqlEscape(frontendName)}"
| fieldsAdd d = record(d = x[], t = t[], inp=inp[], inp2=inp2[], lcp=lcp[], lcp2=lcp2[], cls=cls[], cls2=cls2[])
| expand d
| summarize
    \`Largest Contentful Paint\` = sum(d[lcp] * d[lcp2]) / sum(d[lcp2]),
    \`Interaction to Next Paint\` = sum(d[inp] * d[inp2]) / sum(d[inp2]),
    \`Cumulative Layout Shift\` = sum(d[cls] * d[cls2]) / sum(d[cls2]),
  by: { t = timeframe(from: (d[t]+interval/2)@M, to: (d[t]+interval/2)@M + 1M) }
| fieldsAdd month = t[start]
| fieldsRemove t
| sort month asc`;

const buildCmDailyDeviceQuery = (fn: string) => `timeseries {
    sessions=countDistinct(dt.frontend.session.active.estimated_count),
    t=start()
  }, from: (now()-1M)@M, to: now()@M, interval: 1d, filter: frontend.name == "${dqlEscape(fn)}", by: {device.type}
| fieldsAdd d = record(sessions = sessions[], t = t[])
| expand d
| fieldsAdd day = d[t], sessions = d[sessions]
| fields day, sessions, device.type
| filterOut isNull(device.type)
| sort day asc`;

const buildCmDailyCwvQuery = (fn: string) => `timeseries {
    lcp = percentile(dt.frontend.web.page.largest_contentful_paint, 75),
    inp = percentile(dt.frontend.web.page.interaction_to_next_paint, 75),
    cls = percentile(dt.frontend.web.page.cumulative_layout_shift, 75),
    t = start()
  }, from: (now()-1M)@M, to: now()@M, interval: 1d, filter: frontend.name == "${dqlEscape(fn)}", by: {device.type}
| fieldsAdd d = record(t=t[], lcp=lcp[], inp=inp[], cls=cls[])
| expand d
| fieldsAdd day = d[t], lcp = d[lcp], inp = d[inp], cls = d[cls]
| fields day, lcp, inp, cls, device.type
| filterOut isNull(device.type)
| sort day asc`;

const buildCmCwvDistributionQuery = (fn: string) => `fetch user.events, from: (now()-1M)@M, to: now()@M
| filter frontend.name == "${dqlEscape(fn)}"
| filter dt.rum.user_type == "real_user"
| filter characteristics.classifier == "page_summary"
| fieldsAdd
    lcp_ms = toLong(web_vitals.largest_contentful_paint) / 1000000,
    inp_ms = toLong(web_vitals.interaction_to_next_paint) / 1000000,
    cls_val = toDouble(web_vitals.cumulative_layout_shift) / 10000
| summarize
    lcp_b0  = countIf(lcp_ms < 1000),
    lcp_b1  = countIf(lcp_ms >= 1000  and lcp_ms < 2000),
    lcp_b2  = countIf(lcp_ms >= 2000  and lcp_ms < 3000),
    lcp_b3  = countIf(lcp_ms >= 3000  and lcp_ms < 4000),
    lcp_b4  = countIf(lcp_ms >= 4000  and lcp_ms < 5000),
    lcp_b5  = countIf(lcp_ms >= 5000  and lcp_ms < 6000),
    lcp_b6  = countIf(lcp_ms >= 6000  and lcp_ms < 7000),
    lcp_b7  = countIf(lcp_ms >= 7000  and lcp_ms < 8000),
    lcp_b8  = countIf(lcp_ms >= 8000  and lcp_ms < 9000),
    lcp_b9  = countIf(lcp_ms >= 9000  and lcp_ms < 10000),
    lcp_b10 = countIf(lcp_ms >= 10000),
    lcp_total = countIf(isNotNull(lcp_ms)),
    inp_b0  = countIf(inp_ms < 1000),
    inp_b1  = countIf(inp_ms >= 1000  and inp_ms < 2000),
    inp_b2  = countIf(inp_ms >= 2000  and inp_ms < 3000),
    inp_b3  = countIf(inp_ms >= 3000  and inp_ms < 4000),
    inp_b4  = countIf(inp_ms >= 4000  and inp_ms < 5000),
    inp_b5  = countIf(inp_ms >= 5000  and inp_ms < 6000),
    inp_b6  = countIf(inp_ms >= 6000  and inp_ms < 7000),
    inp_b7  = countIf(inp_ms >= 7000  and inp_ms < 8000),
    inp_b8  = countIf(inp_ms >= 8000  and inp_ms < 9000),
    inp_b9  = countIf(inp_ms >= 9000  and inp_ms < 10000),
    inp_b10 = countIf(inp_ms >= 10000),
    inp_total = countIf(isNotNull(inp_ms)),
    cls_b0  = countIf(cls_val < 0.1),
    cls_b1  = countIf(cls_val >= 0.1 and cls_val < 0.2),
    cls_b2  = countIf(cls_val >= 0.2 and cls_val < 0.3),
    cls_b3  = countIf(cls_val >= 0.3 and cls_val < 0.4),
    cls_b4  = countIf(cls_val >= 0.4 and cls_val < 0.5),
    cls_b5  = countIf(cls_val >= 0.5 and cls_val < 0.6),
    cls_b6  = countIf(cls_val >= 0.6 and cls_val < 0.7),
    cls_b7  = countIf(cls_val >= 0.7 and cls_val < 0.8),
    cls_b8  = countIf(cls_val >= 0.8 and cls_val < 0.9),
    cls_b9  = countIf(cls_val >= 0.9 and cls_val < 1.0),
    cls_b10 = countIf(cls_val >= 1.0),
    cls_total = countIf(isNotNull(cls_val))`;

const buildCmTopPagesQuery = (fn: string) => `fetch user.events, from: (now()-1M)@M, to: now()@M
| filter frontend.name == "${dqlEscape(fn)}"
| filter dt.rum.user_type == "real_user"
| filter characteristics.classifier == "page_summary" and isNotNull(page.name)
| fieldsAdd
    lcp_ms = toLong(web_vitals.largest_contentful_paint) / 1000000,
    inp_ms = toLong(web_vitals.interaction_to_next_paint) / 1000000,
    cls_dec = toDouble(web_vitals.cumulative_layout_shift) / 10000
| summarize
    count = count(),
    lcp = percentile(lcp_ms, 75),
    inp = percentile(inp_ms, 75),
    cls = percentile(cls_dec, 75),
    exceptions = avg(error.exception_count),
    request_errors = avg(error.http_4xx_count + error.http_5xx_count),
    by: page.name
| sort count desc
| limit 10`;

const buildCmTopExceptionsQuery = (fn: string) => `fetch user.events, from: (now()-1M)@M, to: now()@M
| filter frontend.name == "${dqlEscape(fn)}"
| filter dt.rum.user_type == "real_user"
| filter characteristics.has_exception == true
| filterOut isNull(exception.type)
| summarize count = count(), by: {exception.type, exception.message, error.source}
| sort count desc
| limit 10`;

const buildCmTopRequestErrorsQuery = (fn: string) => `fetch user.events, from: (now()-1M)@M, to: now()@M
| filter frontend.name == "${dqlEscape(fn)}"
| filter dt.rum.user_type == "real_user"
| filter characteristics.classifier == "error"
| filter characteristics.has_failed_request == true
| filter http.response.status_code > 0
| filterOut isNull(url.path)
| summarize count = count(), by: {http.request.method, http.response.status_code, url.host, url.path}
| sort count desc
| limit 10`;

const buildCmErrorCountQuery = (fn: string) => `timeseries {
    errors = count(dt.frontend.error.count),
    t = start()
  }, by: {device.type, error.type}, interval: 1d, from: (now()-1M)@M, to: now()@M, filter: frontend.name == "${dqlEscape(fn)}"
| fieldsAdd d = record(t=t[], e=errors[])
| expand d
| fieldsAdd day = d[t], error_count = d[e]
| fields day, error_count, device.type, error.type
| filterOut isNull(device.type)
| sort day asc`;

const buildCmErrorsQuery = (fn: string) => `fetch user.events, from: (now()-1M)@M, to: now()@M
| filter frontend.name == "${dqlEscape(fn)}"
| filter dt.rum.user_type == "real_user"
| summarize
    total_sessions = countDistinct(dt.rum.session.id),
    js_error_sessions = countDistinct(if(characteristics.has_exception == true, dt.rum.session.id, else: null)),
    req_error_sessions = countDistinct(if(characteristics.has_failed_request == true, dt.rum.session.id, else: null)),
  by: { day = bin(start_time, 1d), device.type }
| filterOut isNull(device.type)
| sort day asc`;

const buildCmDeviceCompareQuery = (fn: string) => `timeseries {
    sessions=countDistinct(dt.frontend.session.active.estimated_count),
    lcp = percentile(dt.frontend.web.page.largest_contentful_paint, 75),
    lcp2 = count(dt.frontend.web.page.largest_contentful_paint),
    inp = percentile(dt.frontend.web.page.interaction_to_next_paint, 75),
    inp2 = count(dt.frontend.web.page.interaction_to_next_paint),
    cls = percentile(dt.frontend.web.page.cumulative_layout_shift, 75),
    cls2 = count(dt.frontend.web.page.cumulative_layout_shift)
  }, from: (now()-1M)@M, to: now()@M, interval: 1d, filter: frontend.name == "${dqlEscape(fn)}", by: {device.type}
| fieldsAdd d = record(d=sessions[], lcp=lcp[], lcp2=lcp2[], inp=inp[], inp2=inp2[], cls=cls[], cls2=cls2[])
| expand d
| filterOut isNull(device.type)
| summarize
    sessions = sum(d[d]),
    page_loads = sum(d[lcp2]),
    lcp_p75 = sum(d[lcp] * d[lcp2]) / sum(d[lcp2]),
    inp_p75 = sum(d[inp] * d[inp2]) / sum(d[inp2]),
    cls_p75 = sum(d[cls] * d[cls2]) / sum(d[cls2]),
  by: { device_type = device.type }`;

const buildCmCwvTierQuery = (fn: string) => `fetch user.events, from: (now()-1M)@M, to: now()@M
| filter frontend.name == "${dqlEscape(fn)}"
| filter characteristics.classifier == "page_summary"
| filter dt.rum.user_type == "real_user"
| fieldsAdd
    lcp_ms = toLong(web_vitals.largest_contentful_paint) / 1000000,
    inp_ms = toLong(web_vitals.interaction_to_next_paint) / 1000000,
    cls_val = toDouble(web_vitals.cumulative_layout_shift) / 10000
| summarize
    lcp_good = countIf(lcp_ms < 2500),
    lcp_ni = countIf(lcp_ms >= 2500 and lcp_ms < 4000),
    lcp_poor = countIf(lcp_ms >= 4000),
    lcp_total = countIf(isNotNull(lcp_ms)),
    inp_good = countIf(inp_ms < 200),
    inp_ni = countIf(inp_ms >= 200 and inp_ms < 500),
    inp_poor = countIf(inp_ms >= 500),
    inp_total = countIf(isNotNull(inp_ms)),
    cls_good = countIf(cls_val < 0.1),
    cls_ni = countIf(cls_val >= 0.1 and cls_val < 0.25),
    cls_poor = countIf(cls_val >= 0.25),
    cls_total = countIf(isNotNull(cls_val))`;

interface MonthlyRecord {
  Sessions: number | null;
  "User Actions": number | null;
  "Page Loads": number | null;
  "% Desktop": number | null;
  "% Mobile": number | null;
  month: string | number | null;
}

interface WebVitalsRecord {
  "Largest Contentful Paint": number | null;
  "Interaction to Next Paint": number | null;
  "Cumulative Layout Shift": number | null;
  month: string | number | null;
}

interface BrowserPerfRecord {
  Visits: number | null;
  "Largest Contentful Paint": number | null;
  "Interaction to Next Paint": number | null;
  "Cumulative Layout Shift": number | null;
  "device.type": string | null;
  "browser.name": string | null;
  month: string | number | null;
}

interface CmDailyDeviceRecord {
  day: string | number | null;
  sessions: number | null;
  "device.type": string | null;
}

interface CmDailyCwvRecord {
  day: string | number | null;
  lcp: number | null;
  inp: number | null;
  cls: number | null;
  "device.type": string | null;
}

interface CmErrorRecord {
  day: string | number | null;
  "device.type": string | null;
  total_sessions: number | null;
  js_error_sessions: number | null;
  req_error_sessions: number | null;
}

interface CmDeviceCompareRecord {
  device_type: string | null;
  sessions: number | null;
  page_loads: number | null;
  lcp_p75: number | null;
  inp_p75: number | null;
  cls_p75: number | null;
}

type CmCwvDistributionRecord = import("../components/CwvDistributionChart").CwvDistributionRecord;

interface CmTopExceptionRecord {
  count: number | null;
  "exception.type": string | null;
  "exception.message": string | null;
  "error.source": string | null;
}

interface CmTopRequestErrorRecord {
  count: number | null;
  "http.request.method": string | null;
  "http.response.status_code": number | null;
  "url.host": string | null;
  "url.path": string | null;
}

interface CmErrorCountRecord {
  day: string | number | null;
  error_count: number | null;
  "device.type": string | null;
  "error.type": string | null;
}

interface CmCwvTierRecord {
  lcp_good: number | null; lcp_ni: number | null; lcp_poor: number | null; lcp_total: number | null;
  inp_good: number | null; inp_ni: number | null; inp_poor: number | null; inp_total: number | null;
  cls_good: number | null; cls_ni: number | null; cls_poor: number | null; cls_total: number | null;
}

const COLORS = {
  sessions: "#7B61FF",
  userActions: "#00A98F",
  pageLoads: "#1D8AB7",
  lcp: "#F5A623",
  inp: "#1496ff",
  cls: "#73be28",
};


function parseMonth(raw: string | number | null): Date | null {
  if (raw === null) return null;
  return typeof raw === "number" ? new Date(raw) : new Date(raw);
}

function formatMonthLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

function formatYear(d: Date): string {
  return String(d.getFullYear());
}

function formatLcp(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms.toFixed(0)}ms`;
}

function pctChange(current: number, prior: number): number | null {
  if (prior === 0) return null;
  return ((current - prior) / prior) * 100;
}

const MISSING_DATA_NOTES = [
  { metric: "Bounce Rate", reason: "No available long-term metric for trending" },
  { metric: "% Actions with JS Error Rate", reason: "No available long-term metric for trending" },
  { metric: "APDEX", reason: "No available long-term metric for trending" },
  { metric: "Avg Time on Site", reason: "No available long-term metric for trending" },
  { metric: "Action Level Performance Data", reason: "No available long-term metric for trending" },
  { metric: "Landing / Not Landing %", reason: "No available long-term metric for trending" },
  { metric: "Exit Rate (Action Level)", reason: "No available long-term metric for trending" },
  { metric: "New vs Returning Users", reason: "No available long-term metric for trending" },
];

interface ChartVisibility {
  kpiCards: boolean;
  userTraffic: boolean;
  coreWebVitals: boolean;
  deviceDistribution: boolean;
  browserPerformance: boolean;
}

const CWV_GOOD = "#2ECC85";
const CWV_WARN = "#F5A623";
const CWV_POOR = "#E8345A";

function cwvLcpColor(ms: number) { return ms < 2500 ? CWV_GOOD : ms < 4000 ? CWV_WARN : CWV_POOR; }
function cwvInpColor(ms: number) { return ms < 200 ? CWV_GOOD : ms < 500 ? CWV_WARN : CWV_POOR; }
function cwvClsColor(val: number) { return val < 0.1 ? CWV_GOOD : val < 0.25 ? CWV_WARN : CWV_POOR; }

const SectionHeader: React.FC<{ label: string; color: string }> = ({ label, color }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
    <div style={{ width: 3, height: 16, borderRadius: 2, background: color, flexShrink: 0 }} />
    <span style={{
      fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const,
      letterSpacing: "0.1em", color: "var(--dt-colors-text-neutral-subdued, #b1b2d2)",
      fontFamily: "'DT Flow', 'Helvetica Neue', Arial, sans-serif",
    }}>
      {label}
    </span>
    <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
  </div>
);

const CmDeviceComparisonTable: React.FC<{ records: CmDeviceCompareRecord[] }> = ({ records }) => {
  const devices = ["mobile", "desktop"];
  const byDevice = Object.fromEntries(
    records.map((r) => [r.device_type?.toLowerCase() ?? "", r])
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0, marginBottom: 8 }}>
        <div />
        {devices.map((d) => (
          <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, textTransform: "capitalize", color: "var(--dt-colors-text-neutral-subdued, #b1b2d2)", letterSpacing: "0.05em", paddingBottom: 8, borderBottom: "1px solid var(--dt-colors-border-neutral-default, rgba(255,255,255,0.1))" }}>
            {d}
          </div>
        ))}
      </div>
      {[
        { label: "Sessions", fmt: (r: CmDeviceCompareRecord) => (r.sessions ?? 0).toLocaleString(), color: () => "var(--dt-colors-text-neutral-default, rgba(255,255,255,0.9))" },
        { label: "Page Loads", fmt: (r: CmDeviceCompareRecord) => (r.page_loads ?? 0).toLocaleString(), color: () => "var(--dt-colors-text-neutral-default, rgba(255,255,255,0.9))" },
        { label: "LCP p75", fmt: (r: CmDeviceCompareRecord) => formatLcp(r.lcp_p75 ?? 0), color: (r: CmDeviceCompareRecord) => cwvLcpColor(r.lcp_p75 ?? 0) },
        { label: "INP p75", fmt: (r: CmDeviceCompareRecord) => formatLcp(r.inp_p75 ?? 0), color: (r: CmDeviceCompareRecord) => cwvInpColor(r.inp_p75 ?? 0) },
        { label: "CLS", fmt: (r: CmDeviceCompareRecord) => ((r.cls_p75 ?? 0) / 10000).toFixed(3), color: (r: CmDeviceCompareRecord) => cwvClsColor((r.cls_p75 ?? 0) / 10000) },
      ].map(({ label, fmt, color }) => (
        <div key={label} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0, padding: "10px 0", borderBottom: "1px solid var(--dt-colors-border-neutral-default, rgba(255,255,255,0.06))" }}>
          <div style={{ fontSize: 12, color: "var(--dt-colors-text-neutral-subdued, #b1b2d2)" }}>{label}</div>
          {devices.map((d) => {
            const r = byDevice[d];
            return (
              <div key={d} style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: r ? color(r) : "var(--dt-colors-text-neutral-subdued, #b1b2d2)" }}>
                {r ? fmt(r) : "—"}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

const fmtCount = (v: string | number | null) =>
  typeof v === "number" ? v.toLocaleString() : (v ?? "—");

const TOP_EXCEPTION_COLUMNS: TopErrorColumn[] = [
  { key: "count", label: "#", align: "right", width: 60, render: fmtCount },
  { key: "exception.type", label: "Type", width: 200 },
  { key: "exception.message", label: "Message" },
  { key: "error.source", label: "Source", width: 120 },
];

const TOP_REQUEST_ERROR_COLUMNS: TopErrorColumn[] = [
  { key: "count", label: "#", align: "right", width: 60, render: fmtCount },
  { key: "http.request.method", label: "Method", align: "center", width: 70 },
  { key: "http.response.status_code", label: "Status", align: "center", width: 70, render: statusCodeRenderer },
  { key: "url.host", label: "Host", width: 180 },
  { key: "url.path", label: "Path" },
];

export const Dashboard = ({ isLimited = false }: { isLimited?: boolean }) => {
  const [selectedFrontend, setSelectedFrontend] = useState<string | null>(null);
  const [activeQuery, setActiveQuery] = useState<string | null>(null);
  const [activeVitalsQuery, setActiveVitalsQuery] = useState<string | null>(null);
  const [activeBrowserPerfQuery, setActiveBrowserPerfQuery] = useState<string | null>(null);
  const [activeDeviceDistQuery, setActiveDeviceDistQuery] = useState<string | null>(null);
  const [activeCwvWeeklyQuery, setActiveCwvWeeklyQuery] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  const [activeCmDeviceQuery, setActiveCmDeviceQuery] = useState<string | null>(null);
  const [activeCmCwvQuery, setActiveCmCwvQuery] = useState<string | null>(null);
  const [activeCmErrorsQuery, setActiveCmErrorsQuery] = useState<string | null>(null);
  const [activeCmDeviceCompareQuery, setActiveCmDeviceCompareQuery] = useState<string | null>(null);
  const [activeCmCwvTierQuery, setActiveCmCwvTierQuery] = useState<string | null>(null);
  const [activeCmErrorCountQuery, setActiveCmErrorCountQuery] = useState<string | null>(null);
  const [activeCmTopExceptionsQuery, setActiveCmTopExceptionsQuery] = useState<string | null>(null);
  const [activeCmTopRequestErrorsQuery, setActiveCmTopRequestErrorsQuery] = useState<string | null>(null);
  const [activeCmCwvDistributionQuery, setActiveCmCwvDistributionQuery] = useState<string | null>(null);
  const [activeCmTopPagesQuery, setActiveCmTopPagesQuery] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isExporting3Page, setIsExporting3Page] = useState(false);
  const [notesForExport, setNotesForExport] = useState("");
  const [notesByTab, setNotesByTab] = useState<Record<number, string>>({ 0: "", 1: "" });
  const [isGenerating, setIsGenerating] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chartVisibility, setChartVisibility] = useState<ChartVisibility>({
    kpiCards: true,
    userTraffic: true,
    coreWebVitals: true,
    deviceDistribution: true,
    browserPerformance: true,
  });
  const dashboardRef = useRef<HTMLDivElement>(null);
  const pdfLayoutRef = useRef<HTMLDivElement>(null);
  const pdfLayout3PageRef = useRef<PdfLayout3PageHandle>(null);

  const toggleChart = useCallback((key: keyof ChartVisibility) => {
    setChartVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleTabChange = useCallback((idx: number) => {
    if (isGenerating || isExporting || isExporting3Page) return;
    setActiveTab(idx);
  }, [isGenerating, isExporting, isExporting3Page]);

  const environmentName: string = useMemo(() => {
    try { return new URL(getEnvironmentUrl()).hostname; } catch { return ""; }
  }, []);

  const { data: frontendsData, isLoading: frontendsLoading } = useDql(FRONTENDS_QUERY);

  const { data: metricsData, isLoading: metricsLoading } = useDql(
    { query: activeQuery! },
    { enabled: !!activeQuery }
  );

  const { data: vitalsData, isLoading: vitalsLoading } = useDql(
    { query: activeVitalsQuery! },
    { enabled: !!activeVitalsQuery }
  );

  const { data: browserPerfData, isLoading: browserPerfLoading } = useDql(
    { query: activeBrowserPerfQuery! },
    { enabled: !!activeBrowserPerfQuery }
  );

  const { data: cwvWeeklyData } = useDql(
    { query: activeCwvWeeklyQuery! },
    { enabled: !!activeCwvWeeklyQuery }
  );

  const { data: deviceDistData, isLoading: deviceDistLoading } = useDql(
    { query: activeDeviceDistQuery! },
    { enabled: !!activeDeviceDistQuery }
  );


  const { data: cmDeviceData, isLoading: cmDeviceLoading } = useDql(
    { query: activeCmDeviceQuery! }, { enabled: !!activeCmDeviceQuery }
  );
  const { data: cmCwvData, isLoading: cmCwvLoading } = useDql(
    { query: activeCmCwvQuery! }, { enabled: !!activeCmCwvQuery }
  );
  const { data: cmErrorsData, isLoading: cmErrorsLoading } = useDql(
    { query: activeCmErrorsQuery! }, { enabled: !!activeCmErrorsQuery }
  );
  const { data: cmDeviceCompareData, isLoading: cmDeviceCompareLoading } = useDql(
    { query: activeCmDeviceCompareQuery! }, { enabled: !!activeCmDeviceCompareQuery }
  );
  const { data: cmCwvTierData } = useDql(
    { query: activeCmCwvTierQuery! }, { enabled: !!activeCmCwvTierQuery }
  );
  const { data: cmErrorCountData } = useDql(
    { query: activeCmErrorCountQuery! }, { enabled: !!activeCmErrorCountQuery }
  );
  const { data: cmTopExceptionsData, isLoading: cmTopExceptionsLoading } = useDql(
    { query: activeCmTopExceptionsQuery! }, { enabled: !!activeCmTopExceptionsQuery }
  );
  const { data: cmTopRequestErrorsData, isLoading: cmTopRequestErrorsLoading } = useDql(
    { query: activeCmTopRequestErrorsQuery! }, { enabled: !!activeCmTopRequestErrorsQuery }
  );
  const { data: cmCwvDistributionData, isLoading: cmCwvDistributionLoading } = useDql(
    { query: activeCmCwvDistributionQuery! }, { enabled: !!activeCmCwvDistributionQuery }
  );
  const { data: cmTopPagesData, isLoading: cmTopPagesLoading } = useDql(
    { query: activeCmTopPagesQuery! }, { enabled: !!activeCmTopPagesQuery }
  );

  const frontendNames: string[] = useMemo(
    () =>
      (frontendsData?.records ?? [])
        .map((r) => r["frontend.name"] as string)
        .filter(Boolean),
    [frontendsData]
  );

  const records: MonthlyRecord[] = useMemo(
    () => (metricsData?.records ?? []) as unknown as MonthlyRecord[],
    [metricsData]
  );

  const vitalsRecords: WebVitalsRecord[] = useMemo(
    () => (vitalsData?.records ?? []) as unknown as WebVitalsRecord[],
    [vitalsData]
  );

  const browserPerfRecords: BrowserPerfRecord[] = useMemo(
    () => (browserPerfData?.records ?? []) as unknown as BrowserPerfRecord[],
    [browserPerfData]
  );

  interface DeviceDistRecord {
    Sessions: number | null;
    "device.type": string | null;
    month: string | number | null;
  }

  const deviceDistChartData: DeviceMonthPoint[] = useMemo(() => {
    const raw = (deviceDistData?.records ?? []) as unknown as DeviceDistRecord[];
    return raw.map((r) => {
      const d = parseMonth(r.month);
      return {
        month: d ? formatMonthLabel(d) : "",
        monthTs: d?.getTime() ?? 0,
        deviceType: r["device.type"] ?? "",
        sessions: r.Sessions ?? 0,
      };
    });
  }, [deviceDistData]);

  const cwvWeeklyChartData: CwvWeeklyDataPoint[] = useMemo(() => {
    interface CwvWeeklyRecord { week: string | number | null; lcp: number | null; inp: number | null; cls: number | null; }
    const raw = (cwvWeeklyData?.records ?? []) as unknown as CwvWeeklyRecord[];
    return raw.map((r) => {
      const d = r.week ? new Date(r.week as string) : null;
      return {
        week: d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "",
        weekTs: d?.getTime() ?? 0,
        lcp: r.lcp ?? 0,
        inp: r.inp ?? 0,
        cls: r.cls != null ? r.cls / 10000 : 0,
      };
    });
  }, [cwvWeeklyData]);

  const chartData: UserTrafficDataPoint[] = useMemo(
    () =>
      records.map((r) => {
        const d = parseMonth(r.month);
        return {
          month: d ? formatMonthLabel(d) : "",
          year: d ? formatYear(d) : "",
          sessions: r.Sessions ?? 0,
          userActions: r["User Actions"] ?? 0,
          pageLoads: r["Page Loads"] ?? 0,
          pctDesktop: r["% Desktop"] ?? 0,
          pctMobile: r["% Mobile"] ?? 0,
        };
      }),
    [records]
  );

  const vitalsChartData: WebVitalsDataPoint[] = useMemo(
    () =>
      vitalsRecords.map((r) => {
        const d = parseMonth(r.month);
        return {
          month: d ? formatMonthLabel(d) : "",
          year: d ? formatYear(d) : "",
          lcp: r["Largest Contentful Paint"] ?? 0,
          inp: r["Interaction to Next Paint"] ?? 0,
          cls: r["Cumulative Layout Shift"] ?? 0,
        };
      }),
    [vitalsRecords]
  );

  const browserPerfChartData: BrowserPerfDataPoint[] = useMemo(
    () =>
      browserPerfRecords.map((r) => {
        const d = parseMonth(r.month);
        return {
          month: d ? formatMonthLabel(d) : "",
          monthTs: d?.getTime() ?? 0,
          deviceType: r["device.type"] ?? "",
          browserName: r["browser.name"] ?? "",
          visits: r.Visits ?? 0,
          lcp: r["Largest Contentful Paint"] ?? 0,
          inp: r["Interaction to Next Paint"] ?? 0,
          cls: r["Cumulative Layout Shift"] ?? 0,
        };
      }),
    [browserPerfRecords]
  );

  const browserPerfLatestMonth = useMemo(() => {
    if (browserPerfRecords.length === 0) return "";
    const maxRaw = browserPerfRecords.reduce<number | null>((best, r) => {
      const t = typeof r.month === "number" ? r.month : r.month ? new Date(r.month as string).getTime() : null;
      if (t === null) return best;
      return best === null || t > best ? t : best;
    }, null);
    if (maxRaw === null) return "";
    return formatMonthLabel(new Date(maxRaw));
  }, [browserPerfRecords]);


  const cmDailyDeviceChartData: DailyDevicePoint[] = useMemo(() => {
    const raw = (cmDeviceData?.records ?? []) as unknown as CmDailyDeviceRecord[];
    return raw.map((r) => ({
      day: r.day,
      deviceType: r["device.type"] ?? "other",
      sessions: r.sessions ?? 0,
    }));
  }, [cmDeviceData]);

  const cmDailyCwvChartData: CwvDailyDevicePoint[] = useMemo(() => {
    const raw = (cmCwvData?.records ?? []) as unknown as CmDailyCwvRecord[];
    return raw.map((r) => {
      const ts = r.day ? new Date(r.day as string).getTime() : 0;
      return {
        day: ts ? new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "",
        dayTs: ts,
        lcp: r.lcp ?? 0,
        inp: r.inp ?? 0,
        cls: r.cls != null ? r.cls / 10000 : 0,
        deviceType: (r["device.type"] ?? "other").toLowerCase(),
      };
    });
  }, [cmCwvData]);

  const cmErrorChartData: DailyErrorPoint[] = useMemo(() => {
    const raw = (cmErrorsData?.records ?? []) as unknown as CmErrorRecord[];
    return raw.map((r) => ({
      day: r.day,
      deviceType: r["device.type"],
      totalSessions: r.total_sessions,
      jsErrorSessions: r.js_error_sessions,
      reqErrorSessions: r.req_error_sessions,
    }));
  }, [cmErrorsData]);

  const cmErrorCountChartData: DailyErrorCountPoint[] = useMemo(() => {
    const raw = (cmErrorCountData?.records ?? []) as unknown as CmErrorCountRecord[];
    return raw.map((r) => ({
      day: r.day,
      deviceType: r["device.type"],
      errorType: r["error.type"],
      count: r.error_count,
    }));
  }, [cmErrorCountData]);

  const cmCwvDistributionRecord = useMemo(
    () => (cmCwvDistributionData?.records?.[0] ?? null) as CmCwvDistributionRecord | null,
    [cmCwvDistributionData]
  );

  const cmTopExceptionRows = useMemo(
    () => (cmTopExceptionsData?.records ?? []) as unknown as CmTopExceptionRecord[],
    [cmTopExceptionsData]
  );

  const cmTopRequestErrorRows = useMemo(
    () => (cmTopRequestErrorsData?.records ?? []) as unknown as CmTopRequestErrorRecord[],
    [cmTopRequestErrorsData]
  );

  interface CmTopPageRecord {
    "page.name": string | null;
    count: number | null;
    lcp: number | null;
    inp: number | null;
    cls: number | null;
    exceptions: number | null;
    request_errors: number | null;
  }

  // ponytail: spoof rows are for demo env only — remove when real data is available
  const CM_TOP_PAGES_DEMO: PagePerfRow[] = [
    { name: "/home",           count: 14200, lcp: 2100, inp: 180,  cls: 0.05,  exceptions: 0.12, requestErrors: 0.08 },
    { name: "/products",       count: 8750,  lcp: 3100, inp: 280,  cls: 0.12,  exceptions: 0.31, requestErrors: 0.22 },
    { name: "/product/:id",    count: 6100,  lcp: 2800, inp: 220,  cls: 0.08,  exceptions: 0.18, requestErrors: 0.15 },
    { name: "/search",         count: 5400,  lcp: 3600, inp: 340,  cls: 0.18,  exceptions: 0.42, requestErrors: 0.35 },
    { name: "/category/:slug", count: 5100,  lcp: 3300, inp: 300,  cls: 0.14,  exceptions: 0.27, requestErrors: 0.19 },
    { name: "/cart",           count: 3800,  lcp: 2600, inp: 240,  cls: 0.09,  exceptions: 0.35, requestErrors: 0.28 },
    { name: "/checkout",       count: 4300,  lcp: 4800, inp: 520,  cls: 0.31,  exceptions: 0.89, requestErrors: 0.74 },
    { name: "/account",        count: 2900,  lcp: 2300, inp: 190,  cls: 0.07,  exceptions: 0.24, requestErrors: 0.11 },
    { name: "/login",          count: 1800,  lcp: 1800, inp: 150,  cls: 0.03,  exceptions: 0.08, requestErrors: 0.05 },
  ];

  const cmTopPagesRows: PagePerfRow[] = useMemo(() => {
    const raw = (cmTopPagesData?.records ?? []) as unknown as CmTopPageRecord[];
    const real: PagePerfRow[] = raw.map((r) => ({
      name: r["page.name"] ?? "(unknown)",
      count: r.count ?? 0,
      lcp: r.lcp,
      inp: r.inp,
      cls: r.cls,
      exceptions: r.exceptions,
      requestErrors: r.request_errors,
    }));
    const needed = Math.max(0, 10 - real.length);
    return [...real, ...CM_TOP_PAGES_DEMO.slice(0, needed)];
  }, [cmTopPagesData]);

  const cmDeviceCompareRecords: CmDeviceCompareRecord[] = useMemo(
    () => (cmDeviceCompareData?.records ?? []) as unknown as CmDeviceCompareRecord[],
    [cmDeviceCompareData]
  );

  const cmCwvTierRecord: CwvTierData | null = useMemo(() => {
    const raw = (cmCwvTierData?.records ?? []) as unknown as CmCwvTierRecord[];
    if (!raw[0]) return null;
    const r = raw[0];
    return {
      lcp_good: r.lcp_good, lcp_ni: r.lcp_ni, lcp_poor: r.lcp_poor, lcp_total: r.lcp_total,
      inp_good: r.inp_good, inp_ni: r.inp_ni, inp_poor: r.inp_poor, inp_total: r.inp_total,
      cls_good: r.cls_good, cls_ni: r.cls_ni, cls_poor: r.cls_poor, cls_total: r.cls_total,
    };
  }, [cmCwvTierData]);

  const cmTotalSessions = useMemo(
    () => cmDeviceCompareRecords.reduce((s, r) => s + (r.sessions ?? 0), 0),
    [cmDeviceCompareRecords]
  );
  const cmTotalPageLoads = useMemo(
    () => cmDeviceCompareRecords.reduce((s, r) => s + (r.page_loads ?? 0), 0),
    [cmDeviceCompareRecords]
  );
  const cmOverallLcp = useMemo(() => {
    const pl = cmDeviceCompareRecords.reduce((s, r) => s + (r.page_loads ?? 0), 0);
    return pl > 0 ? cmDeviceCompareRecords.reduce((s, r) => s + (r.lcp_p75 ?? 0) * (r.page_loads ?? 0), 0) / pl : 0;
  }, [cmDeviceCompareRecords]);
  const cmOverallInp = useMemo(() => {
    const pl = cmDeviceCompareRecords.reduce((s, r) => s + (r.page_loads ?? 0), 0);
    return pl > 0 ? cmDeviceCompareRecords.reduce((s, r) => s + (r.inp_p75 ?? 0) * (r.page_loads ?? 0), 0) / pl : 0;
  }, [cmDeviceCompareRecords]);
  const cmOverallCls = useMemo(() => {
    const pl = cmDeviceCompareRecords.reduce((s, r) => s + (r.page_loads ?? 0), 0);
    return pl > 0 ? cmDeviceCompareRecords.reduce((s, r) => s + (r.cls_p75 ?? 0) * (r.page_loads ?? 0), 0) / pl : 0;
  }, [cmDeviceCompareRecords]);

  const lastMonthRange = useMemo((): [number, number] => {
    const now = new Date();
    const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1);
    const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0);
    return [start, end];
  }, []);

  const handleFrontendChange = useCallback((value: string | null) => {
    setSelectedFrontend(value);
    setActiveQuery(value ? buildMetricsQuery(value) : null);
    setActiveVitalsQuery(value ? buildWebVitalsQuery(value) : null);
    setActiveBrowserPerfQuery(value ? buildBrowserPerfQuery(value) : null);
    setActiveDeviceDistQuery(value ? buildDeviceDistQuery(value) : null);
    setActiveCwvWeeklyQuery(value ? buildCwvWeeklyQuery(value) : null);
    setActiveCmDeviceQuery(value ? buildCmDailyDeviceQuery(value) : null);
    setActiveCmCwvQuery(value ? buildCmDailyCwvQuery(value) : null);
    setActiveCmErrorsQuery(value ? buildCmErrorsQuery(value) : null);
    setActiveCmDeviceCompareQuery(value ? buildCmDeviceCompareQuery(value) : null);
    setActiveCmCwvTierQuery(value ? buildCmCwvTierQuery(value) : null);
    setActiveCmErrorCountQuery(value ? buildCmErrorCountQuery(value) : null);
    setActiveCmTopExceptionsQuery(value ? buildCmTopExceptionsQuery(value) : null);
    setActiveCmTopRequestErrorsQuery(value ? buildCmTopRequestErrorsQuery(value) : null);
    setActiveCmCwvDistributionQuery(value ? buildCmCwvDistributionQuery(value) : null);
    setActiveCmTopPagesQuery(value ? buildCmTopPagesQuery(value) : null);
  }, []);

  const handleExport = () => {
    if (!pdfLayoutRef.current || !selectedFrontend || isExporting) return;
    setIsExporting(true);
    setNotesForExport(notesByTab[0] ?? "");
    setTimeout(() => {
      exportDashboardPdf(pdfLayoutRef.current!, selectedFrontend).finally(() => {
        setIsExporting(false);
      });
    }, 0);
  };

  const handleExport3Page = () => {
    if (!pdfLayout3PageRef.current || !selectedFrontend || isExporting3Page) return;
    setIsExporting3Page(true);
    setNotesForExport(notesByTab[0] ?? "");
    setTimeout(() => {
      const pages = pdfLayout3PageRef.current!.getPages().filter(Boolean) as HTMLElement[];
      exportDashboard3PagePdf(pages, selectedFrontend).finally(() => {
        setIsExporting3Page(false);
      });
    }, 300);
  };

  const last = records[records.length - 1];
  const prior = records[records.length - 2];
  const lastVitals = vitalsRecords[vitalsRecords.length - 1];
  const priorVitals = vitalsRecords[vitalsRecords.length - 2];

  const kpiSessions = last?.Sessions ?? 0;
  const kpiUserActions = last?.["User Actions"] ?? 0;
  const kpiPageLoads = last?.["Page Loads"] ?? 0;
  const kpiLcp = lastVitals?.["Largest Contentful Paint"] ?? 0;

  const hasData = records.length > 0;
  const isLoading = metricsLoading || vitalsLoading;

  const analystNotesContext: AnalystNotesContext | undefined = useMemo(() => {
    if (!selectedFrontend || records.length === 0) return undefined;
    return {
      frontendName: selectedFrontend,
      trafficTrend: chartData.map((r) => ({
        month: r.month,
        sessions: r.sessions,
        userActions: r.userActions,
        pageLoads: r.pageLoads,
        pctDesktop: r.pctDesktop,
        pctMobile: r.pctMobile,
      })),
      vitalsTrend: vitalsChartData.map((r) => ({
        month: r.month,
        lcpMs: r.lcp,
        inpMs: r.inp,
        cls: r.cls,
      })),
      browserTrend: browserPerfChartData.map((r) => ({
        month: r.month,
        deviceType: r.deviceType,
        browserName: r.browserName,
        visits: r.visits,
        lcpMs: r.lcp,
        inpMs: r.inp,
        cls: r.cls,
      })),
    };
  }, [selectedFrontend, records.length, chartData, vitalsChartData, browserPerfChartData]);

  const cmNotesContext: CurrentMonthAnalystContext | undefined = useMemo(() => {
    if (!selectedFrontend || cmDailyDeviceChartData.length === 0) return undefined;
    return {
      type: 'last-month',
      frontendName: selectedFrontend,
      dailyByDevice: cmDailyDeviceChartData.map((r) => {
        const ts = typeof r.day === "number" ? r.day : r.day ? new Date(r.day as string).getTime() : null;
        const d = ts ? new Date(ts) : null;
        return {
          day: d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "",
          deviceType: r.deviceType,
          sessions: r.sessions,
        };
      }),
      dailyCwv: cmDailyCwvChartData.map((r) => ({
        day: r.day,
        lcpMs: r.lcp,
        inpMs: r.inp,
        cls: r.cls,
      })),
      dailyErrors: cmErrorChartData.map((r) => {
        const ts = typeof r.day === "number" ? r.day : r.day ? new Date(r.day as string).getTime() : null;
        const d = ts ? new Date(ts) : null;
        return {
          day: d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "",
          jsErrorSessions: r.jsErrorSessions ?? 0,
          reqErrorSessions: r.reqErrorSessions ?? 0,
        };
      }),
      deviceCompare: cmDeviceCompareRecords.map((r) => ({
        deviceType: r.device_type ?? "unknown",
        sessions: r.sessions ?? 0,
        pageLoads: r.page_loads ?? 0,
        lcpMs: r.lcp_p75 ?? 0,
        inpMs: r.inp_p75 ?? 0,
        cls: r.cls_p75 != null ? r.cls_p75 / 10000 : 0,
      })),
    };
  }, [selectedFrontend, cmDailyDeviceChartData, cmDailyCwvChartData, cmErrorChartData, cmDeviceCompareRecords]);

  return (
    <Flex flexDirection="column" gap={24} paddingTop={32} paddingRight={32} paddingBottom={64} paddingLeft={32}>
      <TitleBar>
        <TitleBar.Title>Monthly Review Dashboard</TitleBar.Title>
        {selectedFrontend && (
          <TitleBar.Subtitle>{selectedFrontend}</TitleBar.Subtitle>
        )}
        <TitleBar.Suffix>
          <Flex gap={8} alignItems="flex-end">
            <Select
              value={selectedFrontend}
              onChange={(v) => handleFrontendChange(v as string | null)}
              disabled={frontendsLoading}
            >
              <Select.Trigger placeholder={frontendsLoading ? "Loading…" : "Select a frontend"} />
              <Select.Content>
                {frontendNames.map((name) => (
                  <Select.Option key={name} value={name}>
                    {name}
                  </Select.Option>
                ))}
              </Select.Content>
            </Select>

            {!isLimited && (
              <>
                <Button
                  variant="default"
                  onClick={handleExport}
                  disabled={isExporting || !hasData}
                  style={{ minWidth: "7.5rem", display: "inline-flex", justifyContent: "center", alignItems: "center" }}
                >
                  {isExporting ? <ProgressCircle size="small" /> : "Export PDF"}
                </Button>

                <Button
                  variant="emphasized"
                  onClick={handleExport3Page}
                  disabled={isExporting3Page || !hasData}
                  style={{ minWidth: "9rem", display: "inline-flex", justifyContent: "center", alignItems: "center" }}
                >
                  {isExporting3Page ? <ProgressCircle size="small" /> : "Export PDF (3-page)"}
                </Button>

                <Button
                  variant="default"
                  onClick={() => setSettingsOpen(true)}
                >
                  Settings
                </Button>
              </>
            )}
          </Flex>
        </TitleBar.Suffix>
      </TitleBar>

      <Tabs selectedIndex={activeTab} onChange={handleTabChange}>
        <Tab title="Trending">
          {isLoading ? (
            <Flex justifyContent="center" alignItems="center" style={{ minHeight: 400 }}>
              <ProgressCircle />
            </Flex>
          ) : !selectedFrontend ? (
            <Surface elevation="raised" padding={40}>
              <Flex justifyContent="center" alignItems="center" style={{ minHeight: 300 }}>
                <Text>Select a frontend to view monthly metrics.</Text>
              </Flex>
            </Surface>
          ) : !hasData ? (
            <Surface elevation="raised" padding={40}>
              <Flex justifyContent="center" alignItems="center" style={{ minHeight: 300 }}>
                <Text>No data found for the selected frontend in the last 6 months.</Text>
              </Flex>
            </Surface>
          ) : (
            <div ref={dashboardRef}>
              {/* KPI Summary Row */}
              {chartVisibility.kpiCards && <Flex gap={16} style={{ marginBottom: 24 }}>
                <KpiCard
                  label="Sessions"
                  value={kpiSessions.toLocaleString()}
                  change={prior ? pctChange(kpiSessions, prior.Sessions ?? 0) : null}
                  color={COLORS.sessions}
                />
                <KpiCard
                  label="User Actions"
                  value={kpiUserActions.toLocaleString()}
                  change={prior ? pctChange(kpiUserActions, prior["User Actions"] ?? 0) : null}
                  color={COLORS.userActions}
                />
                <KpiCard
                  label="Page Loads"
                  value={kpiPageLoads.toLocaleString()}
                  change={prior ? pctChange(kpiPageLoads, prior["Page Loads"] ?? 0) : null}
                  color={COLORS.pageLoads}
                />
                <KpiCard
                  label="LCP p75"
                  value={formatLcp(kpiLcp)}
                  change={priorVitals ? pctChange(kpiLcp, priorVitals["Largest Contentful Paint"] ?? 0) : null}
                  color={COLORS.lcp}
                  lowerIsBetter
                />
              </Flex>}

              {/* Charts row */}
              {(chartVisibility.userTraffic || chartVisibility.coreWebVitals) && (
                <Flex gap={16} alignItems="flex-start" style={{ marginBottom: 16 }}>
                  {chartVisibility.userTraffic && (
                    <Surface elevation="raised" padding={24} style={{ flex: 1, minWidth: 0 }}>
                      <Heading level={5} style={{ marginBottom: 16, marginTop: 0 }}>User Traffic</Heading>
                      <UserTrafficChart data={chartData} />
                    </Surface>
                  )}
                  {chartVisibility.coreWebVitals && (
                    <Surface elevation="raised" padding={24} style={{ flex: 1, minWidth: 0 }}>
                      <Heading level={5} style={{ marginBottom: 16, marginTop: 0 }}>Core Web Vitals</Heading>
                      <CoreWebVitalsChart data={vitalsChartData} />
                    </Surface>
                  )}
                </Flex>
              )}

              {/* CWV Trend row */}
              {chartVisibility.deviceDistribution && (
                <Surface elevation="raised" padding={24} style={{ marginBottom: 16 }}>
                  <Heading level={5} style={{ marginBottom: 16, marginTop: 0 }}>Core Web Vitals Trend (Weekly)</Heading>
                  {cwvWeeklyChartData.length > 0 ? (
                    <div style={{ height: 280 }}>
                      <CwvTrendChart data={cwvWeeklyChartData} />
                    </div>
                  ) : (
                    <Text>No weekly CWV data available.</Text>
                  )}
                </Surface>
              )}

              {/* Browser Performance row */}
              {chartVisibility.browserPerformance && (
                <Surface elevation="raised" padding={24}>
                  <Heading level={5} style={{ marginBottom: 16, marginTop: 0 }}>Browser Performance</Heading>
                  {browserPerfLoading ? (
                    <Flex justifyContent="center" alignItems="center" style={{ minHeight: 120 }}>
                      <ProgressCircle />
                    </Flex>
                  ) : browserPerfChartData.length > 0 ? (
                    <BrowserPerformanceChart data={browserPerfChartData} latestMonth={browserPerfLatestMonth} />
                  ) : (
                    <Text>No browser performance data available.</Text>
                  )}
                </Surface>
              )}
            </div>
          )}
        </Tab>

        <Tab title="Last Month">
          {(cmDeviceLoading || cmCwvLoading || cmDeviceCompareLoading) ? (
            <Flex justifyContent="center" alignItems="center" style={{ minHeight: 400 }}>
              <ProgressCircle />
            </Flex>
          ) : !selectedFrontend ? (
            <Surface elevation="raised" padding={40}>
              <Flex justifyContent="center" alignItems="center" style={{ minHeight: 300 }}>
                <Text>Select a frontend to view last month's metrics.</Text>
              </Flex>
            </Surface>
          ) : cmTotalSessions === 0 && !cmDeviceLoading ? (
            <Surface elevation="raised" padding={40}>
              <Flex justifyContent="center" alignItems="center" style={{ minHeight: 300 }}>
                <Text>No data found for last month.</Text>
              </Flex>
            </Surface>
          ) : (
            <Flex flexDirection="column" gap={16}>

              {/* KPI summary row — all metrics at a glance */}
              <Flex gap={16} alignItems="stretch">
                <KpiCard label="Sessions" value={cmTotalSessions.toLocaleString()} change={null} color={COLORS.sessions} />
                <KpiCard label="Page Loads" value={cmTotalPageLoads.toLocaleString()} change={null} color={COLORS.pageLoads} />
                <div style={{ width: 1, alignSelf: "stretch", background: "var(--dt-colors-border-neutral-default, rgba(255,255,255,0.1))", margin: "0 4px" }} />
                <KpiCard label="LCP p75" value={formatLcp(cmOverallLcp)} change={null} color={cwvLcpColor(cmOverallLcp)} lowerIsBetter />
                <KpiCard label="INP p75" value={formatLcp(cmOverallInp)} change={null} color={cwvInpColor(cmOverallInp)} lowerIsBetter />
                <KpiCard label="CLS p75" value={(cmOverallCls / 10000).toFixed(3)} change={null} color={cwvClsColor(cmOverallCls / 10000)} lowerIsBetter />
              </Flex>

              {/* ── TRAFFIC ── */}
              <SectionHeader label="Traffic" color={COLORS.sessions} />

              <Flex gap={16} alignItems="stretch">
                <Surface elevation="raised" padding={24} style={{ flex: 2, minWidth: 0 }}>
                  <Heading level={5} style={{ marginBottom: 16, marginTop: 0 }}>Daily Sessions by Device</Heading>
                  <DailyDeviceTrafficChart data={cmDailyDeviceChartData} fillRange={lastMonthRange} />
                </Surface>
                <Surface elevation="raised" padding={24} style={{ flex: 1, minWidth: 240 }}>
                  <Heading level={5} style={{ marginBottom: 16, marginTop: 0 }}>Mobile vs Desktop</Heading>
                  {cmDeviceCompareRecords.length > 0 ? (
                    <CmDeviceComparisonTable records={cmDeviceCompareRecords} />
                  ) : (
                    <Text>No device comparison data.</Text>
                  )}
                </Surface>
              </Flex>

              {/* ── CORE WEB VITALS ── */}
              <SectionHeader label="Core Web Vitals" color={COLORS.lcp} />

              <Flex gap={16} alignItems="stretch">
                {cmCwvTierRecord && (
                  <Surface elevation="raised" padding={24} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                    <Heading level={5} style={{ marginBottom: 4, marginTop: 0 }}>Experience Distribution</Heading>
                    <Text style={{ fontSize: "0.8rem", color: "var(--dt-colors-text-neutral-subdued, #b1b2d2)", marginBottom: 16, display: "block" }}>
                      % of page loads rated Good / Needs Improvement / Poor
                    </Text>
                    <div style={{ flex: 1 }}>
                      <CwvTierChart data={cmCwvTierRecord} />
                    </div>
                  </Surface>
                )}
                <Surface elevation="raised" padding={24} style={{ flex: 1, minWidth: 0 }}>
                  <Heading level={5} style={{ marginBottom: 4, marginTop: 0 }}>Load Time Distribution</Heading>
                  <Text style={{ fontSize: "0.8rem", color: "var(--dt-colors-text-neutral-subdued, #b1b2d2)", marginBottom: 16, display: "block" }}>
                    % of page loads per 1s time bucket (LCP and INP)
                  </Text>
                  {cmCwvDistributionLoading ? (
                    <Flex justifyContent="center" alignItems="center" style={{ minHeight: 120 }}><ProgressCircle /></Flex>
                  ) : cmCwvDistributionRecord ? (
                    <CwvDistributionChart
                    data={cmCwvDistributionRecord}
                    lcpP75={cmOverallLcp}
                    inpP75={cmOverallInp}
                    clsP75={cmOverallCls / 10000}
                  />
                  ) : (
                    <Text>No distribution data available.</Text>
                  )}
                </Surface>
              </Flex>

              {cmCwvLoading ? (
                <Flex justifyContent="center" alignItems="center" style={{ minHeight: 120 }}><ProgressCircle /></Flex>
              ) : cmDailyCwvChartData.length > 0 ? (
                <Flex gap={16} alignItems="stretch">
                  <Surface elevation="raised" padding={24} style={{ flex: 1, minWidth: 0 }}>
                    <Heading level={5} style={{ marginBottom: 16, marginTop: 0 }}>LCP — Daily Trend</Heading>
                    <div style={{ height: 220 }}>
                      <CwvSingleMetricChart data={cmDailyCwvChartData} metric="lcp" fillRange={lastMonthRange} />
                    </div>
                  </Surface>
                  <Surface elevation="raised" padding={24} style={{ flex: 1, minWidth: 0 }}>
                    <Heading level={5} style={{ marginBottom: 16, marginTop: 0 }}>INP — Daily Trend</Heading>
                    <div style={{ height: 220 }}>
                      <CwvSingleMetricChart data={cmDailyCwvChartData} metric="inp" fillRange={lastMonthRange} />
                    </div>
                  </Surface>
                  <Surface elevation="raised" padding={24} style={{ flex: 1, minWidth: 0 }}>
                    <Heading level={5} style={{ marginBottom: 16, marginTop: 0 }}>CLS — Daily Trend</Heading>
                    <div style={{ height: 220 }}>
                      <CwvSingleMetricChart data={cmDailyCwvChartData} metric="cls" fillRange={lastMonthRange} />
                    </div>
                  </Surface>
                </Flex>
              ) : null}

              {/* ── TOP PAGES ── */}
              <SectionHeader label="Top Pages" color={COLORS.userActions} />

              <Surface elevation="raised" padding={24}>
                <Heading level={5} style={{ marginBottom: 4, marginTop: 0 }}>Page Performance Scorecard</Heading>
                <Text style={{ fontSize: "0.8rem", color: "var(--dt-colors-text-neutral-subdued, #b1b2d2)", marginBottom: 16, display: "block" }}>
                  Top 10 pages by visit volume — LCP, INP, CLS, and error averages (p75)
                </Text>
                {cmTopPagesLoading ? (
                  <Flex justifyContent="center" alignItems="center" style={{ minHeight: 120 }}><ProgressCircle /></Flex>
                ) : cmTopPagesRows.length > 0 ? (
                  <PagePerformanceTable rows={cmTopPagesRows} />
                ) : (
                  <Text>No page data available.</Text>
                )}
              </Surface>

              {/* ── ERRORS ── */}
              <SectionHeader label="Errors" color={CWV_POOR} />

              <Surface elevation="raised" padding={24}>
                <Heading level={5} style={{ marginBottom: 4, marginTop: 0 }}>Error Rates & Counts</Heading>
                <Text style={{ fontSize: "0.8rem", color: "var(--dt-colors-text-neutral-subdued, #b1b2d2)", marginBottom: 16, display: "block" }}>
                  Sessions containing at least one JS exception or failed HTTP request (daily)
                </Text>
                {cmErrorsLoading ? (
                  <Flex justifyContent="center" alignItems="center" style={{ minHeight: 120 }}><ProgressCircle /></Flex>
                ) : cmErrorChartData.length > 0 ? (
                  <DailyErrorChart data={cmErrorChartData} errorCounts={cmErrorCountChartData} fillRange={lastMonthRange} />
                ) : (
                  <Text>No error session data available.</Text>
                )}
              </Surface>

              <Flex gap={16} alignItems="flex-start">
                <Surface elevation="raised" padding={24} style={{ flex: 1, minWidth: 0 }}>
                  <Heading level={5} style={{ marginBottom: 4, marginTop: 0 }}>Top Exceptions</Heading>
                  <Text style={{ fontSize: "0.8rem", color: "var(--dt-colors-text-neutral-subdued, #b1b2d2)", marginBottom: 16, display: "block" }}>
                    Most frequent JS exceptions last month
                  </Text>
                  {cmTopExceptionsLoading ? (
                    <Flex justifyContent="center" alignItems="center" style={{ minHeight: 80 }}><ProgressCircle /></Flex>
                  ) : cmTopExceptionRows.length > 0 ? (
                    <TopErrorsTable
                      columns={TOP_EXCEPTION_COLUMNS}
                      rows={cmTopExceptionRows as unknown as Record<string, string | number | null>[]}
                    />
                  ) : (
                    <Text>No exceptions found.</Text>
                  )}
                </Surface>

                <Surface elevation="raised" padding={24} style={{ flex: 1, minWidth: 0 }}>
                  <Heading level={5} style={{ marginBottom: 4, marginTop: 0 }}>Top Request Errors</Heading>
                  <Text style={{ fontSize: "0.8rem", color: "var(--dt-colors-text-neutral-subdued, #b1b2d2)", marginBottom: 16, display: "block" }}>
                    Most frequent failed HTTP requests last month
                  </Text>
                  {cmTopRequestErrorsLoading ? (
                    <Flex justifyContent="center" alignItems="center" style={{ minHeight: 80 }}><ProgressCircle /></Flex>
                  ) : cmTopRequestErrorRows.length > 0 ? (
                    <TopErrorsTable
                      columns={TOP_REQUEST_ERROR_COLUMNS}
                      rows={cmTopRequestErrorRows as unknown as Record<string, string | number | null>[]}
                    />
                  ) : (
                    <Text>No request errors found.</Text>
                  )}
                </Surface>
              </Flex>
            </Flex>
          )}
        </Tab>
      </Tabs>

      {!isLimited && (
        <AnalystNotesPanel
          value={notesByTab[activeTab] ?? ""}
          onChange={(v) => setNotesByTab((prev) => ({ ...prev, [activeTab]: v }))}
          onGeneratingChange={setIsGenerating}
          context={activeTab === 0 ? analystNotesContext : activeTab === 1 ? cmNotesContext : undefined}
        />
      )}

      {/* Off-screen PDF layout — always rendered when data is available so html2canvas can capture it */}
      {hasData && selectedFrontend && (
        <>
          <PdfLayout
            ref={pdfLayoutRef}
            frontendName={selectedFrontend}
            environmentName={environmentName}
            month={new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            analystNotes={notesForExport}
            kpis={[
              { label: "Sessions", value: kpiSessions.toLocaleString(), change: prior ? pctChange(kpiSessions, prior.Sessions ?? 0) : null, color: COLORS.sessions },
              { label: "User Actions", value: kpiUserActions.toLocaleString(), change: prior ? pctChange(kpiUserActions, prior["User Actions"] ?? 0) : null, color: COLORS.userActions },
              { label: "Page Loads", value: kpiPageLoads.toLocaleString(), change: prior ? pctChange(kpiPageLoads, prior["Page Loads"] ?? 0) : null, color: COLORS.pageLoads },
              { label: "LCP p75", value: formatLcp(kpiLcp), change: priorVitals ? pctChange(kpiLcp, priorVitals["Largest Contentful Paint"] ?? 0) : null, color: COLORS.lcp, lowerIsBetter: true },
            ] satisfies KpiTile[]}
            userTrafficData={chartData}
            vitalsData={vitalsChartData}
            cwvWeeklyData={cwvWeeklyChartData}
            browserPerfData={browserPerfChartData}
            browserPerfLatestMonth={browserPerfLatestMonth}
          />

          <PdfLayout3Page
            ref={pdfLayout3PageRef}
            frontendName={selectedFrontend}
            environmentName={environmentName}
            month={new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            analystNotes={notesForExport}
            kpis={[
              { label: "Sessions", value: kpiSessions.toLocaleString(), change: prior ? pctChange(kpiSessions, prior.Sessions ?? 0) : null, color: COLORS.sessions },
              { label: "User Actions", value: kpiUserActions.toLocaleString(), change: prior ? pctChange(kpiUserActions, prior["User Actions"] ?? 0) : null, color: COLORS.userActions },
              { label: "Page Loads", value: kpiPageLoads.toLocaleString(), change: prior ? pctChange(kpiPageLoads, prior["Page Loads"] ?? 0) : null, color: COLORS.pageLoads },
              { label: "LCP p75", value: formatLcp(kpiLcp), change: priorVitals ? pctChange(kpiLcp, priorVitals["Largest Contentful Paint"] ?? 0) : null, color: COLORS.lcp, lowerIsBetter: true },
            ] satisfies KpiTile[]}
            userTrafficData={chartData}
            vitalsData={vitalsChartData}
            cwvWeeklyData={cwvWeeklyChartData}
            browserPerfData={browserPerfChartData}
            browserPerfLatestMonth={browserPerfLatestMonth}
          />
        </>
      )}

      {!isLimited && <Drawer
        isDismissed={!settingsOpen}
        onDismiss={() => setSettingsOpen(false)}
        placement="right"
        width="20vw"
        modal={false}
      >
        <Flex flexDirection="column" gap={24} padding={24}>
          <Flex alignItems="center" justifyContent="space-between">
            <Heading level={5} style={{ marginTop: 0, marginBottom: 0 }}>Settings</Heading>
            <Button variant="default" onClick={() => setSettingsOpen(false)}>✕</Button>
          </Flex>

          <div>
            <Heading level={6} style={{ marginBottom: 12, marginTop: 0 }}>Visible Charts</Heading>
            <Flex flexDirection="column" gap={8}>
              {(
                [
                  ["kpiCards", "KPI Summary Cards"],
                  ["userTraffic", "User Traffic"],
                  ["coreWebVitals", "Core Web Vitals"],
                  ["deviceDistribution", "Device Distribution"],
                  ["browserPerformance", "Browser Performance"],
                ] as [keyof ChartVisibility, string][]
              ).map(([key, label]) => (
                <Flex key={key} alignItems="center" gap={8}>
                  <Checkbox
                    value={chartVisibility[key]}
                    onChange={() => toggleChart(key)}
                  />
                  <span style={{ fontSize: "0.875rem" }}>{label}</span>
                </Flex>
              ))}
            </Flex>
          </div>

          <div>
            <Heading level={6} style={{ marginBottom: 8, marginTop: 0 }}>Missing Data</Heading>
            <hr style={{ border: "none", borderTop: "1px solid var(--dt-colors-border-neutral-default, rgba(255,255,255,0.1))", margin: "0 0 12px 0" }} />
            <Flex flexDirection="column" gap={16}>
              {MISSING_DATA_NOTES.map(({ metric, reason }) => (
                <div key={metric}>
                  <Text style={{ fontWeight: 600, display: "block", marginBottom: 4 }}>{metric}</Text>
                  <Text style={{ color: "#9a9bed", fontSize: "0.875rem" }}>{reason}</Text>
                </div>
              ))}
            </Flex>
          </div>
        </Flex>
      </Drawer>}
    </Flex>
  );
};
