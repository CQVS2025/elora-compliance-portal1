import React, { useState } from 'react';
import { Search, Download, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ChevronRight as ChevronRightIcon, Truck } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from 'framer-motion';
import moment from 'moment';
import { useQueryClient } from '@tanstack/react-query';
import VehicleProfileModal from '@/components/vehicles/VehicleProfileModal';
import { usePermissions } from '@/components/auth/PermissionGuard';
import { FavoriteButton } from '@/components/dashboard/FavoriteVehicles';

export default function VehicleTable({ vehicles, scans, searchQuery, setSearchQuery }) {
  const permissions = usePermissions();
  const queryClient = useQueryClient();
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [selectedVehicleForProfile, setSelectedVehicleForProfile] = useState(null);
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedVehicleId, setExpandedVehicleId] = useState(null);
  const itemsPerPage = 10;

  // Get user email for favorites functionality
  const userEmail = typeof window !== 'undefined'
    ? localStorage.getItem('userEmail') || sessionStorage.getItem('userEmail')
    : null;

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredVehicles = vehicles.filter(v => 
    (v.name ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (v.rfid ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedVehicles = [...filteredVehicles].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];
    if (typeof aVal === 'string') aVal = aVal.toLowerCase();
    if (typeof bVal === 'string') bVal = bVal.toLowerCase();
    if (sortDirection === 'asc') return aVal > bVal ? 1 : -1;
    return aVal < bVal ? 1 : -1;
  });

  const totalPages = Math.ceil(sortedVehicles.length / itemsPerPage);
  const paginatedVehicles = sortedVehicles.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const exportToCSV = () => {
    const headers = ['Vehicle', 'RFID', 'Site', 'Washes Completed', 'Target', 'Status', 'Progress', 'Last Scan'];
    const rows = sortedVehicles.map(v => [
      v.name,
      v.rfid,
      v.site_name,
      v.washes_completed,
      v.target,
      v.washes_completed >= v.target ? 'Compliant' : 'Non-Compliant',
      `${Math.round((v.washes_completed / v.target) * 100)}%`,
      moment(v.last_scan).fromNow()
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vehicle-compliance.csv';
    a.click();
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? 
      <ChevronUp className="w-4 h-4 inline ml-1" /> : 
      <ChevronDown className="w-4 h-4 inline ml-1" />;
  };

  const getVehicleScans = (vehicleRef, vehicle = null) => {
    if (!scans) return [];
    const ts = (s) => s.createdAt ?? s.timestamp ?? 0;
    // Include scans that match vehicleRef, vehicleName, or deviceRef (so null vehicleRef still shows when device matches)
    const filtered = scans.filter(scan => {
      if (scan.vehicleRef === vehicleRef || scan.vehicleName === vehicle?.name) return true;
      if (vehicle && (scan.deviceRef === vehicle.device_ref || scan.deviceRef === vehicle.id)) return true;
      return false;
    });
    const uniqueScans = filtered.reduce((acc, scan) => {
      const key = `${ts(scan)}_${scan.scanRef || scan.washNumber || ''}`;
      if (!acc.find(s => `${ts(s)}_${s.scanRef || s.washNumber || ''}` === key)) acc.push(scan);
      return acc;
    }, []);
    return uniqueScans.sort((a, b) => new Date(ts(b)) - new Date(ts(a)));
  };

  const columns = [
    { key: 'name', label: 'Vehicle' },
    { key: 'rfid', label: 'RFID' },
    { key: 'site_name', label: 'Site' },
    { key: 'washes_completed', label: 'Washes' },
    { key: 'target', label: 'Target' },
    { key: 'status', label: 'Status' },
    { key: 'progress', label: 'Progress' },
    { key: 'last_scan', label: 'Last Scan' },
  ];

  return (
    <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-foreground">Vehicle Compliance Status</h2>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search vehicles or RFID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-64 border-border focus-visible:ring-primary"
              />
            </div>
            {permissions.canExportData && (
              <Button 
                variant="outline" 
                onClick={exportToCSV}
                className="border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300"
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {paginatedVehicles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-24 h-24 mb-6 rounded-full bg-muted flex items-center justify-center">
              <Truck className="w-12 h-12 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">
              {searchQuery ? 'No vehicles found' : 'Welcome! Get started with your fleet'}
            </h3>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              {searchQuery
                ? `No vehicles match "${searchQuery}". Try a different search term.`
                : 'Add your first vehicle to start tracking compliance and wash history.'
              }
            </p>
            {!searchQuery && permissions.canEditVehicles && (
              <div className="space-y-3 text-sm text-muted-foreground bg-muted rounded-lg p-4 max-w-md">
                <p className="font-semibold text-foreground">Quick Start Guide:</p>
                <ol className="list-decimal list-inside space-y-2">
                  <li>Import your vehicles with RFID tags</li>
                  <li>Assign vehicles to sites</li>
                  <li>Set compliance targets</li>
                  <li>Start tracking washes automatically</li>
                </ol>
              </div>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-[#0F172A]">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider cursor-pointer hover:bg-muted-foreground transition-colors"
                  >
                    {col.label}
                    <SortIcon field={col.key} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {paginatedVehicles.map((vehicle, index) => {
                const isCompliant = vehicle.washes_completed >= vehicle.target;
                const progress = Math.min(100, Math.round((vehicle.washes_completed / vehicle.target) * 100));
                const isExpanded = expandedVehicleId === vehicle.id;
                const vehicleScans = getVehicleScans(vehicle.id, vehicle);
                
                return (
                  <React.Fragment key={vehicle.id}>
                    <motion.tr
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2, delay: index * 0.03 }}
                      onClick={() => setExpandedVehicleId(isExpanded ? null : vehicle.id)}
                      className={`border-b border-border cursor-pointer transition-colors hover:bg-primary/5 ${
                        index % 2 === 0 ? 'bg-card' : 'bg-muted/50'
                      } ${isExpanded ? 'bg-[rgba(124,179,66,0.08)]' : ''}`}
                    >
                      <td className="px-4 py-4 font-semibold text-foreground">
                        <div className="flex items-center gap-2">
                          <ChevronRightIcon
                            className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          />
                          {userEmail && (
                            <FavoriteButton
                              vehicleRef={vehicle.id}
                              vehicleName={vehicle.name}
                              userEmail={userEmail}
                            />
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedVehicleForProfile(vehicle);
                              setProfileModalOpen(true);
                            }}
                            className="hover:text-primary hover:underline transition-colors"
                          >
                            {vehicle.name}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-4 font-mono text-sm text-muted-foreground">{vehicle.rfid}</td>
                      <td className="px-4 py-4 text-foreground">{vehicle.site_name}</td>
                      <td className="px-4 py-4 text-foreground">{vehicle.washes_completed}</td>
                      <td className="px-4 py-4 text-muted-foreground">{vehicle.target}</td>
                      <td className="px-4 py-4">
                        <Badge 
                          className={`px-3 py-1 text-xs font-medium ${
                            isCompliant 
                              ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                              : 'bg-red-500 text-white hover:bg-red-600'
                          }`}
                        >
                          {isCompliant ? 'Compliant' : 'Non-Compliant'}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 w-32">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full rounded-full transition-all duration-500"
                              style={{ 
                                width: `${progress}%`,
                                background: 'linear-gradient(90deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.8) 100%)'
                              }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-10">{progress}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-muted-foreground">
                        {moment(vehicle.last_scan).fromNow()}
                      </td>
                    </motion.tr>
                    
                    {isExpanded && (
                      <motion.tr
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-muted border-b border-border"
                      >
                        <td colSpan={8} className="px-4 py-4">
                          <div className="ml-6 space-y-4">
                            {/* Wash History */}
                            <div className="bg-card rounded-lg border border-border p-4">
                              <h3 className="text-sm font-bold text-foreground mb-3">Wash History</h3>
                              {vehicleScans.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No wash history available for the selected period.</p>
                              ) : (
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                  {vehicleScans.map((scan, scanIndex) => (
                                    <div 
                                      key={scanIndex}
                                      className="flex items-center justify-between py-2 px-3 bg-muted rounded border border-border hover:bg-muted/80 transition-colors"
                                    >
                                      <div className="flex items-center gap-4">
                                        <div>
                                          <p className="text-sm font-semibold text-foreground">
                                            {moment(scan.timestamp).format('MMM D, YYYY')}
                                          </p>
                                          <p className="text-xs text-muted-foreground">
                                            {moment(scan.timestamp).format('h:mm:ss A')}
                                          </p>
                                        </div>
                                        <div className="h-8 w-px bg-border" />
                                        <div>
                                          <p className="text-sm text-foreground">{scan.siteName || vehicle.site_name}</p>
                                          <p className="text-xs text-muted-foreground">
                                            {scan.scanRef ? `Scan #${scan.scanRef}` : 'Site'}
                                          </p>
                                        </div>
                                      </div>
                                      <Badge className="bg-primary/10 text-primary hover:bg-primary/20">
                                        {scan.washType || scan.washNumber || 'Wash'}
                                      </Badge>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                          </div>
                        </td>
                      </motion.tr>
                    )}
                  </React.Fragment>
                );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div className="px-6 py-4 border-t border-border flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, sortedVehicles.length)} of {sortedVehicles.length} vehicles
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="border-border"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (currentPage <= 3) {
              pageNum = i + 1;
            } else if (currentPage >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = currentPage - 2 + i;
            }
            return (
              <Button
                key={pageNum}
                variant={currentPage === pageNum ? "default" : "outline"}
                size="sm"
                onClick={() => setCurrentPage(pageNum)}
                className={currentPage === pageNum ? 'bg-primary hover:bg-primary/90' : 'border-border'}
              >
                {pageNum}
              </Button>
            );
          })}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="border-border"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {selectedVehicleForProfile && (
        <VehicleProfileModal
          open={profileModalOpen}
          onClose={() => {
            setProfileModalOpen(false);
            setSelectedVehicleForProfile(null);
          }}
          vehicle={selectedVehicleForProfile}
          scans={scans}
        />
      )}
      </div>
      );
      }