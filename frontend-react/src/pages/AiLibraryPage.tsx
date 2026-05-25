import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { parseNumber, yen } from "../api/normalizers";
import type { AiReceiptHistory, AiReceiptHistoryDetail } from "../api/types";

type AiLibraryPageProps = {
  notify: (message: string, tone?: "success" | "error" | "info") => void;
};

export function AiLibraryPage({ notify }: AiLibraryPageProps) {
  const [rows, setRows] = useState<AiReceiptHistory[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<AiReceiptHistoryDetail | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const history = await api.ai.history();
      setRows(history);
      if (!selectedId && history[0]?.analysisId) setSelectedId(history[0].analysisId);
    } catch (error) {
      notify((error as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    api.ai.historyDetail(selectedId)
      .then(setDetail)
      .catch(error => notify((error as Error).message, "error"));
  }, [selectedId]);

  const imageSrc = detail?.imageBase64
    ? detail.imageBase64.startsWith("data:")
      ? detail.imageBase64
      : `data:${detail.imageMimeType || "image/jpeg"};base64,${detail.imageBase64}`
    : "";

  return (
    <div className="ai-library-layout">
      <section className="panel ai-library-list">
        <div className="toolbar-row">
          <div className="toolbar-title">
            <span className="section-kicker">History</span>
            <h2>AI履歴</h2>
          </div>
          <button type="button" className="command-button command-button--ghost" onClick={load} disabled={loading}>
            <RefreshCw size={17} /> 更新
          </button>
        </div>
        <div className="history-list">
          {rows.length === 0 && <div className="empty-state">履歴がありません</div>}
          {rows.map(row => (
            <button
              key={row.analysisId}
              type="button"
              className={selectedId === row.analysisId ? "is-active" : ""}
              onClick={() => setSelectedId(row.analysisId)}
            >
              <span>{row.receiptDate || row.createdDate || "日付なし"}</span>
              <strong>{row.supplierName || "未入力"}</strong>
              <em>{yen(row.totalPrice || 0)}</em>
            </button>
          ))}
        </div>
      </section>

      <section className="panel ai-library-detail">
        <div className="library-image-pane">
          {imageSrc ? <img src={imageSrc} alt="" /> : <span>IMAGE</span>}
        </div>
        <div className="library-text-pane">
          <div>
            <span className="section-kicker">AI</span>
            <h3>読み取り結果</h3>
            <ReceiptPreview data={detail?.aiOutput} emptyText="履歴を選択してください" />
          </div>
          <div>
            <span className="section-kicker">Saved</span>
            <h3>保存済み内容</h3>
            <ReceiptPreview data={detail?.editedReceipt} emptyText="まだ保存されていません" />
          </div>
        </div>
      </section>
    </div>
  );
}

function ReceiptPreview({ data, emptyText }: { data: unknown; emptyText: string }) {
  const receipt = normalizeReceiptPreview(data);
  if (!receipt) return <div className="empty-state">{emptyText}</div>;
  return (
    <div className="receipt-preview-box">
      <div className="receipt-preview-head">
        <div>
          <span>店舗</span>
          <strong>{receipt.supplierName || "未入力"}</strong>
        </div>
        <div>
          <span>日付</span>
          <strong>{receipt.receiptDate || "-"}</strong>
        </div>
        <div>
          <span>合計</span>
          <strong>{yen(receipt.totalPrice)}</strong>
        </div>
      </div>
      <div className="receipt-preview-items">
        {receipt.items.length === 0 && <div className="empty-state">明細がありません</div>}
        {receipt.items.map((item, index) => (
          <div key={`${item.name}-${index}`}>
            <span>{item.name || "未入力の明細"}</span>
            <em>{item.category || "-"}</em>
            <strong>{yen(item.total)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function normalizeReceiptPreview(data: unknown) {
  if (!data || typeof data !== "object") return null;
  const raw = data as Record<string, unknown>;
  const receipt = (raw.receiptInfo || raw.receipt || raw) as Record<string, unknown>;
  const details = (receipt.receiptDetails || receipt.items || raw.receiptDetails || raw.items || []) as Record<string, unknown>[];
  const items = Array.isArray(details) ? details.map(item => ({
    name: String(item.itemName || item.name || ""),
    category: [item.category1 || item.category, item.category2 || item.subCategory].filter(Boolean).join(" / "),
    total: parseNumber(item.totalPrice ?? item.amount ?? item.price)
  })) : [];
  const inferredTotal = items.reduce((sum, item) => sum + item.total, 0);
  return {
    supplierName: String(receipt.supplierName || receipt.storeName || receipt.shopName || ""),
    receiptDate: String(receipt.receiptDate || receipt.date || ""),
    totalPrice: parseNumber(receipt.totalPrice ?? receipt.total) || inferredTotal,
    items
  };
}
