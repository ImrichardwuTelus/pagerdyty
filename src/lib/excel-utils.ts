import * as XLSX from 'xlsx';
import type { ExcelServiceRow } from '@/types/pagerduty';

export interface ExcelColumn {
  key: keyof ExcelServiceRow;
  header: string;
  width?: number;
}

export const EXCEL_COLUMNS: ExcelColumn[] = [
  { key: 'service_name_mp', header: 'Service Name MP', width: 200 },
  { key: 'service_path', header: 'Service Path', width: 150 },
  { key: 'cmdb_id', header: 'CMDB ID', width: 120 },
  { key: 'api_name', header: 'API Name', width: 120 },
  { key: 'prime_manager', header: 'Prime Manager', width: 150 },
  { key: 'prime_director', header: 'Prime Director', width: 150 },
  { key: 'prime_vp', header: 'Prime VP', width: 120 },
  { key: 'mse', header: 'MSE', width: 100 },
  { key: 'dyna_service_name', header: 'DynaService Name', width: 150 },
  { key: 'next_hop_process_group', header: 'Next Hop Process Group', width: 180 },
  { key: 'analysis_status', header: 'Analysis Status', width: 130 },
  { key: 'next_hop_service_code', header: 'Next Hop Service Code', width: 170 },
  { key: 'enrichment_status', header: 'Enrichment Status', width: 140 },
  { key: 'team_name', header: 'Team Name', width: 120 },
  { key: 'confirmed', header: 'Confirmed', width: 100 },
  { key: 'owned_team', header: 'Owned Team', width: 120 },
  { key: 'service_id', header: 'Service ID', width: 120 },
];

export interface ExcelReadResult {
  data: ExcelServiceRow[];
  success: boolean;
  error?: string;
  totalRows: number;
}

export interface ExcelWriteResult {
  success: boolean;
  error?: string;
  fileName?: string;
}

/**
 * Reads data from a local Excel file in the src directory
 */
export async function readLocalExcelFile(fileName: string): Promise<ExcelReadResult> {
  try {
    const response = await fetch(`/${fileName}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: 'array' });

    // Get the first worksheet
    const worksheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[worksheetName];

    // Convert to JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (jsonData.length === 0) {
      return {
        data: [],
        success: false,
        error: 'Excel file is empty',
        totalRows: 0
      };
    }

    // Get headers from first row
    const headers = jsonData[0] as string[];
    const dataRows = jsonData.slice(1) as any[][];

    // Map headers to our column keys
    const headerMapping = createHeaderMapping(headers);

    // Convert rows to ExcelServiceRow objects
    const excelData: ExcelServiceRow[] = dataRows
      .filter(row => row.some(cell => cell !== undefined && cell !== ''))
      .map((row, index) => {
        const rowData: Partial<ExcelServiceRow> = {
          id: generateRowId(row, index),
          lastUpdated: new Date().toISOString(),
        };

        // Map each cell to the appropriate field
        headers.forEach((header, colIndex) => {
          const fieldKey = headerMapping[header];
          if (fieldKey && colIndex < row.length) {
            const cellValue = row[colIndex];
            if (cellValue !== undefined && cellValue !== '') {
              (rowData as any)[fieldKey] = String(cellValue).trim();
            }
          }
        });

        // Calculate completion percentage
        const completedFields = EXCEL_COLUMNS.filter(col =>
          rowData[col.key] && String(rowData[col.key]).trim() !== ''
        ).length;
        rowData.completion = Math.round((completedFields / EXCEL_COLUMNS.length) * 100);

        return rowData as ExcelServiceRow;
      });

    return {
      data: excelData,
      success: true,
      totalRows: excelData.length
    };

  } catch (error) {
    return {
      data: [],
      success: false,
      error: `Failed to read local Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      totalRows: 0
    };
  }
}

/**
 * Reads data from an Excel file
 */
export function readExcelFile(file: File): Promise<ExcelReadResult> {
  return new Promise((resolve) => {
    try {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });

          // Get the first worksheet
          const worksheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[worksheetName];

          // Convert to JSON
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          if (jsonData.length === 0) {
            resolve({
              data: [],
              success: false,
              error: 'Excel file is empty',
              totalRows: 0
            });
            return;
          }

          // Get headers from first row
          const headers = jsonData[0] as string[];
          const dataRows = jsonData.slice(1) as any[][];

          // Map headers to our column keys
          const headerMapping = createHeaderMapping(headers);

          // Convert rows to ExcelServiceRow objects
          const excelData: ExcelServiceRow[] = dataRows
            .filter(row => row.some(cell => cell !== undefined && cell !== ''))
            .map((row, index) => {
              const rowData: Partial<ExcelServiceRow> = {
                id: generateRowId(row, index),
                lastUpdated: new Date().toISOString(),
              };

              // Map each cell to the appropriate field
              headers.forEach((header, colIndex) => {
                const fieldKey = headerMapping[header];
                if (fieldKey && colIndex < row.length) {
                  const cellValue = row[colIndex];
                  if (cellValue !== undefined && cellValue !== '') {
                    (rowData as any)[fieldKey] = String(cellValue).trim();
                  }
                }
              });

              // Calculate completion percentage
              const completedFields = EXCEL_COLUMNS.filter(col =>
                rowData[col.key] && String(rowData[col.key]).trim() !== ''
              ).length;
              rowData.completion = Math.round((completedFields / EXCEL_COLUMNS.length) * 100);

              return rowData as ExcelServiceRow;
            });

          resolve({
            data: excelData,
            success: true,
            totalRows: excelData.length
          });

        } catch (parseError) {
          resolve({
            data: [],
            success: false,
            error: `Failed to parse Excel file: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
            totalRows: 0
          });
        }
      };

      reader.onerror = () => {
        resolve({
          data: [],
          success: false,
          error: 'Failed to read file',
          totalRows: 0
        });
      };

      reader.readAsArrayBuffer(file);
    } catch (error) {
      resolve({
        data: [],
        success: false,
        error: `File reading error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        totalRows: 0
      });
    }
  });
}

/**
 * Writes data to an Excel file and downloads it
 */
export function writeExcelFile(data: ExcelServiceRow[], fileName: string = 'service_data.xlsx'): ExcelWriteResult {
  try {
    // Create workbook
    const workbook = XLSX.utils.book_new();

    // Prepare data for Excel
    const excelData = [
      // Headers
      EXCEL_COLUMNS.map(col => col.header),
      // Data rows
      ...data.map(row =>
        EXCEL_COLUMNS.map(col => row[col.key] || '')
      )
    ];

    // Create worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(excelData);

    // Set column widths
    const columnWidths = EXCEL_COLUMNS.map(col => ({ wch: Math.floor((col.width || 100) / 7) }));
    worksheet['!cols'] = columnWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Service Data');

    // Write file
    XLSX.writeFile(workbook, fileName);

    return {
      success: true,
      fileName
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to export Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Creates sample Excel data for testing
 */
export function createSampleExcelData(): ExcelServiceRow[] {
  const sampleData: ExcelServiceRow[] = [
    {
      id: 'sample-1',
      service_name_mp: 'User Authentication Service',
      service_path: '/api/v1/auth',
      cmdb_id: 'CMDB-001',
      api_name: 'auth-service',
      prime_manager: 'John Doe',
      prime_director: 'Jane Smith',
      prime_vp: 'Bob Johnson',
      mse: 'MSE Team Alpha',
      dyna_service_name: 'auth-service-prod',
      next_hop_process_group: 'Authentication Process Group',
      analysis_status: 'active',
      next_hop_service_code: 'AUTH001',
      enrichment_status: 'Enriched',
      team_name: 'Engineering',
      confirmed: 'Yes',
      owned_team: 'Security Team',
      service_id: 'srv-auth-001',
      completion: 100,
      lastUpdated: new Date().toISOString(),
    },
    {
      id: 'sample-2',
      service_name_mp: 'Payment Processing Service',
      service_path: '/api/v1/payments',
      cmdb_id: 'CMDB-002',
      api_name: 'payment-service',
      prime_manager: '',
      prime_director: '',
      prime_vp: '',
      mse: '',
      dyna_service_name: 'payment-service-prod',
      next_hop_process_group: '',
      analysis_status: 'active',
      next_hop_service_code: '',
      enrichment_status: '',
      team_name: 'Finance',
      confirmed: '',
      owned_team: 'Finance Team',
      service_id: 'srv-payment-002',
      completion: 47,
      lastUpdated: new Date().toISOString(),
    },
    {
      id: 'sample-3',
      service_name_mp: 'Notification Service',
      service_path: '',
      cmdb_id: 'CMDB-003',
      api_name: 'notification-service',
      prime_manager: 'Alice Brown',
      prime_director: '',
      prime_vp: '',
      mse: 'MSE Team Beta',
      dyna_service_name: '',
      next_hop_process_group: 'Notification Process Group',
      analysis_status: 'maintenance',
      next_hop_service_code: 'NOTIF001',
      enrichment_status: '',
      team_name: '',
      confirmed: 'No',
      owned_team: '',
      service_id: 'srv-notif-003',
      completion: 53,
      lastUpdated: new Date().toISOString(),
    },
  ];

  return sampleData;
}

/**
 * Calculates row completion percentage
 */
export function calculateRowCompletion(row: ExcelServiceRow): number {
  const completedFields = EXCEL_COLUMNS.filter(col => {
    const value = row[col.key];
    return value && String(value).trim() !== '';
  }).length;

  return Math.round((completedFields / EXCEL_COLUMNS.length) * 100);
}

/**
 * Updates Excel data with changes
 */
export function updateExcelData(
  data: ExcelServiceRow[],
  rowId: string,
  field: keyof ExcelServiceRow,
  value: string
): ExcelServiceRow[] {
  return data.map(row => {
    if (row.id === rowId) {
      const updatedRow = {
        ...row,
        [field]: value,
        lastUpdated: new Date().toISOString(),
      };
      updatedRow.completion = calculateRowCompletion(updatedRow);
      return updatedRow;
    }
    return row;
  });
}

/**
 * Creates header mapping from Excel headers to our field keys
 */
function createHeaderMapping(headers: string[]): Record<string, keyof ExcelServiceRow> {
  const mapping: Record<string, keyof ExcelServiceRow> = {};

  // Log headers for debugging
  console.log('Excel headers found:', headers);

  headers.forEach(header => {
    const normalizedHeader = header.toLowerCase().trim();
    const cleanHeader = normalizedHeader.replace(/[^a-z0-9_]/g, '_');

    // Map exact header matches first (case-insensitive)
    if (normalizedHeader === 'service_name_mp' || cleanHeader === 'service_name_mp') {
      mapping[header] = 'service_name_mp';
    } else if (normalizedHeader === 'service_path' || cleanHeader === 'service_path') {
      mapping[header] = 'service_path';
    } else if (normalizedHeader === 'cmdb_id' || cleanHeader === 'cmdb_id') {
      mapping[header] = 'cmdb_id';
    } else if (normalizedHeader === 'api_name' || cleanHeader === 'api_name') {
      mapping[header] = 'api_name';
    } else if (normalizedHeader === 'prime_manager' || cleanHeader === 'prime_manager') {
      mapping[header] = 'prime_manager';
    } else if (normalizedHeader === 'prime_director' || cleanHeader === 'prime_director') {
      mapping[header] = 'prime_director';
    } else if (normalizedHeader === 'prime_vp' || cleanHeader === 'prime_vp') {
      mapping[header] = 'prime_vp';
    } else if (normalizedHeader === 'mse' || cleanHeader === 'mse') {
      mapping[header] = 'mse';
    } else if (normalizedHeader === 'dyna_service_name' || cleanHeader === 'dyna_service_name') {
      mapping[header] = 'dyna_service_name';
    } else if (normalizedHeader === 'next_hop_process_group' || cleanHeader === 'next_hop_process_group') {
      mapping[header] = 'next_hop_process_group';
    } else if (normalizedHeader === 'analysis_status' || cleanHeader === 'analysis_status') {
      mapping[header] = 'analysis_status';
    } else if (normalizedHeader === 'next_hop_service_code' || cleanHeader === 'next_hop_service_code') {
      mapping[header] = 'next_hop_service_code';
    } else if (normalizedHeader === 'enrichment_status' || cleanHeader === 'enrichment_status') {
      mapping[header] = 'enrichment_status';
    } else if (normalizedHeader === 'team_name' || cleanHeader === 'team_name') {
      mapping[header] = 'team_name';
    } else if (normalizedHeader === 'confirmed' || cleanHeader === 'confirmed') {
      mapping[header] = 'confirmed';
    } else if (normalizedHeader === 'owned_team' || cleanHeader === 'owned_team') {
      mapping[header] = 'owned_team';
    } else if (normalizedHeader === 'service_id' || cleanHeader === 'service_id') {
      mapping[header] = 'service_id';
    }
    // Fallback to partial matching for common variations
    else if (normalizedHeader.includes('service') && (normalizedHeader.includes('name') || normalizedHeader.includes('mp'))) {
      mapping[header] = 'service_name_mp';
    } else if (normalizedHeader.includes('service') && normalizedHeader.includes('path')) {
      mapping[header] = 'service_path';
    } else if (normalizedHeader.includes('cmdb')) {
      mapping[header] = 'cmdb_id';
    } else if (normalizedHeader.includes('api') && normalizedHeader.includes('name')) {
      mapping[header] = 'api_name';
    } else if (normalizedHeader.includes('prime') && normalizedHeader.includes('manager')) {
      mapping[header] = 'prime_manager';
    } else if (normalizedHeader.includes('prime') && normalizedHeader.includes('director')) {
      mapping[header] = 'prime_director';
    } else if (normalizedHeader.includes('prime') && normalizedHeader.includes('vp')) {
      mapping[header] = 'prime_vp';
    } else if (normalizedHeader === 'mse' || normalizedHeader.includes('mse')) {
      mapping[header] = 'mse';
    } else if (normalizedHeader.includes('dyna')) {
      mapping[header] = 'dyna_service_name';
    } else if (normalizedHeader.includes('next') && normalizedHeader.includes('hop') && normalizedHeader.includes('process')) {
      mapping[header] = 'next_hop_process_group';
    } else if (normalizedHeader.includes('analysis') && normalizedHeader.includes('status')) {
      mapping[header] = 'analysis_status';
    } else if (normalizedHeader.includes('next') && normalizedHeader.includes('hop') && normalizedHeader.includes('service')) {
      mapping[header] = 'next_hop_service_code';
    } else if (normalizedHeader.includes('enrichment')) {
      mapping[header] = 'enrichment_status';
    } else if (normalizedHeader.includes('team') && normalizedHeader.includes('name')) {
      mapping[header] = 'team_name';
    } else if (normalizedHeader.includes('confirmed')) {
      mapping[header] = 'confirmed';
    } else if (normalizedHeader.includes('owned') && normalizedHeader.includes('team')) {
      mapping[header] = 'owned_team';
    } else if (normalizedHeader.includes('service') && normalizedHeader.includes('id')) {
      mapping[header] = 'service_id';
    }
  });

  console.log('Header mapping created:', mapping);
  return mapping;
}

/**
 * Generates a unique row ID
 */
function generateRowId(row: any[], index: number): string {
  // Try to use service name or ID if available, otherwise use index
  const serviceName = row.find(cell => cell && typeof cell === 'string' && cell.length > 0);
  if (serviceName) {
    return `row-${serviceName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}-${index}`;
  }
  return `row-${index}`;
}

/**
 * Validates Excel data structure
 */
export function validateExcelData(data: ExcelServiceRow[]): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!Array.isArray(data)) {
    errors.push('Data must be an array');
    return { isValid: false, errors };
  }

  if (data.length === 0) {
    errors.push('No data rows found');
    return { isValid: false, errors };
  }

  // Check for required fields
  data.forEach((row, index) => {
    if (!row.id) {
      errors.push(`Row ${index + 1}: Missing ID`);
    }
    if (!row.service_name_mp && !row.api_name) {
      errors.push(`Row ${index + 1}: Missing service name`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
}