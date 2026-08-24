/**
 * Tradeflow — API Client
 *
 * Centralized Axios instance and API helper functions.
 * All backend calls go through here.
 *
 * Auth flow:
 *   - Request interceptor attaches `Authorization: Bearer <token>` if a token
 *     is present in localStorage.
 *   - Response interceptor: on 401 (excluding the auth endpoints themselves),
 *     it clears the token and dispatches a `tradeflow:auth-expired` event so
 *     AuthContext can route the user to /login without circular imports.
 */

import axios from "axios";
import { getToken, clearToken } from "./lib/auth";

const api = axios.create({
  baseURL: "/api",
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers || {};
    if (!config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    const url = err?.config?.url || "";
    const isAuthRoute = url.startsWith("/auth/login") || url.startsWith("/auth/signup");
    if (status === 401 && !isAuthRoute) {
      clearToken();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("tradeflow:auth-expired"));
      }
    }
    return Promise.reject(err);
  },
);

/** FastAPI errors: `{ detail: string }` or validation `{ detail: [...] }` */
export function formatApiError(err, fallback = "Request failed") {
  if (err?.code === "ECONNABORTED" || String(err?.message || "").toLowerCase().includes("timeout")) {
    return "Request timed out. Start the backend on port 8000 (cd backend && uvicorn main:app --reload), then reload this page.";
  }
  if (err?.code === "ERR_NETWORK" || err?.message === "Network Error") {
    return "Cannot reach the API. Is uvicorn running at http://127.0.0.1:8000? The Vite dev server proxies /api to that address.";
  }
  const detail = err.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const parts = detail.map((item) =>
      item && typeof item === "object" && "msg" in item ? item.msg : String(item)
    );
    if (parts.length) return parts.join("; ");
  }
  if (detail != null && typeof detail === "object") return JSON.stringify(detail);
  return err.message || fallback;
}

// ── Auth (app-level) ──

export async function signup({ email, password, display_name }) {
  const { data } = await api.post("/auth/signup", { email, password, display_name });
  return data;
}

export async function login({ email, password }) {
  const { data } = await api.post("/auth/login", { email, password });
  return data;
}

export async function getMe() {
  const { data } = await api.get("/auth/me");
  return data;
}

export async function changePassword({ old_password, new_password }) {
  const { data } = await api.post("/auth/change-password", { old_password, new_password });
  return data;
}

// ── Analysis ──

export async function getAnalysis() {
  const { data } = await api.get("/analysis");
  return data;
}

export async function runAnalysis() {
  const { data } = await api.post("/analysis/run");
  return data;
}

export async function getAnalysisHistory(days = 30) {
  const { data } = await api.get(`/analysis/history?days=${days}`);
  return data;
}

export async function getAnalysisHistoryCandles(days = 5) {
  const { data } = await api.get(`/analysis/history-candles?days=${days}`);
  return data;
}

// ── Market data (NSE) ──

export async function getOptionChain(symbol = "NIFTY") {
  const { data } = await api.get(`/option-chain?symbol=${symbol}`);
  return data;
}

export async function getNiftyChart() {
  const { data } = await api.get("/nifty-chart");
  return data;
}

export async function getOptionCandles(identifier, intervalSeconds = 300) {
  const params = new URLSearchParams({
    identifier,
    interval_seconds: String(intervalSeconds),
  });
  const { data } = await api.get(`/option-candles?${params.toString()}`);
  return data;
}

// ── Paper Trades ──

export async function createTrade(trade) {
  const { data } = await api.post("/trades", trade);
  return data;
}

export async function closeTrade(tradeId, exitPrice, exitReason) {
  const { data } = await api.post(`/trades/${tradeId}/close`, {
    exit_price: exitPrice,
    exit_reason: exitReason,
  });
  return data;
}

export async function getOpenTrades() {
  const { data } = await api.get("/trades/open");
  return data;
}

export async function getTradeHistory(limit = 50, offset = 0) {
  const { data } = await api.get(`/trades/history?limit=${limit}&offset=${offset}`);
  return data;
}

export async function updateTradeThesis(tradeId, thesis) {
  const { data } = await api.patch(`/trades/${tradeId}/thesis`, { thesis });
  return data;
}

// ── Reports & Stats ──

export async function generateReport(tradeId) {
  const { data } = await api.post(`/trades/${tradeId}/report`, null, {
    timeout: 300000, // 5 minutes timeout specifically for local LLM generation
  });
  return data;
}

export async function getStats() {
  const { data } = await api.get("/stats");
  return data;
}

// ── Quests ──

export async function getQuest() {
  const { data } = await api.get("/quests/today");
  return data;
}

export async function updateQuest(updateData) {
  const { data } = await api.post("/quests/today", updateData);
  return data;
}

export async function submitQuizAnswer(questionId, answer) {
  const { data } = await api.post("/quests/today/answer", {
    question_id: questionId,
    answer,
  });
  return data;
}

export async function getRecentQuests(limit = 5) {
  const { data } = await api.get(`/quests/recent?limit=${limit}`);
  return data;
}

// ── Settings ──

export async function getSettings() {
  const { data } = await api.get("/settings");
  return data;
}

export async function getSettingsStatus() {
  const { data } = await api.get("/settings/status");
  return data;
}

export async function updateSettings(patch) {
  const { data } = await api.put("/settings", patch);
  return data;
}

export async function getLLMStatus() {
  const { data } = await api.get("/settings/llm/status");
  return data;
}

export async function testLLM() {
  const { data } = await api.post("/settings/llm/test", null, {
    timeout: 120000, // LLM test can be slow on CPU
  });
  return data;
}

// ── Notifications ──

export async function getNotifications({ limit = 20, before_id = null, unread_only = false, type_category = null } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (before_id) params.append("before_id", String(before_id));
  if (unread_only) params.append("unread_only", "true");
  if (type_category) params.append("type_category", type_category);
  const { data } = await api.get(`/notifications?${params.toString()}`);
  return data;
}

export async function getNotification(id) {
  const { data } = await api.get(`/notifications/${id}`);
  return data;
}

export async function createNotification({ type, title, message, details = null }) {
  const { data } = await api.post("/notifications", { type, title, message, details });
  return data;
}

export async function markNotificationsRead({ ids = null, mark_all = false }) {
  const { data } = await api.post("/notifications/mark-read", { ids, mark_all });
  return data;
}

export async function clearReadNotifications() {
  const { data } = await api.delete("/notifications/clear");
  return data;
}

export default api;

