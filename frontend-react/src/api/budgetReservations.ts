import type { AppSettings, RecurringExpense } from "./types";

export type RecurringReservation = {
  category1: string;
  category2: string;
  amount: number;
};

/** 指定期間にまだ登録されていない定期出費を予算の予約額として返す。 */
export function buildRecurringReservations(
  rules: RecurringExpense[],
  period: AppSettings["budgetPeriod"],
  month: string,
  now = new Date()
): RecurringReservation[] {
  // 2026-11-05 Codex: 実績登録前の定期出費だけを抽出し、登録済み月や過去月との二重計上を避ける。
  const currentMonth = monthValue(now);
  if (!/^\d{4}-\d{2}$/.test(month) || month < currentMonth) return [];

  return rules
    .filter(rule => rule.enabled && Number(rule.amount || 0) > 0 && rule.lastRunMonth !== month)
    .filter(rule => period === "month" || isDueInCurrentWeek(rule, month, now))
    .map(rule => ({
      category1: rule.category1 || "その他",
      category2: rule.category2 || "未分類",
      amount: Number(rule.amount || 0)
    }));
}

export function monthValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function isDueInCurrentWeek(rule: RecurringExpense, month: string, now: Date): boolean {
  if (month !== monthValue(now)) return false;
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  const due = new Date(year, monthNumber - 1, Math.min(Math.max(1, Number(rule.dayOfMonth) || 1), lastDay));
  const start = new Date(now);
  start.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return due >= start && due < end;
}
