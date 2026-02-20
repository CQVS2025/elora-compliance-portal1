import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { supabaseClient } from '@/api/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import DataPagination from '@/components/ui/DataPagination';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import {
  Building2,
  Search,
  Plus,
  Edit,
  Users,
  Palette,
  MoreVertical,
  Check,
  X,
  Loader2,
  Upload,
  Link,
  Zap,
  UserPlus,
  Mail,
  Lock,
  Copy,
  CheckCircle2,
  AlertCircle,
  Trash2,
  LayoutGrid,
  RotateCcw
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast, toastError, toastSuccess } from '@/lib/toast';
import { uploadCompanyLogo, removeCompanyLogoFromStorage } from '@/lib/companyLogoUpload';
import { queryKeys } from '@/query/keys';

const TAB_VISIBILITY_OPTIONS = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'operations-log', label: 'Operations Log' },
  { value: 'operations-log-edit', label: 'Edit Operations Log' },
  { value: 'costs', label: 'Usage Costs' },
  { value: 'refills', label: 'Tank Levels' },
  { value: 'devices', label: 'Device Health' },
  { value: 'sites', label: 'Sites' },
  { value: 'reports', label: 'Reports' },
  { value: 'email-reports', label: 'Email Reports' },
  { value: 'branding', label: 'Branding' },
  { value: 'leaderboard', label: 'Driver Leaderboard' },
  { value: 'ai-insights', label: 'AI Insights' },
  { value: 'sms-alerts', label: 'SMS Alerts' },
];

export default function CompanyManagement() {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showQuickSetupModal, setShowQuickSetupModal] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState(null);
  const [quickSetupStep, setQuickSetupStep] = useState(1);
  const [quickSetupResult, setQuickSetupResult] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [companyForTabVisibility, setCompanyForTabVisibility] = useState(null);
  const [localCompanyTabVisibility, setLocalCompanyTabVisibility] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingQuickSetupLogo, setIsUploadingQuickSetupLogo] = useState(false);
  const itemsPerPage = 12;

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    email_domain: '',
    elora_customer_ref: '',
    scheduled_email_reports_enabled: true,
  });

  // Quick Setup form state
  const [quickSetupData, setQuickSetupData] = useState({
    company_name: '',
    email_domain: '',
    elora_customer_ref: '',
    logo_url: '',
    primary_color: '#003DA5',
    secondary_color: '#00A3E0',
    login_tagline: '',
    admin_email: '',
    admin_password: '',
    admin_full_name: '',
    admin_phone: '',
    admin_job_title: 'Fleet Manager',
  });

  const isSuperAdmin = userProfile?.role === 'super_admin';

  // Fetch companies with user counts - only enabled for super admins
  const { data: companies = [], isLoading, error: queryError } = useQuery({
    queryKey: ['adminCompaniesDetail'],
    queryFn: async () => {
      console.log('Fetching companies...');
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('*')
        .order('name');

      console.log('Companies result:', companiesData, companiesError);
      if (companiesError) throw companiesError;

      // Get user counts per company
      const { data: users, error: usersError } = await supabase
        .from('user_profiles')
        .select('company_id');

      console.log('Users result:', users, usersError);

      const userCounts = {};
      users?.forEach(u => {
        userCounts[u.company_id] = (userCounts[u.company_id] || 0) + 1;
      });

      return companiesData.map(c => ({
        ...c,
        userCount: userCounts[c.id] || 0
      }));
    },
    retry: 1,
    staleTime: 0, // Always refetch when invalidated
    enabled: isSuperAdmin,
  });

  // Create company mutation
  const createCompanyMutation = useMutation({
    mutationFn: async (companyData) => {
      const slug = companyData.slug || companyData.name.toLowerCase().replace(/\s+/g, '-');

      const { data, error } = await supabase
        .from('companies')
        .insert({
          name: companyData.name,
          slug,
          email_domain: companyData.email_domain || null,
          elora_customer_ref: companyData.elora_customer_ref || null,
          logo_url: companyData.logo_url || null,
          primary_color: '#1e3a5f',
          secondary_color: '#3b82f6',
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      // Also create client_branding entry if email_domain is provided
      if (companyData.email_domain) {
        await supabase.from('client_branding').insert({
          company_id: data.id,
          client_email_domain: companyData.email_domain,
          company_name: companyData.name,
          logo_url: companyData.logo_url || null,
          primary_color: null,
          secondary_color: null,
        });
      }

      return data;
    },
    onSuccess: () => {
      // Invalidate and refetch company queries
      queryClient.invalidateQueries({ queryKey: ['adminCompaniesDetail'] });
      queryClient.invalidateQueries({ queryKey: ['adminCompaniesWithCounts'] });
      queryClient.refetchQueries({ queryKey: ['adminCompaniesDetail'] });
      queryClient.refetchQueries({ queryKey: ['adminCompaniesWithCounts'] });
      setShowCreateModal(false);
      resetForm();
      toastSuccess('create', 'company');
    },
    onError: (error) => {
      toastError(error, 'creating company');
    },
  });

  // Update company mutation
  const updateCompanyMutation = useMutation({
    mutationFn: async ({ id, ...companyData }) => {
      const { data, error } = await supabase
        .from('companies')
        .update({
          name: companyData.name,
          slug: companyData.slug,
          email_domain: companyData.email_domain || null,
          elora_customer_ref: companyData.elora_customer_ref || null,
          logo_url: companyData.logo_url || null,
          primary_color: companyData.primary_color,
          secondary_color: companyData.secondary_color,
          scheduled_email_reports_enabled: companyData.scheduled_email_reports_enabled !== false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Update client_branding if exists
      if (companyData.email_domain) {
        await supabase
          .from('client_branding')
          .upsert({
            company_id: id,
            client_email_domain: companyData.email_domain,
            company_name: companyData.name,
            logo_url: companyData.logo_url,
            primary_color: companyData.primary_color,
            secondary_color: companyData.secondary_color,
          }, {
            onConflict: 'company_id,client_email_domain'
          });
      }

      return data;
    },
    onSuccess: () => {
      // Invalidate and refetch company queries
      queryClient.invalidateQueries({ queryKey: ['adminCompaniesDetail'] });
      queryClient.invalidateQueries({ queryKey: ['adminCompaniesWithCounts'] });
      queryClient.refetchQueries({ queryKey: ['adminCompaniesDetail'] });
      queryClient.refetchQueries({ queryKey: ['adminCompaniesWithCounts'] });
      setShowEditModal(false);
      setSelectedCompany(null);
      toastSuccess('update', 'company');
    },
    onError: (error) => {
      toastError(error, 'updating company');
    },
  });

  // Open company tab visibility dialog and init from company (empty = no restriction)
  useEffect(() => {
    if (!companyForTabVisibility) return;
    const current = companyForTabVisibility.visible_tabs;
    setLocalCompanyTabVisibility(Array.isArray(current) ? [...current] : []);
  }, [companyForTabVisibility?.id, companyForTabVisibility?.visible_tabs]);

  // Save company tab visibility
  const saveCompanyTabVisibilityMutation = useMutation({
    mutationFn: async ({ companyId, visibleTabs }) => {
      const payload = { updated_at: new Date().toISOString() };
      payload.visible_tabs = visibleTabs === null ? null : visibleTabs;
      const { data, error } = await supabase
        .from('companies')
        .update(payload)
        .eq('id', companyId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['adminCompaniesDetail'] });
      queryClient.invalidateQueries({ queryKey: ['adminCompaniesWithCounts'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.global.companyTabSettings(variables.companyId) });
      setCompanyForTabVisibility(null);
      toast.success(variables.visibleTabs === null ? 'Tab visibility reset (no company restriction)' : 'Company tab visibility saved');
    },
    onError: (error) => {
      toast.error(error?.message || 'Failed to save company tab visibility');
    },
  });

  // Toggle company status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, is_active }) => {
      const { error } = await supabase
        .from('companies')
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      // Invalidate and refetch company queries
      queryClient.invalidateQueries({ queryKey: ['adminCompaniesDetail'] });
      queryClient.invalidateQueries({ queryKey: ['adminCompaniesWithCounts'] });
      queryClient.refetchQueries({ queryKey: ['adminCompaniesDetail'] });
      queryClient.refetchQueries({ queryKey: ['adminCompaniesWithCounts'] });
      const action = variables.is_active ? 'activate' : 'deactivate';
      toastSuccess(action, 'company');
    },
    onError: (error) => {
      toastError(error, 'updating company status');
    },
  });

  // Delete company mutation (super admin only) — unassigns users then deletes company
  const deleteCompanyMutation = useMutation({
    mutationFn: async ({ company_id }) => {
      const response = await supabaseClient.admin.deleteCompany({ company_id });
      if (response?.error) throw new Error(response.error);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCompaniesDetail'] });
      queryClient.invalidateQueries({ queryKey: ['adminCompaniesWithCounts'] });
      queryClient.invalidateQueries(['adminUsers']);
      setCompanyToDelete(null);
      toastSuccess('delete', 'company');
    },
    onError: (error) => {
      toastError(error, 'deleting company');
      setCompanyToDelete(null);
    },
  });

  // Quick Setup mutation - creates company with admin user
  // API response shape: { success, message, company: { id, name, email_domain, slug }, user: { id, email, full_name, role }, branding: { primary_color, secondary_color, login_tagline }, login_credentials: { email, password: "(as provided)" } }
  const quickSetupMutation = useMutation({
    mutationFn: async (data) => {
      const response = await supabaseClient.admin.createCompanyWithUser(data);
      if (response?.error) {
        throw new Error(typeof response.error === 'string' ? response.error : response.error?.message);
      }
      // Edge Function returns payload at top level (no .data wrapper)
      return response?.data ?? response;
    },
    onSuccess: (data) => {
      if (!data) return;
      const company = data.company ?? {};
      const user = data.user ?? {};
      const branding = data.branding ?? {};
      queryClient.invalidateQueries({ queryKey: ['adminCompaniesDetail'] });
      queryClient.invalidateQueries({ queryKey: ['adminCompaniesWithCounts'] });
      queryClient.refetchQueries({ queryKey: ['adminCompaniesDetail'] });
      queryClient.refetchQueries({ queryKey: ['adminCompaniesWithCounts'] });
      setQuickSetupResult({ company, user, branding, login_credentials: data.login_credentials ?? {} });
      setQuickSetupStep(3);
      const companyName = company.name || 'Company';
      toast.success('All Set!', { description: `${companyName} is ready to use.` });
    },
    onError: (error) => {
      toastError(error, 'setting up company');
    },
  });

  const resetQuickSetupForm = () => {
    setQuickSetupData({
      company_name: '',
      email_domain: '',
      elora_customer_ref: '',
      logo_url: '',
      primary_color: '#003DA5',
      secondary_color: '#00A3E0',
      login_tagline: '',
      admin_email: '',
      admin_password: '',
      admin_full_name: '',
      admin_phone: '',
      admin_job_title: 'Fleet Manager',
    });
    setQuickSetupStep(1);
    setQuickSetupResult(null);
  };

  const handleQuickSetupClose = () => {
    setShowQuickSetupModal(false);
    resetQuickSetupForm();
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toastSuccess('copy', '');
  };

  const resetForm = () => {
    setFormData({
      name: '',
      slug: '',
      email_domain: '',
      elora_customer_ref: '',
      logo_url: '',
      primary_color: '#1e3a5f',
      secondary_color: '#3b82f6',
    });
  };

  const handleLogoUpload = async (event, isQuickSetup = false) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const setUploading = isQuickSetup ? setIsUploadingQuickSetupLogo : setIsUploadingLogo;
    setUploading(true);
    try {
      const companyId = !isQuickSetup && selectedCompany?.id ? selectedCompany.id : null;
      const url = await uploadCompanyLogo(file, { companyId });
      if (isQuickSetup) {
        setQuickSetupData((prev) => ({ ...prev, logo_url: url }));
      } else {
        if (selectedCompany?.logo_url) await removeCompanyLogoFromStorage(selectedCompany.logo_url);
        setFormData((prev) => ({ ...prev, logo_url: url }));
      }
      toast.success('Logo uploaded', { description: 'Image saved. Save the form to apply.' });
    } catch (err) {
      toast.error(err.message || 'Please try again.', { description: 'Upload failed' });
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleCreateLogoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsUploadingLogo(true);
    try {
      const url = await uploadCompanyLogo(file, { companyId: null });
      setFormData((prev) => ({ ...prev, logo_url: url }));
      toast.success('Logo uploaded', { description: 'Image saved. Create company to apply.' });
    } catch (err) {
      toast.error(err.message || 'Please try again.', { description: 'Upload failed' });
    } finally {
      setIsUploadingLogo(false);
      event.target.value = '';
    }
  };

  const handleEdit = (company) => {
    setSelectedCompany(company);
    setFormData({
      name: company.name,
      slug: company.slug || '',
      email_domain: company.email_domain || '',
      elora_customer_ref: company.elora_customer_ref || '',
      logo_url: company.logo_url || '',
      primary_color: company.primary_color || '#1e3a5f',
      secondary_color: company.secondary_color || '#3b82f6',
      scheduled_email_reports_enabled: company.scheduled_email_reports_enabled !== false,
    });
    setShowEditModal(true);
  };

  // Note: Access control is handled by SuperAdminRoute wrapper in App.jsx
  // This component will only render if user has super_admin role

  // Show error if query failed
  if (queryError) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[200px]">
        <Card className="w-full max-w-md border-border">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">Error Loading Companies</h2>
            <p className="text-muted-foreground mb-4">{queryError.message}</p>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const filteredCompanies = useMemo(() => {
    return companies.filter(company =>
      !searchQuery ||
      company.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      company.email_domain?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [companies, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredCompanies.length / itemsPerPage);
  const paginatedCompanies = useMemo(() => {
    return filteredCompanies.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    );
  }, [filteredCompanies, currentPage, itemsPerPage]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  return (
    <div className="p-6 space-y-6">
      {/* Filters */}
      <Card className="border-border">
        <CardContent className="p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search companies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button onClick={() => setShowQuickSetupModal(true)}>
              <Zap className="w-4 h-4 mr-2" />
              Quick Setup
            </Button>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Company
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Companies Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : filteredCompanies.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No companies found.
        </div>
      ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedCompanies.map(company => (
              <Card key={company.id} className="border-border hover:bg-muted/30 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {company.logo_url ? (
                        <img
                          src={company.logo_url}
                          alt={company.name}
                          className="w-12 h-12 object-contain rounded"
                        />
                      ) : (
                        <div
                          className="w-12 h-12 rounded flex items-center justify-center text-white font-bold text-lg"
                          style={{ backgroundColor: company.primary_color || '#1e3a5f' }}
                        >
                          {company.name?.charAt(0)}
                        </div>
                      )}
                      <div>
                        <CardTitle className="text-lg">{company.name}</CardTitle>
                        {company.email_domain && (
                          <p className="text-sm text-muted-foreground">@{company.email_domain}</p>
                        )}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(company)}>
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setCompanyForTabVisibility(company)}>
                          <LayoutGrid className="w-4 h-4 mr-2" />
                          Tab visibility
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/admin/users?company=${company.id}`)}>
                          <Users className="w-4 h-4 mr-2" />
                          View Users
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => toggleStatusMutation.mutate({
                            id: company.id,
                            is_active: company.is_active === false
                          })}
                        >
                          {company.is_active !== false ? (
                            <>
                              <X className="w-4 h-4 mr-2" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <Check className="w-4 h-4 mr-2" />
                              Activate
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setCompanyToDelete(company)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete company
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <Button
                      variant="outline"
                      className="w-full justify-between hover:bg-muted/50"
                      onClick={() => navigate(`/admin/users?company=${company.id}`)}
                    >
                      <span className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        View Users
                      </span>
                      <Badge variant="secondary">{company.userCount}</Badge>
                    </Button>

                    {company.elora_customer_ref && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Link className="w-4 h-4" />
                          Elora Ref
                        </span>
                        <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                          {company.elora_customer_ref}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Palette className="w-4 h-4" />
                        Branding
                      </span>
                      <div className="flex items-center gap-1">
                        <div
                          className="w-6 h-6 rounded"
                          style={{ backgroundColor: company.primary_color || '#1e3a5f' }}
                        />
                        <div
                          className="w-6 h-6 rounded"
                          style={{ backgroundColor: company.secondary_color || '#3b82f6' }}
                        />
                      </div>
                    </div>

                    <div className="pt-2">
                      {company.is_active !== false ? (
                        <Badge variant="default">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
              ))}
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <DataPagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredCompanies.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                className="mt-6"
              />
            )}
          </>
        )}

      {/* Create Company Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Company</DialogTitle>
            <DialogDescription className="sr-only">Create a new company with name, slug, and optional logo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Company Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Acme Corporation"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>URL Slug</Label>
                <Input
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="acme-corp"
                />
              </div>
              <div className="space-y-2">
                <Label>Email Domain</Label>
                <Input
                  value={formData.email_domain}
                  onChange={(e) => setFormData({ ...formData, email_domain: e.target.value })}
                  placeholder="acme.com"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>ACATC Customer Reference *</Label>
              <Input
                value={formData.elora_customer_ref}
                onChange={(e) => setFormData({ ...formData, elora_customer_ref: e.target.value })}
                placeholder="e.g. 20191002210559S12659"
              />
              <p className="text-xs text-muted-foreground">Required. Must match the customer ref in ACATC. Users of this company will only see data for this customer.</p>
            </div>
            <div className="space-y-2">
              <Label>Company Logo</Label>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <label className="flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-muted/50">
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    <span>{isUploadingLogo ? 'Uploading…' : 'Choose image'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      disabled={isUploadingLogo}
                      onChange={handleCreateLogoUpload}
                    />
                  </label>
                  {formData.logo_url && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setFormData((prev) => ({ ...prev, logo_url: '' }))}
                    >
                      Remove
                    </Button>
                  )}
                </div>
                {formData.logo_url && (
                  <div className="h-16 w-32 rounded border border-border bg-muted/30 flex items-center justify-center overflow-hidden">
                    <img src={formData.logo_url} alt="Logo preview" className="max-h-14 max-w-28 object-contain" />
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!formData.elora_customer_ref?.trim()) {
                  toast.error('ACATC Customer Reference is required.', { description: 'Enter the customer ref from ACATC (e.g. 20191002210559S12659).' });
                  return;
                }
                createCompanyMutation.mutate(formData);
              }}
              disabled={createCompanyMutation.isPending || !formData.name || !formData.elora_customer_ref?.trim()}
            >
              {createCompanyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Company'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Company Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Company</DialogTitle>
            <DialogDescription className="sr-only">Edit company details and logo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Company Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>URL Slug</Label>
                <Input
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Email Domain</Label>
                <Input
                  value={formData.email_domain}
                  onChange={(e) => setFormData({ ...formData, email_domain: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>ACATC Customer Reference *</Label>
              <Input
                value={formData.elora_customer_ref}
                onChange={(e) => setFormData({ ...formData, elora_customer_ref: e.target.value })}
                placeholder="e.g. 20191002210559S12659"
              />
              <p className="text-xs text-muted-foreground">Required. Must match the customer ref in ACATC. Users of this company will only see data for this customer.</p>
            </div>
            <div className="space-y-2">
              <Label>Company Logo</Label>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <label className="flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-muted/50">
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    <span>{isUploadingLogo ? 'Uploading…' : 'Choose image'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      disabled={isUploadingLogo}
                      onChange={(e) => handleLogoUpload(e, false)}
                    />
                  </label>
                  {formData.logo_url && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setFormData((prev) => ({ ...prev, logo_url: '' }))}
                    >
                      Remove
                    </Button>
                  )}
                </div>
                {formData.logo_url && (
                  <div className="h-16 w-32 rounded border border-border bg-muted/30 flex items-center justify-center overflow-hidden">
                    <img src={formData.logo_url} alt="Logo preview" className="max-h-14 max-w-28 object-contain" />
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <Label htmlFor="scheduled-emails" className="text-sm font-medium">Scheduled email reports</Label>
                <p className="text-xs text-muted-foreground mt-0.5">When disabled, no weekly automated emails are sent for this organization.</p>
              </div>
              <Switch
                id="scheduled-emails"
                checked={formData.scheduled_email_reports_enabled !== false}
                onCheckedChange={(v) => setFormData((prev) => ({ ...prev, scheduled_email_reports_enabled: v }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Primary Color</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={formData.primary_color}
                    onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                    className="w-10 h-10 rounded cursor-pointer"
                  />
                  <Input
                    value={formData.primary_color}
                    onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Secondary Color</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={formData.secondary_color}
                    onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                    className="w-10 h-10 rounded cursor-pointer"
                  />
                  <Input
                    value={formData.secondary_color}
                    onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!formData.elora_customer_ref?.trim()) {
                  toast.error('ACATC Customer Reference is required.', { description: 'Enter the customer ref from ACATC (e.g. 20191002210559S12659).' });
                  return;
                }
                updateCompanyMutation.mutate({ id: selectedCompany.id, ...formData });
              }}
              disabled={updateCompanyMutation.isPending || !formData.elora_customer_ref?.trim()}
            >
              {updateCompanyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Company Tab Visibility Dialog */}
      <Dialog open={!!companyForTabVisibility} onOpenChange={(open) => { if (!open) setCompanyForTabVisibility(null); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tab visibility</DialogTitle>
            {companyForTabVisibility && (
              <DialogDescription>
                Restrict which tabs users in <span className="font-medium text-foreground">{companyForTabVisibility.name}</span> can see. Leave all unchecked for no restriction (users see whatever their role allows). Check tabs to allow only those for this company.
              </DialogDescription>
            )}
          </DialogHeader>
          {companyForTabVisibility && (
            <div className="space-y-4 py-4">
              <div>
                <h4 className="text-sm font-medium text-foreground mb-3">Tabs allowed for this company</h4>
                <p className="text-xs text-muted-foreground mb-3">
                  Only checked tabs will be available to users in this company (in addition to role and user-level restrictions). Empty = no company restriction.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 gap-4">
                  {TAB_VISIBILITY_OPTIONS.map((tab) => (
                    <div
                      key={tab.value}
                      className="flex items-center justify-between p-3 rounded-lg border border-border"
                    >
                      <span className="text-sm font-medium text-foreground">{tab.label}</span>
                      <Switch
                        checked={localCompanyTabVisibility.includes(tab.value)}
                        onCheckedChange={(checked) => {
                          setLocalCompanyTabVisibility((prev) =>
                            checked ? [...prev, tab.value] : prev.filter((t) => t !== tab.value)
                          );
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompanyForTabVisibility(null)}>Cancel</Button>
            {companyForTabVisibility && (
              <>
                <Button
                  variant="outline"
                  onClick={() =>
                    saveCompanyTabVisibilityMutation.mutate({
                      companyId: companyForTabVisibility.id,
                      visibleTabs: null,
                    })
                  }
                  disabled={saveCompanyTabVisibilityMutation.isPending}
                >
                  {saveCompanyTabVisibilityMutation.isPending && saveCompanyTabVisibilityMutation.variables?.visibleTabs === null ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  ) : (
                    <RotateCcw className="w-4 h-4 mr-1" />
                  )}
                  Reset to no restriction
                </Button>
                <Button
                  onClick={() =>
                    saveCompanyTabVisibilityMutation.mutate({
                      companyId: companyForTabVisibility.id,
                      visibleTabs: localCompanyTabVisibility.length > 0 ? localCompanyTabVisibility : null,
                    })
                  }
                  disabled={saveCompanyTabVisibilityMutation.isPending}
                >
                  {saveCompanyTabVisibilityMutation.isPending && saveCompanyTabVisibilityMutation.variables?.visibleTabs !== null ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Save'
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Setup Modal - Creates Company + Admin User */}
      <Dialog open={showQuickSetupModal} onOpenChange={handleQuickSetupClose}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              Quick Setup - New Company with Admin
            </DialogTitle>
            <DialogDescription>
              Create a new company with branding and an admin user in one step.
            </DialogDescription>
          </DialogHeader>

          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-2 py-4">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  quickSetupStep >= step
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {quickSetupStep > step ? <Check className="w-4 h-4" /> : step}
                </div>
                {step < 3 && (
                  <div className={`w-12 h-1 mx-1 ${
                    quickSetupStep > step ? 'bg-primary' : 'bg-muted'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-8 text-xs text-muted-foreground mb-4">
            <span>Company</span>
            <span>Admin User</span>
            <span>Complete</span>
          </div>

          {/* Step 1: Company Details */}
          {quickSetupStep === 1 && (
            <div className="space-y-4">
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-sm text-foreground">
                <Building2 className="w-4 h-4 inline mr-2 text-primary" />
                Enter the company details and branding colors.
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Company Name *</Label>
                  <Input
                    value={quickSetupData.company_name}
                    onChange={(e) => setQuickSetupData({ ...quickSetupData, company_name: e.target.value })}
                    placeholder="Heidelberg Materials"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email Domain *</Label>
                  <Input
                    value={quickSetupData.email_domain}
                    onChange={(e) => setQuickSetupData({ ...quickSetupData, email_domain: e.target.value })}
                    placeholder="heidelberg.com.au"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>ACATC Customer Reference *</Label>
                  <Input
                    value={quickSetupData.elora_customer_ref}
                    onChange={(e) => setQuickSetupData({ ...quickSetupData, elora_customer_ref: e.target.value })}
                    placeholder="e.g. 20191002210559S12659"
                  />
                  <p className="text-xs text-muted-foreground">Required. Must match the customer ref in ACATC.</p>
                </div>
                <div className="space-y-2">
                  <Label>Company Logo</Label>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <label className="flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-muted/50">
                        <Upload className="h-4 w-4 text-muted-foreground" />
                        <span>{isUploadingQuickSetupLogo ? 'Uploading…' : 'Choose image'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          disabled={isUploadingQuickSetupLogo}
                          onChange={(e) => handleLogoUpload(e, true)}
                        />
                      </label>
                      {quickSetupData.logo_url && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setQuickSetupData((prev) => ({ ...prev, logo_url: '' }))}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                    {quickSetupData.logo_url && (
                      <div className="h-16 w-32 rounded border border-border bg-muted/30 flex items-center justify-center overflow-hidden">
                        <img src={quickSetupData.logo_url} alt="Logo preview" className="max-h-14 max-w-28 object-contain" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Login Page Tagline</Label>
                <Input
                  value={quickSetupData.login_tagline}
                  onChange={(e) => setQuickSetupData({ ...quickSetupData, login_tagline: e.target.value })}
                  placeholder="Building Tomorrow's Infrastructure Today"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Primary Color</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={quickSetupData.primary_color}
                      onChange={(e) => setQuickSetupData({ ...quickSetupData, primary_color: e.target.value })}
                      className="w-10 h-10 rounded cursor-pointer border"
                    />
                    <Input
                      value={quickSetupData.primary_color}
                      onChange={(e) => setQuickSetupData({ ...quickSetupData, primary_color: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Secondary Color</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={quickSetupData.secondary_color}
                      onChange={(e) => setQuickSetupData({ ...quickSetupData, secondary_color: e.target.value })}
                      className="w-10 h-10 rounded cursor-pointer border"
                    />
                    <Input
                      value={quickSetupData.secondary_color}
                      onChange={(e) => setQuickSetupData({ ...quickSetupData, secondary_color: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>

              {/* Color Preview */}
              <div className="border border-border rounded-lg p-4 bg-muted/50">
                <Label className="text-xs text-muted-foreground mb-2 block">Branding Preview</Label>
                <div
                  className="h-12 rounded-lg flex items-center justify-center text-white font-medium"
                  style={{ background: `linear-gradient(135deg, ${quickSetupData.primary_color} 0%, ${quickSetupData.secondary_color} 100%)` }}
                >
                  {quickSetupData.company_name || 'Company Name'}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Admin User */}
          {quickSetupStep === 2 && (
            <div className="space-y-4">
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-sm text-foreground">
                <UserPlus className="w-4 h-4 inline mr-2 text-primary" />
                Create the first admin user who can log in and manage this company.
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email Address *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="email"
                      value={quickSetupData.admin_email}
                      onChange={(e) => setQuickSetupData({ ...quickSetupData, admin_email: e.target.value })}
                      placeholder="admin@company.com"
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Password *</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="text"
                      value={quickSetupData.admin_password}
                      onChange={(e) => setQuickSetupData({ ...quickSetupData, admin_password: e.target.value })}
                      placeholder="Min 6 characters"
                      className="pl-10"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Save this password - you'll need it to log in!</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input
                    value={quickSetupData.admin_full_name}
                    onChange={(e) => setQuickSetupData({ ...quickSetupData, admin_full_name: e.target.value })}
                    placeholder="John Smith"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={quickSetupData.admin_phone}
                    onChange={(e) => setQuickSetupData({ ...quickSetupData, admin_phone: e.target.value })}
                    placeholder="+61 400 000 000"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Job Title</Label>
                <Input
                  value={quickSetupData.admin_job_title}
                  onChange={(e) => setQuickSetupData({ ...quickSetupData, admin_job_title: e.target.value })}
                  placeholder="Fleet Manager"
                />
              </div>

              {/* Summary Preview */}
              <div className="border border-border rounded-lg p-4 bg-muted/50 mt-4">
                <Label className="text-xs text-muted-foreground mb-3 block">Setup Summary</Label>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Company</p>
                    <p className="font-medium text-foreground">{quickSetupData.company_name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Email Domain</p>
                    <p className="font-medium text-foreground">@{quickSetupData.email_domain}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Admin Email</p>
                    <p className="font-medium text-foreground">{quickSetupData.admin_email}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Admin Name</p>
                    <p className="font-medium text-foreground">{quickSetupData.admin_full_name || 'Admin User'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Success */}
          {quickSetupStep === 3 && quickSetupResult && (
            <div className="space-y-4">
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-6 text-center">
                <CheckCircle2 className="w-12 h-12 text-primary mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-foreground">Setup Complete!</h3>
                <p className="text-muted-foreground mt-1">
                  {quickSetupResult.company?.name ?? quickSetupResult.company_name ?? 'Company'} is ready to use.
                </p>
              </div>

              {/* Login Credentials */}
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="bg-muted px-4 py-2 font-medium text-sm flex items-center gap-2 text-foreground">
                  <Lock className="w-4 h-4" />
                  Login Credentials
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="font-mono text-foreground">{quickSetupResult.user?.email ?? quickSetupData.admin_email ?? ''}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(quickSetupResult.user?.email ?? quickSetupData.admin_email ?? '')}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Password</p>
                      <p className="font-mono text-foreground">{quickSetupData.admin_password}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(quickSetupData.admin_password)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Company Details */}
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="bg-muted px-4 py-2 font-medium text-sm flex items-center gap-2 text-foreground">
                  <Building2 className="w-4 h-4" />
                  Company Details
                </div>
                <div className="p-4 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Company Name</p>
                    <p className="font-medium text-foreground">{quickSetupResult.company?.name ?? quickSetupData.company_name ?? ''}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Email Domain</p>
                    <p className="font-medium text-foreground">@{quickSetupResult.company?.email_domain ?? quickSetupData.email_domain ?? ''}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Admin User</p>
                    <p className="font-medium text-foreground">{quickSetupResult.user?.full_name ?? quickSetupData.admin_full_name ?? ''}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Role</p>
                    <Badge variant="secondary">Admin</Badge>
                  </div>
                </div>
              </div>

              {/* Branding Preview */}
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="bg-muted px-4 py-2 font-medium text-sm flex items-center gap-2 text-foreground">
                  <Palette className="w-4 h-4" />
                  Branding
                </div>
                <div className="p-4">
                  <div
                    className="h-16 rounded-lg flex items-center justify-center text-white font-medium"
                    style={{ background: `linear-gradient(135deg, ${quickSetupResult.branding?.primary_color ?? quickSetupData.primary_color ?? '#003DA5'} 0%, ${quickSetupResult.branding?.secondary_color ?? quickSetupData.secondary_color ?? '#00A3E0'} 100%)` }}
                  >
                    {quickSetupResult.branding?.login_tagline || quickSetupResult.company?.name || quickSetupData.company_name || 'Company'}
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="mt-4">
            {quickSetupStep === 1 && (
              <>
                <Button variant="outline" onClick={handleQuickSetupClose}>Cancel</Button>
                <Button
                  onClick={() => setQuickSetupStep(2)}
                  disabled={!quickSetupData.company_name || !quickSetupData.email_domain || !quickSetupData.elora_customer_ref?.trim()}
                >
                  Next: Admin User
                </Button>
              </>
            )}

            {quickSetupStep === 2 && (
              <>
                <Button variant="outline" onClick={() => setQuickSetupStep(1)}>Back</Button>
                <Button
                  onClick={() => {
                    if (!quickSetupData.elora_customer_ref?.trim()) {
                      toast.error('ACATC Customer Reference is required.', { description: 'Go back and enter the customer ref from ACATC (e.g. 20191002210559S12659).' });
                      return;
                    }
                    quickSetupMutation.mutate(quickSetupData);
                  }}
                  disabled={
                    quickSetupMutation.isPending ||
                    !quickSetupData.admin_email ||
                    !quickSetupData.admin_password ||
                    quickSetupData.admin_password.length < 6 ||
                    !quickSetupData.elora_customer_ref?.trim()
                  }
                >
                  {quickSetupMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-2" />
                      Create Company & User
                    </>
                  )}
                </Button>
              </>
            )}

            {quickSetupStep === 3 && (
              <Button onClick={handleQuickSetupClose}>
                Done
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Company Confirmation */}
      <AlertDialog open={!!companyToDelete} onOpenChange={(open) => { if (!open) setCompanyToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete company</AlertDialogTitle>
            <AlertDialogDescription>
              {companyToDelete && (
                <>
                  This will permanently delete <span className="font-medium">{companyToDelete.name}</span>. All users in this company will be unassigned (they can be reassigned later). This cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCompanyToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteCompanyMutation.isPending}
              onClick={() => companyToDelete && deleteCompanyMutation.mutate({ company_id: companyToDelete.id })}
            >
              {deleteCompanyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete company'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
