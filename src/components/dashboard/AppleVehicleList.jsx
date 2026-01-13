import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Download, ChevronDown, ChevronUp, ChevronRight, Truck, Filter } from 'lucide-react';
import moment from 'moment';
import AppleButton from '@/components/ui/AppleButton';
import { usePermissions } from '@/components/auth/PermissionGuard';
import { FavoriteButton } from '@/components/dashboard/FavoriteVehicles';
import VehicleProfileModal from '@/components/vehicles/VehicleProfileModal';

/**
 * Apple-style Vehicle List
 * Replaces the table-based vehicle display with spacious, interactive cards
 */
export default function AppleVehicleList({ vehicles, scans, searchQuery, setSearchQuery }) {
  const permissions = usePermissions();
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [selectedVehicleForProfile, setSelectedVehicleForProfile] = useState(null);
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedVehicleId, setExpandedVehicleId] = useState(null);
  const itemsPerPage = 10;

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

  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v =>
      v.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.rfid?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [vehicles, searchQuery]);

  const sortedVehicles = useMemo(() => {
    return [...filteredVehicles].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      if (sortDirection === 'asc') return aVal > bVal ? 1 : -1;
      return aVal < bVal ? 1 : -1;
    });
  }, [filteredVehicles, sortField, sortDirection]);

  const totalPages = Math.ceil(sortedVehicles.length / itemsPerPage);
  const paginatedVehicles = sortedVehicles.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const exportToCSV = () => {
    const headers = ['Vehicle', 'RFID', 'Site', 'Washes', 'Target', 'Status', 'Progress', 'Last Scan'];
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

  const getVehicleScans = (vehicleRef) => {
    if (!scans) return [];
    const filtered = scans.filter(scan => scan.vehicleRef === vehicleRef);
    const uniqueScans = filtered.reduce((acc, scan) => {
      const key = `${scan.timestamp}_${scan.scanRef || scan.washNumber || ''}`;
      if (!acc.find(s => `${s.timestamp}_${s.scanRef || s.washNumber || ''}` === key)) {
        acc.push(scan);
      }
      return acc;
    }, []);
    return uniqueScans.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Vehicle Compliance
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {sortedVehicles.length} vehicles total
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search vehicles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="
                h-10 pl-10 pr-4 w-64 rounded-xl
                bg-white/80 dark:bg-zinc-900/80
                border border-gray-200/50 dark:border-zinc-800/50
                backdrop-blur-xl
                text-sm text-gray-900 dark:text-white
                placeholder:text-gray-400
                focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500
                transition-all
              "
            />
          </div>

          {/* Sort */}
          <div className="
            flex items-center gap-2 h-10 px-4 rounded-xl
            bg-white/80 dark:bg-zinc-900/80
            border border-gray-200/50 dark:border-zinc-800/50
            backdrop-blur-xl
          ">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value)}
              className="
                bg-transparent border-0 text-sm text-gray-700 dark:text-gray-300
                focus:outline-none focus:ring-0
              "
            >
              <option value="name">Name</option>
              <option value="washes_completed">Washes</option>
              <option value="site_name">Site</option>
              <option value="last_scan">Last Scan</option>
            </select>
            <button onClick={() => setSortDirection(d => d === 'asc' ? 'desc' : 'asc')}>
              {sortDirection === 'asc' ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </button>
          </div>

          {/* Export */}
          {permissions.canExportData && (
            <AppleButton variant="secondary" icon={Download} onClick={exportToCSV}>
              Export
            </AppleButton>
          )}
        </div>
      </div>

      {/* Vehicle List */}
      {paginatedVehicles.length === 0 ? (
        <EmptyState searchQuery={searchQuery} />
      ) : (
        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: { opacity: 1, transition: { staggerChildren: 0.03 } },
          }}
          className="space-y-3"
        >
          {paginatedVehicles.map((vehicle, index) => (
            <VehicleCard
              key={vehicle.id}
              vehicle={vehicle}
              index={index}
              scans={getVehicleScans(vehicle.id)}
              isExpanded={expandedVehicleId === vehicle.id}
              onToggleExpand={() => setExpandedVehicleId(expandedVehicleId === vehicle.id ? null : vehicle.id)}
              onViewProfile={() => {
                setSelectedVehicleForProfile(vehicle);
                setProfileModalOpen(true);
              }}
              userEmail={userEmail}
            />
          ))}
        </motion.div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={sortedVehicles.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />
      )}

      {/* Vehicle Profile Modal */}
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

/**
 * Individual Vehicle Card
 */
function VehicleCard({ vehicle, index, scans, isExpanded, onToggleExpand, onViewProfile, userEmail }) {
  const isCompliant = vehicle.washes_completed >= vehicle.target;
  const progress = vehicle.target > 0 ? Math.min(100, Math.round((vehicle.washes_completed / vehicle.target) * 100)) : 0;

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 10 },
        show: { opacity: 1, y: 0 },
      }}
      transition={{ duration: 0.3 }}
      className="
        backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80
        border border-gray-200/20 dark:border-zinc-800/50
        rounded-2xl overflow-hidden
        shadow-sm shadow-black/[0.02]
        hover:shadow-md hover:shadow-black/[0.04]
        transition-all duration-200
      "
    >
      {/* Main content row */}
      <motion.div
        whileHover={{ backgroundColor: 'rgba(0,0,0,0.02)' }}
        whileTap={{ scale: 0.995 }}
        onClick={onToggleExpand}
        className="p-5 cursor-pointer"
      >
        <div className="flex items-center gap-4">
          {/* Status indicator */}
          <div
            className={`w-3 h-3 rounded-full flex-shrink-0 ${
              isCompliant ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
          />

          {/* Favorite button */}
          {userEmail && (
            <div onClick={(e) => e.stopPropagation()}>
              <FavoriteButton
                vehicleRef={vehicle.id}
                vehicleName={vehicle.name}
                userEmail={userEmail}
              />
            </div>
          )}

          {/* Main info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onViewProfile();
                }}
                className="font-semibold text-lg text-gray-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
              >
                {vehicle.name}
              </button>
              {isCompliant && (
                <span className="px-2 py-0.5 text-xs font-medium bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-full">
                  Compliant
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {vehicle.site_name && <span>{vehicle.site_name} </span>}
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <span className="ml-1 font-mono text-xs">{vehicle.rfid}</span>
            </p>
          </div>

          {/* Metric */}
          <div className="text-right flex-shrink-0 mr-2">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {vehicle.washes_completed}
              <span className="text-sm font-normal text-gray-400">/{vehicle.target}</span>
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Last: {vehicle.last_scan ? moment(vehicle.last_scan).fromNow() : 'Never'}
            </p>
          </div>

          {/* Expand indicator */}
          <ChevronRight
            className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
              isExpanded ? 'rotate-90' : ''
            }`}
          />
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-1.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className={`h-full rounded-full ${
              isCompliant
                ? 'bg-emerald-500'
                : progress >= 75
                ? 'bg-amber-500'
                : 'bg-red-500'
            }`}
          />
        </div>
      </motion.div>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-gray-100 dark:border-zinc-800"
          >
            <div className="p-5 bg-gray-50/50 dark:bg-zinc-900/50">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Recent Wash History
              </h3>
              {scans.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No wash history for the selected period.
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
                  {scans.slice(0, 5).map((scan, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-white dark:bg-zinc-900 rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            {idx + 1}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {moment(scan.timestamp).format('MMM D, YYYY')}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {moment(scan.timestamp).format('h:mm A')} | {scan.siteName || vehicle.site_name}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-medium px-2 py-1 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-full">
                        Wash
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/**
 * Empty State
 */
function EmptyState({ searchQuery }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="
        backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80
        border border-gray-200/20 dark:border-zinc-800/50
        rounded-2xl p-12 text-center
      "
    >
      <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center">
        <Truck className="w-10 h-10 text-gray-400 dark:text-gray-500" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
        {searchQuery ? 'No vehicles found' : 'No vehicles yet'}
      </h3>
      <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
        {searchQuery
          ? `No vehicles match "${searchQuery}". Try a different search term.`
          : 'Add your first vehicle to start tracking compliance.'}
      </p>
    </motion.div>
  );
}

/**
 * Pagination
 */
function Pagination({ currentPage, totalPages, totalItems, itemsPerPage, onPageChange }) {
  return (
    <div className="flex items-center justify-between pt-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="
            h-9 w-9 rounded-full flex items-center justify-center
            text-gray-600 dark:text-gray-400
            hover:bg-gray-100 dark:hover:bg-zinc-800
            disabled:opacity-40 disabled:cursor-not-allowed
            transition-colors
          "
        >
          <ChevronDown className="w-4 h-4 -rotate-90" />
        </button>

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
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum)}
              className={`
                h-9 w-9 rounded-full text-sm font-medium
                transition-colors
                ${
                  currentPage === pageNum
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800'
                }
              `}
            >
              {pageNum}
            </button>
          );
        })}

        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="
            h-9 w-9 rounded-full flex items-center justify-center
            text-gray-600 dark:text-gray-400
            hover:bg-gray-100 dark:hover:bg-zinc-800
            disabled:opacity-40 disabled:cursor-not-allowed
            transition-colors
          "
        >
          <ChevronDown className="w-4 h-4 rotate-90" />
        </button>
      </div>
    </div>
  );
}
