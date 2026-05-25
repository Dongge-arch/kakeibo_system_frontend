import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { Category1, Category2, SalaryCategory } from "../api/types";
import { IconButton } from "../components/IconButton";

type CategoriesPageProps = {
  category1: Category1[];
  category2: Category2[];
  salaryCategories: SalaryCategory[];
  refresh: () => Promise<void> | void;
  notify: (message: string, tone?: "success" | "error" | "info") => void;
};

export function CategoriesPage({ category1, category2, salaryCategories, refresh, notify }: CategoriesPageProps) {
  const [newCategory1, setNewCategory1] = useState("");
  const [selectedCategory1, setSelectedCategory1] = useState("");
  const [newCategory2, setNewCategory2] = useState("");
  const [taxRate, setTaxRate] = useState(0.1);
  const [newSalary, setNewSalary] = useState("");
  const [busy, setBusy] = useState(false);

  const visibleCategory2 = useMemo(() => {
    return category2.filter(item => item.CATEGORY1_NAME === selectedCategory1);
  }, [category2, selectedCategory1]);

  useEffect(() => {
    if (!category1.length) {
      if (selectedCategory1) setSelectedCategory1("");
      return;
    }
    if (!selectedCategory1) {
      setSelectedCategory1(category1[0]?.CATEGORY1_NAME || "");
      return;
    }
    if (category1.some(item => item.CATEGORY1_NAME === selectedCategory1) || busy) return;
    setSelectedCategory1(category1[0]?.CATEGORY1_NAME || "");
  }, [busy, category1, selectedCategory1]);

  async function run(action: () => Promise<unknown>, message: string, after?: () => void) {
    setBusy(true);
    try {
      await action();
      after?.();
      await refresh();
      notify(message, "success");
    } catch (error) {
      notify((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  function addCategory1() {
    const name = newCategory1.trim();
    if (!name) {
      notify("分類名を入力してください。", "error");
      return;
    }
    run(
      () => api.master.addCategory1(name),
      "追加しました。",
      () => {
        setNewCategory1("");
        setSelectedCategory1(name);
      }
    );
  }

  function addCategory2() {
    const name = newCategory2.trim();
    if (!selectedCategory1 || !name) {
      notify("分類を入力してください。", "error");
      return;
    }
    run(
      () => api.master.addCategory2(selectedCategory1, name, taxRate),
      "追加しました。",
      () => setNewCategory2("")
    );
  }

  function addSalaryCategory() {
    const name = newSalary.trim();
    if (!name) {
      notify("入金分類を入力してください。", "error");
      return;
    }
    run(
      () => api.master.addSalaryCategory(name),
      "追加しました。",
      () => setNewSalary("")
    );
  }

  return (
    <div className="category-layout">
      <section className="panel">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Expense</span>
            <h2>出費分類</h2>
          </div>
          <button type="button" className="command-button command-button--ghost" onClick={() => refresh()} disabled={busy}>
            <RefreshCw size={17} /> 更新
          </button>
        </div>
        <div className="inline-form">
          <input value={newCategory1} onChange={event => setNewCategory1(event.target.value)} placeholder="新しい分類" />
          <button type="button" className="command-button command-button--primary" onClick={addCategory1} disabled={busy}>
            <Plus size={17} /> 追加
          </button>
        </div>
        <div className="pill-list">
          {category1.map(item => (
            <span key={item.CATEGORY1_NAME} className={item.CATEGORY1_NAME === selectedCategory1 ? "is-selected" : ""}>
              <button type="button" onClick={() => setSelectedCategory1(item.CATEGORY1_NAME)}>
                {item.CATEGORY1_NAME}
              </button>
              <IconButton
                label="削除"
                icon={Trash2}
                variant="danger"
                onClick={() => run(() => api.master.deleteCategory1(item.CATEGORY1_NAME), "削除しました。")}
              />
            </span>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Sub</span>
            <h2>出費小分類</h2>
          </div>
        </div>
        <div className="inline-form inline-form--wide">
          <select value={selectedCategory1} onChange={event => setSelectedCategory1(event.target.value)}>
            {category1.map(item => <option key={item.CATEGORY1_NAME} value={item.CATEGORY1_NAME}>{item.CATEGORY1_NAME}</option>)}
          </select>
          <input value={newCategory2} onChange={event => setNewCategory2(event.target.value)} placeholder="新しい小分類" />
          <select value={taxRate} onChange={event => setTaxRate(Number(event.target.value))}>
            <option value={0.1}>10%</option>
            <option value={0.08}>8%（軽減税率）</option>
          </select>
          <button type="button" className="command-button command-button--primary" onClick={addCategory2} disabled={busy || !selectedCategory1}>
            <Plus size={17} /> 追加
          </button>
        </div>
        <div className="category-table">
          {!selectedCategory1 && <div className="empty-state">大分類を選択してください</div>}
          {selectedCategory1 && visibleCategory2.length === 0 && <div className="empty-state">小分類なし</div>}
          {visibleCategory2.map(item => (
            <div key={`${item.CATEGORY1_NAME}-${item.CATEGORY2_NAME}`}>
              <span>{item.CATEGORY1_NAME}</span>
              <strong>{item.CATEGORY2_NAME}</strong>
              <em>{Number(item.TAX_RATE) === 0.08 ? "8%" : "10%"}</em>
              <IconButton
                label="削除"
                icon={Trash2}
                variant="danger"
                onClick={() => run(() => api.master.deleteCategory2(item.CATEGORY1_NAME, item.CATEGORY2_NAME), "削除しました。")}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Income</span>
            <h2>入金分類</h2>
          </div>
        </div>
        <div className="inline-form">
          <input value={newSalary} onChange={event => setNewSalary(event.target.value)} placeholder="新しい入金分類" />
          <button type="button" className="command-button command-button--primary" onClick={addSalaryCategory} disabled={busy}>
            <Plus size={17} /> 追加
          </button>
        </div>
        <div className="pill-list">
          {salaryCategories.map(item => (
            <span key={item.SAL_CAT}>
              {item.SAL_CAT}
              <IconButton
                label="削除"
                icon={Trash2}
                variant="danger"
                onClick={() => run(() => api.master.deleteSalaryCategory(item.SAL_CAT), "削除しました。")}
              />
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
