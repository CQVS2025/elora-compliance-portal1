import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabaseClient } from "@/api/supabaseClient";
import { usePermissions } from '@/components/auth/PermissionGuard';
import { 
  Truck, 
  AlertTriangle, 
  CheckCircle,
  Menu,
  X,
  Plus,
  Calendar
} from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import moment from 'moment';
import MobileVehicleCard from '@/components/mobile/MobileVehicleCard';
import MobileIssueReport from '@/components/mobile/MobileIssueReport';

export default function MobileDashboard() {
  const permissions = usePermissions();
  const [activeTab, setActiveTab] = useState('vehicles');
  const [menuOpen, setMenuOpen] = useState(false);
  const [issueModalOpen, setIssueModalOpen] = useState(false);

  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery({
    queryKey: ['mobile-vehicles'],
    queryFn: async () => {
      const response = await supabaseClient.elora.vehicles({});
      const data = response?.data ?? response ?? [];
      return data.map(v => ({
        id: v.vehicleRef,
        name: v.vehicleName,
        rfid: v.vehicleRfid,
        site_name: v.siteName,
        last_scan: v.lastScanAt
      }));
    }
  });


  const { data: issues = [] } = useQuery({
    queryKey: ['mobile-issues'],
    queryFn: async () => {
      const { data, error } = await supabaseClient.tables.issues
        .select('*')
        .order('created_date', { ascending: false })
        .limit(100);
      return data || [];
    }
  });

  // Filter data based on user permissions
  const myVehicles = permissions.isDriver 
    ? vehicles.filter(v => permissions.assignedVehicles.includes(v.id))
    : vehicles;


  const myIssues = permissions.isDriver
    ? issues.filter(i => i.reported_by === permissions.user?.email)
    : issues;

  const openIssues = myIssues.filter(i => i.status === 'open' || i.status === 'in_progress');

  if (vehiclesLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#7CB342] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Mobile Header */}
      <div className="bg-gradient-to-r from-[#0F172A] to-[#1E293B] text-white sticky top-0 z-50 shadow-lg">
        <div className="p-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Compliance Portal</h1>
            <p className="text-sm text-slate-300">{permissions.user?.full_name}</p>
          </div>
          <button 
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="border-t border-white/10 p-4 space-y-2">
            <button
              onClick={() => { setActiveTab('vehicles'); setMenuOpen(false); }}
              className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                activeTab === 'vehicles' ? 'bg-[#7CB342] text-white' : 'bg-white/10 text-white'
              }`}
            >
              <Truck className="w-5 h-5 inline mr-2" />
              My Vehicles
            </button>
            <button
              onClick={() => { setActiveTab('issues'); setMenuOpen(false); }}
              className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                activeTab === 'issues' ? 'bg-[#7CB342] text-white' : 'bg-white/10 text-white'
              }`}
            >
              <AlertTriangle className="w-5 h-5 inline mr-2" />
              Issues
            </button>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="p-4 grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Truck className="w-4 h-4 text-[#7CB342]" />
              <p className="text-xs text-slate-600">My Vehicles</p>
            </div>
            <p className="text-2xl font-bold text-slate-800">{myVehicles.length}</p>
          </CardContent>
        </Card>

      </div>

      {/* Main Content */}
      <div className="p-4">
        {activeTab === 'vehicles' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800">My Vehicles</h2>
            </div>
            {myVehicles.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Truck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-600">No vehicles assigned</p>
                </CardContent>
              </Card>
            ) : (
              myVehicles.map(vehicle => (
                <MobileVehicleCard 
                  key={vehicle.id} 
                  vehicle={vehicle}
                  onReportIssue={() => setIssueModalOpen(vehicle)}
                />
              ))
            )}
          </div>
        )}


        {activeTab === 'issues' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800">My Issues</h2>
              <Button 
                onClick={() => setIssueModalOpen(true)}
                className="bg-[#7CB342] hover:bg-[#689F38]"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-1" />
                Report
              </Button>
            </div>

            {openIssues.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-semibold text-slate-700 mb-2">Open Issues</p>
                {openIssues.map(issue => (
                  <Card key={issue.id} className="mb-2">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-semibold text-slate-800">{issue.vehicle_name}</p>
                        <Badge className={
                          issue.severity === 'critical' ? 'bg-red-500' :
                          issue.severity === 'high' ? 'bg-orange-500' :
                          issue.severity === 'medium' ? 'bg-yellow-500' :
                          'bg-blue-500'
                        }>
                          {issue.severity}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-600 mb-2">{issue.description}</p>
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>{moment(issue.created_date).fromNow()}</span>
                        <Badge variant="outline" className={
                          issue.status === 'in_progress' ? 'border-blue-500 text-blue-700' : 'border-slate-300'
                        }>
                          {issue.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {myIssues.filter(i => i.status === 'resolved' || i.status === 'closed').slice(0, 5).length > 0 && (
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-2">Recently Resolved</p>
                {myIssues.filter(i => i.status === 'resolved' || i.status === 'closed').slice(0, 5).map(issue => (
                  <Card key={issue.id} className="mb-2 opacity-75">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-semibold text-slate-800 text-sm">{issue.vehicle_name}</p>
                          <p className="text-xs text-slate-600">{issue.description}</p>
                        </div>
                        <CheckCircle className="w-5 h-5 text-green-600 ml-2" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {myIssues.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center">
                  <AlertTriangle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-600 mb-2">No issues reported</p>
                  <Button 
                    onClick={() => setIssueModalOpen(true)}
                    variant="outline"
                    size="sm"
                  >
                    Report an Issue
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg">
        <div className="grid grid-cols-3 gap-1 p-2">
          <button
            onClick={() => setActiveTab('vehicles')}
            className={`flex flex-col items-center py-2 px-3 rounded-lg transition-colors ${
              activeTab === 'vehicles' 
                ? 'bg-[#7CB342] text-white' 
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Truck className="w-5 h-5 mb-1" />
            <span className="text-xs font-medium">Vehicles</span>
          </button>
          <button
            onClick={() => setActiveTab('issues')}
            className={`flex flex-col items-center py-2 px-3 rounded-lg transition-colors ${
              activeTab === 'issues' 
                ? 'bg-[#7CB342] text-white' 
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <AlertTriangle className="w-5 h-5 mb-1" />
            <span className="text-xs font-medium">Issues</span>
            {openIssues.length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            )}
          </button>
        </div>
      </div>

      {issueModalOpen && (
        <MobileIssueReport
          open={!!issueModalOpen}
          onClose={() => setIssueModalOpen(false)}
          vehicles={myVehicles}
          preselectedVehicle={typeof issueModalOpen === 'object' ? issueModalOpen : null}
        />
      )}
    </div>
  );
}
