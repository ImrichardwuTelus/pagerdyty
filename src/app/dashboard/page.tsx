'use client';

import { useState } from 'react';
import { usePagerDutyData } from '@/hooks/usePagerDuty';
import ServicesDashboard from '@/components/ServicesDashboard';
import TeamsDashboard from '@/components/TeamsDashboard';
import UsersDashboard from '@/components/UsersDashboard';
import ProgressMetrics from '@/components/ProgressMetrics';

export default function Dashboard() {
  const { users, teams, services, loading, error, refetch } = usePagerDutyData();
  const [activeTab, setActiveTab] = useState<'overview' | 'services' | 'teams' | 'users'>('overview');

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading PagerDuty data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-50 border border-red-200 rounded-md p-4 max-w-md">
            <h2 className="text-red-800 font-semibold">Error Loading Data</h2>
            <p className="text-red-600 mt-2">{error}</p>
            <button
              onClick={refetch}
              className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', count: null },
    { id: 'services', label: 'Services', count: services?.length },
    { id: 'teams', label: 'Teams', count: teams?.length },
    { id: 'users', label: 'Users', count: users?.length },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <h1 className="text-3xl font-bold text-gray-900">PagerDuty Dashboard</h1>
            <p className="mt-1 text-sm text-gray-500">
              Monitor and manage your PagerDuty services, teams, and users
            </p>
          </div>

          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                  {tab.count !== null && (
                    <span className={`ml-2 py-0.5 px-2 rounded-full text-xs ${
                      activeTab === tab.id ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <ProgressMetrics
            users={users || []}
            teams={teams || []}
            services={services || []}
          />
        )}
        {activeTab === 'services' && <ServicesDashboard services={services || []} teams={teams || []} />}
        {activeTab === 'teams' && <TeamsDashboard teams={teams || []} />}
        {activeTab === 'users' && <UsersDashboard users={users || []} teams={teams || []} />}
      </div>
    </div>
  );
}