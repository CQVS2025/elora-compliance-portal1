import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { supabaseClient } from '@/api/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Users,
  ArrowLeft,
  Search,
  UserPlus,
  Edit,
  Trash2,
  Mail,
  Shield,
  Building2,
  MoreVertical,
  Check,
  X,
  Loader2,
  AlertCircle,
  Globe
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { formatErrorForToast, formatSuccessForToast } from '@/utils/errorMessages';

const ROLES = [
  { value: 'super_admin', label: 'Super Admin', color: 'bg-red-100 text-red-800' },
  { value: 'admin', label: 'Admin', color: 'bg-purple-100 text-purple-800' },
  { value: 'manager', label: 'Manager', color: 'bg-blue-100 text-blue-800' },
  { value: 'technician', label: 'Technician', color: 'bg-orange-100 text-orange-800' },
  { value: 'site_manager', label: 'Site Manager', color: 'bg-teal-100 text-teal-800' },
  { value: 'user', label: 'User', color: 'bg-slate-100 text-slate-800' },
  { value: 'driver', label: 'Driver', color: 'bg-green-100 text-green-800' },
  { value: 'viewer', label: 'Viewer', color: 'bg-gray-100 text-gray-800' },
];

export default function UserManagement() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Get company from URL parameter (if coming from company management page)
  const urlCompanyId = searchParams.get('company');
  const [selectedCompanyTab, setSelectedCompanyTab] = useState(urlCompanyId || 'all');

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    job_title: '',
    role: 'user',
    company_id: '',
  });

  const isSuperAdmin = userProfile?.role === 'super_admin';

  // Update selected company tab when URL changes
  useEffect(() => {
    if (urlCompanyId) {
      setSelectedCompanyTab(urlCompanyId);
    }
  }, [urlCompanyId]);

  // Set company_id from selected tab when modal opens
  useEffect(() => {
    if (showCreateModal && selectedCompanyTab !== 'all') {
      setFormData(prev => ({ ...prev, company_id: selectedCompanyTab }));
    }
  }, [showCreateModal, selectedCompanyTab]);

  // Fetch users
  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: async () => {
      let query = supabase
        .from('user_profiles')
        .select('*, companies(name)')
        .order('created_at', { ascending: false });

      if (!isSuperAdmin && userProfile?.company_id) {
        query = query.eq('company_id', userProfile.company_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch companies with user counts for tabs
  const { data: companies = [] } = useQuery({
    queryKey: ['adminCompaniesWithCounts'],
    queryFn: async () => {
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('id, name, logo_url, primary_color')
        .eq('is_active', true)
        .order('name');
      
      if (companiesError) throw companiesError;

      // Fetch users directly to get accurate counts
      let userQuery = supabase
        .from('user_profiles')
        .select('company_id');

      if (!isSuperAdmin && userProfile?.company_id) {
        userQuery = userQuery.eq('company_id', userProfile.company_id);
      }

      const { data: allUsers, error: usersError } = await userQuery;
      if (usersError) throw usersError;

      // Get user counts per company
      const userCounts = {};
      allUsers?.forEach(u => {
        if (u.company_id) {
          userCounts[u.company_id] = (userCounts[u.company_id] || 0) + 1;
        }
      });

      return companiesData.map(c => ({
        ...c,
        userCount: userCounts[c.id] || 0
      }));
    },
    enabled: isSuperAdmin,
    staleTime: 0, // Always refetch when invalidated
  });

  // Create user mutation - uses edge function with admin API
  const createUserMutation = useMutation({
    mutationFn: async (userData) => {
      // Determine company_id: from form, selected tab, or user's company
      const companyId = userData.company_id || 
                        (selectedCompanyTab !== 'all' ? selectedCompanyTab : null) || 
                        userProfile?.company_id;
      
      if (!companyId) {
        throw new Error('Company ID is required. Please select a company.');
      }

      try {
        const response = await supabaseClient.admin.createUser({
          email: userData.email,
          password: userData.password,
          full_name: userData.full_name,
          phone: userData.phone,
          job_title: userData.job_title,
          role: userData.role,
          company_id: companyId,
        });

        // Edge function returns { success, message, user, profile } on success
        // or { error, details } on error
        if (response?.error) {
          throw new Error(response.error);
        }

        if (!response?.success) {
          throw new Error(response?.message || 'Failed to create user');
        }

        return response;
      } catch (error) {
        // Handle network errors or edge function errors
        const errorMessage = error?.message || error?.error || 'Failed to send a request to the Edge Function';
        throw new Error(errorMessage);
      }
    },
    onSuccess: () => {
      // Invalidate and refetch both user and company queries
      // Company query needs refresh because user counts change when new user is created
      queryClient.invalidateQueries(['adminUsers']);
      queryClient.invalidateQueries({ queryKey: ['adminCompaniesWithCounts'] });
      queryClient.refetchQueries({ queryKey: ['adminCompaniesWithCounts'] });
      setShowCreateModal(false);
      resetForm();
      toast(formatSuccessForToast('create', 'user'));
    },
    onError: (error) => {
      toast(formatErrorForToast(error, 'creating user'));
    },
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({ id, ...userData }) => {
      const { data, error } = await supabase
        .from('user_profiles')
        .update({
          full_name: userData.full_name,
          phone: userData.phone,
          job_title: userData.job_title,
          role: userData.role,
          company_id: userData.company_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalidate and refetch both user and company queries
      // Company query needs refresh because user counts change when company_id changes
      queryClient.invalidateQueries(['adminUsers']);
      queryClient.invalidateQueries({ queryKey: ['adminCompaniesWithCounts'] });
      queryClient.refetchQueries({ queryKey: ['adminCompaniesWithCounts'] });
      setShowEditModal(false);
      setSelectedUser(null);
      toast(formatSuccessForToast('update', 'user'));
    },
    onError: (error) => {
      toast(formatErrorForToast(error, 'updating user'));
    },
  });

  // Toggle user status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, is_active }) => {
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(['adminUsers']);
      const action = variables.is_active ? 'activate' : 'deactivate';
      toast(formatSuccessForToast(action, 'user'));
    },
    onError: (error) => {
      toast(formatErrorForToast(error, 'updating user status'));
    },
  });

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      full_name: '',
      phone: '',
      job_title: '',
      role: 'user',
      company_id: selectedCompanyTab !== 'all' ? selectedCompanyTab : '',
    });
  };

  const handleEdit = (user) => {
    setSelectedUser(user);
    setFormData({
      email: user.email,
      full_name: user.full_name || '',
      phone: user.phone || '',
      job_title: user.job_title || '',
      role: user.role,
      company_id: user.company_id,
    });
    setShowEditModal(true);
  };

  // Filter users based on selected company tab, search, and role
  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchQuery ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesCompany = selectedCompanyTab === 'all' || user.company_id === selectedCompanyTab;
    return matchesSearch && matchesRole && matchesCompany;
  });

  const getRoleBadge = (role) => {
    const roleConfig = ROLES.find(r => r.value === role) || { 
      value: role, 
      label: role?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown', 
      color: 'bg-gray-100 text-gray-800' 
    };
    return <Badge className={roleConfig.color}>{roleConfig.label}</Badge>;
  };

  // Note: Access control is handled by ProtectedRoute wrapper in App.jsx
  // This component will only render if user has admin or super_admin role

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
                <Users className="w-6 h-6" />
                User Management
              </h1>
              <p className="text-slate-300 text-sm">Create and manage user accounts</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Company Tabs - Only for Super Admin */}
        {isSuperAdmin && (
          <Card className="mb-6">
            <CardContent className="p-0">
              <Tabs value={selectedCompanyTab} onValueChange={setSelectedCompanyTab}>
                <div className="border-b px-4 pt-4">
                  <TabsList className="h-auto p-0 bg-transparent border-none">
                    <TabsTrigger
                      value="all"
                      className="data-[state=active]:border-b-2 data-[state=active]:border-[#7CB342] rounded-none px-4 py-3"
                    >
                      <Globe className="w-4 h-4 mr-2" />
                      All Users
                      <Badge className="ml-2 bg-slate-200 text-slate-700">{users.length}</Badge>
                    </TabsTrigger>
                    {companies.map(company => (
                      <TabsTrigger
                        key={company.id}
                        value={company.id}
                        className="data-[state=active]:border-b-2 data-[state=active]:border-[#7CB342] rounded-none px-4 py-3"
                      >
                        {company.logo_url ? (
                          <img
                            src={company.logo_url}
                            alt={company.name}
                            className="w-5 h-5 object-contain mr-2"
                          />
                        ) : (
                          <div
                            className="w-5 h-5 rounded flex items-center justify-center text-white text-xs font-bold mr-2"
                            style={{ backgroundColor: company.primary_color || '#7CB342' }}
                          >
                            {company.name?.charAt(0)}
                          </div>
                        )}
                        {company.name}
                        <Badge className="ml-2 bg-slate-200 text-slate-700">{company.userCount}</Badge>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>
              </Tabs>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {ROLES.map(role => (
                    <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                className="bg-[#7CB342] hover:bg-[#689F38]"
                onClick={() => setShowCreateModal(true)}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Add User
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>Users ({filteredUsers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingUsers ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-[#7CB342] animate-spin" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                No users found matching your criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-slate-600">User</th>
                      <th className="text-left py-3 px-4 font-medium text-slate-600">Role</th>
                      {isSuperAdmin && (
                        <th className="text-left py-3 px-4 font-medium text-slate-600">Company</th>
                      )}
                      <th className="text-left py-3 px-4 font-medium text-slate-600">Status</th>
                      <th className="text-right py-3 px-4 font-medium text-slate-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(user => (
                      <tr key={user.id} className="border-b hover:bg-slate-50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7CB342] to-[#558B2F] flex items-center justify-center text-white font-bold">
                              {user.full_name?.charAt(0) || user.email?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-slate-800">{user.full_name || 'No name'}</p>
                              <p className="text-sm text-slate-500">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">{getRoleBadge(user.role)}</td>
                        {isSuperAdmin && (
                          <td className="py-3 px-4">
                            <span className="text-slate-600">{user.companies?.name || '-'}</span>
                          </td>
                        )}
                        <td className="py-3 px-4">
                          {user.is_active !== false ? (
                            <Badge className="bg-green-100 text-green-800">Active</Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-800">Inactive</Badge>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(user)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => toggleStatusMutation.mutate({
                                  id: user.id,
                                  is_active: user.is_active === false
                                })}
                              >
                                {user.is_active !== false ? (
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
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create User Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            {selectedCompanyTab !== 'all' && companies.find(c => c.id === selectedCompanyTab) && (
              <p className="text-sm text-slate-500 mt-1">
                Creating user for: <span className="font-medium text-slate-700">
                  {companies.find(c => c.id === selectedCompanyTab)?.name}
                </span>
              </p>
            )}
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="user@company.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Password *</Label>
                <Input
                  type="text"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Min 6 characters"
                />
                <p className="text-xs text-slate-500">Save this password - user will need it to log in</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+61..."
                />
              </div>
              <div className="space-y-2">
                <Label>Job Title</Label>
                <Input
                  value={formData.job_title}
                  onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                  placeholder="Fleet Manager"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.filter(r => isSuperAdmin || r.value !== 'super_admin').map(role => (
                    <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isSuperAdmin && (
              <div className="space-y-2">
                <Label>Company *</Label>
                <Select
                  value={formData.company_id}
                  onValueChange={(value) => setFormData({ ...formData, company_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select company" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map(company => (
                      <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedCompanyTab !== 'all' && formData.company_id === selectedCompanyTab && (
                  <p className="text-xs text-slate-500">
                    Pre-filled from selected company tab
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button
              className="bg-[#7CB342] hover:bg-[#689F38]"
              onClick={() => createUserMutation.mutate(formData)}
              disabled={createUserMutation.isPending || !formData.email || !formData.password || formData.password.length < 6}
            >
              {createUserMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={formData.email} disabled className="bg-slate-50" />
            </div>
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Job Title</Label>
                <Input
                  value={formData.job_title}
                  onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.filter(r => isSuperAdmin || r.value !== 'super_admin').map(role => (
                    <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isSuperAdmin && (
              <div className="space-y-2">
                <Label>Company</Label>
                <Select
                  value={formData.company_id}
                  onValueChange={(value) => setFormData({ ...formData, company_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map(company => (
                      <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button
              className="bg-[#7CB342] hover:bg-[#689F38]"
              onClick={() => updateUserMutation.mutate({ id: selectedUser.id, ...formData })}
              disabled={updateUserMutation.isPending}
            >
              {updateUserMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
