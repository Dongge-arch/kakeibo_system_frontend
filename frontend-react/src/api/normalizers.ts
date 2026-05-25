import type { Category2, ReceiptFlatRow, ReceiptItem, ReceiptSummary, TaxFlag } from "./types";

export function yen(value: number | string | null | undefined): string {
  /**
   * 金額を日本円表記へ変換する。
   *
   * Args:
   *   value: 数値または数値文字列。
   *
   * Returns:
   *   string: ¥付きの金額文字列。
   */
  // 金額表示はアプリ全体で円表記へ統一する。
  return `¥${Number(value || 0).toLocaleString("ja-JP")}`;
}

export function currentMonth(): string {
  /**
   * 現在年月をYYYY-MM形式で取得する。
   *
   * Returns:
   *   string: <input type="month">で使える年月文字列。
   */
  // <input type="month"> とAPI検索条件で共有するYYYY-MM形式。
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function today(): string {
  /**
   * 今日の日付をYYYY-MM-DD形式で取得する。
   *
   * Returns:
   *   string: <input type="date">で使える日付文字列。
   */
  // <input type="date"> の初期値として使うYYYY-MM-DD形式。
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

export function nowTime(): string {
  /**
   * 現在時刻をHH:mm形式で取得する。
   *
   * Returns:
   *   string: レシート登録の初期時刻。
   */
  // レシート登録の初期時刻として使うHH:mm形式。
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export function normalizeInvoice(value: string, optional = false): string {
  /**
   * インボイス登録番号をT+13桁へ正規化する。
   *
   * Args:
   *   value: 入力された登録番号。
   *   optional: 空欄を許可する場合はtrue。
   *
   * Returns:
   *   string: 正規化後の登録番号。
   */
  // DBとAPIでは必ずT + 13桁へ正規化して扱う。
  const raw = String(value || "").trim().toUpperCase();
  const digits = raw.startsWith("T") ? raw.slice(1) : raw;
  if (!digits && optional) return "";
  if (!/^\d{13}$/.test(digits)) {
    throw new Error("登録番号は13桁で入力してください。");
  }
  return `T${digits}`;
}

export function invoiceDigits(value: string | null | undefined): string {
  /**
   * インボイス登録番号から数字部分だけを取り出す。
   *
   * Args:
   *   value: T付きまたは数字のみの登録番号。
   *
   * Returns:
   *   string: 13桁の数字部分。
   */
  // 画面入力欄ではTを固定表示するため、数字部分だけを返す。
  return String(value || "").replace(/^T/i, "");
}

export function toTaxFlag(value: unknown): TaxFlag {
  /**
   * API値をReact側の税区分へ変換する。
   *
   * Args:
   *   value: APIまたはDBから返された税区分値。
   *
   * Returns:
   *   TaxFlag: "1"または"0"。
   */
  // 既存DBの数値/文字列差異をReact側のTaxFlagへ寄せる。
  return String(value) === "1" ? "1" : "0";
}

export function parseNumber(value: unknown): number {
  /**
   * 画面入力値を計算用の数値へ変換する。
   *
   * Args:
   *   value: 変換対象の値。
   *
   * Returns:
   *   number: 有効な数値。不正値は0。
   */
  // 空欄や不正値を0として扱い、計算処理を止めない。
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

export function monthRange(month: string): { dateFrom: string; dateTo: string } {
  /**
   * YYYY-MM形式の月から検索用の日付範囲を作る。
   *
   * Args:
   *   month: YYYY-MM形式の対象月。
   *
   * Returns:
   *   { dateFrom: string; dateTo: string }: 月初と月末の日付。
   */
  // 月検索用に対象月の開始日と終了日を作る。
  const [year, monthIndex] = month.split("-").map(Number);
  const end = new Date(year, monthIndex, 0).getDate();
  return {
    dateFrom: `${year}-${String(monthIndex).padStart(2, "0")}-01`,
    dateTo: `${year}-${String(monthIndex).padStart(2, "0")}-${String(end).padStart(2, "0")}`
  };
}

export function formatDateWithWeekday(value: string | null | undefined): string {
  /**
   * 日付文字列を曜日つき表示へ変換する。
   *
   * Args:
   *   value: 変換対象の日付文字列。
   *
   * Returns:
   *   string: 日本語ロケールの曜日つき日付。
   */
  // 履歴カード用に曜日つきの日付文字列へ変換する。
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short"
  });
}

export function buildImageSrc(value: string | null | undefined): string {
  /**
   * DB保存値からブラウザで表示できる画像srcを作る。
   *
   * Args:
   *   value: URL、Data URL、またはbase64画像文字列。
   *
   * Returns:
   *   string: img要素へ渡せるsrc文字列。
   */
  // DBに保存されたURL/base64/SVGをブラウザ表示可能なsrcへ変換する。
  const image = String(value || "").trim();
  if (!image || image === "null" || image === "undefined") return "";
  if (image.startsWith("data:image/")) return image;
  if (image.startsWith("http://") || image.startsWith("https://")) return image;
  if (image.startsWith("PHN2Z") || image.startsWith("PD94") || image.startsWith("PD")) {
    return `data:image/svg+xml;base64,${image}`;
  }
  if (image.startsWith("/9j/")) return `data:image/jpeg;base64,${image}`;
  if (image.startsWith("iVBOR")) return `data:image/png;base64,${image}`;
  if (image.startsWith("R0lGOD")) return `data:image/gif;base64,${image}`;
  if (image.startsWith("UklGR")) return `data:image/webp;base64,${image}`;
  if (image.startsWith("AAABAA")) return `data:image/x-icon;base64,${image}`;
  if (image.startsWith("Qk")) return `data:image/bmp;base64,${image}`;
  if (image.includes("ftypavif") || image.startsWith("AAAA")) return `data:image/avif;base64,${image}`;
  return `data:image/png;base64,${image}`;
}

export function calcItemTotal(item: ReceiptItem, taxFlag: TaxFlag, category2: Category2[]): number {
  /**
   * 明細の数量・単価・税区分から税込/税抜合計金額を計算する。
   *
   * Args:
   *   item: 計算対象の明細。
   *   taxFlag: 税込/税抜の区分。
   *   category2: 税率を引くための小分類一覧。
   *
   * Returns:
   *   number: 再計算後の明細金額。
   */
  // 税区分と小分類の税率を使って明細金額を再計算する。
  const found = category2.find(row => row.CATEGORY1_NAME === item.category1 && row.CATEGORY2_NAME === item.category2);
  const taxRate = Number(found?.TAX_RATE ?? item.taxRate ?? 0.1);
  const base = Math.max(0, (parseNumber(item.quantity) * parseNumber(item.unitPrice)) - parseNumber(item.discount));
  return Math.round(taxFlag === "1" ? base : base * (1 + taxRate));
}

export function recalcItems(items: ReceiptItem[], taxFlag: TaxFlag, category2: Category2[]): ReceiptItem[] {
  /**
   * 明細配列全体の金額を再計算する。
   *
   * Args:
   *   items: 再計算対象の明細一覧。
   *   taxFlag: 税込/税抜の区分。
   *   category2: 税率を引くための小分類一覧。
   *
   * Returns:
   *   ReceiptItem[]: 再計算済みの明細一覧。
   */
  // 税区分を切り替えた時、全明細の合計を一括再計算する。
  return items.map(item => ({
    ...item,
    quantity: parseNumber(item.quantity) || 1,
    unitPrice: parseNumber(item.unitPrice),
    discount: parseNumber(item.discount),
    totalPrice: calcItemTotal(item, taxFlag, category2)
  }));
}

export function groupReceipts(rows: ReceiptFlatRow[]): ReceiptSummary[] {
  /**
   * APIの明細行配列をレシート単位へまとめる。
   *
   * Args:
   *   rows: APIから返された明細行一覧。
   *
   * Returns:
   *   ReceiptSummary[]: レシートカード用に集約した一覧。
   */
  // APIの明細行配列を、画面カードで扱いやすいレシート単位へまとめる。
  const map = new Map<string, ReceiptSummary>();
  rows.forEach(row => {
    const key = row.receiptId;
    const supplierImage = receiptRowImage(row);
    const current = map.get(key) || {
      receiptId: row.receiptId,
      invoiceRegistrationNumber: row.invoiceRegistrationNumber || "",
      supplierName: row.supplierName || "",
      supplierImage,
      receiptDate: row.receiptDate || "",
      receiptTime: row.receiptTime || "",
      taxFlag: toTaxFlag(row.taxFlag),
      totalPrice: 0,
      receiptDetails: []
    };
    if (!current.supplierImage && supplierImage) {
      current.supplierImage = supplierImage;
    }
    const itemTotal = parseNumber(row.totalPrice);
    current.totalPrice += itemTotal;
    current.receiptDetails.push({
      itemName: row.itemName || "",
      category1: row.category1 || "",
      category2: row.category2 || "",
      quantity: parseNumber(row.quantity) || 1,
      unitPrice: parseNumber(row.unitPrice),
      totalPrice: itemTotal
    });
    map.set(key, current);
  });
  return Array.from(map.values());
}

function receiptRowImage(row: ReceiptFlatRow): string {
  /**
   * レシート行から店舗画像として使える値を取り出す。
   *
   * Args:
   *   row: APIから返された明細行。
   *
   * Returns:
   *   string: 画像候補文字列。
   */
  // 旧API/新APIで異なる画像フィールド名を吸収する。
  return row.supplierImage || row.img || row.supplierLogo || row.supplier_image || "";
}

export function fileToDataUrl(file: File): Promise<string> {
  /**
   * ファイルをData URLへ変換する。
   *
   * Args:
   *   file: 変換対象の画像ファイル。
   *
   * Returns:
   *   Promise<string>: Data URL文字列。
   */
  // ロゴやレシート画像をDB/APIへ渡せるData URLへ変換する。
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
