import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { supabaseClient } from '@/api/supabaseClient';
import { getAccessibleTabs, getDefaultEmailReportTypes } from '@/lib/permissions';
import { roleTabSettingsOptions, companyTabSettingsOptions } from '@/query/options';
import { deliveryDriversOptions } from '@/query/options/deliveries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import {
  Users,
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
  Globe,
  KeyRound,
  UserMinus,
  ChevronDown,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  LayoutGrid,
  RotateCcw
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import DataPagination from '@/components/ui/DataPagination';
import UserAvatarWithPresence from '@/components/admin/UserAvatarWithPresence';
import { userPresenceOptions } from '@/query/options';
import moment from 'moment';

const ROLES = [
  { value: 'super_admin', label: 'Super Admin', color: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200' },
  { value: 'admin', label: 'Admin', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200' },
  { value: 'manager', label: 'Manager', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200' },
  { value: 'user', label: 'User', color: 'bg-muted text-muted-foreground' },
  { value: 'batcher', label: 'Batcher', color: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200' },
  { value: 'delivery_manager', label: 'Delivery Manager', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' },
  { value: 'driver', label: 'Driver', color: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200' },
  { value: 'viewer', label: 'Viewer', color: 'bg-muted text-muted-foreground' },
];

const TAB_VISIBILITY_OPTIONS = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'operations-log', label: 'Operations Log' },
  { value: 'operations-log-edit', label: 'Create & Edit Operations Log' },
  { value: 'operations-log-products', label: 'Products in Operations Log entry' },
  { value: 'delivery-calendar', label: 'Delivery Calendar' },
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

const EMAIL_REPORT_TYPES = [
  { id: 'compliance', label: 'Compliance Summary' },
  { id: 'costs', label: 'Cost Analysis' },
];

export default function UserManagement() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { userProfile, isAuthenticated, refetchProfile } = useAuth();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState(null);
  const [resetPasswordNewPassword, setResetPasswordNewPassword] = useState('');
  const [userToDelete, setUserToDelete] = useState(null);
  const [userToRemoveFromCompany, setUserToRemoveFromCompany] = useState(null);
  const [userToAssign, setUserToAssign] = useState(null);
  const [assignToCompanyId, setAssignToCompanyId] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [userForTabVisibility, setUserForTabVisibility] = useState(null);
  const [localTabVisibility, setLocalTabVisibility] = useState([]);
  const [localVisibleDeliveryDriverIds, setLocalVisibleDeliveryDriverIds] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const [companyComboboxOpen, setCompanyComboboxOpen] = useState(false);

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
    assigned_delivery_drivers: [],
  });

  const isSuperAdmin = userProfile?.role === 'super_admin';

  // Fetch user presence (last_seen, online) for admin display
  const { data: presenceMap = {} } = useQuery({
    ...userPresenceOptions(),
    enabled: !!isAuthenticated && !!userProfile,
  });

  // Role tab settings (for Tab visibility dialog) - must be declared before getRoleDefaultTabs
  const { data: roleTabOverrides = {} } = useQuery({
    ...roleTabSettingsOptions(),
    enabled: !!userForTabVisibility,
  });
  const { data: companyTabs = null } = useQuery({
    ...companyTabSettingsOptions(userForTabVisibility?.company_id),
    enabled: !!userForTabVisibility?.company_id,
  });
  const { data: deliveryDrivers = [] } = useQuery({
    ...deliveryDriversOptions(),
    enabled: ((showCreateModal || showEditModal) && formData.role === 'delivery_manager') || (!!userForTabVisibility && userForTabVisibility.role === 'delivery_manager'),
  });

  function getRoleDefaultTabs(role) {
    const stored = roleTabOverrides[role];
    const storedTabs = Array.isArray(stored) ? stored : stored?.visible_tabs;
    if (storedTabs?.length > 0) return storedTabs;
    return getAccessibleTabs({ role }) || [];
  }

  /** Tabs allowed for this user = role ∩ company (company can further restrict). */
  function getBaseTabsForUser(user) {
    const roleDefault = getRoleDefaultTabs(user?.role);
    if (companyTabs && companyTabs.length > 0) {
      return roleDefault.filter((t) => companyTabs.includes(t));
    }
    return roleDefault;
  }

  // When opening Tab visibility dialog, init local state from user override or role default (only tabs allowed by role ∩ company)
  useEffect(() => {
    if (!userForTabVisibility) return;
    const baseTabs = getBaseTabsForUser(userForTabVisibility);
    const current = userForTabVisibility.visible_tabs;
    const base = Array.isArray(current) && current.length > 0 ? current : baseTabs;
    setLocalTabVisibility(base.filter((t) => baseTabs.includes(t)));
    if (userForTabVisibility.role === 'delivery_manager') {
      const assigned = Array.isArray(userForTabVisibility.assigned_delivery_drivers) ? userForTabVisibility.assigned_delivery_drivers : [];
      const visible = Array.isArray(userForTabVisibility.visible_delivery_driver_ids) && userForTabVisibility.visible_delivery_driver_ids.length > 0
        ? userForTabVisibility.visible_delivery_driver_ids
        : assigned;
      setLocalVisibleDeliveryDriverIds(visible.filter((id) => assigned.includes(id)));
    } else {
      setLocalVisibleDeliveryDriverIds([]);
    }
  }, [userForTabVisibility?.id, userForTabVisibility?.role, userForTabVisibility?.company_id, userForTabVisibility?.visible_tabs, userForTabVisibility?.assigned_delivery_drivers, userForTabVisibility?.visible_delivery_driver_ids, roleTabOverrides, companyTabs]);

  // Update selected company tab when URL changes
  useEffect(() => {
    if (urlCompanyId) {
      setSelectedCompanyTab(urlCompanyId);
    }
  }, [urlCompanyId]);

  // Set company_id from selected tab when modal opens
  useEffect(() => {
    if (showCreateModal && selectedCompanyTab !== 'all' && selectedCompanyTab !== 'unassigned') {
      setFormData(prev => ({ ...prev, company_id: selectedCompanyTab }));
    } else if (showCreateModal && selectedCompanyTab === 'unassigned') {
      setFormData(prev => ({ ...prev, company_id: '' }));
    }
  }, [showCreateModal, selectedCompanyTab]);

  // Fetch users
  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: async () => {
      console.log('🔍 FETCHING USERS:', {
        isSuperAdmin,
        userProfileCompanyId: userProfile?.company_id,
        timestamp: new Date().toISOString()
      });

      let query = supabase
        .from('user_profiles')
        .select('*, companies(name)')
        .order('created_at', { ascending: false });

      if (!isSuperAdmin && userProfile?.company_id) {
        query = query.eq('company_id', userProfile.company_id);
      }

      const { data, error } = await query;
      
      console.log('📊 USERS QUERY RESULT:', {
        totalUsers: data?.length || 0,
        error: error?.message || null,
        firstUser: data?.[0],
        sample: data?.slice(0, 3)
      });

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
      // Determine company_id: from form, selected tab, or user's company. Super admin may leave unassigned.
      let companyId = userData.company_id || 
                      (selectedCompanyTab !== 'all' && selectedCompanyTab !== 'unassigned' ? selectedCompanyTab : null) || 
                      (isSuperAdmin ? null : userProfile?.company_id);
      if (companyId === '') companyId = null;

      if (!isSuperAdmin && !companyId) {
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
          company_id: companyId || undefined,
          assigned_delivery_drivers: userData.role === 'delivery_manager' && Array.isArray(userData.assigned_delivery_drivers) && userData.assigned_delivery_drivers.length > 0
            ? userData.assigned_delivery_drivers
            : undefined,
        });

        // Edge function returns { success, message, user, profile } on success
        // or { error, details } on error
        if (response?.error) {
          // Extract the actual error message from the API response
          const errorMsg = typeof response.error === 'string' 
            ? response.error 
            : response.error?.message || response.error;
          throw new Error(errorMsg);
        }

        if (!response?.success) {
          throw new Error(response?.message || 'Failed to create user');
        }

        return response;
      } catch (error) {
        // Handle network errors or edge function errors
        // Extract error message from various possible formats
        let errorMessage = 'Failed to create user';
        
        // The error should already be properly extracted by callEdgeFunction,
        // but we'll do a final check here to ensure we get the message
        if (error instanceof Error && error.message) {
          errorMessage = error.message;
        } else if (error?.message) {
          errorMessage = error.message;
        } else if (error?.error) {
          errorMessage = typeof error.error === 'string' ? error.error : error.error?.message || errorMessage;
        } else if (typeof error === 'string') {
          errorMessage = error;
        }
        
        // Log the full error for debugging
        console.error('Create user error:', error);
        
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
      toastSuccess('create', 'user');
    },
    onError: (error) => {
      toastError(error, 'creating user');
    },
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({ id, ...userData }) => {
      const companyId = userData.company_id === '' ? null : userData.company_id;
      const payload = {
        full_name: userData.full_name,
        phone: userData.phone,
        job_title: userData.job_title,
        role: userData.role,
        company_id: companyId,
        updated_at: new Date().toISOString(),
        ...(companyId == null && { company_name: null }),
        ...(companyId != null && userData.company_name != null && { company_name: userData.company_name }),
      };
      if (userData.role === 'delivery_manager') {
        payload.assigned_delivery_drivers = Array.isArray(userData.assigned_delivery_drivers) ? userData.assigned_delivery_drivers : [];
      } else {
        payload.assigned_delivery_drivers = null;
      }

      const { data, error } = await supabase
        .from('user_profiles')
        .update(payload)
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
      toastSuccess('update', 'user');
    },
    onError: (error) => {
      toastError(error, 'updating user');
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
      toastSuccess(action, 'user');
    },
    onError: (error) => {
      toastError(error, 'updating user status');
    },
  });

  // Reset password mutation (super admin only)
  const resetPasswordMutation = useMutation({
    mutationFn: async ({ user_id, new_password }) => {
      const response = await supabaseClient.admin.updateUserPassword({ user_id, new_password });
      if (response?.error) throw new Error(response.error);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['adminUsers']);
      setShowResetPasswordModal(false);
      setResetPasswordUser(null);
      setResetPasswordNewPassword('');
      toast.success('Password updated', { description: 'The user\'s password has been reset successfully.' });
    },
    onError: (error) => {
      toastError(error, 'resetting password');
    },
  });

  // Save user tab visibility override
  const saveUserTabVisibilityMutation = useMutation({
    mutationFn: async ({ userId, visibleTabs, visibleDeliveryDriverIds }) => {
      const payload = { updated_at: new Date().toISOString() };
      if (visibleTabs === null) {
        payload.visible_tabs = null;
      } else {
        payload.visible_tabs = visibleTabs;
      }
      if (visibleDeliveryDriverIds !== undefined) {
        payload.visible_delivery_driver_ids = visibleDeliveryDriverIds === null || (Array.isArray(visibleDeliveryDriverIds) && visibleDeliveryDriverIds.length === 0) ? null : visibleDeliveryDriverIds;
      }
      const { data, error } = await supabase
        .from('user_profiles')
        .update(payload)
        .eq('id', userId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(['adminUsers']);
      setUserForTabVisibility(null);
      if (variables.userId === userProfile?.id && typeof refetchProfile === 'function') {
        refetchProfile();
      }
      toast.success(
        variables.visibleTabs === null
          ? 'Tab visibility reset to role default'
          : 'Tab visibility saved'
      );
    },
    onError: (error) => {
      toast.error(error?.message || 'Failed to save tab visibility');
    },
  });

  // Delete user mutation (super admin only)
  const deleteUserMutation = useMutation({
    mutationFn: async ({ user_id }) => {
      const response = await supabaseClient.admin.deleteUser({ user_id });
      if (response?.error) throw new Error(response.error);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['adminUsers']);
      queryClient.invalidateQueries({ queryKey: ['adminCompaniesWithCounts'] });
      setUserToDelete(null);
      toastSuccess('delete', 'user');
    },
    onError: (error) => {
      toastError(error, 'deleting user');
      setUserToDelete(null);
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
      company_id: selectedCompanyTab !== 'all' && selectedCompanyTab !== 'unassigned' ? selectedCompanyTab : '',
      assigned_delivery_drivers: [],
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
      company_id: user.company_id ?? '',
      assigned_delivery_drivers: Array.isArray(user.assigned_delivery_drivers) ? user.assigned_delivery_drivers : [],
    });
    setShowEditModal(true);
  };

  const unassignedCount = useMemo(() => users.filter(u => !u.company_id).length, [users]);

  // Group companies by first letter for better organization
  const groupedCompanies = useMemo(() => {
    const groups = {};
    companies.forEach(company => {
      const firstLetter = company.name?.charAt(0).toUpperCase() || '#';
      if (!groups[firstLetter]) {
        groups[firstLetter] = [];
      }
      groups[firstLetter].push(company);
    });
    return Object.keys(groups).sort().map(letter => ({
      letter,
      companies: groups[letter].sort((a, b) => a.name.localeCompare(b.name))
    }));
  }, [companies]);

  // Get display name for selected company
  const getSelectedCompanyDisplay = () => {
    if (selectedCompanyTab === 'all') {
      return { name: 'All Users', icon: <Globe className="w-4 h-4" />, count: users.length };
    }
    if (selectedCompanyTab === 'unassigned') {
      return { name: 'Unassigned', icon: <UserMinus className="w-4 h-4" />, count: unassignedCount };
    }
    const company = companies.find(c => c.id === selectedCompanyTab);
    if (company) {
      return {
        name: company.name,
        icon: company.logo_url ? (
          <img src={company.logo_url} alt={company.name} className="w-4 h-4 object-contain" />
        ) : (
          <div
            className="w-4 h-4 rounded flex items-center justify-center text-white text-xs font-bold"
            style={{ backgroundColor: company.primary_color || 'hsl(var(--primary))' }}
          >
            {company.name?.charAt(0)}
          </div>
        ),
        count: company.userCount || 0
      };
    }
    return { name: 'All Users', icon: <Globe className="w-4 h-4" />, count: users.length };
  };

  // Filter and sort users
  const filteredUsers = useMemo(() => {
    const filtered = users.filter(user => {
      const matchesSearch = !searchQuery ||
        user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.full_name && user.full_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (user.phone && user.phone.includes(searchQuery)) ||
        (user.job_title && user.job_title.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && user.is_active !== false) ||
        (statusFilter === 'inactive' && user.is_active === false);
      const matchesCompany =
        selectedCompanyTab === 'all' ? true
          : selectedCompanyTab === 'unassigned' ? !user.company_id
          : user.company_id === selectedCompanyTab;
      return matchesSearch && matchesRole && matchesStatus && matchesCompany;
    });

    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'name':
          cmp = (a.full_name || '').localeCompare(b.full_name || '');
          break;
        case 'email':
          cmp = (a.email || '').localeCompare(b.email || '');
          break;
        case 'role':
          cmp = (a.role || '').localeCompare(b.role || '');
          break;
        case 'company':
          cmp = (a.companies?.name || '').localeCompare(b.companies?.name || '');
          break;
        case 'status':
          cmp = (a.is_active !== false ? 1 : 0) - (b.is_active !== false ? 1 : 0);
          break;
        case 'created_at':
          cmp = new Date(a.created_at || 0) - new Date(b.created_at || 0);
          break;
        default:
          cmp = (a.full_name || '').localeCompare(b.full_name || '');
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [users, searchQuery, roleFilter, statusFilter, selectedCompanyTab, sortBy, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const paginatedUsers = useMemo(() => {
    return filteredUsers.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    );
  }, [filteredUsers, currentPage, itemsPerPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, roleFilter, statusFilter, selectedCompanyTab, sortBy, sortOrder]);

  const hasActiveFilters =
    searchQuery !== '' ||
    roleFilter !== 'all' ||
    statusFilter !== 'all' ||
    (isSuperAdmin && selectedCompanyTab !== 'all');

  const clearFilters = () => {
    setSearchQuery('');
    setRoleFilter('all');
    setStatusFilter('all');
    if (isSuperAdmin) setSelectedCompanyTab('all');
    setSortBy('name');
    setSortOrder('asc');
    setCurrentPage(1);
  };

  const getRoleBadge = (role) => {
    const roleConfig = ROLES.find(r => r.value === role) || { 
      value: role, 
      label: role?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown', 
      color: 'bg-muted text-muted-foreground' 
    };
    return <Badge className={roleConfig.color}>{roleConfig.label}</Badge>;
  };

  // Note: Access control is handled by ProtectedRoute wrapper in App.jsx
  // This component will only render if user has admin or super_admin role

  return (
    <div className="p-6 space-y-6">
      {/* Company Selector - Only for Super Admin */}
      {isSuperAdmin && (
          <Card className="border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <Label className="text-sm font-medium text-foreground whitespace-nowrap">Filter by Company:</Label>
                <Popover open={companyComboboxOpen} onOpenChange={setCompanyComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={companyComboboxOpen}
                      className="w-[300px] justify-between"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {getSelectedCompanyDisplay().icon}
                        <span className="truncate">{getSelectedCompanyDisplay().name}</span>
                        <Badge variant="secondary" className="ml-auto">
                          {getSelectedCompanyDisplay().count}
                        </Badge>
                      </div>
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search companies..." />
                      <CommandList className="max-h-[400px]">
                        <CommandEmpty>No companies found.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="all"
                            onSelect={() => {
                              setSelectedCompanyTab('all');
                              setCompanyComboboxOpen(false);
                            }}
                          >
                            <Globe className="mr-2 h-4 w-4" />
                            <span>All Users</span>
                            <Badge variant="secondary" className="ml-auto">{users.length}</Badge>
                            {selectedCompanyTab === 'all' && (
                              <Check className="ml-2 h-4 w-4 text-primary" />
                            )}
                          </CommandItem>
                          <CommandItem
                            value="unassigned"
                            onSelect={() => {
                              setSelectedCompanyTab('unassigned');
                              setCompanyComboboxOpen(false);
                            }}
                          >
                            <UserMinus className="mr-2 h-4 w-4" />
                            <span>Unassigned</span>
                            <Badge variant="outline" className="ml-auto">{unassignedCount}</Badge>
                            {selectedCompanyTab === 'unassigned' && (
                              <Check className="ml-2 h-4 w-4 text-primary" />
                            )}
                          </CommandItem>
                        </CommandGroup>
                        {groupedCompanies.map(({ letter, companies: letterCompanies }) => (
                          <CommandGroup key={letter} heading={letter}>
                            {letterCompanies.map((company) => (
                              <CommandItem
                                key={company.id}
                                value={company.id}
                                onSelect={() => {
                                  setSelectedCompanyTab(company.id);
                                  setCompanyComboboxOpen(false);
                                }}
                              >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  {company.logo_url ? (
                                    <img
                                      src={company.logo_url}
                                      alt={company.name}
                                      className="w-4 h-4 object-contain shrink-0"
                                    />
                                  ) : (
                                    <div
                                      className="w-4 h-4 rounded flex items-center justify-center text-white text-xs font-bold shrink-0"
                                      style={{ backgroundColor: company.primary_color || 'hsl(var(--primary))' }}
                                    >
                                      {company.name?.charAt(0)}
                                    </div>
                                  )}
                                  <span className="truncate">{company.name}</span>
                                  <Badge variant="secondary" className="ml-auto shrink-0">
                                    {company.userCount || 0}
                                  </Badge>
                                </div>
                                {selectedCompanyTab === company.id && (
                                  <Check className="ml-2 h-4 w-4 text-primary shrink-0" />
                                )}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        ))}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </CardContent>
          </Card>
        )}

      {/* Filters */}
      <Card className="border-border">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, phone, job title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {ROLES.map(role => (
                  <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="role">Role</SelectItem>
                {isSuperAdmin && <SelectItem value="company">Company</SelectItem>}
                <SelectItem value="status">Status</SelectItem>
                <SelectItem value="created_at">Date created</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
              className="shrink-0"
              title={sortOrder === 'asc' ? 'Ascending (click for descending)' : 'Descending (click for ascending)'}
            >
              {sortOrder === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
            </Button>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                <X className="w-4 h-4 mr-1" />
                Clear filters
              </Button>
            )}
            <Button onClick={() => setShowCreateModal(true)} className="ml-auto shrink-0">
              <UserPlus className="w-4 h-4 mr-2" />
              Add User
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="border-border">
        <CardHeader>
            <CardTitle>Users ({filteredUsers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingUsers ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No users found matching your criteria.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">User</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Presence</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Role</th>
                        {isSuperAdmin && (
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">Company</th>
                        )}
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedUsers.map(user => {
                        const presence = presenceMap[user.id];
                        const isOnline = presence?.isOnline ?? false;
                        const lastSeenAt = presence?.last_seen_at ?? presence?.last_login_at;

                        return (
                      <tr key={user.id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4">
                          <UserAvatarWithPresence
                            name={user.full_name}
                            email={user.email}
                            avatarUrl={user.avatar_url}
                            isOnline={isOnline}
                          />
                        </td>
                        <td className="py-3 px-4">
                          {lastSeenAt ? (
                            <div className="flex flex-col gap-0.5">
                              {isOnline ? (
                                <span className="text-sm font-medium text-green-600 dark:text-green-400">Online</span>
                              ) : (
                                <span className="text-sm text-muted-foreground">
                                  Last seen {moment(lastSeenAt).fromNow()}
                                </span>
                              )}
                              <span className="text-xs text-muted-foreground" title="Last seen at">
                                {moment(lastSeenAt).format('MMM D, YYYY, h:mm A')}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4">{getRoleBadge(user.role)}</td>
                        {isSuperAdmin && (
                          <td className="py-3 px-4">
                            <span className="text-muted-foreground">{user.companies?.name || '-'}</span>
                          </td>
                        )}
                        <td className="py-3 px-4">
                          {user.is_active !== false ? (
                            <Badge variant="default">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
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
                              <DropdownMenuItem onClick={() => setUserForTabVisibility(user)}>
                                <LayoutGrid className="w-4 h-4 mr-2" />
                                Tab visibility
                              </DropdownMenuItem>
                              {isSuperAdmin && !user.company_id && (
                                <DropdownMenuItem onClick={() => { setUserToAssign(user); setAssignToCompanyId(''); }}>
                                  <Building2 className="w-4 h-4 mr-2" />
                                  Assign to company
                                </DropdownMenuItem>
                              )}
                              {isSuperAdmin && (
                                <DropdownMenuItem onClick={() => { setResetPasswordUser(user); setResetPasswordNewPassword(''); setShowResetPasswordModal(true); }}>
                                  <KeyRound className="w-4 h-4 mr-2" />
                                  Reset password
                                </DropdownMenuItem>
                              )}
                              {isSuperAdmin && user.company_id && (
                                <DropdownMenuItem onClick={() => setUserToRemoveFromCompany(user)}>
                                  <UserMinus className="w-4 h-4 mr-2" />
                                  Remove from company
                                </DropdownMenuItem>
                              )}
                              {isSuperAdmin && (
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setUserToDelete(user)}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete user
                                </DropdownMenuItem>
                              )}
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
                      );
                      })}
                    </tbody>
                  </table>
                </div>
                
                {/* Pagination */}
                {totalPages > 1 && (
                  <DataPagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={filteredUsers.length}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setCurrentPage}
                    className="mt-4"
                  />
                )}
              </>
            )}
          </CardContent>
        </Card>

      {/* Create User Modal */}
      <Dialog open={showCreateModal} onOpenChange={(open) => {
        setShowCreateModal(open);
        if (!open) resetForm(); // Clear form when closing
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            {selectedCompanyTab !== 'all' && selectedCompanyTab !== 'unassigned' && companies.find(c => c.id === selectedCompanyTab) && (
              <p className="text-sm text-muted-foreground mt-1">
                Creating user for: <span className="font-medium text-foreground">
                  {companies.find(c => c.id === selectedCompanyTab)?.name}
                </span>
              </p>
            )}
            {selectedCompanyTab === 'unassigned' && (
              <p className="text-sm text-muted-foreground mt-1">Creating unassigned user (no company)</p>
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
                <p className="text-xs text-muted-foreground">Save this password - user will need it to log in</p>
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
                onValueChange={(value) => setFormData({ ...formData, role: value, assigned_delivery_drivers: value === 'delivery_manager' ? formData.assigned_delivery_drivers : [] })}
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
            {formData.role === 'delivery_manager' && (
              <div className="space-y-2">
                <Label>Assigned calendar views (delivery drivers)</Label>
                <p className="text-xs text-muted-foreground">Select which driver calendars this user can see. &quot;All&quot; is only for Super Admin.</p>
                <div className="border border-border rounded-lg p-4 max-h-48 overflow-y-auto space-y-2">
                  {deliveryDrivers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No delivery drivers in system. Sync from Notion on Delivery Calendar page.</p>
                  ) : (
                    deliveryDrivers.map((driver) => (
                      <div key={driver.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`create-driver-${driver.id}`}
                          checked={formData.assigned_delivery_drivers.includes(driver.id)}
                          onCheckedChange={(checked) => {
                            setFormData((prev) => ({
                              ...prev,
                              assigned_delivery_drivers: checked
                                ? [...prev.assigned_delivery_drivers, driver.id]
                                : prev.assigned_delivery_drivers.filter((id) => id !== driver.id),
                            }));
                          }}
                        />
                        <label
                          htmlFor={`create-driver-${driver.id}`}
                          className="text-sm font-medium leading-none cursor-pointer"
                        >
                          {driver.name}
                        </label>
                      </div>
                    ))
                  )}
                </div>
                {formData.assigned_delivery_drivers.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {formData.assigned_delivery_drivers.length} calendar view{formData.assigned_delivery_drivers.length !== 1 ? 's' : ''} selected
                  </p>
                )}
              </div>
            )}
            {isSuperAdmin && (
              <div className="space-y-2">
                <Label>Company {!isSuperAdmin ? '*' : ''}</Label>
                <Select
                  value={formData.company_id ? formData.company_id : 'unassigned'}
                  onValueChange={(v) => setFormData({ ...formData, company_id: v === 'unassigned' ? '' : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select company" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned (no company)</SelectItem>
                    {companies.map(company => (
                      <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedCompanyTab !== 'all' && selectedCompanyTab !== 'unassigned' && formData.company_id === selectedCompanyTab && (
                  <p className="text-xs text-muted-foreground">
                    Pre-filled from selected company tab
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCreateModal(false);
              resetForm();
            }}>Cancel</Button>
            <Button
              className=""
              onClick={() => createUserMutation.mutate(formData)}
              disabled={createUserMutation.isPending || !formData.email || !formData.password || formData.password.length < 6}
            >
              {createUserMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Modal */}
      <Dialog open={showEditModal} onOpenChange={(open) => {
        setShowEditModal(open);
        if (!open) {
          resetForm(); // Clear form when closing
          setSelectedUser(null); // Clear selected user
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={formData.email} disabled className="bg-muted" />
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
                onValueChange={(value) => setFormData({ ...formData, role: value, assigned_delivery_drivers: value === 'delivery_manager' ? formData.assigned_delivery_drivers : [] })}
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
            {formData.role === 'delivery_manager' && (
              <div className="space-y-2">
                <Label>Assigned calendar views (delivery drivers)</Label>
                <p className="text-xs text-muted-foreground">Select which driver calendars this user can see.</p>
                <div className="border border-border rounded-lg p-4 max-h-48 overflow-y-auto space-y-2">
                  {deliveryDrivers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No delivery drivers in system.</p>
                  ) : (
                    deliveryDrivers.map((driver) => (
                      <div key={driver.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`edit-driver-${driver.id}`}
                          checked={formData.assigned_delivery_drivers.includes(driver.id)}
                          onCheckedChange={(checked) => {
                            setFormData((prev) => ({
                              ...prev,
                              assigned_delivery_drivers: checked
                                ? [...prev.assigned_delivery_drivers, driver.id]
                                : prev.assigned_delivery_drivers.filter((id) => id !== driver.id),
                            }));
                          }}
                        />
                        <label
                          htmlFor={`edit-driver-${driver.id}`}
                          className="text-sm font-medium leading-none cursor-pointer"
                        >
                          {driver.name}
                        </label>
                      </div>
                    ))
                  )}
                </div>
                {formData.assigned_delivery_drivers.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {formData.assigned_delivery_drivers.length} calendar view{formData.assigned_delivery_drivers.length !== 1 ? 's' : ''} selected
                  </p>
                )}
              </div>
            )}
            {isSuperAdmin && (
              <div className="space-y-2">
                <Label>Company</Label>
                <Select
                  value={formData.company_id === '' || formData.company_id == null ? 'unassigned' : formData.company_id}
                  onValueChange={(v) => setFormData({ ...formData, company_id: v === 'unassigned' ? '' : v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned (no company)</SelectItem>
                    {companies.map(company => (
                      <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowEditModal(false);
              resetForm();
              setSelectedUser(null);
            }}>Cancel</Button>
            <Button
              className=""
              onClick={() => {
                const companyId = formData.company_id === '' || formData.company_id == null ? '' : formData.company_id;
                const company = companyId ? companies.find(c => c.id === companyId) : null;
                updateUserMutation.mutate({
                  id: selectedUser.id,
                  ...formData,
                  company_id: companyId,
                  company_name: company?.name ?? null,
                });
              }}
              disabled={updateUserMutation.isPending}
            >
              {updateUserMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Modal (super admin only) */}
      <Dialog open={showResetPasswordModal} onOpenChange={(open) => {
        if (!open) { setShowResetPasswordModal(false); setResetPasswordUser(null); setResetPasswordNewPassword(''); }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            {resetPasswordUser && (
              <p className="text-sm text-muted-foreground">
                Set a new password for <span className="font-medium text-foreground">{resetPasswordUser.email}</span>
              </p>
            )}
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>New password *</Label>
              <Input
                type="text"
                value={resetPasswordNewPassword}
                onChange={(e) => setResetPasswordNewPassword(e.target.value)}
                placeholder="Min 6 characters"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowResetPasswordModal(false); setResetPasswordUser(null); setResetPasswordNewPassword(''); }}>
              Cancel
            </Button>
            <Button
              className=""
              onClick={() => resetPasswordUser && resetPasswordMutation.mutate({ user_id: resetPasswordUser.id, new_password: resetPasswordNewPassword })}
              disabled={resetPasswordMutation.isPending || !resetPasswordNewPassword || resetPasswordNewPassword.length < 6}
            >
              {resetPasswordMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign to company modal (unassigned users only) */}
      <Dialog open={!!userToAssign} onOpenChange={(open) => {
        if (!open) { setUserToAssign(null); setAssignToCompanyId(''); }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign to company</DialogTitle>
            {userToAssign && (
              <p className="text-sm text-muted-foreground">
                Assign <span className="font-medium text-foreground">{userToAssign.email}</span> to a company so they can log in.
              </p>
            )}
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Company *</Label>
              <Select value={assignToCompanyId} onValueChange={setAssignToCompanyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map(company => (
                    <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setUserToAssign(null); setAssignToCompanyId(''); }}>
              Cancel
            </Button>
            <Button
              className=""
              disabled={updateUserMutation.isPending || !assignToCompanyId}
              onClick={() => {
                if (!userToAssign || !assignToCompanyId) return;
                const company = companies.find(c => c.id === assignToCompanyId);
                updateUserMutation.mutate(
                  {
                    id: userToAssign.id,
                    full_name: userToAssign.full_name || '',
                    phone: userToAssign.phone || '',
                    job_title: userToAssign.job_title || '',
                    role: userToAssign.role,
                    company_id: assignToCompanyId,
                    company_name: company?.name ?? '',
                  },
                  {
                    onSuccess: () => {
                      setUserToAssign(null);
                      setAssignToCompanyId('');
                    },
                  }
                );
              }}
            >
              {updateUserMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Assign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation */}
      <AlertDialog open={!!userToDelete} onOpenChange={(open) => { if (!open) setUserToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user</AlertDialogTitle>
            <AlertDialogDescription>
              {userToDelete && (
                <>This will permanently delete <span className="font-medium">{userToDelete.email}</span> and remove their access. This cannot be undone.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setUserToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => userToDelete && deleteUserMutation.mutate({ user_id: userToDelete.id })}
            >
              {deleteUserMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete user'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove from Company Confirmation */}
      <AlertDialog open={!!userToRemoveFromCompany} onOpenChange={(open) => { if (!open) setUserToRemoveFromCompany(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from company</AlertDialogTitle>
            <AlertDialogDescription>
              {userToRemoveFromCompany && (
                <>This will unassign <span className="font-medium">{userToRemoveFromCompany.email}</span> from their company. The user account stays active but they will not be able to log in until assigned to a company again.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setUserToRemoveFromCompany(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className=""
              disabled={updateUserMutation.isPending}
              onClick={() => {
                if (!userToRemoveFromCompany) return;
                updateUserMutation.mutate(
                  {
                    id: userToRemoveFromCompany.id,
                    full_name: userToRemoveFromCompany.full_name || '',
                    phone: userToRemoveFromCompany.phone || '',
                    job_title: userToRemoveFromCompany.job_title || '',
                    role: userToRemoveFromCompany.role,
                    company_id: '',
                  },
                  {
                    onSuccess: () => setUserToRemoveFromCompany(null),
                    onError: () => {},
                  }
                );
              }}
            >
              {updateUserMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Remove from company'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Tab visibility per user */}
      <Dialog open={!!userForTabVisibility} onOpenChange={(open) => { if (!open) setUserForTabVisibility(null); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tab visibility</DialogTitle>
            {userForTabVisibility && (
              <p className="text-sm text-muted-foreground">
                Restrict which tabs <span className="font-medium text-foreground">{userForTabVisibility.full_name || userForTabVisibility.email}</span> can see (within their role). Role: {ROLES.find(r => r.value === userForTabVisibility.role)?.label ?? userForTabVisibility.role}.
              </p>
            )}
          </DialogHeader>
          {userForTabVisibility && (() => {
            const baseTabs = getBaseTabsForUser(userForTabVisibility);
            const stored = roleTabOverrides[userForTabVisibility.role];
            const roleEmailReportTypes = stored?.visible_email_report_types !== undefined && stored?.visible_email_report_types !== null
              ? stored.visible_email_report_types
              : getDefaultEmailReportTypes({ role: userForTabVisibility.role });
            const defaultEmailReports = getDefaultEmailReportTypes({ role: userForTabVisibility.role });
            return (
            <div className="space-y-4 py-4">
              <div>
                <h4 className="text-sm font-medium text-foreground mb-3">Tab Visibility</h4>
                <p className="text-xs text-muted-foreground mb-3">
                  Only tabs allowed by this role (and company, if set) can be enabled. Toggle off to hide a tab from this user. Tabs not allowed are disabled.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 gap-4">
                  {TAB_VISIBILITY_OPTIONS.map((tab) => {
                    const roleAllows = baseTabs.includes(tab.value);
                    const checked = localTabVisibility.includes(tab.value);
                    return (
                      <div
                        key={tab.value}
                        className={`flex items-center justify-between p-3 rounded-lg border border-border ${!roleAllows ? 'opacity-60' : ''}`}
                      >
                        <span className="text-sm font-medium text-foreground">{tab.label}</span>
                        <Switch
                          checked={roleAllows && checked}
                          disabled={!roleAllows}
                          onCheckedChange={(newChecked) => {
                            if (!roleAllows) return;
                            setLocalTabVisibility((prev) =>
                              newChecked
                                ? [...prev, tab.value]
                                : prev.filter((t) => t !== tab.value)
                            );
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
              {userForTabVisibility.role === 'delivery_manager' && baseTabs.includes('delivery-calendar') && localTabVisibility.includes('delivery-calendar') && (() => {
                const assignedIds = Array.isArray(userForTabVisibility.assigned_delivery_drivers) ? userForTabVisibility.assigned_delivery_drivers : [];
                const driversForAssigned = deliveryDrivers.filter((d) => assignedIds.includes(d.id));
                if (driversForAssigned.length === 0) return null;
                return (
                  <div>
                    <h4 className="text-sm font-medium text-foreground mb-3">Delivery calendar views</h4>
                    <p className="text-xs text-muted-foreground mb-3">
                      Restrict which of the assigned driver calendars this user can see. Uncheck to hide a calendar view.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {driversForAssigned.map((driver) => (
                        <div key={driver.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`tabvis-driver-${driver.id}`}
                            checked={localVisibleDeliveryDriverIds.includes(driver.id)}
                            onCheckedChange={(checked) => {
                              setLocalVisibleDeliveryDriverIds((prev) =>
                                checked ? [...prev, driver.id] : prev.filter((id) => id !== driver.id)
                              );
                            }}
                          />
                          <label htmlFor={`tabvis-driver-${driver.id}`} className="text-sm font-medium cursor-pointer">
                            {driver.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
              <div>
                <h4 className="text-sm font-medium text-foreground mb-3">Email Report Types (Select Reports to Include)</h4>
                <p className="text-xs text-muted-foreground mb-3">
                  Which report sections can this user include when sending email reports? Controlled by this user&apos;s role (Tab Visibility). Disabled types will not appear in the Email Reports page.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {EMAIL_REPORT_TYPES.map((report) => {
                    const allowed = roleEmailReportTypes.includes(report.id);
                    return (
                      <div
                        key={report.id}
                        className={`flex items-center justify-between p-3 rounded-lg border border-border ${!allowed ? 'opacity-60' : ''}`}
                      >
                        <span className="text-sm font-medium text-foreground">{report.label}</span>
                        <Switch checked={allowed} disabled />
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Role allows: {roleEmailReportTypes.join(', ') || 'none'} (Default: {defaultEmailReports.join(', ') || 'none'})
                </p>
              </div>
            </div>
            );
          })()}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUserForTabVisibility(null)}
            >
              Cancel
            </Button>
            {userForTabVisibility && (
              <>
                <Button
                  variant="outline"
                  onClick={() =>
                    saveUserTabVisibilityMutation.mutate({
                      userId: userForTabVisibility.id,
                      visibleTabs: null,
                      visibleDeliveryDriverIds: userForTabVisibility.role === 'delivery_manager' ? null : undefined,
                    })
                  }
                  disabled={saveUserTabVisibilityMutation.isPending}
                >
                  {saveUserTabVisibilityMutation.isPending && saveUserTabVisibilityMutation.variables?.visibleTabs === null ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  ) : (
                    <RotateCcw className="w-4 h-4 mr-1" />
                  )}
                  Reset to role default
                </Button>
                <Button
                  onClick={() => {
                    const baseTabs = getBaseTabsForUser(userForTabVisibility);
                    const toSave = localTabVisibility.filter((t) => baseTabs.includes(t));
                    const hasDeliveryCalendar = toSave.includes('delivery-calendar');
                    saveUserTabVisibilityMutation.mutate({
                      userId: userForTabVisibility.id,
                      visibleTabs: toSave.length > 0 ? toSave : null,
                      visibleDeliveryDriverIds: userForTabVisibility.role === 'delivery_manager'
                        ? (hasDeliveryCalendar && localVisibleDeliveryDriverIds.length > 0 ? localVisibleDeliveryDriverIds : null)
                        : undefined,
                    });
                  }}
                  disabled={saveUserTabVisibilityMutation.isPending || localTabVisibility.length === 0}
                >
                  {saveUserTabVisibilityMutation.isPending && saveUserTabVisibilityMutation.variables?.visibleTabs !== null ? (
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
    </div>
  );
}
