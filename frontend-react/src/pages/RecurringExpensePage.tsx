import { CalendarClock, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { parseNumber, yen } from "../api/normalizers";
import type { Category1, Category2, RecurringExpense } from "../api/types";
import { IconButton } from "../components/IconButton";

type Props = {
  category1: Category1[];
  category2: Category2[];
  onChanged: () => void;
  notify: (message: string, tone?: "success" | "error" | "info") => void;
};

const emptyRule: RecurringExpense = {
  ruleName: "",
  dayOfMonth: 27,
  itemName: "",
  category1: "",
  category2: "",
  amount: 0,
  enabled: true,
  memo: ""
};

export function RecurringExpensePage({ category1, category2, onChanged, notify }: Props) {
  const [rules, setRules] = useState<RecurringExpense[]>([]);
  const [draft, setDraft] = useState<RecurringExpense>(emptyRule);
  const [editingRule, setEditingRule] = useState<RecurringExpense | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const category2Choices = useMemo(
    () => category2.filter(row => !draft.category1 || row.CATEGORY1_NAME === draft.category1),
    [category2, draft.category1]
  );
  const editingCategory2Choices = useMemo(
    () => category2.filter(row => !editingRule?.category1 || row.CATEGORY1_NAME === editingRule.category1),
    [category2, editingRule?.category1]
  );

  useEffect(() => {
    load().catch(console.error);
  }, []);

  async function load() {
    setLoading(true);
    try {
      setRules(await api.recurring.list());
    } catch (error) {
      notify((error as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }

  function patch(next: Partial<RecurringExpense>) {
    setDraft(current => ({ ...current, ...next }));
  }

  function edit(rule: RecurringExpense) {
    setEditingRule({ ...emptyRule, ...rule });
  }

  function reset() {
    setDraft(emptyRule);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.ruleName.trim() || !draft.itemName.trim() || parseNumber(draft.amount) <= 0) {
      notify("名称、明細名、金額を入力してください。", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...draft,
        dayOfMonth: Math.min(31, Math.max(1, Number(draft.dayOfMonth || 1))),
        amount: parseNumber(draft.amount)
      };
      await api.recurring.create(payload);
      notify("定期出費を登録しました。", "success");
      reset();
      await load();
      onChanged();
    } catch (error) {
      notify((error as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function updateEditing(event: FormEvent) {
    event.preventDefault();
    if (!editingRule?.id) return;
    if (!editingRule.ruleName.trim() || !editingRule.itemName.trim() || parseNumber(editingRule.amount) <= 0) {
      notify("名称、明細名、金額を入力してください。", "error");
      return;
    }
    setSaving(true);
    try {
      await api.recurring.update({
        ...editingRule,
        dayOfMonth: Math.min(31, Math.max(1, Number(editingRule.dayOfMonth || 1))),
        amount: parseNumber(editingRule.amount)
      });
      notify("定期出費を更新しました。", "success");
      setEditingRule(null);
      await load();
      onChanged();
    } catch (error) {
      notify((error as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id?: number) {
    if (!id || !confirm("この定期出費を削除しますか？")) return;
    try {
      await api.recurring.remove(id);
      notify("定期出費を削除しました。", "success");
      await load();
    } catch (error) {
      notify((error as Error).message, "error");
    }
  }

  async function runNow() {
    try {
      const result = await api.recurring.runDue();
      notify(result.createdCount > 0 ? `定期出費を${result.createdCount}件登録しました。` : "登録対象の定期出費はありません。", "info");
      onChanged();
    } catch (error) {
      notify((error as Error).message, "error");
    }
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Auto debit</span>
            <h2>定期出費</h2>
          </div>
          <button type="button" className="command-button command-button--ghost" onClick={runNow}>
            <CalendarClock size={17} /> 今すぐ確認
          </button>
        </div>
        <p className="panel-note">
          家賃、電気代、サブスクなど毎月決まった日に発生する支出を登録します。ログイン時に対象日を過ぎていれば、当月分を自動で1回だけ出費明細へ登録します。
        </p>

        <form className="recurring-form" onSubmit={submit}>
          <label className="field">
            <span>名称</span>
            <input value={draft.ruleName} placeholder="例：家賃" onChange={event => patch({ ruleName: event.target.value, itemName: draft.itemName || event.target.value })} />
          </label>
          <label className="field">
            <span>毎月の日付</span>
            <input type="number" min={1} max={31} value={draft.dayOfMonth} onChange={event => patch({ dayOfMonth: Number(event.target.value) })} />
          </label>
          <label className="field">
            <span>明細名</span>
            <input value={draft.itemName} placeholder="例：電気代" onChange={event => patch({ itemName: event.target.value })} />
          </label>
          <label className="field">
            <span>金額</span>
            <input type="number" min={0} value={draft.amount || ""} onChange={event => patch({ amount: parseNumber(event.target.value) })} />
          </label>
          <label className="field">
            <span>分類</span>
            <select value={draft.category1} onChange={event => patch({ category1: event.target.value, category2: "" })}>
              <option value=""></option>
              {category1.map(row => <option key={row.CATEGORY1_NAME} value={row.CATEGORY1_NAME}>{row.CATEGORY1_NAME}</option>)}
            </select>
          </label>
          <label className="field">
            <span>小分類</span>
            <select value={draft.category2} onChange={event => patch({ category2: event.target.value })}>
              <option value=""></option>
              {category2Choices.map(row => <option key={`${row.CATEGORY1_NAME}-${row.CATEGORY2_NAME}`} value={row.CATEGORY2_NAME}>{row.CATEGORY2_NAME}</option>)}
            </select>
          </label>
          <label className="recurring-toggle">
            <span>有効</span>
            <input type="checkbox" checked={draft.enabled} onChange={event => patch({ enabled: event.target.checked })} />
            <i aria-hidden="true" />
          </label>
          <div className="search-form-actions">
            <button type="button" className="command-button command-button--ghost" onClick={reset}>クリア</button>
            <button type="submit" className="command-button command-button--primary" disabled={saving}>
              <Plus size={17} /> {saving ? "保存中" : "登録する"}
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="result-summary">
          <span>登録済み</span>
          <strong>{rules.length} 件</strong>
        </div>
        <div className="receipt-list-grid">
          {loading && <div className="empty-state">データを読み込んでいます...</div>}
          {!loading && rules.length === 0 && <div className="empty-state">データなし</div>}
          {rules.map(rule => (
            <article className="receipt-card recurring-card" key={rule.id}>
              <div className="receipt-card-top">
                <div>
                  <span>毎月 {rule.dayOfMonth}日</span>
                  <h3>{rule.ruleName}</h3>
                  <small>{[rule.category1, rule.category2].filter(Boolean).join(" / ") || "分類なし"}</small>
                </div>
                <strong>{yen(rule.amount)}</strong>
              </div>
              <div className="period-pill">{rule.enabled ? "有効" : "停止中"}{rule.lastRunMonth ? ` / 最終登録 ${rule.lastRunMonth}` : ""}</div>
              <div className="receipt-card-actions">
                <button type="button" className="command-button command-button--ghost" onClick={() => edit(rule)}>
                  <Pencil size={16} /> 編集
                </button>
                <IconButton label="削除" icon={Trash2} variant="danger" onClick={() => remove(rule.id)} />
              </div>
            </article>
          ))}
        </div>
      </section>

      {editingRule && (
        <div className="drawer-layer">
          <div className="drawer place-drawer recurring-drawer">
            <div className="drawer-head">
              <div>
                <span className="section-kicker">Edit</span>
                <h2>定期出費を編集</h2>
              </div>
              <IconButton label="閉じる" icon={X} onClick={() => setEditingRule(null)} />
            </div>
            <form className="recurring-edit-form" onSubmit={updateEditing}>
              <label className="field">
                <span>名称</span>
                <input value={editingRule.ruleName} onChange={event => setEditingRule(current => current ? { ...current, ruleName: event.target.value } : current)} />
              </label>
              <label className="field">
                <span>毎月の日付</span>
                <input type="number" min={1} max={31} value={editingRule.dayOfMonth} onChange={event => setEditingRule(current => current ? { ...current, dayOfMonth: Number(event.target.value) } : current)} />
              </label>
              <label className="field">
                <span>明細名</span>
                <input value={editingRule.itemName} onChange={event => setEditingRule(current => current ? { ...current, itemName: event.target.value } : current)} />
              </label>
              <label className="field">
                <span>金額</span>
                <input type="number" min={0} value={editingRule.amount || ""} onChange={event => setEditingRule(current => current ? { ...current, amount: parseNumber(event.target.value) } : current)} />
              </label>
              <label className="field">
                <span>分類</span>
                <select value={editingRule.category1} onChange={event => setEditingRule(current => current ? { ...current, category1: event.target.value, category2: "" } : current)}>
                  <option value=""></option>
                  {category1.map(row => <option key={row.CATEGORY1_NAME} value={row.CATEGORY1_NAME}>{row.CATEGORY1_NAME}</option>)}
                </select>
              </label>
              <label className="field">
                <span>小分類</span>
                <select value={editingRule.category2} onChange={event => setEditingRule(current => current ? { ...current, category2: event.target.value } : current)}>
                  <option value=""></option>
                  {editingCategory2Choices.map(row => <option key={`${row.CATEGORY1_NAME}-${row.CATEGORY2_NAME}`} value={row.CATEGORY2_NAME}>{row.CATEGORY2_NAME}</option>)}
                </select>
              </label>
              <label className="recurring-toggle recurring-toggle--wide">
                <span>有効</span>
                <input type="checkbox" checked={editingRule.enabled} onChange={event => setEditingRule(current => current ? { ...current, enabled: event.target.checked } : current)} />
                <i aria-hidden="true" />
              </label>
              <div className="search-form-actions">
                <button type="button" className="command-button command-button--ghost" onClick={() => setEditingRule(null)}>キャンセル</button>
                <button type="submit" className="command-button command-button--primary" disabled={saving}>
                  <Save size={17} /> {saving ? "保存中" : "更新する"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
