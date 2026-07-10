import React from "react";

const FONT = "'DT Flow', 'Helvetica Neue', Arial, sans-serif";
const TOKEN = {
  textSubtle: "rgba(255,255,255,0.4)",
  textDefault: "rgba(255,255,255,0.9)",
  border: "rgba(255,255,255,0.08)",
  rowHover: "rgba(255,255,255,0.03)",
};

export interface TopErrorColumn {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  width?: string | number;
  render?: (value: string | number | null) => React.ReactNode;
}

export interface TopErrorsTableProps {
  columns: TopErrorColumn[];
  rows: Record<string, string | number | null>[];
}

const statusColor = (code: number | null) => {
  if (code == null) return TOKEN.textDefault;
  if (code >= 500) return "#E8345A";
  if (code >= 400) return "#F5A623";
  return TOKEN.textDefault;
};

export const statusCodeRenderer = (v: string | number | null) => (
  <span style={{ color: statusColor(typeof v === "number" ? v : null), fontWeight: 600 }}>
    {v ?? "—"}
  </span>
);

export const TopErrorsTable: React.FC<TopErrorsTableProps> = ({ columns, rows }) => {
  if (rows.length === 0) return null;

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: FONT }}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  textAlign: col.align ?? "left",
                  padding: "6px 12px 8px",
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: TOKEN.textSubtle,
                  borderBottom: `1px solid ${TOKEN.border}`,
                  whiteSpace: "nowrap",
                  width: col.width,
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              style={{ borderBottom: `1px solid ${TOKEN.border}` }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = TOKEN.rowHover; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ""; }}
            >
              {columns.map((col) => {
                const val = row[col.key] ?? null;
                return (
                  <td
                    key={col.key}
                    style={{
                      padding: "8px 12px",
                      textAlign: col.align ?? "left",
                      color: TOKEN.textDefault,
                      maxWidth: col.width ?? 300,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={val != null ? String(val) : undefined}
                  >
                    {col.render ? col.render(val) : (val != null ? String(val) : "—")}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
