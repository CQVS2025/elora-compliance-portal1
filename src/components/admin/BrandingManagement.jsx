import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { supabaseClient } from '@/api/supabaseClient';
import { supabase } from '@/lib/supabase';
import {
  Palette,
  Save,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

export default function BrandingManagement() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isSuperAdmin = userProfile?.role === 'super_admin';
  const isAdmin = userProfile?.role === 'admin';
  
  // For super_admin: allow company selection, for admin: use their company_id
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const companyId = isSuperAdmin ? selectedCompanyId : userProfile?.company_id;

  const [formData, setFormData] = useState({
    company_name: '',
    logo_url: '',
    primary_color: '#7CB342',
    secondary_color: '#9CCC65',
  });

  // Fetch companies list for super_admin, or single company for admin
  const { data: companiesData = [] } = useQuery({
    queryKey: ['adminCompaniesForBranding'],
    queryFn: async () => {
      if (isSuperAdmin) {
        // Super admin: fetch all companies
        const { data, error } = await supabase
          .from('companies')
          .select('id, name, logo_url, primary_color')
          .eq('is_active', true)
          .order('name');
        if (error) throw error;
        return data;
      } else if (isAdmin && userProfile?.company_id) {
        // Admin: fetch only their company
        const { data, error } = await supabase
          .from('companies')
          .select('id, name, logo_url, primary_color')
          .eq('id', userProfile.company_id)
          .single();
        if (error) throw error;
        return [data];
      }
      return [];
    },
    enabled: isSuperAdmin || isAdmin,
  });

  const companies = useMemo(() => companiesData || [], [companiesData]);

  // Set initial company selection
  useEffect(() => {
    if (isSuperAdmin && companies.length > 0 && !selectedCompanyId) {
      setSelectedCompanyId(companies[0].id);
    } else if (isAdmin && userProfile?.company_id && !selectedCompanyId) {
      setSelectedCompanyId(userProfile.company_id);
    }
  }, [isSuperAdmin, isAdmin, companies, selectedCompanyId, userProfile?.company_id]);

  // Fetch existing branding
  const { data: branding, isLoading } = useQuery({
    queryKey: ['companyBranding', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      
      const { data, error } = await supabase
        .from('client_branding')
        .select('*')
        .eq('company_id', companyId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!companyId,
  });

  // Also fetch company data for company_name
  const { data: companyData } = useQuery({
    queryKey: ['companyData', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      
      const { data, error } = await supabase
        .from('companies')
        .select('name, logo_url, primary_color, secondary_color')
        .eq('id', companyId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  // Update form when branding or company data loads
  useEffect(() => {
    if (branding || companyData) {
      setFormData(prev => ({
        company_name: branding?.company_name || companyData?.name || prev.company_name,
        logo_url: branding?.logo_url || companyData?.logo_url || prev.logo_url,
        primary_color: branding?.primary_color || companyData?.primary_color || prev.primary_color,
        secondary_color: branding?.secondary_color || companyData?.secondary_color || prev.secondary_color,
      }));
    }
  }, [branding, companyData]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const payload = {
        company_id: companyId,
        client_email_domain: userProfile?.email?.split('@')[1] || 'default',
        company_name: data.company_name,
        logo_url: data.logo_url || null,
        primary_color: data.primary_color || '#7CB342',
        secondary_color: data.secondary_color || '#9CCC65',
      };

      if (branding?.id) {
        payload.id = branding.id;
      }

      const response = await supabaseClient.branding.save(payload);
      if (!response?.success) {
        throw new Error(response?.error || 'Failed to save branding');
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['companyBranding', companyId]);
      queryClient.invalidateQueries(['companyData', companyId]);
      queryClient.invalidateQueries(['adminCompaniesForBranding']);
      toast({ 
        title: 'Branding Saved', 
        description: 'Your branding settings have been updated successfully.' 
      });
    },
    onError: (error) => {
      toast({ 
        title: 'Error', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });

  const handleSave = () => {
    if (!companyId) {
      toast({ 
        title: 'Error', 
        description: 'Please select a company first.', 
        variant: 'destructive' 
      });
      return;
    }
    saveMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  // Get selected company name for display
  const selectedCompany = companies.find(c => c.id === companyId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Palette className="w-5 h-5 text-emerald-500" />
            Company Branding
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {isSuperAdmin 
              ? 'Manage branding for all companies' 
              : 'Customize the portal appearance for your company'}
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saveMutation.isPending || !companyId}
          className="bg-emerald-500 hover:bg-emerald-600"
        >
          {saveMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save Changes
        </Button>
      </div>

      {/* Company Selector for Super Admin */}
      {isSuperAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Select Company</CardTitle>
            <CardDescription>Choose which company's branding to manage</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={companyId || ''} onValueChange={setSelectedCompanyId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a company...">
                  {selectedCompany && (
                    <div className="flex items-center gap-2">
                      {selectedCompany.logo_url ? (
                        <img src={selectedCompany.logo_url} alt="" className="w-5 h-5 object-contain" />
                      ) : (
                        <div 
                          className="w-5 h-5 rounded flex items-center justify-center text-white text-xs font-bold"
                          style={{ backgroundColor: selectedCompany.primary_color || '#7CB342' }}
                        >
                          {selectedCompany.name?.charAt(0)}
                        </div>
                      )}
                      <span>{selectedCompany.name}</span>
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {companies.map(company => (
                  <SelectItem key={company.id} value={company.id}>
                    <div className="flex items-center gap-2">
                      {company.logo_url ? (
                        <img src={company.logo_url} alt="" className="w-5 h-5 object-contain" />
                      ) : (
                        <div 
                          className="w-5 h-5 rounded flex items-center justify-center text-white text-xs font-bold"
                          style={{ backgroundColor: company.primary_color || '#7CB342' }}
                        >
                          {company.name?.charAt(0)}
                        </div>
                      )}
                      <span>{company.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Admin Company Display */}
      {isAdmin && selectedCompany && (
        <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {selectedCompany.logo_url ? (
                  <img src={selectedCompany.logo_url} alt="" className="w-8 h-8 object-contain" />
                ) : (
                  <div 
                    className="w-8 h-8 rounded flex items-center justify-center text-white text-sm font-bold"
                    style={{ backgroundColor: selectedCompany.primary_color || '#7CB342' }}
                  >
                    {selectedCompany.name?.charAt(0)}
                  </div>
                )}
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{selectedCompany.name}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Managing branding for your company</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Branding Form */}
      {companyId && (
        <Card>
          <CardHeader>
            <CardTitle>Branding Settings</CardTitle>
            <CardDescription>Configure logo and brand colors</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                placeholder="Your Company Name"
              />
            </div>

            <div className="space-y-2">
              <Label>Logo URL</Label>
              <Input
                value={formData.logo_url}
                onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                placeholder="https://example.com/logo.png"
              />
              {formData.logo_url && (
                <div className="p-4 bg-gray-100 dark:bg-zinc-800 rounded-lg mt-2">
                  <img 
                    src={formData.logo_url} 
                    alt="Logo preview" 
                    className="h-16 object-contain" 
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Primary Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={formData.primary_color}
                    onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                    className="w-16 h-10 p-1"
                  />
                  <Input
                    value={formData.primary_color}
                    onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                    placeholder="#7CB342"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Secondary Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={formData.secondary_color}
                    onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                    className="w-16 h-10 p-1"
                  />
                  <Input
                    value={formData.secondary_color}
                    onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                    placeholder="#9CCC65"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
