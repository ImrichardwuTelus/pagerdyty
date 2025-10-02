export interface Team {
  id: string;
  type: string;
  summary: string;
  self: string;
  html_url: string;
  name: string;
  description: string;
}

export interface User {
  id: string;
  type: string;
  summary: string;
  self: string;
  html_url: string;
  name: string;
  email: string;
  role: string;
}

export interface Service {
  id: string;
  type: string;
  summary: string;
  self: string;
  html_url: string;
  name: string;
  status: string;
  teams: Team[];
}

export interface PagerDutyApiResponse<T> {
  limit: number;
  offset: number;
  more: boolean;
  total: number | null;
}

export interface UsersResponse extends PagerDutyApiResponse<User> {
  users: User[];
}

export interface TeamsResponse extends PagerDutyApiResponse<Team> {
  teams: Team[];
}

export interface ServicesResponse extends PagerDutyApiResponse<Service> {
  services: Service[];
}

export interface PagerDutyConfig {
  apiToken: string;
  baseUrl?: string;
}

export interface ExcelServiceRow {
  id: string;
  mp_service_name?: string;
  dt_service_name?: string;
  mp_cmdb_id?: string;
  pd_tech_svc?: string;
  prime_manager?: string;
  prime_director?: string;
  prime_vp?: string;
  mse?: string;
  next_hop_process_group?: string;
  next_hop_endpoint?: string;
  analysis_status?: string;
  next_hop_service_code?: string;
  pd_team_name?: string;
  integrated_with_pd?: string;
  user_acknowledge?: string;
  dt_service_id?: string;
  terraform_onboarding?: string;
  team_name_does_not_exist?: string;
  tech_svc_does_not_exist?: string;
  update_team_name?: string;
  update_tech_svc?: string;
  internal_status?: string;
  completion: number;
  lastUpdated?: string;
}
