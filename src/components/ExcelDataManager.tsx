'use client';

import { useState, useMemo, useEffect } from 'react';
import { usePagerDutyData } from '@/hooks/usePagerDuty';
import type { ExcelServiceRow, Service, Team, User } from '@/types/pagerduty';

interface PagerDutyDataSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (data: any, field: string) => void;
  services?: Service[];
  teams?: Team[];
  users?: User[];
  targetField: string;
  currentRow: ExcelServiceRow;
}

const PagerDutyDataSelector = ({
  isOpen,
  onClose,
  onSelect,
  services = [],
  teams = [],
  users = [],
  targetField,
  currentRow
}: PagerDutyDataSelectorProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'services' | 'teams' | 'users'>('services');

  if (!isOpen) return null;

  const getRelevantData = () => {
    switch (activeTab) {
      case 'services':
        return services.filter(service =>
          service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          service.id.toLowerCase().includes(searchQuery.toLowerCase())
        ).map(service => ({
          id: service.id,
          name: service.name,
          description: `Service: ${service.name}`,
          teams: service.teams?.map(t => t.name).join(', ') || 'No teams',
          status: service.status
        }));
      case 'teams':
        return teams.filter(team =>
          team.name.toLowerCase().includes(searchQuery.toLowerCase())
        ).map(team => ({
          id: team.id,
          name: team.name,
          description: `Team: ${team.name}`,
          details: team.description || 'No description'
        }));
      case 'users':
        return users.filter(user =>
          user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          user.email.toLowerCase().includes(searchQuery.toLowerCase())
        ).map(user => ({
          id: user.id,
          name: user.name,
          description: `User: ${user.name}`,
          email: user.email,
          role: user.role,
          teams: user.teams?.map(t => t.name).join(', ') || 'No teams'
        }));
      default:
        return [];
    }
  };

  const getFieldSuggestions = () => {
    const fieldMappings: Record<string, string[]> = {
      service_name_mp: ['name'],
      api_name: ['name'],
      dyna_service_name: ['name'],
      service_id: ['id'],
      team_name: ['name'],
      owned_team: ['name'],
      prime_manager: ['name', 'email'],
      prime_director: ['name', 'email'],
      prime_vp: ['name', 'email'],
      analysis_status: ['status'],
      cmdb_id: ['id']
    };

    return fieldMappings[targetField] || ['name'];
  };

  const relevantData = getRelevantData();
  const suggestions = getFieldSuggestions();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">
              Select PagerDuty Data for: {targetField.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mt-4 flex space-x-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex space-x-2">
              {(['services', 'teams', 'users'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium rounded-md ${
                    activeTab === tab
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-96">
          <div className="grid gap-3">
            {relevantData.map((item) => (
              <div
                key={item.id}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{item.name}</h4>
                    <p className="text-sm text-gray-500 mt-1">{item.description}</p>
                    {item.teams && (
                      <p className="text-xs text-gray-400 mt-1">Teams: {item.teams}</p>
                    )}
                    {item.email && (
                      <p className="text-xs text-gray-400 mt-1">Email: {item.email}</p>
                    )}
                  </div>
                  <div className="ml-4 flex flex-col space-y-1">
                    {suggestions.map((field) => (
                      <button
                        key={field}
                        onClick={() => {
                          const value = item[field as keyof typeof item] as string;
                          onSelect(value, targetField);
                          onClose();
                        }}
                        className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Use {field}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {relevantData.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">No data found matching your search.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default function ExcelDataManager() {
  const { services, teams, users, loading, error, refetch } = usePagerDutyData();
  const [excelData, setExcelData] = useState<ExcelServiceRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [editingCell, setEditingCell] = useState<{rowId: string, field: string} | null>(null);
  const [editValue, setEditValue] = useState('');
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectorField, setSelectorField] = useState('');
  const [currentRow, setCurrentRow] = useState<ExcelServiceRow | null>(null);

  // Initialize Excel data from mock/loaded data
  useEffect(() => {
    if (services && services.length > 0) {
      const excelRows: ExcelServiceRow[] = services.map((service, index) => {
        // Simulate some existing Excel data with partial completion
        const mockData = {
          id: service.id,
          service_name_mp: service.name,
          service_path: index % 3 === 0 ? `/api/v1/${service.name.toLowerCase()}` : '',
          cmdb_id: service.id,
          api_name: service.name,
          prime_manager: index % 4 === 0 ? 'John Doe' : '',
          prime_director: index % 5 === 0 ? 'Jane Smith' : '',
          prime_vp: index % 6 === 0 ? 'Bob Johnson' : '',
          mse: index % 3 === 0 ? 'MSE Team Alpha' : '',
          dyna_service_name: service.name,
          next_hop_process_group: index % 4 === 0 ? 'Process Group A' : '',
          analysis_status: service.status,
          next_hop_service_code: index % 5 === 0 ? 'SVC001' : '',
          enrichment_status: index % 3 === 0 ? 'Enriched' : '',
          team_name: service.teams?.[0]?.name || '',
          confirmed: index % 7 === 0 ? 'Yes' : '',
          owned_team: service.teams?.[0]?.name || '',
          service_id: service.id,
          completion: 0,
          lastUpdated: new Date().toISOString(),
        };

        // Calculate completion
        const fields = Object.entries(mockData).filter(([key, value]) =>
          !['id', 'completion', 'lastUpdated'].includes(key) &&
          typeof value === 'string' &&
          value !== ''
        );
        mockData.completion = Math.round((fields.length / 16) * 100);

        return mockData;
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

  const progressStats = useMemo(() => {
    const total = excelData.length;
    const completed = excelData.filter(row => row.completion === 100).length;
    const inProgress = excelData.filter(row => row.completion > 0 && row.completion < 100).length;
    const notStarted = excelData.filter(row => row.completion === 0).length;

    return {
      total,
      completed,
      inProgress,
      notStarted,
      avgCompletion: total > 0 ? Math.round(excelData.reduce((sum, row) => sum + row.completion, 0) / total) : 0
    };
  }, [excelData]);

  const handleCellEdit = (rowId: string, field: keyof ExcelServiceRow, value: string) => {
    setExcelData(prev => prev.map(row => {
      if (row.id === rowId) {
        const updatedRow = { ...row, [field]: value, lastUpdated: new Date().toISOString() };

        // Recalculate completion
        const fields = Object.entries(updatedRow).filter(([key, val]) =>
          !['id', 'completion', 'lastUpdated'].includes(key) &&
          typeof val === 'string' &&
          val !== ''
        );
        updatedRow.completion = Math.round((fields.length / 16) * 100);

        return updatedRow;
      }
      return row;
    }));
    setEditingCell(null);
  };

  const openPagerDutySelector = (rowId: string, field: string) => {
    const row = excelData.find(r => r.id === rowId);
    if (row) {
      setCurrentRow(row);
      setSelectorField(field);
      setSelectorOpen(true);
    }
  };

  const handlePagerDutySelect = (value: string, field: string) => {
    if (currentRow) {
      handleCellEdit(currentRow.id, field as keyof ExcelServiceRow, value);
    }
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
      <div className="flex items-center space-x-2">
        <div
          className={`${className} cursor-pointer hover:bg-blue-50 px-2 py-1 rounded min-h-[28px] flex items-center flex-1`}
          onClick={() => startEdit(rowId, field, value)}
          title="Click to edit"
        >
          {value || '-'}
        </div>
        <button
          onClick={() => openPagerDutySelector(rowId, field)}
          className="text-blue-600 hover:text-blue-800 text-xs"
          title="Fill from PagerDuty"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
        </button>
      </div>
    );
  };

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
      {/* Progress Overview */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Excel Data Progress Overview</h2>
          <p className="mt-1 text-sm text-gray-600">
            Per-row completion status and missing data tracking
          </p>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{progressStats.total}</div>
              <div className="text-sm text-blue-600">Total Rows</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{progressStats.completed}</div>
              <div className="text-sm text-green-600">100% Complete</div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{progressStats.inProgress}</div>
              <div className="text-sm text-yellow-600">In Progress</div>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{progressStats.notStarted}</div>
              <div className="text-sm text-red-600">Not Started</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{progressStats.avgCompletion}%</div>
              <div className="text-sm text-purple-600">Average</div>
            </div>
          </div>

          {/* Per-row progress bars */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Individual Row Progress</h3>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {excelData.slice(0, 20).map((row) => (
                <div key={row.id} className="flex items-center space-x-3 text-sm">
                  <div className="w-32 truncate">{row.service_name_mp}</div>
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${getCompletionColor(row.completion)}`}
                      style={{ width: `${row.completion}%` }}
                    />
                  </div>
                  <div className="w-12 text-right">{row.completion}%</div>
                  <div className="w-16 text-xs text-gray-500">
                    {16 - Math.round((row.completion / 100) * 16)} missing
                  </div>
                </div>
              ))}
            </div>
            {excelData.length > 20 && (
              <p className="text-xs text-gray-500">Showing first 20 rows...</p>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white shadow rounded-lg">
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

      {/* Excel Data Table */}
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                  Progress
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
                  <td className="px-4 py-3 whitespace-nowrap">
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
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
      </div>

      {/* PagerDuty Data Selector Modal */}
      <PagerDutyDataSelector
        isOpen={selectorOpen}
        onClose={() => setSelectorOpen(false)}
        onSelect={handlePagerDutySelect}
        services={services}
        teams={teams}
        users={users}
        targetField={selectorField}
        currentRow={currentRow!}
      />
    </div>
  );
}