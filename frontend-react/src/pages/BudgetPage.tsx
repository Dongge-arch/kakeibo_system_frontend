import { RefreshCw, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { yen } from "../api/normalizers";
import type { AppSettings, Budget, Category1, Category2 } from "../api/types";

type BudgetPageProps = {
  category1: Category1[];
  category2: Category2[];
  budgetEnabled: boolean;
  budgetPeriod: AppSettings["budgetPeriod"];
  onChanged: () => void;
  notify: (message: string, tone?: "success" | "error" | "info") => void;
};

export function BudgetPage({ category1, category2, budgetEnabled, budgetPeriod, onChanged, notify }: BudgetPageProps) {
  const [rows, setRows] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const saved = await api.budget.list();
      const map = new Map(saved.map(item => [`${item.category1}/${item.category2 || ""}`, item]));
      const candidates = category2.length
        ? category2.map(item => ({ category1: item.CATEGORY1_NAME, category2: item.CATEGORY2_NAME }))
        : category1.map(item => ({ category1: item.CATEGORY1_NAME, category2: "" }));
      setRows(candidates.map(item => ({
        ...item,
        budgetAmount: Number(map.get(`${item.category1}/${item.category2 || ""}`)?.budgetAmount || 0)
      })));
    } catch (error) {
      notify((error as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!budgetEnabled) return;
    load().catch(console.error);
  }, [budgetEnabled, category1.length, category2.length]);

  async function save() {
    try {
      await api.budget.save(rows);
      notify("予算を保存しました。", "success");
      onChanged();
    } catch (error) {
      notify((error as Error).message, "error");
    }
  }

  const total = useMemo(() => rows.reduce((sum, row) => sum + Number(row.budgetAmount || 0), 0), [rows]);
  const periodLabel = budgetPeriod === "week" ? "現在の期間：週予算" : "現在の期間：月予算";

  if (!budgetEnabled) {
    return (
      <section className="panel">
        <div className="toolbar-row">
          <div className="toolbar-title">
            <span className="section-kicker">Budget</span>
            <h2>予算設定</h2>
          </div>
        </div>
        <div className="empty-state">設定ページで予算機能を有効にしてください。</div>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="toolbar-row">
        <div className="toolbar-title">
          <span className="section-kicker">Budget</span>
          <h2>予算設定</h2>
        </div>
        <div className="toolbar-actions">
          <div className="period-pill">{periodLabel}</div>
          <div className="total-pill"><span>合計</span><strong>{yen(total)}</strong></div>
          <button type="button" className="command-button command-button--ghost" onClick={load} disabled={loading}>
            <RefreshCw size={17} /> 更新
          </button>
          <button type="button" className="command-button command-button--primary" onClick={save}>
            <Save size={17} /> 保存
          </button>
        </div>
      </div>

      <div className="budget-grid">
        {rows.map((row, index) => (
          <label className="budget-tile" key={`${row.category1}-${row.category2}`}>
            <span>{row.category1}</span>
            <strong>{row.category2 || "全体"}</strong>
            <input
              type="number"
              value={row.budgetAmount}
              onChange={event => {
                const next = [...rows];
                next[index] = { ...row, budgetAmount: Number(event.target.value) };
                setRows(next);
              }}
            />
          </label>
        ))}
      </div>
    </section>
  );
}
