import { UsersResponse, TeamsResponse, ServicesResponse, PagerDutyConfig } from '@/types/pagerduty';

const DEFAULT_BASE_URL = 'https://api.pagerduty.com';

export class PagerDutyAPI {
  private apiToken: string;
  private baseUrl: string;

  constructor(config: PagerDutyConfig) {
    this.apiToken = config.apiToken;
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Token token=${this.apiToken}`,
        Accept: 'application/vnd.pagerduty+json;version=2',
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`PagerDuty API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getUsers(params?: {
    limit?: number;
    offset?: number;
    include?: string[];
    query?: string;
  }): Promise<UsersResponse> {
    const searchParams = new URLSearchParams();

    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.offset) searchParams.append('offset', params.offset.toString());
    if (params?.include?.length) searchParams.append('include[]', params.include.join(','));
    if (params?.query) searchParams.append('query', params.query);

    const queryString = searchParams.toString();
    const endpoint = `/users${queryString ? `?${queryString}` : ''}`;

    return this.request<UsersResponse>(endpoint);
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

    const queryString = searchParams.toString();
    const endpoint = `/teams${queryString ? `?${queryString}` : ''}`;

    return this.request<TeamsResponse>(endpoint);
  }

  async getServices(params?: {
    limit?: number;
    offset?: number;
    include?: string[];
    query?: string;
    team_ids?: string[];
    sort_by?: 'name' | 'created_at';
  }): Promise<ServicesResponse> {
    const searchParams = new URLSearchParams();

    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.offset) searchParams.append('offset', params.offset.toString());
    if (params?.include?.length) searchParams.append('include[]', params.include.join(','));
    if (params?.query) searchParams.append('query', params.query);
    if (params?.team_ids?.length) {
      params.team_ids.forEach(id => searchParams.append('team_ids[]', id));
    }
    if (params?.sort_by) searchParams.append('sort_by', params.sort_by);

    const queryString = searchParams.toString();
    const endpoint = `/services${queryString ? `?${queryString}` : ''}`;

    return this.request<ServicesResponse>(endpoint);
  }

  async getAllUsers(): Promise<UsersResponse['users']> {
    const allUsers = [];
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

  async getAllTeams(): Promise<TeamsResponse['teams']> {
    const allTeams = [];
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

  async getAllServices(): Promise<ServicesResponse['services']> {
    const allServices = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const response = await this.getServices({ limit, offset });
      allServices.push(...response.services);
      hasMore = response.more;
      offset += limit;
    }

    return allServices;
  }
}

let pagerDutyAPI: PagerDutyAPI | null = null;

export function getPagerDutyAPI(): PagerDutyAPI {
  if (!pagerDutyAPI) {
    const apiToken = process.env.NEXT_PUBLIC_PAGERDUTY_API_TOKEN;
    if (!apiToken) {
      throw new Error('NEXT_PUBLIC_PAGERDUTY_API_TOKEN environment variable is required');
    }
    pagerDutyAPI = new PagerDutyAPI({ apiToken });
  }
  return pagerDutyAPI;
}
