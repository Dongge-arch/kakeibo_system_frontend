import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  GripVertical,
  Maximize2,
  Plus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trash2,
  WalletCards
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { currentMonth, yen } from "../api/normalizers";
import type {
  AiUsageSummary,
  AppSettings,
  Budget,
  DashboardLayoutItem,
  DashboardWidgetId,
  DashboardWidgetSize,
  Income,
  ReceiptSummary
} from "../api/types";

type DashboardPageProps = {
  month: string;
  receipts: ReceiptSummary[];
  incomes: Income[];
  budgets: Budget[];
  aiUsage: AiUsageSummary | null;
  budgetEnabled: boolean;
  budgetPeriod: AppSettings["budgetPeriod"];
  loading: boolean;
  onMonthChange: (month: string) => void;
  onRefresh: () => void;
};

const newWidgetIds: DashboardWidgetId[] = ["receiptCount", "incomeCount", "topCategory", "budgetUsage"];

const defaultLayout: DashboardLayoutItem[] = [
  { id: "clock", size: "small" },
  { id: "expense", size: "small" },
  { id: "income", size: "small" },
  { id: "balance", size: "small" },
  { id: "receiptCount", size: "small" },
  { id: "incomeCount", size: "small" },
  { id: "topCategory", size: "small" },
  { id: "recentExpense", size: "small" }
];

const compactDefaultOrder: DashboardWidgetId[] = [
  "clock",
  "expense",
  "income",
  "balance",
  "topCategory",
  "categoryChart",
  "dailyChart",
  "recentExpense"
];

const legacyDefaultOrder: DashboardWidgetId[] = [
  "expense",
  "income",
  "balance",
  "budget",
  "receiptCount",
  "incomeCount",
  "budgetUsage",
  "topCategory",
  "categoryChart",
  "dailyChart",
  "recentExpense",
  "recentIncome",
  "aiUsage",
  "clock"
];

const availableLayout: DashboardLayoutItem[] = [
  { id: "clock", size: "small" },
  { id: "expense", size: "small" },
  { id: "income", size: "small" },
  { id: "balance", size: "small" },
  { id: "budget", size: "small" },
  { id: "receiptCount", size: "small" },
  { id: "incomeCount", size: "small" },
  { id: "budgetUsage", size: "medium" },
  { id: "topCategory", size: "medium" },
  { id: "categoryChart", size: "wide" },
  { id: "dailyChart", size: "wide" },
  { id: "recentExpense", size: "medium" },
  { id: "recentIncome", size: "medium" },
  { id: "aiUsage", size: "medium" },
  { id: "calendar", size: "large" }
];

const widgetMeta = {
  clock: { title: "時計", description: "現在の日時", defaultSize: "small" },
  expense: { title: "今月の支出", description: "レシート合計", defaultSize: "small" },
  income: { title: "今月の収入", description: "入金合計", defaultSize: "small" },
  balance: { title: "今月の差額", description: "収入 - 支出", defaultSize: "small" },
  budget: { title: "予算残高", description: "週/月の残り予算", defaultSize: "small" },
  receiptCount: { title: "レシート数", description: "登録済み件数", defaultSize: "small" },
  incomeCount: { title: "入金件数", description: "登録済み入金数", defaultSize: "small" },
  budgetUsage: { title: "予算使用率", description: "予算に対する消化率", defaultSize: "medium" },
  topCategory: { title: "トップカテゴリ", description: "支出が多い分類", defaultSize: "medium" },
  categoryChart: { title: "カテゴリ分析", description: "分類ごとの支出", defaultSize: "wide" },
  dailyChart: { title: "日別推移", description: "日別の収支", defaultSize: "wide" },
  recentExpense: { title: "最近の支出", description: "直近のレシート", defaultSize: "medium" },
  recentIncome: { title: "最近の収入", description: "直近の入金", defaultSize: "medium" },
  aiUsage: { title: "AI利用状況", description: "実行回数とトークン", defaultSize: "medium" },
  calendar: { title: "カレンダー", description: "日ごとの収支", defaultSize: "large" }
} as Record<DashboardWidgetId, { title: string; description: string; defaultSize: DashboardWidgetSize }>;

export function DashboardPage({
  month,
  receipts,
  incomes,
  budgets,
  aiUsage,
  budgetEnabled,
  budgetPeriod,
  loading,
  onMonthChange,
  onRefresh
}: DashboardPageProps) {
  const [layout, setLayout] = useState<DashboardLayoutItem[]>(defaultLayout);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draggingId, setDraggingId] = useState<DashboardWidgetId | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    api.dashboard.getLayout()
      .then(saved => {
        if (Array.isArray(saved) && saved.length) {
          const clean = normalizeLayout(saved);
          setLayout(clean.length ? clean : defaultLayout);
        }
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const expenseTotal = receipts.reduce((sum, receipt) => sum + receipt.totalPrice, 0);
  const incomeTotal = incomes.reduce((sum, income) => sum + Number(income.salaryAmount || 0), 0);
  const balance = incomeTotal - expenseTotal;
  const budgetSummary = useMemo(() => buildBudgetSummary(receipts, budgets, budgetPeriod), [receipts, budgets, budgetPeriod]);
  const budgetUsageRate = budgetSummary.totalBudget > 0
    ? Math.min(100, budgetSummary.totalSpent / budgetSummary.totalBudget * 100)
    : 0;
  const topCategories = useMemo(() => buildTopCategories(receipts), [receipts]);
  const maxCategory = Math.max(1, ...topCategories.map(([, value]) => value));
  const recentReceipts = receipts.slice(0, 6);
  const recentIncome = incomes.slice(0, 6);
  const dayFlow = useMemo(() => buildDayFlow(receipts, incomes), [receipts, incomes]);
  const maxDayFlow = Math.max(1, ...dayFlow.map(day => Math.max(day.expense, day.income)));
  const selectedYear = Number(month.slice(0, 4)) || new Date().getFullYear();
  const selectedMonth = Number(month.slice(5, 7)) || new Date().getMonth() + 1;
  const visibleLayout = useMemo(() => layout.filter(item => budgetEnabled || (item.id !== "budget" && item.id !== "budgetUsage")), [layout, budgetEnabled]);
  const visibleIds = new Set(visibleLayout.map(item => item.id));
  const hiddenWidgets = availableLayout.filter(item => {
    if ((item.id === "budget" || item.id === "budgetUsage") && !budgetEnabled) return false;
    return !visibleIds.has(item.id);
  });

  function saveLayout(next: DashboardLayoutItem[]) {
    setLayout(next);
    api.dashboard.saveLayout(next).catch(console.error);
  }

  function addWidget(id: DashboardWidgetId) {
    const meta = widgetMeta[id];
    if (!meta || visibleIds.has(id)) return;
    saveLayout([...layout, { id, size: meta.defaultSize }]);
  }

  function removeWidget(id: DashboardWidgetId) {
    saveLayout(layout.filter(item => item.id !== id));
  }

  function resizeWidget(id: DashboardWidgetId) {
    const sizes: DashboardWidgetSize[] = ["small", "medium", "wide", "large"];
    saveLayout(layout.map(item => {
      if (item.id !== id) return item;
      const current = sizes.indexOf(item.size || "medium");
      return { ...item, size: sizes[(current + 1) % sizes.length] };
    }));
  }

  function resetLayout() {
    saveLayout(defaultLayout);
    setPickerOpen(false);
  }

  function moveWidget(targetId: DashboardWidgetId) {
    if (!draggingId || draggingId === targetId) return;
    const next = [...layout];
    const from = next.findIndex(item => item.id === draggingId);
    const to = next.findIndex(item => item.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    saveLayout(next);
  }

  function shiftMonth(delta: number) {
    const date = new Date(selectedYear, selectedMonth - 1 + delta, 1);
    onMonthChange(buildMonthValue(date.getFullYear(), date.getMonth() + 1));
  }

  function renderWidget(id: DashboardWidgetId) {
    if (id === "clock") {
      return (
        <div className="clock-widget">
          <strong>{now.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}</strong>
          <span>{now.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" })}</span>
        </div>
      );
    }
    if (id === "expense") return <MetricCard label="支出" value={yen(expenseTotal)} tone="coral" icon={<ArrowDownRight />} />;
    if (id === "income") return <MetricCard label="収入" value={yen(incomeTotal)} tone="teal" icon={<ArrowUpRight />} />;
    if (id === "balance") return <MetricCard label="差額" value={yen(balance)} tone={balance >= 0 ? "green" : "coral"} icon={<Sparkles />} />;
    if (id === "receiptCount") return <MetricCard label="レシート" value={`${receipts.length.toLocaleString()}件`} tone="gold" icon={<FileText />} />;
    if (id === "incomeCount") return <MetricCard label="入金" value={`${incomes.length.toLocaleString()}件`} tone="teal" icon={<WalletCards />} />;
    if (id === "budget") return <BudgetStatusCard summary={budgetSummary} period={budgetPeriod} />;
    if (id === "budgetUsage") {
      return (
        <div className="budget-widget">
          <div className={`budget-widget-value ${budgetSummary.remaining < 0 ? "over" : "safe"}`}>
            <span>使用率</span>
            <strong>{budgetSummary.totalBudget > 0 ? `${Math.round(budgetUsageRate)}%` : "-"}</strong>
          </div>
          <div className="budget-widget-note">
            {yen(budgetSummary.totalSpent)} / {yen(budgetSummary.totalBudget)}
          </div>
          <div className="budget-meter"><span style={{ width: `${budgetUsageRate}%` }} /></div>
        </div>
      );
    }
    if (id === "topCategory") {
      const [name, amount] = topCategories[0] || ["データなし", 0];
      return (
        <div className="budget-widget">
          <div className="budget-widget-value safe">
            <span>最多支出</span>
            <strong>{name}</strong>
          </div>
          <div className="budget-widget-note">{yen(amount)}</div>
          <div className="budget-mini-list">
            {topCategories.slice(1, 4).map(([rowName, rowAmount]) => (
              <div key={rowName}>
                <span>{rowName}</span>
                <strong>{yen(rowAmount)}</strong>
              </div>
            ))}
            {topCategories.length === 0 && <div className="empty-state">データなし</div>}
          </div>
        </div>
      );
    }
    if (id === "categoryChart") {
      return (
        <div className="bar-list">
          {topCategories.length === 0 && <div className="empty-state">データなし</div>}
          {topCategories.map(([name, amount]) => (
            <div className="bar-row" key={name}>
              <span>{name}</span>
              <div><i style={{ width: `${Math.max(6, amount / maxCategory * 100)}%` }} /></div>
              <strong>{yen(amount)}</strong>
            </div>
          ))}
        </div>
      );
    }
    if (id === "dailyChart") {
      if (!dayFlow.length) return <div className="empty-state">データなし</div>;
      return (
        <div className="daily-flow">
          {dayFlow.map(day => (
            <div className="daily-column" key={day.date}>
              <div className="daily-bars">
                <i className="income-bar" style={{ height: `${Math.max(4, day.income / maxDayFlow * 100)}%` }} />
                <i className="expense-bar" style={{ height: `${Math.max(4, day.expense / maxDayFlow * 100)}%` }} />
              </div>
              <span>{day.label}</span>
            </div>
          ))}
        </div>
      );
    }
    if (id === "calendar") return <CalendarWidget month={month} receipts={receipts} incomes={incomes} />;
    if (id === "recentExpense") {
      return <MiniList rows={recentReceipts.map(row => ({ id: row.receiptId, title: receiptDisplayTitle(row), sub: `${row.receiptDate} ${row.receiptTime}`, amount: row.totalPrice }))} />;
    }
    if (id === "recentIncome") {
      return <MiniList rows={recentIncome.map(row => ({ id: String(row.id || row.salaryName), title: row.salaryName || "未入力", sub: row.salaryDate, amount: Number(row.salaryAmount || 0) }))} />;
    }
    return (
      <div className="token-grid token-grid--compact">
        <div><span>回数</span><strong>{Number(aiUsage?.requestCount || 0).toLocaleString()}</strong></div>
        <div><span>Total tokens</span><strong>{Number(aiUsage?.totalTokens || 0).toLocaleString()}</strong></div>
        <div><span>Prompt</span><strong>{Number(aiUsage?.promptTokens || 0).toLocaleString()}</strong></div>
        <div><span>Output</span><strong>{Number(aiUsage?.outputTokens || 0).toLocaleString()}</strong></div>
      </div>
    );
  }

  return (
    <div className="page-grid">
      <section className="dashboard-band">
        <div>
          <p className="eyebrow"><Clock size={15} /> {month}</p>
          <h2>今月の家計</h2>
        </div>
        <div className="month-control">
          <div className="dashboard-month-picker" aria-label="対象月">
            <div className="dashboard-month-main">
              <button type="button" className="month-step-button" aria-label="前月" onClick={() => shiftMonth(-1)}>
                <ChevronLeft size={18} />
              </button>
              <div className="month-picker-title">
                <span>対象月</span>
                <strong>{selectedYear}年{selectedMonth}月</strong>
              </div>
              <button type="button" className="month-step-button" aria-label="翌月" onClick={() => shiftMonth(1)}>
                <ChevronRight size={18} />
              </button>
              <button type="button" className="month-now-button" onClick={() => onMonthChange(currentMonth())}>今月</button>
            </div>
          </div>
          <div className="dashboard-action-row">
            <button type="button" className="command-button command-button--ghost" onClick={onRefresh} disabled={loading}>
              <RefreshCw size={17} /> 更新
            </button>
            <button type="button" className="command-button command-button--ghost" onClick={() => setPickerOpen(value => !value)}>
              <Plus size={17} /> ウィジェット
            </button>
            <button type="button" className="command-button command-button--ghost" onClick={resetLayout}>
              <RotateCcw size={17} /> 初期化
            </button>
          </div>
        </div>
      </section>

      {pickerOpen && (
        <section className="widget-picker-panel">
          {hiddenWidgets.length === 0 && <div className="empty-state">追加できるウィジェットはありません</div>}
          {hiddenWidgets.map(item => (
            <button key={item.id} type="button" onClick={() => addWidget(item.id)}>
              <strong>{widgetMeta[item.id].title}</strong>
              <span>{widgetMeta[item.id].description}</span>
            </button>
          ))}
        </section>
      )}

      <section className="dashboard-widget-grid">
        {visibleLayout.map(item => (
          <article
            key={item.id}
            className={`dashboard-widget dashboard-widget--${item.size} ${item.id === "clock" ? "dashboard-widget--clock" : ""}`}
            draggable
            onDragStart={() => setDraggingId(item.id)}
            onDragEnd={() => setDraggingId(null)}
            onDragOver={event => event.preventDefault()}
            onDrop={() => moveWidget(item.id)}
          >
            <header className="dashboard-widget-header">
              <div className="drag-handle" title="移動"><GripVertical size={18} /></div>
              <div>
                <h3>{widgetMeta[item.id].title}</h3>
                <span>{widgetMeta[item.id].description}</span>
              </div>
              <div className="widget-actions">
                <button type="button" title="サイズ変更" onClick={() => resizeWidget(item.id)}><Maximize2 size={16} /></button>
                <button type="button" title="削除" onClick={() => removeWidget(item.id)}><Trash2 size={16} /></button>
              </div>
            </header>
            <div className="dashboard-widget-body">
              {renderWidget(item.id)}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function MetricCard({ label, value, tone, icon }: { label: string; value: string; tone: string; icon: ReactNode }) {
  return (
    <article className={`metric-card metric-card--${tone}`}>
      <div className="metric-icon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function normalizeLayout(saved: DashboardLayoutItem[]) {
  const valid = saved.filter(item => widgetMeta[item.id]);
  if (isDefaultLikeLayout(valid, legacyDefaultOrder) || isDefaultLikeLayout(valid, compactDefaultOrder)) return defaultLayout;
  const byId = new Map(valid.map(item => [item.id, item]));
  const ordered = availableLayout
    .filter(item => byId.has(item.id))
    .map(item => ({ ...item, size: byId.get(item.id)?.size || item.size }));
  const appendedNew = availableLayout.filter(item => newWidgetIds.includes(item.id) && !byId.has(item.id));
  const knownIds = new Set(availableLayout.map(item => item.id));
  const extra = valid.filter(item => !knownIds.has(item.id));
  return [...ordered, ...appendedNew, ...extra];
}

function isDefaultLikeLayout(saved: DashboardLayoutItem[], order: DashboardWidgetId[]) {
  return saved.length === order.length && saved.every((item, index) => item.id === order[index]);
}

type BudgetSummary = {
  totalBudget: number;
  totalSpent: number;
  remaining: number;
  rows: Array<{ key: string; amount: number; spent: number }>;
};

function BudgetStatusCard({ summary, period }: { summary: BudgetSummary; period: AppSettings["budgetPeriod"] }) {
  const usedRate = summary.totalBudget > 0 ? Math.min(100, summary.totalSpent / summary.totalBudget * 100) : 0;
  const periodLabel = period === "week" ? "今週" : "今月";
  const remainingTone = summary.remaining < 0 ? "over" : "safe";

  return (
    <div className="budget-widget">
      <div className={`budget-widget-value ${remainingTone}`}>
        <span>{summary.remaining < 0 ? "超過" : "残り"}</span>
        <strong>{yen(Math.abs(summary.remaining))}</strong>
      </div>
      <div className="budget-widget-note">
        {periodLabel}: {yen(summary.totalSpent)} / {yen(summary.totalBudget)}
      </div>
      <div className="budget-meter"><span style={{ width: `${usedRate}%` }} /></div>
      <div className="budget-mini-list">
        {summary.rows.length === 0 && <div className="empty-state">予算データなし</div>}
        {summary.rows.slice(0, 3).map(row => {
          const rest = row.amount - row.spent;
          return (
            <div key={row.key}>
              <span>{formatBudgetKey(row.key)}</span>
              <strong className={rest < 0 ? "expense" : "income"}>
                {rest < 0 ? "+" : ""}{yen(Math.abs(rest))}
              </strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MiniList({ rows }: { rows: Array<{ id: string; title: string; sub: string; amount: number }> }) {
  if (!rows.length) return <div className="empty-state">データなし</div>;
  return (
    <div className="receipt-stack">
      {rows.map(row => (
        <article className="mini-receipt" key={row.id}>
          <div>
            <strong>{row.title}</strong>
            <span>{row.sub}</span>
          </div>
          <b>{yen(row.amount)}</b>
        </article>
      ))}
    </div>
  );
}

function receiptDisplayTitle(receipt: ReceiptSummary) {
  if (receipt.invoiceRegistrationNumber?.startsWith("A")) {
    return receipt.receiptDetails[0]?.itemName || "インボイスなし";
  }
  return receipt.supplierName || "未入力";
}

function CalendarWidget({ month, receipts, incomes }: { month: string; receipts: ReceiptSummary[]; incomes: Income[] }) {
  const cells = useMemo(() => buildCalendarCells(month, receipts, incomes), [month, receipts, incomes]);

  return (
    <div className="calendar-widget">
      <div className="calendar-weekdays">
        {["月", "火", "水", "木", "金", "土", "日"].map(day => <span key={day}>{day}</span>)}
      </div>
      <div className="calendar-grid">
        {cells.map(cell => (
          <div className={`calendar-cell ${cell.inMonth ? "" : "is-muted"}`} key={cell.date}>
            <strong>{cell.day}</strong>
            <span className="calendar-income">{cell.income > 0 ? `+${yen(cell.income)}` : ""}</span>
            <span className="calendar-expense">{cell.expense > 0 ? `-${yen(cell.expense)}` : ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function buildDayFlow(receipts: ReceiptSummary[], incomes: Income[]) {
  const map = new Map<string, { expense: number; income: number }>();
  receipts.forEach(receipt => {
    const row = map.get(receipt.receiptDate) || { expense: 0, income: 0 };
    row.expense += receipt.totalPrice;
    map.set(receipt.receiptDate, row);
  });
  incomes.forEach(income => {
    const row = map.get(income.salaryDate) || { expense: 0, income: 0 };
    row.income += Number(income.salaryAmount || 0);
    map.set(income.salaryDate, row);
  });
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([date, row]) => ({ date, label: date.slice(5), ...row }));
}

function buildCalendarCells(month: string, receipts: ReceiptSummary[], incomes: Income[]) {
  const year = Number(month.slice(0, 4)) || new Date().getFullYear();
  const monthIndex = (Number(month.slice(5, 7)) || new Date().getMonth() + 1) - 1;
  const firstDay = new Date(year, monthIndex, 1);
  const start = new Date(firstDay);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  start.setDate(firstDay.getDate() - mondayOffset);

  const expenseByDate = new Map<string, number>();
  const incomeByDate = new Map<string, number>();
  receipts.forEach(receipt => {
    const date = normalizeDateKey(receipt.receiptDate);
    if (!date) return;
    expenseByDate.set(date, (expenseByDate.get(date) || 0) + Number(receipt.totalPrice || 0));
  });
  incomes.forEach(income => {
    const date = normalizeDateKey(income.salaryDate);
    if (!date) return;
    incomeByDate.set(date, (incomeByDate.get(date) || 0) + Number(income.salaryAmount || 0));
  });

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");
    return {
      date: key,
      day: date.getDate(),
      inMonth: date.getMonth() === monthIndex,
      expense: expenseByDate.get(key) || 0,
      income: incomeByDate.get(key) || 0
    };
  });
}

function normalizeDateKey(value: string | null | undefined) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (/^\d{8}$/.test(value)) return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  return "";
}

function buildTopCategories(receipts: ReceiptSummary[]): Array<[string, number]> {
  const totals = new Map<string, number>();
  receipts.forEach(receipt => {
    receipt.receiptDetails.forEach(item => {
      const key = item.category1 || "未分類";
      totals.set(key, (totals.get(key) || 0) + Number(item.totalPrice || 0));
    });
  });
  return Array.from(totals.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
}

function buildMonthValue(year: number, monthNumber: number) {
  return `${year}-${String(monthNumber).padStart(2, "0")}`;
}

function formatBudgetKey(key: string) {
  const [category1, category2] = key.split("__");
  return category2 && category2 !== "未分類" ? `${category1} / ${category2}` : category1;
}

function buildBudgetSummary(receipts: ReceiptSummary[], budgets: Budget[], period: AppSettings["budgetPeriod"]): BudgetSummary {
  const spentByKey = new Map<string, number>();
  const range = period === "week" ? currentWeekRange() : null;

  receipts.forEach(receipt => {
    if (range && !isDateInRange(receipt.receiptDate, range.start, range.end)) return;
    receipt.receiptDetails.forEach(item => {
      const amount = Number(item.totalPrice || 0);
      const categoryKey = budgetKey(item.category1, "");
      const detailKey = budgetKey(item.category1, item.category2);
      spentByKey.set(categoryKey, (spentByKey.get(categoryKey) || 0) + amount);
      spentByKey.set(detailKey, (spentByKey.get(detailKey) || 0) + amount);
    });
  });

  const positiveBudgets = budgets.filter(item => Number(item.budgetAmount || 0) > 0);
  const categoriesWithOverall = new Set(
    positiveBudgets.filter(item => !item.category2).map(item => item.category1)
  );
  const rows = positiveBudgets
    .filter(item => !item.category2 || !categoriesWithOverall.has(item.category1))
    .map(item => {
      const key = budgetKey(item.category1, item.category2 || "");
      return {
        key,
        amount: Number(item.budgetAmount || 0),
        spent: Number(spentByKey.get(key) || 0)
      };
    });

  const totalBudget = rows.reduce((sum, row) => sum + row.amount, 0);
  const totalSpent = rows.reduce((sum, row) => sum + row.spent, 0);
  return {
    totalBudget,
    totalSpent,
    remaining: totalBudget - totalSpent,
    rows
  };
}

function budgetKey(category1: string, category2: string) {
  return `${category1 || "未分類"}__${category2 || ""}`;
}

function currentWeekRange() {
  const now = new Date();
  const start = new Date(now);
  const day = (now.getDay() + 6) % 7;
  start.setDate(now.getDate() - day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { start, end };
}

function isDateInRange(value: string, start: Date, end: Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date >= start && date < end;
}
