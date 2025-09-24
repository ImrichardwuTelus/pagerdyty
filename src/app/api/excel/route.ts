import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import type { ExcelServiceRow } from '@/types/pagerduty';

const EXCEL_FILE_PATH = path.join(process.cwd(), 'public', 'mse_trace_analysis_enriched_V2.xlsx');

// Column mapping for Excel
const EXCEL_COLUMNS = [
  { key: 'service_name_mp', header: 'Service Name MP', width: 150 },
  { key: 'service_path', header: 'Service Path', width: 200 },
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


    // Create header mapping
    const headerMapping: Record<string, keyof ExcelServiceRow> = {};
    headers.forEach(header => {
      const normalizedHeader = header.toLowerCase().trim();
      const cleanHeader = normalizedHeader.replace(/[^a-z0-9_]/g, '_');

      // Map exact header matches first (case-insensitive)
      if (normalizedHeader === 'service_name_mp' || cleanHeader === 'service_name_mp') {
        headerMapping[header] = 'service_name_mp';
      } else if (normalizedHeader === 'service path' || cleanHeader === 'service_path') {
        headerMapping[header] = 'service_path';
      } else if (normalizedHeader === 'cmdb id' || cleanHeader === 'cmdb_id') {
        headerMapping[header] = 'cmdb_id';
      } else if (normalizedHeader === 'app name' || normalizedHeader === 'api name' || cleanHeader === 'api_name' || cleanHeader === 'app_name') {
        headerMapping[header] = 'api_name';
      } else if (normalizedHeader === 'prime manager' || cleanHeader === 'prime_manager') {
        headerMapping[header] = 'prime_manager';
      } else if (normalizedHeader === 'prime director' || cleanHeader === 'prime_director') {
        headerMapping[header] = 'prime_director';
      } else if (normalizedHeader === 'prime vp' || cleanHeader === 'prime_vp') {
        headerMapping[header] = 'prime_vp';
      } else if (normalizedHeader === 'mse' || cleanHeader === 'mse') {
        headerMapping[header] = 'mse';
      } else if (normalizedHeader === 'dynaservicename' || normalizedHeader === 'dyna service name' || cleanHeader === 'dynaservicename' || cleanHeader === 'dyna_service_name') {
        headerMapping[header] = 'dyna_service_name';
      // Add fallback patterns for dynatrace columns
      } else if (normalizedHeader.includes('dyna') && normalizedHeader.includes('service')) {
        headerMapping[header] = 'dyna_service_name';
      } else if (normalizedHeader.includes('dynatrace')) {
        headerMapping[header] = 'dyna_service_name';
      } else if (normalizedHeader === 'next_hop_process_group' || cleanHeader === 'next_hop_process_group') {
        headerMapping[header] = 'next_hop_process_group';
      } else if (normalizedHeader === 'analysis_status' || cleanHeader === 'analysis_status') {
        headerMapping[header] = 'analysis_status';
      } else if (normalizedHeader === 'next_hop_service_code' || cleanHeader === 'next_hop_service_code') {
        headerMapping[header] = 'next_hop_service_code';
      } else if (normalizedHeader === 'enrichment_status' || cleanHeader === 'enrichment_status') {
        headerMapping[header] = 'enrichment_status';
      } else if (normalizedHeader === 'team name' || cleanHeader === 'team_name') {
        headerMapping[header] = 'team_name';
      } else if (normalizedHeader === 'confirmed' || cleanHeader === 'confirmed') {
        headerMapping[header] = 'confirmed';
      } else if (normalizedHeader === 'owned team' || normalizedHeader === 'tech-svc' || cleanHeader === 'owned_team' || cleanHeader === 'tech_svc') {
        headerMapping[header] = 'owned_team';
      } else if (normalizedHeader === 'service id' || cleanHeader === 'service_id') {
        headerMapping[header] = 'service_id';
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
    const { data }: { data: ExcelServiceRow[] } = await request.json();

    if (!data || !Array.isArray(data)) {
      return NextResponse.json(
        { error: 'Invalid data format' },
        { status: 400 }
      );
    }

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
      updatedRows: data.length
    });

  } catch (error) {
    console.error('Error writing Excel file:', error);
    return NextResponse.json(
      { error: `Failed to write Excel file: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}