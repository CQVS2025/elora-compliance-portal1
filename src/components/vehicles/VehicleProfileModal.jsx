import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabaseClient } from "@/api/supabaseClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Truck,
  Wrench,
  Droplet,
  DollarSign,
  Users,
  Calendar,
  Download,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import moment from 'moment';
import { usePermissions, getUserSpecificConfig } from '@/components/auth/PermissionGuard';

// Pricing calculation functions
const PRICING_RULES = {
  NSW: { litres: 2, pricePerLitre: 3.85 },
  VIC: { litres: 2, pricePerLitre: 3.85 },
  QLD: { litres: 4, pricePerLitre: 3.85 },
  GUNLAKE: { litres: 2, pricePerLitre: 3.95 },
  BORAL_QLD: { litres: 4, pricePerLitre: 3.65 }
};

const calculateCostPerScan = (customerName, state) => {
  if (!customerName) return PRICING_RULES[state]?.litres * PRICING_RULES[state]?.pricePerLitre || 7.70;
  const customerUpper = customerName.toUpperCase();
  
  if (customerUpper.includes('GUNLAKE')) {
    return PRICING_RULES.GUNLAKE.litres * PRICING_RULES.GUNLAKE.pricePerLitre;
  }
  
  if (state === 'QLD' && customerUpper.includes('BORAL')) {
    return PRICING_RULES.BORAL_QLD.litres * PRICING_RULES.BORAL_QLD.pricePerLitre;
  }
  
  const rule = PRICING_RULES[state] || PRICING_RULES.NSW;
  return rule.litres * rule.pricePerLitre;
};

const getStateFromSite = (siteName, customerName = '') => {
  if (!siteName) return 'NSW';
  
  // Check customer name for BORAL - QLD
  const customerUpper = (customerName || '').toUpperCase();
  if (customerUpper.includes('BORAL') && customerUpper.includes('QLD')) {
    return 'QLD';
  }
  
  // Specific QLD site names for BORAL
  const siteUpper = siteName.toUpperCase();
  const qldSites = ['BURLEIGH', 'ARCHERFIELD', 'BEENLEIGH', 'BENOWA', 'BROWNS PLAINS', 
                    'CALOUNDRA', 'CAPALABA', 'CLEVELAND', 'EVERTON PARK', 'GEEBUNG',
                    'IPSWICH', 'KINGSTON', 'LABRADOR', 'MORAYFIELD', 'MURARRIE',
                    'NARANGBA', 'REDBANK PLAINS', 'SOUTHPORT', 'WACOL'];
  
  if (qldSites.some(site => siteUpper.includes(site))) {
    return 'QLD';
  }
  
  if (siteUpper.includes('QLD') || siteUpper.includes('BRISBANE')) return 'QLD';
  if (siteUpper.includes('VIC') || siteUpper.includes('MELBOURNE')) return 'VIC';
  return 'NSW';
};

export default function VehicleProfileModal({ vehicle, open, onClose, scans }) {
  const [activeTab, setActiveTab] = useState('overview');
  const permissions = usePermissions();
  const userConfig = getUserSpecificConfig(permissions.user?.email);

  const { data: maintenanceRecords = [] } = useQuery({
    queryKey: ['maintenance', vehicle?.id],
    queryFn: async () => {
      if (!vehicle?.id) return [];
      const { data, error } = await supabaseClient.tables.maintenanceRecords
        .select('*')
        .eq('vehicle_id', vehicle.id)
        .order('service_date', { ascending: false });
      return data || [];
    },
    enabled: open && !!vehicle?.id
  });

  const { data: issues = [] } = useQuery({
    queryKey: ['issues', vehicle?.id],
    queryFn: async () => {
      if (!vehicle?.id) return [];
      const { data, error } = await supabaseClient.tables.issues
        .select('*')
        .eq('vehicle_id', vehicle.id)
        .order('created_date', { ascending: false });
      return data || [];
    },
    enabled: open && !!vehicle?.id
  });

  // Process wash history (scans)
  const washHistory = useMemo(() => {
    if (!scans || !vehicle) return [];
    return scans
      .filter(scan => scan.vehicleRef === vehicle.id || scan.vehicleName === vehicle.name)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [scans, vehicle]);

  // Compliance over time
  const complianceOverTime = useMemo(() => {
    if (!washHistory.length) return [];
    
    const monthlyData = {};
    washHistory.forEach(scan => {
      const month = moment(scan.timestamp).format('MMM YY');
      monthlyData[month] = (monthlyData[month] || 0) + 1;
    });

    return Object.entries(monthlyData)
      .map(([month, count]) => ({ month, washes: count }))
      .sort((a, b) => moment(a.month, 'MMM YY').valueOf() - moment(b.month, 'MMM YY').valueOf())
      .slice(-12);
  }, [washHistory]);

  // Usage cost breakdown
  const usageCosts = useMemo(() => {
    if (!washHistory.length || !vehicle) return null;

    const customerName = washHistory[0]?.customerName || '';
    const state = getStateFromSite(vehicle.site_name, customerName);
    const costPerScan = calculateCostPerScan(customerName, state);
    const totalCost = washHistory.length * costPerScan;

    // Monthly costs
    const monthlyCosts = {};
    washHistory.forEach(scan => {
      const month = moment(scan.timestamp).format('MMM YY');
      monthlyCosts[month] = (monthlyCosts[month] || 0) + costPerScan;
    });

    const costTrend = Object.entries(monthlyCosts)
      .map(([month, cost]) => ({ month, cost: parseFloat(cost.toFixed(2)) }))
      .sort((a, b) => moment(a.month, 'MMM YY').valueOf() - moment(b.month, 'MMM YY').valueOf())
      .slice(-12);

    return {
      state,
      costPerScan,
      totalCost,
      totalScans: washHistory.length,
      costTrend
    };
  }, [washHistory, vehicle]);

  // Maintenance cost summary
  const maintenanceCosts = useMemo(() => {
    if (!maintenanceRecords.length) return null;
    
    const totalCost = maintenanceRecords.reduce((sum, r) => sum + (r.cost || 0), 0);
    const avgCost = totalCost / maintenanceRecords.length;
    const lastService = maintenanceRecords[0];
    const nextService = maintenanceRecords.find(r => r.next_service_date);

    return {
      totalCost,
      avgCost,
      recordCount: maintenanceRecords.length,
      lastService,
      nextService
    };
  }, [maintenanceRecords]);

  if (!vehicle) return null;

  const isCompliant = vehicle.washes_completed >= vehicle.target;
  const progress = Math.min(100, Math.round((vehicle.washes_completed / vehicle.target) * 100));

  const exportData = (type) => {
    let data, headers, filename;
    
    if (type === 'maintenance') {
      headers = ['Date', 'Service Type', 'Cost', 'Mileage', 'Next Service', 'Notes'];
      data = maintenanceRecords.map(r => [
        moment(r.service_date).format('YYYY-MM-DD'),
        r.service_type,
        r.cost || 0,
        r.mileage || 0,
        r.next_service_date ? moment(r.next_service_date).format('YYYY-MM-DD') : '',
        r.notes || ''
      ]);
      filename = `${vehicle.name}-maintenance-history.csv`;
    } else if (type === 'washes') {
      headers = ['Date', 'Time', 'Site', 'Wash Type'];
      data = washHistory.map(s => [
        moment(s.timestamp).format('YYYY-MM-DD'),
        moment(s.timestamp).format('HH:mm:ss'),
        s.siteName || vehicle.site_name,
        s.washType || 'Standard'
      ]);
      filename = `${vehicle.name}-wash-history.csv`;
    } else if (type === 'costs') {
      headers = ['Period', 'Scans', 'Cost per Scan', 'Total Cost'];
      data = usageCosts.costTrend.map(c => [
        c.month,
        washHistory.filter(s => moment(s.timestamp).format('MMM YY') === c.month).length,
        `$${usageCosts.costPerScan.toFixed(2)}`,
        `$${c.cost.toFixed(2)}`
      ]);
      filename = `${vehicle.name}-usage-costs.csv`;
    }

    const csv = [headers, ...data].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#7CB342] to-[#9CCC65] flex items-center justify-center">
              <Truck className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-2xl font-bold">{vehicle.name}</span>
              <p className="text-sm font-mono text-slate-500">{vehicle.rfid}</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className={`grid w-full ${userConfig?.hideUsageCosts ? 'grid-cols-4' : 'grid-cols-5'}`}>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
            {!userConfig?.hideUsageCosts && (
              <TabsTrigger value="costs">Usage Costs</TabsTrigger>
            )}
            <TabsTrigger value="assignments">Assignments</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Compliance Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge 
                    className={`px-4 py-2 text-lg font-semibold ${
                      isCompliant 
                        ? 'bg-emerald-500 text-white' 
                        : 'bg-red-500 text-white'
                    }`}
                  >
                    {isCompliant ? (
                      <><CheckCircle className="w-5 h-5 mr-2" /> Compliant</>
                    ) : (
                      <><XCircle className="w-5 h-5 mr-2" /> Non-Compliant</>
                    )}
                  </Badge>
                  <div className="mt-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Progress</span>
                      <span className="font-semibold">{vehicle.washes_completed}/{vehicle.target}</span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all"
                        style={{ 
                          width: `${progress}%`,
                          background: 'linear-gradient(90deg, #7CB342 0%, #9CCC65 100%)'
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Site & Location</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-semibold text-slate-800">{vehicle.site_name}</p>
                  <p className="text-sm text-slate-500 mt-1">Last scan: {moment(vehicle.last_scan).fromNow()}</p>
                  {usageCosts && !userConfig?.hideUsageCosts && (
                    <Badge className="mt-3 bg-blue-100 text-blue-800">
                      {usageCosts.state}
                    </Badge>
                  )}
                </CardContent>
              </Card>

              {maintenanceCosts && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Wrench className="w-4 h-4" />
                      Maintenance Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-slate-800">${maintenanceCosts.totalCost.toLocaleString()}</p>
                    <p className="text-xs text-slate-500">Total spent • {maintenanceCosts.recordCount} services</p>
                    {maintenanceCosts.nextService && (
                      <p className="text-sm text-orange-600 mt-2">
                        Next service: {moment(maintenanceCosts.nextService.next_service_date).format('MMM D, YYYY')}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {usageCosts && !userConfig?.hideUsageCosts && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      Usage Costs
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-[#7CB342]">${usageCosts.totalCost.toFixed(2)}</p>
                    <p className="text-xs text-slate-500">{usageCosts.totalScans} washes • ${usageCosts.costPerScan.toFixed(2)}/wash</p>
                  </CardContent>
                </Card>
              )}
            </div>

            {issues.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Recent Issues</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {issues.slice(0, 3).map((issue, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                        <Badge className={`${
                          issue.severity === 'critical' ? 'bg-red-500' :
                          issue.severity === 'high' ? 'bg-orange-500' :
                          issue.severity === 'medium' ? 'bg-yellow-500' :
                          'bg-blue-500'
                        } text-white`}>
                          {issue.severity}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800">{issue.issue_type.replace('_', ' ')}</p>
                          <p className="text-xs text-slate-600 truncate">{issue.description}</p>
                          <p className="text-xs text-slate-500 mt-1">{moment(issue.created_date).fromNow()}</p>
                        </div>
                        <Badge className={`${
                          issue.status === 'resolved' ? 'bg-green-100 text-green-800' :
                          issue.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                          'bg-slate-100 text-slate-800'
                        }`}>
                          {issue.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Maintenance Tab */}
          <TabsContent value="maintenance" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Complete Maintenance History</h3>
              {maintenanceRecords.length > 0 && (
                <Button onClick={() => exportData('maintenance')} variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              )}
            </div>

            {maintenanceRecords.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Wrench className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No maintenance records yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {maintenanceRecords.map((record, idx) => (
                  <Card key={idx}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                            <Wrench className="w-5 h-5 text-purple-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800">
                              {record.service_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </p>
                            <p className="text-sm text-slate-600 mt-1">
                              {moment(record.service_date).format('MMMM D, YYYY')}
                            </p>
                            {record.mileage && (
                              <p className="text-xs text-slate-500 mt-1">
                                Mileage: {record.mileage.toLocaleString()} km
                              </p>
                            )}
                            {record.notes && (
                              <p className="text-sm text-slate-600 mt-2">{record.notes}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          {record.cost && (
                            <p className="text-lg font-bold text-[#7CB342]">${record.cost.toFixed(2)}</p>
                          )}
                          {record.next_service_date && (
                            <p className="text-xs text-slate-500 mt-1">
                              Next: {moment(record.next_service_date).format('MMM D, YYYY')}
                            </p>
                          )}
                          <Badge className={`mt-2 ${
                            record.status === 'completed' ? 'bg-green-100 text-green-800' :
                            record.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                            'bg-orange-100 text-orange-800'
                          }`}>
                            {record.status}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Compliance Tab */}
          <TabsContent value="compliance" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Wash History & Compliance Record</h3>
              {washHistory.length > 0 && (
                <Button onClick={() => exportData('washes')} variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              )}
            </div>

            {complianceOverTime.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Compliance Trend (Last 12 Months)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={complianceOverTime}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="month" stroke="#64748b" style={{ fontSize: '12px' }} />
                      <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
                      <Tooltip />
                      <Bar dataKey="washes" fill="#7CB342" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Wash History Details</CardTitle>
              </CardHeader>
              <CardContent>
                {washHistory.length === 0 ? (
                  <div className="py-8 text-center">
                    <Droplet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500">No wash history available</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {washHistory.map((scan, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            {moment(scan.timestamp).format('MMMM D, YYYY')}
                          </p>
                          <p className="text-xs text-slate-500">
                            {moment(scan.timestamp).format('h:mm A')} • {scan.siteName || vehicle.site_name}
                          </p>
                        </div>
                        <Badge className="bg-[#7CB342]/10 text-[#7CB342]">
                          Wash #{washHistory.length - idx}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Usage Costs Tab */}
          {!userConfig?.hideUsageCosts && (
          <TabsContent value="costs" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Detailed Usage Cost Breakdown</h3>
              {usageCosts && (
                <Button onClick={() => exportData('costs')} variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              )}
            </div>

            {!usageCosts ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <DollarSign className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No cost data available</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Total Usage Cost</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-bold text-[#7CB342]">
                        ${usageCosts.totalCost.toFixed(2)}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">AUD</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Cost Per Wash</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-bold text-slate-800">
                        ${usageCosts.costPerScan.toFixed(2)}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">{usageCosts.state} pricing</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Total Washes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-bold text-slate-800">
                        {usageCosts.totalScans}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">All time</p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Cost Trend Over Time</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={usageCosts.costTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="month" stroke="#64748b" style={{ fontSize: '12px' }} />
                        <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
                        <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                        <Line 
                          type="monotone" 
                          dataKey="cost" 
                          stroke="#7CB342" 
                          strokeWidth={2}
                          dot={{ fill: '#7CB342', r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Pricing Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                        <span className="text-sm text-slate-600">State</span>
                        <Badge className="bg-blue-100 text-blue-800">{usageCosts.state}</Badge>
                      </div>
                      <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                        <span className="text-sm text-slate-600">Litres per wash</span>
                        <span className="text-sm font-semibold text-slate-800">
                          {PRICING_RULES[usageCosts.state]?.litres || 2}L
                        </span>
                      </div>
                      <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                        <span className="text-sm text-slate-600">Price per litre</span>
                        <span className="text-sm font-semibold text-slate-800">
                          ${(usageCosts.costPerScan / (PRICING_RULES[usageCosts.state]?.litres || 2)).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between p-3 bg-[#7CB342]/10 rounded-lg">
                        <span className="text-sm font-semibold text-[#7CB342]">Total per wash</span>
                        <span className="text-sm font-bold text-[#7CB342]">
                          ${usageCosts.costPerScan.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
          )}

          {/* Assignments Tab */}
          <TabsContent value="assignments" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Driver Assignment History</h3>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Current Assignment</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-[#7CB342]/10 to-[#9CCC65]/10 rounded-lg">
                  <div className="w-12 h-12 rounded-full bg-[#7CB342] flex items-center justify-center">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">Currently Assigned</p>
                    <p className="text-sm text-slate-600">Vehicle operational and in service</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Assignment Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start gap-4 relative">
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-[#7CB342] flex items-center justify-center">
                        <Users className="w-5 h-5 text-white" />
                      </div>
                      <div className="w-0.5 h-full bg-slate-200 absolute top-10 left-5" />
                    </div>
                    <div className="flex-1 pb-8">
                      <p className="font-semibold text-slate-800">Active Assignment</p>
                      <p className="text-sm text-slate-600">Current operational status</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Since: {moment(vehicle.created_date || Date.now()).format('MMMM D, YYYY')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-slate-500" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-slate-600">Vehicle Created</p>
                      <p className="text-sm text-slate-500">Added to fleet management system</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {moment(vehicle.created_date || Date.now()).format('MMMM D, YYYY')}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="p-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Driver-specific assignment tracking can be enhanced by integrating with 
                  your fleet management system's driver records.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}