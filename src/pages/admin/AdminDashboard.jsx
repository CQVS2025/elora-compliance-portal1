import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Users,
  Building2,
  Shield,
  Settings,
  LayoutGrid,
  ArrowRight,
  CheckCircle2,
  Package,
  Box,
  ClipboardList,
} from 'lucide-react';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { userProfile } = useAuth();

  const isAdmin = userProfile?.role === 'super_admin' || userProfile?.role === 'admin';
  const isSuperAdmin = userProfile?.role === 'super_admin';

  const { data: stats, isLoading } = useQuery({
    queryKey: ['adminStats'],
    queryFn: async () => {
      const [usersResult, companiesResult] = await Promise.all([
        supabase.from('user_profiles').select('id, role, is_active', { count: 'exact' }),
        supabase.from('companies').select('id, is_active', { count: 'exact' }),
      ]);

      const users = usersResult.data || [];
      const companies = companiesResult.data || [];

      return {
        totalUsers: users.length,
        activeUsers: users.filter((u) => u.is_active !== false).length,
        totalCompanies: companies.length,
        activeCompanies: companies.filter((c) => c.is_active !== false).length,
        adminCount: users.filter((u) => u.role === 'admin' || u.role === 'super_admin').length,
        usersByRole: {
          super_admin: users.filter((u) => u.role === 'super_admin').length,
          admin: users.filter((u) => u.role === 'admin').length,
          manager: users.filter((u) => u.role === 'manager').length,
          user: users.filter((u) => u.role === 'user').length,
        },
      };
    },
    enabled: isAdmin,
  });

  const statCards = [
    {
      title: 'Total Users',
      value: isLoading ? '–' : stats?.totalUsers,
      sub: stats ? `${stats.activeUsers} active` : null,
      icon: Users,
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
    },
    {
      title: 'Companies',
      value: isLoading ? '–' : stats?.totalCompanies,
      sub: stats ? `${stats.activeCompanies} active` : null,
      icon: Building2,
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
    },
    {
      title: 'Administrators',
      value: isLoading ? '–' : stats?.adminCount,
      sub: 'With admin access',
      icon: Shield,
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
    },
    {
      title: 'System Status',
      value: 'Healthy',
      sub: 'All systems operational',
      icon: CheckCircle2,
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
    },
  ];

  const quickActions = [
    {
      title: 'User Management',
      description: 'Create, edit, and manage user accounts',
      icon: Users,
      path: '/admin/users',
      detail: stats
        ? `${stats.usersByRole?.super_admin || 0} Super Admins · ${stats.usersByRole?.admin || 0} Admins · ${stats.usersByRole?.user || 0} Users`
        : null,
    },
    {
      title: 'Company Management',
      description: 'Manage companies and branding',
      icon: Building2,
      path: '/admin/companies',
      detail: 'Configure company settings, upload logos, link Elora customers',
    },
    {
      title: 'System Settings',
      description: 'Configure global settings',
      icon: Settings,
      path: '/Settings',
      detail: 'Email notifications, API configuration, default preferences',
    },
  ];

  // Only super_admin can see and access these; routes are protected by SuperAdminRoute in App.jsx
  const superAdminOnlyActions = [
    {
      title: 'User Role Management',
      description: 'View role definitions and permissions (read-only)',
      icon: Shield,
      path: '/admin/role-management',
    },
    {
      title: 'Tab Visibility by Role',
      description: 'Override which tabs each role can see on the dashboard',
      icon: LayoutGrid,
      path: '/admin/tab-visibility',
    },
    {
      title: 'Products',
      description: 'Add and manage products (name + price) for Operations Log dropdown',
      icon: Package,
      path: '/admin/products',
    },
    {
      title: 'Parts Catalog (Stock & Orders)',
      description: 'Manage the master parts list for Stock Take and Request Parts',
      icon: Box,
      path: '/admin/parts',
    },
    {
      title: 'Operations Log Categories',
      description: 'Keep default categories and add more for New Entry',
      icon: ClipboardList,
      path: '/admin/operations-log-categories',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Console</h1>
        <p className="text-muted-foreground mt-1">
          Welcome back, {userProfile?.full_name || userProfile?.email?.split('@')[0] || 'Admin'}. Manage users, companies, and settings.
        </p>
      </div>

      <Separator />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold text-primary">{stat.title}</CardTitle>
                <div className={`p-2 rounded-lg ${stat.iconBg}`}>
                  <Icon className={`h-4 w-4 ${stat.iconColor}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                {stat.sub && <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Card
                key={action.title}
                className="cursor-pointer hover:bg-muted/50 transition-colors border-border"
                onClick={() => navigate(action.path)}
              >
                <CardHeader className="flex flex-row items-start gap-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base">{action.title}</CardTitle>
                    <CardDescription>{action.description}</CardDescription>
                    {action.detail && (
                      <p className="text-xs text-muted-foreground mt-2">{action.detail}</p>
                    )}
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
                </CardHeader>
              </Card>
            );
          })}
          {isSuperAdmin &&
            superAdminOnlyActions.map((action) => {
              const Icon = action.icon;
              return (
                <Card
                  key={action.title}
                  className="cursor-pointer hover:bg-muted/50 transition-colors border-border"
                  onClick={() => navigate(action.path)}
                >
                  <CardHeader className="flex flex-row items-center gap-4">
                    <div className="p-3 rounded-lg bg-primary/10">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base">{action.title}</CardTitle>
                      <CardDescription>{action.description}</CardDescription>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
                  </CardHeader>
                </Card>
              );
            })}
        </div>
      </div>
    </div>
  );
}
