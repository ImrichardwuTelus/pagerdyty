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
  const [serviceSearchQuery, setServiceSearchQuery] = useState<string>('');
  const [selectedTechService, setSelectedTechService] = useState<string>('');
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [populateTeamName, setPopulateTeamName] = useState<boolean>(false);
  const [populateTechSvc, setPopulateTechSvc] = useState<boolean>(false);
  const [serviceScenario, setServiceScenario] = useState<string>('');
  const [currentExcelRow, setCurrentExcelRow] = useState<ExcelServiceRow | null>(null);

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
          const [teamsData, usersData, servicesData] = await Promise.all([
            client.getAllTeams(),
            client.getAllUsers(),
            client.getAllServices()
          ]);

          setAllServices(servicesData);

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
            const matchingService = servicesData.find(service =>
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

            // Find users who are on the same teams as this service for prime manager detection
            const serviceTeamIds = serviceData.teams?.map(team => team.id) || [];
            const serviceUsers = usersData.filter(user =>
              user.teams?.some(userTeam => serviceTeamIds.includes(userTeam.id))
            );

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

  // Fetch Excel row data to populate existing values
  useEffect(() => {
    const fetchExcelRowData = async () => {
      if (!rowId) return;

      try {
        const response = await fetch('/api/excel');
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            const currentRow = result.data.find((row: ExcelServiceRow) => row.id === rowId);
            if (currentRow) {
              setCurrentExcelRow(currentRow);

              // Set confirmation checkbox based on Excel data
              setServiceConfirmed(currentRow.confirmed?.toLowerCase() === 'yes');

              // Pre-select tech service if it exists
              if (currentRow['service id']) {
                setSelectedTechService(currentRow['service id']);
                setServiceScenario('existing');
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch Excel row data:', error);
      }
    };

    fetchExcelRowData();
  }, [rowId]);

  const handleSaveChanges = async () => {
    if (!service) return;


    setSaving(true);
    try {
      // Prepare data for API call
      const selectedTeamData = availableTeams.find(team => team.id === selectedTeam);
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
          // Get selected tech service data
          const selectedTechServiceData = allServices.find(svc => svc.id === selectedTechService);

          // Post message to parent window to update Excel data
          const updateData = {
            type: 'UPDATE_EXCEL_ROW',
            rowId: rowId,
            updates: {
              // Only update team_name if the option is selected and we have a selected team
              ...(populateTeamName && selectedTeamData?.name ? { team_name: selectedTeamData.name } : {}),
              // Only update prime_manager if we have a selected manager
              ...(primeManagerData?.name ? { prime_manager: primeManagerData.name } : {}),
              confirmed: serviceConfirmed ? 'Yes' : 'No',
              enrichment_status: 'PagerDuty Integrated',
              // Tech service fields - only update if user selected existing or dynatrace scenario
              ...(selectedTechServiceData && (serviceScenario === 'existing' || serviceScenario === 'dynatrace') ? {
                'tech-svc': selectedTechServiceData.name,
                'service id': selectedTechServiceData.id,
                ...(serviceScenario === 'dynatrace' ? { 'dynatrace_integration': 'Planned' } : {}),
              } : {}),
              // owned_team field: prioritize tech service team, fallback to PagerDuty Teams selection if populateTechSvc is checked
              ...(selectedTechServiceData?.teams && selectedTechServiceData.teams.length > 0 && (serviceScenario === 'existing' || serviceScenario === 'dynatrace')
                ? { owned_team: selectedTechServiceData.teams[0].summary }
                : populateTechSvc && selectedTeamData?.name
                ? { owned_team: selectedTeamData.name }
                : {}),
            }
          };

          // No need to send message to parent window since we're redirecting in same tab

          // Write updates directly to Excel file via API
          try {
            // First read the current Excel data
            const response = await fetch('/api/excel');
            if (response.ok) {
              const result = await response.json();
              if (result.success) {
                let currentExcelData: ExcelServiceRow[] = result.data;

                // Update all the fields
                Object.entries(updateData.updates).forEach(([field, value]) => {
                  currentExcelData = updateExcelData(currentExcelData, rowId, field as keyof ExcelServiceRow, value);
                });

                // Write the updated data back to Excel file
                const writeResponse = await fetch('/api/excel', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ data: currentExcelData }),
                });

                if (writeResponse.ok) {
                  const writeResult = await writeResponse.json();
                  if (writeResult.success) {
                    console.log('Excel data updated successfully - changes will be reflected in dashboard');
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
          } catch (apiError) {
            console.error('Failed to update Excel data via API:', apiError);
          }
        } catch (excelError) {
          console.error('Failed to update Excel data:', excelError);
        }
      }

      // Show success message with actual data
      const selectedTechServiceData = allServices.find(svc => svc.id === selectedTechService);

      let scenarioText = '';
      switch(serviceScenario) {
        case 'existing':
          scenarioText = 'Existing technical service associated';
          break;
        case 'dynatrace':
          scenarioText = 'Service prepared for Dynatrace integration';
          break;
        case 'none':
          scenarioText = 'No technical service changes made';
          break;
        default:
          scenarioText = 'No scenario selected';
      }

      const successMessage = `Service data ${isRealService ? 'updated' : 'prepared for update'} successfully!

Changes Applied:
- Scenario: ${scenarioText}
- Team Name: ${populateTeamName && selectedTeamData?.name ? selectedTeamData.name : 'Not selected for update'}
- Tech-Svc: ${(serviceScenario === 'existing' || serviceScenario === 'dynatrace') && selectedTechServiceData?.name ? selectedTechServiceData.name : 'Not updated'}
- Owned Team: ${selectedTechServiceData?.teams && selectedTechServiceData.teams.length > 0 && (serviceScenario === 'existing' || serviceScenario === 'dynatrace') ? selectedTechServiceData.teams[0].summary : populateTechSvc && selectedTeamData?.name ? selectedTeamData.name : 'Not updated'}
- Prime Manager: ${primeManagerData?.name || 'None'}
- Service ID: ${(serviceScenario === 'existing' || serviceScenario === 'dynatrace') && selectedTechServiceData?.id || 'None'}
- Dynatrace Integration: ${serviceScenario === 'dynatrace' ? 'Planned' : 'Not applicable'}
- Confirmed: ${serviceConfirmed ? 'Yes' : 'No'}
- CMDB ID: ${cmdbId || 'N/A'}
${rowId ? '- Excel data updated based on selected scenario and options' : ''}`;

      // Show success message and redirect
      console.log(successMessage);

      // Redirect back to the dashboard after successful save
      window.location.href = '/';
    } catch (error) {
      console.error('Error updating service:', error);
      setError(error instanceof Error ? error.message : 'Failed to update service');
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
            </div>
          </div>
        </div>

        {/* Current Excel Data */}
        {currentExcelRow && (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-200 mb-12 overflow-hidden">
            <div className="px-12 py-8">
              <h2 className="text-3xl font-semibold text-gray-900 tracking-tight mb-2">Current Data</h2>
              <p className="text-lg text-gray-500 mb-6">Existing information from your Excel data</p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-blue-50 p-6 rounded-2xl border border-blue-200">
                  <h3 className="text-lg font-semibold text-blue-900 mb-2">Team Name</h3>
                  <p className="text-base text-blue-800">
                    {currentExcelRow.team_name || "there isn't any"}
                  </p>
                </div>

                <div className="bg-green-50 p-6 rounded-2xl border border-green-200">
                  <h3 className="text-lg font-semibold text-green-900 mb-2">Prime Manager</h3>
                  <p className="text-base text-green-800">
                    {currentExcelRow.prime_manager || "there isn't any"}
                  </p>
                </div>

                <div className="bg-purple-50 p-6 rounded-2xl border border-purple-200">
                  <h3 className="text-lg font-semibold text-purple-900 mb-2">Tech-Svc</h3>
                  <p className="text-base text-purple-800">
                    {currentExcelRow['tech-svc'] || currentExcelRow.owned_team || "there isn't any"}
                  </p>
                </div>

                <div className="bg-orange-50 p-6 rounded-2xl border border-orange-200">
                  <h3 className="text-lg font-semibold text-orange-900 mb-2">Service ID</h3>
                  <p className="text-base text-orange-800">
                    {currentExcelRow['service id'] || "there isn't any"}
                  </p>
                </div>

                <div className="bg-yellow-50 p-6 rounded-2xl border border-yellow-200">
                  <h3 className="text-lg font-semibold text-yellow-900 mb-2">Confirmation Status</h3>
                  <p className="text-base text-yellow-800">
                    {currentExcelRow.confirmed || "there isn't any"}
                  </p>
                </div>

                <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-200">
                  <h3 className="text-lg font-semibold text-indigo-900 mb-2">Enrichment Status</h3>
                  <p className="text-base text-indigo-800">
                    {currentExcelRow.enrichment_status || "there isn't any"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PagerDuty Teams */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-200 mb-12 overflow-hidden">
          <div className="px-12 py-8">
            <h2 className="text-3xl font-semibold text-gray-900 tracking-tight mb-2">PagerDuty Teams</h2>
            <p className="text-lg text-gray-500 mb-6">Browse and filter teams from PagerDuty API</p>

            {/* Population Options */}
            <div className="bg-blue-50 p-6 rounded-2xl border border-blue-200 mb-8">
              <h3 className="text-lg font-semibold text-blue-900 mb-4">Data Population Options</h3>
              <p className="text-sm text-blue-700 mb-4">Choose which fields to select with the selected team data:</p>
              <div className="flex flex-wrap gap-6">
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={populateTeamName}
                    onChange={(e) => setPopulateTeamName(e.target.checked)}
                    className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-base font-medium text-blue-900">Select Team Name</span>
                </label>
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={populateTechSvc}
                    onChange={(e) => setPopulateTechSvc(e.target.checked)}
                    className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-base font-medium text-blue-900">Select Tech-Svc</span>
                </label>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-base font-medium text-gray-900 mb-4">
                  Filter Teams ({availableTeams.length} teams available)
                </label>
                <input
                  type="text"
                  placeholder="Search teams by name or description..."
                  value={teamSearchQuery}
                  onChange={(e) => setTeamSearchQuery(e.target.value)}
                  className="w-full px-6 py-3 text-base text-gray-900 bg-white border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                />
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto bg-gray-50 rounded-2xl p-6 border border-gray-200">
                {availableTeams
                  .filter(team =>
                    !teamSearchQuery ||
                    team.name.toLowerCase().includes(teamSearchQuery.toLowerCase()) ||
                    team.summary?.toLowerCase().includes(teamSearchQuery.toLowerCase())
                  )
                  .map((team) => (
                    <label key={team.id} className="flex items-center space-x-4 p-4 hover:bg-white rounded-xl border border-gray-200 cursor-pointer transition-all duration-200">
                      <input
                        type="radio"
                        name="selectedTeam"
                        value={team.id}
                        checked={selectedTeam === team.id}
                        onChange={(e) => setSelectedTeam(e.target.value)}
                        className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <div className="flex-1">
                        <div className="text-lg font-medium text-gray-900">{team.name}</div>
                        <div className="text-base text-gray-500">ID: {team.id}</div>
                        {team.summary && <div className="text-sm text-gray-600">{team.summary}</div>}
                      </div>
                    </label>
                  ))}
                {teamSearchQuery && availableTeams.filter(team =>
                  team.name.toLowerCase().includes(teamSearchQuery.toLowerCase()) ||
                  team.summary?.toLowerCase().includes(teamSearchQuery.toLowerCase())
                ).length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    No teams found matching "{teamSearchQuery}"
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* PagerDuty Users */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-200 mb-12 overflow-hidden">
          <div className="px-12 py-8">
            <h2 className="text-3xl font-semibold text-gray-900 tracking-tight mb-2">PagerDuty Users</h2>
            <p className="text-lg text-gray-500 mb-10">Browse and filter users from PagerDuty API to select Prime Manager</p>

            <div className="space-y-6">
              <div>
                <label className="block text-base font-medium text-gray-900 mb-4">
                  Filter Users ({availableUsers.length} users available)
                </label>
                <input
                  type="text"
                  placeholder="Search users by name, email, role, or job title..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="w-full px-6 py-3 text-base text-gray-900 bg-white border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                />
              </div>

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
                        type="radio"
                        name="primeManager"
                        value={user.id}
                        checked={primeManager === user.id}
                        onChange={(e) => setPrimeManager(e.target.value)}
                        className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <div className="flex-1">
                        <div className="text-lg font-medium text-gray-900">{user.name}</div>
                        <div className="text-base text-gray-500">
                          {user.email} • {user.job_title || user.role}
                        </div>
                        <div className="text-sm text-gray-600">ID: {user.id}</div>
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


        {/* PagerDuty Services */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-200 mb-12 overflow-hidden">
          <div className="px-12 py-8">
            <h2 className="text-3xl font-semibold text-gray-900 tracking-tight mb-2">PagerDuty Services</h2>
            <p className="text-lg text-gray-500 mb-8">Choose your technical service scenario and integrate with Dynatrace if needed</p>

            {/* Scenario Selection */}
            <div className="bg-blue-50 p-8 rounded-2xl border border-blue-200 mb-8">
              <h3 className="text-xl font-semibold text-blue-900 mb-6">What describes your situation?</h3>
              <p className="text-sm text-blue-700 mb-6">Choose the scenario that best matches your technical service needs:</p>

              <div className="space-y-4">
                <label className="flex items-start space-x-4 p-4 bg-white rounded-xl border border-blue-200 cursor-pointer hover:bg-blue-25 transition-all duration-200">
                  <input
                    type="radio"
                    name="serviceScenario"
                    value="existing"
                    checked={serviceScenario === 'existing'}
                    onChange={(e) => setServiceScenario(e.target.value)}
                    className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 mt-1"
                  />
                  <div className="flex-1">
                    <div className="text-lg font-semibold text-blue-900">I already have a technical service</div>
                    <div className="text-sm text-blue-700 mt-1">
                      You have an existing PagerDuty technical service that you want to associate with this service entry.
                      We'll capture the service ID, name, and team information.
                    </div>
                  </div>
                </label>

                <label className="flex items-start space-x-4 p-4 bg-white rounded-xl border border-blue-200 cursor-pointer hover:bg-blue-25 transition-all duration-200">
                  <input
                    type="radio"
                    name="serviceScenario"
                    value="dynatrace"
                    checked={serviceScenario === 'dynatrace'}
                    onChange={(e) => setServiceScenario(e.target.value)}
                    className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 mt-1"
                  />
                  <div className="flex-1">
                    <div className="text-lg font-semibold text-blue-900">I want to integrate with Dynatrace</div>
                    <div className="text-sm text-blue-700 mt-1">
                      You want to select a technical service and integrate it with Dynatrace for monitoring.
                      We'll map the service and prepare it for Dynatrace integration.
                    </div>
                  </div>
                </label>

                <label className="flex items-start space-x-4 p-4 bg-white rounded-xl border border-blue-200 cursor-pointer hover:bg-blue-25 transition-all duration-200">
                  <input
                    type="radio"
                    name="serviceScenario"
                    value="none"
                    checked={serviceScenario === 'none'}
                    onChange={(e) => setServiceScenario(e.target.value)}
                    className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 mt-1"
                  />
                  <div className="flex-1">
                    <div className="text-lg font-semibold text-blue-900">I don't need technical service changes</div>
                    <div className="text-sm text-blue-700 mt-1">
                      You don't want to make any changes to technical service associations at this time.
                      You can skip this section and proceed with team and user assignments only.
                    </div>
                  </div>
                </label>
              </div>

              {/* Guidance Questions */}
              {!serviceScenario && (
                <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                  <h4 className="text-lg font-semibold text-yellow-900 mb-3">Not sure which option to choose?</h4>
                  <div className="text-sm text-yellow-800 space-y-2">
                    <p><strong>Ask yourself:</strong></p>
                    <ul className="list-disc list-inside space-y-1 ml-4">
                      <li>Do you already have a PagerDuty service set up for this application?</li>
                      <li>Do you want to connect this service to Dynatrace for monitoring?</li>
                      <li>Do you need to capture service ID and team information for reporting?</li>
                      <li>Are you just setting up team assignments without technical service changes?</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>

            {/* Service Selection - Only show if user selected existing or dynatrace scenario */}
            {(serviceScenario === 'existing' || serviceScenario === 'dynatrace') && (
              <div className="space-y-6">
                <div>
                  <label className="block text-base font-medium text-gray-900 mb-4">
                    {serviceScenario === 'existing'
                      ? `Select Your Existing Technical Service (${allServices.length} services available)`
                      : `Select Service for Dynatrace Integration (${allServices.length} services available)`
                    }
                  </label>
                  <input
                    type="text"
                    placeholder="Search services by name, ID, or team..."
                    value={serviceSearchQuery}
                    onChange={(e) => setServiceSearchQuery(e.target.value)}
                    className="w-full px-6 py-3 text-base text-gray-900 bg-white border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                  />
                </div>

              <div className="space-y-3 max-h-96 overflow-y-auto bg-gray-50 rounded-2xl p-6 border border-gray-200">
                {allServices
                  .filter(svc =>
                    !serviceSearchQuery ||
                    svc.name.toLowerCase().includes(serviceSearchQuery.toLowerCase()) ||
                    svc.id.toLowerCase().includes(serviceSearchQuery.toLowerCase()) ||
                    svc.teams?.some(team => team.summary?.toLowerCase().includes(serviceSearchQuery.toLowerCase()))
                  )
                  .map((svc) => (
                    <label key={svc.id} className="flex items-center space-x-4 p-4 hover:bg-white rounded-xl border border-gray-200 cursor-pointer transition-all duration-200">
                      <input
                        type="radio"
                        name="techService"
                        value={svc.id}
                        checked={selectedTechService === svc.id}
                        onChange={(e) => setSelectedTechService(e.target.value)}
                        className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <div className="flex-1">
                        <div className="text-lg font-medium text-gray-900">{svc.name}</div>
                        <div className="text-base text-gray-500">Service ID: {svc.id}</div>
                        <div className="text-sm text-gray-600">
                          Owned Team: {svc.teams && svc.teams.length > 0 ? svc.teams[0].summary : 'No team assigned'}
                        </div>
                        {svc.summary && svc.summary !== svc.name && (
                          <div className="text-sm text-gray-600">Summary: {svc.summary}</div>
                        )}
                        <div className="text-xs text-gray-500">
                          Status: {svc.status} | Alert Creation: {svc.alert_creation}
                        </div>
                      </div>
                    </label>
                  ))}
                {serviceSearchQuery && allServices.filter(svc =>
                  svc.name.toLowerCase().includes(serviceSearchQuery.toLowerCase()) ||
                  svc.id.toLowerCase().includes(serviceSearchQuery.toLowerCase()) ||
                  svc.teams?.some(team => team.summary?.toLowerCase().includes(serviceSearchQuery.toLowerCase()))
                ).length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    No services found matching "{serviceSearchQuery}"
                  </div>
                )}
              </div>

              {selectedTechService && (
                <div className="bg-blue-50 p-6 rounded-2xl border border-blue-200">
                  <h4 className="text-lg font-semibold text-blue-900 mb-4">Selected Tech Service</h4>
                  {(() => {
                    const selectedService = allServices.find(svc => svc.id === selectedTechService);
                    if (!selectedService) return null;
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-blue-900 mb-2">Tech-SVC</label>
                          <div className="text-base font-medium text-blue-800">{selectedService.name}</div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-blue-900 mb-2">Service ID</label>
                          <div className="text-base font-medium text-blue-800">{selectedService.id}</div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-blue-900 mb-2">Owned Team</label>
                          <div className="text-base font-medium text-blue-800">
                            {selectedService.teams && selectedService.teams.length > 0 ? selectedService.teams[0].summary : 'No team assigned'}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
              </div>
            )}

            {/* No Service Changes Message */}
            {serviceScenario === 'none' && (
              <div className="bg-green-50 p-6 rounded-2xl border border-green-200">
                <div className="flex items-center">
                  <svg className="h-6 w-6 text-green-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <div>
                    <h4 className="text-lg font-semibold text-green-900">No Technical Service Changes</h4>
                    <p className="text-sm text-green-700 mt-1">
                      You've chosen to skip technical service changes. Your team and user assignments will be saved without modifying technical service associations.
                    </p>
                  </div>
                </div>
              </div>
            )}
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

        {/* Actions */}
        <div className="flex justify-end space-x-6">
          <button
            onClick={() => window.location.href = '/'}
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