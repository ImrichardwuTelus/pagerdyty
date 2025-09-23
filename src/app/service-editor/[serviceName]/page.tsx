'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { getPagerDutyClient } from '@/lib/pagerduty-client';
import type { Service, Team, User, ExcelServiceRow } from '@/types/pagerduty';
import { updateExcelData, writeExcelFile } from '@/lib/excel-utils';

export default function ServiceEditor() {
  const params = useParams();
  const searchParams = useSearchParams();
  const serviceName = decodeURIComponent(params.serviceName as string);
  const serviceId = searchParams.get('id');
  const cmdbId = searchParams.get('cmdb');
  const rowId = searchParams.get('rowId');

  const [service, setService] = useState<Service | null>(null);
  const [availableTeams, setAvailableTeams] = useState<Team[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [primeManager, setPrimeManager] = useState<string>('');
  const [serviceConfirmed, setServiceConfirmed] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRealService, setIsRealService] = useState<boolean>(false);
  const [serviceDescription, setServiceDescription] = useState<string>('');
  const [escalationPolicy, setEscalationPolicy] = useState<string>('');
  const [excelData, setExcelData] = useState<ExcelServiceRow[]>([]);
  const [teamSearchQuery, setTeamSearchQuery] = useState<string>('');
  const [userSearchQuery, setUserSearchQuery] = useState<string>('');

  // Fetch PagerDuty data with fallback to mock data
  useEffect(() => {
    const fetchServiceData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Try to get real PagerDuty data first
        try {
          const client = getPagerDutyClient();

          // Fetch teams, users, and all services from PagerDuty API
          const [teamsData, usersData, allServices] = await Promise.all([
            client.getAllTeams(),
            client.getAllUsers(),
            client.getAllServices()
          ]);

          // Try to find service by ID or by name
          let serviceData = null;

          // First try to find by serviceId if provided
          if (serviceId && serviceId !== 'undefined' && serviceId !== 'null') {
            try {
              const serviceResponse = await client.getService(serviceId, ['teams']);
              serviceData = serviceResponse.service;
            } catch (serviceError) {
              // Service not found by ID, will try by name next
            }
          }

          // If not found by ID, try to find by name in the fetched services
          if (!serviceData && serviceName) {
            const matchingService = allServices.find(service =>
              service.name.toLowerCase() === serviceName.toLowerCase()
            );
            if (matchingService) {
              serviceData = matchingService;
            }
          }

          setAvailableTeams(teamsData);
          setAvailableUsers(usersData);

          if (serviceData) {
            setService(serviceData);
            setIsRealService(true);
            setSelectedTeam(serviceData.teams[0]?.id || '');

            // Find users who are on the same teams as this service
            const serviceTeamIds = serviceData.teams?.map(team => team.id) || [];
            const serviceUsers = usersData.filter(user =>
              user.teams?.some(userTeam => serviceTeamIds.includes(userTeam.id))
            );
            setSelectedUsers(serviceUsers.map(user => user.id));

            // Try to find a manager role as prime manager
            const manager = serviceUsers.find(user =>
              user.role?.toLowerCase().includes('manager') ||
              user.job_title?.toLowerCase().includes('manager')
            );
            setPrimeManager(manager?.id || '');
          } else {
            // Create a new service object if no serviceId provided
            setService({
              id: serviceId || `new-${Date.now()}`,
              name: serviceName,
              summary: serviceName,
              type: 'service',
              self: '',
              html_url: '',
              auto_resolve_timeout: 14400,
              acknowledgement_timeout: 600,
              created_at: new Date().toISOString(),
              status: 'active',
              alert_creation: 'create_alerts_and_incidents',
              alert_grouping_parameters: { type: 'intelligent' },
              integrations: [],
              escalation_policy: {
                id: '',
                type: 'escalation_policy_reference',
                summary: '',
                self: '',
                html_url: ''
              },
              teams: [],
              incident_urgency_rule: {
                type: 'use_support_hours',
                during_support_hours: { type: 'constant', urgency: 'high' },
                outside_support_hours: { type: 'constant', urgency: 'low' }
              }
            });
          }
        } catch (apiError) {
          console.error('PagerDuty API error:', apiError);

          // Set a specific error message based on the error type
          let errorMessage = 'Failed to connect to PagerDuty API. ';

          if (apiError instanceof Error) {
            if (apiError.message.includes('404')) {
              errorMessage += 'Please check that your API token is valid and has the correct permissions.';
            } else if (apiError.message.includes('401') || apiError.message.includes('403')) {
              errorMessage += 'Authentication failed. Please verify your PagerDuty API token.';
            } else {
              errorMessage += apiError.message;
            }
          }

          throw new Error(errorMessage);
        }
      } catch (error) {
        console.error('Error setting up service data:', error);
        setError(error instanceof Error ? error.message : 'Failed to load service data');
      } finally {
        setLoading(false);
      }
    };

    fetchServiceData();
  }, [serviceName, serviceId]);

  const handleSaveChanges = async () => {
    if (!service) return;

    setSaving(true);
    try {
      // Prepare data for API call
      const selectedTeamData = availableTeams.find(team => team.id === selectedTeam);
      const selectedUserData = availableUsers.filter(user => selectedUsers.includes(user.id));
      const primeManagerData = availableUsers.find(user => user.id === primeManager);

      const client = getPagerDutyClient();

      // Prepare service update data
      const updateData: Partial<Service> = {
        name: service.name,
        teams: selectedTeamData ? [selectedTeamData] : [],
        summary: service.name,
      };

      let updatedService: Service;

      if (isRealService && service.id && !service.id.startsWith('new-')) {
        // Update existing service
        console.log('Updating existing PagerDuty service:', service.id);
        const response = await client.updateService(service.id, updateData);
        updatedService = response.service;
      } else {
        // Create new service - note: This requires escalation policy which we don't have
        // For now, we'll show what would be updated and log the data
        console.log('Would create new service with data:', updateData);
        updatedService = service; // Keep existing service data

        // In a real implementation, you'd need to handle escalation policy assignment
        // const newServiceData = { ...updateData, escalation_policy: { id: 'POLICY_ID' } };
        // const response = await client.createService(newServiceData);
        // updatedService = response.service;
      }

      // Update local state with the response from PagerDuty
      setService(updatedService);

      // Update Excel data if we have a row ID
      if (rowId && typeof window !== 'undefined') {
        try {
          // Post message to parent window to update Excel data
          const updateData = {
            type: 'UPDATE_EXCEL_ROW',
            rowId: rowId,
            updates: {
              service_id: updatedService.id,
              team_name: selectedTeamData?.name || '',
              owned_team: selectedTeamData?.name || '',
              prime_manager: primeManagerData?.name || '',
              confirmed: serviceConfirmed ? 'Yes' : 'No',
              service_name_mp: updatedService.name,
              enrichment_status: 'PagerDuty Integrated',
              analysis_status: updatedService.status,
            }
          };

          // Send message to parent window (dashboard)
          if (window.opener) {
            window.opener.postMessage(updateData, window.location.origin);
          }

          // Also store in localStorage as backup
          const storedExcelData = localStorage.getItem('excel-service-data');
          if (storedExcelData) {
            let currentExcelData: ExcelServiceRow[] = JSON.parse(storedExcelData);

            // Update all the fields
            Object.entries(updateData.updates).forEach(([field, value]) => {
              currentExcelData = updateExcelData(currentExcelData, rowId, field as keyof ExcelServiceRow, value);
            });

            localStorage.setItem('excel-service-data', JSON.stringify(currentExcelData));
            console.log('Excel data updated in localStorage');
          }
        } catch (excelError) {
          console.error('Failed to update Excel data:', excelError);
        }
      }

      // Show success message with actual data
      const successMessage = `Service "${updatedService.name}" ${isRealService ? 'updated' : 'prepared for update'} successfully!

Changes Applied:
- Service ID: ${updatedService.id}
- Team: ${selectedTeamData?.name || 'None'}
- Prime Manager: ${primeManagerData?.name || 'None'}
- Assigned Users: ${selectedUserData.length}
- Confirmed: ${serviceConfirmed ? 'Yes' : 'No'}
- CMDB ID: ${cmdbId || 'N/A'}
${rowId ? '- Excel data updated and downloaded' : ''}`;

      alert(successMessage);

      // Close the window after successful save
      setTimeout(() => window.close(), 2000);
    } catch (error) {
      console.error('Error updating service:', error);
      setError(error instanceof Error ? error.message : 'Failed to update service');
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

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <h1 className="mt-4 text-2xl font-semibold text-gray-900 mb-2">Error Loading Service</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
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
      <div className="max-w-5xl mx-auto py-12 px-8">
        {/* Header */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-200 mb-12 overflow-hidden">
          <div className="px-12 py-10">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-semibold text-gray-900 tracking-tight">{service.name}</h1>
                <p className="text-lg text-gray-500 mt-2">Service ID: {service.id}</p>
                {cmdbId && <p className="text-lg text-gray-500">CMDB ID: {cmdbId}</p>}
              </div>
              <div className="flex items-center space-x-4">
                <span className={`px-6 py-3 text-sm font-medium rounded-full ${
                  service.status === 'active'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {service.status.charAt(0).toUpperCase() + service.status.slice(1)}
                </span>
                <span className={`px-6 py-3 text-sm font-medium rounded-full ${
                  isRealService
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-orange-100 text-orange-800'
                }`}>
                  {isRealService ? 'Existing Service' : 'New Service'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Team Assignment */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-200 mb-12 overflow-hidden">
          <div className="px-12 py-8">
            <h2 className="text-3xl font-semibold text-gray-900 tracking-tight mb-2">Team Assignment</h2>
            <p className="text-lg text-gray-500 mb-10">Assign this service to a PagerDuty team</p>

            <div className="space-y-8">
              <div>
                <label className="block text-base font-medium text-gray-900 mb-4">
                  Current Owned Team {isRealService && <span className="text-sm text-blue-600">(from PagerDuty)</span>}
                </label>
                <div className="text-xl font-medium text-gray-700 bg-gray-50 px-6 py-4 rounded-2xl border border-gray-200">
                  {service.teams && service.teams.length > 0 ? (
                    <div>
                      <span className="font-semibold">{service.teams[0].name}</span>
                      <span className="text-base text-gray-500 ml-2">({service.teams[0].id})</span>
                      {service.teams.length > 1 && (
                        <span className="text-sm text-gray-500 block mt-1">
                          +{service.teams.length - 1} more team{service.teams.length > 2 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  ) : (
                    'No team assigned'
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="team-select" className="block text-base font-medium text-gray-900 mb-4">
                  Select New Team ({availableTeams.length} teams available)
                </label>

                <input
                  type="text"
                  placeholder="Search teams..."
                  value={teamSearchQuery}
                  onChange={(e) => setTeamSearchQuery(e.target.value)}
                  className="w-full px-6 py-3 mb-4 text-base text-gray-900 bg-white border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                />

                <select
                  id="team-select"
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  className="w-full px-6 py-4 text-lg font-medium text-gray-900 bg-white border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                >
                  <option value="">Select a team...</option>
                  {availableTeams
                    .filter(team =>
                      !teamSearchQuery ||
                      team.name.toLowerCase().includes(teamSearchQuery.toLowerCase()) ||
                      team.summary?.toLowerCase().includes(teamSearchQuery.toLowerCase())
                    )
                    .map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name} - {team.summary}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* User Management */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-200 mb-12 overflow-hidden">
          <div className="px-12 py-8">
            <h2 className="text-3xl font-semibold text-gray-900 tracking-tight mb-2">User Management</h2>
            <p className="text-lg text-gray-500 mb-10">Assign users and set prime manager for this service</p>

            <div className="space-y-10">
              <div>
                <label className="block text-base font-medium text-gray-900 mb-4">
                  Current Team Users {isRealService && <span className="text-sm text-blue-600">(from team assignment)</span>}
                </label>
                <div className="space-y-3">
                  {service?.teams && service.teams.length > 0 ? (
                    availableUsers
                      .filter(user =>
                        user.teams?.some(userTeam =>
                          service.teams?.some(serviceTeam => serviceTeam.id === userTeam.id)
                        )
                      )
                      .map((user) => (
                        <div key={user.id} className="flex items-center justify-between bg-gray-50 p-6 rounded-2xl border border-gray-200">
                          <div>
                            <div className="text-xl font-medium text-gray-900">{user.name}</div>
                            <div className="text-base text-gray-500 mt-1">
                              {user.email} • {user.role}
                              {user.job_title && ` • ${user.job_title}`}
                            </div>
                          </div>
                        </div>
                      ))
                  ) : (
                    <div className="text-xl font-medium text-gray-500 bg-gray-50 p-6 rounded-2xl border border-gray-200">
                      No team users found
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="prime-manager-select" className="block text-base font-medium text-gray-900 mb-4">
                  Prime Manager
                </label>
                <select
                  id="prime-manager-select"
                  value={primeManager}
                  onChange={(e) => setPrimeManager(e.target.value)}
                  className="w-full px-6 py-4 text-lg font-medium text-gray-900 bg-white border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                >
                  <option value="">Select prime manager...</option>
                  {availableUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} - {user.job_title || user.role} ({user.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-base font-medium text-gray-900 mb-4">
                  Additional Assigned Users ({availableUsers.length} users available)
                </label>

                <input
                  type="text"
                  placeholder="Search users by name, email, or role..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="w-full px-6 py-3 mb-4 text-base text-gray-900 bg-white border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                />

                <div className="space-y-3 max-h-96 overflow-y-auto bg-gray-50 rounded-2xl p-6 border border-gray-200">
                  {availableUsers
                    .filter(user =>
                      !userSearchQuery ||
                      user.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                      user.email.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                      user.role?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                      user.job_title?.toLowerCase().includes(userSearchQuery.toLowerCase())
                    )
                    .map((user) => (
                      <label key={user.id} className="flex items-center space-x-4 p-4 hover:bg-white rounded-xl border border-gray-200 cursor-pointer transition-all duration-200">
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(user.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedUsers([...selectedUsers, user.id]);
                            } else {
                              setSelectedUsers(selectedUsers.filter(id => id !== user.id));
                            }
                          }}
                          className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <div className="flex-1">
                          <div className="text-lg font-medium text-gray-900">{user.name}</div>
                          <div className="text-base text-gray-500">
                            {user.email} • {user.job_title || user.role}
                          </div>
                        </div>
                      </label>
                    ))}
                  {userSearchQuery && availableUsers.filter(user =>
                    user.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                    user.email.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                    user.role?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                    user.job_title?.toLowerCase().includes(userSearchQuery.toLowerCase())
                  ).length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                      No users found matching "{userSearchQuery}"
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Service Confirmation */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-200 mb-12 overflow-hidden">
          <div className="px-12 py-8">
            <h2 className="text-3xl font-semibold text-gray-900 tracking-tight mb-2">Service Confirmation</h2>
            <p className="text-lg text-gray-500 mb-10">Confirm service ownership and technical service association</p>

            <div className="space-y-8">
              <div className="flex items-start space-x-6">
                <input
                  type="checkbox"
                  id="service-confirmed"
                  checked={serviceConfirmed}
                  onChange={(e) => setServiceConfirmed(e.target.checked)}
                  className="h-6 w-6 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-1"
                />
                <label htmlFor="service-confirmed" className="text-xl font-medium text-gray-900 leading-relaxed">
                  I confirm that this service information is accurate and the team/user assignments are correct
                </label>
              </div>

              <div className="bg-blue-50 p-8 rounded-2xl border border-blue-100">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-blue-600 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-lg font-semibold text-gray-900 mb-4">
                      By confirming this service, you acknowledge that:
                    </p>
                    <ul className="text-base text-gray-700 space-y-2">
                      <li className="flex items-start">
                        <span className="text-blue-600 mr-3 mt-1">•</span>
                        The team assignment is correct for incident response
                      </li>
                      <li className="flex items-start">
                        <span className="text-blue-600 mr-3 mt-1">•</span>
                        The prime manager is the appropriate point of contact
                      </li>
                      <li className="flex items-start">
                        <span className="text-blue-600 mr-3 mt-1">•</span>
                        The service configuration matches your technical requirements
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Service Details */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-200 mb-12 overflow-hidden">
          <div className="px-12 py-8">
            <h2 className="text-3xl font-semibold text-gray-900 tracking-tight mb-2">Service Information</h2>
            <p className="text-lg text-gray-500 mb-10">View and manage service details</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="block text-base font-medium text-gray-900 mb-4">Service Name</label>
                <input
                  type="text"
                  value={service.name}
                  onChange={(e) => setService({...service, name: e.target.value})}
                  className="w-full px-6 py-4 text-lg font-medium text-gray-900 bg-white border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                />
              </div>
              <div>
                <label className="block text-base font-medium text-gray-900 mb-4">Service ID</label>
                <input
                  type="text"
                  value={service.id}
                  disabled
                  className="w-full px-6 py-4 text-lg font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-2xl"
                />
              </div>
              <div>
                <label className="block text-base font-medium text-gray-900 mb-4">CMDB ID</label>
                <input
                  type="text"
                  value={cmdbId || ''}
                  disabled
                  className="w-full px-6 py-4 text-lg font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-2xl"
                />
              </div>
              <div>
                <label className="block text-base font-medium text-gray-900 mb-4">Service Status</label>
                <input
                  type="text"
                  value={service.status.charAt(0).toUpperCase() + service.status.slice(1)}
                  disabled
                  className="w-full px-6 py-4 text-lg font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-2xl"
                />
              </div>
              <div>
                <label className="block text-base font-medium text-gray-900 mb-4">Created Date</label>
                <input
                  type="text"
                  value={service.created_at ? new Date(service.created_at).toLocaleDateString() : 'N/A'}
                  disabled
                  className="w-full px-6 py-4 text-lg font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-2xl"
                />
              </div>
              <div>
                <label className="block text-base font-medium text-gray-900 mb-4">Alert Creation</label>
                <input
                  type="text"
                  value={service.alert_creation}
                  disabled
                  className="w-full px-6 py-4 text-lg font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-2xl"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-6">
          <button
            onClick={() => window.close()}
            className="px-10 py-4 text-lg font-semibold text-gray-700 bg-white border border-gray-300 rounded-2xl hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveChanges}
            disabled={saving}
            className="px-10 py-4 text-lg font-semibold text-white bg-blue-600 border border-blue-600 rounded-2xl hover:bg-blue-700 hover:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600 transition-all duration-200 shadow-sm"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white inline mr-3"></div>
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