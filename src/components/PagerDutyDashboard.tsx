'use client';

import { usePagerDutyData } from '@/hooks/usePagerDuty';
import { ExcelServiceData } from '@/types/pagerduty';
import { useState, useMemo } from 'react';

interface ServiceWithCompletion {
  id: string;
  name: string;
  team?: string;
  completion: number;
  excelData?: ExcelServiceData;
}

export default function PagerDutyDashboard() {
  const { users, teams, services, loading, error, refetch } = usePagerDutyData();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<string>('');

  const servicesWithCompletion = useMemo(() => {
    if (!services) return [];

    return services.map(service => {
      const excelData: ExcelServiceData = {
        service_path: '',
        cmdb_id: '',
        app_name: service.name,
        api_name: service.name,
        prime_director: '',
        prime_vp: '',
        mse: '',
        next_hop_service_id: '',
        next_hop_process_group: '',
        next_hop_status: '',
        next_hop_service_code: '',
        enrichment_status_endpoint: '',
        analysis_prime_manager: '',
      };

      const fields = Object.values(excelData);
      const completedFields = fields.filter(field => field && field.trim() !== '').length;
      const completion = Math.round((completedFields / fields.length) * 100);

      return {
        id: service.id,
        name: service.name,
        team: service.teams?.[0]?.name || 'Unassigned',
        completion,
        excelData,
      };
    });
  }, [services]);

  const filteredServices = useMemo(() => {
    return servicesWithCompletion.filter(service => {
      const matchesSearch = service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           service.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTeam = !selectedTeam || service.team === selectedTeam;
      return matchesSearch && matchesTeam;
    });
  }, [servicesWithCompletion, searchTerm, selectedTeam]);

  const stats = useMemo(() => {
    if (servicesWithCompletion.length === 0) return { avgCompletion: 0, totalServices: 0 };

    const avgCompletion = Math.round(
      servicesWithCompletion.reduce((sum, service) => sum + service.completion, 0) /
      servicesWithCompletion.length
    );

    return {
      avgCompletion,
      totalServices: servicesWithCompletion.length,
    };
  }, [servicesWithCompletion]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg">Loading PagerDuty data...</div>
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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">PagerDuty Service Dashboard</h1>
        <button
          onClick={refetch}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Refresh Data
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-medium text-gray-900">Total Services</h3>
          <p className="text-3xl font-bold text-blue-600">{stats.totalServices}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-medium text-gray-900">Average Completion</h3>
          <p className="text-3xl font-bold text-green-600">{stats.avgCompletion}%</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-medium text-gray-900">Teams</h3>
          <p className="text-3xl font-bold text-purple-600">{teams?.length || 0}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow border">
        <div className="p-6 border-b">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search services..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="sm:w-48">
              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Teams</option>
                {teams?.map(team => (
                  <option key={team.id} value={team.name}>{team.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Service Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  CMDB ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Team
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prime Manager
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Completion
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredServices.map((service) => (
                <tr key={service.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {service.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {service.excelData?.cmdb_id || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {service.team}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {service.excelData?.analysis_prime_manager || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center">
                      <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                        <div
                          className={`h-2 rounded-full ${
                            service.completion >= 80 ? 'bg-green-500' :
                            service.completion >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${service.completion}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium">{service.completion}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <button className="text-blue-600 hover:text-blue-900">
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredServices.length === 0 && (
          <div className="p-6 text-center text-gray-500">
            No services found matching your criteria.
          </div>
        )}
      </div>
    </div>
  );
}