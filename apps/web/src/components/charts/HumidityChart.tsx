import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface HumidityPoint {
  time: string;
  humidity: number;
}

const TOOLTIP_STYLE = {
  background: 'var(--bg-panel-alt)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--text-primary)',
  fontSize: 13,
};

export function HumidityChart({ data }: { data: HumidityPoint[] }) {
  return (
    <div className="chart-card">
      <div className="chart-title">Humidity</div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={12} tickMargin={8} />
          <YAxis stroke="var(--text-muted)" fontSize={12} unit="%" width={44} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)' }} />
          <Line
            type="monotone"
            dataKey="humidity"
            name="Humidity (%)"
            stroke="#0284c7"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
