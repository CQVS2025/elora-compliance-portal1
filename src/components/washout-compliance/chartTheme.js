/**
 * Recharts tooltip styles using CSS variables so tooltips respect light/dark mode.
 * Use for all Washout Compliance charts (Dashboard, Economics, etc.).
 */
export const CHART_TOOLTIP_STYLES = {
  contentStyle: {
    background: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '8px',
    padding: '8px 12px',
    boxShadow: '0 4px 12px hsl(var(--foreground) / 0.08)',
  },
  labelStyle: {
    color: 'hsl(var(--foreground))',
    marginBottom: '4px',
  },
  itemStyle: {
    color: 'hsl(var(--foreground))',
  },
  wrapperStyle: {
    outline: 'none',
  },
};
