import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import type { ExcelServiceRow } from '@/types/pagerduty';

const EXCEL_FILE_PATH = path.join(process.cwd(), 'public', 'mse_trace_analysis_enriched_V2.xlsx');

// Column mapping for Excel - LOWERCASE UNDERSCORE STRUCTURE
const EXCEL_COLUMNS = [
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
] as const;

// GET - Read Excel file
export async function GET() {
  try {
    if (!fs.existsSync(EXCEL_FILE_PATH)) {
      return NextResponse.json(
        { error: 'Excel file not found' },
        { status: 404 }
      );
    }

    const fileBuffer = fs.readFileSync(EXCEL_FILE_PATH);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (rawData.length === 0) {
      return NextResponse.json(
        { error: 'Excel file is empty' },
        { status: 400 }
      );
    }

    const headers = rawData[0] as string[];
    const dataRows = rawData.slice(1) as any[][];

    // Create header mapping - LOWERCASE UNDERSCORE STRUCTURE
    const headerMapping: Record<string, keyof ExcelServiceRow> = {};
    headers.forEach(header => {
      const normalizedHeader = header.toLowerCase().trim();
      const cleanHeader = normalizedHeader.replace(/[^a-z0-9_]/g, '_');

      // Map exact header matches first (case-insensitive)
      if (normalizedHeader === 'mp service name' || cleanHeader === 'mp_service_name' || normalizedHeader === 'mp_service_name') {
        headerMapping[header] = 'mp_service_name';
      } else if (normalizedHeader === 'mp service path' || cleanHeader === 'mp_service_path' || normalizedHeader === 'mp_service_path') {
        headerMapping[header] = 'mp_service_path';
      } else if (normalizedHeader === 'mp cmdb id' || cleanHeader === 'mp_cmdb_id' || normalizedHeader === 'mp_cmdb_id') {
        headerMapping[header] = 'mp_cmdb_id';
      } else if (normalizedHeader === 'pd tech svc' || cleanHeader === 'pd_tech_svc' || normalizedHeader === 'pd_tech_svc') {
        headerMapping[header] = 'pd_tech_svc';
      } else if (normalizedHeader === 'prime manager' || cleanHeader === 'prime_manager' || normalizedHeader === 'prime_manager') {
        headerMapping[header] = 'prime_manager';
      } else if (normalizedHeader === 'prime director' || cleanHeader === 'prime_director' || normalizedHeader === 'prime_director') {
        headerMapping[header] = 'prime_director';
      } else if (normalizedHeader === 'prime vp' || cleanHeader === 'prime_vp' || normalizedHeader === 'prime_vp') {
        headerMapping[header] = 'prime_vp';
      } else if (normalizedHeader === 'mse' || cleanHeader === 'mse') {
        headerMapping[header] = 'mse';
      } else if (normalizedHeader === 'dt service name' || cleanHeader === 'dt_service_name' || normalizedHeader === 'dt_service_name') {
        headerMapping[header] = 'dt_service_name';
      } else if (normalizedHeader === 'next hop process group' || cleanHeader === 'next_hop_process_group' || normalizedHeader === 'next_hop_process_group') {
        headerMapping[header] = 'next_hop_process_group';
      } else if (normalizedHeader === 'next hop endpoint' || cleanHeader === 'next_hop_endpoint' || normalizedHeader === 'next_hop_endpoint') {
        headerMapping[header] = 'next_hop_endpoint';
      } else if (normalizedHeader === 'analysis status' || cleanHeader === 'analysis_status' || normalizedHeader === 'analysis_status') {
        headerMapping[header] = 'analysis_status';
      } else if (normalizedHeader === 'next hop service code' || cleanHeader === 'next_hop_service_code' || normalizedHeader === 'next_hop_service_code') {
        headerMapping[header] = 'next_hop_service_code';
      } else if (normalizedHeader === 'pd team name' || cleanHeader === 'pd_team_name' || normalizedHeader === 'pd_team_name') {
        headerMapping[header] = 'pd_team_name';
      } else if (normalizedHeader === 'integrated with pd' || cleanHeader === 'integrated_with_pd' || normalizedHeader === 'integrated_with_pd') {
        headerMapping[header] = 'integrated_with_pd';
      } else if (normalizedHeader === 'user acknowledge' || cleanHeader === 'user_acknowledge' || normalizedHeader === 'user_acknowledge') {
        headerMapping[header] = 'user_acknowledge';
      } else if (normalizedHeader === 'dt service id' || cleanHeader === 'dt_service_id' || normalizedHeader === 'dt_service_id') {
        headerMapping[header] = 'dt_service_id';
      } else if (normalizedHeader === 'terraform onboarding' || cleanHeader === 'terraform_onboarding' || normalizedHeader === 'terraform_onboarding') {
        headerMapping[header] = 'terraform_onboarding';
      } else if (normalizedHeader === 'team name does not exist' || cleanHeader === 'team_name_does_not_exist' || normalizedHeader === 'team_name_does_not_exist') {
        headerMapping[header] = 'team_name_does_not_exist';
      } else if (normalizedHeader === 'tech svc does not exist' || cleanHeader === 'tech_svc_does_not_exist' || normalizedHeader === 'tech_svc_does_not_exist') {
        headerMapping[header] = 'tech_svc_does_not_exist';
      } else if (normalizedHeader === 'update team name' || cleanHeader === 'update_team_name' || normalizedHeader === 'update_team_name') {
        headerMapping[header] = 'update_team_name';
      } else if (normalizedHeader === 'update tech svc' || cleanHeader === 'update_tech_svc' || normalizedHeader === 'update_tech_svc') {
        headerMapping[header] = 'update_tech_svc';
      }
    });

    // Convert to ExcelServiceRow format
    const processedData: ExcelServiceRow[] = dataRows
      .filter(row => row && row.some(cell => cell != null && cell !== ''))
      .map((row, index) => {
        const serviceRow: any = {
          id: `row-${index + 1}`,
          completion: 0,
          lastUpdated: new Date().toISOString(),
        };

        // Map each cell to the appropriate field
        headers.forEach((header, cellIndex) => {
          const fieldKey = headerMapping[header];
          if (fieldKey) {
            if (cellIndex < row.length) {
              const cellValue = row[cellIndex];
              if (cellValue != null && cellValue !== '') {
                serviceRow[fieldKey] = String(cellValue).trim();
              } else {
                // Explicitly set empty values to empty string instead of undefined
                serviceRow[fieldKey] = '';
              }
            } else {
              // If cell doesn't exist in row, set to empty string
              serviceRow[fieldKey] = '';
            }
          }
        });

        // Calculate completion
        const totalFields = EXCEL_COLUMNS.length;
        const completedFields = EXCEL_COLUMNS.filter(col =>
          serviceRow[col.key] && String(serviceRow[col.key]).trim() !== ''
        ).length;
        serviceRow.completion = Math.round((completedFields / totalFields) * 100);

        return serviceRow as ExcelServiceRow;
      });

    return NextResponse.json({
      success: true,
      data: processedData,
      totalRows: processedData.length
    });

  } catch (error) {
    console.error('Error reading Excel file:', error);
    return NextResponse.json(
      { error: `Failed to read Excel file: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

// POST - Write Excel file
export async function POST(request: NextRequest) {
  try {
    const { data, preserveHeaders = false, fileName }: {
      data: ExcelServiceRow[],
      preserveHeaders?: boolean,
      fileName?: string
    } = await request.json();

    if (!data || !Array.isArray(data)) {
      return NextResponse.json(
        { error: 'Invalid data format' },
        { status: 400 }
      );
    }

    // Create workbook
    const workbook = XLSX.utils.book_new();

    let worksheet;

    if (preserveHeaders) {
      // Use json_to_sheet to preserve header structure
      const worksheetData = data.map(row => {
        const excelRow: any = {};
        EXCEL_COLUMNS.forEach(col => {
          excelRow[col.header] = row[col.key] || '';
        });
        return excelRow;
      });

      worksheet = XLSX.utils.json_to_sheet(worksheetData, {
        header: EXCEL_COLUMNS.map(col => col.header),
        skipHeader: false
      });
    } else {
      // Original array-based approach
      const excelData = [
        // Headers
        EXCEL_COLUMNS.map(col => col.header),
        // Data rows
        ...data.map(row =>
          EXCEL_COLUMNS.map(col => row[col.key] || '')
        )
      ];

      worksheet = XLSX.utils.aoa_to_sheet(excelData);
    }

    // Set column widths
    const columnWidths = EXCEL_COLUMNS.map(col => ({ wch: Math.floor((col.width || 100) / 7) }));
    worksheet['!cols'] = columnWidths;

    // Ensure proper range is set
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    worksheet['!ref'] = XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: data.length, c: EXCEL_COLUMNS.length - 1 }
    });

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Service Data');

    // Ensure directory exists
    const dir = path.dirname(EXCEL_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write file to filesystem using buffer approach
    const fileBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    fs.writeFileSync(EXCEL_FILE_PATH, fileBuffer);

    return NextResponse.json({
      success: true,
      message: 'Excel file updated successfully',
      updatedRows: data.length,
      fileName: fileName || 'service_data.xlsx'
    });

  } catch (error) {
    console.error('Error writing Excel file:', error);
    return NextResponse.json(
      { error: `Failed to write Excel file: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}