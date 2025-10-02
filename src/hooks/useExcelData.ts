'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import type { ExcelServiceRow } from '@/types/pagerduty';
import {
  readLocalExcelFile,
  updateExcelData,
  validateExcelData,
  type ExcelReadResult
} from '@/lib/excel-utils';

interface UseExcelDataReturn {
  // Data
  data: ExcelServiceRow[];
  hasUnsavedChanges: boolean;

  // Loading states
  loading: boolean;

  // Error handling
  error: string | null;
  validationErrors: string[];

  // File operations
  loadLocalExcelFile: (fileName: string) => Promise<void>;

  // Data operations
  updateCell: (rowId: string, field: keyof ExcelServiceRow, value: string) => void;

  // Utility functions
  clearError: () => void;
  getOverallProgress: () => {
    total: number;
    completed: number;
    inProgress: number;
    notStarted: number;
    averageCompletion: number;
  };
}

export function useExcelData(): UseExcelDataReturn {
  const [data, setData] = useState<ExcelServiceRow[]>([]);
  const [originalData, setOriginalData] = useState<ExcelServiceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-load Excel data on mount
  useEffect(() => {
    if (data.length === 0 && !loading && !error) {
      loadLocalExcelFile('mse_trace_analysis_enriched_V2.xlsx');
    }
  }, []); // Run only on mount

  // Check for unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (originalData.length !== data.length) return true;
    return data.some((row, index) => {
      const original = originalData[index];
      if (!original) return true;
      return JSON.stringify(row) !== JSON.stringify(original);
    });
  }, [data, originalData]);

  // Validation errors
  const validationErrors = useMemo(() => {
    const validation = validateExcelData(data);
    return validation.errors;
  }, [data]);

  // Load local Excel file
  const loadLocalExcelFile = useCallback(async (fileName: string) => {
    setLoading(true);
    setError(null);

    try {
      const result: ExcelReadResult = await readLocalExcelFile(fileName);

      if (result.success) {
        setData(result.data);
        setOriginalData([...result.data]);
        setError(null);
      } else {
        setError(result.error || 'Failed to load local Excel file');
        setData([]);
        setOriginalData([]);
      }
    } catch (err) {
      setError(`Failed to load local file: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setData([]);
      setOriginalData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Update cell value
  const updateCell = useCallback((rowId: string, field: keyof ExcelServiceRow, value: string) => {
    setData(currentData => updateExcelData(currentData, rowId, field, value));
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Get overall progress based on key fields (same as Service Progress Tracking)
  const getOverallProgress = useCallback(() => {
    if (data.length === 0) {
      return {
        total: 0,
        completed: 0,
        inProgress: 0,
        notStarted: 0,
        averageCompletion: 0
      };
    }

    // Calculate completion for key fields only: pd_team_name, pd_tech_svc, mp_service_name, mp_cmdb_id
    const keyFields = ['pd_team_name', 'pd_tech_svc', 'mp_service_name', 'mp_cmdb_id'] as const;

    const progressData = data.map(row => {
      const completedKeyFields = keyFields.filter(field => row[field] && String(row[field]).trim() !== '').length;
      return Math.round((completedKeyFields / keyFields.length) * 100);
    });

    const completed = progressData.filter(completion => completion === 100).length;
    const notStarted = progressData.filter(completion => completion === 0).length;
    const inProgress = data.length - completed - notStarted;
    const averageCompletion = completed > 0 && completed < data.length
      ? Math.max(1, Math.round((completed / data.length) * 100))
      : Math.round((completed / data.length) * 100);

    return {
      total: data.length,
      completed,
      inProgress,
      notStarted,
      averageCompletion
    };
  }, [data]);

  return {
    // Data
    data,
    hasUnsavedChanges,

    // Loading states
    loading,

    // Error handling
    error,
    validationErrors,

    // File operations
    loadLocalExcelFile,

    // Data operations
    updateCell,

    // Utility functions
    clearError,
    getOverallProgress,
  };
}