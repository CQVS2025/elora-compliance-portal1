import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import UserRoleLegend from '@/components/admin/UserRoleLegend';

export default function RoleManagementInfo() {
  return (
    <div className="p-6">
      <Card className="border-border">
        <CardContent className="p-6">
          <UserRoleLegend />
        </CardContent>
      </Card>
    </div>
  );
}
