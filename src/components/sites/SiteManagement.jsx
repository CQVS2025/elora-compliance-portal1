import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabaseClient } from "@/api/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Building2, Edit, AlertCircle, Truck, ImageIcon, FilterX } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import SiteModal from './SiteModal';
import AssignVehiclesModal from './AssignVehiclesModal';
import DataPagination from '@/components/ui/DataPagination';
import { usePermissions } from '@/components/auth/PermissionGuard';
import { siteOverridesOptions } from '@/query/options';

export default function SiteManagement({ customers, vehicles, selectedCustomer }) {
  const queryClient = useQueryClient();
  const permissions = usePermissions();
  const isSuperAdmin = permissions.isSuperAdmin ?? false;

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedSite, setSelectedSite] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const { data: allSites = [], isLoading, error: sitesError } = useQuery({
    queryKey: ['sites'],
    queryFn: async () => {
      try {
        const response = await supabaseClient.elora.sites({});
        const data = response?.data ?? response ?? [];
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

  const { data: siteOverrides = [] } = useQuery(siteOverridesOptions());

  const overrideMap = useMemo(() => {
    const map = {};
    (siteOverrides || []).forEach(o => { map[o.site_ref] = o; });
    return map;
  }, [siteOverrides]);

  const sites = useMemo(() => {
    return (allSites || []).map(site => {
      const ov = overrideMap[site.id];
      if (!ov) return site;
      return {
        ...site,
        name: ov.name ?? site.name,
        customer_ref: ov.customer_ref ?? site.customer_ref,
        customer_name: ov.customer_name ?? site.customer_name,
        street_address: ov.street_address,
        address: ov.street_address ?? site.address,
        city: ov.city ?? site.city,
        state: ov.state ?? site.state,
        postal_code: ov.postal_code ?? site.postal_code,
        contact_person: ov.contact_person,
        contact_name: ov.contact_person ?? site.contact_name,
        contact_phone: ov.contact_phone ?? site.contact_phone,
        contact_email: ov.contact_email ?? site.contact_email,
        is_active: ov.is_active,
        status: ov.is_active === false ? 'inactive' : (site.status || 'active'),
        notes: ov.notes,
        logo_url: ov.logo_url,
      };
    });
  }, [allSites, overrideMap]);

  const filteredByCustomer = useMemo(() => {
    if (!selectedCustomer || selectedCustomer === 'all') return sites;
    return sites.filter(s => s.customer_ref === selectedCustomer || s.customer_ref == null);
  }, [sites, selectedCustomer]);

  const handleEdit = (site) => {
    setSelectedSite(site);
    setModalOpen(true);
  };

  const handleAssignVehicles = (site) => {
    setSelectedSite(site);
    setAssignModalOpen(true);
  };

  const getAssignedVehicles = (siteId) => {
    return vehicles?.filter(v => v.site_id === siteId) || [];
  };

  const uniqueCustomers = useMemo(() => {
    const names = new Set();
    (filteredByCustomer || []).forEach(s => {
      if (s.customer_name) names.add(s.customer_name);
    });
    return Array.from(names).sort();
  }, [filteredByCustomer]);

  const filteredSites = useMemo(() => {
    let list = filteredByCustomer || [];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(site =>
        site.name?.toLowerCase().includes(q) ||
        (site.customer_name && site.customer_name.toLowerCase().includes(q)) ||
        (site.city && site.city.toLowerCase().includes(q)) ||
        (site.address && site.address.toLowerCase().includes(q)) ||
        (site.state && site.state.toLowerCase().includes(q))
      );
    }
    if (statusFilter && statusFilter !== 'all') {
      list = list.filter(s => (s.status || 'active') === statusFilter);
    }
    if (customerFilter && customerFilter !== 'all') {
      list = list.filter(s => s.customer_name === customerFilter);
    }
    return list;
  }, [filteredByCustomer, searchQuery, statusFilter, customerFilter]);

  const hasActiveFilters = searchQuery || statusFilter !== 'all' || customerFilter !== 'all';
  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setCustomerFilter('all');
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(filteredSites.length / itemsPerPage);
  const paginatedSites = useMemo(() => {
    return filteredSites.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    );
  }, [filteredSites, currentPage, itemsPerPage]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCustomer, statusFilter, customerFilter]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-primary text-primary-foreground';
      case 'inactive':
        return 'bg-muted/500 text-white';
      case 'maintenance':
        return 'bg-orange-500 text-white';
      default:
        return 'bg-muted/500 text-white';
    }
  };

  const empty = '—';

  if (sitesError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 bg-card rounded-2xl border border-destructive/30">
        <div className="w-24 h-24 mb-6 rounded-full bg-red-100 flex items-center justify-center">
          <AlertCircle className="w-12 h-12 text-red-500" />
        </div>
        <h3 className="text-xl font-bold text-foreground mb-2">Failed to Load Sites</h3>
        <p className="text-muted-foreground text-center max-w-md mb-6">
          {sitesError?.message || 'An error occurred while loading sites. Please try again.'}
        </p>
        <Button onClick={() => queryClient.invalidateQueries(['sites'])}>
          Retry
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-muted-foreground">Loading sites...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Site Management</h2>
          <p className="text-muted-foreground mt-1">Manage wash station locations and contact information</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search sites by name, customer, or city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 border-border h-9"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <Select value={customerFilter} onValueChange={setCustomerFilter}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="Customer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Customers</SelectItem>
              {uniqueCustomers.map((name) => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 gap-1.5 text-muted-foreground hover:text-foreground">
              <FilterX className="w-4 h-4" />
              Clear filters
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{filteredByCustomer?.length ?? 0}</p>
                <p className="text-sm text-primary font-semibold">Total Sites</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {(filteredByCustomer || []).filter(s => (s.status || 'active') === 'active').length}
                </p>
                <p className="text-sm text-primary font-semibold">Active Sites</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl border border-border overflow-hidden">
        <div className="rounded-lg border-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-24 py-3 pl-4">Logo</TableHead>
                <TableHead className="min-w-[140px] py-3">Site</TableHead>
                <TableHead className="min-w-[120px] py-3">Customer</TableHead>
                <TableHead className="min-w-[160px] py-3">Address</TableHead>
                <TableHead className="min-w-[140px] py-3">Contact</TableHead>
                <TableHead className="w-20 py-3">Status</TableHead>
                <TableHead className="w-24 py-3 text-center">Vehicles</TableHead>
                {isSuperAdmin && <TableHead className="w-20 py-3 text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedSites.map((site) => {
                const addr = [site.address, [site.city, site.state, site.postal_code].filter(Boolean).join(', ')].filter(Boolean).join(' • ') || empty;
                const contact = [site.contact_name, site.contact_phone, site.contact_email].filter(Boolean).join(' • ') || empty;
                const vehicleCount = getAssignedVehicles(site.id).length;
                return (
                  <TableRow key={site.id} className="group">
                    <TableCell className="py-3 pl-4 align-middle">
                      <div className="flex items-center justify-center w-14 h-14 rounded-lg border border-border bg-muted/30 p-1 shrink-0">
                        {site.logo_url ? (
                          <img src={site.logo_url} alt="" className="h-full w-full object-contain" />
                        ) : (
                          <ImageIcon className="w-7 h-7 text-muted-foreground" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-2 align-middle font-medium">{site.name || empty}</TableCell>
                    <TableCell className="py-2 align-middle text-muted-foreground">{site.customer_name || empty}</TableCell>
                    <TableCell className="py-2 align-middle text-muted-foreground max-w-[200px] truncate" title={addr}>{addr}</TableCell>
                    <TableCell className="py-2 align-middle text-muted-foreground max-w-[180px] truncate" title={contact}>{contact}</TableCell>
                    <TableCell className="py-2 align-middle">
                      <Badge className={getStatusColor(site.status)}>{site.status}</Badge>
                    </TableCell>
                    <TableCell className="py-2 align-middle text-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleAssignVehicles(site)}
                        className="h-8 text-primary hover:bg-primary/10 -mx-1"
                      >
                        <Truck className="w-3.5 h-3.5 mr-1" />
                        {vehicleCount}
                      </Button>
                    </TableCell>
                    {isSuperAdmin && (
                      <TableCell className="py-2 align-middle text-right">
                        <Button size="sm" variant="outline" onClick={() => handleEdit(site)} className="h-8">
                          <Edit className="w-3.5 h-3.5 mr-1" />
                          Edit
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

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
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-card rounded-2xl border border-border">
          <div className="w-24 h-24 mb-6 rounded-full bg-muted flex items-center justify-center">
            <Building2 className="w-12 h-12 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">
            {hasActiveFilters ? 'No sites match your filters' : 'No sites available'}
          </h3>
          <p className="text-muted-foreground text-center max-w-md mb-6">
            {hasActiveFilters
              ? 'Try adjusting your search or filters.'
              : 'Sites are loaded from the Elora API. Contact your administrator if you expect to see sites here.'
            }
          </p>
          {hasActiveFilters && (
            <Button variant="outline" onClick={clearFilters}>Clear filters</Button>
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
        customers={customers || []}
        onSuccess={() => {
          queryClient.invalidateQueries(['sites']);
          queryClient.invalidateQueries({ queryKey: ['siteOverrides'] });
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
