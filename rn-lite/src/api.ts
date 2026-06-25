import { CONFIG } from "./config";
import type {
  BalanceReconciliationAlert,
  Transaction,
  TransactionPayload,
  UserCategory,
  UserProfile,
} from "./types";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export class ApiClient {
  private tokenGetter: (() => Promise<string | null>) | null = null;

  setTokenGetter(getter: (() => Promise<string | null>) | null) {
    this.tokenGetter = getter;
  }

  private async request<T>(endpoint: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((init.headers as Record<string, string>) || {}),
    };
    const token = this.tokenGetter ? await this.tokenGetter() : null;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${CONFIG.apiUrl}${endpoint}`, {
      ...init,
      headers,
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new ApiError(body.error || `Request failed: ${response.status}`, response.status);
    }
    return response.json();
  }

  async getProfile() {
    const data = await this.request<{ profile: UserProfile }>("/api/user/profile");
    return data.profile;
  }

  async getTransactions() {
    const data = await this.request<{ transactions: Transaction[] }>("/api/transactions");
    return data.transactions;
  }

  async createTransaction(payload: TransactionPayload) {
    const data = await this.request<{ transaction: Transaction }>("/api/transactions", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return data.transaction;
  }

  async updateTransaction(id: string, payload: Partial<TransactionPayload>) {
    const data = await this.request<{ transaction: Transaction }>(`/api/transactions?id=${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return data.transaction;
  }

  async deleteTransaction(id: string) {
    await this.request(`/api/transactions?id=${id}`, { method: "DELETE" });
  }

  async getCategories() {
    const data = await this.request<{ categories: UserCategory[] }>("/api/categories");
    return data.categories;
  }

  async saveCategory(payload: { type: "income" | "expense"; name: string; color: string }) {
    const data = await this.request<{ category: UserCategory }>("/api/categories", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return data.category;
  }

  async getBalanceAlerts() {
    const data = await this.request<{ alerts: BalanceReconciliationAlert[] }>(
      "/api/bank-imports/reconcile"
    );
    return data.alerts;
  }

  async resolveBalanceAlert(id: string, action: "apply" | "keep") {
    return this.request<{ alert: BalanceReconciliationAlert; profile?: UserProfile | null }>(
      "/api/bank-imports/reconcile",
      {
        method: "POST",
        body: JSON.stringify({ id, action }),
      }
    );
  }
}

export const api = new ApiClient();
