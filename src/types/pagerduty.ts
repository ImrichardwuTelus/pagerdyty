export interface PagerDutyReference {
  id: string;
  type: string;
  summary: string;
  self: string;
  html_url: string;
}

export interface ContactMethod {
  id: string;
  type: string;
  summary: string;
  self: string;
}

export interface NotificationRule {
  id: string;
  type: string;
  summary: string;
  self: string;
  html_url: string | null;
}

export interface Team extends PagerDutyReference {
  name: string;
  description: string;
}

export interface User extends PagerDutyReference {
  name: string;
  email: string;
  time_zone: string;
  color: string;
  role: string;
  avatar_url: string;
  description: string;
  invitation_sent: boolean;
  created_via_sso: boolean;
  contact_methods: ContactMethod[];
  notification_rules: NotificationRule[];
  job_title: string;
  teams: Team[];
}

export interface Integration extends PagerDutyReference {
  // Additional integration properties can be added here
}

export interface EscalationPolicy extends PagerDutyReference {
  // Additional escalation policy properties can be added here
}

export interface IncidentUrgencyRule {
  type: string;
  during_support_hours?: {
    type: string;
    urgency: string;
  };
  outside_support_hours?: {
    type: string;
    urgency: string;
  };
}

export interface SupportHours {
  type: string;
  time_zone: string;
  start_time: string;
  end_time: string;
  days_of_week: number[];
}

export interface ScheduledAction {
  type: string;
  at: {
    type: string;
    name: string;
  };
  to_urgency: string;
}

export interface AutoPauseNotificationsParameters {
  enabled: boolean;
  timeout: number;
}

export interface AlertGroupingParameters {
  type: string;
}

export interface Service extends PagerDutyReference {
  name: string;
  auto_resolve_timeout: number;
  acknowledgement_timeout: number;
  created_at: string;
  status: string;
  alert_creation: string;
  alert_grouping_parameters: AlertGroupingParameters;
  integrations: Integration[];
  escalation_policy: EscalationPolicy;
  teams: Team[];
  incident_urgency_rule: IncidentUrgencyRule;
  support_hours?: SupportHours;
  scheduled_actions?: ScheduledAction[];
  auto_pause_notifications_parameters?: AutoPauseNotificationsParameters;
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

export interface ExcelServiceData {
  service_name_mp?: string;
  service_path?: string;
  cmdb_id?: string;
  api_name?: string;
  prime_manager?: string;
  prime_director?: string;
  prime_vp?: string;
  mse?: string;
  dyna_service_name?: string;
  next_hop_process_group?: string;
  analysis_status?: string;
  next_hop_service_code?: string;
  enrichment_status?: string;
  team_name?: string;
  confirmed?: string;
  owned_team?: string;
  service_id?: string;
}

export interface ExcelServiceRow extends ExcelServiceData {
  id: string;
  completion: number;
  lastUpdated?: string;
}