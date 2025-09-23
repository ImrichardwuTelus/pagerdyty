'use client';

import { useState, useMemo } from 'react';
import type { Team } from '@/types/pagerduty';

interface TeamsDashboardProps {
  teams: Team[];
}

export default function TeamsDashboard({ teams }: TeamsDashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTeams = useMemo(() => {
    return teams.filter(team =>
      team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      team.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (team.description && team.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [teams, searchQuery]);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Teams Dashboard</h2>

        <div className="max-w-md">
          <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
            Search Teams
          </label>
          <input
            type="text"
            id="search"
            placeholder="Search by name, ID, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTeams.map((team) => (
          <div key={team.id} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  {team.name}
                </h3>
                <p className="text-sm text-gray-500 font-mono">{team.id}</p>
              </div>
            </div>

            {team.description && (
              <div className="mb-4">
                <p className="text-sm text-gray-600">{team.description}</p>
              </div>
            )}

            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-500">
                Team Details
              </div>
              <a
                href={team.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-900 text-sm font-medium"
              >
                View in PagerDuty
              </a>
            </div>
          </div>
        ))}
      </div>

      {filteredTeams.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-500">
            {searchQuery ? 'No teams match the search criteria' : 'No teams found'}
          </div>
        </div>
      )}

      <div className="mt-8 bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Teams Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          <div>
            <div className="text-3xl font-bold text-blue-600">{teams.length}</div>
            <div className="text-sm text-gray-600">Total Teams</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-green-600">
              {teams.filter(team => team.description).length}
            </div>
            <div className="text-sm text-gray-600">Teams with Descriptions</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-purple-600">
              {Math.round((teams.filter(team => team.description).length / teams.length) * 100) || 0}%
            </div>
            <div className="text-sm text-gray-600">Description Completion</div>
          </div>
        </div>
      </div>
    </div>
  );
}