import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from "@/api/base44Client";
import { motion } from 'framer-motion';
import { Wrench, Plus, Calendar, DollarSign, AlertTriangle, Clock, TrendingUp } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import MaintenanceModal from './MaintenanceModal';
import moment from 'moment';
import { useToast } from "@/components/ui/use-toast";

export default function MaintenanceSection({ vehicles }) {
  const { toast } = useToast();
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: maintenanceRecords = [] } = useQuery({
    queryKey: ['maintenance'],
    queryFn: async () => {
      const records = await base44.entities.Maintenance.list('-service_date', 1000);
      return records;
    }
  });

  // Calculate maintenance alerts and stats
  const { alerts, stats } = useMemo(() => {
    const now = new Date();
    const alerts = [];
    
    // Check for overdue or upcoming maintenance
    maintenanceRecords.forEach(record => {
      if (record.next_service_date) {
        const nextDate = new Date(record.next_service_date);
        const daysUntil = Math.ceil((nextDate - now) / (1000 * 60 * 60 * 24));
        
        if (daysUntil < 0) {
          alerts.push({
            ...record,
            type: 'overdue',
            daysOverdue: Math.abs(daysUntil)
          });
        } else if (daysUntil <= 14) {
          alerts.push({
            ...record,
            type: 'upcoming',
            daysUntil
          });
        }
      }
    });

    // Calculate stats
    const totalCost = maintenanceRecords.reduce((sum, r) => sum + (r.cost || 0), 0);
    const avgCost = maintenanceRecords.length > 0 ? totalCost / maintenanceRecords.length : 0;
    const recentRecords = maintenanceRecords.filter(r => {
      const date = new Date(r.service_date);
      const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
      return date >= thirtyDaysAgo;
    });

    return {
      alerts: alerts.sort((a, b) => {
        if (a.type === 'overdue' && b.type !== 'overdue') return -1;
        if (a.type !== 'overdue' && b.type === 'overdue') return 1;
        return 0;
      }),
      stats: {
        totalRecords: maintenanceRecords.length,
        totalCost,
        avgCost,
        recentServices: recentRecords.length
      }
    };
  }, [maintenanceRecords]);

  const handleAddMaintenance = () => {
    if (vehicles.length === 0) {
      toast({
        title: "No Vehicles Available",
        description: "Please add vehicles first before adding maintenance records.",
        variant: "destructive",
      });
      return;
    }
    setSelectedVehicle(vehicles[0]);
    setModalOpen(true);
  };

  const handleSuccess = () => {
    queryClient.invalidateQueries(['maintenance']);
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-[#7CB342]/10 rounded-lg">
                <Wrench className="w-5 h-5 text-[#7CB342]" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Total Services</p>
                <p className="text-2xl font-bold text-slate-800">{stats.totalRecords}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <DollarSign className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Total Cost</p>
                <p className="text-2xl font-bold text-slate-800">${stats.totalCost.toFixed(0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-500/10 rounded-lg">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Avg Cost</p>
                <p className="text-2xl font-bold text-slate-800">${stats.avgCost.toFixed(0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-500/10 rounded-lg">
                <Calendar className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Last 30 Days</p>
                <p className="text-2xl font-bold text-slate-800">{stats.recentServices}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              <h3 className="text-lg font-bold text-slate-800">Maintenance Alerts</h3>
            </div>
            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
              {alerts.length} alert{alerts.length !== 1 ? 's' : ''}
            </Badge>
          </div>

          <div className="space-y-2">
            {alerts.map((alert, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-lg border ${
                  alert.type === 'overdue'
                    ? 'bg-red-50 border-red-200'
                    : 'bg-yellow-50 border-yellow-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Clock className={`w-5 h-5 ${alert.type === 'overdue' ? 'text-red-600' : 'text-yellow-600'}`} />
                    <div>
                      <p className="font-semibold text-slate-800">{alert.vehicle_name}</p>
                      <p className="text-sm text-slate-600">
                        {alert.service_type.replace('_', ' ').toUpperCase()} - 
                        {alert.type === 'overdue' 
                          ? ` ${alert.daysOverdue} days overdue`
                          : ` Due in ${alert.daysUntil} days`
                        }
                      </p>
                    </div>
                  </div>
                  <Badge className={alert.type === 'overdue' ? 'bg-red-500' : 'bg-yellow-500'}>
                    {alert.type === 'overdue' ? 'Overdue' : 'Upcoming'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Recent Maintenance Records */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
      >
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800">Maintenance History</h3>
          <Button 
            onClick={handleAddMaintenance}
            className="bg-[#7CB342] hover:bg-[#689F38]"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Record
          </Button>
        </div>

        <div className="overflow-x-auto">
          {maintenanceRecords.length === 0 ? (
            <div className="p-12 text-center">
              <Wrench className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 mb-2">No maintenance records yet</p>
              <p className="text-sm text-slate-500">Start tracking vehicle maintenance to monitor service history</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-[#0F172A]">
                  <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase">Vehicle</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase">Service Type</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase">Cost</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase">Mileage</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase">Next Service</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {maintenanceRecords.slice(0, 20).map((record, idx) => (
                  <tr
                    key={record.id}
                    className={`border-b border-slate-100 hover:bg-slate-50 ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                    }`}
                  >
                    <td className="px-4 py-3 font-semibold text-slate-800">{record.vehicle_name}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {record.service_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {moment(record.service_date).format('MMM D, YYYY')}
                    </td>
                    <td className="px-4 py-3 text-slate-800">
                      {record.cost ? `$${record.cost.toFixed(2)}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {record.mileage ? record.mileage.toLocaleString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {record.next_service_date 
                        ? moment(record.next_service_date).format('MMM D, YYYY')
                        : '-'
                      }
                    </td>
                    <td className="px-4 py-3">
                      <Badge 
                        className={
                          record.status === 'completed' 
                            ? 'bg-green-500' 
                            : record.status === 'scheduled'
                            ? 'bg-blue-500'
                            : 'bg-red-500'
                        }
                      >
                        {record.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </motion.div>

      {selectedVehicle && (
        <MaintenanceModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          vehicle={selectedVehicle}
          allVehicles={vehicles}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}