'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { getPagerDutyClient } from '@/lib/pagerduty-client';
import type { Service, Team, User, ExcelServiceRow } from '@/types/pagerduty';
import { updateExcelData, writeExcelFile } from '@/lib/excel-utils';

export default function BatchOnboard() {
  const searchParams = useSearchParams();
  const serviceIds = searchParams.get('ids')?.split(',') || [];

  // State for workflow steps
  const [currentStep, setCurrentStep] = useState<'team' | 'techservice' | 'dynatrace' | 'confirm'>(
    'team'
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Team validation state
  const [availableTeams, setAvailableTeams] = useState<Team[]>([]);
  const [teamFound, setTeamFound] = useState<boolean | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [manualTeamName, setManualTeamName] = useState<string>('');
  const [teamSearchQuery, setTeamSearchQuery] = useState<string>('');

  // Technical service validation state
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [techServiceFound, setTechServiceFound] = useState<boolean | null>(null);
  const [selectedTechService, setSelectedTechService] = useState<string>('');
  const [manualTechServiceName, setManualTechServiceName] = useState<string>('');
  const [serviceSearchQuery, setServiceSearchQuery] = useState<string>('');

  // Dynatrace onboarding state
  const [wantsDynatraceOnboarding, setWantsDynatraceOnboarding] = useState<boolean | null>();
  const [dynatraceServiceName, setDynatraceServiceName] = useState<string>('');

  // Final confirmation state
  const [serviceConfirmed, setServiceConfirmed] = useState<boolean>(false);

  // Data state
  const [selectedServices, setSelectedServices] = useState<ExcelServiceRow[]>([]);

  // Fetch PagerDuty data and selected services
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch PagerDuty API data
        const client = getPagerDutyClient();
        const [teamsData, servicesData] = await Promise.all([
          client.getAllTeams(),
          client.getAllServices(),
        ]);

        setAvailableTeams(teamsData);
        setAllServices(servicesData);

        // Fetch selected services from Excel data
        const response = await fetch('/api/excel');
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            const services = result.data.filter((row: ExcelServiceRow) =>
              serviceIds.includes(row.id)
            );
            setSelectedServices(services);
          }
        }
      } catch (error) {
        console.error('Error setting up batch onboard data:', error);
        setError(error instanceof Error ? error.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    if (serviceIds.length > 0) {
      fetchData();
    } else {
      setError('No services selected for batch onboarding');
      setLoading(false);
    }
  }, []);

  const handleSaveChanges = async () => {
    setSaving(true);
    try {
      // Prepare update data based on workflow selections
      const excelUpdates: any = {
        user_acknowledge: serviceConfirmed ? 'Yes' : 'No',
        integrated_with_pd:
          serviceConfirmed && teamFound !== null && techServiceFound !== null ? 'Yes' : 'No',
      };

      // Team data
      if (teamFound) {
        const selectedTeamData = availableTeams.find(team => team.id === selectedTeam);
        if (selectedTeamData) {
          excelUpdates.pd_team_name = selectedTeamData.name;
        }
      } else {
        excelUpdates.pd_team_name = manualTeamName;
        excelUpdates.team_name_does_not_exist = 'Yes';
      }

      // Technical service data
      if (techServiceFound) {
        const selectedTechServiceData = allServices.find(svc => svc.id === selectedTechService);
        if (selectedTechServiceData) {
          excelUpdates.pd_tech_svc = selectedTechServiceData.name;
          excelUpdates.dt_service_id = selectedTechServiceData.id;
        }
      } else {
        excelUpdates.pd_tech_svc = manualTechServiceName;
        excelUpdates.tech_svc_does_not_exist = 'Yes';
      }

      // Dynatrace onboarding
      if (wantsDynatraceOnboarding) {
        excelUpdates.terraform_onboarding = 'Yes';
        let finalDynatraceServiceName = dynatraceServiceName;
        if (!finalDynatraceServiceName) {
          if (techServiceFound && selectedTechService) {
            const selectedTechServiceData = allServices.find(svc => svc.id === selectedTechService);
            finalDynatraceServiceName = selectedTechServiceData?.name || '';
          } else if (manualTechServiceName) {
            finalDynatraceServiceName = manualTechServiceName;
          }
        }
        excelUpdates.dt_service_name = finalDynatraceServiceName;
      } else {
        excelUpdates.terraform_onboarding = 'No';
      }

      // Update Excel data for all selected services
      const response = await fetch('/api/excel');
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          let currentExcelData: ExcelServiceRow[] = result.data;

          // Apply updates to all selected services
          serviceIds.forEach(serviceId => {
            Object.entries(excelUpdates).forEach(([field, value]) => {
              currentExcelData = updateExcelData(
                currentExcelData,
                serviceId,
                field as keyof ExcelServiceRow,
                value as string
              );
            });
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
            console.log(`Batch onboarded ${serviceIds.length} services successfully`);
            window.location.href = '/';
          }
        }
      }
    } catch (error) {
      console.error('Error updating services:', error);
      setError(error instanceof Error ? error.message : 'Failed to update services');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading batch onboard data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
          <h1 className="mt-4 text-2xl font-semibold text-gray-900 mb-2">
            Error Loading Batch Onboard
          </h1>
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto py-12 px-8">
        {/* Header */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-200 mb-12 overflow-hidden">
          <div className="px-12 py-10">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-semibold text-gray-900 tracking-tight">
                  Batch Onboard Services
                </h1>
                <p className="text-lg text-gray-500 mt-2">Onboarding {serviceIds.length} services</p>
              </div>
            </div>
          </div>
        </div>

        {/* Selected Services Container */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-200 mb-12 overflow-hidden">
          <div className="px-12 py-8">
            <h2 className="text-2xl font-semibold text-gray-900 tracking-tight mb-6">
              Selected Services ({selectedServices.length})
            </h2>
            <div className="bg-gray-50 rounded-2xl p-6 max-h-80 overflow-y-auto border border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedServices.map(service => (
                  <div
                    key={service.id}
                    className="bg-white px-4 py-3 rounded-xl border border-gray-200 shadow-sm"
                  >
                    <div className="font-medium text-gray-900 truncate text-base">
                      {service.mp_service_name || 'Unnamed Service'}
                    </div>
                    <div className="text-sm text-gray-500 truncate mt-1">ID: {service.id}</div>
                    {service.mp_cmdb_id && (
                      <div className="text-sm text-gray-500 truncate">
                        CMDB: {service.mp_cmdb_id}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Step-based Workflow */}
        {currentStep === 'team' && (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-200 mb-12 overflow-hidden">
            <div className="px-12 py-8">
              <h2 className="text-3xl font-semibold text-gray-900 tracking-tight mb-2">
                Step 1: Validate Team Information
              </h2>
              <p className="text-lg text-gray-500 mb-8">
                Select a team from PagerDuty to assign to all selected services
              </p>

              <div className="space-y-8">
                {/* Always show the teams list first */}
                <div className="space-y-6">
                  <div>
                    <label className="block text-base font-medium text-gray-900 mb-4">
                      Available Teams from PagerDuty API ({availableTeams.length} teams available)
                    </label>
                    <input
                      type="text"
                      placeholder="Search teams by name or description..."
                      value={teamSearchQuery}
                      onChange={e => setTeamSearchQuery(e.target.value)}
                      className="w-full px-6 py-3 text-base text-gray-900 bg-white border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                    />
                  </div>

                  <div className="space-y-3 max-h-96 overflow-y-auto bg-gray-50 rounded-2xl p-6 border border-gray-200">
                    {availableTeams
                      .filter(
                        team =>
                          !teamSearchQuery ||
                          team.name.toLowerCase().includes(teamSearchQuery.toLowerCase()) ||
                          team.summary?.toLowerCase().includes(teamSearchQuery.toLowerCase())
                      )
                      .map(team => (
                        <label
                          key={team.id}
                          className={`flex items-center space-x-4 p-4 hover:bg-white rounded-xl border cursor-pointer transition-all duration-200 ${
                            teamFound === true && selectedTeam === team.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200'
                          }`}
                        >
                          <input
                            type="radio"
                            name="selectedTeam"
                            value={team.id}
                            checked={selectedTeam === team.id}
                            onChange={e => {
                              setSelectedTeam(e.target.value);
                              setTeamFound(true);
                            }}
                            className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300"
                          />
                          <div className="flex-1">
                            <div className="text-lg font-medium text-gray-900">{team.name}</div>
                            <div className="text-base text-gray-500">ID: {team.id}</div>
                            {team.summary && (
                              <div className="text-sm text-gray-600">{team.summary}</div>
                            )}
                          </div>
                        </label>
                      ))}
                    {teamSearchQuery &&
                      availableTeams.filter(
                        team =>
                          team.name.toLowerCase().includes(teamSearchQuery.toLowerCase()) ||
                          team.summary?.toLowerCase().includes(teamSearchQuery.toLowerCase())
                      ).length === 0 && (
                        <div className="text-center text-gray-500 py-8">
                          No teams found matching "{teamSearchQuery}"
                        </div>
                      )}
                  </div>
                </div>

                <div className="bg-blue-50 p-6 rounded-2xl border border-blue-200">
                  <h4 className="text-lg font-semibold text-blue-900 mb-4">
                    Can you see the team you want to assign to all services?
                  </h4>
                  <div className="flex space-x-4 mb-6">
                    <button
                      onClick={() => setTeamFound(true)}
                      className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                        teamFound === true
                          ? 'bg-green-600 text-white shadow-md'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Yes, I can see it
                    </button>
                    <button
                      onClick={() => setTeamFound(false)}
                      className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                        teamFound === false
                          ? 'bg-red-600 text-white shadow-md'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      No, I don't see it
                    </button>
                  </div>
                </div>

                {teamFound === false && (
                  <div className="space-y-4">
                    <div className="bg-yellow-50 p-6 rounded-2xl border border-yellow-200">
                      <h4 className="text-lg font-semibold text-yellow-900 mb-4">
                        Manual Team Entry
                      </h4>
                      <p className="text-sm text-yellow-800 mb-4">
                        Enter the team name manually that will be assigned to all selected services.
                      </p>
                      <input
                        type="text"
                        placeholder="Enter team name for all services..."
                        value={manualTeamName}
                        onChange={e => setManualTeamName(e.target.value)}
                        className="w-full px-4 py-3 text-base text-gray-900 bg-white border border-yellow-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all duration-200"
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    onClick={() => setCurrentStep('techservice')}
                    disabled={
                      teamFound === null ||
                      (teamFound === true && !selectedTeam) ||
                      (teamFound === false && !manualTeamName.trim())
                    }
                    className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    Next: Technical Service
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 'techservice' && (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-200 mb-12 overflow-hidden">
            <div className="px-12 py-8">
              <h2 className="text-3xl font-semibold text-gray-900 tracking-tight mb-2">
                Step 2: Validate PagerDuty Technical Service
              </h2>
              <p className="text-lg text-gray-500 mb-8">
                Select a technical service from PagerDuty to assign to all selected services
              </p>

              <div className="space-y-8">
                {/* Always show the services list first */}
                <div className="space-y-6">
                  <div>
                    <label className="block text-base font-medium text-gray-900 mb-4">
                      Available Technical Services from PagerDuty API ({allServices.length} services
                      available)
                    </label>
                    <input
                      type="text"
                      placeholder="Search services by name, ID, or team..."
                      value={serviceSearchQuery}
                      onChange={e => setServiceSearchQuery(e.target.value)}
                      className="w-full px-6 py-3 text-base text-gray-900 bg-white border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                    />
                  </div>

                  <div className="space-y-3 max-h-96 overflow-y-auto bg-gray-50 rounded-2xl p-6 border border-gray-200">
                    {allServices
                      .filter(
                        svc =>
                          !serviceSearchQuery ||
                          svc.name.toLowerCase().includes(serviceSearchQuery.toLowerCase()) ||
                          svc.id.toLowerCase().includes(serviceSearchQuery.toLowerCase()) ||
                          svc.teams?.some(team =>
                            team.summary?.toLowerCase().includes(serviceSearchQuery.toLowerCase())
                          )
                      )
                      .map(svc => (
                        <label
                          key={svc.id}
                          className={`flex items-center space-x-4 p-4 hover:bg-white rounded-xl border cursor-pointer transition-all duration-200 ${
                            techServiceFound === true && selectedTechService === svc.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200'
                          }`}
                        >
                          <input
                            type="radio"
                            name="techService"
                            value={svc.id}
                            checked={selectedTechService === svc.id}
                            onChange={e => {
                              setSelectedTechService(e.target.value);
                              setTechServiceFound(true);
                            }}
                            className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300"
                          />
                          <div className="flex-1">
                            <div className="text-lg font-medium text-gray-900">{svc.name}</div>
                            <div className="text-base text-gray-500">Service ID: {svc.id}</div>
                            <div className="text-sm text-gray-600">
                              Owned Team:{' '}
                              {svc.teams && svc.teams.length > 0
                                ? svc.teams.map(team => team.summary).join(', ')
                                : 'No team assigned'}
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
                    {serviceSearchQuery &&
                      allServices.filter(
                        svc =>
                          svc.name.toLowerCase().includes(serviceSearchQuery.toLowerCase()) ||
                          svc.id.toLowerCase().includes(serviceSearchQuery.toLowerCase()) ||
                          svc.teams?.some(team =>
                            team.summary?.toLowerCase().includes(serviceSearchQuery.toLowerCase())
                          )
                      ).length === 0 && (
                        <div className="text-center text-gray-500 py-8">
                          No services found matching "{serviceSearchQuery}"
                        </div>
                      )}
                  </div>
                </div>

                <div className="bg-blue-50 p-6 rounded-2xl border border-blue-200">
                  <h4 className="text-lg font-semibold text-blue-900 mb-4">
                    Can you see the technical service you want to assign?
                  </h4>
                  <div className="flex space-x-4 mb-6">
                    <button
                      onClick={() => setTechServiceFound(true)}
                      className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                        techServiceFound === true
                          ? 'bg-green-600 text-white shadow-md'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Yes, I can see it
                    </button>
                    <button
                      onClick={() => setTechServiceFound(false)}
                      className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                        techServiceFound === false
                          ? 'bg-red-600 text-white shadow-md'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      No, I don't see it
                    </button>
                  </div>
                </div>

                {techServiceFound === false && (
                  <div className="space-y-4">
                    <div className="bg-yellow-50 p-6 rounded-2xl border border-yellow-200">
                      <h4 className="text-lg font-semibold text-yellow-900 mb-4">
                        Manual Technical Service Entry
                      </h4>
                      <p className="text-sm text-yellow-800 mb-4">
                        Enter the technical service name that will be assigned to all selected
                        services.
                      </p>
                      <input
                        type="text"
                        placeholder="Enter technical service name for all services..."
                        value={manualTechServiceName}
                        onChange={e => setManualTechServiceName(e.target.value)}
                        className="w-full px-4 py-3 text-base text-gray-900 bg-white border border-yellow-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all duration-200"
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-between">
                  <button
                    onClick={() => setCurrentStep('team')}
                    className="px-8 py-3 bg-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-200"
                  >
                    Back: Team
                  </button>
                  <button
                    onClick={() => setCurrentStep('dynatrace')}
                    disabled={
                      techServiceFound === null ||
                      (techServiceFound === true && !selectedTechService) ||
                      (techServiceFound === false && !manualTechServiceName.trim())
                    }
                    className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    Next: Dynatrace
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 'dynatrace' && (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-200 mb-12 overflow-hidden">
            <div className="px-12 py-8">
              <h2 className="text-3xl font-semibold text-gray-900 tracking-tight mb-2">
                Step 3: Dynatrace Onboarding
              </h2>
              <p className="text-lg text-gray-500 mb-8">
                Do you want to onboard all selected services with Dynatrace and PagerDuty?
              </p>

              <div className="space-y-8">
                <div className="bg-blue-50 p-6 rounded-2xl border border-blue-200">
                  <h4 className="text-lg font-semibold text-blue-900 mb-4">
                    Do you want to integrate all selected services with Dynatrace?
                  </h4>
                  <p className="text-sm text-blue-800 mb-6">
                    This will apply Dynatrace monitoring integration to all{' '}
                    {selectedServices.length} selected services.
                  </p>
                  <div className="flex space-x-4">
                    <button
                      onClick={() => setWantsDynatraceOnboarding(true)}
                      className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                        wantsDynatraceOnboarding === true
                          ? 'bg-green-600 text-white shadow-md'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Yes, integrate all with Dynatrace
                    </button>
                    <button
                      onClick={() => setWantsDynatraceOnboarding(false)}
                      className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                        wantsDynatraceOnboarding === false
                          ? 'bg-gray-600 text-white shadow-md'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      No, skip Dynatrace integration
                    </button>
                  </div>
                </div>

                {wantsDynatraceOnboarding === true && (
                  <div className="bg-green-50 p-6 rounded-2xl border border-green-200">
                    <h4 className="text-lg font-semibold text-green-900 mb-4">
                      Dynatrace Service Configuration
                    </h4>
                    <p className="text-sm text-green-800 mb-4">
                      Dynatrace integration will be enabled for all {selectedServices.length}{' '}
                      selected services using your selected PagerDuty service information.
                    </p>
                  </div>
                )}

                <div className="flex justify-between">
                  <button
                    onClick={() => setCurrentStep('techservice')}
                    className="px-8 py-3 bg-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-200"
                  >
                    Back: Technical Service
                  </button>
                  <button
                    onClick={() => setCurrentStep('confirm')}
                    disabled={wantsDynatraceOnboarding === null}
                    className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    Next: Confirm
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 'confirm' && (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-200 mb-12 overflow-hidden">
            <div className="px-12 py-8">
              <h2 className="text-3xl font-semibold text-gray-900 tracking-tight mb-2">
                Step 4: Final Confirmation
              </h2>
              <p className="text-lg text-gray-500 mb-8">
                Review your selections and confirm. Changes will be applied to all{' '}
                {selectedServices.length} selected services.
              </p>

              <div className="space-y-8">
                <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200">
                  <h4 className="text-lg font-semibold text-gray-900 mb-6">
                    Summary of Batch Onboarding
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 mb-2">Team Information</h5>
                      <div className="bg-white p-4 rounded-lg border border-gray-200">
                        {teamFound ? (
                          <div>
                            <div className="text-base font-medium text-gray-900">
                              {availableTeams.find(t => t.id === selectedTeam)?.name ||
                                'Selected Team'}
                            </div>
                            <div className="text-sm text-gray-500">Found in PagerDuty API</div>
                          </div>
                        ) : (
                          <div>
                            <div className="text-base font-medium text-gray-900">
                              {manualTeamName}
                            </div>
                            <div className="text-sm text-red-600">
                              Manually entered - will be flagged for review
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <h5 className="text-sm font-medium text-gray-700 mb-2">Technical Service</h5>
                      <div className="bg-white p-4 rounded-lg border border-gray-200">
                        {techServiceFound ? (
                          <div>
                            <div className="text-base font-medium text-gray-900">
                              {allServices.find(s => s.id === selectedTechService)?.name ||
                                'Selected Service'}
                            </div>
                            <div className="text-sm text-gray-500">Found in PagerDuty API</div>
                          </div>
                        ) : (
                          <div>
                            <div className="text-base font-medium text-gray-900">
                              {manualTechServiceName}
                            </div>
                            <div className="text-sm text-red-600">
                              Manually entered - will be flagged for review
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <h5 className="text-sm font-medium text-gray-700 mb-2">
                        Dynatrace Integration
                      </h5>
                      <div className="bg-white p-4 rounded-lg border border-gray-200">
                        {wantsDynatraceOnboarding ? (
                          <div>
                            <div className="text-base font-medium text-green-700">Enabled</div>
                            <div className="text-sm text-gray-500">
                              Will be applied to all {selectedServices.length} services
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="text-base font-medium text-gray-700">Disabled</div>
                            <div className="text-sm text-gray-500">No Dynatrace integration</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 p-8 rounded-2xl border border-blue-100">
                  <div className="flex items-start space-x-6">
                    <input
                      type="checkbox"
                      id="service-confirmed"
                      checked={serviceConfirmed}
                      onChange={e => setServiceConfirmed(e.target.checked)}
                      className="h-6 w-6 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-1"
                    />
                    <div>
                      <label
                        htmlFor="service-confirmed"
                        className="text-xl font-medium text-gray-900 leading-relaxed block mb-4"
                      >
                        I confirm that all changes should be applied to all{' '}
                        {selectedServices.length} selected services
                      </label>
                      <ul className="text-base text-gray-700 space-y-2">
                        <li className="flex items-start">
                          <span className="text-blue-600 mr-3 mt-1">•</span>
                          Team assignments will be applied to all selected services
                        </li>
                        <li className="flex items-start">
                          <span className="text-blue-600 mr-3 mt-1">•</span>
                          Technical service information will be assigned to all services
                        </li>
                        <li className="flex items-start">
                          <span className="text-blue-600 mr-3 mt-1">•</span>
                          Dynatrace integration settings will be applied consistently
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between">
                  <button
                    onClick={() => setCurrentStep('dynatrace')}
                    className="px-8 py-3 bg-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-200"
                  >
                    Back: Dynatrace
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end space-x-6">
          <button
            onClick={() => (window.location.href = '/')}
            className="px-10 py-4 text-lg font-semibold text-gray-700 bg-white border border-gray-300 rounded-2xl hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
          >
            Cancel
          </button>
          {currentStep === 'confirm' && (
            <button
              onClick={handleSaveChanges}
              disabled={saving || !serviceConfirmed}
              className="px-10 py-4 text-lg font-semibold text-white bg-blue-600 border border-blue-600 rounded-2xl hover:bg-blue-700 hover:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600 transition-all duration-200 shadow-sm"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white inline mr-3"></div>
                  Saving...
                </>
              ) : (
                'Onboard All Services'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
