'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useExcelData } from '@/hooks/useExcelData';
import type { ExcelServiceRow, User } from '@/types/pagerduty';
import { EXCEL_COLUMNS, updateExcelData } from '@/lib/excel-utils';
import { getPagerDutyClient } from '@/lib/pagerduty-client';

interface SortConfig {
  key: keyof ExcelServiceRow | null;
  direction: 'asc' | 'desc';
}

interface FilterConfig {
  searchQuery: string;
  serviceNameFilter: string;
  cmdbIdFilter: string;
  primeManagerFilter: string;
  primeDirectorFilter: string;
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

  // UI State
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: 'asc' });
  const [filterConfig, setFilterConfig] = useState<FilterConfig>({
    searchQuery: '',
    serviceNameFilter: '',
    cmdbIdFilter: '',
    primeManagerFilter: '',
    primeDirectorFilter: '',
    teamNameFilter: '',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());

  // Prime manager editing state
  const [showPrimeManagerModal, setShowPrimeManagerModal] = useState(false);
  const [primeManagerSearch, setPrimeManagerSearch] = useState<string>('');
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingMoreUsers, setLoadingMoreUsers] = useState(false);
  const [selectedPrimeManager, setSelectedPrimeManager] = useState<string>('');
  const [hasMoreUsers, setHasMoreUsers] = useState(true);
  const [currentOffset, setCurrentOffset] = useState(0);

  // User caching state with pagination support
  const [userCache, setUserCache] = useState<{
    users: User[];
    allUserIds: Set<string>; // To track unique users and enable global search
    totalCount: number;
    timestamp: number;
    searchCache: Map<string, User[]>; // Cache search results
  } | null>(null);

  // Progress calculations
  const progress = getOverallProgress();

  // Get unique values for filters
  const uniqueValues = useMemo(() => {
    const serviceNames = new Set<string>();
    const cmdbIds = new Set<string>();
    const primeManagers = new Set<string>();
    const primeDirectors = new Set<string>();
    const teamNames = new Set<string>();

    data.forEach(row => {
      if (row.mp_service_name) serviceNames.add(row.mp_service_name);
      if (row.mp_cmdb_id) cmdbIds.add(row.mp_cmdb_id);
      if (row.prime_manager) primeManagers.add(row.prime_manager);
      if (row.prime_director) primeDirectors.add(row.prime_director);
      if (row.pd_team_name) teamNames.add(row.pd_team_name);
    });

    return {
      serviceNames: Array.from(serviceNames).sort(),
      cmdbIds: Array.from(cmdbIds).sort(),
      primeManagers: Array.from(primeManagers).sort(),
      primeDirectors: Array.from(primeDirectors).sort(),
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
          row.mp_service_name,
          row.mp_cmdb_id,
          row.dt_service_id,
          row.prime_manager,
          row.prime_director,
          row.prime_vp,
          row.pd_team_name,
          row.pd_tech_svc,
        ];
        if (!searchableFields.some(field => field?.toLowerCase().includes(query))) {
          return false;
        }
      }

      // Individual field filters
      if (
        filterConfig.serviceNameFilter &&
        row.mp_service_name !== filterConfig.serviceNameFilter
      ) {
        return false;
      }
      if (filterConfig.cmdbIdFilter && row.mp_cmdb_id !== filterConfig.cmdbIdFilter) {
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
      if (filterConfig.teamNameFilter && row.pd_team_name !== filterConfig.teamNameFilter) {
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

  const handleSelectService = (serviceId: string) => {
    setSelectedServices(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(serviceId)) {
        newSelected.delete(serviceId);
      } else {
        newSelected.add(serviceId);
      }
      return newSelected;
    });
  };

  const handleSelectAll = () => {
    const allFilteredIds = filteredAndSortedData.map(row => row.id);
    setSelectedServices(new Set(allFilteredIds));
  };

  const handleUnselectAll = () => {
    setSelectedServices(new Set());
  };

  // Load initial batch of PagerDuty users with caching
  const loadPagerDutyUsers = useCallback(
    async (reset = false) => {
      try {
        const isInitialLoad = reset || availableUsers.length === 0;
        if (isInitialLoad) {
          setLoadingUsers(true);
          setCurrentOffset(0);
          setHasMoreUsers(true);
        } else {
          setLoadingMoreUsers(true);
        }

        // Check cache validity (10 minutes)
        const now = Date.now();
        const cacheValidDuration = 10 * 60 * 1000;
        const isCacheValid = userCache && now - userCache.timestamp < cacheValidDuration;

        // If we have valid cache and it's initial load, use cached data
        if (isCacheValid && isInitialLoad && userCache.users.length > 0) {
          setAvailableUsers(userCache.users);
          setCurrentOffset(userCache.users.length);
          setHasMoreUsers(userCache.users.length < userCache.totalCount);
          setLoadingUsers(false);
          return;
        }

        const client = getPagerDutyClient();
        const limit = 25; // Load 25 users at a time
        const offset = isInitialLoad ? 0 : currentOffset;

        const response = await client.getUsers({
          limit,
          offset,
          include: ['contact_methods', 'notification_rules'],
        });

        const newUsers = response.users;
        const hasMore = response.more || false;

        if (isInitialLoad) {
          // First load or reset
          setAvailableUsers(newUsers);
          setUserCache({
            users: newUsers,
            allUserIds: new Set(newUsers.map(u => u.id)),
            totalCount: response.total || newUsers.length,
            timestamp: now,
            searchCache: new Map(),
          });
        } else {
          // Append to existing users
          const updatedUsers = [...availableUsers, ...newUsers];
          setAvailableUsers(updatedUsers);

          if (userCache) {
            const updatedCache = {
              ...userCache,
              users: updatedUsers,
              allUserIds: new Set([...userCache.allUserIds, ...newUsers.map(u => u.id)]),
              timestamp: now,
            };
            setUserCache(updatedCache);
          }
        }

        setCurrentOffset(offset + newUsers.length);
        setHasMoreUsers(hasMore);
      } catch (error) {
        console.error('Failed to load PagerDuty users:', error);
        if (reset || availableUsers.length === 0) {
          setAvailableUsers([]);
        }
      } finally {
        setLoadingUsers(false);
        setLoadingMoreUsers(false);
      }
    },
    [userCache, availableUsers.length, currentOffset]
  );

  // Global search function that searches ALL users via API
  const searchAllUsers = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        // If no search, load from cache or initial batch
        if (userCache && userCache.users.length > 0) {
          setAvailableUsers(userCache.users);
          setHasMoreUsers(userCache.users.length < userCache.totalCount);
        } else {
          loadPagerDutyUsers(true);
        }
        return;
      }

      try {
        setLoadingUsers(true);

        // Check if we have this search cached
        if (userCache?.searchCache.has(searchQuery)) {
          const cachedResults = userCache.searchCache.get(searchQuery)!;
          setAvailableUsers(cachedResults);
          setHasMoreUsers(false); // Search results don't have pagination
          setLoadingUsers(false);
          return;
        }

        const client = getPagerDutyClient();
        const response = await client.getUsers({
          query: searchQuery,
          limit: 100, // Get more results for search
          include: ['contact_methods', 'notification_rules'],
        });

        const searchResults = response.users;
        setAvailableUsers(searchResults);
        setHasMoreUsers(false); // Search results don't support infinite scroll

        // Cache the search results
        if (userCache) {
          const updatedCache = {
            ...userCache,
            searchCache: new Map(userCache.searchCache).set(searchQuery, searchResults),
          };
          setUserCache(updatedCache);
        }
      } catch (error) {
        console.error('Failed to search users:', error);
        setAvailableUsers([]);
      } finally {
        setLoadingUsers(false);
      }
    },
    [userCache, loadPagerDutyUsers]
  );

  // Handle opening prime manager modal
  const handleOpenPrimeManagerModal = useCallback(() => {
    setShowPrimeManagerModal(true);
    loadPagerDutyUsers(true);
  }, [loadPagerDutyUsers]);

  // Handle closing prime manager modal
  const handleClosePrimeManagerModal = useCallback(() => {
    setShowPrimeManagerModal(false);
    setPrimeManagerSearch('');
    setSelectedPrimeManager('');
  }, []);

  // Handle prime manager selection
  const handlePrimeManagerSelect = useCallback((managerName: string) => {
    setSelectedPrimeManager(managerName);
  }, []);

  // Handle bulk prime manager update
  const handleBulkPrimeManagerUpdate = useCallback(async () => {
    if (!selectedPrimeManager || selectedServices.size === 0) return;

    try {
      // Update all selected services with the new prime manager
      selectedServices.forEach(serviceId => {
        updateCell(serviceId, 'prime_manager', selectedPrimeManager);
      });

      // Write changes directly to Excel file via API
      const response = await fetch('/api/excel');
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          let currentExcelData: ExcelServiceRow[] = result.data;

          // Apply prime manager updates to all selected services
          selectedServices.forEach(serviceId => {
            currentExcelData = updateExcelData(
              currentExcelData,
              serviceId,
              'prime_manager',
              selectedPrimeManager
            );
          });

          // Write the updated data back to Excel file
          const writeResponse = await fetch('/api/excel', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              data: currentExcelData,
              preserveHeaders: true,
              fileName: 'service_data.xlsx',
            }),
          });

          if (writeResponse.ok) {
            const writeResult = await writeResponse.json();
            if (writeResult.success) {
              console.log(
                `Prime manager updated for ${selectedServices.size} services successfully`
              );

              // Reload the Excel data to sync with the server
              await loadLocalExcelFile('service_data.xlsx');
            } else {
              console.error('Failed to write Excel data:', writeResult.error);
            }
          } else {
            console.error('Failed to write Excel data - HTTP error:', writeResponse.statusText);
          }
        } else {
          console.error('Failed to read Excel data:', result.error);
        }
      } else {
        console.error('Failed to read Excel data - HTTP error:', response.statusText);
      }

      // Close modal and reset selections
      handleClosePrimeManagerModal();
      setSelectedServices(new Set());

      console.log(`Updated prime manager for ${selectedServices.size} services`);
    } catch (error) {
      console.error('Failed to update prime manager:', error);
    }
  }, [
    selectedPrimeManager,
    selectedServices,
    updateCell,
    updateExcelData,
    loadLocalExcelFile,
    handleClosePrimeManagerModal,
  ]);

  // Handle search input change with debouncing for global search
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSearchChange = useCallback(
    (value: string) => {
      setPrimeManagerSearch(value);

      // Clear previous timeout
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      // Debounce the global search
      searchTimeoutRef.current = setTimeout(() => {
        searchAllUsers(value);
      }, 300);
    },
    [searchAllUsers]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Handle infinite scroll
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
      const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

      // Load more when user scrolls to 90% of the content
      if (
        scrollPercentage > 0.9 &&
        hasMoreUsers &&
        !loadingMoreUsers &&
        !primeManagerSearch.trim()
      ) {
        loadPagerDutyUsers(false);
      }
    },
    [hasMoreUsers, loadingMoreUsers, primeManagerSearch, loadPagerDutyUsers]
  );

  // Since we're doing global search via API, we don't need client-side filtering
  const filteredUsers = availableUsers;

  // Memoize user count for performance
  const userCounts = useMemo(
    () => ({
      total: userCache?.totalCount || availableUsers.length,
      filtered: availableUsers.length,
      hasSearch: primeManagerSearch.trim().length > 0,
    }),
    [userCache?.totalCount, availableUsers.length, primeManagerSearch]
  );

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

  // Memoized User List Item Component for better performance
  const UserListItem = useCallback(
    ({
      user,
      isSelected,
      onSelect,
    }: {
      user: User;
      isSelected: boolean;
      onSelect: (name: string) => void;
    }) => (
      <label
        className={`flex items-center p-4 m-2 rounded-lg cursor-pointer transition-all duration-200 border-2 ${
          isSelected
            ? 'bg-purple-50 border-purple-200 shadow-md'
            : 'bg-white border-gray-200 hover:border-purple-200 hover:shadow-sm'
        }`}
      >
        <input
          type="radio"
          name="primeManager"
          value={user.name}
          checked={isSelected}
          onChange={e => onSelect(e.target.value)}
          className="h-5 w-5 text-purple-600 focus:ring-purple-500 border-gray-300"
        />
        <div className="ml-4 flex-1">
          <div className="font-semibold text-gray-900 flex items-center">
            {user.name}
            {isSelected && (
              <svg
                className="w-4 h-4 ml-2 text-purple-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
          </div>
          <div className="text-sm text-gray-600 flex items-center mt-1">
            <svg
              className="w-3 h-3 mr-1 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
              />
            </svg>
            {user.email}
          </div>
          {user.role && (
            <div className="text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded-full inline-block mt-2">
              {user.role}
            </div>
          )}
        </div>
      </label>
    ),
    []
  );

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
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Knowledge</h3>
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
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
                <div className="lg:col-span-6">
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
                      className="w-full h-11 pl-10 pr-3 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    />
                  </div>
                </div>
                <div className="lg:col-span-6 flex flex-wrap gap-3 justify-end">
                  <button
                    onClick={addRow}
                    className="h-11 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-sm transition-all duration-200 whitespace-nowrap"
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
                  {selectedServices.size > 0 && (
                    <>
                      <button
                        onClick={() => {
                          const selectedIds = Array.from(selectedServices).join(',');
                          window.location.href = `/batch-onboard?ids=${encodeURIComponent(
                            selectedIds
                          )}`;
                        }}
                        className="h-11 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 shadow-sm transition-all duration-200 whitespace-nowrap"
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
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                        Onboard ({selectedServices.size})
                      </button>
                      <button
                        onClick={handleOpenPrimeManagerModal}
                        className="h-11 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 shadow-sm transition-all duration-200 whitespace-nowrap"
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
                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                          />
                        </svg>
                        Edit Prime Manager ({selectedServices.size})
                      </button>
                    </>
                  )}
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
                    className="w-full h-11 px-3 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">MP CMDB ID</label>
                  <select
                    value={filterConfig.cmdbIdFilter}
                    onChange={e =>
                      setFilterConfig(prev => ({ ...prev, cmdbIdFilter: e.target.value }))
                    }
                    className="w-full h-11 px-3 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
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
                    className="w-full h-11 px-3 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
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
                    className="w-full h-11 px-3 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    PD Team Name
                  </label>
                  <select
                    value={filterConfig.teamNameFilter}
                    onChange={e =>
                      setFilterConfig(prev => ({ ...prev, teamNameFilter: e.target.value }))
                    }
                    className="w-full h-11 px-3 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
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
                      serviceNameFilter: '',
                      cmdbIdFilter: '',
                      primeManagerFilter: '',
                      primeDirectorFilter: '',
                      teamNameFilter: '',
                    })
                  }
                  className="h-11 px-4 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-200"
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
          <div
            id="service-data-table"
            className="bg-white shadow-lg rounded-xl border border-gray-200/60 overflow-hidden"
          >
            <div className="px-8 py-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Excel Data</h3>
              <p className="text-sm text-gray-600 mt-1">
                MP Service Name, Integrated with PD, PD Team Name, PD Tech-SVC, MP CMDB ID, DT
                Service Name, Prime Manager, Prime Director
              </p>
            </div>
            <div className="overflow-x-auto" style={{ maxHeight: '70vh' }}>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={
                            selectedServices.size > 0 &&
                            selectedServices.size === filteredAndSortedData.length
                          }
                          ref={input => {
                            if (input) {
                              input.indeterminate =
                                selectedServices.size > 0 &&
                                selectedServices.size < filteredAndSortedData.length;
                            }
                          }}
                          onChange={() => {
                            if (selectedServices.size === filteredAndSortedData.length) {
                              handleUnselectAll();
                            } else {
                              handleSelectAll();
                            }
                          }}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span>Select</span>
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('mp_service_name')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>MP Service Name</span>
                        <SortIcon column={'mp_service_name'} />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('integrated_with_pd')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Integrated with PD</span>
                        <SortIcon column={'integrated_with_pd'} />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('pd_team_name')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>PD Team Name</span>
                        <SortIcon column={'pd_team_name'} />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('pd_tech_svc')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>PD Tech-SVC</span>
                        <SortIcon column={'pd_tech_svc'} />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('mp_cmdb_id')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>MP CMDB ID</span>
                        <SortIcon column={'mp_cmdb_id'} />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('dt_service_name')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>DT Service Name</span>
                        <SortIcon column={'dt_service_name'} />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('prime_manager')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Prime Manager</span>
                        <SortIcon column={'prime_manager'} />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('prime_director')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Prime Director</span>
                        <SortIcon column={'prime_director'} />
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('internal_status')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Internal Status</span>
                        <SortIcon column={'internal_status'} />
                      </div>
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
                        <input
                          type="checkbox"
                          checked={selectedServices.has(row.id)}
                          onChange={() => handleSelectService(row.id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap border-r border-gray-200">
                        <DisplayCell
                          value={row.mp_service_name || ''}
                          className="text-sm font-medium text-gray-900"
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap border-r border-gray-200">
                        <DisplayCell
                          value={row.integrated_with_pd || ''}
                          className="text-sm text-gray-900"
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap border-r border-gray-200">
                        <DisplayCell
                          value={row.pd_team_name || ''}
                          className="text-sm text-gray-900"
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap border-r border-gray-200">
                        <DisplayCell
                          value={row.pd_tech_svc || ''}
                          className="text-sm text-gray-900"
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap border-r border-gray-200">
                        <DisplayCell
                          value={row.mp_cmdb_id || ''}
                          className="text-sm text-gray-900"
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap border-r border-gray-200">
                        <DisplayCell
                          value={row.dt_service_name || ''}
                          className="text-sm text-gray-900"
                        />
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
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            row.internal_status === 'complete'
                              ? 'bg-green-100 text-green-800'
                              : row.internal_status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : row.internal_status === 'failed'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {row.internal_status || '—'}
                        </span>
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
                  <span className="font-semibold text-gray-900">
                    {(currentPage - 1) * itemsPerPage + 1}
                  </span>{' '}
                  to{' '}
                  <span className="font-semibold text-gray-900">
                    {Math.min(currentPage * itemsPerPage, filteredAndSortedData.length)}
                  </span>{' '}
                  of{' '}
                  <span className="font-semibold text-gray-900">
                    {filteredAndSortedData.length}
                  </span>{' '}
                  results
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
                Completion status for PD Team Name, PD Tech SVC, MP Service Name, MP CMDB ID fields
              </p>
            </div>
            <div className="px-8 py-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                {filteredAndSortedData.map(row => {
                  // Calculate completion for key fields only: pd_team_name, pd_tech_svc, mp_service_name, mp_cmdb_id
                  const keyFields = [
                    'mp_service_name',
                    'mp_cmdb_id',
                    'pd_team_name',
                    'pd_tech_svc',
                  ] as const;

                  const completedKeyFields = keyFields.filter(
                    field => row[field] && String(row[field]).trim() !== ''
                  ).length;

                  const keyFieldCompletion = Math.round(
                    (completedKeyFields / keyFields.length) * 100
                  );

                  return (
                    <div
                      key={row.id}
                      className="bg-gray-50/50 rounded-xl p-4 border border-gray-200/30"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900 text-sm truncate">
                          {row.mp_service_name || 'Unnamed Service'}
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
                          <span className="text-gray-500">PD Team Name:</span>
                          <span className={row.pd_team_name ? 'text-green-600' : 'text-red-500'}>
                            {row.pd_team_name ? '✓' : '✗'}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">PD Tech SVC:</span>
                          <span className={row.pd_tech_svc ? 'text-green-600' : 'text-red-500'}>
                            {row.pd_tech_svc ? '✓' : '✗'}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Service:</span>
                          <span className={row.mp_service_name ? 'text-green-600' : 'text-red-500'}>
                            {row.mp_service_name ? '✓' : '✗'}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">MP CMDB:</span>
                          <span className={row.mp_cmdb_id ? 'text-green-600' : 'text-red-500'}>
                            {row.mp_cmdb_id ? '✓' : '✗'}
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
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
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

        {/* Prime Manager Edit Modal */}
        {showPrimeManagerModal && (
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={e => {
              if (e.target === e.currentTarget) {
                handleClosePrimeManagerModal();
              }
            }}
          >
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200">
              <div className="px-8 py-6 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-purple-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold text-gray-900 flex items-center">
                      <svg
                        className="w-6 h-6 mr-3 text-purple-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                      Edit Prime Manager
                    </h2>
                    <p className="text-gray-600 mt-2">
                      Update the prime manager for{' '}
                      <span className="font-semibold text-purple-700">{selectedServices.size}</span>{' '}
                      selected services
                    </p>
                  </div>
                  <button
                    onClick={handleClosePrimeManagerModal}
                    className="p-2 hover:bg-white/60 rounded-lg transition-colors duration-200"
                  >
                    <svg
                      className="w-5 h-5 text-gray-400 hover:text-gray-600"
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
                  </button>
                </div>
              </div>

              <div className="px-8 py-6 space-y-6 overflow-y-auto">
                {/* Search Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3 flex items-center">
                    <svg
                      className="w-4 h-4 mr-2 text-blue-500"
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
                    Search PagerDuty Users
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
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
                      placeholder="Search by name or email..."
                      value={primeManagerSearch}
                      onChange={e => handleSearchChange(e.target.value)}
                      className="w-full h-12 pl-12 pr-4 border border-gray-300 rounded-xl text-sm text-black focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200"
                      autoFocus
                    />
                    {loadingUsers && (
                      <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Users List */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3 flex items-center justify-between">
                    <div className="flex items-center">
                      <svg
                        className="w-4 h-4 mr-2 text-purple-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                      Select Prime Manager
                      {selectedPrimeManager && (
                        <span className="ml-2 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                          Selected
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">
                      {userCounts.hasSearch
                        ? `${userCounts.filtered} results`
                        : hasMoreUsers
                        ? `${userCounts.filtered} of ${userCounts.total}+ users`
                        : `${userCounts.filtered} users`}
                    </span>
                  </label>

                  {!loadingUsers && filteredUsers.length === 0 && !primeManagerSearch ? (
                    <div className="flex items-center justify-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                      <div className="text-center">
                        <svg
                          className="mx-auto h-12 w-12 text-gray-400"
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
                        <h3 className="mt-2 text-sm font-medium text-gray-900">Start searching</h3>
                        <p className="mt-1 text-sm text-gray-500">
                          Type in the search box to find PagerDuty users
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="space-y-2 max-h-[400px] overflow-y-auto border border-gray-200 rounded-xl bg-gray-50/50 p-2"
                      onScroll={handleScroll}
                    >
                      {filteredUsers.length > 0 ? (
                        <>
                          {filteredUsers.map(user => (
                            <UserListItem
                              key={user.id}
                              user={user}
                              isSelected={selectedPrimeManager === user.name}
                              onSelect={handlePrimeManagerSelect}
                            />
                          ))}

                          {/* Loading more indicator */}
                          {loadingMoreUsers && (
                            <div className="flex items-center justify-center py-4">
                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
                              <span className="ml-2 text-sm text-gray-600">
                                Loading more users...
                              </span>
                            </div>
                          )}

                          {/* End of results indicator */}
                          {!hasMoreUsers && !userCounts.hasSearch && filteredUsers.length > 0 && (
                            <div className="text-center py-4 text-sm text-gray-500">
                              All users loaded ({filteredUsers.length} total)
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="p-8 text-center text-gray-500">
                          {primeManagerSearch ? (
                            <div className="space-y-2">
                              <svg
                                className="mx-auto h-12 w-12 text-gray-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                />
                              </svg>
                              <div className="font-medium text-gray-900">No users found</div>
                              <div>
                                No users match "{primeManagerSearch}". Try a different search term.
                              </div>
                            </div>
                          ) : (
                            'Start typing to search for users...'
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="px-8 py-6 border-t border-gray-200 flex justify-end space-x-4">
                <button
                  onClick={handleClosePrimeManagerModal}
                  className="px-6 py-2.5 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkPrimeManagerUpdate}
                  disabled={!selectedPrimeManager}
                  className="px-6 py-2.5 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Update {selectedServices.size} Services
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
