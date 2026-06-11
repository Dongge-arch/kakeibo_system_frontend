import { Pencil, RefreshCw, Save, Trash2, Upload, X } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { buildImageSrc, fileToDataUrl, invoiceDigits } from "../api/normalizers";
import type { Invoice, TaxFlag } from "../api/types";
import { IconButton } from "../components/IconButton";

type PlacesPageProps = {
  notify: (message: string, tone?: "success" | "error" | "info") => void;
};

export function PlacesPage({ notify }: PlacesPageProps) {
  const [rows, setRows] = useState<Invoice[]>([]);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

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

      <div className="place-grid">
        {loading && rows.length === 0 && <div className="empty-state">データを読み込んでいます...</div>}
        {!loading && rows.length === 0 && <div className="empty-state">データなし</div>}
        {rows.map(row => {
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
