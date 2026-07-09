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

export interface WebVitalsDataPoint {
  month: string;
  year: string;
  lcp: number;
  inp: number;
  cls: number;
}

// Thresholds in raw metric units (ms for LCP/INP, unitless for CLS)
const THRESHOLDS = {
  lcp: { good: 2500, poor: 4000 },
  inp: { good: 200, poor: 500 },
  cls: { good: 1000, poor: 2500 },
};

const STATUS_COLOR = {
  good: "#2ECC85",
  warn: "#F5A623",
  poor: "#E8345A",
};

function vitalColor(value: number, thresholds: { good: number; poor: number }): string {
  if (value <= thresholds.good) return STATUS_COLOR.good;
  if (value <= thresholds.poor) return STATUS_COLOR.warn;
  return STATUS_COLOR.poor;
}

interface PanelConfig {
  key: keyof Omit<WebVitalsDataPoint, "month" | "year">;
  label: string;
  shortLabel: string;
  thresholds: { good: number; poor: number };
  formatLabel: (v: number) => string;
  formatTooltip: (v: number) => string;
  formatTick: (v: number) => string;
}

function formatMs(v: number): string {
  return v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${v.toFixed(0)}ms`;
}

const PANELS: PanelConfig[] = [
  {
    key: "lcp",
    label: "Largest Contentful Paint",
    shortLabel: "LCP",
    thresholds: THRESHOLDS.lcp,
    formatLabel: formatMs,
    formatTooltip: formatMs,
    formatTick: formatMs,
  },
  {
    key: "inp",
    label: "Interaction to Next Paint",
    shortLabel: "INP",
    thresholds: THRESHOLDS.inp,
    formatLabel: formatMs,
    formatTooltip: formatMs,
    formatTick: formatMs,
  },
  {
    key: "cls",
    label: "Cumulative Layout Shift",
    shortLabel: "CLS",
    thresholds: THRESHOLDS.cls,
    formatLabel: (v) => (v * 0.0001).toFixed(2),
    formatTooltip: (v) => (v * 0.0001).toFixed(2),
    formatTick: (v) => (v * 0.0001).toFixed(2),
  },
];

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

function pctColor(pct: number, lowerIsBetter: boolean): string {
  if (pct === 0) return "var(--dt-colors-text-neutral-subdued, #b1b2d2)";
  const good = lowerIsBetter ? pct < 0 : pct > 0;
  return good
    ? "var(--dt-colors-text-success-default, #6fc3ba)"
    : "var(--dt-colors-text-critical-default, #ff999c)";
}

const BAR_HEIGHT = 18;
const ROW_HEIGHT = 28;
const HEADER_HEIGHT = 34;
const AXIS_HEIGHT = 4;
const MONTH_LABEL_WIDTH = 72;
const PANEL_RIGHT_MARGIN = 0;
const CLS_PANEL_RIGHT_MARGIN = 0;

// ── Tooltip ──────────────────────────────────────────────────────────────────
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
  data: WebVitalsDataPoint[];
}) => {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  const color = vitalColor(val, panel.thresholds);
  const idx = data.findIndex((d) => d.month === label);
  const prev = idx > 0 ? (data[idx - 1][panel.key] as number) : null;
  const pct = prev !== null && prev !== 0 ? ((val - prev) / prev) * 100 : null;
  return (
    <div
      style={{
        boxSizing: "border-box",
        padding: "4px",
        borderRadius: TOKEN.radiusSubdued,
        background: TOKEN.surfaceDefault,
        boxShadow: TOKEN.shadowFloating,
        minWidth: 140,
        pointerEvents: "none",
        fontFamily: TOKEN.font,
      }}
    >
      <div style={{ padding: "4px 6px", color: TOKEN.textSubtle, fontSize: 12, fontWeight: 500 }}>
        {label}
      </div>
      <div style={{ padding: "4px 6px", display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
        <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
        <span style={{ fontWeight: 700, color: TOKEN.textDefault }}>{panel.formatTooltip(val)}</span>
      </div>
      {pct !== null && (
        <div style={{ padding: "2px 6px 4px", fontSize: 11, fontFamily: TOKEN.font, color: pctColor(pct, true) }}>
          {pct >= 0 ? "+" : ""}{pct.toFixed(1)}% vs prior month
        </div>
      )}
    </div>
  );
};

// ── Panel ─────────────────────────────────────────────────────────────────────
interface MetricPanelProps {
  data: WebVitalsDataPoint[];
  panel: PanelConfig;
  showYAxis: boolean;
  height: number;
  latestMonth: string;
  shortLabels?: boolean;
  rowHeight?: number;
  barHeight?: number;
  fontScale?: number;
}

const MetricPanel: React.FC<MetricPanelProps> = ({ data, panel, showYAxis, height, latestMonth, shortLabels, rowHeight = ROW_HEIGHT, barHeight = BAR_HEIGHT, fontScale = 1 }) => {
  const maxVal = Math.max(...data.map((d) => d[panel.key]));
  const domain: [number, number] = [0, maxVal * 1.45];
  const gap = `${Math.round(((rowHeight - barHeight) / rowHeight) * 100)}%`;
  const headerSz = Math.round(12 * fontScale);
  const tickSz = Math.round(12 * fontScale);
  const labelSz = Math.round(11 * fontScale);
  const monthLabelW = Math.round(MONTH_LABEL_WIDTH * fontScale);
  const rightMargin = Math.round((panel.key === "cls" ? CLS_PANEL_RIGHT_MARGIN : PANEL_RIGHT_MARGIN) * fontScale);

  return (
    <div style={{ flex: "1 1 0", minWidth: shortLabels ? 90 : 160, display: "flex", flexDirection: "column" }}>
      <div
        style={{
          height: HEADER_HEIGHT,
          display: "flex",
          alignItems: "center",
          paddingLeft: showYAxis ? monthLabelW : 0,
          borderBottom: `1px solid ${TOKEN.borderDefault}`,
        }}
      >
        <Text style={{ margin: 0, color: TOKEN.textSubtle, fontSize: headerSz, fontWeight: 600 }}>
          {shortLabels ? panel.shortLabel : panel.label}
        </Text>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: rightMargin, left: 0, bottom: 0 }}
          barSize={barHeight}
          barCategoryGap={gap}
        >
          {showYAxis && <CartesianGrid horizontal={false} verticalPoints={[monthLabelW]} stroke={TOKEN.borderDefault} strokeOpacity={1} strokeWidth={1.5} />}
          <XAxis
            type="number"
            domain={domain}
            tick={false}
            axisLine={false}
            tickLine={false}
            height={AXIS_HEIGHT}
          />
          <YAxis
            type="category"
            dataKey="month"
            hide={!showYAxis}
            width={showYAxis ? monthLabelW : 0}
            tick={{ fill: TOKEN.textDefault, fontFamily: TOKEN.font, fontSize: tickSz }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={<PanelTooltip panel={panel} data={data} />}
            cursor={{ fill: TOKEN.containerSubdued }}
            wrapperStyle={{ zIndex: 9999 }}
          />
          <Bar
            dataKey={panel.key}
            radius={[0, 3, 3, 0]}
            isAnimationActive={false}
          >
            {data.map((entry, index) => {
              const color = vitalColor(entry[panel.key], panel.thresholds);
              const isLatest = entry.month === latestMonth;
              return (
                <Cell
                  key={index}
                  fill={isLatest ? color : `${color}88`}
                />
              );
            })}
            <LabelList
              dataKey={panel.key}
              position="right"
              formatter={panel.formatLabel}
              style={{ fontSize: labelSz, fontWeight: 600, fill: TOKEN.textSubtle, fontFamily: TOKEN.font }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// ── Root ──────────────────────────────────────────────────────────────────────
interface CoreWebVitalsChartProps {
  data: WebVitalsDataPoint[];
  shortLabels?: boolean;
  rowHeight?: number;
  barHeight?: number;
  fontScale?: number;
}

export const CoreWebVitalsChart: React.FC<CoreWebVitalsChartProps> = ({ data, shortLabels, rowHeight = ROW_HEIGHT, barHeight = BAR_HEIGHT, fontScale }) => {
  const chartHeight = data.length * rowHeight;
  const latestMonth = data[data.length - 1]?.month ?? "";
  return (
    <div style={{ userSelect: "none" }} className="dt-chart-nofocus">
      <Flex width="100%" alignItems="flex-start">
        <div style={{ flex: 1, display: "flex", minWidth: 0, borderLeft: `1.5px solid ${TOKEN.borderDefault}`, borderRight: `1.5px solid ${TOKEN.borderDefault}` }}>
          {PANELS.map((panel, i) => (
            <MetricPanel
              key={panel.key}
              data={data}
              panel={panel}
              showYAxis={i === 0}
              height={chartHeight + AXIS_HEIGHT}
              latestMonth={latestMonth}
              shortLabels={shortLabels}
              rowHeight={rowHeight}
              barHeight={barHeight}
              fontScale={fontScale}
            />
          ))}
        </div>
      </Flex>
    </div>
  );
};
