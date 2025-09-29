import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import type { ExcelServiceRow } from '@/types/pagerduty';
import { EXCEL_COLUMNS, createHeaderMapping } from '@/lib/excel-utils';

const EXCEL_FILE_PATH = path.join(process.cwd(), 'public', 'mse_trace_analysis_enriched_V2.xlsx');

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

    // Create header mapping using shared function
    const headerMapping = createHeaderMapping(headers);

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