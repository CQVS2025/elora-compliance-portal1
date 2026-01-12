import React, { useState } from 'react';
import { Search, Download, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ChevronRight as ChevronRightIcon, Truck, Plus, Wrench } from 'lucide-react';
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

  // Placeholder for maintenance data - can be enhanced later
  const vehicleMaintenance = [];

  const handleAddMaintenance = (vehicle, e) => {
    e.stopPropagation();
    // TODO: Implement add maintenance functionality
    console.log('Add maintenance for vehicle:', vehicle.name);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredVehicles = vehicles.filter(v => 
    v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.rfid.toLowerCase().includes(searchQuery.toLowerCase())
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

  const getVehicleScans = (vehicleRef) => {
    if (!scans) return [];
    
    // Filter scans for this vehicle and remove duplicates based on timestamp
    const filtered = scans.filter(scan => scan.vehicleRef === vehicleRef);
    
    // Remove exact duplicates by creating unique key from timestamp + scanRef
    const uniqueScans = filtered.reduce((acc, scan) => {
      const key = `${scan.timestamp}_${scan.scanRef || scan.washNumber || ''}`;
      if (!acc.find(s => `${s.timestamp}_${s.scanRef || s.washNumber || ''}` === key)) {
        acc.push(scan);
      }
      return acc;
    }, []);
    
    return uniqueScans.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
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
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-slate-800">Vehicle Compliance Status</h2>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search vehicles or RFID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-64 border-slate-200 focus-visible:ring-[#7CB342]"
              />
            </div>
            {permissions.canExportData && (
              <Button 
                variant="outline" 
                onClick={exportToCSV}
                className="border-[#7CB342] text-[#7CB342] hover:bg-[#7CB342] hover:text-white transition-all duration-300"
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
            <div className="w-24 h-24 mb-6 rounded-full bg-slate-100 flex items-center justify-center">
              <Truck className="w-12 h-12 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">
              {searchQuery ? 'No vehicles found' : 'Welcome! Get started with your fleet'}
            </h3>
            <p className="text-slate-600 text-center max-w-md mb-6">
              {searchQuery
                ? `No vehicles match "${searchQuery}". Try a different search term.`
                : 'Add your first vehicle to start tracking compliance and wash history.'
              }
            </p>
            {!searchQuery && permissions.canEditVehicles && (
              <div className="space-y-3 text-sm text-slate-600 bg-slate-50 rounded-lg p-4 max-w-md">
                <p className="font-semibold text-slate-800">Quick Start Guide:</p>
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
                    className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider cursor-pointer hover:bg-slate-700 transition-colors"
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
                const vehicleScans = getVehicleScans(vehicle.id);
                
                return (
                  <React.Fragment key={vehicle.id}>
                    <motion.tr
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2, delay: index * 0.03 }}
                      onClick={() => setExpandedVehicleId(isExpanded ? null : vehicle.id)}
                      className={`border-b border-slate-100 cursor-pointer transition-colors hover:bg-[rgba(124,179,66,0.08)] ${
                        index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                      } ${isExpanded ? 'bg-[rgba(124,179,66,0.08)]' : ''}`}
                    >
                      <td className="px-4 py-4 font-semibold text-slate-800">
                        <div className="flex items-center gap-2">
                          <ChevronRightIcon
                            className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
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
                            className="hover:text-[#7CB342] hover:underline transition-colors"
                          >
                            {vehicle.name}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-4 font-mono text-sm text-slate-500">{vehicle.rfid}</td>
                      <td className="px-4 py-4 text-slate-700">{vehicle.site_name}</td>
                      <td className="px-4 py-4 text-slate-800">{vehicle.washes_completed}</td>
                      <td className="px-4 py-4 text-slate-500">{vehicle.target}</td>
                      <td className="px-4 py-4">
                        <Badge 
                          className={`px-3 py-1 text-xs font-medium ${
                            isCompliant 
                              ? 'bg-emerald-500 text-white hover:bg-emerald-600' 
                              : 'bg-red-500 text-white hover:bg-red-600'
                          }`}
                        >
                          {isCompliant ? 'Compliant' : 'Non-Compliant'}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 w-32">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full rounded-full transition-all duration-500"
                              style={{ 
                                width: `${progress}%`,
                                background: 'linear-gradient(90deg, #7CB342 0%, #9CCC65 100%)'
                              }}
                            />
                          </div>
                          <span className="text-xs text-slate-500 w-10">{progress}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-500">
                        {moment(vehicle.last_scan).fromNow()}
                      </td>
                    </motion.tr>
                    
                    {isExpanded && (
                      <motion.tr
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-slate-50 border-b border-slate-100"
                      >
                        <td colSpan={8} className="px-4 py-4">
                          <div className="ml-6 space-y-4">
                            {/* Wash History */}
                            <div className="bg-white rounded-lg border border-slate-200 p-4">
                              <h3 className="text-sm font-bold text-slate-800 mb-3">Wash History</h3>
                              {vehicleScans.length === 0 ? (
                                <p className="text-sm text-slate-500">No wash history available for the selected period.</p>
                              ) : (
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                  {vehicleScans.map((scan, scanIndex) => (
                                    <div 
                                      key={scanIndex}
                                      className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded border border-slate-100 hover:bg-slate-100 transition-colors"
                                    >
                                      <div className="flex items-center gap-4">
                                        <div>
                                          <p className="text-sm font-semibold text-slate-800">
                                            {moment(scan.timestamp).format('MMM D, YYYY')}
                                          </p>
                                          <p className="text-xs text-slate-500">
                                            {moment(scan.timestamp).format('h:mm:ss A')}
                                          </p>
                                        </div>
                                        <div className="h-8 w-px bg-slate-200" />
                                        <div>
                                          <p className="text-sm text-slate-700">{scan.siteName || vehicle.site_name}</p>
                                          <p className="text-xs text-slate-500">
                                            {scan.scanRef ? `Scan #${scan.scanRef}` : 'Site'}
                                          </p>
                                        </div>
                                      </div>
                                      <Badge className="bg-[#7CB342]/10 text-[#7CB342] hover:bg-[#7CB342]/20">
                                        {scan.washType || scan.washNumber || 'Wash'}
                                      </Badge>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Maintenance History */}
                            <div className="bg-white rounded-lg border border-slate-200 p-4">
                              <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-bold text-slate-800">Maintenance History</h3>
                                {permissions.user && permissions.canEditVehicles && (
                                  <Button
                                    size="sm"
                                    onClick={(e) => handleAddMaintenance(vehicle, e)}
                                    className="bg-[#7CB342] hover:bg-[#689F38]"
                                  >
                                    <Plus className="w-3 h-3 mr-1" />
                                    Add Service
                                  </Button>
                                )}
                              </div>
                              {vehicleMaintenance.length === 0 ? (
                                <p className="text-sm text-slate-500">No maintenance records yet</p>
                              ) : (
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                  {vehicleMaintenance.map((record, idx) => (
                                    <div 
                                      key={idx}
                                      className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded border border-slate-100"
                                    >
                                      <div className="flex items-center gap-4">
                                        <Wrench className="w-4 h-4 text-[#7CB342]" />
                                        <div>
                                          <p className="text-sm font-semibold text-slate-800">
                                            {record.service_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                          </p>
                                          <p className="text-xs text-slate-500">
                                            {moment(record.service_date).format('MMM D, YYYY')}
                                            {record.cost && ` • $${record.cost.toFixed(2)}`}
                                          </p>
                                        </div>
                                      </div>
                                      {record.next_service_date && (
                                        <div className="text-right">
                                          <p className="text-xs text-slate-600">Next Service</p>
                                          <p className="text-xs font-semibold text-slate-800">
                                            {moment(record.next_service_date).format('MMM D, YYYY')}
                                          </p>
                                        </div>
                                      )}
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
      <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, sortedVehicles.length)} of {sortedVehicles.length} vehicles
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="border-slate-200"
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
                className={currentPage === pageNum ? 'bg-[#7CB342] hover:bg-[#689F38]' : 'border-slate-200'}
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
            className="border-slate-200"
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