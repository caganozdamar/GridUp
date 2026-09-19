import { CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface CableCurrentPoint {
  time: string;
  cableTemp: number | null;
  current: number | null;
}

const TOOLTIP_STYLE = {
  background: 'var(--bg-panel-alt)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--text-primary)',
  fontSize: 13,
};

export function CableCurrentChart({ data }: { data: CableCurrentPoint[] }) {
  return (
    <div className="chart-card">
      <div className="chart-title">Cable Temperature &amp; Current</div>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={12} tickMargin={8} />
          <YAxis yAxisId="temp" stroke="var(--status-high)" fontSize={12} unit="°C" width={54} />
          <YAxis yAxisId="current" orientation="right" stroke="var(--accent)" fontSize={12} unit="A" width={54} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)' }} />
          <Line
            yAxisId="temp"
            type="monotone"
            dataKey="cableTemp"
            name="Cable Temp (°C)"
            stroke="var(--status-high)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
          <Line
            yAxisId="current"
            type="monotone"
            dataKey="current"
            name="Current (A)"
            stroke="var(--accent)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
