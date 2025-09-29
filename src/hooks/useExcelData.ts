'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import type { ExcelServiceRow } from '@/types/pagerduty';
import {
  readExcelFile,
  readLocalExcelFile,
  writeExcelFile,
  updateExcelData,
  calculateRowCompletion,
  validateExcelData,
  type ExcelReadResult,
  type ExcelWriteResult
} from '@/lib/excel-utils';

interface UseExcelDataReturn {
  // Data
  data: ExcelServiceRow[];
  originalData: ExcelServiceRow[];
  hasUnsavedChanges: boolean;

  // Loading states
  loading: boolean;
  saving: boolean;

  // Error handling
  error: string | null;
  validationErrors: string[];

  // File operations
  loadExcelFile: (file: File) => Promise<void>;
  loadLocalExcelFile: (fileName: string) => Promise<void>;
  saveExcelFile: (fileName?: string) => Promise<void>;

  // Data operations
  updateCell: (rowId: string, field: keyof ExcelServiceRow, value: string) => void;
  addRow: () => void;
  deleteRow: (rowId: string) => void;
  duplicateRow: (rowId: string) => void;

  // Utility functions
  clearError: () => void;
  resetData: () => void;
  getRowProgress: (rowId: string) => number;
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
  const [saving, setSaving] = useState(false);
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

  // Load Excel file
  const loadExcelFile = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);

    try {
      const result: ExcelReadResult = await readExcelFile(file);

      if (result.success) {
        setData(result.data);
        setOriginalData([...result.data]);
        setError(null);
      } else {
        setError(result.error || 'Failed to load Excel file');
        setData([]);
        setOriginalData([]);
      }
    } catch (err) {
      setError(`Failed to load file: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setData([]);
      setOriginalData([]);
    } finally {
      setLoading(false);
    }
  }, []);

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

  // Save Excel file
  const saveExcelFile = useCallback(async (fileName?: string) => {
    setSaving(true);
    setError(null);

    try {
      const result: ExcelWriteResult = await writeExcelFile(data, fileName);

      if (result.success) {
        setOriginalData([...data]);
        setError(null);
      } else {
        setError(result.error || 'Failed to save Excel file');
      }
    } catch (err) {
      setError(`Failed to save file: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  }, [data]);

  // Update cell value
  const updateCell = useCallback((rowId: string, field: keyof ExcelServiceRow, value: string) => {
    setData(currentData => updateExcelData(currentData, rowId, field, value));
  }, []);

  // Add new row
  const addRow = useCallback(() => {
    const newRow: ExcelServiceRow = {
      id: `new-row-${Date.now()}`,
      mp_service_name: 'New Service',
      mp_service_path: '',
      mp_cmdb_id: '',
      pd_tech_svc: '',
      prime_manager: '',
      prime_director: '',
      prime_vp: '',
      mse: '',
      dt_service_name: '',
      next_hop_process_group: '',
      analysis_status: '',
      next_hop_service_code: '',
      pd_team_name: '',
      integrated_with_pd: '',
      user_acknowledge: '',
      dt_service_id: '',
      terraform_onboarding: '',
      team_name_does_not_exist: '',
      tech_svc_does_not_exist: '',
      update_team_name: '',
      update_tech_svc: '',
      completion: 4,
      lastUpdated: new Date().toISOString(),
    };

    setData(currentData => [...currentData, newRow]);
  }, []);

  // Delete row
  const deleteRow = useCallback((rowId: string) => {
    setData(currentData => currentData.filter(row => row.id !== rowId));
  }, []);

  // Duplicate row
  const duplicateRow = useCallback((rowId: string) => {
    setData(currentData => {
      const rowToDuplicate = currentData.find(row => row.id === rowId);
      if (!rowToDuplicate) return currentData;

      const duplicatedRow: ExcelServiceRow = {
        ...rowToDuplicate,
        id: `duplicate-${Date.now()}`,
        mp_service_name: `${rowToDuplicate.mp_service_name} (Copy)`,
        lastUpdated: new Date().toISOString(),
      };

      return [...currentData, duplicatedRow];
    });
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Reset data to original
  const resetData = useCallback(() => {
    setData([...originalData]);
    setError(null);
  }, [originalData]);

  // Get row progress
  const getRowProgress = useCallback((rowId: string): number => {
    const row = data.find(r => r.id === rowId);
    return row ? calculateRowCompletion(row) : 0;
  }, [data]);

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
    originalData,
    hasUnsavedChanges,

    // Loading states
    loading,
    saving,

    // Error handling
    error,
    validationErrors,

    // File operations
    loadExcelFile,
    loadLocalExcelFile,
    saveExcelFile,

    // Data operations
    updateCell,
    addRow,
    deleteRow,
    duplicateRow,

    // Utility functions
    clearError,
    resetData,
    getRowProgress,
    getOverallProgress,
  };
}