import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Download, TrendingUp, TrendingDown } from 'lucide-react';
import moment from 'moment';

export default function DrillDownModal({ open, onClose, type, data }) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredData = useMemo(() => {
    if (!data || !searchQuery) return data;

    if (type === 'compliance') {
      return data.filter(v =>
        v.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.rfid?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.site_name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (type === 'site') {
      return data.filter(s =>
        s.site?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return data;
  }, [data, searchQuery, type]);

  const exportData = () => {
    if (!filteredData) return;

    let csvData = [];
    let filename = '';

    if (type === 'compliance') {
      filename = 'vehicle_compliance_detail';
      csvData = filteredData.map(v => ({
        Vehicle: v.name,
        RFID: v.rfid,
        Site: v.site_name,
        'Washes Completed': v.washes_completed,
        Target: v.target,
        'Compliance %': Math.round((v.washes_completed / v.target) * 100),
        Status: v.washes_completed >= v.target ? 'Compliant' : 'Non-Compliant',
        'Last Scan': moment(v.last_scan).format('YYYY-MM-DD HH:mm')
      }));
    } else if (type === 'site') {
      filename = 'site_performance_detail';
      csvData = filteredData.map(s => ({
        Site: s.site,
        'Total Washes': s.washes
      }));
    }

    const headers = Object.keys(csvData[0] || {});
    const rows = csvData.map(row => headers.map(h => row[h] || '').join(','));
    const csv = [headers.join(','), ...rows].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${moment().format('YYYY-MM-DD')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const renderComplianceView = () => {
    if (!filteredData) return null;

    return (
      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {filteredData.map((vehicle, idx) => {
          const compliance = Math.round((vehicle.washes_completed / vehicle.target) * 100);
          const isCompliant = vehicle.washes_completed >= vehicle.target;

          return (
            <div key={idx} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-semibold text-slate-800">{vehicle.name}</p>
                  <p className="text-sm text-slate-600">{vehicle.rfid} • {vehicle.site_name}</p>
                </div>
                <Badge className={isCompliant ? 'bg-emerald-500' : 'bg-red-500'}>
                  {isCompliant ? 'Compliant' : 'Non-Compliant'}
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-3">
                <div>
                  <p className="text-xs text-slate-500">Washes</p>
                  <p className="text-lg font-bold text-slate-800">{vehicle.washes_completed}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Target</p>
                  <p className="text-lg font-bold text-slate-800">{vehicle.target}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Rate</p>
                  <div className="flex items-center gap-1">
                    <p className="text-lg font-bold text-slate-800">{compliance}%</p>
                    {compliance >= 100 ? (
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-600" />
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-3 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${isCompliant ? 'bg-emerald-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(compliance, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderSiteView = () => {
    if (!filteredData) return null;

    const totalWashes = filteredData.reduce((sum, s) => sum + s.washes, 0);

    return (
      <div className="space-y-4">
        <div className="p-4 bg-[#7CB342]/10 rounded-lg border border-[#7CB342]/20">
          <p className="text-sm text-slate-600">Total Washes Across All Sites</p>
          <p className="text-3xl font-bold text-slate-800">{totalWashes.toLocaleString()}</p>
        </div>
        
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {filteredData.map((site, idx) => {
            const percentage = ((site.washes / totalWashes) * 100).toFixed(1);
            
            return (
              <div key={idx} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-slate-800">{site.site}</p>
                  <Badge className="bg-[#7CB342]">{site.washes} washes</Badge>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-3 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#7CB342]"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-sm text-slate-600 w-12 text-right">{percentage}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const getTitle = () => {
    if (type === 'compliance') return 'Vehicle Compliance Details';
    if (type === 'site') return 'Site Performance Details';
    return 'Details';
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" onClick={exportData}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {type === 'compliance' && renderComplianceView()}
          {type === 'site' && renderSiteView()}
        </div>

        {filteredData && (
          <div className="pt-4 border-t border-slate-200 text-sm text-slate-600">
            Showing {filteredData.length} result{filteredData.length !== 1 ? 's' : ''}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}