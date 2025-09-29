import * as XLSX from 'xlsx';
import type { ExcelServiceRow } from '@/types/pagerduty';

export interface ExcelColumn {
  key: keyof ExcelServiceRow;
  header: string;
  width?: number;
}

export const EXCEL_COLUMNS: ExcelColumn[] = [
  { key: 'mp_service_name', header: 'MP Service Name', width: 200 },
  { key: 'mp_service_path', header: 'MP Service Path', width: 150 },
  { key: 'mp_cmdb_id', header: 'MP CMDB ID', width: 120 },
  { key: 'pd_tech_svc', header: 'PD Tech SVC', width: 120 },
  { key: 'prime_manager', header: 'Prime Manager', width: 150 },
  { key: 'prime_director', header: 'Prime Director', width: 150 },
  { key: 'prime_vp', header: 'Prime VP', width: 120 },
  { key: 'mse', header: 'MSE', width: 100 },
  { key: 'dt_service_name', header: 'DT Service Name', width: 150 },
  { key: 'next_hop_process_group', header: 'Next Hop Process Group', width: 180 },
  { key: 'next_hop_endpoint', header: 'Next Hop Endpoint', width: 170 },
  { key: 'analysis_status', header: 'Analysis Status', width: 130 },
  { key: 'next_hop_service_code', header: 'Next Hop Service Code', width: 170 },
  { key: 'pd_team_name', header: 'PD Team Name', width: 120 },
  { key: 'integrated_with_pd', header: 'Integrated with PD', width: 180 },
  { key: 'user_acknowledge', header: 'User Acknowledge', width: 120 },
  { key: 'dt_service_id', header: 'DT Service ID', width: 120 },
  { key: 'terraform_onboarding', header: 'Terraform Onboarding', width: 150 },
  { key: 'team_name_does_not_exist', header: 'Team Name Does Not Exist', width: 180 },
  { key: 'tech_svc_does_not_exist', header: 'Tech SVC Does Not Exist', width: 180 },
  { key: 'update_team_name', header: 'Update Team Name', width: 150 },
  { key: 'update_tech_svc', header: 'Update Tech SVC', width: 150 },
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
 * Reads data from a local Excel file using the server API
 */
export async function readLocalExcelFile(fileName: string): Promise<ExcelReadResult> {
  try {
    const response = await fetch('/api/excel');
    if (!response.ok) {
      throw new Error(`Failed to fetch Excel data: ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.success) {
      return {
        data: [],
        success: false,
        error: result.error || 'Failed to read Excel file',
        totalRows: 0,
      };
    }

    return {
      data: result.data,
      success: true,
      totalRows: result.totalRows,
    };
  } catch (error) {
    return {
      data: [],
      success: false,
      error: `Failed to read Excel file: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
      totalRows: 0,
    };
  }
}

/**
 * Reads data from an Excel file
 */
export function readExcelFile(file: File): Promise<ExcelReadResult> {
  return new Promise(resolve => {
    try {
      const reader = new FileReader();

      reader.onload = e => {
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
              totalRows: 0,
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
              const completedFields = EXCEL_COLUMNS.filter(
                col => rowData[col.key] && String(rowData[col.key]).trim() !== ''
              ).length;
              rowData.completion = Math.round((completedFields / EXCEL_COLUMNS.length) * 100);

              return rowData as ExcelServiceRow;
            });

          resolve({
            data: excelData,
            success: true,
            totalRows: excelData.length,
          });
        } catch (parseError) {
          resolve({
            data: [],
            success: false,
            error: `Failed to parse Excel file: ${
              parseError instanceof Error ? parseError.message : 'Unknown error'
            }`,
            totalRows: 0,
          });
        }
      };

      reader.onerror = () => {
        resolve({
          data: [],
          success: false,
          error: 'Failed to read file',
          totalRows: 0,
        });
      };

      reader.readAsArrayBuffer(file);
    } catch (error) {
      resolve({
        data: [],
        success: false,
        error: `File reading error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        totalRows: 0,
      });
    }
  });
}

/**
 * Writes data to the Excel file on the server
 */
export async function writeExcelFile(
  data: ExcelServiceRow[],
  fileName: string = 'service_data.xlsx'
): Promise<ExcelWriteResult> {
  try {
    const response = await fetch('/api/excel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data,
        preserveHeaders: true,
        fileName,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to write Excel file: ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to write Excel file',
      };
    }

    return {
      success: true,
      fileName: fileName,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to write Excel file: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    };
  }
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
export function createHeaderMapping(headers: string[]): Record<string, keyof ExcelServiceRow> {
  const mapping: Record<string, keyof ExcelServiceRow> = {};

  // Log headers for debugging
  console.log('Excel headers found:', headers);

  headers.forEach(header => {
    const normalizedHeader = header.toLowerCase().trim();
    const cleanHeader = normalizedHeader.replace(/[^a-z0-9_]/g, '_');

    // Map exact header matches first (case-insensitive)
    if (
      normalizedHeader === 'mp_service_name' ||
      cleanHeader === 'mp_service_name' ||
      normalizedHeader === 'mp service name'
    ) {
      mapping[header] = 'mp_service_name';
    } else if (
      normalizedHeader === 'mp_service_path' ||
      cleanHeader === 'mp_service_path' ||
      normalizedHeader === 'mp service path'
    ) {
      mapping[header] = 'mp_service_path';
    } else if (
      normalizedHeader === 'mp_cmdb_id' ||
      cleanHeader === 'mp_cmdb_id' ||
      normalizedHeader === 'mp cmdb id'
    ) {
      mapping[header] = 'mp_cmdb_id';
    } else if (
      normalizedHeader === 'pd_tech_svc' ||
      cleanHeader === 'pd_tech_svc' ||
      normalizedHeader === 'pd tech svc'
    ) {
      mapping[header] = 'pd_tech_svc';
    } else if (
      normalizedHeader === 'prime_manager' ||
      cleanHeader === 'prime_manager' ||
      normalizedHeader === 'prime manager'
    ) {
      mapping[header] = 'prime_manager';
    } else if (
      normalizedHeader === 'prime_director' ||
      cleanHeader === 'prime_director' ||
      normalizedHeader === 'prime director'
    ) {
      mapping[header] = 'prime_director';
    } else if (
      normalizedHeader === 'prime_vp' ||
      cleanHeader === 'prime_vp' ||
      normalizedHeader === 'prime vp'
    ) {
      mapping[header] = 'prime_vp';
    } else if (normalizedHeader === 'mse' || cleanHeader === 'mse') {
      mapping[header] = 'mse';
    } else if (
      normalizedHeader === 'dt_service_name' ||
      cleanHeader === 'dt_service_name' ||
      normalizedHeader === 'dt service name'
    ) {
      mapping[header] = 'dt_service_name';
    } else if (
      normalizedHeader === 'next_hop_process_group' ||
      cleanHeader === 'next_hop_process_group' ||
      normalizedHeader === 'next hop process group'
    ) {
      mapping[header] = 'next_hop_process_group';
    } else if (
      normalizedHeader === 'next_hop_endpoint' ||
      cleanHeader === 'next_hop_endpoint' ||
      normalizedHeader === 'next hop endpoint'
    ) {
      mapping[header] = 'next_hop_endpoint';
    } else if (
      normalizedHeader === 'analysis_status' ||
      cleanHeader === 'analysis_status' ||
      normalizedHeader === 'analysis status'
    ) {
      mapping[header] = 'analysis_status';
    } else if (
      normalizedHeader === 'next_hop_service_code' ||
      cleanHeader === 'next_hop_service_code' ||
      normalizedHeader === 'next hop service code'
    ) {
      mapping[header] = 'next_hop_service_code';
    } else if (
      normalizedHeader === 'pd_team_name' ||
      cleanHeader === 'pd_team_name' ||
      normalizedHeader === 'pd team name'
    ) {
      mapping[header] = 'pd_team_name';
    } else if (
      normalizedHeader === 'integrated_with_pd' ||
      cleanHeader === 'integrated_with_pd' ||
      normalizedHeader === 'integrated with pd'
    ) {
      mapping[header] = 'integrated_with_pd';
    } else if (
      normalizedHeader === 'user_acknowledge' ||
      cleanHeader === 'user_acknowledge' ||
      normalizedHeader === 'user acknowledge'
    ) {
      mapping[header] = 'user_acknowledge';
    } else if (
      normalizedHeader === 'dt_service_id' ||
      cleanHeader === 'dt_service_id' ||
      normalizedHeader === 'dt service id'
    ) {
      mapping[header] = 'dt_service_id';
    } else if (
      normalizedHeader === 'terraform_onboarding' ||
      cleanHeader === 'terraform_onboarding' ||
      normalizedHeader === 'terraform onboarding'
    ) {
      mapping[header] = 'terraform_onboarding';
    } else if (
      normalizedHeader === 'team_name_does_not_exist' ||
      cleanHeader === 'team_name_does_not_exist' ||
      normalizedHeader === 'team name does not exist'
    ) {
      mapping[header] = 'team_name_does_not_exist';
    } else if (
      normalizedHeader === 'tech_svc_does_not_exist' ||
      cleanHeader === 'tech_svc_does_not_exist' ||
      normalizedHeader === 'tech svc does not exist'
    ) {
      mapping[header] = 'tech_svc_does_not_exist';
    } else if (
      normalizedHeader === 'update_team_name' ||
      cleanHeader === 'update_team_name' ||
      normalizedHeader === 'update team name'
    ) {
      mapping[header] = 'update_team_name';
    } else if (
      normalizedHeader === 'update_tech_svc' ||
      cleanHeader === 'update_tech_svc' ||
      normalizedHeader === 'update tech svc'
    ) {
      mapping[header] = 'update_tech_svc';
    }
    // Fallback to partial matching for common variations
    else if (
      normalizedHeader.includes('service') &&
      (normalizedHeader.includes('name') || normalizedHeader.includes('mp'))
    ) {
      mapping[header] = 'mp_service_name';
    } else if (normalizedHeader.includes('service') && normalizedHeader.includes('path')) {
      mapping[header] = 'mp_service_path';
    } else if (normalizedHeader.includes('cmdb')) {
      mapping[header] = 'mp_cmdb_id';
    } else if (normalizedHeader.includes('prime') && normalizedHeader.includes('manager')) {
      mapping[header] = 'prime_manager';
    } else if (normalizedHeader.includes('prime') && normalizedHeader.includes('director')) {
      mapping[header] = 'prime_director';
    } else if (normalizedHeader.includes('prime') && normalizedHeader.includes('vp')) {
      mapping[header] = 'prime_vp';
    } else if (normalizedHeader === 'mse' || normalizedHeader.includes('mse')) {
      mapping[header] = 'mse';
    } else if (
      normalizedHeader.includes('dt') &&
      normalizedHeader.includes('service') &&
      normalizedHeader.includes('name')
    ) {
      mapping[header] = 'dt_service_name';
    } else if (
      normalizedHeader.includes('next') &&
      normalizedHeader.includes('hop') &&
      normalizedHeader.includes('process')
    ) {
      mapping[header] = 'next_hop_process_group';
    } else if (
      normalizedHeader.includes('next') &&
      normalizedHeader.includes('hop') &&
      normalizedHeader.includes('endpoint')
    ) {
      mapping[header] = 'next_hop_endpoint';
    } else if (normalizedHeader.includes('analysis') && normalizedHeader.includes('status')) {
      mapping[header] = 'analysis_status';
    } else if (
      normalizedHeader.includes('next') &&
      normalizedHeader.includes('hop') &&
      normalizedHeader.includes('service')
    ) {
      mapping[header] = 'next_hop_service_code';
    } else if (normalizedHeader.includes('pd') && normalizedHeader.includes('team')) {
      mapping[header] = 'pd_team_name';
    } else if (normalizedHeader.includes('integrated') && normalizedHeader.includes('pd')) {
      mapping[header] = 'integrated_with_pd';
    } else if (normalizedHeader.includes('user') && normalizedHeader.includes('acknowledge')) {
      mapping[header] = 'user_acknowledge';
    } else if (normalizedHeader.includes('pd') && normalizedHeader.includes('tech')) {
      mapping[header] = 'pd_tech_svc';
    } else if (
      normalizedHeader.includes('dt') &&
      normalizedHeader.includes('service') &&
      normalizedHeader.includes('id')
    ) {
      mapping[header] = 'dt_service_id';
    } else if (normalizedHeader.includes('terraform')) {
      mapping[header] = 'terraform_onboarding';
    } else if (
      normalizedHeader.includes('team') &&
      normalizedHeader.includes('not') &&
      normalizedHeader.includes('exist')
    ) {
      mapping[header] = 'team_name_does_not_exist';
    } else if (
      normalizedHeader.includes('tech') &&
      normalizedHeader.includes('not') &&
      normalizedHeader.includes('exist')
    ) {
      mapping[header] = 'tech_svc_does_not_exist';
    } else if (normalizedHeader.includes('update') && normalizedHeader.includes('team')) {
      mapping[header] = 'update_team_name';
    } else if (normalizedHeader.includes('update') && normalizedHeader.includes('tech')) {
      mapping[header] = 'update_tech_svc';
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
    if (!row.mp_service_name) {
      errors.push(`Row ${index + 1}: Missing service name`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}
