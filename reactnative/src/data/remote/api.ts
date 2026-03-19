// API service for communicating with the Next.js backend
import {ENV} from '../../config/env';
import {
  ITransaction,
  IWorkflow,
  IUserProfile,
  TransactionsResponse,
  WorkflowsResponse,
  ProfileResponse,
  CreateTransactionPayload,
  CreateWorkflowPayload,
} from '../../domain/types';

const REQUEST_TIMEOUT_MS = 10000;

class ApiService {
  private baseUrl: string;
  private token: string | null = null;
  private tokenGetter: (() => Promise<string | null>) | null = null;

  constructor() {
    this.baseUrl = ENV.API_URL;
  }

  setToken(token: string | null) {
    this.token = token;
  }

  setTokenGetter(getter: (() => Promise<string | null>) | null) {
    this.tokenGetter = getter;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    // Always get a fresh token if getter is available
    if (this.tokenGetter) {
      try {
        const freshToken = await this.tokenGetter();
        if (freshToken) {
          headers.Authorization = `Bearer ${freshToken}`;
        }
      } catch (error) {
        console.error('[API] Error getting fresh token:', error);
        if (this.token) {
          headers.Authorization = `Bearer ${this.token}`;
        }
      }
    } else if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    console.log(`[API] ${options.method || 'GET'} ${url}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response: Response;

    try {
      response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        throw new Error(
          'Request timed out. Please check your internet connection.',
        );
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errMsg =
        errorData.error ||
        `API Error: ${response.status} ${response.statusText}`;
      console.error(`[API] Error ${response.status}:`, errMsg, 'URL:', url);
      throw new Error(errMsg);
    }

    return response.json();
  }

  // ═══ Transactions ═══
  async getTransactions(): Promise<ITransaction[]> {
    const data = await this.request<TransactionsResponse>('/api/transactions');
    return data.transactions;
  }

  async createTransaction(
    payload: CreateTransactionPayload,
  ): Promise<ITransaction> {
    console.log('[API] Creating transaction with payload:', payload);
    const data = await this.request<{transaction: ITransaction}>(
      '/api/transactions',
      {method: 'POST', body: JSON.stringify(payload)},
    );
    return data.transaction;
  }

  async updateTransaction(
    id: string,
    payload: Partial<CreateTransactionPayload>,
  ): Promise<ITransaction> {
    console.log('[API] Updating transaction:', {id, payload});
    const data = await this.request<{transaction: ITransaction}>(
      `/api/transactions?id=${id}`,
      {method: 'PUT', body: JSON.stringify(payload)},
    );
    return data.transaction;
  }

  async deleteTransaction(id: string): Promise<void> {
    await this.request(`/api/transactions?id=${id}`, {method: 'DELETE'});
  }

  // ═══ Workflows ═══
  async getWorkflows(): Promise<IWorkflow[]> {
    const data = await this.request<WorkflowsResponse>('/api/workflows');
    return data.workflows;
  }

  async createWorkflow(payload: CreateWorkflowPayload): Promise<IWorkflow> {
    console.log('[API] Creating workflow with payload:', payload);
    const data = await this.request<{workflow: IWorkflow}>('/api/workflows', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return data.workflow;
  }

  async deleteWorkflow(id: string): Promise<void> {
    await this.request(`/api/workflows?id=${id}`, {method: 'DELETE'});
  }

  // ═══ Profile ═══
  async getProfile(): Promise<IUserProfile> {
    const data = await this.request<ProfileResponse>('/api/user/profile');
    return data.profile;
  }

  async updateProfile(profile: Partial<IUserProfile>): Promise<IUserProfile> {
    const data = await this.request<ProfileResponse>('/api/user/profile', {
      method: 'PUT',
      body: JSON.stringify(profile),
    });
    return data.profile;
  }
}

export const api = new ApiService();
