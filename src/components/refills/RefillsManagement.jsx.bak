import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Droplet, 
  DollarSign, 
  Package,
  Clock,
  Download,
  Search
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import moment from 'moment';

export default function RefillsManagement({ selectedCustomer, selectedSite, dateRange }) {
  const [searchQuery, setSearchQuery] = useState('');

  const { data: refills = [], isLoading } = useQuery({
    queryKey: ['refills', selectedCustomer, selectedSite, dateRange.start, dateRange.end],
    queryFn: async () => {
      const params = {
        from_date: dateRange.start,
        to_date: dateRange.end
      };
      if (selectedCustomer && selectedCustomer !== 'all') params.customer_id = selectedCustomer;
      if (selectedSite && selectedSite !== 'all') params.site_id = selectedSite;
      
      const response = await base44.functions.invoke('elora_refills', params);
      return response.data || [];
    }
  });

  // Calculate stats
  const stats = useMemo(() => {
    const totalDeliveries = refills.length;
    const totalVolume = refills.reduce((sum, r) => sum + (r.deliveredLitres || 0), 0);
    const totalCost = refills.reduce((sum, r) => sum + (r.totalExGst || 0), 0);
    const avgDeliverySize = totalDeliveries > 0 ? totalVolume / totalDeliveries : 0;
    
    const deliveredCount = refills.filter(r => r.status === 'Delivered').length;
    const scheduledCount = refills.filter(r => r.status === 'Scheduled').length;
    const pendingCount = refills.filter(r => ['Confirmed', 'In Transit'].includes(r.status)).length;

    return {
      totalDeliveries,
      totalVolume,
      totalCost,
      avgDeliverySize,
      deliveredCount,
      scheduledCount,
      pendingCount
    };
  }, [refills]);

  // Filter refills
  const filteredRefills = useMemo(() => {
    if (!searchQuery) return refills;
    const query = searchQuery.toLowerCase();
    return refills.filter(r => 
      r.customer?.toLowerCase().includes(query) ||
      r.site?.toLowerCase().includes(query) ||
      r.product?.toLowerCase().includes(query) ||
      r.invoiceNo?.toLowerCase().includes(query)
    );
  }, [refills, searchQuery]);

  // Volume by site
  const volumeBySite = useMemo(() => {
    const siteMap = {};
    refills.forEach(r => {
      if (!siteMap[r.site]) {
        siteMap[r.site] = { site: r.site, volume: 0, cost: 0 };
      }
      siteMap[r.site].volume += r.deliveredLitres || 0;
      siteMap[r.site].cost += r.totalExGst || 0;
    });
    return Object.values(siteMap).sort((a, b) => b.volume - a.volume).slice(0, 10);
  }, [refills]);

  // Monthly trend
  const monthlyTrend = useMemo(() => {
    const monthMap = {};
    refills.forEach(r => {
      const month = moment(r.date).format('MMM YY');
      if (!monthMap[month]) {
        monthMap[month] = { month, volume: 0, cost: 0, deliveries: 0 };
      }
      monthMap[month].volume += r.deliveredLitres || 0;
      monthMap[month].cost += r.totalExGst || 0;
      monthMap[month].deliveries += 1;
    });
    return Object.values(monthMap).sort((a, b) => 
      moment(a.month, 'MMM YY').valueOf() - moment(b.month, 'MMM YY').valueOf()
    );
  }, [refills]);

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Date', 'Customer', 'Site', 'Product', 'Volume (L)', 'Cost', 'Status', 'Invoice'];
    const rows = filteredRefills.map(r => [
      moment(r.date).format('YYYY-MM-DD'),
      r.customer,
      r.site,
      r.productName,
      r.deliveredLitres,
      `$${r.totalExGst?.toFixed(2)}`,
      r.status,
      r.invoiceNo || ''
    ]);
    
    const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `refills_${moment().format('YYYY-MM-DD')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Delivered': return 'bg-green-100 text-green-800';
      case 'Scheduled': return 'bg-blue-100 text-blue-800';
      case 'Confirmed': return 'bg-yellow-100 text-yellow-800';
      case 'In Transit': return 'bg-orange-100 text-orange-800';
      case 'Cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Droplet className="w-12 h-12 text-[#7CB342] animate-bounce" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Deliveries</p>
                <p className="text-3xl font-bold text-slate-800 mt-1">{stats.totalDeliveries}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge className="bg-green-100 text-green-800">{stats.deliveredCount} delivered</Badge>
                  <Badge className="bg-blue-100 text-blue-800">{stats.scheduledCount} scheduled</Badge>
                </div>
              </div>
              <div className="w-12 h-12 rounded-lg bg-[#7CB342]/10 flex items-center justify-center">
                <Package className="w-6 h-6 text-[#7CB342]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Volume</p>
                <p className="text-3xl font-bold text-slate-800 mt-1">{stats.totalVolume.toLocaleString()}L</p>
                <p className="text-xs text-slate-500 mt-2">Avg: {Math.round(stats.avgDeliverySize)}L per delivery</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <Droplet className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Cost</p>
                <p className="text-3xl font-bold text-slate-800 mt-1">${stats.totalCost.toLocaleString()}</p>
                <p className="text-xs text-slate-500 mt-2">Ex GST</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-emerald-100 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Pending Actions</p>
                <p className="text-3xl font-bold text-slate-800 mt-1">{stats.pendingCount}</p>
                <p className="text-xs text-slate-500 mt-2">Confirmed/In Transit</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Monthly Volume & Cost Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="volume" stroke="#7CB342" name="Volume (L)" strokeWidth={2} />
                <Line yAxisId="right" type="monotone" dataKey="cost" stroke="#3B82F6" name="Cost ($)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top 10 Sites by Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={volumeBySite} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis dataKey="site" type="category" width={120} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="volume" fill="#7CB342" name="Volume (L)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Refills Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Delivery History</CardTitle>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search refills..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              <Button variant="outline" onClick={exportToCSV} className="gap-2">
                <Download className="w-4 h-4" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left p-3 text-sm font-semibold text-slate-700">Date</th>
                  <th className="text-left p-3 text-sm font-semibold text-slate-700">Customer</th>
                  <th className="text-left p-3 text-sm font-semibold text-slate-700">Site</th>
                  <th className="text-left p-3 text-sm font-semibold text-slate-700">Product</th>
                  <th className="text-right p-3 text-sm font-semibold text-slate-700">Volume</th>
                  <th className="text-right p-3 text-sm font-semibold text-slate-700">Cost</th>
                  <th className="text-center p-3 text-sm font-semibold text-slate-700">Status</th>
                  <th className="text-left p-3 text-sm font-semibold text-slate-700">Invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredRefills.map((refill, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-3 text-sm text-slate-700">{moment(refill.date).format('DD MMM YYYY')}</td>
                    <td className="p-3 text-sm text-slate-700">{refill.customer}</td>
                    <td className="p-3 text-sm text-slate-700">{refill.site}</td>
                    <td className="p-3 text-sm text-slate-700">{refill.productName}</td>
                    <td className="p-3 text-sm text-slate-700 text-right">{refill.deliveredLitres?.toLocaleString()}L</td>
                    <td className="p-3 text-sm text-slate-700 text-right">${refill.totalExGst?.toFixed(2)}</td>
                    <td className="p-3 text-center">
                      <Badge className={getStatusColor(refill.status)}>{refill.status}</Badge>
                    </td>
                    <td className="p-3 text-sm text-slate-700">{refill.invoiceNo || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}