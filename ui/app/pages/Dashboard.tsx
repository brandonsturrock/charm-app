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
import { AnalystNotesPanel, type AnalystNotesPanelHandle, type AnalystNotesContext } from "../components/AnalystNotesPanel";
import { exportDashboardPdf, exportDashboard3PagePdf } from "../utils/pdfExport";

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

const buildLastMonthMetricsQuery = (frontendName: string) => `timeseries {
    x=countDistinct(dt.frontend.session.active.estimated_count),
    y = count(dt.frontend.user_action.count),
    z = percentile(dt.frontend.web.page.largest_contentful_paint, 75),
    z2 = count(dt.frontend.web.page.largest_contentful_paint),
    t=start()
  }, from: now()-1M@M, to: now()@M, interval: 1d, filter: frontend.name == "${dqlEscape(frontendName)}", by:device.type
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

const buildLastMonthWebVitalsQuery = (frontendName: string) => `timeseries {
    x=countDistinct(dt.frontend.session.active.estimated_count),
    lcp = percentile(dt.frontend.web.page.largest_contentful_paint, 75),
    lcp2 = count(dt.frontend.web.page.largest_contentful_paint),
    inp = percentile(dt.frontend.web.page.interaction_to_next_paint, 75),
    inp2 = count(dt.frontend.web.page.interaction_to_next_paint),
    cls = percentile(dt.frontend.web.page.cumulative_layout_shift, 75),
    cls2 = count(dt.frontend.web.page.cumulative_layout_shift),
    t=start()
  }, from: now()-1M@M, to: now()@M, interval: 1d, filter: frontend.name == "${dqlEscape(frontendName)}"
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

const buildLastMonthBrowserPerfQuery = (frontendName: string) => `timeseries {
    sessions=countDistinct(dt.frontend.session.active.estimated_count),
    lcp = percentile(dt.frontend.web.page.largest_contentful_paint, 75),
    lcp2 = count(dt.frontend.web.page.largest_contentful_paint),
    inp = percentile(dt.frontend.web.page.interaction_to_next_paint, 75),
    inp2 = count(dt.frontend.web.page.interaction_to_next_paint),
    cls = percentile(dt.frontend.web.page.cumulative_layout_shift, 75),
    cls2 = count(dt.frontend.web.page.cumulative_layout_shift),
    t=start()
  }, from: now()-1M@M, to: now()@M, interval: 1d, filter: frontend.name == "${dqlEscape(frontendName)}", by: {device.type, browser.name}
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

const buildLastMonthDeviceDistQuery = (frontendName: string) => `timeseries {
    sessions=countDistinct(dt.frontend.session.active.estimated_count),
    t=start()
  }, from: now()-1M@M, to: now()@M, interval: 1d, filter: frontend.name == "${dqlEscape(frontendName)}", by: {device.type}
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

const COLORS = {
  sessions: "#7B61FF",
  userActions: "#00A98F",
  pageLoads: "#1D8AB7",
  lcp: "#F5A623",
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

export const Dashboard = ({ isLimited = false }: { isLimited?: boolean }) => {
  const [selectedFrontend, setSelectedFrontend] = useState<string | null>(null);
  const [activeQuery, setActiveQuery] = useState<string | null>(null);
  const [activeVitalsQuery, setActiveVitalsQuery] = useState<string | null>(null);
  const [activeBrowserPerfQuery, setActiveBrowserPerfQuery] = useState<string | null>(null);
  const [activeDeviceDistQuery, setActiveDeviceDistQuery] = useState<string | null>(null);
  const [activeCwvWeeklyQuery, setActiveCwvWeeklyQuery] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [activeLmMetricsQuery, setActiveLmMetricsQuery] = useState<string | null>(null);
  const [activeLmVitalsQuery, setActiveLmVitalsQuery] = useState<string | null>(null);
  const [activeLmBrowserPerfQuery, setActiveLmBrowserPerfQuery] = useState<string | null>(null);
  const [activeLmDeviceDistQuery, setActiveLmDeviceDistQuery] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isExporting3Page, setIsExporting3Page] = useState(false);
  const [notesForExport, setNotesForExport] = useState("");
  const analystNotesPanelRef = useRef<AnalystNotesPanelHandle>(null);
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

  const { data: lmMetricsData, isLoading: lmMetricsLoading } = useDql(
    { query: activeLmMetricsQuery! },
    { enabled: !!activeLmMetricsQuery }
  );

  const { data: lmVitalsData, isLoading: lmVitalsLoading } = useDql(
    { query: activeLmVitalsQuery! },
    { enabled: !!activeLmVitalsQuery }
  );

  const { data: lmBrowserPerfData, isLoading: lmBrowserPerfLoading } = useDql(
    { query: activeLmBrowserPerfQuery! },
    { enabled: !!activeLmBrowserPerfQuery }
  );

  const { data: lmDeviceDistData } = useDql(
    { query: activeLmDeviceDistQuery! },
    { enabled: !!activeLmDeviceDistQuery }
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

  const lmRecords: MonthlyRecord[] = useMemo(
    () => (lmMetricsData?.records ?? []) as unknown as MonthlyRecord[],
    [lmMetricsData]
  );

  const lmVitalsRecords: WebVitalsRecord[] = useMemo(
    () => (lmVitalsData?.records ?? []) as unknown as WebVitalsRecord[],
    [lmVitalsData]
  );

  const lmBrowserPerfRecords: BrowserPerfRecord[] = useMemo(
    () => (lmBrowserPerfData?.records ?? []) as unknown as BrowserPerfRecord[],
    [lmBrowserPerfData]
  );

  const lmBrowserPerfChartData: BrowserPerfDataPoint[] = useMemo(
    () =>
      lmBrowserPerfRecords.map((r) => {
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
    [lmBrowserPerfRecords]
  );

  const lmBrowserPerfLatestMonth = useMemo(() => {
    if (lmBrowserPerfRecords.length === 0) return "";
    const maxRaw = lmBrowserPerfRecords.reduce<number | null>((best, r) => {
      const t = typeof r.month === "number" ? r.month : r.month ? new Date(r.month as string).getTime() : null;
      if (t === null) return best;
      return best === null || t > best ? t : best;
    }, null);
    if (maxRaw === null) return "";
    return formatMonthLabel(new Date(maxRaw));
  }, [lmBrowserPerfRecords]);

  const lmLast = lmRecords[lmRecords.length - 1];
  const lmLastVitals = lmVitalsRecords[lmVitalsRecords.length - 1];

  const handleFrontendChange = useCallback((value: string | null) => {
    setSelectedFrontend(value);
    setActiveQuery(value ? buildMetricsQuery(value) : null);
    setActiveVitalsQuery(value ? buildWebVitalsQuery(value) : null);
    setActiveBrowserPerfQuery(value ? buildBrowserPerfQuery(value) : null);
    setActiveDeviceDistQuery(value ? buildDeviceDistQuery(value) : null);
    setActiveCwvWeeklyQuery(value ? buildCwvWeeklyQuery(value) : null);
    setActiveLmMetricsQuery(value ? buildLastMonthMetricsQuery(value) : null);
    setActiveLmVitalsQuery(value ? buildLastMonthWebVitalsQuery(value) : null);
    setActiveLmBrowserPerfQuery(value ? buildLastMonthBrowserPerfQuery(value) : null);
    setActiveLmDeviceDistQuery(value ? buildLastMonthDeviceDistQuery(value) : null);
  }, []);


  const handleExport = () => {
    if (!pdfLayoutRef.current || !selectedFrontend || isExporting) return;
    setIsExporting(true);
    setNotesForExport(analystNotesPanelRef.current?.getValue() ?? "");
    setTimeout(() => {
      exportDashboardPdf(pdfLayoutRef.current!, selectedFrontend).finally(() => {
        setIsExporting(false);
      });
    }, 0);
  };

  const handleExport3Page = () => {
    if (!pdfLayout3PageRef.current || !selectedFrontend || isExporting3Page) return;
    setIsExporting3Page(true);
    setNotesForExport(analystNotesPanelRef.current?.getValue() ?? "");
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

      <Tabs selectedIndex={activeTab} onChange={setActiveTab}>
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
                  icon="◉"
                />
                <KpiCard
                  label="User Actions"
                  value={kpiUserActions.toLocaleString()}
                  change={prior ? pctChange(kpiUserActions, prior["User Actions"] ?? 0) : null}
                  color={COLORS.userActions}
                  icon="▶"
                />
                <KpiCard
                  label="Page Loads"
                  value={kpiPageLoads.toLocaleString()}
                  change={prior ? pctChange(kpiPageLoads, prior["Page Loads"] ?? 0) : null}
                  color={COLORS.pageLoads}
                  icon="⊞"
                />
                <KpiCard
                  label="LCP p75"
                  value={formatLcp(kpiLcp)}
                  change={priorVitals ? pctChange(kpiLcp, priorVitals["Largest Contentful Paint"] ?? 0) : null}
                  color={COLORS.lcp}
                  icon="⏱"
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
          {(lmMetricsLoading || lmVitalsLoading) ? (
            <Flex justifyContent="center" alignItems="center" style={{ minHeight: 400 }}>
              <ProgressCircle />
            </Flex>
          ) : !selectedFrontend ? (
            <Surface elevation="raised" padding={40}>
              <Flex justifyContent="center" alignItems="center" style={{ minHeight: 300 }}>
                <Text>Select a frontend to view last month's metrics.</Text>
              </Flex>
            </Surface>
          ) : !lmLast ? (
            <Surface elevation="raised" padding={40}>
              <Flex justifyContent="center" alignItems="center" style={{ minHeight: 300 }}>
                <Text>No data found for last month.</Text>
              </Flex>
            </Surface>
          ) : (
            <Flex flexDirection="column" gap={16}>
              {/* Last Month KPI Summary */}
              <Flex gap={16}>
                <KpiCard
                  label="Sessions"
                  value={(lmLast?.Sessions ?? 0).toLocaleString()}
                  change={null}
                  color={COLORS.sessions}
                  icon="◉"
                />
                <KpiCard
                  label="User Actions"
                  value={(lmLast?.["User Actions"] ?? 0).toLocaleString()}
                  change={null}
                  color={COLORS.userActions}
                  icon="▶"
                />
                <KpiCard
                  label="Page Loads"
                  value={(lmLast?.["Page Loads"] ?? 0).toLocaleString()}
                  change={null}
                  color={COLORS.pageLoads}
                  icon="⊞"
                />
                <KpiCard
                  label="LCP p75"
                  value={formatLcp(lmLastVitals?.["Largest Contentful Paint"] ?? 0)}
                  change={null}
                  color={COLORS.lcp}
                  icon="⏱"
                  lowerIsBetter
                />
              </Flex>

              {/* Last Month Web Vitals */}
              <Flex gap={16} alignItems="flex-start">
                <Surface elevation="raised" padding={24} style={{ flex: 1, minWidth: 0 }}>
                  <Heading level={5} style={{ marginBottom: 16, marginTop: 0 }}>Core Web Vitals</Heading>
                  {lmVitalsRecords.length > 0 ? (
                    <CoreWebVitalsChart data={lmVitalsRecords.map((r) => {
                      const d = parseMonth(r.month);
                      return {
                        month: d ? formatMonthLabel(d) : "",
                        year: d ? formatYear(d) : "",
                        lcp: r["Largest Contentful Paint"] ?? 0,
                        inp: r["Interaction to Next Paint"] ?? 0,
                        cls: r["Cumulative Layout Shift"] ?? 0,
                      };
                    })} />
                  ) : (
                    <Text>No web vitals data available.</Text>
                  )}
                </Surface>
              </Flex>

              {/* Last Month Browser Performance */}
              <Surface elevation="raised" padding={24}>
                <Heading level={5} style={{ marginBottom: 16, marginTop: 0 }}>Browser Performance</Heading>
                {lmBrowserPerfLoading ? (
                  <Flex justifyContent="center" alignItems="center" style={{ minHeight: 120 }}>
                    <ProgressCircle />
                  </Flex>
                ) : lmBrowserPerfChartData.length > 0 ? (
                  <BrowserPerformanceChart data={lmBrowserPerfChartData} latestMonth={lmBrowserPerfLatestMonth} />
                ) : (
                  <Text>No browser performance data available.</Text>
                )}
              </Surface>
            </Flex>
          )}
        </Tab>
      </Tabs>

      {!isLimited && <AnalystNotesPanel ref={analystNotesPanelRef} context={analystNotesContext} />}

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
