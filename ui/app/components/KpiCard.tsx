import React from "react";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Heading, Text } from "@dynatrace/strato-components/typography";

interface KpiCardProps {
  label: string;
  value: string;
  change: number | null;
  color: string;
  icon: React.ReactNode;
  lowerIsBetter?: boolean;
}

export const KpiCard: React.FC<KpiCardProps> = ({ label, value, change, color, icon, lowerIsBetter = false }) => {
  const changeText = change === null
    ? null
    : `${change >= 0 ? "+" : ""}${change.toFixed(1)}% vs prior month`;

  const changeColor = change === null
    ? undefined
    : change === 0
    ? "var(--dt-colors-text-neutral-subdued, #b1b2d2)"
    : lowerIsBetter
    ? (change < 0
        ? "var(--dt-colors-text-success-default, #6fc3ba)"
        : "var(--dt-colors-text-critical-default, #ff999c)")
    : (change > 0
        ? "var(--dt-colors-text-success-default, #6fc3ba)"
        : "var(--dt-colors-text-critical-default, #ff999c)");

  return (
    <div
      style={{
        background: "var(--dt-colors-background-surface-default, #1c1e2e)",
        border: "1px solid var(--dt-colors-border-neutral-default, rgba(255,255,255,0.1))",
        borderRadius: "var(--dt-borders-radius-container-default, 8px)",
        padding: "18px 22px",
        flex: "1 1 0",
        minWidth: 160,
        borderTop: `3px solid ${color}`,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        boxShadow: "var(--dt-box-shadows-container-rest, none)",
      }}
    >
      <Flex alignItems="center" gap={6}>
        <span style={{ color, fontSize: 14, lineHeight: 1 }}>{icon}</span>
        <Text
          style={{
            fontSize: 11,
            color: "var(--dt-colors-text-neutral-subdued, #b1b2d2)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            fontWeight: 600,
          }}
        >
          {label}
        </Text>
      </Flex>

      <Heading
        level={3}
        style={{
          margin: 0,
          color: "var(--dt-colors-text-neutral-default, rgba(255,255,255,0.9))",
          fontWeight: 700,
          lineHeight: 1.1,
        }}
      >
        {value}
      </Heading>

      {changeText && (
        <Text style={{ fontSize: 12, color: changeColor }}>
          {changeText}
        </Text>
      )}
    </div>
  );
};
