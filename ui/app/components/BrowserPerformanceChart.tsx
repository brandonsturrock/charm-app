import React, { useMemo } from "react";
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

export interface BrowserPerfDataPoint {
  month: string;
  monthTs: number;
  deviceType: string;
  browserName: string;
  visits: number;
  lcp: number;
  inp: number;
  cls: number;
}

interface Group {
  browserName: string;
  deviceType: string;
  rows: BrowserPerfDataPoint[];
}

const THRESHOLDS = {
  lcp: { good: 2500, poor: 4000 },
  inp: { good: 200, poor: 500 },
  cls: { good: 1000, poor: 2500 },
};

const STATUS_COLOR = { good: "#2ECC85", warn: "#F5A623", poor: "#E8345A" };

function vitalColor(value: number, thresholds: { good: number; poor: number }): string {
  if (value <= thresholds.good) return STATUS_COLOR.good;
  if (value <= thresholds.poor) return STATUS_COLOR.warn;
  return STATUS_COLOR.poor;
}

function formatMs(v: number): string {
  return v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${v.toFixed(0)}ms`;
}

function abbrev(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return v.toFixed(1);
}

interface PanelConfig {
  key: keyof Omit<BrowserPerfDataPoint, "month" | "monthTs" | "deviceType" | "browserName">;
  label: string;
  shortLabel: string;
  color?: string;
  isVital?: boolean;
  thresholds?: { good: number; poor: number };
  formatLabel: (v: number) => string;
  formatTooltip: (v: number) => string;
}

const PANELS: PanelConfig[] = [
  {
    key: "visits",
    label: "Visits",
    shortLabel: "Visits",
    color: "#7B61FF",
    formatLabel: abbrev,
    formatTooltip: (v) => v.toLocaleString(),
  },
  {
    key: "lcp",
    label: "Largest Contentful Paint",
    shortLabel: "LCP",
    isVital: true,
    thresholds: THRESHOLDS.lcp,
    formatLabel: formatMs,
    formatTooltip: formatMs,
  },
  {
    key: "inp",
    label: "Interaction to Next Paint",
    shortLabel: "INP",
    isVital: true,
    thresholds: THRESHOLDS.inp,
    formatLabel: formatMs,
    formatTooltip: formatMs,
  },
  {
    key: "cls",
    label: "Cumulative Layout Shift",
    shortLabel: "CLS",
    isVital: true,
    thresholds: THRESHOLDS.cls,
    formatLabel: (v) => (v * 0.0001).toFixed(2),
    formatTooltip: (v) => (v * 0.0001).toFixed(2),
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

const BAR_HEIGHT = 12;
const ROW_HEIGHT = 20;
const HEADER_HEIGHT = 28;
const AXIS_HEIGHT = 4;
const MONTH_LABEL_WIDTH = 72;
const PANEL_RIGHT_MARGIN = 0;
const GROUP_HEADER_HEIGHT = 22;

// ── Tooltip ───────────────────────────────────────────────────────────────────
const PanelTooltip = ({
  active,
  payload,
  label,
  panel,
  rows,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  panel: PanelConfig;
  rows: BrowserPerfDataPoint[];
}) => {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  const barColor =
    panel.isVital && panel.thresholds ? vitalColor(val, panel.thresholds) : panel.color!;
  const idx = rows.findIndex((d) => d.month === label);
  const prev = idx > 0 ? (rows[idx - 1][panel.key] as number) : null;
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
      <div style={{ padding: "4px 6px", color: TOKEN.textSubtle, fontSize: 11, fontWeight: 500 }}>
        {label}
      </div>
      <div style={{ padding: "4px 6px", display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
        <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: barColor, flexShrink: 0 }} />
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

// ── Group section ─────────────────────────────────────────────────────────────
// Each column is a vertical flex container: [header] + [chart]
// This guarantees header and chart share exactly the same width — no offset math.
interface GroupSectionProps {
  group: Group;
  latestMonth: string;
  shortLabels?: boolean;
  rowHeight?: number;
  barHeight?: number;
  fontScale?: number;
}

const GroupSection: React.FC<GroupSectionProps> = ({ group, latestMonth, shortLabels, rowHeight = ROW_HEIGHT, barHeight = BAR_HEIGHT, fontScale = 1 }) => {
  const chartHeight = group.rows.length * rowHeight;
  const gap = `${Math.round(((rowHeight - barHeight) / rowHeight) * 100)}%`;
  const groupHeaderSz = Math.round(11 * fontScale);
  const colHeaderSz = Math.round(11 * fontScale);
  const tickSz = Math.round(11 * fontScale);
  const labelSz = Math.round(11 * fontScale);
  const monthLabelW = Math.round(MONTH_LABEL_WIDTH * fontScale);
  const rightMargin = Math.round(PANEL_RIGHT_MARGIN * fontScale);
  const deviceLabel =
    group.deviceType.charAt(0).toUpperCase() + group.deviceType.slice(1).toLowerCase();

  return (
    <div style={{ border: `1px solid ${TOKEN.borderDefault}`, borderRadius: 6, overflow: "hidden" }}>
      {/* Group name banner */}
      <div
        style={{
          height: GROUP_HEADER_HEIGHT,
          display: "flex",
          alignItems: "center",
          background: TOKEN.containerSubdued,
          borderBottom: `1px solid ${TOKEN.borderDefault}`,
          paddingLeft: 8,
        }}
      >
        <Text style={{ margin: 0, color: TOKEN.textDefault, fontSize: groupHeaderSz, fontWeight: 600 }}>
          {`${group.browserName} · ${deviceLabel}`}
        </Text>
      </div>

      {/* Panel columns: each column owns its header + chart */}
      <div style={{ display: "flex" }}>
        {PANELS.map((panel, i) => {
          const showYAxis = i === 0;
          const maxVal = Math.max(...group.rows.map((d) => d[panel.key] as number), 0);
          const domain: [number, number] = [0, maxVal * 1.45 || 1];

          return (
            <React.Fragment key={panel.key}>
              {i > 0 && (
                <div style={{ width: 1, flexShrink: 0, background: TOKEN.borderDefault }} />
              )}

              {/* Single column: header sits directly above its chart */}
              <div style={{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column" }}>
                {/* Column header */}
                <div
                  style={{
                    height: HEADER_HEIGHT,
                    display: "flex",
                    alignItems: "center",
                    borderBottom: `1px solid ${TOKEN.borderDefault}`,
                    // Offset by Y-axis width on first column so text aligns with bar start
                    paddingLeft: showYAxis ? monthLabelW : 6,
                    overflow: "hidden",
                  }}
                >
                  <Text
                    style={{
                      margin: 0,
                      color: TOKEN.textSubtle,
                      fontSize: colHeaderSz,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {shortLabels ? panel.shortLabel : panel.label}
                  </Text>
                </div>

                {/* Chart */}
                <ResponsiveContainer width="100%" height={chartHeight + AXIS_HEIGHT}>
                  <BarChart
                    data={group.rows}
                    layout="vertical"
                    margin={{ top: 0, right: rightMargin, left: 0, bottom: 0 }}
                    barSize={barHeight}
                    barCategoryGap={gap}
                  >
                    <CartesianGrid horizontal={false} verticalPoints={[showYAxis ? monthLabelW : 0]} stroke={TOKEN.borderDefault} strokeOpacity={1} strokeWidth={1.5} />
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
                      interval={0}
                    />
                    <Tooltip
                      content={<PanelTooltip panel={panel} rows={group.rows} />}
                      cursor={{ fill: TOKEN.containerSubdued }}
                      wrapperStyle={{ zIndex: 9999 }}
                    />
                    <Bar
                      dataKey={panel.key}
                      radius={[0, 3, 3, 0]}
                    >
                      {group.rows.map((entry, idx) => {
                        const val = entry[panel.key] as number;
                        const isLatest = entry.month === latestMonth;
                        const color =
                          panel.isVital && panel.thresholds
                            ? vitalColor(val, panel.thresholds)
                            : panel.color!;
                        return <Cell key={idx} fill={isLatest ? color : `${color}88`} />;
                      })}
                      <LabelList
                        dataKey={panel.key}
                        position="right"
                        formatter={panel.formatLabel}
                        style={{
                          fontSize: labelSz,
                          fontWeight: 600,
                          fill: TOKEN.textSubtle,
                          fontFamily: TOKEN.font,
                        }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

// ── Root ──────────────────────────────────────────────────────────────────────
interface BrowserPerformanceChartProps {
  data: BrowserPerfDataPoint[];
  latestMonth: string;
  groupLimit?: number;
  shortLabels?: boolean;
  columns?: number;
  rowHeight?: number;
  barHeight?: number;
  fontScale?: number;
}

export const BrowserPerformanceChart: React.FC<BrowserPerformanceChartProps> = ({
  data,
  latestMonth,
  groupLimit,
  shortLabels,
  columns = 2,
  rowHeight,
  barHeight,
  fontScale,
}) => {
  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, BrowserPerfDataPoint[]>();
    data.forEach((d) => {
      const key = `${d.browserName}\x00${d.deviceType}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    });
    return Array.from(map.entries())
      .map(([key, rows]) => {
        const sep = key.indexOf("\x00");
        return {
          browserName: key.slice(0, sep),
          deviceType: key.slice(sep + 1),
          rows: [...rows].sort((a, b) => a.monthTs - b.monthTs),
        };
      })
      .sort((a, b) => {
        const visitsForLatest = (g: Group) =>
          g.rows.find((r) => r.month === latestMonth)?.visits ?? 0;
        return visitsForLatest(b) - visitsForLatest(a);
      });
  }, [data]);

  if (groups.length === 0) return null;

  const visibleGroups = groupLimit != null ? groups.slice(0, groupLimit) : groups;

  return (
    <div
      style={{ userSelect: "none", display: "grid", gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 8 }}
      className="dt-chart-nofocus"
    >
      {visibleGroups.map((group) => (
        <GroupSection
          key={`${group.browserName}\x00${group.deviceType}`}
          group={group}
          latestMonth={latestMonth}
          shortLabels={shortLabels}
          rowHeight={rowHeight}
          barHeight={barHeight}
          fontScale={fontScale}
        />
      ))}
    </div>
  );
};
