import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Users,
  Building2,
  Shield,
  Activity,
  ArrowLeft,
  UserPlus,
  Settings,
  TrendingUp,
  Loader2,
  AlertCircle
} from 'lucide-react';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { userProfile, isLoadingAuth, authError, checkAuth } = useAuth();

  // Check if user has admin access
  const isAdmin = userProfile?.role === 'super_admin' || userProfile?.role === 'admin';

  const { data: stats, isLoading } = useQuery({
    queryKey: ['adminStats'],
    queryFn: async () => {
      const [usersResult, companiesResult] = await Promise.all([
        supabase.from('user_profiles').select('id, role, is_active', { count: 'exact' }),
        supabase.from('companies').select('id, is_active', { count: 'exact' })
      ]);

      const users = usersResult.data || [];
      const companies = companiesResult.data || [];

      return {
        totalUsers: users.length,
        activeUsers: users.filter(u => u.is_active !== false).length,
        totalCompanies: companies.length,
        activeCompanies: companies.filter(c => c.is_active !== false).length,
        adminCount: users.filter(u => u.role === 'admin' || u.role === 'super_admin').length,
        usersByRole: {
          super_admin: users.filter(u => u.role === 'super_admin').length,
          admin: users.filter(u => u.role === 'admin').length,
          manager: users.filter(u => u.role === 'manager').length,
          user: users.filter(u => u.role === 'user').length,
        }
      };
    },
    enabled: isAdmin && !isLoadingAuth,
  });

  // Show loading while auth is being checked
  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#7CB342] animate-spin" />
      </div>
    );
  }

  // Show timeout/connection error with retry option
  if (authError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-800 mb-2">Connection Issue</h2>
            <p className="text-slate-600 mb-4">
              {authError.type === 'timeout'
                ? 'The authentication check timed out. Please check your connection and try again.'
                : authError.message || 'An error occurred while checking your credentials.'}
            </p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => navigate('/')}>Return to Dashboard</Button>
              <Button onClick={() => checkAuth()}>Retry</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-800 mb-2">Access Denied</h2>
            <p className="text-slate-600 mb-4">You don't have permission to access the admin area.</p>
            <Button onClick={() => navigate('/')}>Return to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/10"
                onClick={() => navigate('/')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Dashboard
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Admin Console</h1>
                <p className="text-slate-300 text-sm">Manage users, companies, and settings</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-[#7CB342] rounded-full text-sm font-medium">
                {userProfile?.role?.replace('_', ' ').toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Total Users</p>
                  <p className="text-3xl font-bold text-slate-800 mt-1">
                    {isLoading ? '-' : stats?.totalUsers}
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    {stats?.activeUsers} active
                  </p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Companies</p>
                  <p className="text-3xl font-bold text-slate-800 mt-1">
                    {isLoading ? '-' : stats?.totalCompanies}
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    {stats?.activeCompanies} active
                  </p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Administrators</p>
                  <p className="text-3xl font-bold text-slate-800 mt-1">
                    {isLoading ? '-' : stats?.adminCount}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    With admin access
                  </p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">System Status</p>
                  <p className="text-3xl font-bold text-green-600 mt-1">Healthy</p>
                  <p className="text-xs text-slate-500 mt-1">All systems operational</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                  <Activity className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/admin/users')}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle>User Management</CardTitle>
                  <CardDescription>Create, edit, and manage user accounts</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-slate-600">
                    <span className="font-medium">{stats?.usersByRole?.super_admin || 0}</span> Super Admins
                  </p>
                  <p className="text-sm text-slate-600">
                    <span className="font-medium">{stats?.usersByRole?.admin || 0}</span> Admins
                  </p>
                  <p className="text-sm text-slate-600">
                    <span className="font-medium">{stats?.usersByRole?.user || 0}</span> Users
                  </p>
                </div>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                  <UserPlus className="w-4 h-4 mr-1" />
                  Add User
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/admin/companies')}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <CardTitle>Company Management</CardTitle>
                  <CardDescription>Manage companies and branding</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-slate-600">Configure company settings</p>
                  <p className="text-sm text-slate-600">Upload logos and colors</p>
                  <p className="text-sm text-slate-600">Link Elora customers</p>
                </div>
                <Button size="sm" className="bg-purple-600 hover:bg-purple-700">
                  <Building2 className="w-4 h-4 mr-1" />
                  Add Company
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/Settings')}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center">
                  <Settings className="w-6 h-6 text-slate-600" />
                </div>
                <div>
                  <CardTitle>System Settings</CardTitle>
                  <CardDescription>Configure global settings</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-slate-600">Email notifications</p>
                  <p className="text-sm text-slate-600">API configuration</p>
                  <p className="text-sm text-slate-600">Default preferences</p>
                </div>
                <Button size="sm" variant="outline">
                  <Settings className="w-4 h-4 mr-1" />
                  Configure
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
