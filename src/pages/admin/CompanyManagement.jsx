import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Building2,
  ArrowLeft,
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
  Link
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';

export default function CompanyManagement() {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    email_domain: '',
    elora_customer_ref: '',
    logo_url: '',
    primary_color: '#1e3a5f',
    secondary_color: '#3b82f6',
  });

  const isSuperAdmin = userProfile?.role === 'super_admin';

  // Redirect non-super-admins
  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <Building2 className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-800 mb-2">Access Denied</h2>
            <p className="text-slate-600 mb-4">Only Super Admins can manage companies.</p>
            <Button onClick={() => navigate('/admin')}>Return to Admin</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fetch companies with user counts
  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['adminCompaniesDetail'],
    queryFn: async () => {
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('*')
        .order('name');

      if (companiesError) throw companiesError;

      // Get user counts per company
      const { data: users } = await supabase
        .from('user_profiles')
        .select('company_id');

      const userCounts = {};
      users?.forEach(u => {
        userCounts[u.company_id] = (userCounts[u.company_id] || 0) + 1;
      });

      return companiesData.map(c => ({
        ...c,
        userCount: userCounts[c.id] || 0
      }));
    },
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
          primary_color: companyData.primary_color,
          secondary_color: companyData.secondary_color,
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
          logo_url: companyData.logo_url,
          primary_color: companyData.primary_color,
          secondary_color: companyData.secondary_color,
        });
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['adminCompaniesDetail']);
      setShowCreateModal(false);
      resetForm();
      toast({ title: 'Company Created', description: 'Company has been created successfully.' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
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
      queryClient.invalidateQueries(['adminCompaniesDetail']);
      setShowEditModal(false);
      setSelectedCompany(null);
      toast({ title: 'Company Updated', description: 'Company has been updated successfully.' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
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
    onSuccess: () => {
      queryClient.invalidateQueries(['adminCompaniesDetail']);
      toast({ title: 'Status Updated', description: 'Company status has been updated.' });
    },
  });

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
    });
    setShowEditModal(true);
  };

  const filteredCompanies = companies.filter(company =>
    !searchQuery ||
    company.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    company.email_domain?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/10"
              onClick={() => navigate('/admin')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Admin
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Building2 className="w-6 h-6" />
                Company Management
              </h1>
              <p className="text-slate-300 text-sm">Manage companies and branding</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search companies..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button
                className="bg-[#7CB342] hover:bg-[#689F38]"
                onClick={() => setShowCreateModal(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Company
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Companies Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#7CB342] animate-spin" />
          </div>
        ) : filteredCompanies.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No companies found.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCompanies.map(company => (
              <Card key={company.id} className="hover:shadow-lg transition-shadow">
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
                          <p className="text-sm text-slate-500">@{company.email_domain}</p>
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
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500 flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        Users
                      </span>
                      <span className="font-medium">{company.userCount}</span>
                    </div>

                    {company.elora_customer_ref && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500 flex items-center gap-1">
                          <Link className="w-4 h-4" />
                          Elora Ref
                        </span>
                        <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">
                          {company.elora_customer_ref}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500 flex items-center gap-1">
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
                        <Badge className="bg-green-100 text-green-800">Active</Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-800">Inactive</Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Company Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Company</DialogTitle>
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
              <Label>Elora Customer Reference</Label>
              <Input
                value={formData.elora_customer_ref}
                onChange={(e) => setFormData({ ...formData, elora_customer_ref: e.target.value })}
                placeholder="ELORA-12345"
              />
            </div>
            <div className="space-y-2">
              <Label>Logo URL</Label>
              <Input
                value={formData.logo_url}
                onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                placeholder="https://example.com/logo.png"
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
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button
              className="bg-[#7CB342] hover:bg-[#689F38]"
              onClick={() => createCompanyMutation.mutate(formData)}
              disabled={createCompanyMutation.isPending || !formData.name}
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
              <Label>Elora Customer Reference</Label>
              <Input
                value={formData.elora_customer_ref}
                onChange={(e) => setFormData({ ...formData, elora_customer_ref: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Logo URL</Label>
              <Input
                value={formData.logo_url}
                onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
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
              className="bg-[#7CB342] hover:bg-[#689F38]"
              onClick={() => updateCompanyMutation.mutate({ id: selectedCompany.id, ...formData })}
              disabled={updateCompanyMutation.isPending}
            >
              {updateCompanyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
