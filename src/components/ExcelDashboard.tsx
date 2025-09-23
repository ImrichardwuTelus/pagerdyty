'use client';

import { useState, useMemo, useEffect } from 'react';
import { usePagerDutyData } from '@/hooks/usePagerDuty';
import type { ExcelServiceRow, Service, Team } from '@/types/pagerduty';

export default function ExcelDashboard() {
  const { services, teams, users, loading, error, refetch } = usePagerDutyData();
  const [excelData, setExcelData] = useState<ExcelServiceRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [editingCell, setEditingCell] = useState<{rowId: string, field: string} | null>(null);
  const [editValue, setEditValue] = useState('');

  // Initialize Excel data from PagerDuty services
  useEffect(() => {
    if (services && services.length > 0) {
      const excelRows: ExcelServiceRow[] = services.map(service => ({
        id: service.id,
        service_name_mp: service.name,
        service_path: '',
        cmdb_id: service.id,
        api_name: service.name,
        prime_manager: '',
        prime_director: '',
        prime_vp: '',
        mse: '',
        dyna_service_name: service.name,
        next_hop_process_group: '',
        analysis_status: service.status,
        next_hop_service_code: '',
        enrichment_status: '',
        team_name: service.teams?.[0]?.name || '',
        confirmed: '',
        owned_team: service.teams?.[0]?.name || '',
        service_id: service.id,
        completion: 0,
        lastUpdated: new Date().toISOString(),
      }));

      // Calculate completion for each row
      excelRows.forEach(row => {
        const fields = Object.values(row).filter(value =>
          typeof value === 'string' && value !== '' && value !== row.id && value !== row.completion?.toString() && value !== row.lastUpdated
        );
        const totalFields = 16; // Total Excel fields excluding id, completion, lastUpdated
        row.completion = Math.round((fields.length / totalFields) * 100);
      });

      setExcelData(excelRows);
    }
  }, [services]);

  const filteredData = useMemo(() => {
    return excelData.filter(row => {
      const matchesSearch = (row.service_name_mp?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
                           (row.service_id?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
                           (row.cmdb_id?.toLowerCase() || '').includes(searchQuery.toLowerCase());

      const matchesTeam = !selectedTeam || row.team_name === selectedTeam;

      return matchesSearch && matchesTeam;
    });
  }, [excelData, searchQuery, selectedTeam]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  const handleCellEdit = (rowId: string, field: keyof ExcelServiceRow, value: string) => {
    setExcelData(prev => prev.map(row => {
      if (row.id === rowId) {
        const updatedRow = { ...row, [field]: value, lastUpdated: new Date().toISOString() };

        // Recalculate completion
        const fields = Object.values(updatedRow).filter(val =>
          typeof val === 'string' && val !== '' && val !== row.id && val !== row.completion?.toString() && val !== row.lastUpdated
        );
        updatedRow.completion = Math.round((fields.length / 16) * 100);

        return updatedRow;
      }
      return row;
    }));
    setEditingCell(null);
  };

  const startEdit = (rowId: string, field: string, currentValue: string) => {
    setEditingCell({ rowId, field });
    setEditValue(currentValue);
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const confirmEdit = () => {
    if (editingCell) {
      handleCellEdit(editingCell.rowId, editingCell.field as keyof ExcelServiceRow, editValue);
    }
  };

  const updateFromPagerDuty = (rowId: string) => {
    const service = services?.find(s => s.id === rowId);
    if (service) {
      setExcelData(prev => prev.map(row => {
        if (row.id === rowId) {
          return {
            ...row,
            service_name_mp: service.name,
            api_name: service.name,
            dyna_service_name: service.name,
            analysis_status: service.status,
            team_name: service.teams?.[0]?.name || '',
            owned_team: service.teams?.[0]?.name || '',
            service_id: service.id,
            lastUpdated: new Date().toISOString(),
          };
        }
        return row;
      }));
    }
  };

  const getCompletionColor = (completion: number) => {
    if (completion >= 90) return 'bg-green-500';
    if (completion >= 70) return 'bg-blue-500';
    if (completion >= 50) return 'bg-yellow-500';
    if (completion >= 30) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const EditableCell = ({
    value,
    rowId,
    field,
    className = "text-sm text-gray-500"
  }: {
    value: string;
    rowId: string;
    field: string;
    className?: string;
  }) => {
    const isEditing = editingCell?.rowId === rowId && editingCell?.field === field;

    if (isEditing) {
      return (
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={cancelEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') confirmEdit();
            if (e.key === 'Escape') cancelEdit();
          }}
          className="w-full px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          autoFocus
        />
      );
    }

    return (
      <div
        className={`${className} cursor-pointer hover:bg-blue-50 px-2 py-1 rounded min-h-[28px] flex items-center`}
        onClick={() => startEdit(rowId, field, value)}
        title="Click to edit"
      >
        {value || '-'}
      </div>
    );
  };

  const Pagination = () => (
    <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200">
      <div className="flex items-center space-x-2">
        <p className="text-sm text-gray-700">
          Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
          <span className="font-medium">
            {Math.min(currentPage * itemsPerPage, filteredData.length)}
          </span>{' '}
          of <span className="font-medium">{filteredData.length}</span> results
        </p>
        <select
          value={itemsPerPage}
          onChange={(e) => {
            setItemsPerPage(Number(e.target.value));
            setCurrentPage(1);
          }}
          className="text-sm border border-gray-300 rounded px-2 py-1"
        >
          <option value={10}>10 per page</option>
          <option value={25}>25 per page</option>
          <option value={50}>50 per page</option>
          <option value={100}>100 per page</option>
        </select>
      </div>
      <div className="flex space-x-1">
        <button
          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
        >
          Previous
        </button>
        <span className="px-3 py-1 text-sm">
          Page {currentPage} of {totalPages}
        </span>
        <button
          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
        >
          Next
        </button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg">Loading Excel data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <h3 className="text-red-800 font-medium">Error loading data</h3>
          <p className="text-red-600 mt-2">{error}</p>
          <button
            onClick={refetch}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Service Excel Dashboard</h2>
              <p className="mt-1 text-sm text-gray-600">
                Complete service onboarding data with PagerDuty integration
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={refetch}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync with PagerDuty
              </button>
              <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export to Excel
              </button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <input
                type="text"
                placeholder="Search services..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Team</label>
              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Teams</option>
                {teams?.map(team => (
                  <option key={team.id} value={team.name}>{team.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedTeam('');
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 bg-white hover:bg-gray-50"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto" style={{ maxHeight: '70vh' }}>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 min-w-[200px]">
                  Service Name MP
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 min-w-[150px]">
                  Service Path
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 min-w-[120px]">
                  CMDB ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 min-w-[120px]">
                  API Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 min-w-[150px]">
                  Prime Manager
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 min-w-[150px]">
                  Prime Director
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 min-w-[120px]">
                  Prime VP
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 min-w-[100px]">
                  MSE
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 min-w-[150px]">
                  DynaService Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 min-w-[180px]">
                  Next Hop Process Group
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 min-w-[130px]">
                  Analysis Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 min-w-[170px]">
                  Next Hop Service Code
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 min-w-[140px]">
                  Enrichment Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 min-w-[120px]">
                  Team Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 min-w-[100px]">
                  Confirmed
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 min-w-[120px]">
                  Owned Team
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 min-w-[120px]">
                  Service ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 min-w-[120px]">
                  Completion
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedData.map((row, index) => (
                <tr key={row.id} className={`hover:bg-blue-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <td className="px-4 py-3 whitespace-nowrap border-r border-gray-200">
                    <EditableCell value={row.service_name_mp || ''} rowId={row.id} field="service_name_mp" className="text-sm font-medium text-gray-900" />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap border-r border-gray-200">
                    <EditableCell value={row.service_path || ''} rowId={row.id} field="service_path" />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap border-r border-gray-200">
                    <EditableCell value={row.cmdb_id || ''} rowId={row.id} field="cmdb_id" className="text-sm text-gray-500 font-mono" />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap border-r border-gray-200">
                    <EditableCell value={row.api_name || ''} rowId={row.id} field="api_name" />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap border-r border-gray-200">
                    <EditableCell value={row.prime_manager || ''} rowId={row.id} field="prime_manager" />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap border-r border-gray-200">
                    <EditableCell value={row.prime_director || ''} rowId={row.id} field="prime_director" />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap border-r border-gray-200">
                    <EditableCell value={row.prime_vp || ''} rowId={row.id} field="prime_vp" />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap border-r border-gray-200">
                    <EditableCell value={row.mse || ''} rowId={row.id} field="mse" />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap border-r border-gray-200">
                    <EditableCell value={row.dyna_service_name || ''} rowId={row.id} field="dyna_service_name" />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap border-r border-gray-200">
                    <EditableCell value={row.next_hop_process_group || ''} rowId={row.id} field="next_hop_process_group" />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap border-r border-gray-200">
                    <EditableCell value={row.analysis_status || ''} rowId={row.id} field="analysis_status" />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap border-r border-gray-200">
                    <EditableCell value={row.next_hop_service_code || ''} rowId={row.id} field="next_hop_service_code" />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap border-r border-gray-200">
                    <EditableCell value={row.enrichment_status || ''} rowId={row.id} field="enrichment_status" />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap border-r border-gray-200">
                    <EditableCell value={row.team_name || ''} rowId={row.id} field="team_name" />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap border-r border-gray-200">
                    <EditableCell value={row.confirmed || ''} rowId={row.id} field="confirmed" />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap border-r border-gray-200">
                    <EditableCell value={row.owned_team || ''} rowId={row.id} field="owned_team" />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap border-r border-gray-200">
                    <div className="text-sm text-gray-500 font-mono">{row.service_id}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap border-r border-gray-200">
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2 min-w-[60px]">
                        <div
                          className={`h-2 rounded-full ${getCompletionColor(row.completion)}`}
                          style={{ width: `${row.completion}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-700 min-w-[35px]">{row.completion}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => updateFromPagerDuty(row.id)}
                        className="text-blue-600 hover:text-blue-900 text-xs font-medium"
                        title="Update from PagerDuty"
                      >
                        Sync
                      </button>
                      <button className="text-green-600 hover:text-green-900 text-xs font-medium">
                        Save
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredData.length === 0 && (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No data found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchQuery || selectedTeam
                ? 'Try adjusting your search criteria'
                : 'Sync with PagerDuty to load service data'
              }
            </p>
          </div>
        )}

        <Pagination />
      </div>
    </div>
  );
}