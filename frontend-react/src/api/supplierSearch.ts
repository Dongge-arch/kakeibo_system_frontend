import type { Invoice } from "./types";

/** 店舗名を表記ゆれに影響されない検索文字列へ変換する。 */
export function normalizeSupplierSearch(value: string): string {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ぁ-ゖ]/g, character => String.fromCharCode(character.charCodeAt(0) + 0x60))
    .replace(/[\s\-‐‑‒–—―・･.,、。/／\\()（）【】\[\]]/g, "");
}

/** 入力との関連度が高い店舗から順に返す。 */
export function rankSuppliers(rows: Invoice[], query: string, limit = 8): Invoice[] {
  const normalizedQuery = normalizeSupplierSearch(query);
  if (!normalizedQuery) return [];

  // 2026-11-05 Codex: 完全一致、前方一致、部分一致、文字順一致の順で候補を安定して並べる。
  return rows
    .map((row, index) => ({ row, index, score: supplierScore(row, normalizedQuery) }))
    .filter(item => Number.isFinite(item.score))
    .sort((left, right) => left.score - right.score || left.index - right.index)
    .slice(0, limit)
    .map(item => item.row);
}

function supplierScore(row: Invoice, query: string): number {
  const name = normalizeSupplierSearch(row.supplierName);
  const category = normalizeSupplierSearch(row.supplierCategory || "");
  const invoice = normalizeSupplierSearch(row.invoiceRegistrationNumber);
  if (name === query) return 0;
  if (name.startsWith(query)) return 10 + name.length - query.length;
  const nameIndex = name.indexOf(query);
  if (nameIndex >= 0) return 100 + nameIndex * 4 + name.length - query.length;
  if (category.startsWith(query)) return 220 + category.length;
  if (invoice.includes(query)) return 260 + invoice.indexOf(query);
  if (isSubsequence(query, name)) return 400 + name.length;
  return Number.POSITIVE_INFINITY;
}

function isSubsequence(query: string, target: string): boolean {
  let queryIndex = 0;
  for (const character of target) {
    if (character === query[queryIndex]) queryIndex += 1;
    if (queryIndex === query.length) return true;
  }
  return false;
}
