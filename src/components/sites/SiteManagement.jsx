import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseClient } from "@/api/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Plus, MapPin, Phone, Mail, Building2, Edit, Trash2, AlertCircle, Truck } from 'lucide-react';
import SiteModal from './SiteModal';
import AssignVehiclesModal from './AssignVehiclesModal';
import { motion, AnimatePresence } from 'framer-motion';
import DataPagination from '@/components/ui/DataPagination';

export default function SiteManagement({ customers, vehicles, selectedCustomer }) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedSite, setSelectedSite] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  const { data: allSites = [], isLoading, error: sitesError } = useQuery({
    queryKey: ['sites'],
    queryFn: async () => {
      try {
        const response = await supabaseClient.elora.sites({});
        const data = response?.data ?? response ?? [];
        // Map the API response to match the component's expected format
        return data.map(s => ({
          id: s.ref,
          name: s.siteName || s.name || 'Unnamed Site',
          customer_ref: s.customerRef,
          customer_name: customers?.find(c => c.id === s.customerRef)?.name || s.customerName,
          address: s.address || '',
          city: s.city || '',
          state: s.state || '',
          postal_code: s.postalCode || s.postal_code || '',
          contact_name: s.contactName || s.contact_name || '',
          contact_phone: s.contactPhone || s.contact_phone || '',
          contact_email: s.contactEmail || s.contact_email || '',
          status: s.status || 'active',
        }));
      } catch (error) {
        console.error('Error fetching sites:', error);
        throw error;
      }
    },
    retry: 1,
    staleTime: 30000,
  });

  // Apply customer filter from Dashboard
  const sites = useMemo(() => {
    if (!selectedCustomer || selectedCustomer === 'all') return allSites;
    return allSites.filter(s => s.customer_ref === selectedCustomer);
  }, [allSites, selectedCustomer]);

  const deleteMutation = useMutation({
    mutationFn: async (siteId) => {
      // Note: Sites are managed via Elora API, deletion may need to be handled differently
      // For now, we'll just invalidate the cache
      console.warn('Site deletion via Elora API not yet implemented');
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['sites']);
    }
  });

  const handleEdit = (site) => {
    setSelectedSite(site);
    setModalOpen(true);
  };

  const handleDelete = async (site) => {
    if (confirm(`Are you sure you want to delete "${site.name}"?`)) {
      deleteMutation.mutate(site.id);
    }
  };

  const handleAddNew = () => {
    setSelectedSite(null);
    setModalOpen(true);
  };

  const handleAssignVehicles = (site) => {
    setSelectedSite(site);
    setAssignModalOpen(true);
  };

  const getAssignedVehicles = (siteId) => {
    return vehicles?.filter(v => v.site_id === siteId) || [];
  };

  const filteredSites = useMemo(() => {
    return (sites || []).filter(site =>
      site.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (site.customer_name && site.customer_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (site.city && site.city.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [sites, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredSites.length / itemsPerPage);
  const paginatedSites = useMemo(() => {
    return filteredSites.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    );
  }, [filteredSites, currentPage, itemsPerPage]);

  // Reset to page 1 when search or filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCustomer]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-500 text-white';
      case 'inactive':
        return 'bg-slate-500 text-white';
      case 'maintenance':
        return 'bg-orange-500 text-white';
      default:
        return 'bg-slate-500 text-white';
    }
  };

  // Show error state if sites failed to load
  if (sitesError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 bg-white rounded-2xl border border-red-100">
        <div className="w-24 h-24 mb-6 rounded-full bg-red-100 flex items-center justify-center">
          <AlertCircle className="w-12 h-12 text-red-500" />
        </div>
        <h3 className="text-xl font-bold text-slate-800 mb-2">Failed to Load Sites</h3>
        <p className="text-slate-600 text-center max-w-md mb-6">
          {sitesError?.message || 'An error occurred while loading sites. Please try again.'}
        </p>
        <Button 
          onClick={() => queryClient.invalidateQueries(['sites'])} 
          className="bg-[#7CB342] hover:bg-[#689F38]"
        >
          Retry
        </Button>
      </div>
    );
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-12 h-12 border-4 border-[#7CB342] border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-600">Loading sites...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Site Management</h2>
          <p className="text-slate-600 mt-1">Manage wash station locations and contact information</p>
        </div>
        <Button onClick={handleAddNew} className="bg-[#7CB342] hover:bg-[#689F38]">
          <Plus className="w-4 h-4 mr-2" />
          Add New Site
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Search sites by name, customer, or city..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 border-slate-200"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#7CB342]/10 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-[#7CB342]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{sites?.length || 0}</p>
                <p className="text-sm text-slate-600">Total Sites</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">
                  {(sites || []).filter(s => s.status === 'active').length}
                </p>
                <p className="text-sm text-slate-600">Active Sites</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">
                  {(sites || []).filter(s => s.status === 'maintenance').length}
                </p>
                <p className="text-sm text-slate-600">In Maintenance</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Site Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence>
          {paginatedSites.map((site, index) => (
            <motion.div
              key={site.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="hover:shadow-lg transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-800 text-lg mb-1">{site.name}</h3>
                      {site.customer_name && (
                        <p className="text-sm text-slate-600">{site.customer_name}</p>
                      )}
                    </div>
                    <Badge className={getStatusColor(site.status)}>
                      {site.status}
                    </Badge>
                  </div>

                  <div className="space-y-2 mb-4">
                    {(site.address || site.city || site.state) && (
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
                        <div className="text-sm text-slate-600">
                          {site.address && <p>{site.address}</p>}
                          <p>
                            {[site.city, site.state, site.postal_code].filter(Boolean).join(', ')}
                          </p>
                        </div>
                      </div>
                    )}

                    {site.contact_name && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-slate-400" />
                        <p className="text-sm text-slate-600">
                          {site.contact_name}
                          {site.contact_phone && ` • ${site.contact_phone}`}
                        </p>
                      </div>
                    )}

                    {site.contact_email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-slate-400" />
                        <p className="text-sm text-slate-600">{site.contact_email}</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleAssignVehicles(site)}
                      className="w-full justify-start text-[#7CB342] hover:text-[#689F38] hover:bg-[#7CB342]/10"
                    >
                      <Truck className="w-4 h-4 mr-2" />
                      <span>
                        {getAssignedVehicles(site.id).length} vehicle{getAssignedVehicles(site.id).length !== 1 ? 's' : ''} assigned
                      </span>
                    </Button>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(site)}
                      className="flex-1"
                    >
                      <Edit className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(site)}
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <DataPagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredSites.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />
      )}

      {filteredSites.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-white rounded-2xl border border-slate-100">
          <div className="w-24 h-24 mb-6 rounded-full bg-slate-100 flex items-center justify-center">
            <Building2 className="w-12 h-12 text-slate-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">
            {searchQuery ? 'No sites found' : 'Welcome! Add your first site'}
          </h3>
          <p className="text-slate-600 text-center max-w-md mb-6">
            {searchQuery
              ? `No sites match "${searchQuery}". Try a different search term.`
              : 'Add your first wash station location to start managing your fleet operations.'
            }
          </p>
          {!searchQuery && (
            <div className="space-y-3 text-sm text-slate-600 bg-slate-50 rounded-lg p-4 max-w-md">
              <p className="font-semibold text-slate-800">Site Setup Guide:</p>
              <ol className="list-decimal list-inside space-y-2">
                <li>Create a site for each wash station location</li>
                <li>Add contact information and address details</li>
                <li>Assign vehicles to the appropriate site</li>
                <li>Track wash activity by location</li>
              </ol>
              <Button onClick={handleAddNew} className="w-full mt-4 bg-[#7CB342] hover:bg-[#689F38]">
                <Plus className="w-4 h-4 mr-2" />
                Add First Site
              </Button>
            </div>
          )}
        </div>
      )}

      <SiteModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedSite(null);
        }}
        site={selectedSite}
        customers={customers}
        onSuccess={() => {
          queryClient.invalidateQueries(['sites']);
        }}
      />

      <AssignVehiclesModal
        open={assignModalOpen}
        onClose={() => {
          setAssignModalOpen(false);
          setSelectedSite(null);
        }}
        site={selectedSite}
        vehicles={vehicles || []}
        onSuccess={() => {
          queryClient.invalidateQueries(['vehicles']);
        }}
      />
    </div>
  );
}