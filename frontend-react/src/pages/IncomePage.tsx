import { Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { currentMonth, today, yen } from "../api/normalizers";
import type { Income, SalaryCategory } from "../api/types";
import { IconButton } from "../components/IconButton";

type IncomePageProps = {
  salaryCategories: SalaryCategory[];
  onChanged: () => void;
  notify: (message: string, tone?: "success" | "error" | "info") => void;
};

const blankIncome: Income = {
  salaryDate: today(),
  salaryName: "",
  salaryCategory: "",
  salaryAmount: 0,
  salaryComment: ""
};

export function IncomePage({ salaryCategories, onChanged, notify }: IncomePageProps) {
  const [month, setMonth] = useState(currentMonth());
  const [form, setForm] = useState<Income>(blankIncome);
  const [rows, setRows] = useState<Income[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setRows(await api.income.list(month));
    } catch (error) {
      notify((error as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(console.error);
  }, [month]);

  async function create(event: FormEvent) {
    event.preventDefault();
    try {
      await api.income.create(form);
      notify("入金を登録しました。", "success");
      setForm(blankIncome);
      load();
      onChanged();
    } catch (error) {
      notify((error as Error).message, "error");
    }
  }

  async function save(row: Income) {
    try {
      await api.income.update(row);
      notify("入金を更新しました。", "success");
      load();
      onChanged();
    } catch (error) {
      notify((error as Error).message, "error");
    }
  }

  async function remove(id?: number) {
    if (!id || !confirm("削除しますか？")) return;
    try {
      await api.income.remove(id);
      notify("削除しました。", "success");
      load();
      onChanged();
    } catch (error) {
      notify((error as Error).message, "error");
    }
  }

  const total = rows.reduce((sum, row) => sum + Number(row.salaryAmount || 0), 0);

  return (
    <div className="income-layout">
      <section className="panel">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Income</span>
            <h2>入金登録</h2>
          </div>
          <div className="total-pill"><span>月合計</span><strong>{yen(total)}</strong></div>
        </div>

        <form className="form-grid" onSubmit={create}>
          <label className="field">
            <span>日付</span>
            <input type="date" value={form.salaryDate} onChange={event => setForm({ ...form, salaryDate: event.target.value })} />
          </label>
          <label className="field">
            <span>入金名</span>
            <input value={form.salaryName} onChange={event => setForm({ ...form, salaryName: event.target.value })} />
          </label>
          <label className="field">
            <span>分類</span>
            <select value={form.salaryCategory} onChange={event => setForm({ ...form, salaryCategory: event.target.value })}>
              <option value=""></option>
              {salaryCategories.map(item => <option key={item.SAL_CAT} value={item.SAL_CAT}>{item.SAL_CAT}</option>)}
            </select>
          </label>
          <label className="field">
            <span>金額</span>
            <input type="number" value={form.salaryAmount} onChange={event => setForm({ ...form, salaryAmount: Number(event.target.value) })} />
          </label>
          <button className="command-button command-button--primary" type="submit">
            <Plus size={17} /> 登録
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="toolbar-row">
          <div className="toolbar-title">
            <span className="section-kicker">List</span>
            <h2>入金リスト</h2>
          </div>
          <div className="toolbar-actions">
            <input type="month" value={month} onChange={event => setMonth(event.target.value)} />
            <button type="button" className="command-button command-button--ghost" onClick={load} disabled={loading}>
              <RefreshCw size={17} /> 更新
            </button>
          </div>
        </div>

        <div className="editable-list">
          {rows.length === 0 && <div className="empty-state">データなし</div>}
          {rows.map((row, index) => (
            <div className="editable-row" key={row.id || index}>
              <input type="date" value={row.salaryDate} onChange={event => {
                const next = [...rows];
                next[index] = { ...row, salaryDate: event.target.value };
                setRows(next);
              }} />
              <input value={row.salaryName} onChange={event => {
                const next = [...rows];
                next[index] = { ...row, salaryName: event.target.value };
                setRows(next);
              }} />
              <select value={row.salaryCategory} onChange={event => {
                const next = [...rows];
                next[index] = { ...row, salaryCategory: event.target.value };
                setRows(next);
              }}>
                <option value=""></option>
                {salaryCategories.map(item => <option key={item.SAL_CAT} value={item.SAL_CAT}>{item.SAL_CAT}</option>)}
              </select>
              <input type="number" value={row.salaryAmount} onChange={event => {
                const next = [...rows];
                next[index] = { ...row, salaryAmount: Number(event.target.value) };
                setRows(next);
              }} />
              <IconButton label="保存" icon={Save} variant="solid" onClick={() => save(row)} />
              <IconButton label="削除" icon={Trash2} variant="danger" onClick={() => remove(row.id)} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
