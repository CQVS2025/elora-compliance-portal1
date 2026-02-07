import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, AlertTriangle, DollarSign, Info } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import moment from 'moment';

export default function CostForecast({ scans, selectedCustomer, selectedSite }) {
  const costData = useMemo(() => {
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
    let totalCost = 0;
    let totalScans = 0;
    
    scans.forEach(scan => {
      const month = moment(scan.timestamp ?? scan.createdAt).format('YYYY-MM');
      if (!monthlyData[month]) {
        monthlyData[month] = { month, scans: 0, cost: 0 };
      }
      const price = getPricing(scan);
      monthlyData[month].scans++;
      monthlyData[month].cost += price;
      totalCost += price;
      totalScans++;
    });

    const months = Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));
    const lastMonth = months[months.length - 1];
    const avgCostPerScan = totalScans > 0 ? totalCost / totalScans : 0;
    
    // If we have less than 2 months, we can't calculate a full forecast
    // but we can still show current data
    if (months.length < 2) {
      return {
        hasFullForecast: false,
        currentMonth: lastMonth?.cost ?? 0,
        currentMonthLabel: lastMonth ? moment(lastMonth.month, 'YYYY-MM').format('MMM YYYY') : 'Current',
        totalCost,
        totalScans,
        avgCostPerScan,
        chartData: months.map(m => ({
          month: moment(m.month, 'YYYY-MM').format('MMM YY'),
          cost: m.cost,
          scans: m.scans
        })),
        monthCount: months.length
      };
    }

    // Calculate trend with 2+ months
    const recentMonths = months.slice(-3);
    const avgCost = recentMonths.reduce((sum, m) => sum + m.cost, 0) / recentMonths.length;

    // Calculate growth rate
    const prevMonth = months[months.length - 2];
    const growthRate = prevMonth.cost > 0 
      ? ((lastMonth.cost - prevMonth.cost) / prevMonth.cost) * 100 
      : 0;

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
      hasFullForecast: true,
      currentMonth: lastMonth.cost,
      currentMonthLabel: moment(lastMonth.month, 'YYYY-MM').format('MMM YYYY'),
      nextMonth: nextMonthCost,
      growthRate,
      avgMonthly: avgCost,
      totalCost,
      totalScans,
      avgCostPerScan,
      chartData: chartData.map(m => ({
        month: moment(m.month, 'YYYY-MM').format('MMM YY'),
        cost: m.cost,
        forecast: m.forecast
      })),
      nextMonthDate,
      alert: nextMonthCost > avgCost * 1.2, // Alert if 20% above average
      monthCount: months.length
    };
  }, [scans, selectedCustomer]);

  const trend = costData?.hasFullForecast ? (costData.growthRate > 0 ? 'up' : 'down') : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-[#7CB342]" />
          Cost Forecast
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {costData ? (
          <>
            {/* Info banner when we only have partial data */}
            {!costData.hasFullForecast && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2 dark:bg-blue-950/30 dark:border-blue-900">
                <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Limited data on this page:</strong> Showing costs for {costData.totalScans} scans. 
                  Full forecast requires data spanning multiple months. Navigate through scan pages or adjust date range for complete trend analysis.
                </div>
              </div>
            )}

            {costData.hasFullForecast && costData.alert && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 dark:bg-red-950/30 dark:border-red-900">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <p className="text-sm text-red-800 dark:text-red-200">
                  <strong>Budget Alert:</strong> Next month's costs projected 20% above average
                </p>
              </div>
            )}

            <div className={`grid gap-4 ${costData.hasFullForecast ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
              <div>
                <p className="text-sm text-primary font-semibold">
                  {costData.hasFullForecast ? 'Current Month' : `Cost (${costData.currentMonthLabel})`}
                </p>
                <p className="text-2xl font-bold text-foreground">
                  ${costData.currentMonth.toFixed(2)}
                </p>
              </div>
              
              {costData.hasFullForecast ? (
                <>
                  <div>
                    <p className="text-sm text-primary font-semibold">Projected {costData.nextMonthDate}</p>
                    <p className="text-2xl font-bold text-[#7CB342]">
                      ${costData.nextMonth.toFixed(2)}
                    </p>
                    <Badge className={trend === 'up' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}>
                      {trend === 'up' ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                      {Math.abs(costData.growthRate).toFixed(1)}%
                    </Badge>
                  </div>

                  <div>
                    <p className="text-sm text-primary font-semibold">3-Month Average</p>
                    <p className="text-2xl font-bold text-foreground">
                      ${costData.avgMonthly.toFixed(2)}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-sm text-primary font-semibold">Total Cost (this page)</p>
                    <p className="text-2xl font-bold text-[#7CB342]">
                      ${costData.totalCost.toFixed(2)}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-primary font-semibold">Scans</p>
                    <p className="text-2xl font-bold text-foreground">
                      {costData.totalScans}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-primary font-semibold">Avg Cost/Scan</p>
                    <p className="text-2xl font-bold text-foreground">
                      ${costData.avgCostPerScan.toFixed(2)}
                    </p>
                  </div>
                </>
              )}
            </div>

            {costData.chartData.length > 0 && (
              <ResponsiveContainer width="100%" height={200}>
                {costData.hasFullForecast ? (
                  <LineChart data={costData.chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
                    <Line 
                      type="monotone" 
                      dataKey="cost" 
                      stroke="#7CB342" 
                      strokeWidth={2}
                      dot={{ fill: '#7CB342' }}
                      strokeDasharray={(entry) => entry.forecast ? '5 5' : '0'}
                    />
                  </LineChart>
                ) : (
                  <BarChart data={costData.chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
                    <Bar dataKey="cost" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <DollarSign className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm font-medium">No cost data for selected period</p>
            <p className="text-xs mt-1">Adjust the date range to see forecast</p>
            <div className="mt-4 w-full h-[200px] rounded-lg border border-dashed border-border bg-muted/20 flex items-center justify-center">
              <span className="text-xs text-muted-foreground">Chart will appear when data is available</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}