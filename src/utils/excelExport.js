import * as XLSX from 'xlsx';
import moment from 'moment';

/**
 * Excel Export Utility
 * Provides professional Excel export functionality with formatting
 */

export function exportToExcel(data, filename = 'export', sheetName = 'Sheet1') {
  try {
    // Create workbook
    const wb = XLSX.utils.book_new();

    // Create worksheet from data
    const ws = XLSX.utils.json_to_sheet(data);

    // Auto-size columns
    const colWidths = calculateColumnWidths(data);
    ws['!cols'] = colWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    // Generate file
    const timestamp = moment().format('YYYY-MM-DD_HH-mm');
    const fullFilename = `${filename}_${timestamp}.xlsx`;
    XLSX.writeFile(wb, fullFilename);

    return { success: true, filename: fullFilename };
  } catch (error) {
    console.error('Excel export error:', error);
    return { success: false, error: error.message };
  }
}

export function exportMultiSheetExcel(sheets, filename = 'export') {
  try {
    const wb = XLSX.utils.book_new();

    sheets.forEach(({ data, name }) => {
      const ws = XLSX.utils.json_to_sheet(data);
      const colWidths = calculateColumnWidths(data);
      ws['!cols'] = colWidths;
      XLSX.utils.book_append_sheet(wb, ws, name);
    });

    const timestamp = moment().format('YYYY-MM-DD_HH-mm');
    const fullFilename = `${filename}_${timestamp}.xlsx`;
    XLSX.writeFile(wb, fullFilename);

    return { success: true, filename: fullFilename };
  } catch (error) {
    console.error('Multi-sheet Excel export error:', error);
    return { success: false, error: error.message };
  }
}

// Calculate optimal column widths based on content
function calculateColumnWidths(data) {
  if (!data || data.length === 0) return [];

  const keys = Object.keys(data[0]);
  return keys.map(key => {
    const maxLength = Math.max(
      key.length,
      ...data.map(row => {
        const value = row[key];
        return value ? String(value).length : 0;
      })
    );
    return { wch: Math.min(maxLength + 2, 50) }; // Max width 50 chars
  });
}

// Export vehicle compliance report
export function exportVehicleComplianceReport(vehicles, dateRange) {
  const data = vehicles.map(vehicle => ({
    'Vehicle Name': vehicle.name || 'Unknown',
    'Site': vehicle.site_name || 'N/A',
    'RFID': vehicle.rfid || 'N/A',
    'Washes Completed': vehicle.washes_completed || 0,
    'Target Washes': vehicle.target || 0,
    'Compliance Rate': `${Math.round(((vehicle.washes_completed || 0) / (vehicle.target || 1)) * 100)}%`,
    'Status': (vehicle.washes_completed || 0) >= (vehicle.target || 0) ? 'Compliant' : 'At Risk',
    'Last Wash': vehicle.last_scan ? moment(vehicle.last_scan).format('YYYY-MM-DD HH:mm') : 'Never',
  }));

  return exportToExcel(data, 'vehicle_compliance_report', 'Compliance');
}

// Export maintenance report
export function exportMaintenanceReport(maintenanceRecords) {
  const data = maintenanceRecords.map(record => ({
    'Vehicle Name': record.vehicle_name || 'Unknown',
    'Service Type': record.service_type || 'N/A',
    'Service Date': record.service_date ? moment(record.service_date).format('YYYY-MM-DD') : 'N/A',
    'Next Service Date': record.next_service_date ? moment(record.next_service_date).format('YYYY-MM-DD') : 'N/A',
    'Cost': record.cost ? `$${record.cost.toFixed(2)}` : '$0.00',
    'Description': record.description || '',
    'Status': record.status || 'Completed',
  }));

  return exportToExcel(data, 'maintenance_report', 'Maintenance');
}

// Export comprehensive fleet report (multiple sheets)
export function exportComprehensiveFleetReport(vehicles, scans, maintenanceRecords) {
  const sheets = [
    {
      name: 'Vehicle Summary',
      data: vehicles.map(v => ({
        'Vehicle Name': v.name || 'Unknown',
        'Site': v.site_name || 'N/A',
        'RFID': v.rfid || 'N/A',
        'Washes Completed': v.washes_completed || 0,
        'Target': v.target || 0,
        'Compliance Rate': `${Math.round(((v.washes_completed || 0) / (v.target || 1)) * 100)}%`,
        'Last Wash': v.last_scan ? moment(v.last_scan).format('YYYY-MM-DD HH:mm') : 'Never',
      }))
    },
    {
      name: 'Wash History',
      data: scans.map(scan => ({
        'Date': moment(scan.timestamp).format('YYYY-MM-DD HH:mm'),
        'Vehicle': scan.vehicleName || 'Unknown',
        'Site': scan.siteName || 'Unknown',
        'RFID': scan.vehicleRef || 'N/A',
      }))
    }
  ];

  if (maintenanceRecords && maintenanceRecords.length > 0) {
    sheets.push({
      name: 'Maintenance',
      data: maintenanceRecords.map(m => ({
        'Vehicle': m.vehicle_name || 'Unknown',
        'Service Type': m.service_type || 'N/A',
        'Service Date': m.service_date ? moment(m.service_date).format('YYYY-MM-DD') : 'N/A',
        'Cost': m.cost ? `$${m.cost.toFixed(2)}` : '$0.00',
        'Description': m.description || '',
      }))
    });
  }

  return exportMultiSheetExcel(sheets, 'fleet_report');
}

// Export site summary report
export function exportSiteSummaryReport(sites, vehicles) {
  const data = sites.map(site => {
    const siteVehicles = vehicles.filter(v => v.site_id === site.id);
    const totalVehicles = siteVehicles.length;
    const totalWashes = siteVehicles.reduce((sum, v) => sum + (v.washes_completed || 0), 0);
    const compliantVehicles = siteVehicles.filter(v => (v.washes_completed || 0) >= (v.target || 0)).length;

    return {
      'Site Name': site.name || 'Unknown',
      'Total Vehicles': totalVehicles,
      'Total Washes': totalWashes,
      'Compliant Vehicles': compliantVehicles,
      'Compliance Rate': totalVehicles > 0 ? `${Math.round((compliantVehicles / totalVehicles) * 100)}%` : '0%',
      'Average Washes per Vehicle': totalVehicles > 0 ? Math.round(totalWashes / totalVehicles) : 0,
    };
  });

  return exportToExcel(data, 'site_summary_report', 'Sites');
}
