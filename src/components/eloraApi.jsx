const API_BASE = '/api/backend-function';

async function fetchFromBackend(functionName, params = {}) {
  const url = new URL(`${API_BASE}/${functionName}`, window.location.origin);
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.append(key, value);
    }
  });

  const response = await fetch(url.toString());
  
  if (!response.ok) {
    throw new Error(`API call failed: ${response.statusText}`);
  }
  
  return response.json();
}

export async function fetchCustomers() {
  return fetchFromBackend('elora_customers');
}

export async function fetchSites(customerId) {
  return fetchFromBackend('elora_sites', { customer_id: customerId });
}

export async function fetchVehicles({ customerId, siteId, startDate, endDate } = {}) {
  return fetchFromBackend('elora_vehicles', {
    customer_id: customerId,
    site_id: siteId,
    start_date: startDate,
    end_date: endDate
  });
}

export async function fetchScans({ vehicleId, startDate, endDate } = {}) {
  return fetchFromBackend('elora_scans', {
    vehicle_id: vehicleId,
    start_date: startDate,
    end_date: endDate
  });
}