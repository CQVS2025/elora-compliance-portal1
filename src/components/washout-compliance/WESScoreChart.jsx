import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import moment from 'moment';

/**
 * WES Score Trend Chart Component
 * Displays 30-day WES score trend with color zones
 * 
 * @param {Array} data - Array of {date, score} objects
 * @param {string} title - Chart title
 * @param {string} className - Additional CSS classes
 */
export default function WESScoreChart({ data, title = 'WES Score Trend — 30 Days', className }) {
  // Format data for chart
  const chartData = data.map(item => ({
    ...item,
    displayDate: moment(item.date).format('MMM DD')
  }));

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-lg shadow-lg p-3">
          <p className="text-sm font-semibold text-foreground">
            {moment(data.date).format('MMM DD, YYYY')}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            WES Score: <span className="font-bold text-primary">{data.score}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="displayDate" 
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              interval="preserveStartEnd"
            />
            <YAxis 
              domain={[0, 100]} 
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
              label={{ value: 'WES Score', angle: -90, position: 'insideLeft', style: { fill: 'hsl(var(--muted-foreground))' } }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1, fill: 'hsl(var(--muted) / 0.2)' }} />
            
            {/* Reference lines for score zones (theme: primary = good, chart-medium = marginal, chart-critical = poor) */}
            <ReferenceLine y={90} stroke="hsl(var(--primary))" strokeDasharray="3 3" strokeOpacity={0.3} />
            <ReferenceLine y={70} stroke="hsl(var(--chart-low))" strokeDasharray="3 3" strokeOpacity={0.3} />
            <ReferenceLine y={50} stroke="hsl(var(--chart-medium))" strokeDasharray="3 3" strokeOpacity={0.3} />
            
            <Line 
              type="monotone" 
              dataKey="score" 
              stroke="hsl(var(--primary))" 
              strokeWidth={3}
              dot={{ fill: 'hsl(var(--primary))', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
        
        {/* Legend - app theme chart/primary colors */}
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-primary" />
            <span>Excellent (90-100)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-chart-low" />
            <span>Good (70-89)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-chart-medium" />
            <span>Marginal (50-69)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-chart-critical" />
            <span>Poor (&lt;50)</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
