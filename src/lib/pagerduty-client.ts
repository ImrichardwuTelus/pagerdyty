import type {
  PagerDutyConfig,
  UsersResponse,
  TeamsResponse,
  ServicesResponse,
  User,
  Team,
  Service
} from '@/types/pagerduty';

export class PagerDutyClient {
  private apiToken: string;
  private baseUrl: string;

  constructor(config: PagerDutyConfig) {
    this.apiToken = config.apiToken;
    this.baseUrl = config.baseUrl || 'https://api.pagerduty.com';
  }

  private async makeRequest<T>(endpoint: string, params?: URLSearchParams): Promise<T> {
    const url = new URL(endpoint, this.baseUrl);
    if (params) {
      url.search = params.toString();
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Token token=${this.apiToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`PagerDuty API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getUsers(params?: {
    limit?: number;
    offset?: number;
    include?: string[];
    query?: string;
    team_ids?: string[];
  }): Promise<UsersResponse> {
    const searchParams = new URLSearchParams();

    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.offset) searchParams.append('offset', params.offset.toString());
    if (params?.include) searchParams.append('include[]', params.include.join(','));
    if (params?.query) searchParams.append('query', params.query);
    if (params?.team_ids) {
      params.team_ids.forEach(id => searchParams.append('team_ids[]', id));
    }

    return this.makeRequest<UsersResponse>('/users', searchParams);
  }

  async getTeams(params?: {
    limit?: number;
    offset?: number;
    query?: string;
  }): Promise<TeamsResponse> {
    const searchParams = new URLSearchParams();

    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.offset) searchParams.append('offset', params.offset.toString());
    if (params?.query) searchParams.append('query', params.query);

    return this.makeRequest<TeamsResponse>('/teams', searchParams);
  }

  async getServices(params?: {
    limit?: number;
    offset?: number;
    include?: string[];
    query?: string;
    team_ids?: string[];
    time_zone?: string;
    sort_by?: string;
  }): Promise<ServicesResponse> {
    const searchParams = new URLSearchParams();

    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.offset) searchParams.append('offset', params.offset.toString());
    if (params?.include) searchParams.append('include[]', params.include.join(','));
    if (params?.query) searchParams.append('query', params.query);
    if (params?.team_ids) {
      params.team_ids.forEach(id => searchParams.append('team_ids[]', id));
    }
    if (params?.time_zone) searchParams.append('time_zone', params.time_zone);
    if (params?.sort_by) searchParams.append('sort_by', params.sort_by);

    return this.makeRequest<ServicesResponse>('/services', searchParams);
  }

  async getServicesWithDetails(): Promise<Service[]> {
    const searchParams = new URLSearchParams();
    searchParams.append('include[]', 'teams,escalation_policies');

    return this.getAllServicesWithParams(searchParams);
  }

  private async getAllServicesWithParams(searchParams: URLSearchParams): Promise<Service[]> {
    const allServices: Service[] = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const params = new URLSearchParams(searchParams);
      params.append('limit', limit.toString());
      params.append('offset', offset.toString());

      const response = await this.makeRequest<ServicesResponse>('/services', params);
      allServices.push(...response.services);
      hasMore = response.more;
      offset += limit;
    }

    return allServices;
  }

  async getAllUsers(): Promise<User[]> {
    const allUsers: User[] = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const response = await this.getUsers({ limit, offset });
      allUsers.push(...response.users);
      hasMore = response.more;
      offset += limit;
    }

    return allUsers;
  }

  async getAllTeams(): Promise<Team[]> {
    const allTeams: Team[] = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const response = await this.getTeams({ limit, offset });
      allTeams.push(...response.teams);
      hasMore = response.more;
      offset += limit;
    }

    return allTeams;
  }

  async getAllServices(): Promise<Service[]> {
    return this.getServicesWithDetails();
  }

}

let pagerDutyClient: PagerDutyClient | null = null;

export function getPagerDutyClient(): PagerDutyClient {
  if (!pagerDutyClient) {
    const apiToken = process.env.NEXT_PUBLIC_PAGERDUTY_API_TOKEN;
    if (!apiToken) {
      throw new Error('NEXT_PUBLIC_PAGERDUTY_API_TOKEN environment variable is required');
    }

    pagerDutyClient = new PagerDutyClient({ apiToken });
  }

  return pagerDutyClient;
}