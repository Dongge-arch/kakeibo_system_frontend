import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { api, apiUrl } from "../api/client";
import {
  buildImageSrc,
  currentMonth,
  formatDateWithWeekday,
  groupReceipts,
  invoiceDigits,
  monthRange,
  normalizeInvoice,
  parseNumber,
  toTaxFlag,
  yen
} from "../api/normalizers";
import type {
  Category1,
  Category2,
  ReceiptFlatRow,
  ReceiptForm as ReceiptFormType,
  ReceiptSearchCondition,
  ReceiptSummary
} from "../api/types";
import { IconButton } from "../components/IconButton";
import { ReceiptForm } from "../components/ReceiptForm";

type ReceiptsPageProps = {
  category1: Category1[];
  category2: Category2[];
  onChanged: () => void;
  notify: (message: string, tone?: "success" | "error" | "info") => void;
};

type SearchForm = {
  invoiceDigits: string;
  supplierName: string;
  month: string;
  dateFrom: string;
  dateTo: string;
  timeFrom: string;
  timeTo: string;
  category1: string;
  category2: string;
  priceMin: string;
  priceMax: string;
  totalMin: string;
  totalMax: string;
};

const exportLabels = {
  excel: "Excel",
  pdf: "PDF"
} as const;

export function ReceiptsPage({ category1, category2, onChanged, notify }: ReceiptsPageProps) {
  /**
   * 登録済みレシートの検索、編集、削除、Excel/PDF出力を行う画面。
   *
   * Args:
   *   category1: 支出大分類一覧。
   *   category2: 支出小分類一覧。
   *   onChanged: データ更新後に親画面へ通知する関数。
   *   notify: トースト通知を表示する関数。
   *
   * Returns:
   *   JSX.Element: レシート検索画面。
   */
  // 検索条件フォームの現在値。
  const [form, setForm] = useState<SearchForm>(() => initialSearchForm());
  // 出力用にAPIから返った明細行をそのまま保持する。
  const [rawRows, setRawRows] = useState<ReceiptFlatRow[]>([]);
  // 画面カード表示用にレシート単位へ集約した一覧。
  const [receipts, setReceipts] = useState<ReceiptSummary[]>([]);
  // レシートカードの展開状態。
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // ドロワーで編集中のレシート。
  const [editing, setEditing] = useState<ReceiptSummary | null>(null);
  // 検索API実行中の表示制御。
  const [loading, setLoading] = useState(false);
  // 編集保存中のボタン制御。
  const [saving, setSaving] = useState(false);
  // Excel/PDF出力準備中の種類。
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);

  const category2Choices = useMemo(() => {
    // 大分類が選択されている場合は、対応する小分類だけを候補にする。
    return category2.filter(row => !form.category1 || row.CATEGORY1_NAME === form.category1);
  }, [category2, form.category1]);

  const exportRows = rawRows;
  const selectedYear = Number(form.month.slice(0, 4)) || new Date().getFullYear();
  const selectedMonth = Number(form.month.slice(5, 7)) || new Date().getMonth() + 1;

  async function load(condition: ReceiptSearchCondition) {
    /**
     * 検索条件に一致するレシートをAPIから取得する。
     *
     * Args:
     *   condition: APIへ送る検索条件。
     *
     * Returns:
     *   Promise<void>: 読み込み処理の完了。
     */
    // API検索結果を出力用の明細行と画面用カード一覧へ分けて保存する。
    setLoading(true);
    try {
      const result = await api.receipt.search(condition);
      const rows = result.receiptDetails || [];
      setRawRows(rows);
      setReceipts(groupReceipts(rows));
      setExpanded({});
    } catch (error) {
      notify((error as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(buildSearchCondition(form)).catch(console.error);
  }, []);

  async function runSearch(currentForm = form) {
    /**
     * フォーム値から検索条件を作り、検索を実行する。
     *
     * Args:
     *   currentForm: 検索に使うフォーム値。
     *
     * Returns:
     *   Promise<void>: 検索処理の完了。
     */
    // フォーム値をAPI検索条件へ変換してから検索する。
    try {
      await load(buildSearchCondition(currentForm));
    } catch (error) {
      notify((error as Error).message, "error");
    }
  }

  async function submitSearch(event: FormEvent) {
    /**
     * 検索フォーム送信時の処理を行う。
     *
     * Args:
     *   event: フォーム送信イベント。
     *
     * Returns:
     *   Promise<void>: 検索処理の完了。
     */
    event.preventDefault();
    await runSearch();
  }

  function patchForm(patch: Partial<SearchForm>) {
    /**
     * 検索フォームの一部を更新する。
     *
     * Args:
     *   patch: 更新する検索条件。
     */
    // 検索フォームの一部だけを更新する。
    setForm(current => ({ ...current, ...patch }));
  }

  function applyMonth(month: string) {
    /**
     * 月選択に合わせて日付範囲を更新し、検索を再実行する。
     *
     * Args:
     *   month: YYYY-MM形式の対象月。
     */
    // 月ボタン選択時は日付範囲も同じ月へ揃える。
    const range = monthRange(month);
    const next = { ...form, month, dateFrom: range.dateFrom, dateTo: range.dateTo };
    setForm(next);
    runSearch(next).catch(console.error);
  }

  function shiftYear(delta: number) {
    /**
     * 検索対象年を前後に移動する。
     *
     * Args:
     *   delta: 移動する年数。
     */
    applyMonth(buildMonthValue(String(selectedYear + delta), selectedMonth));
  }

  function resetSearch() {
    /**
     * 検索条件を初期状態へ戻して再検索する。
     */
    const next = initialSearchForm();
    setForm(next);
    runSearch(next).catch(console.error);
  }

  async function remove(receiptId: string) {
    /**
     * 指定レシートを削除し、一覧と集計を更新する。
     *
     * Args:
     *   receiptId: 削除対象のレシートID。
     *
     * Returns:
     *   Promise<void>: 削除処理の完了。
     */
    // レシート削除後は一覧とダッシュボード集計を更新する。
    if (!confirm("本当に削除しますか？")) return;
    try {
      await api.receipt.remove(receiptId);
      notify("削除しました。", "success");
      await runSearch();
      onChanged();
    } catch (error) {
      notify((error as Error).message, "error");
    }
  }

  async function update(receipt: ReceiptFormType) {
    /**
     * 編集ドロワーのレシート内容を保存する。
     *
     * Args:
     *   receipt: 更新するレシート情報。
     *
     * Returns:
     *   Promise<void>: 更新処理の完了。
     */
    // 編集ドロワーの保存内容をAPIへ送信する。
    setSaving(true);
    try {
      await api.receipt.update(receipt);
      notify("更新しました。", "success");
      setEditing(null);
      await runSearch();
      onChanged();
    } catch (error) {
      notify((error as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function exportFile(type: "excel" | "pdf") {
    /**
     * 検索済み明細をExcelまたはPDFとして出力する。
     *
     * Args:
     *   type: 出力形式。
     *
     * Returns:
     *   Promise<void>: 出力準備処理の完了。
     */
    // 検索済み明細を一時保存し、別タブでダウンロードページを開く。
    if (!exportRows.length) {
      notify("出力対象のデータがありません。先に検索してください。", "error");
      return;
    }

    const label = exportLabels[type];
    const exportWindow = window.open("about:blank", "_blank");
    if (!exportWindow) {
      notify("新しいページを開けませんでした。ポップアップ許可を確認してください。", "error");
      return;
    }

    exportWindow.document.open();
    exportWindow.document.write(`<main style="font-family: sans-serif; padding: 32px;"><h1>${label} ファイルを準備しています</h1><p>準備完了後にダウンロードを開始します。</p></main>`);
    exportWindow.document.close();

    setExporting(type);
    try {
      const result = await api.receipt.prepareExport(type, exportRows);
      exportWindow.location.href = apiUrl(result.url);
    } catch (error) {
      exportWindow.close();
      notify((error as Error).message, "error");
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="toolbar-row">
          <div className="toolbar-title">
            <span className="section-kicker">Search</span>
            <h2>出費検索</h2>
          </div>
          <div className="toolbar-actions">
            <button type="button" className="command-button command-button--ghost" onClick={() => exportFile("excel")} disabled={!!exporting}>
              <FileSpreadsheet size={17} /> Excel
            </button>
            <button type="button" className="command-button command-button--ghost" onClick={() => exportFile("pdf")} disabled={!!exporting}>
              <FileText size={17} /> PDF
            </button>
            <button type="button" className="command-button command-button--ghost" onClick={() => runSearch()} disabled={loading}>
              <RefreshCw size={17} className={loading ? "spin" : ""} /> 更新
            </button>
          </div>
        </div>

        <form className="receipt-search-form" onSubmit={submitSearch}>
          <div className="receipt-search-grid">
            <label className="field invoice-field">
              <span>登録番号</span>
              <div className="prefix-input prefix-input--plain">
                <b>T</b>
                <input
                  value={form.invoiceDigits}
                  inputMode="numeric"
                  maxLength={13}
                  onChange={event => patchForm({ invoiceDigits: event.target.value.replace(/\D/g, "").slice(0, 13) })}
                />
              </div>
            </label>
            <label className="field">
              <span>場所</span>
              <input value={form.supplierName} onChange={event => patchForm({ supplierName: event.target.value })} />
            </label>
            <label className="field">
              <span>日付 From</span>
              <input type="date" value={form.dateFrom} onChange={event => patchForm({ dateFrom: event.target.value })} />
            </label>
            <label className="field">
              <span>日付 To</span>
              <input type="date" value={form.dateTo} onChange={event => patchForm({ dateTo: event.target.value })} />
            </label>
            <label className="field">
              <span>時刻 From</span>
              <input type="time" value={form.timeFrom} onChange={event => patchForm({ timeFrom: event.target.value })} />
            </label>
            <label className="field">
              <span>時刻 To</span>
              <input type="time" value={form.timeTo} onChange={event => patchForm({ timeTo: event.target.value })} />
            </label>
            <label className="field">
              <span>分類</span>
              <select value={form.category1} onChange={event => patchForm({ category1: event.target.value, category2: "" })}>
                <option value="">全部</option>
                {category1.map(item => <option key={item.CATEGORY1_NAME} value={item.CATEGORY1_NAME}>{item.CATEGORY1_NAME}</option>)}
              </select>
            </label>
            <label className="field">
              <span>小分類</span>
              <select value={form.category2} onChange={event => patchForm({ category2: event.target.value })}>
                <option value="">全部</option>
                {category2Choices.map(item => (
                  <option key={`${item.CATEGORY1_NAME}-${item.CATEGORY2_NAME}`} value={item.CATEGORY2_NAME}>{item.CATEGORY2_NAME}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>商品価格 Min</span>
              <input type="number" value={form.priceMin} onChange={event => patchForm({ priceMin: event.target.value })} />
            </label>
            <label className="field">
              <span>商品価格 Max</span>
              <input type="number" value={form.priceMax} onChange={event => patchForm({ priceMax: event.target.value })} />
            </label>
            <label className="field">
              <span>総額 Min</span>
              <input type="number" value={form.totalMin} onChange={event => patchForm({ totalMin: event.target.value })} />
            </label>
            <label className="field">
              <span>総額 Max</span>
              <input type="number" value={form.totalMax} onChange={event => patchForm({ totalMax: event.target.value })} />
            </label>
          </div>
          <div className="receipt-month-bar">
            <button type="button" onClick={() => shiftYear(-1)}><ChevronLeft size={15} /> 前年</button>
            <strong>{selectedYear}年</strong>
            <button type="button" onClick={() => shiftYear(1)}>翌年 <ChevronRight size={15} /></button>
          </div>
          <div className="month-button-grid" aria-label="月選択">
            {Array.from({ length: 12 }, (_, index) => {
              const monthNumber = index + 1;
              const monthValue = buildMonthValue(String(selectedYear), monthNumber);
              return (
                <button
                  type="button"
                  key={monthValue}
                  className={form.month === monthValue ? "is-active" : ""}
                  onClick={() => applyMonth(monthValue)}
                >
                  {monthNumber}月
                </button>
              );
            })}
          </div>
          <div className="search-form-actions">
            <button type="button" className="command-button command-button--ghost" onClick={resetSearch}>条件クリア</button>
            <button type="submit" className="command-button command-button--primary" disabled={loading}>
              <Search size={17} /> 検索
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="result-summary">
          <span>検索結果</span>
          <strong>{receipts.length} 件</strong>
          <em>明細 {exportRows.length} 件</em>
        </div>
        <div className="receipt-list-grid">
          {loading && receipts.length === 0 && <div className="empty-state">データを読み込んでいます...</div>}
          {!loading && receipts.length === 0 && <div className="empty-state">データなし</div>}
          {receipts.map(receipt => {
            const logoSrc = buildImageSrc(receipt.supplierImage);
            const isOpen = !!expanded[receipt.receiptId];
            return (
              <article className="receipt-card receipt-card--rich" key={receipt.receiptId}>
                <button
                  type="button"
                  className="receipt-card-expand"
                  onClick={() => setExpanded(current => ({ ...current, [receipt.receiptId]: !current[receipt.receiptId] }))}
                >
                  <span className="receipt-expand-icon">{isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</span>
                  <span className="receipt-logo-box">{logoSrc ? <img src={logoSrc} alt="" /> : <span>R</span>}</span>
                  <span className="receipt-card-main">
                    <span>{formatDateWithWeekday(receipt.receiptDate)} {receipt.receiptTime}</span>
                    <strong>{receipt.supplierName || "未入力"}</strong>
                    <small>{receipt.receiptId}</small>
                  </span>
                  <span className="receipt-card-total">
                    <small>{receipt.receiptDetails.length} 件</small>
                    <strong>{yen(receipt.totalPrice)}</strong>
                  </span>
                </button>

                <div className="receipt-items-preview">
                  {receipt.receiptDetails.slice(0, 4).map((item, index) => (
                    <span key={`${receipt.receiptId}-${index}`}>{item.itemName || item.category2 || "明細"}</span>
                  ))}
                </div>

                {isOpen && (
                  <div className="receipt-detail-panel">
                    {receipt.receiptDetails.map((item, index) => (
                      <div className="receipt-detail-row" key={`${receipt.receiptId}-detail-${index}`}>
                        <strong>{item.itemName || "明細"}</strong>
                        <span>{item.category1 || "-"} / {item.category2 || "-"}</span>
                        <em>×{parseNumber(item.quantity)}</em>
                        <b>{yen(item.totalPrice)}</b>
                      </div>
                    ))}
                  </div>
                )}

                <div className="receipt-card-actions">
                  <button type="button" className="command-button command-button--ghost" onClick={() => setEditing(receipt)}>
                    <Pencil size={16} /> 編集
                  </button>
                  <IconButton label="削除" icon={Trash2} variant="danger" onClick={() => remove(receipt.receiptId)} />
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {editing && (
        <div className="drawer-layer">
          <div className="drawer">
            <div className="drawer-head">
              <div>
                <span className="section-kicker">Edit</span>
                <h2>{editing.receiptId}</h2>
              </div>
              <IconButton label="閉じる" icon={X} onClick={() => setEditing(null)} />
            </div>
            <ReceiptForm
              category1={category1}
              category2={category2}
              initial={{
                receiptId: editing.receiptId,
                invoiceRegistrationNumber: invoiceDigits(editing.invoiceRegistrationNumber),
                supplierName: editing.supplierName,
                supplierImage: editing.supplierImage,
                receiptDate: editing.receiptDate,
                receiptTime: editing.receiptTime,
                taxFlag: toTaxFlag(editing.taxFlag),
                totalPrice: editing.totalPrice,
                receiptDetails: editing.receiptDetails
              }}
              submitLabel="更新する"
              busy={saving}
              compact
              onSubmit={update}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function initialSearchForm(): SearchForm {
  /**
   * レシート検索フォームの初期値を作る。
   *
   * Returns:
   *   SearchForm: 当月を対象にした初期検索条件。
   */
  // 初期検索条件は当月の全期間。
  const month = currentMonth();
  const range = monthRange(month);
  return {
    invoiceDigits: "",
    supplierName: "",
    month,
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
    timeFrom: "",
    timeTo: "",
    category1: "",
    category2: "",
    priceMin: "",
    priceMax: "",
    totalMin: "",
    totalMax: ""
  };
}

function buildMonthValue(year: string, monthNumber: number): string {
  /**
   * 年と月番号からYYYY-MM形式の値を作る。
   *
   * Args:
   *   year: 年。
   *   monthNumber: 月番号。
   *
   * Returns:
   *   string: YYYY-MM形式の月文字列。
   */
  return `${year}-${String(monthNumber).padStart(2, "0")}`;
}

function buildSearchCondition(form: SearchForm): ReceiptSearchCondition {
  /**
   * 画面入力値をAPIへ送れる検索条件へ正規化する。
   *
   * Args:
   *   form: 検索フォーム値。
   *
   * Returns:
   *   ReceiptSearchCondition: API送信用の検索条件。
   */
  // 画面入力値をAPIへ送れる検索条件へ正規化する。
  if (form.dateFrom && form.dateTo && form.dateFrom > form.dateTo) {
    throw new Error("日付範囲が不正です。");
  }
  if (form.timeFrom && form.timeTo && form.timeFrom > form.timeTo) {
    throw new Error("時刻範囲が不正です。");
  }

  const priceMin = optionalNumber(form.priceMin);
  const priceMax = optionalNumber(form.priceMax);
  const totalMin = optionalNumber(form.totalMin);
  const totalMax = optionalNumber(form.totalMax);

  if (priceMin !== undefined && priceMax !== undefined && priceMin > priceMax) {
    throw new Error("価格範囲が不正です。");
  }
  if (totalMin !== undefined && totalMax !== undefined && totalMin > totalMax) {
    throw new Error("総額範囲が不正です。");
  }

  const invoiceRegistrationNumber = normalizeInvoice(form.invoiceDigits, true);
  return dropEmpty({
    invoiceRegistrationNumber,
    supplierName: form.supplierName.trim(),
    dateFrom: form.dateFrom,
    dateTo: form.dateTo,
    timeFrom: form.timeFrom,
    timeTo: form.timeTo,
    category1: form.category1,
    category2: form.category2,
    priceMin,
    priceMax,
    totalMin,
    totalMax
  });
}

function optionalNumber(value: string): number | undefined {
  /**
   * 空欄を許可しながら数値入力を検証する。
   *
   * Args:
   *   value: 入力された金額文字列。
   *
   * Returns:
   *   number | undefined: 数値、または未指定を表すundefined。
   */
  // 空欄は未指定、数値以外は画面エラーとして扱う。
  if (value.trim() === "") return undefined;
  const num = Number(value);
  if (!Number.isFinite(num)) throw new Error("金額には数値を入力してください。");
  return num;
}

function dropEmpty(condition: ReceiptSearchCondition): ReceiptSearchCondition {
  /**
   * APIへ送る検索条件から空値を除外する。
   *
   * Args:
   *   condition: 除外前の検索条件。
   *
   * Returns:
   *   ReceiptSearchCondition: 空値を除外した検索条件。
   */
  // APIへ不要な空文字/undefined/nullを送らない。
  return Object.fromEntries(
    Object.entries(condition).filter(([, value]) => value !== "" && value !== undefined && value !== null)
  ) as ReceiptSearchCondition;
}
