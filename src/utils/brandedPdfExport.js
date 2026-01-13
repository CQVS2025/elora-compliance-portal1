/**
 * Branded PDF Export Utility
 *
 * Generates branded PDF reports using company-specific branding settings.
 * This utility creates HTML content that can be converted to PDF using
 * browser print functionality or a PDF generation library.
 */

import { supabaseClient } from '@/api/supabaseClient';

// Default branding for PDF exports
const DEFAULT_PDF_BRANDING = {
  company_name: 'ELORA Fleet',
  pdf_logo_url: null,
  pdf_header_html: null,
  pdf_footer_html: null,
  pdf_accent_color: '#7CB342',
  pdf_include_cover_page: true,
  pdf_cover_page_html: null,
  primary_color: '#7CB342',
};

/**
 * Fetch branding settings for PDF export
 */
export async function fetchPdfBranding(companyId) {
  try {
    const response = await supabaseClient.branding.get({ company_id: companyId });
    if (response?.data && response.data.source !== 'default') {
      return { ...DEFAULT_PDF_BRANDING, ...response.data };
    }
    return DEFAULT_PDF_BRANDING;
  } catch (err) {
    console.warn('Failed to fetch PDF branding:', err);
    return DEFAULT_PDF_BRANDING;
  }
}

/**
 * Generate PDF header HTML
 */
export function generatePdfHeader(branding, reportTitle) {
  if (branding.pdf_header_html) {
    return branding.pdf_header_html
      .replace(/\{\{company_name\}\}/g, branding.company_name || 'ELORA Fleet')
      .replace(/\{\{report_title\}\}/g, reportTitle)
      .replace(/\{\{date\}\}/g, new Date().toLocaleDateString());
  }

  const logoHtml = branding.pdf_logo_url
    ? `<img src="${branding.pdf_logo_url}" alt="${branding.company_name}" style="height: 40px; object-fit: contain;" />`
    : `<span style="font-weight: bold; font-size: 18px; color: ${branding.pdf_accent_color};">${branding.company_name || 'ELORA Fleet'}</span>`;

  return `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px 0; border-bottom: 2px solid ${branding.pdf_accent_color}; margin-bottom: 24px;">
      <div>
        ${logoHtml}
      </div>
      <div style="text-align: right;">
        <div style="font-size: 18px; font-weight: bold; color: #1f2937;">${reportTitle}</div>
        <div style="font-size: 12px; color: #6b7280;">${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
      </div>
    </div>
  `;
}

/**
 * Generate PDF footer HTML
 */
export function generatePdfFooter(branding, pageNumber, totalPages) {
  if (branding.pdf_footer_html) {
    return branding.pdf_footer_html
      .replace(/\{\{page\}\}/g, pageNumber)
      .replace(/\{\{pages\}\}/g, totalPages)
      .replace(/\{\{date\}\}/g, new Date().toLocaleDateString())
      .replace(/\{\{company_name\}\}/g, branding.company_name || 'ELORA Fleet');
  }

  return `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px 0; border-top: 1px solid #e5e7eb; margin-top: 24px; font-size: 11px; color: #6b7280;">
      <div>${branding.company_name || 'ELORA Fleet'} - Confidential</div>
      <div>Page ${pageNumber} of ${totalPages}</div>
      <div>Generated: ${new Date().toLocaleDateString()}</div>
    </div>
  `;
}

/**
 * Generate PDF cover page HTML
 */
export function generatePdfCoverPage(branding, reportTitle, reportSubtitle, metadata = {}) {
  if (!branding.pdf_include_cover_page) {
    return '';
  }

  if (branding.pdf_cover_page_html) {
    return branding.pdf_cover_page_html
      .replace(/\{\{company_name\}\}/g, branding.company_name || 'ELORA Fleet')
      .replace(/\{\{report_title\}\}/g, reportTitle)
      .replace(/\{\{report_subtitle\}\}/g, reportSubtitle || '')
      .replace(/\{\{date\}\}/g, new Date().toLocaleDateString())
      .replace(/\{\{generated_by\}\}/g, metadata.generatedBy || 'System');
  }

  const logoHtml = branding.pdf_logo_url
    ? `<img src="${branding.pdf_logo_url}" alt="${branding.company_name}" style="max-height: 80px; max-width: 300px; object-fit: contain;" />`
    : `<div style="font-size: 32px; font-weight: bold; color: ${branding.pdf_accent_color};">${branding.company_name || 'ELORA Fleet'}</div>`;

  return `
    <div style="page-break-after: always; min-height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 60px;">
      <div style="margin-bottom: 60px;">
        ${logoHtml}
      </div>

      <h1 style="font-size: 36px; font-weight: bold; color: #1f2937; margin: 0 0 16px 0;">
        ${reportTitle}
      </h1>

      ${reportSubtitle ? `
        <p style="font-size: 18px; color: #6b7280; margin: 0 0 40px 0;">
          ${reportSubtitle}
        </p>
      ` : ''}

      <div style="width: 100px; height: 4px; background: ${branding.pdf_accent_color}; margin: 40px 0;"></div>

      <div style="font-size: 14px; color: #6b7280;">
        <p style="margin: 8px 0;">Generated: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        ${metadata.dateRange ? `<p style="margin: 8px 0;">Report Period: ${metadata.dateRange}</p>` : ''}
        ${metadata.generatedBy ? `<p style="margin: 8px 0;">Generated by: ${metadata.generatedBy}</p>` : ''}
      </div>
    </div>
  `;
}

/**
 * Generate a complete branded PDF document HTML
 */
export function generateBrandedPdfHtml(branding, options = {}) {
  const {
    reportTitle = 'Fleet Compliance Report',
    reportSubtitle = '',
    content = '',
    metadata = {},
    includeCover = branding.pdf_include_cover_page,
    pageNumber = 1,
    totalPages = 1,
  } = options;

  const coverPage = includeCover ? generatePdfCoverPage(branding, reportTitle, reportSubtitle, metadata) : '';
  const header = generatePdfHeader(branding, reportTitle);
  const footer = generatePdfFooter(branding, pageNumber, totalPages);

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>${reportTitle} - ${branding.company_name || 'ELORA Fleet'}</title>
        <style>
          @page {
            size: A4;
            margin: 20mm;
          }

          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            font-size: 12px;
            line-height: 1.5;
            color: #1f2937;
            margin: 0;
            padding: 0;
          }

          .page-break {
            page-break-after: always;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin: 16px 0;
          }

          th, td {
            padding: 10px 12px;
            text-align: left;
            border-bottom: 1px solid #e5e7eb;
          }

          th {
            background-color: ${branding.pdf_accent_color};
            color: white;
            font-weight: 600;
            text-transform: uppercase;
            font-size: 11px;
          }

          tr:nth-child(even) {
            background-color: #f9fafb;
          }

          .stat-card {
            display: inline-block;
            width: calc(25% - 12px);
            margin: 4px;
            padding: 16px;
            background: #f9fafb;
            border-radius: 8px;
            text-align: center;
          }

          .stat-value {
            font-size: 24px;
            font-weight: bold;
            color: ${branding.pdf_accent_color};
          }

          .stat-label {
            font-size: 11px;
            color: #6b7280;
            text-transform: uppercase;
          }

          .section-title {
            font-size: 16px;
            font-weight: bold;
            color: #1f2937;
            margin: 24px 0 12px 0;
            padding-bottom: 8px;
            border-bottom: 2px solid ${branding.pdf_accent_color};
          }

          .badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 600;
          }

          .badge-success {
            background: #dcfce7;
            color: #166534;
          }

          .badge-warning {
            background: #fef3c7;
            color: #92400e;
          }

          .badge-danger {
            background: #fee2e2;
            color: #991b1b;
          }

          @media print {
            body {
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        ${coverPage}

        <div class="report-content">
          ${header}
          ${content}
          ${footer}
        </div>
      </body>
    </html>
  `;
}

/**
 * Generate compliance report table HTML
 */
export function generateComplianceTableHtml(vehicles, branding) {
  if (!vehicles || vehicles.length === 0) {
    return '<p style="text-align: center; color: #6b7280; padding: 40px;">No vehicle data available</p>';
  }

  const rows = vehicles.map(vehicle => {
    const compliance = vehicle.target > 0
      ? Math.round((vehicle.washes_completed / vehicle.target) * 100)
      : 0;

    let badgeClass = 'badge-success';
    if (compliance < 50) badgeClass = 'badge-danger';
    else if (compliance < 80) badgeClass = 'badge-warning';

    return `
      <tr>
        <td style="font-weight: 600;">${vehicle.name || vehicle.vehicleName || '-'}</td>
        <td>${vehicle.site_name || vehicle.siteName || '-'}</td>
        <td>${vehicle.washes_completed || 0}</td>
        <td>${vehicle.target || '-'}</td>
        <td><span class="badge ${badgeClass}">${compliance}%</span></td>
        <td>${vehicle.last_scan ? new Date(vehicle.last_scan).toLocaleDateString() : '-'}</td>
      </tr>
    `;
  }).join('');

  return `
    <table>
      <thead>
        <tr>
          <th>Vehicle</th>
          <th>Site</th>
          <th>Washes</th>
          <th>Target</th>
          <th>Compliance</th>
          <th>Last Wash</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

/**
 * Generate summary stats HTML
 */
export function generateSummaryStatsHtml(stats, branding) {
  return `
    <div style="display: flex; flex-wrap: wrap; margin: 20px -4px;">
      <div class="stat-card">
        <div class="stat-value">${stats.totalVehicles || 0}</div>
        <div class="stat-label">Total Vehicles</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.complianceRate || 0}%</div>
        <div class="stat-label">Compliance Rate</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.totalWashes || 0}</div>
        <div class="stat-label">Total Washes</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.activeVehicles || 0}</div>
        <div class="stat-label">Active Vehicles</div>
      </div>
    </div>
  `;
}

/**
 * Open print dialog for PDF export
 */
export function printBrandedPdf(htmlContent) {
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();

    // Wait for content to load then print
    setTimeout(() => {
      printWindow.print();
    }, 500);
  }
}

/**
 * Generate and print a full compliance report
 */
export async function exportComplianceReportPdf(companyId, vehicles, stats, options = {}) {
  const branding = await fetchPdfBranding(companyId);

  const summaryHtml = generateSummaryStatsHtml(stats, branding);
  const tableHtml = generateComplianceTableHtml(vehicles, branding);

  const content = `
    <div class="section-title">Summary</div>
    ${summaryHtml}

    <div class="section-title">Vehicle Compliance Details</div>
    ${tableHtml}
  `;

  const pdfHtml = generateBrandedPdfHtml(branding, {
    reportTitle: options.reportTitle || 'Fleet Compliance Report',
    reportSubtitle: options.reportSubtitle || `${vehicles.length} Vehicles`,
    content,
    metadata: {
      dateRange: options.dateRange,
      generatedBy: options.generatedBy,
    },
  });

  printBrandedPdf(pdfHtml);
}

export default {
  fetchPdfBranding,
  generatePdfHeader,
  generatePdfFooter,
  generatePdfCoverPage,
  generateBrandedPdfHtml,
  generateComplianceTableHtml,
  generateSummaryStatsHtml,
  printBrandedPdf,
  exportComplianceReportPdf,
};
