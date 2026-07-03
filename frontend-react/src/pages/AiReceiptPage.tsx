import { Camera, GalleryHorizontalEnd, LibraryBig, LoaderCircle, ScanSearch, TextCursorInput } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { fileToDataUrl, invoiceDigits, parseNumber, toTaxFlag } from "../api/normalizers";
import type { Category1, Category2, ReceiptForm as ReceiptFormType, ReceiptItem, TaxFlag } from "../api/types";
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
  const [inputMode, setInputMode] = useState<"image" | "text">("image");
  const [receiptText, setReceiptText] = useState("");
  const [analysisId, setAnalysisId] = useState("");
  const [receipt, setReceipt] = useState<ReceiptFormType>(emptyReceipt());
  const [reviewWarnings, setReviewWarnings] = useState<string[]>([]);
  const [taxSelectionRequired, setTaxSelectionRequired] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [captured, setCaptured] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  async function pickImage(file?: File) {
    if (!file) return;
    stopCamera();
    setMimeType(file.type || "image/jpeg");
    setImage(await fileToDataUrl(file));
    setCaptured(true);
  }

  function stopCamera() {
    const stream = cameraStreamRef.current;
    if (!stream) return;
    stream.getTracks().forEach(track => track.stop());
    cameraStreamRef.current = null;
    setCameraActive(false);
  }

  async function startCamera() {
    if (cameraActive || typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return;

    try {
      setCameraError("");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 2560 }
        }
      });
      cameraStreamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }
      setCameraActive(true);
    } catch (error) {
      stopCamera();
      setCameraError("カメラにアクセスできませんでした。権限を確認してください。");
    }
  }

  async function captureFrame() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setCameraError("カメラが準備できていません。再読み込みしてください。");
      return;
    }

    const canvas = document.createElement("canvas");
    const overlayWidthRatio = 0.7;
    const overlayHeightRatio = 0.65;
    const cropWidth = Math.floor(video.videoWidth * overlayWidthRatio);
    const cropHeight = Math.floor(video.videoHeight * overlayHeightRatio);
    const cropX = Math.floor((video.videoWidth - cropWidth) / 2);
    const cropY = Math.floor((video.videoHeight - cropHeight) / 2);

    canvas.width = cropWidth;
    canvas.height = cropHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    const dataUrl = canvas.toDataURL(mimeType);
    setImage(dataUrl);
    setCaptured(true);
    stopCamera();
  }

  async function analyze() {
    const trimmedText = receiptText.trim();
    if (inputMode === "image" && !image) {
      notify("画像を選択または撮影してください。", "error");
      return;
    }
    if (inputMode === "text" && !trimmedText) {
      notify("レシート本文を入力してください。", "error");
      return;
    }
    setAnalyzing(true);
    try {
      const result = await api.ai.analyze({
        imageBase64: inputMode === "image" ? image : "",
        imageMimeType: inputMode === "image" ? mimeType : "text/plain",
        receiptText: inputMode === "text" ? trimmedText : "",
        categories: { category1, category2 }
      });
      const normalized = normalizeAiResult(result);
      const resolvedReceipt = await resolveAiTaxFlag(normalized.receipt);
      setReceipt(resolvedReceipt.receipt);
      // 2026-06-29 Codex: バックエンドのAI金額整合性チェック結果を登録前レビューに表示する。
      setReviewWarnings(normalized.reviewWarnings);
      setTaxSelectionRequired(resolvedReceipt.needsUserSelection);
      setAnalysisId(String(result.analysisId || ""));
      notify("AI解析が完了しました。", "success");
    } catch (error) {
      notify((error as Error).message, "error");
    } finally {
      setAnalyzing(false);
    }
  }

  async function save(receiptInfo: ReceiptFormType) {
    if (taxSelectionRequired) {
      notify("このレシートが税抜か税込か選択してください。", "error");
      return;
    }
    setSaving(true);
    try {
      const created = await api.receipt.create(receiptInfo);
      let historySaveFailed = false;
      if (analysisId) {
        try {
          await api.ai.saveFinal(analysisId, receiptInfo, created.receiptId);
        } catch {
          historySaveFailed = true;
        }
      }
      notify(
        historySaveFailed
          ? "レシート登録は完了しましたが、AI解析履歴の保存に失敗しました。"
          : `登録しました: ${created.receiptId}`,
        historySaveFailed ? "info" : "success"
      );
      onSaved();
      resetAiPage(true);
    } catch (error) {
      notify((error as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function resolveAiTaxFlag(nextReceipt: ReceiptFormType): Promise<{ receipt: ReceiptFormType; needsUserSelection: boolean }> {
    const invoiceNo = nextReceipt.invoiceRegistrationNumber ? `T${invoiceDigits(nextReceipt.invoiceRegistrationNumber)}` : "";
    if (invoiceNo.length === 14) {
      try {
        const rows = await api.master.supplierByInvoice(invoiceNo);
        const found = rows?.[0];
        if (found) {
          const taxFlag: TaxFlag = String(found.taxFlag) === "1" ? "1" : "0";
          // 2026-07-03 Codex: Apply registered supplier taxFlag after AI returns; AI taxFlag is ignored.
          return {
            needsUserSelection: false,
            receipt: {
              ...nextReceipt,
              invoiceRegistrationNumber: invoiceNo,
              supplierName: found.supplierName || nextReceipt.supplierName,
              supplierImage: found.supplierLogo || nextReceipt.supplierImage,
              taxFlag,
              pricesAreRaw: true,
              needsTaxSelection: false
            }
          };
        }
      } catch {
        // Let the user choose tax mode if supplier lookup fails.
      }
    }
    return {
      needsUserSelection: true,
      receipt: {
        ...nextReceipt,
        taxFlag: "1",
        pricesAreRaw: true,
        needsTaxSelection: true
      }
    };
  }

  function applyAiTaxSelection(taxFlag: TaxFlag) {
    setReceipt(current => ({
      ...current,
      taxFlag,
      pricesAreRaw: true,
      needsTaxSelection: false
    }));
    setTaxSelectionRequired(false);
  }

  function resetAiPage(restartCamera = false) {
    stopCamera();
    setImage("");
    setMimeType("image/jpeg");
    setInputMode("image");
    setReceiptText("");
    setAnalysisId("");
    setReceipt(emptyReceipt());
    setReviewWarnings([]);
    setTaxSelectionRequired(false);
    setCaptured(false);
    setCameraError("");
    if (restartCamera) {
      // 2026-07-03 Codex: After saving an AI receipt, return directly to capture mode for the next receipt.
      window.setTimeout(() => {
        startCamera();
      }, 120);
    }
  }

  useEffect(() => {
    if (inputMode !== "image") {
      stopCamera();
    }
    return () => stopCamera();
  }, [inputMode, image]);

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

        <div className="segmented ai-input-mode">
          <button type="button" className={inputMode === "image" ? "active" : ""} onClick={() => setInputMode("image")}> 
            <ScanSearch size={17} /> 画像
          </button>
          <button type="button" className={inputMode === "text" ? "active" : ""} onClick={() => setInputMode("text")}> 
            <TextCursorInput size={17} /> 文字
          </button>
        </div>

        <div className="ai-upload-zone">
          {inputMode === "image" ? (
            <>
              <div className="camera-stage">
                {image ? (
                  <img src={image} alt="キャプチャ画像" />
                ) : (
                  <>
                    <video ref={videoRef} playsInline muted />
                    <div className="scan-overlay">
                      <span>レシートスキャン枠</span>
                    </div>
                    {!cameraActive && !cameraError && <div className="camera-placeholder">写真を選択するか、カメラを起動してください。</div>}
                    {cameraError && <div className="camera-error">{cameraError}</div>}
                  </>
                )}
              </div>
              <div className="upload-actions">
                {!image ? (
                  <>
                    <p className="ai-upload-guidance">レシートを撮影するか、写真から選択してください。</p>
                    <button type="button" className="command-button command-button--ghost" onClick={cameraActive ? captureFrame : startCamera}>
                      <Camera size={17} /> {cameraActive ? "撮影" : "カメラ起動"}
                    </button>
                    <label className="command-button command-button--ghost">
                      <GalleryHorizontalEnd size={17} /> 写真
                      <input type="file" accept="image/*" onChange={event => pickImage(event.target.files?.[0])} />
                    </label>
                  </>
                ) : (
                  <>
                    <button type="button" className="command-button command-button--ghost" onClick={() => {
                      setImage("");
                      setCaptured(false);
                      setCameraError("");
                    }}>
                      <Camera size={17} /> 画像を選び直す
                    </button>
                    <button type="button" className="command-button command-button--primary" onClick={analyze} disabled={analyzing}>
                      {analyzing ? <LoaderCircle className="spin" size={17} /> : <ScanSearch size={17} />} AI解析
                    </button>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="ai-text-entry">
              <textarea
                value={receiptText}
                onChange={event => setReceiptText(event.target.value)}
                placeholder={"レシート本文を貼り付けてください。\n例：\nLAWSON\n2026/05/27 19:31\n牛乳 198円\nパン 158円\n合計 356円"}
              />
              <button type="button" className="command-button command-button--primary" onClick={analyze} disabled={analyzing}>
                {analyzing ? <LoaderCircle className="spin" size={17} /> : <TextCursorInput size={17} />} 文字を解析
              </button>
            </div>
          )}
        </div>
      </section>

      {analysisId && (
        <section className={`ai-review-notice ${reviewWarnings.length ? "ai-review-notice--attention" : ""}`}>
          <strong>AI解析結果の確認</strong>
          <span>登録前に、店舗名・日付・レシート合計・税区分・商品分類を確認してください。</span>
          {reviewWarnings.map((message, index) => (
            <em key={`${message}-${index}`}>{message}</em>
          ))}
          {receipt.totalPrice !== receipt.receiptDetails.reduce((sum, item) => sum + parseNumber(item.totalPrice), 0) && (
            <em>レシート合計と明細合計に差額があります。ポイント利用・クーポン・値引きなどを確認してください。</em>
          )}
        </section>
      )}
      {taxSelectionRequired && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="ai-tax-select-title">
          <section className="panel receipt-confirm-modal">
            <div>
              <h3 id="ai-tax-select-title">このレシートの価格は税抜ですか？税込ですか？</h3>
              <p>登録済み店舗の税区分が見つからなかったため、AIの判断は使わずここで選択します。</p>
            </div>
            <div className="receipt-confirm-actions">
              <button type="button" className="command-button" onClick={() => applyAiTaxSelection("0")}>税抜</button>
              <button type="button" className="command-button command-button--primary" onClick={() => applyAiTaxSelection("1")}>税込</button>
            </div>
          </section>
        </div>
      )}
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

function normalizeAiResult(raw: Record<string, unknown>): { receipt: ReceiptFormType; reviewWarnings: string[] } {
  const data = (raw.receiptInfo || raw.receipt || raw) as Record<string, unknown>;
  const details = ((data.receiptDetails || data.items || raw.receiptDetails || raw.items || []) as Record<string, unknown>[])
    .filter(Boolean)
    .map(item => {
      const total = parseNumber(item.totalPrice ?? item.amount ?? item.price);
      const quantity = parseNumber(item.quantity) || 1;
      const rawUnitPrice = item.unitPrice ?? item.unit_price;
      return {
        itemName: String(item.itemName || item.name || ""),
        category1: String(item.category1 || item.category || ""),
        category2: String(item.category2 || item.subCategory || ""),
        taxRate: parseNumber(item.taxRate ?? item.tax_rate) || 0.1,
        quantity,
        // 2026-07-03 Codex: If AI only returns a line total, derive unit price from quantity.
        unitPrice: rawUnitPrice === undefined || rawUnitPrice === null || rawUnitPrice === "" ? total / quantity : parseNumber(rawUnitPrice),
        discount: parseNumber(item.discount),
        totalPrice: total,
        taxExcludedUnitPrice: parseOptionalNumber(item.taxExcludedUnitPrice),
        taxExcludedTotalPrice: parseOptionalNumber(item.taxExcludedTotalPrice),
        taxIncludedUnitPrice: parseOptionalNumber(item.taxIncludedUnitPrice),
        taxIncludedTotalPrice: parseOptionalNumber(item.taxIncludedTotalPrice)
      } satisfies ReceiptItem;
    });

  const receiptDetails = details.length ? details : emptyReceipt().receiptDetails;
  const receiptTotal = parseNumber(data.totalPrice ?? data.total ?? data.amount);
  const reviewWarnings = Array.isArray(raw.reviewWarnings)
    ? raw.reviewWarnings.map(item => String(item)).filter(Boolean)
    : [];
  if (raw.needsReview && reviewWarnings.length === 0) {
    reviewWarnings.push("AI解析結果に確認が必要な項目があります。");
  }
  return {
    receipt: {
      invoiceRegistrationNumber: invoiceDigits(String(data.invoiceRegistrationNumber || data.invoiceNo || "")),
      supplierName: String(data.supplierName || data.storeName || data.shopName || ""),
      supplierImage: String(data.supplierImage || data.supplierLogo || ""),
      receiptDate: String(data.receiptDate || data.date || ""),
      receiptTime: String(data.receiptTime || data.time || ""),
      taxFlag: toTaxFlag(data.taxFlag ?? data.taxIncluded),
      totalPrice: receiptTotal || receiptDetails.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0),
      receiptDetails,
      needsReview: Boolean(raw.needsReview),
      reviewWarnings,
      pricesAreRaw: Boolean(data.pricesAreRaw || raw.needsTaxSelection),
      needsTaxSelection: Boolean(data.needsTaxSelection || raw.needsTaxSelection)
    },
    reviewWarnings
  };
}

function parseOptionalNumber(value: unknown): number | undefined {
  return value === undefined || value === null || value === "" ? undefined : parseNumber(value);
}
