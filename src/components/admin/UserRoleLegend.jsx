import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Shield } from 'lucide-react';

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
    color: 'bg-primary',
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
    color: 'bg-muted-foreground',
    description: 'Read-only access',
    permissions: ['All tabs (read-only)', 'View reports', 'No editing', 'No admin']
  }
};

export default function UserRoleLegend() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">User Role Management</h2>
        <p className="text-muted-foreground mt-1">Manage user roles and permissions</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(ROLE_CONFIG).map(([role, config]) => (
          <Card key={role} className="border-border hover:bg-muted/30 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 ${config.color} rounded-lg flex items-center justify-center shrink-0`}>
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground">{config.label}</p>
                  <p className="text-xs text-muted-foreground mb-2">{config.description}</p>
                  <div className="space-y-1">
                    {config.permissions.map((permission, idx) => (
                      <div key={idx} className="flex items-center gap-1 text-xs text-muted-foreground">
                        <div className="w-1 h-1 rounded-full bg-muted-foreground/60" />
                        <span>{permission}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
