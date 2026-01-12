import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Use service role for system-level checks
    const vehicles = await base44.asServiceRole.entities.Vehicle.list('-updated_date', 1000);
    const maintenanceRecords = await base44.asServiceRole.entities.Maintenance.list('-service_date', 1000);
    const users = await base44.asServiceRole.entities.User.list();
    const preferences = await base44.asServiceRole.entities.NotificationPreferences.list();
    
    const notifications = [];
    const now = new Date();

    // Create preference map for quick lookup
    const prefsMap = {};
    preferences.forEach(pref => {
      prefsMap[pref.user_email] = pref;
    });

    // Check maintenance notifications
    for (const record of maintenanceRecords) {
      if (!record.next_service_date || !record.vehicle_id) continue;

      const nextDate = new Date(record.next_service_date);
      const daysUntil = Math.ceil((nextDate - now) / (1000 * 60 * 60 * 24));

      // Find users who should be notified about this vehicle
      const relevantUsers = users.filter(user => {
        if (user.role === 'admin') return true;
        if (user.role === 'site_manager') {
          const vehicle = vehicles.find(v => v.id === record.vehicle_id);
          return vehicle && user.assigned_sites?.includes(vehicle.site_id);
        }
        if (user.role === 'driver') {
          return user.assigned_vehicles?.includes(record.vehicle_id);
        }
        return false;
      });

      for (const user of relevantUsers) {
        const userPrefs = prefsMap[user.email] || {
          notify_maintenance_due: true,
          notify_maintenance_overdue: true,
          maintenance_due_days: 7
        };

        // Check for overdue maintenance
        if (daysUntil < 0 && userPrefs.notify_maintenance_overdue) {
          // Check if notification already exists
          const existing = await base44.asServiceRole.entities.Notification.filter({
            user_email: user.email,
            type: 'maintenance_overdue',
            'metadata.maintenance_id': record.id
          });

          if (existing.length === 0 || existing[0].read) {
            notifications.push({
              user_email: user.email,
              title: '🚨 Overdue Maintenance',
              message: `${record.vehicle_name} has overdue ${record.service_type.replace('_', ' ')} service (${Math.abs(daysUntil)} days overdue)`,
              type: 'maintenance_overdue',
              severity: 'critical',
              metadata: {
                vehicle_id: record.vehicle_id,
                maintenance_id: record.id
              }
            });
          }
        }
        // Check for upcoming maintenance
        else if (daysUntil > 0 && daysUntil <= userPrefs.maintenance_due_days && userPrefs.notify_maintenance_due) {
          const existing = await base44.asServiceRole.entities.Notification.filter({
            user_email: user.email,
            type: 'maintenance_due',
            'metadata.maintenance_id': record.id
          });

          if (existing.length === 0 || existing[0].read) {
            notifications.push({
              user_email: user.email,
              title: '⚠️ Maintenance Due Soon',
              message: `${record.vehicle_name} has ${record.service_type.replace('_', ' ')} service due in ${daysUntil} days`,
              type: 'maintenance_due',
              severity: daysUntil <= 3 ? 'warning' : 'info',
              metadata: {
                vehicle_id: record.vehicle_id,
                maintenance_id: record.id
              }
            });
          }
        }
      }
    }

    // Check compliance notifications
    for (const vehicle of vehicles) {
      if (!vehicle.washes_completed || !vehicle.target) continue;

      const complianceRate = (vehicle.washes_completed / vehicle.target) * 100;

      // Find users who should be notified about this vehicle
      const relevantUsers = users.filter(user => {
        if (user.role === 'admin') return true;
        if (user.role === 'site_manager') {
          return user.assigned_sites?.includes(vehicle.site_id);
        }
        if (user.role === 'driver') {
          return user.assigned_vehicles?.includes(vehicle.id);
        }
        return false;
      });

      for (const user of relevantUsers) {
        const userPrefs = prefsMap[user.email] || {
          notify_low_compliance: true,
          compliance_threshold: 50
        };

        if (complianceRate < userPrefs.compliance_threshold && userPrefs.notify_low_compliance) {
          const existing = await base44.asServiceRole.entities.Notification.filter({
            user_email: user.email,
            type: 'low_compliance',
            'metadata.vehicle_id': vehicle.id
          });

          // Only send if no unread notification exists for this vehicle
          if (existing.length === 0 || existing.every(n => n.read)) {
            notifications.push({
              user_email: user.email,
              title: '📉 Low Compliance Alert',
              message: `${vehicle.name} is at ${Math.round(complianceRate)}% compliance (${vehicle.washes_completed}/${vehicle.target} washes)`,
              type: 'low_compliance',
              severity: complianceRate < 25 ? 'critical' : 'warning',
              metadata: {
                vehicle_id: vehicle.id,
                compliance_rate: complianceRate
              }
            });
          }
        }
      }
    }

    // Create notifications and send emails
    const createdNotifications = [];
    for (const notification of notifications) {
      const created = await base44.asServiceRole.entities.Notification.create(notification);
      createdNotifications.push(created);

      // Send email if user has email notifications enabled
      const userPrefs = prefsMap[notification.user_email];
      if (userPrefs?.email_notifications_enabled) {
        try {
          await base44.asServiceRole.integrations.Core.SendEmail({
            from: 'noreply@elora.com.au',
            to: notification.user_email,
            subject: notification.title,
            body: `${notification.message}\n\nThis is an automated notification from Fleet Compliance Portal.`
          });
        } catch (emailError) {
          console.error('Failed to send email:', emailError);
        }
      }
    }

    return Response.json({
      success: true,
      notifications_created: createdNotifications.length,
      message: `Created ${createdNotifications.length} notifications`
    });

  } catch (error) {
    console.error('Error checking notifications:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});