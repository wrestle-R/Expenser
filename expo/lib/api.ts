// API service for communicating with the Next.js backend
import { withRequestDeadline } from "./request-deadline";
import { ENV } from "../env";
import { parseNotificationLocally } from "./local-bank-parser";
import {
  ITransaction,
  IWorkflow,
  IUserProfile,
  TransactionsResponse,
  WorkflowsResponse,
  ProfileResponse,
  CreateTransactionPayload,
  CreateWorkflowPayload,
  IUserCategory,
  BalanceReconciliationAlert,
  ParsedBankNotificationResponse,
  NotificationEnvelope,
} from "./types";

const REQUEST_TIMEOUT_MS = 10000;

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

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
    options: RequestInit = {}
  ): Promise<T> {
    return withRequestDeadline(async (signal) => {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };

    // Always get a fresh token if getter is available
    if (this.tokenGetter) {
      try {
        const freshToken = await this.tokenGetter();
        if (freshToken) {
          headers["Authorization"] = `Bearer ${freshToken}`;
        }
      } catch (error) {
        console.error("[API] Error getting fresh token:", error);
        // Fall back to cached token
        if (this.token) {
          headers["Authorization"] = `Bearer ${this.token}`;
        }
      }
    } else if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    console.log(`[API] ${options.method || "GET"} ${url}`);

    if (signal.aborted) throw new Error("Request timed out before authentication completed.");
    const response = await fetch(url, { ...options, headers, signal });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errMsg = errorData.error || `API Error: ${response.status} ${response.statusText}`;
      console.error(`[API] Error ${response.status}:`, errMsg, "URL:", url);
      throw new ApiError(errMsg, response.status);
    }

    return response.json();
    }, REQUEST_TIMEOUT_MS);
  }

  // === Transactions ===
  async getTransactions(): Promise<ITransaction[]> {
    const transactions = new Map<string, ITransaction>();
    const cursors = new Set<string>();
    let cursor: string | null = null;
    do {
      const data: TransactionsResponse = await this.request<TransactionsResponse>(`/api/transactions?limit=250${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
      for (const transaction of data.transactions) transactions.set(transaction._id, transaction);
      cursor = data.nextCursor ?? null;
      if (cursor && cursors.has(cursor)) throw new Error("The server repeated a history page. Your saved data is unchanged.");
      if (cursor) cursors.add(cursor);
    } while (cursor);
    // Only a complete history is returned to sync; a failed page never replaces the cache.
    return [...transactions.values()];
  }

  async createTransaction(
    payload: CreateTransactionPayload
  ): Promise<ITransaction> {

    const data = await this.request<{ transaction: ITransaction }>(
      "/api/transactions",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
    return data.transaction;
  }

  async getCategories(): Promise<IUserCategory[]> {
    const data = await this.request<{ categories: IUserCategory[] }>("/api/categories");
    return data.categories;
  }

  async saveCategory(payload: {
    type: "income" | "expense";
    name: string;
    color: string;
  }): Promise<IUserCategory> {
    const data = await this.request<{ category: IUserCategory }>("/api/categories", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return data.category;
  }

  async deleteCategory(id: string): Promise<void> {
    await this.request(`/api/categories?id=${id}`, {
      method: "DELETE",
    });
  }

  async getBalanceAlerts(): Promise<BalanceReconciliationAlert[]> {
    const data = await this.request<{ alerts: BalanceReconciliationAlert[] }>(
      "/api/bank-imports/reconcile"
    );
    return data.alerts;
  }

  async resolveBalanceAlert(
    id: string,
    action: "apply" | "keep"
  ): Promise<{
    alert: BalanceReconciliationAlert;
    profile?: IUserProfile | null;
  }> {
    return this.request("/api/bank-imports/reconcile", {
      method: "POST",
      body: JSON.stringify({ id, action }),
    });
  }

  async parseBankNotification(
    envelope: NotificationEnvelope,
    allowCloud = true
  ): Promise<ParsedBankNotificationResponse> {
    const local = parseNotificationLocally(envelope);
    if (local) return local;
    if (!allowCloud) throw new Error("Message saved for cloud parsing when online.");
    return this.request<ParsedBankNotificationResponse>("/api/bank-imports/parse", {
      method: "POST",
      body: JSON.stringify(envelope),
    });
  }

  async deleteTransaction(id: string): Promise<void> {
    await this.request(`/api/transactions?id=${id}`, {
      method: "DELETE",
    });
  }

  async updateTransaction(
    id: string,
    payload: Partial<CreateTransactionPayload>
  ): Promise<ITransaction> {

    const data = await this.request<{ transaction: ITransaction }>(
      `/api/transactions?id=${id}`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      }
    );
    return data.transaction;
  }

  // === Workflows ===
  async getWorkflows(): Promise<IWorkflow[]> {
    const data = await this.request<WorkflowsResponse>("/api/workflows");
    return data.workflows;
  }

  async createWorkflow(
    payload: CreateWorkflowPayload
  ): Promise<IWorkflow> {

    const data = await this.request<{ workflow: IWorkflow }>("/api/workflows", {
      method: "POST",
      body: JSON.stringify(payload),
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
