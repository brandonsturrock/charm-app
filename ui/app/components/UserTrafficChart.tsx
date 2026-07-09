import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import { Text } from "@dynatrace/strato-components/typography";
import { Flex } from "@dynatrace/strato-components/layouts";

export interface UserTrafficDataPoint {
  month: string;
  year: string;
  sessions: number;
  userActions: number;
  pageLoads: number;
  pctDesktop: number;
  pctMobile: number;
}

interface PanelConfig {
  key: keyof Omit<UserTrafficDataPoint, "month" | "year" | "pctDesktop" | "pctMobile">;
  label: string;
  color: string;
  formatLabel: (v: number) => string;
  formatTooltip: (v: number) => string;
}

function abbrev(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return v.toFixed(1);
}

const PANELS: PanelConfig[] = [
  {
    key: "sessions",
    label: "Sessions",
    color: "#7B61FF",
    formatLabel: abbrev,
    formatTooltip: (v) => v.toLocaleString(),
  },
  {
    key: "userActions",
    label: "User Actions",
    color: "#00A98F",
    formatLabel: abbrev,
    formatTooltip: (v) => v.toLocaleString(),
  },
  {
    key: "pageLoads",
    label: "Page Loads",
    color: "#1D8AB7",
    formatLabel: abbrev,
    formatTooltip: (v) => v.toLocaleString(),
  },
];

const DESKTOP_COLOR = "#7B61FF";
const MOBILE_COLOR = "#00A98F";

function pctColor(pct: number, lowerIsBetter: boolean): string {
  if (pct === 0) return "var(--dt-colors-text-neutral-subdued, #b1b2d2)";
  const good = lowerIsBetter ? pct < 0 : pct > 0;
  return good
    ? "var(--dt-colors-text-success-default, #6fc3ba)"
    : "var(--dt-colors-text-critical-default, #ff999c)";
}

const TOKEN = {
  textSubtle: "var(--dt-colors-text-neutral-subdued, #b1b2d2)",
  textDefault: "var(--dt-colors-text-neutral-default, rgba(255,255,255,0.85))",
  borderDefault: "var(--dt-colors-border-neutral-default, rgba(255,255,255,0.1))",
  surfaceDefault: "var(--dt-colors-background-surface-default, #1c1e2e)",
  containerSubdued: "var(--dt-colors-background-container-neutral-subdued, rgba(255,255,255,0.04))",
  shadowFloating: "var(--dt-box-shadows-surface-floating-rest, 0 4px 16px rgba(0,0,0,0.35))",
  radiusSubdued: "var(--dt-borders-radius-surface-subdued, 9px)",
  font: "var(--dt-typography-text-small-default-family, DynatraceFlow, Roboto, Helvetica, sans-serif)",
};

const BAR_HEIGHT = 18;
const ROW_HEIGHT = 28;
const HEADER_HEIGHT = 34;
const AXIS_HEIGHT = 4;
const MONTH_LABEL_WIDTH = 72;
const PANEL_RIGHT_MARGIN = 0;
const SPLIT_PANEL_RIGHT_MARGIN = 0;

// ── Metric panel tooltip ──────────────────────────────────────────────────────
const PanelTooltip = ({
  active,
  payload,
  label,
  panel,
  data,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  panel: PanelConfig;
  data: UserTrafficDataPoint[];
}) => {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  const idx = data.findIndex((d) => d.month === label);
  const prev = idx > 0 ? (data[idx - 1][panel.key] as number) : null;
  const pct = prev !== null && prev !== 0 ? ((val - prev) / prev) * 100 : null;
  return (
    <div style={{ boxSizing: "border-box", padding: "4px", borderRadius: TOKEN.radiusSubdued, background: TOKEN.surfaceDefault, boxShadow: TOKEN.shadowFloating, minWidth: 120, pointerEvents: "none", fontFamily: TOKEN.font }}>
      <div style={{ padding: "4px 6px", color: TOKEN.textSubtle, fontSize: 12, fontWeight: 500 }}>{label}</div>
      <div style={{ padding: "4px 6px", display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
        <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: panel.color, flexShrink: 0 }} />
        <span style={{ fontWeight: 700, color: TOKEN.textDefault }}>{panel.formatTooltip(val)}</span>
      </div>
      {pct !== null && (
        <div style={{ padding: "2px 6px 4px", color: pctColor(pct, false), fontSize: 11 }}>
          {pct >= 0 ? "+" : ""}{pct.toFixed(1)}% vs prior month
        </div>
      )}
    </div>
  );
};

// ── Device split tooltip ──────────────────────────────────────────────────────
const DeviceSplitTooltip = ({
  active,
  payload,
  label,
  data,
}: {
  active?: boolean;
  payload?: { value: number; dataKey: string }[];
  label?: string;
  data: UserTrafficDataPoint[];
}) => {
  if (!active || !payload?.length) return null;
  const idx = data.findIndex((d) => d.month === label);
  const cur = data[idx];
  const prev = idx > 0 ? data[idx - 1] : null;
  const dPct = prev && prev.pctDesktop !== 0 ? ((cur.pctDesktop - prev.pctDesktop) / prev.pctDesktop) * 100 : null;
  const mPct = prev && prev.pctMobile !== 0 ? ((cur.pctMobile - prev.pctMobile) / prev.pctMobile) * 100 : null;

  const row = (color: string, label: string, val: number, chg: number | null) => (
    <div style={{ padding: "4px 6px", display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
      <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
      <span style={{ color: TOKEN.textSubtle, fontSize: 11 }}>{label}</span>
      <span style={{ fontWeight: 700, color: TOKEN.textDefault, marginLeft: "auto" }}>{val.toFixed(1)}%</span>
      {chg !== null && (
        <span style={{ color: TOKEN.textSubtle, fontSize: 11 }}>
          ({chg >= 0 ? "+" : ""}{chg.toFixed(1)}%)
        </span>
      )}

    </div>
  );

  return (
    <div style={{ boxSizing: "border-box", padding: "4px", borderRadius: TOKEN.radiusSubdued, background: TOKEN.surfaceDefault, boxShadow: TOKEN.shadowFloating, minWidth: 160, pointerEvents: "none", fontFamily: TOKEN.font }}>
      <div style={{ padding: "4px 6px", color: TOKEN.textSubtle, fontSize: 12, fontWeight: 500 }}>{label}</div>
      {row(DESKTOP_COLOR, "Desktop", cur.pctDesktop, dPct)}
      {row(MOBILE_COLOR, "Mobile", cur.pctMobile, mPct)}
    </div>
  );
};

// ── Single metric panel ───────────────────────────────────────────────────────
interface MetricPanelProps {
  data: UserTrafficDataPoint[];
  panel: PanelConfig;
  showYAxis: boolean;
  height: number;
  latestMonth: string;
  rowHeight?: number;
  barHeight?: number;
  fontScale?: number;
}

const MetricPanel: React.FC<MetricPanelProps> = ({ data, panel, showYAxis, height, latestMonth, rowHeight = ROW_HEIGHT, barHeight = BAR_HEIGHT, fontScale = 1 }) => {
  const maxVal = Math.max(...data.map((d) => d[panel.key] as number));
  const domain: [number, number] = [0, maxVal * 1.45];
  const gap = `${Math.round(((rowHeight - barHeight) / rowHeight) * 100)}%`;
  const headerSz = Math.round(12 * fontScale);
  const tickSz = Math.round(12 * fontScale);
  const labelSz = Math.round(11 * fontScale);
  const monthLabelW = Math.round(MONTH_LABEL_WIDTH * fontScale);
  const rightMargin = Math.round(PANEL_RIGHT_MARGIN * fontScale);
  const chrome = (showYAxis ? monthLabelW : 0) + rightMargin;

  return (
    <div style={{ flex: `1 1 ${chrome}px`, minWidth: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ height: HEADER_HEIGHT, display: "flex", alignItems: "center", paddingLeft: showYAxis ? monthLabelW : 0, borderBottom: `1px solid ${TOKEN.borderDefault}` }}>
        <Text style={{ margin: 0, color: TOKEN.textSubtle, fontSize: headerSz, fontWeight: 600 }}>{panel.label}</Text>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: rightMargin, left: 0, bottom: 0 }} barSize={barHeight} barCategoryGap={gap}>
          {showYAxis && <CartesianGrid horizontal={false} verticalPoints={[monthLabelW]} stroke={TOKEN.borderDefault} strokeOpacity={1} strokeWidth={1.5} />}
          <XAxis type="number" domain={domain} tick={false} axisLine={false} tickLine={false} height={AXIS_HEIGHT} />
          <YAxis type="category" dataKey="month" hide={!showYAxis} width={showYAxis ? monthLabelW : 0} tick={{ fill: TOKEN.textDefault, fontFamily: TOKEN.font, fontSize: tickSz }} axisLine={false} tickLine={false} />
          <Tooltip content={<PanelTooltip panel={panel} data={data} />} cursor={{ fill: TOKEN.containerSubdued }} wrapperStyle={{ zIndex: 9999 }} />
          <Bar dataKey={panel.key} radius={[0, 3, 3, 0]} isAnimationActive={false}>
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.month === latestMonth ? panel.color : `${panel.color}77`} />
            ))}
            <LabelList dataKey={panel.key} position="right" formatter={panel.formatLabel} style={{ fontSize: labelSz, fontWeight: 600, fill: TOKEN.textSubtle, fontFamily: TOKEN.font }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// ── Device split panel ────────────────────────────────────────────────────────
interface DeviceSplitPanelProps {
  data: UserTrafficDataPoint[];
  height: number;
  latestMonth: string;
  rowHeight?: number;
  barHeight?: number;
  fontScale?: number;
}

const DeviceSplitPanel: React.FC<DeviceSplitPanelProps> = ({ data, height, latestMonth, rowHeight = ROW_HEIGHT, barHeight = BAR_HEIGHT, fontScale = 1 }) => {
  const gap = `${Math.round(((rowHeight - barHeight) / rowHeight) * 100)}%`;
  const headerSz = Math.round(12 * fontScale);
  const labelSz = Math.round(11 * fontScale);
  const splitRightMargin = Math.round(SPLIT_PANEL_RIGHT_MARGIN * fontScale);
  const centerLabel = (key: "pctDesktop" | "pctMobile") => (props: unknown) => {
    const { x, y, width, height: h, index } = props as { x: number; y: number; width: number; height: number; index: number };
    const d = data[index];
    if (!d || d[key] < 10) return null;
    return (
      <text x={x + width / 2} y={y + h / 2} dy="0.35em" textAnchor="middle" fontSize={labelSz} fontWeight={700} fill="#fff" fontFamily={TOKEN.font}>
        {Math.round(d[key])}%
      </text>
    );
  };
  return (
  <div style={{ flex: `1 1 ${splitRightMargin}px`, minWidth: 0, display: "flex", flexDirection: "column" }}>
    <div style={{ height: HEADER_HEIGHT, display: "flex", alignItems: "center", paddingLeft: 0, borderBottom: `1px solid ${TOKEN.borderDefault}` }}>
      <Text style={{ margin: 0, color: TOKEN.textSubtle, fontSize: headerSz, fontWeight: 600 }}>Device Split</Text>
    </div>
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: splitRightMargin, left: 0, bottom: 0 }} barSize={barHeight} barCategoryGap={gap}>
        <XAxis type="number" domain={[0, 100]} tick={false} axisLine={false} tickLine={false} height={AXIS_HEIGHT} />
        <YAxis type="category" dataKey="month" hide width={0} axisLine={false} tickLine={false} />
        <Tooltip content={<DeviceSplitTooltip data={data} />} cursor={{ fill: TOKEN.containerSubdued }} wrapperStyle={{ zIndex: 9999 }} />
        <Bar dataKey="pctDesktop" stackId="split" fill={DESKTOP_COLOR} isAnimationActive={false}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.month === latestMonth ? DESKTOP_COLOR : `${DESKTOP_COLOR}77`} />
          ))}
          <LabelList dataKey="pctDesktop" content={centerLabel("pctDesktop")} />
        </Bar>
        <Bar dataKey="pctMobile" stackId="split" radius={[0, 3, 3, 0]} isAnimationActive={false}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.month === latestMonth ? MOBILE_COLOR : `${MOBILE_COLOR}77`} />
          ))}
          <LabelList dataKey="pctMobile" content={centerLabel("pctMobile")} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>
  );
};

// ── Root component ────────────────────────────────────────────────────────────
interface UserTrafficChartProps {
  data: UserTrafficDataPoint[];
  rowHeight?: number;
  barHeight?: number;
  fontScale?: number;
}

export const UserTrafficChart: React.FC<UserTrafficChartProps> = ({ data, rowHeight = ROW_HEIGHT, barHeight = BAR_HEIGHT, fontScale }) => {
  const chartHeight = data.length * rowHeight;
  const latestMonth = data[data.length - 1]?.month ?? "";

  return (
    <Flex width="100%" alignItems="flex-start" style={{ userSelect: "none" }} className="dt-chart-nofocus">
      <div style={{ flex: 1, display: "flex", minWidth: 0, borderLeft: `1.5px solid ${TOKEN.borderDefault}`, borderRight: `1.5px solid ${TOKEN.borderDefault}` }}>
        {PANELS.map((panel, i) => (
          <MetricPanel key={panel.key} data={data} panel={panel} showYAxis={i === 0} height={chartHeight + AXIS_HEIGHT} latestMonth={latestMonth} rowHeight={rowHeight} barHeight={barHeight} fontScale={fontScale} />
        ))}
        <DeviceSplitPanel data={data} height={chartHeight + AXIS_HEIGHT} latestMonth={latestMonth} rowHeight={rowHeight} barHeight={barHeight} fontScale={fontScale} />
      </div>
    </Flex>
  );
};
