import { Pencil, RefreshCw, Save, Search, Store, Trash2, Upload, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { buildImageSrc, fileToDataUrl, invoiceDigits } from "../api/normalizers";
import { normalizeSupplierSearch } from "../api/supplierSearch";
import type { Invoice, TaxFlag } from "../api/types";
import { IconButton } from "../components/IconButton";

type PlacesPageProps = {
  notify: (message: string, tone?: "success" | "error" | "info") => void;
};

// 2026-11-06 Codex: 実登録店舗の業態に合わせ、検索・編集で使用できる店舗分類を拡張する。
const defaultPlaceCategories = [
  "コンビニ", "スーパー・食品", "ドラッグストア", "飲食店", "カフェ・菓子",
  "ネット通販", "百貨店・商業施設", "ホームセンター", "100円ショップ",
  "家具・インテリア", "家電・PC", "衣料・靴", "美容・理容", "医療機関",
  "ガソリンスタンド", "駐車場", "鉄道・バス", "高速道路", "高速道路施設", "自動車関連",
  "公共料金", "行政・税金", "宿泊・旅行", "教育・書籍", "ペット",
  "ベビー・子ども", "趣味・娯楽", "生活サービス", "総合小売・サービス", "その他", "登録不要"
];

export function PlacesPage({ notify }: PlacesPageProps) {
  const [rows, setRows] = useState<Invoice[]>([]);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("すべて");

  const categories = useMemo(
    () => Array.from(new Set([...defaultPlaceCategories, ...rows.map(row => row.supplierCategory || "その他")])).sort((left, right) => left.localeCompare(right, "ja")),
    [rows]
  );
  const visibleCategories = useMemo(
    () => Array.from(new Set(rows.map(row => row.supplierCategory || "その他"))).sort((left, right) => left.localeCompare(right, "ja")),
    [rows]
  );
  // 2026-11-05 Codex: 店舗名の表記ゆれを吸収し、分類と検索語を同時に指定できる一覧へ整理する。
  const filteredRows = useMemo(() => {
    const normalizedQuery = normalizeSupplierSearch(query);
    return rows.filter(row => {
      const category = row.supplierCategory || "その他";
      if (categoryFilter !== "すべて" && category !== categoryFilter) return false;
      if (!normalizedQuery) return true;
      return normalizeSupplierSearch(`${row.supplierName} ${row.invoiceRegistrationNumber} ${category}`).includes(normalizedQuery);
    });
  }, [rows, query, categoryFilter]);
  const groupedRows = useMemo(() => {
    const groups = new Map<string, Invoice[]>();
    filteredRows.forEach(row => {
      const category = row.supplierCategory || "その他";
      groups.set(category, [...(groups.get(category) || []), row]);
    });
    return Array.from(groups.entries()).sort(([left], [right]) => left.localeCompare(right, "ja"));
  }, [filteredRows]);

  async function load() {
    setLoading(true);
    try {
      setRows(await api.master.invoices());
    } catch (error) {
      notify((error as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  async function save(invoice: Invoice) {
    if (!invoice.supplierName.trim()) {
      notify("店舗名を入力してください。", "error");
      return;
    }
    setSaving(true);
    try {
      await api.master.updateInvoice(invoice);
      notify("保存しました。", "success");
      setEditing(null);
      await load();
    } catch (error) {
      notify((error as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function changeLogo(file?: File) {
    if (!file || !editing) return;
    const dataUrl = await fileToDataUrl(file);
    setEditing({ ...editing, supplierImage: dataUrl });
  }

  async function remove(invoiceRegistrationNumber: string) {
    if (!confirm("削除しますか？")) return;
    try {
      await api.master.deleteInvoice(invoiceRegistrationNumber);
      notify("削除しました。", "success");
      load();
    } catch (error) {
      notify((error as Error).message, "error");
    }
  }

  return (
    <section className="panel">
      <div className="toolbar-row">
        <div className="toolbar-title">
          <span className="section-kicker">Places</span>
          <h2>場所リスト</h2>
        </div>
        <button type="button" className="command-button command-button--ghost" onClick={load} disabled={loading}>
          <RefreshCw size={17} /> 更新
        </button>
      </div>

      <div className="place-filter-bar">
        <label className="search-box place-search-box">
          <Search size={17} />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="店舗名・登録番号・分類を検索" />
        </label>
        <div className="place-category-tabs" aria-label="店舗分類">
          {["すべて", ...visibleCategories].map(category => (
            <button
              type="button"
              className={categoryFilter === category ? "is-active" : ""}
              key={category}
              onClick={() => setCategoryFilter(category)}
            >
              {category}
              <span>{category === "すべて" ? rows.length : rows.filter(row => (row.supplierCategory || "その他") === category).length}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="place-group-list">
        {loading && rows.length === 0 && <div className="empty-state">データを読み込んでいます...</div>}
        {!loading && rows.length === 0 && <div className="empty-state">データなし</div>}
        {!loading && rows.length > 0 && filteredRows.length === 0 && <div className="empty-state">条件に一致する店舗はありません</div>}
        {groupedRows.map(([category, categoryRows]) => (
          <section className="place-category-group" key={category}>
            <header><span><Store size={17} />{category}</span><em>{categoryRows.length}件</em></header>
            <div className="place-grid">
        {categoryRows.map(row => {
          const logoSrc = buildImageSrc(row.supplierImage || row.supplierLogo || row.img);
          const isTaxIncluded = String(row.taxFlag) === "1";
          return (
          <article className="place-card place-card--summary" key={row.invoiceRegistrationNumber}>
            <div className="place-logo">
              {logoSrc ? <img src={logoSrc} alt="" /> : <span>T</span>}
            </div>
            <div className="place-summary-main">
              <strong>{row.supplierName || "-"}</strong>
              <span>{row.invoiceRegistrationNumber || "-"}</span>
              <small>{row.supplierCategory || "その他"}</small>
            </div>
            <span className={`place-tax-badge ${isTaxIncluded ? "is-included" : "is-excluded"}`}>
              {isTaxIncluded ? "税込" : "税抜"}
            </span>
            <div className="place-actions">
              <button type="button" className="command-button command-button--ghost" onClick={() => setEditing(row)}>
                <Pencil size={16} /> 編集
              </button>
              <IconButton label="削除" icon={Trash2} variant="danger" onClick={() => remove(row.invoiceRegistrationNumber)} />
            </div>
          </article>
          );
        })}
            </div>
          </section>
        ))}
      </div>

      {editing && (
        <div className="drawer-layer">
          <div className="drawer place-drawer">
            <div className="drawer-head">
              <div>
                <span className="section-kicker">Edit</span>
                <h2>場所編集</h2>
              </div>
              <IconButton label="閉じる" icon={X} onClick={() => setEditing(null)} />
            </div>

            <div className="place-edit-layout">
              <div className="place-logo place-logo--large">
                {buildImageSrc(editing.supplierImage || editing.supplierLogo || editing.img) ? <img src={buildImageSrc(editing.supplierImage || editing.supplierLogo || editing.img)} alt="" /> : <span>店舗画像なし</span>}
              </div>
              <label className="file-button">
                <Upload size={17} /> 店舗画像
                <input type="file" accept="image/*,.svg,.webp,.avif,.gif,.bmp,.ico,.tif,.tiff" onChange={event => changeLogo(event.target.files?.[0])} />
              </label>
            </div>

            <div className="form-grid">
              <label className="field">
                <span>登録番号</span>
                <input value={invoiceDigits(editing.invoiceRegistrationNumber)} readOnly />
              </label>
              <label className="field">
                <span>店舗名</span>
                <input value={editing.supplierName} onChange={event => setEditing({ ...editing, supplierName: event.target.value })} />
              </label>
              <label className="field">
                <span>店舗分類</span>
                <input
                  list="place-category-options"
                  value={editing.supplierCategory || "その他"}
                  onChange={event => setEditing({ ...editing, supplierCategory: event.target.value })}
                />
                <datalist id="place-category-options">
                  {categories.map(category => <option value={category} key={category} />)}
                </datalist>
              </label>
              <label className="field">
                <span>税区分</span>
                <select value={editing.taxFlag} onChange={event => setEditing({ ...editing, taxFlag: event.target.value as TaxFlag })}>
                  <option value="1">税込</option>
                  <option value="0">税抜</option>
                </select>
              </label>
            </div>

            <div className="sticky-submit">
              <div>
                <span>更新対象</span>
                <strong>{editing.supplierName || editing.invoiceRegistrationNumber}</strong>
              </div>
              <button type="button" className="command-button command-button--primary" onClick={() => save(editing)} disabled={saving}>
                <Save size={18} /> {saving ? "保存中" : "更新する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
