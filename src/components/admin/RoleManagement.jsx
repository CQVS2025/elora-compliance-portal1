import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabaseClient } from "@/api/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Shield, Search, Edit, Loader2 } from 'lucide-react';
import { usePermissions } from '@/components/auth/PermissionGuard';
import UserRoleModal from './UserRoleModal';

const ROLE_CONFIG = {
  super_admin: {
    label: 'Super Admin',
    color: 'bg-red-500',
    description: 'Platform-wide administrator',
    permissions: ['All companies', 'All users', 'All tabs', 'Full system access']
  },
  admin: {
    label: 'Admin',
    color: 'bg-purple-500',
    description: 'Company administrator',
    permissions: ['Company data', 'All tabs (no users)', 'Export reports', 'Full company access']
  },
  manager: {
    label: 'Manager',
    color: 'bg-blue-500',
    description: 'Fleet manager (assigned sites)',
    permissions: ['Assigned sites', 'All tabs (no users)', 'Reports', 'Data export']
  },
  user: {
    label: 'User',
    color: 'bg-slate-500',
    description: 'Standard user (demo/guest)',
    permissions: ['Assigned companies', 'All tabs (no users)', 'View & export', 'No admin']
  },
  batcher: {
    label: 'Batcher',
    color: 'bg-teal-500',
    description: 'Single site manager',
    permissions: ['One assigned site only', 'All tabs (no users)', 'Site locked', 'Site reports']
  },
  driver: {
    label: 'Driver',
    color: 'bg-green-500',
    description: 'Vehicle operator',
    permissions: ['Assigned vehicles only', 'Compliance tab only', 'Mobile access', 'No editing']
  },
  viewer: {
    label: 'Viewer',
    color: 'bg-gray-500',
    description: 'Read-only access',
    permissions: ['All tabs (read-only)', 'View reports', 'No editing', 'No admin']
  }
};

export default function RoleManagement({ vehicles, sites }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const queryClient = useQueryClient();
  const permissions = usePermissions();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const usersList = await supabaseClient.tables.User.list();
      return usersList;
    }
  });

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      (user.email?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (user.full_name?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const handleEditUser = (user) => {
    setSelectedUser(user);
    setModalOpen(true);
  };

  const handleSuccess = () => {
    queryClient.invalidateQueries(['users']);
    setModalOpen(false);
    setSelectedUser(null);
  };

  if (!permissions.canManageUsers) {
    return (
      <div className="text-center py-12">
        <Shield className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <p className="text-slate-600">Only administrators can manage user roles</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-[#7CB342] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Assign User Roles</h2>
        <p className="text-slate-600 mt-1">Manage and assign roles to users</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Users</CardTitle>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              <Select value={filterRole} onValueChange={setFilterRole}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="super_admin">Super Admins</SelectItem>
                  <SelectItem value="admin">Admins</SelectItem>
                  <SelectItem value="manager">Managers</SelectItem>
                  <SelectItem value="user">Users</SelectItem>
                  <SelectItem value="batcher">Batchers</SelectItem>
                  <SelectItem value="driver">Drivers</SelectItem>
                  <SelectItem value="viewer">Viewers</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filteredUsers.length === 0 ? (
              <p className="text-center text-slate-500 py-8">No users found</p>
            ) : (
              filteredUsers.map((user) => {
                const roleConfig = ROLE_CONFIG[user.role || 'driver'] || ROLE_CONFIG.driver;
                return (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 ${roleConfig.color} rounded-full flex items-center justify-center text-white font-semibold`}>
                        {user.full_name?.charAt(0) || user.email?.charAt(0) || '?'}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{user.full_name || 'No Name'}</p>
                        <p className="text-sm text-slate-600">{user.email}</p>
                        {user.role === 'batcher' && user.assigned_sites?.length > 0 && (
                          <p className="text-xs text-slate-500 mt-1">
                            {user.assigned_sites.length} site{user.assigned_sites.length !== 1 ? 's' : ''} assigned
                          </p>
                        )}
                        {user.role === 'driver' && user.assigned_vehicles?.length > 0 && (
                          <p className="text-xs text-slate-500 mt-1">
                            {user.assigned_vehicles.length} vehicle{user.assigned_vehicles.length !== 1 ? 's' : ''} assigned
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={roleConfig.color}>
                        {roleConfig.label}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditUser(user)}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {selectedUser && (
        <UserRoleModal
          open={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setSelectedUser(null);
          }}
          user={selectedUser}
          vehicles={vehicles}
          sites={sites}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}