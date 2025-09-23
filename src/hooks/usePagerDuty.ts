'use client';

import { useState, useEffect, useCallback } from 'react';
import type { User, Team, Service } from '@/types/pagerduty';
import { getPagerDutyClient } from '@/lib/pagerduty-client';

interface UseDataState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function usePagerDutyUsers(): UseDataState<User[]> {
  const [data, setData] = useState<User[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const client = getPagerDutyClient();
      const users = await client.getAllUsers();
      setData(users);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return { data, loading, error, refetch: fetchUsers };
}

export function usePagerDutyTeams(): UseDataState<Team[]> {
  const [data, setData] = useState<Team[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTeams = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const client = getPagerDutyClient();
      const teams = await client.getAllTeams();
      setData(teams);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch teams');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  return { data, loading, error, refetch: fetchTeams };
}

export function usePagerDutyServices(): UseDataState<Service[]> {
  const [data, setData] = useState<Service[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchServices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const client = getPagerDutyClient();
      const services = await client.getAllServices();
      setData(services);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch services');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  return { data, loading, error, refetch: fetchServices };
}

export function usePagerDutyData() {
  const users = usePagerDutyUsers();
  const teams = usePagerDutyTeams();
  const services = usePagerDutyServices();

  const loading = users.loading || teams.loading || services.loading;
  const error = users.error || teams.error || services.error;

  const refetch = useCallback(async () => {
    await Promise.all([
      users.refetch(),
      teams.refetch(),
      services.refetch()
    ]);
  }, [users.refetch, teams.refetch, services.refetch]);

  return {
    users: users.data,
    teams: teams.data,
    services: services.data,
    loading,
    error,
    refetch
  };
}