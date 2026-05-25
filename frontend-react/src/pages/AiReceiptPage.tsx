import { Camera, GalleryHorizontalEnd, LibraryBig, LoaderCircle, ScanSearch } from "lucide-react";
import { useState } from "react";
import { api } from "../api/client";
import { fileToDataUrl, invoiceDigits, parseNumber, toTaxFlag, yen } from "../api/normalizers";
import type { Category1, Category2, ReceiptForm as ReceiptFormType, ReceiptItem } from "../api/types";
import { emptyReceipt, ReceiptForm } from "../components/ReceiptForm";

type AiReceiptPageProps = {
  category1: Category1[];
  category2: Category2[];
  onSaved: () => void;
  onOpenLibrary: () => void;
  notify: (message: string, tone?: "success" | "error" | "info") => void;
};

export function AiReceiptPage({ category1, category2, onSaved, onOpenLibrary, notify }: AiReceiptPageProps) {
  const [image, setImage] = useState("");
  const [mimeType, setMimeType] = useState("image/jpeg");
  const [analysisId, setAnalysisId] = useState("");
  const [receipt, setReceipt] = useState<ReceiptFormType>(emptyReceipt());
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);

  async function pickImage(file?: File) {
    if (!file) return;
    setMimeType(file.type || "image/jpeg");
    setImage(await fileToDataUrl(file));
  }

  async function analyze() {
    if (!image) {
      notify("画像を選択してください。", "error");
      return;
    }
    setAnalyzing(true);
    try {
      const result = await api.ai.analyze({
        imageBase64: image,
        imageMimeType: mimeType,
        categories: { category1, category2 }
      });
      const normalized = normalizeAiResult(result);
      setReceipt(normalized.receipt);
      setAnalysisId(String(result.analysisId || ""));
      notify("AI解析が完了しました。", "success");
    } catch (error) {
      notify((error as Error).message, "error");
    } finally {
      setAnalyzing(false);
    }
  }

  async function save(receiptInfo: ReceiptFormType) {
    setSaving(true);
    try {
      const created = await api.receipt.create(receiptInfo);
      if (analysisId) {
        await api.ai.saveFinal(analysisId, receiptInfo, created.receiptId).catch(() => null);
      }
      notify(`登録しました: ${created.receiptId}`, "success");
      onSaved();
    } catch (error) {
      notify((error as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ai-page-grid">
      <section className="panel ai-upload-panel">
        <div className="section-heading">
          <div>
            <span className="section-kicker">AIレシート</span>
            <h2>画像解析</h2>
          </div>
          <button type="button" className="command-button command-button--ghost" onClick={onOpenLibrary}>
            <LibraryBig size={17} /> ライブラリ
          </button>
        </div>

        <div className="ai-upload-zone">
          <div className="image-stage">
            {image ? <img src={image} alt="" /> : <ScanSearch size={52} />}
          </div>
          <div className="upload-actions">
            <label className="command-button command-button--ghost">
              <Camera size={17} /> 撮影
              <input type="file" accept="image/*" capture="environment" onChange={event => pickImage(event.target.files?.[0])} />
            </label>
            <label className="command-button command-button--ghost">
              <GalleryHorizontalEnd size={17} /> 写真
              <input type="file" accept="image/*" onChange={event => pickImage(event.target.files?.[0])} />
            </label>
            <button type="button" className="command-button command-button--primary" onClick={analyze} disabled={analyzing}>
              {analyzing ? <LoaderCircle className="spin" size={17} /> : <ScanSearch size={17} />} AI解析
            </button>
          </div>
        </div>

        <div className="ai-result-summary">
          <div>
            <span>店舗</span>
            <strong>{receipt.supplierName || "未解析"}</strong>
          </div>
          <div>
            <span>日付</span>
            <strong>{receipt.receiptDate || "-"}</strong>
          </div>
          <div>
            <span>明細</span>
            <strong>{receipt.receiptDetails.filter(item => item.itemName || item.totalPrice).length}件</strong>
          </div>
          <div>
            <span>推定合計</span>
            <strong>{yen(receipt.totalPrice)}</strong>
          </div>
        </div>

        <div className="ai-detected-list">
          <h3>読み取り明細</h3>
          {receipt.receiptDetails.filter(item => item.itemName || item.totalPrice).length === 0 && (
            <div className="empty-state">画像を解析するとここに結果が表示されます</div>
          )}
          {receipt.receiptDetails.filter(item => item.itemName || item.totalPrice).map((item, index) => (
            <div key={`${item.itemName}-${index}`}>
              <span>{item.itemName || "品目未入力"}</span>
              <strong>{yen(item.totalPrice)}</strong>
            </div>
          ))}
        </div>
      </section>

      <ReceiptForm
        key={analysisId || image || "ai-form"}
        category1={category1}
        category2={category2}
        initial={receipt}
        submitLabel="確認して登録"
        busy={saving}
        compact
        onSubmit={save}
      />
    </div>
  );
}

function normalizeAiResult(raw: Record<string, unknown>): { receipt: ReceiptFormType } {
  const data = (raw.receiptInfo || raw.receipt || raw) as Record<string, unknown>;
  const details = ((data.receiptDetails || data.items || raw.receiptDetails || raw.items || []) as Record<string, unknown>[])
    .filter(Boolean)
    .map(item => {
      const total = parseNumber(item.totalPrice ?? item.amount ?? item.price);
      return {
        itemName: String(item.itemName || item.name || ""),
        category1: String(item.category1 || item.category || ""),
        category2: String(item.category2 || item.subCategory || ""),
        quantity: parseNumber(item.quantity) || 1,
        unitPrice: parseNumber(item.unitPrice ?? item.price ?? item.amount ?? total),
        discount: parseNumber(item.discount),
        totalPrice: total
      } satisfies ReceiptItem;
    });

  const receiptDetails = details.length ? details : emptyReceipt().receiptDetails;
  return {
    receipt: {
      invoiceRegistrationNumber: invoiceDigits(String(data.invoiceRegistrationNumber || data.invoiceNo || "")),
      supplierName: String(data.supplierName || data.storeName || data.shopName || ""),
      receiptDate: String(data.receiptDate || data.date || ""),
      receiptTime: String(data.receiptTime || data.time || ""),
      taxFlag: toTaxFlag(data.taxFlag ?? data.taxIncluded),
      totalPrice: receiptDetails.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0),
      receiptDetails
    }
  };
}
