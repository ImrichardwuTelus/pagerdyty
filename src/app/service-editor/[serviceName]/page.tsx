'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

interface PagerDutyTeam {
  id: string;
  name: string;
  summary: string;
}

interface PagerDutyService {
  id: string;
  name: string;
  teams: PagerDutyTeam[];
  html_url: string;
  status: string;
}

export default function ServiceEditor() {
  const params = useParams();
  const searchParams = useSearchParams();
  const serviceName = decodeURIComponent(params.serviceName as string);
  const serviceId = searchParams.get('id');
  const cmdbId = searchParams.get('cmdb');

  const [service, setService] = useState<PagerDutyService | null>(null);
  const [availableTeams, setAvailableTeams] = useState<PagerDutyTeam[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Mock data for demonstration - replace with actual API calls
  useEffect(() => {
    const fetchServiceData = async () => {
      try {
        setLoading(true);

        // Simulate API call to fetch service data
        const mockService: PagerDutyService = {
          id: serviceId || 'PIJ90N7',
          name: serviceName,
          teams: [
            {
              id: 'PQ9K7I8',
              name: 'Engineering',
              summary: 'Engineering Team'
            }
          ],
          html_url: `https://subdomain.pagerduty.com/service-directory/${serviceId}`,
          status: 'active'
        };

        // Mock available teams
        const mockTeams: PagerDutyTeam[] = [
          { id: 'PQ9K7I8', name: 'Engineering', summary: 'Engineering Team' },
          { id: 'PQ9K7I9', name: 'DevOps', summary: 'DevOps Team' },
          { id: 'PQ9K7I0', name: 'Security', summary: 'Security Team' },
          { id: 'PQ9K7I1', name: 'Product', summary: 'Product Team' },
          { id: 'PQ9K7I2', name: 'Quality Assurance', summary: 'QA Team' }
        ];

        setService(mockService);
        setAvailableTeams(mockTeams);
        setSelectedTeam(mockService.teams[0]?.id || '');
      } catch (error) {
        console.error('Error fetching service data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchServiceData();
  }, [serviceName, serviceId]);

  const handleSaveChanges = async () => {
    if (!service || !selectedTeam) return;

    setSaving(true);
    try {
      // Simulate API call to update service
      const selectedTeamData = availableTeams.find(team => team.id === selectedTeam);

      console.log('Updating service:', {
        serviceId: service.id,
        serviceName: service.name,
        newTeam: selectedTeamData,
        cmdbId
      });

      // Here you would make the actual API call to PagerDuty
      // const response = await fetch('/api/pagerduty/update-service', {
      //   method: 'PUT',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     serviceId: service.id,
      //     teamId: selectedTeam
      //   })
      // });

      // Simulate delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      alert('Service updated successfully!');
    } catch (error) {
      console.error('Error updating service:', error);
      alert('Error updating service. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading service data...</p>
        </div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Service Not Found</h1>
          <p className="text-gray-600">The requested service could not be loaded.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-6">
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-xl shadow-sm rounded-2xl border border-gray-200/30 mb-8">
          <div className="px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">{service.name}</h1>
                <p className="text-sm text-gray-600 mt-1">Service ID: {service.id}</p>
                {cmdbId && <p className="text-sm text-gray-600">CMDB ID: {cmdbId}</p>}
              </div>
              <div className="flex items-center space-x-3">
                <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                  service.status === 'active'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {service.status}
                </span>
                <a
                  href={service.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
                >
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  View in PagerDuty
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Team Assignment */}
        <div className="bg-white/80 backdrop-blur-xl shadow-sm rounded-2xl border border-gray-200/30 mb-8">
          <div className="px-8 py-6 border-b border-gray-200/30">
            <h2 className="text-lg font-semibold text-gray-900">Team Assignment</h2>
            <p className="text-sm text-gray-600 mt-1">Assign this service to a PagerDuty team</p>
          </div>
          <div className="px-8 py-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current Team
                </label>
                <div className="text-sm text-gray-900">
                  {service.teams.length > 0 ? service.teams[0].name : 'No team assigned'}
                </div>
              </div>

              <div>
                <label htmlFor="team-select" className="block text-sm font-medium text-gray-700 mb-2">
                  Select New Team
                </label>
                <select
                  id="team-select"
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a team...</option>
                  {availableTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Service Details */}
        <div className="bg-white/80 backdrop-blur-xl shadow-sm rounded-2xl border border-gray-200/30 mb-8">
          <div className="px-8 py-6 border-b border-gray-200/30">
            <h2 className="text-lg font-semibold text-gray-900">Service Information</h2>
            <p className="text-sm text-gray-600 mt-1">View and manage service details</p>
          </div>
          <div className="px-8 py-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Service Name</label>
                <input
                  type="text"
                  value={service.name}
                  onChange={(e) => setService({...service, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Service ID</label>
                <input
                  type="text"
                  value={service.id}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-4">
          <button
            onClick={() => window.close()}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveChanges}
            disabled={saving || !selectedTeam}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white inline mr-2"></div>
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}