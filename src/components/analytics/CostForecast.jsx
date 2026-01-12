import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, AlertTriangle, DollarSign } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import moment from 'moment';

export default function CostForecast({ scans, selectedCustomer, selectedSite }) {
  const forecast = useMemo(() => {
    if (!scans.length) return null;

    // Get pricing rules
    const getPricing = (scan) => {
      // Simplified pricing - adjust based on your actual logic
      if (selectedCustomer === '20230125093802S89854') return 6.20; // NSW
      if (selectedCustomer === '20200813133612S8071') return 5.60; // VIC
      return 5.80; // Default QLD
    };

    // Group by month
    const monthlyData = {};
    scans.forEach(scan => {
      const month = moment(scan.timestamp).format('YYYY-MM');
      if (!monthlyData[month]) {
        monthlyData[month] = { month, scans: 0, cost: 0 };
      }
      monthlyData[month].scans++;
      monthlyData[month].cost += getPricing(scan);
    });

    const months = Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));
    
    if (months.length < 2) return null;

    // Calculate trend
    const recentMonths = months.slice(-3);
    const avgScans = recentMonths.reduce((sum, m) => sum + m.scans, 0) / recentMonths.length;
    const avgCost = recentMonths.reduce((sum, m) => sum + m.cost, 0) / recentMonths.length;

    // Calculate growth rate
    const lastMonth = months[months.length - 1];
    const prevMonth = months[months.length - 2];
    const growthRate = ((lastMonth.cost - prevMonth.cost) / prevMonth.cost) * 100;

    // Forecast next month
    const nextMonthCost = avgCost * (1 + (growthRate / 100));
    const nextMonthDate = moment().add(1, 'month').format('MMM YYYY');

    // Add forecast to chart data
    const chartData = [...months, {
      month: moment().add(1, 'month').format('YYYY-MM'),
      cost: nextMonthCost,
      forecast: true
    }];

    return {
      currentMonth: lastMonth.cost,
      nextMonth: nextMonthCost,
      growthRate,
      avgMonthly: avgCost,
      chartData: chartData.map(m => ({
        month: moment(m.month, 'YYYY-MM').format('MMM YY'),
        cost: m.cost,
        forecast: m.forecast
      })),
      nextMonthDate,
      alert: nextMonthCost > avgCost * 1.2 // Alert if 20% above average
    };
  }, [scans, selectedCustomer]);

  if (!forecast) return null;

  const trend = forecast.growthRate > 0 ? 'up' : 'down';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-[#7CB342]" />
          Cost Forecast
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {forecast.alert && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <p className="text-sm text-red-800">
              <strong>Budget Alert:</strong> Next month's costs projected 20% above average
            </p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-slate-600">Current Month</p>
            <p className="text-2xl font-bold text-slate-800">
              ${forecast.currentMonth.toFixed(2)}
            </p>
          </div>
          
          <div>
            <p className="text-sm text-slate-600">Projected {forecast.nextMonthDate}</p>
            <p className="text-2xl font-bold text-[#7CB342]">
              ${forecast.nextMonth.toFixed(2)}
            </p>
            <Badge className={trend === 'up' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}>
              {trend === 'up' ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
              {Math.abs(forecast.growthRate).toFixed(1)}%
            </Badge>
          </div>

          <div>
            <p className="text-sm text-slate-600">3-Month Average</p>
            <p className="text-2xl font-bold text-slate-800">
              ${forecast.avgMonthly.toFixed(2)}
            </p>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={forecast.chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
            <Line 
              type="monotone" 
              dataKey="cost" 
              stroke="#7CB342" 
              strokeWidth={2}
              dot={{ fill: '#7CB342' }}
              strokeDasharray={(entry) => entry.forecast ? '5 5' : '0'}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}