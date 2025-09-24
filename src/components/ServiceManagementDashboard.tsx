'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useExcelData } from '@/hooks/useExcelData';
import type { ExcelServiceRow } from '@/types/pagerduty';
import { EXCEL_COLUMNS } from '@/lib/excel-utils';

interface SortConfig {
  key: keyof ExcelServiceRow | null;
  direction: 'asc' | 'desc';
}

interface FilterConfig {
  searchQuery: string;
  completionFilter: 'all' | 'completed' | 'in-progress' | 'not-started';
  serviceNameFilter: string;
  cmdbIdFilter: string;
  primeManagerFilter: string;
  primeDirectorFilter: string;
  primeVpFilter: string;
  teamNameFilter: string;
}

export default function ServiceManagementDashboard() {
  const {
    data,
    loading,
    saving,
    error,
    hasUnsavedChanges,
    validationErrors,
    loadExcelFile,
    loadLocalExcelFile,
    saveExcelFile,
    loadSampleData,
    updateCell,
    addRow,
    deleteRow,
    duplicateRow,
    clearError,
    resetData,
    getOverallProgress,
  } = useExcelData();

  // Listen for updates from service editor
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data.type === 'UPDATE_EXCEL_ROW') {
        const { rowId, updates } = event.data;
        console.log('Received Excel update from service editor:', { rowId, updates });

        // Update each field in the Excel data
        Object.entries(updates).forEach(([field, value]) => {
          updateCell(rowId, field as keyof ExcelServiceRow, value as string);
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [updateCell]);

  // UI State
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: 'asc' });
  const [filterConfig, setFilterConfig] = useState<FilterConfig>({
    searchQuery: '',
    completionFilter: 'all',
    serviceNameFilter: '',
    cmdbIdFilter: '',
    primeManagerFilter: '',
    primeDirectorFilter: '',
    primeVpFilter: '',
    teamNameFilter: '',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // Auto-load the local Excel file on component mount
  useEffect(() => {
    if (data.length === 0 && !loading && !error) {
      loadLocalExcelFile('mse_trace_analysis_enriched_V2.xlsx');
    }
  }, [data.length, loading, error, loadLocalExcelFile]);

  // Scroll on load functionality for large datasets
  useEffect(() => {
    if (data.length > 0 && !loading) {
      // Scroll to data table when data loads, especially useful for large datasets
      const tableElement = document.getElementById('service-data-table');
      if (tableElement) {
        setTimeout(() => {
          tableElement.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
            inline: 'nearest'
          });
        }, 500); // Small delay to ensure rendering is complete
      }
    }
  }, [data.length, loading]);

  // Progress calculations
  const progress = getOverallProgress();

  // Get unique values for filters
  const uniqueValues = useMemo(() => {
    const serviceNames = new Set<string>();
    const cmdbIds = new Set<string>();
    const primeManagers = new Set<string>();
    const primeDirectors = new Set<string>();
    const primeVps = new Set<string>();
    const teamNames = new Set<string>();

    data.forEach(row => {
      if (row.service_name_mp) serviceNames.add(row.service_name_mp);
      if (row.cmdb_id) cmdbIds.add(row.cmdb_id);
      if (row.prime_manager) primeManagers.add(row.prime_manager);
      if (row.prime_director) primeDirectors.add(row.prime_director);
      if (row.prime_vp) primeVps.add(row.prime_vp);
      if (row.team_name) teamNames.add(row.team_name);
      if (row.owned_team) teamNames.add(row.owned_team);
    });

    return {
      serviceNames: Array.from(serviceNames).sort(),
      cmdbIds: Array.from(cmdbIds).sort(),
      primeManagers: Array.from(primeManagers).sort(),
      primeDirectors: Array.from(primeDirectors).sort(),
      primeVps: Array.from(primeVps).sort(),
      teamNames: Array.from(teamNames).sort(),
    };
  }, [data]);

  // Apply filters and sorting
  const filteredAndSortedData = useMemo(() => {
    let filtered = data.filter(row => {
      // Search filter
      if (filterConfig.searchQuery) {
        const query = filterConfig.searchQuery.toLowerCase();
        const searchableFields = [
          row.service_name_mp,
          row.api_name,
          row.cmdb_id,
          row.service_id,
          row.prime_manager,
          row.prime_director,
          row.prime_vp,
        ];
        if (!searchableFields.some(field => field?.toLowerCase().includes(query))) {
          return false;
        }
      }

      // Completion filter
      if (filterConfig.completionFilter !== 'all') {
        switch (filterConfig.completionFilter) {
          case 'completed':
            if (row.completion !== 100) return false;
            break;
          case 'in-progress':
            if (row.completion <= 0 || row.completion >= 100) return false;
            break;
          case 'not-started':
            if (row.completion > 0) return false;
            break;
        }
      }

      // Individual field filters
      if (
        filterConfig.serviceNameFilter &&
        row.service_name_mp !== filterConfig.serviceNameFilter
      ) {
        return false;
      }
      if (filterConfig.cmdbIdFilter && row.cmdb_id !== filterConfig.cmdbIdFilter) {
        return false;
      }
      if (
        filterConfig.primeManagerFilter &&
        row.prime_manager !== filterConfig.primeManagerFilter
      ) {
        return false;
      }
      if (
        filterConfig.primeDirectorFilter &&
        row.prime_director !== filterConfig.primeDirectorFilter
      ) {
        return false;
      }
      if (filterConfig.primeVpFilter && row.prime_vp !== filterConfig.primeVpFilter) {
        return false;
      }
      if (
        filterConfig.teamNameFilter &&
        row.team_name !== filterConfig.teamNameFilter &&
        row.owned_team !== filterConfig.teamNameFilter
      ) {
        return false;
      }

      return true;
    });

    // Apply sorting
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const aVal = a[sortConfig.key!];
        const bVal = b[sortConfig.key!];

        if (aVal === bVal) return 0;

        let comparison = 0;
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          comparison = aVal.localeCompare(bVal);
        } else if (typeof aVal === 'number' && typeof bVal === 'number') {
          comparison = aVal - bVal;
        } else {
          comparison = String(aVal || '').localeCompare(String(bVal || ''));
        }

        return sortConfig.direction === 'desc' ? -comparison : comparison;
      });
    }

    return filtered;
  }, [data, filterConfig, sortConfig]);

  // Reset page when filters change
  useMemo(() => {
    setCurrentPage(1);
  }, [filterConfig]);

  // Pagination
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedData, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredAndSortedData.length / itemsPerPage);

  // Handlers

  const handleSort = (key: keyof ExcelServiceRow) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };


  const getCompletionColor = (completion: number) => {
    if (completion >= 90) return 'bg-green-500';
    if (completion >= 70) return 'bg-blue-500';
    if (completion >= 50) return 'bg-yellow-500';
    if (completion >= 30) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getCompletionBadgeColor = (completion: number) => {
    if (completion >= 90) return 'bg-green-100 text-green-800 border-green-200';
    if (completion >= 70) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (completion >= 50) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    if (completion >= 30) return 'bg-orange-100 text-orange-800 border-orange-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  // Display Cell Component
  const DisplayCell = ({
    value,
    className = 'text-sm text-gray-900',
  }: {
    value: string;
    className?: string;
  }) => {
    return (
      <div
        className={`${className} px-2 py-1 min-h-[32px] flex items-center ${
          !value ? 'text-gray-400' : ''
        }`}
      >
        {value || '—'}
      </div>
    );
  };


  // Progress Indicator Component
  const ProgressIndicator = ({ completion }: { completion: number }) => (
    <div className="flex items-center space-x-2 w-full">
      <div className="flex-1 bg-gray-200 rounded-full h-2 min-w-[60px]">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${getCompletionColor(
            completion
          )}`}
          style={{ width: `${completion}%` }}
        />
      </div>
      <span
        className={`px-2 py-1 text-xs font-medium rounded-full border ${getCompletionBadgeColor(
          completion
        )}`}
      >
        {completion}%
      </span>
    </div>
  );

  // Sort Icon Component
  const SortIcon = ({ column }: { column: keyof ExcelServiceRow }) => {
    if (sortConfig.key !== column) {
      return (
        <svg
          className="w-4 h-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
          />
        </svg>
      );
    }

    return sortConfig.direction === 'asc' ? (
      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 11l5-5m0 0l5 5m-5-5v12"
        />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M17 13l-5 5m0 0l-5-5m5 5V6"
        />
      </svg>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading Excel data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto space-y-8 p-6">
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-xl shadow-sm rounded-2xl border border-gray-200/30">
          <div className="px-8 py-6 border-b border-gray-200/30">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-semibold text-gray-900">Service Management</h1>
                <p className="mt-1 text-sm text-gray-600">
                  Manage your service inventory with precision
                </p>
              </div>
              {hasUnsavedChanges && (
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
                  <span className="text-sm text-gray-600">Unsaved changes</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Progress Analytics Section */}
        {data.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Overview Cards */}
            <div className="lg:col-span-2">
              <div className="bg-white shadow-lg rounded-xl border border-gray-200/60 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Knowledge
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                    <div className="text-2xl font-bold text-blue-700">{progress.total}</div>
                    <div className="text-sm text-blue-600 font-medium">Total Services</div>
                  </div>
                  <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-4 rounded-lg border border-emerald-200">
                    <div className="text-2xl font-bold text-emerald-700">{progress.completed}</div>
                    <div className="text-sm text-emerald-600 font-medium">Complete</div>
                  </div>
                  <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-4 rounded-lg border border-amber-200">
                    <div className="text-2xl font-bold text-amber-700">{progress.inProgress}</div>
                    <div className="text-sm text-amber-600 font-medium">In Progress</div>
                  </div>
                  <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-lg border border-red-200">
                    <div className="text-2xl font-bold text-red-700">{progress.notStarted}</div>
                    <div className="text-sm text-red-600 font-medium">Not Started</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Progress Ring */}
            <div className="bg-white shadow-lg rounded-xl border border-gray-200/60 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Overall Progress</h3>
              <div className="flex items-center justify-center">
                <div className="relative">
                  <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-gray-200"
                      d="M18 2.0845
                        a 15.9155 15.9155 0 0 1 0 31.831
                        a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    <path
                      className="text-blue-600"
                      d="M18 2.0845
                        a 15.9155 15.9155 0 0 1 0 31.831
                        a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeDasharray={`${progress.averageCompletion}, 100`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-blue-700">
                        {progress.averageCompletion}%
                      </div>
                      <div className="text-xs text-gray-600">Average</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        {data.length > 0 && (
          <div className="bg-white shadow-lg rounded-xl border border-gray-200/60">
            <div className="px-8 py-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Advanced Filters</h3>
              <p className="text-sm text-gray-600 mt-1">
                Filter and search across all service data fields
              </p>
            </div>
            <div className="px-8 py-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Global Search
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg
                        className="h-5 w-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                    </div>
                    <input
                      type="text"
                      placeholder="Search across all fields..."
                      value={filterConfig.searchQuery}
                      onChange={e =>
                        setFilterConfig(prev => ({ ...prev, searchQuery: e.target.value }))
                      }
                      className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Completion Status
                  </label>
                  <select
                    value={filterConfig.completionFilter}
                    onChange={e =>
                      setFilterConfig(prev => ({
                        ...prev,
                        completionFilter: e.target.value as any,
                      }))
                    }
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  >
                    <option value="all">All Statuses</option>
                    <option value="completed">✅ Complete (100%)</option>
                    <option value="in-progress">🔄 In Progress</option>
                    <option value="not-started">❌ Not Started (0%)</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={addRow}
                    className="w-full px-4 py-2.5 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-md transition-all duration-200"
                  >
                    <svg
                      className="w-4 h-4 inline mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                      />
                    </svg>
                    Add Service
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Service Name
                  </label>
                  <select
                    value={filterConfig.serviceNameFilter}
                    onChange={e =>
                      setFilterConfig(prev => ({ ...prev, serviceNameFilter: e.target.value }))
                    }
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  >
                    <option value="">All Services</option>
                    {uniqueValues.serviceNames.map(name => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">CMDB ID</label>
                  <select
                    value={filterConfig.cmdbIdFilter}
                    onChange={e =>
                      setFilterConfig(prev => ({ ...prev, cmdbIdFilter: e.target.value }))
                    }
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  >
                    <option value="">All CMDB IDs</option>
                    {uniqueValues.cmdbIds.map(id => (
                      <option key={id} value={id}>
                        {id}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prime Manager
                  </label>
                  <select
                    value={filterConfig.primeManagerFilter}
                    onChange={e =>
                      setFilterConfig(prev => ({ ...prev, primeManagerFilter: e.target.value }))
                    }
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  >
                    <option value="">All Managers</option>
                    {uniqueValues.primeManagers.map(manager => (
                      <option key={manager} value={manager}>
                        {manager}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prime Director
                  </label>
                  <select
                    value={filterConfig.primeDirectorFilter}
                    onChange={e =>
                      setFilterConfig(prev => ({ ...prev, primeDirectorFilter: e.target.value }))
                    }
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  >
                    <option value="">All Directors</option>
                    {uniqueValues.primeDirectors.map(director => (
                      <option key={director} value={director}>
                        {director}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Prime VP</label>
                  <select
                    value={filterConfig.primeVpFilter}
                    onChange={e =>
                      setFilterConfig(prev => ({ ...prev, primeVpFilter: e.target.value }))
                    }
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  >
                    <option value="">All VPs</option>
                    {uniqueValues.primeVps.map(vp => (
                      <option key={vp} value={vp}>
                        {vp}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Team Name</label>
                  <select
                    value={filterConfig.teamNameFilter}
                    onChange={e =>
                      setFilterConfig(prev => ({ ...prev, teamNameFilter: e.target.value }))
                    }
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  >
                    <option value="">All Teams</option>
                    {uniqueValues.teamNames.map(team => (
                      <option key={team} value={team}>
                        {team}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-6 flex justify-start">
                <button
                  onClick={() =>
                    setFilterConfig({
                      searchQuery: '',
                      completionFilter: 'all',
                      serviceNameFilter: '',
                      cmdbIdFilter: '',
                      primeManagerFilter: '',
                      primeDirectorFilter: '',
                      primeVpFilter: '',
                      teamNameFilter: '',
                    })
                  }
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-200"
                >
                  <svg
                    className="w-4 h-4 inline mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                  Clear All Filters
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="mt-1 text-sm text-red-700">{error}</p>
                <button
                  onClick={clearError}
                  className="mt-2 text-sm text-red-600 hover:text-red-500"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">Data Validation Issues</h3>
                <ul className="mt-1 text-sm text-yellow-700">
                  {validationErrors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}


        {/* Excel Data Table */}
        {data.length > 0 && (
          <div id="service-data-table" className="bg-white shadow-lg rounded-xl border border-gray-200/60 overflow-hidden">
            <div className="px-8 py-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Excel Data</h3>
              <p className="text-sm text-gray-600 mt-1">
                Team Name, Tech-Svc, CMDB ID, Dynatrace Status, Prime Manager, Prime Director, Prime VP
              </p>
            </div>
            <div className="overflow-x-auto" style={{ maxHeight: '70vh' }}>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('team_name')}>
                      <div className="flex items-center space-x-1">
                        <span>Team Name</span>
                        <SortIcon column={'team_name'} />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('owned_team')}>
                      <div className="flex items-center space-x-1">
                        <span>Tech-Svc</span>
                        <SortIcon column={'owned_team'} />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('cmdb_id')}>
                      <div className="flex items-center space-x-1">
                        <span>CMDB ID</span>
                        <SortIcon column={'cmdb_id'} />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('dyna_service_name')}>
                      <div className="flex items-center space-x-1">
                        <span>Dynatrace</span>
                        <SortIcon column={'dyna_service_name'} />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('prime_manager')}>
                      <div className="flex items-center space-x-1">
                        <span>Prime Manager</span>
                        <SortIcon column={'prime_manager'} />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('prime_director')}>
                      <div className="flex items-center space-x-1">
                        <span>Prime Director</span>
                        <SortIcon column={'prime_director'} />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('prime_vp')}>
                      <div className="flex items-center space-x-1">
                        <span>Prime VP</span>
                        <SortIcon column={'prime_vp'} />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedData.map((row, index) => (
                    <tr
                      key={row.id}
                      className={`hover:bg-blue-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap border-r border-gray-200">
                        <DisplayCell
                          value={row.team_name || ''}
                          className="text-sm text-gray-900"
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap border-r border-gray-200">
                        <DisplayCell
                          value={row.owned_team || ''}
                          className="text-sm text-gray-900"
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap border-r border-gray-200">
                        <DisplayCell
                          value={row.cmdb_id || ''}
                          className="text-sm text-gray-900"
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap border-r border-gray-200">
                        <div className="px-2 py-1 min-h-[32px] flex items-center space-x-2">
                          {(() => {
                            const dynaValue = row.dyna_service_name;
                            const hasValue = dynaValue && String(dynaValue).trim() !== '' && String(dynaValue).trim() !== 'undefined' && String(dynaValue).trim() !== 'null';
                            return (
                              <>
                                {hasValue ? (
                                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                                    Yes
                                  </span>
                                ) : (
                                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">
                                    No
                                  </span>
                                )}
                                <span className="text-xs text-gray-500">
                                  ({String(dynaValue || 'empty')})
                                </span>
                              </>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap border-r border-gray-200">
                        <DisplayCell
                          value={row.prime_manager || ''}
                          className="text-sm text-gray-900"
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap border-r border-gray-200">
                        <DisplayCell
                          value={row.prime_director || ''}
                          className="text-sm text-gray-900"
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap border-r border-gray-200">
                        <DisplayCell
                          value={row.prime_vp || ''}
                          className="text-sm text-gray-900"
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          onClick={() => {
                            const serviceName = encodeURIComponent(
                              row.service_name_mp || 'unnamed-service'
                            );
                            const serviceId = encodeURIComponent(row.service_id || row.id);
                            window.open(
                              `/service-editor/${serviceName}?id=${serviceId}&cmdb=${
                                row.cmdb_id || ''
                              }&rowId=${row.id}`,
                              '_blank'
                            );
                          }}
                          className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
                          title="Edit service in PagerDuty"
                        >
                          <svg
                            className="w-3 h-3 mr-1"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                            />
                          </svg>
                          Edit Service
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-6 py-4 bg-white/90 backdrop-blur-sm border-t border-gray-200/50">
              <div className="flex items-center space-x-3">
                <p className="text-sm font-medium text-gray-800">
                  Showing{' '}
                  <span className="font-semibold text-gray-900">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                  <span className="font-semibold text-gray-900">
                    {Math.min(currentPage * itemsPerPage, filteredAndSortedData.length)}
                  </span>{' '}
                  of <span className="font-semibold text-gray-900">{filteredAndSortedData.length}</span> results
                </p>
                <select
                  value={itemsPerPage}
                  onChange={e => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                >
                  <option value={10}>10 per page</option>
                  <option value={25}>25 per page</option>
                  <option value={50}>50 per page</option>
                  <option value={100}>100 per page</option>
                </select>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed transition-all duration-200"
                >
                  Previous
                </button>
                <div className="px-4 py-2 text-sm font-semibold text-gray-800 bg-gray-50 rounded-lg border border-gray-200">
                  Page {currentPage} of {totalPages || 1}
                </div>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages || 1, currentPage + 1))}
                  disabled={currentPage >= totalPages}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed transition-all duration-200"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Service Progress Tracking */}
        {data.length > 0 && (
          <div className="bg-white/80 backdrop-blur-xl shadow-sm rounded-2xl border border-gray-200/50">
            <div className="px-8 py-6 border-b border-gray-200/50">
              <h3 className="text-lg font-semibold text-gray-900">Service Progress Tracking</h3>
              <p className="text-sm text-gray-600 mt-1">
                Completion status for Team Name, Tech-Svc, Service Name, CMDB ID fields
              </p>
            </div>
            <div className="px-8 py-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                {filteredAndSortedData.map(row => {
                  // Calculate completion for key fields only: team_name, owned_team, service_name_mp, cmdb_id
                  const keyFields = ['team_name', 'owned_team', 'service_name_mp', 'cmdb_id'] as const;
                  const completedKeyFields = keyFields.filter(field => row[field] && String(row[field]).trim() !== '').length;
                  const keyFieldCompletion = Math.round((completedKeyFields / keyFields.length) * 100);

                  return (
                    <div
                      key={row.id}
                      className="bg-gray-50/50 rounded-xl p-4 border border-gray-200/30"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900 text-sm truncate">
                          {row.service_name_mp || row.api_name || 'Unnamed Service'}
                        </h4>
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            keyFieldCompletion >= 90
                              ? 'bg-green-100 text-green-700'
                              : keyFieldCompletion >= 70
                              ? 'bg-blue-100 text-blue-700'
                              : keyFieldCompletion >= 50
                              ? 'bg-yellow-100 text-yellow-700'
                              : keyFieldCompletion >= 30
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {keyFieldCompletion}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${
                            keyFieldCompletion >= 90
                              ? 'bg-green-500'
                              : keyFieldCompletion >= 70
                              ? 'bg-blue-500'
                              : keyFieldCompletion >= 50
                              ? 'bg-yellow-500'
                              : keyFieldCompletion >= 30
                              ? 'bg-orange-500'
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${keyFieldCompletion}%` }}
                        />
                      </div>
                      <div className="mt-2 space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Team:</span>
                          <span className={row.team_name ? 'text-green-600' : 'text-red-500'}>
                            {row.team_name ? '✓' : '✗'}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Tech-Svc:</span>
                          <span className={row.owned_team ? 'text-green-600' : 'text-red-500'}>
                            {row.owned_team ? '✓' : '✗'}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Service:</span>
                          <span className={row.service_name_mp ? 'text-green-600' : 'text-red-500'}>
                            {row.service_name_mp ? '✓' : '✗'}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">CMDB:</span>
                          <span className={row.cmdb_id ? 'text-green-600' : 'text-red-500'}>
                            {row.cmdb_id ? '✓' : '✗'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}


        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Delete Row</h3>
              <p className="text-sm text-gray-500 mb-6">
                Are you sure you want to delete this row? This action cannot be undone.
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    deleteRow(showDeleteConfirm);
                    setShowDeleteConfirm(null);
                  }}
                  className="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700"
                >
                  Delete
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
