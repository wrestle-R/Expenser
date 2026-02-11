// API service for communicating with the Next.js backend
import { ENV } from "../env";
import {
  ITransaction,
  IWorkflow,
  IUserProfile,
  TransactionsResponse,
  WorkflowsResponse,
  ProfileResponse,
} from "./types";

class ApiService {
  private baseUrl: string;
  private token: string | null = null;

  constructor() {
    this.baseUrl = ENV.API_URL;
  }

  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `API Error: ${response.status} ${response.statusText}`
      );
    }

    return response.json();
  }

  // === Transactions ===
  async getTransactions(): Promise<ITransaction[]> {
    const data = await this.request<TransactionsResponse>("/api/transactions");
    return data.transactions;
  }

  async createTransaction(
    transaction: Omit<ITransaction, "_id" | "clerkId" | "createdAt" | "updatedAt">
  ): Promise<ITransaction> {
    const data = await this.request<{ transaction: ITransaction }>(
      "/api/transactions",
      {
        method: "POST",
        body: JSON.stringify(transaction),
      }
    );
    return data.transaction;
  }

  async deleteTransaction(id: string): Promise<void> {
    await this.request(`/api/transactions?id=${id}`, {
      method: "DELETE",
    });
  }

  // === Workflows ===
  async getWorkflows(): Promise<IWorkflow[]> {
    const data = await this.request<WorkflowsResponse>("/api/workflows");
    return data.workflows;
  }

  async createWorkflow(
    workflow: Omit<IWorkflow, "_id" | "userId" | "createdAt" | "updatedAt">
  ): Promise<IWorkflow> {
    const data = await this.request<{ workflow: IWorkflow }>("/api/workflows", {
      method: "POST",
      body: JSON.stringify(workflow),
    });
    return data.workflow;
  }

  async updateWorkflow(
    id: string,
    workflow: Partial<IWorkflow>
  ): Promise<IWorkflow> {
    const data = await this.request<{ workflow: IWorkflow }>(
      `/api/workflows?id=${id}`,
      {
        method: "PUT",
        body: JSON.stringify(workflow),
      }
    );
    return data.workflow;
  }

  async deleteWorkflow(id: string): Promise<void> {
    await this.request(`/api/workflows?id=${id}`, {
      method: "DELETE",
    });
  }

  // === Profile ===
  async getProfile(): Promise<IUserProfile> {
    const data = await this.request<ProfileResponse>("/api/user/profile");
    return data.profile;
  }

  async updateProfile(
    profile: Partial<IUserProfile>
  ): Promise<IUserProfile> {
    const data = await this.request<ProfileResponse>("/api/user/profile", {
      method: "PUT",
      body: JSON.stringify(profile),
    });
    return data.profile;
  }
}

export const api = new ApiService();
