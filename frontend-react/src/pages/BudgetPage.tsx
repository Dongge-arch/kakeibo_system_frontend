import { ChevronDown, ChevronRight, RefreshCw, Save } from "lucide-react";
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
  const [expandedCategory, setExpandedCategory] = useState("");

  async function load() {
    setLoading(true);
    try {
      const saved = await api.budget.list();
      const savedMap = new Map(saved.map(item => [`${item.category1}/${item.category2 || ""}`, item]));
      const primaryRows = category1.map(item => ({
        category1: item.category1Name,
        category2: "",
        budgetAmount: Number(savedMap.get(`${item.category1Name}/`)?.budgetAmount || 0)
      }));
      const savedSubRows = saved
        .filter(item => item.category2 && Number(item.budgetAmount || 0) > 0)
        .filter(item => category1.some(category => category.category1Name === item.category1));
      setRows([
        ...primaryRows,
        ...savedSubRows.filter(item => !primaryRows.some(row => row.category1 === item.category1 && row.category2 === item.category2))
      ]);
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

  function updateBudget(category1Name: string, category2Name: string, amount: number) {
    setRows(current => {
      const index = current.findIndex(row => row.category1 === category1Name && (row.category2 || "") === category2Name);
      if (index >= 0) {
        const next = [...current];
        next[index] = { ...next[index], budgetAmount: amount };
        return next;
      }
      return [...current, { category1: category1Name, category2: category2Name, budgetAmount: amount }];
    });
  }

  function subRowsFor(categoryName: string) {
    return category2
      .filter(item => item.category1Name === categoryName)
      .map(item => ({
        category1: item.category1Name,
        category2: item.category2Name,
        budgetAmount: Number(rows.find(row => row.category1 === item.category1Name && row.category2 === item.category2Name)?.budgetAmount || 0)
      }));
  }

  function categorySubTotal(categoryName: string) {
    return rows
      .filter(row => row.category1 === categoryName && row.category2)
      .reduce((sum, row) => sum + Number(row.budgetAmount || 0), 0);
  }

  function cleanRowsForSave() {
    return rows
      .filter(row => row.category1)
      .map(row => ({
        category1: row.category1,
        category2: row.category2 || "",
        budgetAmount: Number(row.budgetAmount || 0)
      }));
  }

  function effectiveBudgetRows() {
    const categoriesWithOverall = new Set(
      rows.filter(row => !row.category2 && Number(row.budgetAmount || 0) > 0).map(row => row.category1)
    );
    return rows.filter(row => {
      if (!row.category2) return true;
      return !categoriesWithOverall.has(row.category1);
    });
  }

  async function save() {
    try {
      await api.budget.save(cleanRowsForSave());
      notify("予算を保存しました。", "success");
      onChanged();
    } catch (error) {
      notify((error as Error).message, "error");
    }
  }

  const categoryRows = rows.filter(row => !row.category2);
  const total = useMemo(() => effectiveBudgetRows().reduce((sum, row) => sum + Number(row.budgetAmount || 0), 0), [rows]);
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

      <p className="panel-note budget-note">
        まずは大分類ごとの全体予算だけ入力してください。細かく管理したい分類だけ開くと、小分類ごとの予算も設定できます。
      </p>

      <div className="budget-grid">
        {loading && categoryRows.length === 0 && <div className="empty-state">データを読み込んでいます...</div>}
        {!loading && categoryRows.length === 0 && <div className="empty-state">カテゴリを登録してください</div>}
        {categoryRows.map(row => (
          <article className="budget-tile budget-tile--group" key={row.category1}>
            <button
              type="button"
              className="budget-expand-button"
              onClick={() => setExpandedCategory(value => value === row.category1 ? "" : row.category1)}
            >
              {expandedCategory === row.category1 ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <span>{row.category1}</span>
            </button>
            <label className="budget-main-input">
              <strong>全体予算</strong>
              <input
                type="number"
                value={row.budgetAmount}
                onChange={event => updateBudget(row.category1, "", Number(event.target.value))}
              />
            </label>
            <em>小分類予算 {yen(categorySubTotal(row.category1))}</em>
            {expandedCategory === row.category1 && (
              <div className="budget-sub-list">
                {subRowsFor(row.category1).map(subRow => (
                  <label key={`${subRow.category1}-${subRow.category2}`}>
                    <span>{subRow.category2}</span>
                    <input
                      type="number"
                      value={subRow.budgetAmount}
                      onChange={event => updateBudget(subRow.category1, subRow.category2 || "", Number(event.target.value))}
                    />
                  </label>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
