'use client';

import type { User, Team, Service } from '@/types/pagerduty';

interface ProgressMetricsProps {
  users: User[];
  teams: Team[];
  services: Service[];
}

export default function ProgressMetrics({ users, teams, services }: ProgressMetricsProps) {
  const servicesWithTeams = services.filter(service => service.teams && service.teams.length > 0);
  const servicesWithTeamNames = services.filter(service =>
    service.teams && service.teams.length > 0 && service.teams.some(team => team.name)
  );

  const usersWithTeams = users.filter(user => user.teams && user.teams.length > 0);
  const usersWithJobTitles = users.filter(user => user.job_title);

  const metrics = [
    {
      title: 'Services Onboarded',
      value: services.length,
      total: services.length,
      percentage: 100,
      description: 'Total services in PagerDuty',
      color: 'blue'
    },
    {
      title: 'Services with Teams',
      value: servicesWithTeams.length,
      total: services.length,
      percentage: services.length > 0 ? Math.round((servicesWithTeams.length / services.length) * 100) : 0,
      description: 'Services assigned to teams',
      color: 'green'
    },
    {
      title: 'Services with Team Names',
      value: servicesWithTeamNames.length,
      total: services.length,
      percentage: services.length > 0 ? Math.round((servicesWithTeamNames.length / services.length) * 100) : 0,
      description: 'Services with defined team names',
      color: 'purple'
    },
    {
      title: 'Users with Teams',
      value: usersWithTeams.length,
      total: users.length,
      percentage: users.length > 0 ? Math.round((usersWithTeams.length / users.length) * 100) : 0,
      description: 'Users assigned to teams',
      color: 'yellow'
    },
    {
      title: 'Users with Job Titles',
      value: usersWithJobTitles.length,
      total: users.length,
      percentage: users.length > 0 ? Math.round((usersWithJobTitles.length / users.length) * 100) : 0,
      description: 'Users with defined job titles',
      color: 'indigo'
    },
    {
      title: 'Teams Created',
      value: teams.length,
      total: teams.length,
      percentage: 100,
      description: 'Total teams in PagerDuty',
      color: 'red'
    }
  ];

  const getColorClasses = (color: string) => {
    const colors = {
      blue: 'bg-blue-500',
      green: 'bg-green-500',
      purple: 'bg-purple-500',
      yellow: 'bg-yellow-500',
      indigo: 'bg-indigo-500',
      red: 'bg-red-500'
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Progress Overview</h2>
        <p className="text-gray-600">
          Track the completion status of your PagerDuty service onboarding and team assignments
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {metrics.map((metric, index) => (
          <div key={index} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{metric.title}</h3>
              <span className="text-sm font-medium text-gray-500">
                {metric.value}/{metric.total}
              </span>
            </div>

            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-3xl font-bold text-gray-900">{metric.percentage}%</span>
              </div>

              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${getColorClasses(metric.color)}`}
                  style={{ width: `${metric.percentage}%` }}
                ></div>
              </div>
            </div>

            <p className="text-sm text-gray-600">{metric.description}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Summary Report</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">{services.length}</div>
            <div className="text-sm text-gray-600">Total Services</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">{teams.length}</div>
            <div className="text-sm text-gray-600">Total Teams</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600">{users.length}</div>
            <div className="text-sm text-gray-600">Total Users</div>
          </div>
        </div>
      </div>
    </div>
  );
}