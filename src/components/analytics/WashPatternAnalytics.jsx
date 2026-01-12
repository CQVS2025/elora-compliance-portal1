import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Calendar, TrendingUp, Lightbulb } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import moment from 'moment';

export default function WashPatternAnalytics({ scans }) {
  const analysis = useMemo(() => {
    if (!scans.length) return null;

    // Analyze by hour
    const hourData = {};
    const dayData = {};
    
    scans.forEach(scan => {
      const hour = moment(scan.timestamp).hour();
      const day = moment(scan.timestamp).format('dddd');
      
      hourData[hour] = (hourData[hour] || 0) + 1;
      dayData[day] = (dayData[day] || 0) + 1;
    });

    // Format hour data
    const hours = Array.from({ length: 24 }, (_, i) => ({
      hour: i < 12 ? `${i || 12}AM` : i === 12 ? '12PM' : `${i - 12}PM`,
      washes: hourData[i] || 0
    }));

    // Format day data
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => ({
      day: day.substring(0, 3),
      washes: dayData[day] || 0
    }));

    // Find peak times
    const peakHour = hours.reduce((max, h) => h.washes > max.washes ? h : max, hours[0]);
    const peakDay = days.reduce((max, d) => d.washes > max.washes ? d : max, days[0]);

    // Calculate insights
    const morningWashes = hours.slice(6, 12).reduce((sum, h) => sum + h.washes, 0);
    const afternoonWashes = hours.slice(12, 18).reduce((sum, h) => sum + h.washes, 0);
    const eveningWashes = hours.slice(18, 24).reduce((sum, h) => sum + h.washes, 0);
    
    const total = morningWashes + afternoonWashes + eveningWashes;
    const periodData = [
      { period: 'Morning (6AM-12PM)', washes: morningWashes, percentage: (morningWashes / total * 100).toFixed(1) },
      { period: 'Afternoon (12PM-6PM)', washes: afternoonWashes, percentage: (afternoonWashes / total * 100).toFixed(1) },
      { period: 'Evening (6PM-12AM)', washes: eveningWashes, percentage: (eveningWashes / total * 100).toFixed(1) },
    ];

    // Generate recommendations
    const recommendations = [];
    if (morningWashes < afternoonWashes * 0.5) {
      recommendations.push('Consider incentivizing morning washes to balance workload');
    }
    if (peakDay.washes > days.reduce((sum, d) => sum + d.washes, 0) / 7 * 1.5) {
      recommendations.push(`${peakDay.day} is significantly busier - ensure adequate staffing`);
    }
    if (eveningWashes < total * 0.15) {
      recommendations.push('Evening wash rates are low - potential for extended hours');
    }

    return {
      hours,
      days,
      peakHour,
      peakDay,
      periodData,
      recommendations
    };
  }, [scans]);

  if (!analysis) return null;

  const COLORS = ['#7CB342', '#FFA726', '#42A5F5'];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-[#7CB342]" />
          Wash Pattern Analytics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Peak Times */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-blue-600" />
              <p className="text-sm font-semibold text-blue-900">Peak Hour</p>
            </div>
            <p className="text-2xl font-bold text-blue-600">{analysis.peakHour.hour}</p>
            <p className="text-sm text-blue-700">{analysis.peakHour.washes} washes</p>
          </div>

          <div className="p-4 bg-purple-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-5 h-5 text-purple-600" />
              <p className="text-sm font-semibold text-purple-900">Busiest Day</p>
            </div>
            <p className="text-2xl font-bold text-purple-600">{analysis.peakDay.day}</p>
            <p className="text-sm text-purple-700">{analysis.peakDay.washes} washes</p>
          </div>
        </div>

        {/* Day Distribution */}
        <div>
          <h4 className="text-sm font-semibold text-slate-700 mb-3">Daily Distribution</h4>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={analysis.days}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="washes" fill="#7CB342" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Period Distribution */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Time Periods</h4>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={analysis.periodData}
                  dataKey="washes"
                  nameKey="period"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  label={(entry) => `${entry.percentage}%`}
                >
                  {analysis.periodData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Distribution</h4>
            <div className="space-y-3">
              {analysis.periodData.map((period, idx) => (
                <div key={idx}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600">{period.period.split(' ')[0]}</span>
                    <span className="font-semibold">{period.washes}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full" 
                      style={{ 
                        width: `${period.percentage}%`, 
                        backgroundColor: COLORS[idx] 
                      }} 
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recommendations */}
        {analysis.recommendations.length > 0 && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-5 h-5 text-amber-600" />
              <h4 className="text-sm font-semibold text-amber-900">Insights & Recommendations</h4>
            </div>
            <ul className="space-y-2">
              {analysis.recommendations.map((rec, idx) => (
                <li key={idx} className="text-sm text-amber-800 flex items-start gap-2">
                  <TrendingUp className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}