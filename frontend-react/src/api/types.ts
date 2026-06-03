export type TaxFlag = "0" | "1";

// 支出大分類マスタ。
export type Category1 = {
  category1Name: string;
};

// 支出小分類マスタ。taxRateは税込/税抜計算で使う。
export type Category2 = {
  category1Name: string;
  category2Name: string;
  taxRate: number;
};

// 入金分類マスタ。
export type SalaryCategory = {
  id?: number;
  salaryCategoryName: string;
};

// レシート明細1行。
export type ReceiptItem = {
  itemName: string;
  category1: string;
  category2: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  discount?: number;
  taxRate?: number;
  totalPrice: number;
};

// レシート登録/更新フォーム全体。
export type ReceiptForm = {
  receiptId?: string;
  invoiceRegistrationNumber: string;
  supplierName: string;
  supplierImage?: string | null;
  receiptDate: string;
  receiptTime: string;
  taxFlag: TaxFlag;
  totalPrice: number;
  receiptDetails: ReceiptItem[];
};

// API検索結果のフラットな明細行。
export type ReceiptFlatRow = {
  invoiceRegistrationNumber: string;
  receiptId: string;
  supplierName: string;
  supplierImage?: string;
  supplierLogo?: string;
  img?: string;
  supplier_image?: string;
  receiptDate: string;
  receiptTime: string;
  taxFlag: TaxFlag | number | string;
  itemName: string;
  category1: string;
  category2: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

// レシート検索APIへ送る条件。
export type ReceiptSearchCondition = {
  invoiceRegistrationNumber?: string;
  supplierName?: string;
  dateFrom?: string;
  dateTo?: string;
  timeFrom?: string;
  timeTo?: string;
  category1?: string;
  category2?: string;
  priceMin?: number;
  priceMax?: number;
  totalMin?: number;
  totalMax?: number;
};

// 画面カード表示用に明細行をレシート単位へまとめた型。
export type ReceiptSummary = {
  receiptId: string;
  invoiceRegistrationNumber: string;
  supplierName: string;
  supplierImage?: string;
  receiptDate: string;
  receiptTime: string;
  taxFlag: TaxFlag;
  totalPrice: number;
  receiptDetails: ReceiptItem[];
};

// 入金登録/一覧で使う1行。
export type Income = {
  id?: number;
  salaryDate: string;
  salaryName: string;
  salaryCategory: string;
  salaryAmount: number;
  salaryComment?: string;
};

// 予算設定の1行。
export type Budget = {
  category1: string;
  category2?: string;
  budgetAmount: number;
};

// 店舗/インボイス登録番号マスタ。
export type Invoice = {
  invoiceRegistrationNumber: string;
  supplierImage?: string;
  supplierLogo?: string;
  img?: string;
  supplierName: string;
  taxFlag: TaxFlag;
};

// アプリ全体の表示設定と予算機能設定。
export type AppSettings = {
  budgetEnabled: boolean;
  budgetPeriod: "week" | "month";
  darkMode: boolean;
  autoDark: boolean;
  sunrise: string;
  sunset: string;
  largeTextMode: boolean;
  colorTheme: "kakeibo" | "teal" | "indigo" | "green" | "orange" | "pink" | "sakura" | "sky" | "mono";
  language?: "ja" | "zh" | "en";
};

// ダッシュボードで表示可能なウィジェットID。
export type DashboardWidgetId =
  | "clock"
  | "cashFlow"
  | "expense"
  | "income"
  | "balance"
  | "budget"
  | "spendingPace"
  | "largestExpense"
  | "categoryChart"
  | "dailyChart"
  | "recentExpense"
  | "recentIncome"
  | "aiUsage"
  | "receiptCount"
  | "incomeCount"
  | "topCategory"
  | "budgetUsage"
  | "calendar";

// ダッシュボードウィジェットの表示幅。
export type DashboardWidgetSize = "small" | "medium" | "wide" | "large";

// ユーザーが保存したウィジェット配置。
export type DashboardLayoutItem = {
  id: DashboardWidgetId;
  size: DashboardWidgetSize;
};

// ログイン後に端末へ保存するセッション情報。
export type AuthSession = {
  token: string;
  userId: string;
  username: string;
  email?: string;
  nickname: string;
  avatarImage?: string;
};

export type RecurringExpense = {
  id?: number;
  ruleName: string;
  dayOfMonth: number;
  itemName: string;
  category1: string;
  category2: string;
  amount: number;
  enabled: boolean;
  lastRunMonth?: string;
  memo?: string;
};

// AIレシート利用量の集計。
export type AiUsageSummary = {
  requestCount?: number;
  totalTokens?: number;
  promptTokens?: number;
  outputTokens?: number;
};

// AI解析履歴一覧の1行。
export type AiReceiptHistory = {
  analysisId: string;
  receiptId?: string;
  supplierName?: string;
  receiptDate?: string;
  receiptTime?: string;
  totalPrice?: number;
  status?: string;
  createdDate?: string;
  createdTime?: string;
};

// AI解析履歴詳細。画像、AI出力、手動編集後の保存内容を含む。
export type AiReceiptHistoryDetail = AiReceiptHistory & {
  invoiceRegistrationNumber?: string;
  taxFlag?: TaxFlag | string | number;
  imageBase64?: string;
  imageMimeType?: string;
  aiOutput?: unknown;
  editedReceipt?: unknown;
};
