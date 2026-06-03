import type {
  AiReceiptHistory,
  AiReceiptHistoryDetail,
  AiUsageSummary,
  AppSettings,
  AuthSession,
  Budget,
  Category1,
  Category2,
  DashboardLayoutItem,
  Income,
  Invoice,
  ReceiptFlatRow,
  ReceiptForm,
  RecurringExpense,
  ReceiptSearchCondition,
  SalaryCategory
} from "./types";

type RuntimeFrontendConfig = {
  apiBaseUrl?: string;
  apiKey?: string;
  VITE_API_BASE_URL?: string;
  VITE_API_KEY?: string;
};

declare global {
  interface Window {
    __KAKEIBO_CONFIG__?: RuntimeFrontendConfig;
  }
}

function runtimeConfig(): RuntimeFrontendConfig {
  if (typeof window === "undefined") return {};
  return window.__KAKEIBO_CONFIG__ || {};
}

function normalizeApiBaseUrl(value: string | undefined): string {
  return (value || "").replace(/\/+$/, "");
}

const RUNTIME_CONFIG = runtimeConfig();
const API_BASE_URL = normalizeApiBaseUrl(
  RUNTIME_CONFIG.apiBaseUrl ||
    RUNTIME_CONFIG.VITE_API_BASE_URL ||
    import.meta.env?.VITE_API_BASE_URL ||
    ""
);
const APP_API_KEY =
  RUNTIME_CONFIG.apiKey ||
  RUNTIME_CONFIG.VITE_API_KEY ||
  import.meta.env?.VITE_API_KEY ||
  "";
const TOKEN_KEY = "kakeibo.auth.token";
const SESSION_KEY = "kakeibo.auth.session";
const SESSION_COOKIE_KEY = "kakeibo_auth_session";
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 90;
const MAX_AUTH_HEADER_TOKEN_LENGTH = 6000;

export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

// 本番APIが別ドメインの場合だけVITE_API_BASE_URLで上書きする。
// API Gateway/Lambdaを直接公開する場合の簡易APIキー。
// JWTはログアウトするまで同じ端末に保持する。
// 画面表示用のユーザー情報もJWTとは別に保存する。

type ApiEnvelope<T> = {
  statusCode?: number;
  body?: T | string | null;
  errorMessage?: string;
  detail?: string;
  error?: string;
  message?: string;
};

/**
 * 既存APIのbody値を必要に応じてJSONとして展開する。
 *
 * Args:
 *   value: APIレスポンスbody、またはすでに展開済みの値。
 *
 * Returns:
 *   T | null: 展開後の値。空の場合はnull。
 */
function parseMaybeJson<T>(value: T | string | null | undefined): T | null {
  // 旧APIはbodyをJSON文字列で返すことがあるため、必要な時だけ展開する。
  if (typeof value !== "string") return value ?? null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return value as T;
  }
}

/**
 * 保存済みJWTからAPI送信用の認証ヘッダーを作る。
 *
 * Returns:
 *   Record<string, string>: Authorizationヘッダー。未ログイン時は空オブジェクト。
 */
function authHeaders(): Record<string, string> {
  // すべての業務APIへ保存済みJWTを自動で付ける。
  const session = getStoredSession();
  const token = localStorage.getItem(TOKEN_KEY) || session?.token || "";
  const headers: Record<string, string> = {};
  if (token && token.length <= MAX_AUTH_HEADER_TOKEN_LENGTH) {
    headers.Authorization = `Bearer ${token}`;
  }
  const userId = session?.userId || userIdFromJwt(token);
  if (userId) {
    headers["x-kakeibo-user-id"] = userId;
  }
  if (APP_API_KEY) headers["x-api-key"] = APP_API_KEY;
  return headers;
}

function userIdFromJwt(token: string): string {
  try {
    const payload = token.split(".")[1];
    if (!payload) return "";
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
    const bytes = Uint8Array.from(atob(padded), char => char.charCodeAt(0));
    const decoded = JSON.parse(new TextDecoder().decode(bytes)) as { sub?: string; userId?: string };
    return decoded.sub || decoded.userId || "";
  } catch {
    return "";
  }
}

/**
 * fetchを共通レスポンス形式に合わせて実行する。
 *
 * Args:
 *   path: APIパス。
 *   init: fetchへ渡す追加設定。
 *
 * Returns:
 *   Promise<T>: 画面側で扱う型付きレスポンス。
 */
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error("API接続先が設定されていません。config.js または frontend-config.json を確認してください。");
  }
  // fetchの低レベル差異を吸収し、画面側は型付きの値だけ受け取る。
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  Object.entries(authHeaders()).forEach(([key, value]) => headers.set(key, value));

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: "omit",
      mode: "cors",
      ...init,
      headers
    });
  } catch (error) {
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    throw new Error(`APIに接続できませんでした。通信環境、CORS、API URLを確認してください。対象: ${path} / 詳細: ${detail}`);
  }
  const payload = await response.json().catch(() => null) as ApiEnvelope<T> | T | null;
  const envelope = payload && typeof payload === "object" && "statusCode" in payload ? payload as ApiEnvelope<T> : null;
  // FastAPIのHTTPステータスと既存APIのstatusCodeの両方を見る。
  const statusCode = Number(envelope?.statusCode || response.status || 200);
  const body = envelope ? parseMaybeJson<T>(envelope.body) : payload as T;

  if (!response.ok || statusCode >= 400) {
    const errorBody = body && typeof body === "object" ? body as Record<string, unknown> : {};
    const message =
      String(errorBody.errorMessage || errorBody.error || envelope?.errorMessage || envelope?.detail || envelope?.error || envelope?.message || "APIエラーが発生しました。");
    throw new Error(`${message}（${statusCode} / ${path}）`);
  }

  return (body ?? ({} as T)) as T;
}

/**
 * POSTリクエストをJSON本文つきで送信する。
 *
 * Args:
 *   path: APIパス。
 *   body: JSON化して送信する本文。
 *
 * Returns:
 *   Promise<T>: APIレスポンス。
 */
function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

/**
 * PUTリクエストをJSON本文つきで送信する。
 *
 * Args:
 *   path: APIパス。
 *   body: JSON化して送信する本文。
 *
 * Returns:
 *   Promise<T>: APIレスポンス。
 */
function put<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: "PUT",
    body: JSON.stringify(body)
  });
}

/**
 * GETリクエストを送信する。
 *
 * Args:
 *   path: APIパス。
 *
 * Returns:
 *   Promise<T>: APIレスポンス。
 */
function get<T>(path: string): Promise<T> {
  return request<T>(path);
}

function remove<T>(path: string): Promise<T> {
  return request<T>(path, { method: "DELETE" });
}

function readSessionCookie(): AuthSession | null {
  if (typeof document === "undefined") return null;
  const prefix = `${SESSION_COOKIE_KEY}=`;
  const raw = document.cookie
    .split("; ")
    .find(part => part.startsWith(prefix))
    ?.slice(prefix.length);
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw)) as AuthSession;
  } catch {
    return null;
  }
}

function writeSessionCookie(session: AuthSession): void {
  if (typeof document === "undefined") return;
  const cookieSession = {
    userId: session.userId,
    username: session.username,
    email: session.email,
    nickname: session.nickname,
    token: session.token
  };
  const value = encodeURIComponent(JSON.stringify(cookieSession));
  document.cookie = `${SESSION_COOKIE_KEY}=${value}; Max-Age=${SESSION_COOKIE_MAX_AGE}; Path=/; SameSite=Lax`;
}

function clearSessionCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${SESSION_COOKIE_KEY}=; Max-Age=0; Path=/; SameSite=Lax`;
}

/**
 * localStorageから保存済みログインセッションを取得する。
 *
 * Returns:
 *   AuthSession | null: 保存済みセッション。壊れている場合はnull。
 */
export function getStoredSession(): AuthSession | null {
  // localStorageが壊れている場合は未ログインとして扱う。
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) {
    const cookieSession = readSessionCookie();
    if (cookieSession?.token) {
      localStorage.setItem(TOKEN_KEY, cookieSession.token);
      localStorage.setItem(SESSION_KEY, JSON.stringify(cookieSession));
      return cookieSession;
    }
    return null;
  }
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    const cookieSession = readSessionCookie();
    if (cookieSession?.token) {
      localStorage.setItem(TOKEN_KEY, cookieSession.token);
      localStorage.setItem(SESSION_KEY, JSON.stringify(cookieSession));
      return cookieSession;
    }
    return null;
  }
}

/**
 * ログインセッションをlocalStorageへ保存、または削除する。
 *
 * Args:
 *   session: 保存するセッション。nullの場合はログアウトとして削除する。
 */
export function storeSession(session: AuthSession | null): void {
  // nullは明示ログアウトなので、保存済み情報を完全に消す。
  if (!session) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(SESSION_KEY);
    clearSessionCookie();
    return;
  }
  localStorage.setItem(TOKEN_KEY, session.token);
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  writeSessionCookie(session);
}

/**
 * 画面で使うAPIを機能ごとにまとめた薄いクライアント。
 *
 * 各メソッドはrequest/post/put/getを通して、認証ヘッダーとレスポンス変換を共通化する。
 */
export const api = {
  // 画面で使うAPIを機能ごとにまとめる薄いクライアント。
  auth: {
    login: (email: string, password: string) => post<AuthSession>("/user/login", { email, password }),
    register: (email: string, password: string) =>
      post<AuthSession>("/user/register", { email, password }),
    requestPasswordReset: (email: string) =>
      post<{ ok: boolean; message?: string; resetToken?: string; expiresInMinutes?: number }>(
        "/user/password-reset/request",
        { email }
      ),
    resetPassword: (email: string, resetToken: string, newPassword: string) =>
      post<{ ok: boolean; message?: string }>("/user/password-reset/confirm", { email, resetToken, newPassword }),
    me: (token: string) => post<AuthSession | null>("/user/me", { token }),
    updateProfile: (profile: { userId: string; nickname: string; avatarImage?: string }) =>
      post<AuthSession>("/user/profile", { ...profile, token: getStoredSession()?.token || "" }),
    logout: () => post<{ ok: boolean }>("/user/logout", {})
  },
  settings: {
    get: () => get<AppSettings | null>("/app/settings"),
    save: (settings: AppSettings) => post<{ ok: boolean }>("/app/settings", settings)
  },
  dashboard: {
    getLayout: () => get<DashboardLayoutItem[] | null>("/dashboard/layout"),
    saveLayout: (layout: DashboardLayoutItem[]) => post<{ ok: boolean }>("/dashboard/layout", { layout })
  },
  master: {
    category1: () => get<Category1[]>("/receipt/getcategory1"),
    category2: () => get<Category2[]>("/receipt/getcategory2"),
    salaryCategories: () => get<SalaryCategory[]>("/receipt/getsalarycategory"),
    addCategory1: (category1Name: string) => post("/receipt/addcategory1", { category1Name }),
    deleteCategory1: (category1Name: string) => put("/receipt/deletecategory1", { category1Name }),
    addCategory2: (category1Name: string, category2Name: string, taxRate: number) =>
      post("/receipt/addcategory2", { category1Name, category2Name, taxRate }),
    deleteCategory2: (category1Name: string, category2Name: string) =>
      put("/receipt/deletecategory2", { category1Name, category2Name }),
    addSalaryCategory: (salaryCategoryName: string) => post("/receipt/addsalarycategory", { salaryCategoryName }),
    addDefaultCategories: (payload: {
      category1: string[];
      category2: Array<{ category1Name: string; category2Name: string; taxRate: number }>;
      salaryCategories: string[];
    }) => post("/receipt/adddefaultcategories", payload),
    deleteSalaryCategory: (salaryCategoryName: string) => put("/receipt/deletesalarycategory", { salaryCategoryName }),
    supplierByInvoice: (invoiceNo: string) => get<Array<{ supplierName: string; supplierLogo?: string; taxFlag?: string | number }>>(
      `/receipt/getSupplierByInvoice?invoiceNo=${encodeURIComponent(invoiceNo)}`
    ),
    invoices: () => get<Invoice[]>("/receipt/getinvoice"),
    updateInvoice: (invoice: Invoice) => post<Invoice[]>("/receipt/updateinvoice", invoice),
    deleteInvoice: (invoiceRegistrationNumber: string) => put("/receipt/deleteinvoice", { invoiceRegistrationNumber })
  },
  receipt: {
    create: (receiptInfo: ReceiptForm) => post<{ message: string; receiptId: string }>(
      "/receipt/newReceiptRegistration",
      { receiptInfo: { ...receiptInfo, receiptDetailCount: receiptInfo.receiptDetails.length } }
    ),
    search: (condition: ReceiptSearchCondition) => post<{ receiptDetails: ReceiptFlatRow[] }>(
      "/receipt/receiptReference",
      condition
    ),
    prepareExport: (type: "excel" | "pdf", rows: ReceiptFlatRow[]) => post<{ url: string }>(
      "/export/receipt/prepare",
      { type, rows }
    ),
    update: (receiptInfo: ReceiptForm) => put<{ message: string }>(
      "/receipt/ReceiptUpdateDelete",
      { updateDeleteType: "update", receiptInfo: { ...receiptInfo, receiptDetailCount: receiptInfo.receiptDetails.length } }
    ),
    remove: (receiptId: string) => put<{ message: string }>("/receipt/ReceiptUpdateDelete", { updateDeleteType: "delete", receiptId })
  },
  recurring: {
    list: () => get<RecurringExpense[]>("/recurring-expenses"),
    create: (rule: RecurringExpense) => post<{ ok: boolean; message?: string }>("/recurring-expenses", rule),
    update: (rule: RecurringExpense) => put<{ ok: boolean; message?: string }>(`/recurring-expenses/${rule.id}`, rule),
    remove: (id: number) => remove<{ ok: boolean; message?: string }>(`/recurring-expenses/${id}`),
    runDue: () => post<{ ok: boolean; createdCount: number; created?: Array<{ id: number; receiptId: string }> }>("/recurring-expenses/run-due", {})
  },
  income: {
    list: (month: string) => get<Income[]>(`/receipt/getincome?month=${encodeURIComponent(month)}`),
    create: (salaryInfo: Income) => post("/receipt/salaryregistration", { salaryInfo }),
    update: (income: Income) => put("/receipt/updateincome", income),
    remove: (id: number) => put("/receipt/deleteincome", { id })
  },
  budget: {
    list: () => get<Budget[]>("/budget/budgets"),
    save: (budgets: Budget[]) => post<{ ok: boolean }>("/budget/budgets", { budgets })
  },
  ai: {
    usage: () => get<AiUsageSummary>("/ai/receipt/usage"),
    analyze: (body: Record<string, unknown>) => post<Record<string, unknown>>("/ai/receipt/analyze", body),
    history: () => get<AiReceiptHistory[]>("/ai/receipt/history"),
    historyDetail: (analysisId: string) => get<AiReceiptHistoryDetail>(`/ai/receipt/history/${encodeURIComponent(analysisId)}`),
    saveFinal: (analysisId: string, receiptInfo: ReceiptForm, receiptId?: string) =>
      post<{ ok: boolean; receiptId?: string }>("/ai/receipt/history/final", { analysisId, receiptInfo, receiptId })
  }
};
