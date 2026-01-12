import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Recent Activity Feed Function
 * Fetches recent changes and events for the activity feed
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { customerRef, siteRef, limit = 20 } = body;

    const activities = [];
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Fetch recent scans (washes)
    try {
      const scansResponse = await base44.asServiceRole.functions.invoke('elora_scans', {
        fromDate: sevenDaysAgo.toISOString().split('T')[0],
        toDate: now.toISOString().split('T')[0],
        customerRef,
        siteRef
      });

      const recentScans = scansResponse.data || [];
      const scansByVehicle = new Map();

      recentScans.forEach(scan => {
        const key = scan.vehicleRef;
        if (!scansByVehicle.has(key)) {
          scansByVehicle.set(key, {
            vehicleName: scan.vehicleName || 'Unknown Vehicle',
            count: 0,
            lastScan: scan.scanDate
          });
        }
        const existing = scansByVehicle.get(key);
        existing.count += 1;
        if (scan.scanDate > existing.lastScan) {
          existing.lastScan = scan.scanDate;
        }
      });

      scansByVehicle.forEach((data, vehicleRef) => {
        activities.push({
          id: `wash-${vehicleRef}`,
          type: 'wash',
          title: `${data.vehicleName} completed ${data.count} wash${data.count > 1 ? 'es' : ''}`,
          description: `Last wash on ${new Date(data.lastScan).toLocaleDateString()}`,
          timestamp: data.lastScan
        });
      });
    } catch (error) {
      console.error('Error fetching scans for activity:', error);
    }

    // Fetch recent maintenance records
    try {
      const maintenanceResponse = await base44.asServiceRole.entities.Maintenance.list('-service_date', limit);
      const recentMaintenance = maintenanceResponse || [];

      recentMaintenance
        .filter(m => new Date(m.service_date) >= sevenDaysAgo)
        .forEach(maintenance => {
          activities.push({
            id: `maintenance-${maintenance.id}`,
            type: 'maintenance',
            title: `Maintenance: ${maintenance.service_type || 'Service'}`,
            description: `Vehicle: ${maintenance.vehicle_name || 'Unknown'} - ${maintenance.description || 'No description'}`,
            timestamp: maintenance.service_date
          });
        });
    } catch (error) {
      console.error('Error fetching maintenance for activity:', error);
    }

    // Fetch recent vehicles (if any were added)
    try {
      const vehiclesResponse = await base44.asServiceRole.entities.Vehicle.list('-created_date', 10);
      const recentVehicles = vehiclesResponse || [];

      recentVehicles
        .filter(v => v.created_date && new Date(v.created_date) >= sevenDaysAgo)
        .forEach(vehicle => {
          activities.push({
            id: `vehicle-${vehicle.id}`,
            type: 'vehicle_added',
            title: `New vehicle added: ${vehicle.name || 'Unknown'}`,
            description: `Site: ${vehicle.site_name || 'Unknown site'}`,
            timestamp: vehicle.created_date
          });
        });
    } catch (error) {
      console.error('Error fetching vehicles for activity:', error);
    }

    // Sort activities by timestamp (newest first)
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Limit results
    const limitedActivities = activities.slice(0, limit);

    return new Response(JSON.stringify({
      success: true,
      data: limitedActivities
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message,
      data: []
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
