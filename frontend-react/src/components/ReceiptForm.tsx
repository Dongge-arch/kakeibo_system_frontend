import { Plus, Save, Store, Trash2, Undo2, WandSparkles } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import {
  buildImageSrc,
  calcItemTotal,
  fileToDataUrl,
  invoiceDigits,
  normalizeInvoice,
  nowTime,
  parseNumber,
  today,
  yen
} from "../api/normalizers";
import type { Category1, Category2, ReceiptForm as ReceiptFormType, ReceiptItem, TaxFlag } from "../api/types";
import { IconButton } from "./IconButton";

const blankItem: ReceiptItem = {
  itemName: "",
  category1: "",
  category2: "",
  quantity: 1,
  unitPrice: 0,
  discount: 0,
  totalPrice: 0
};

const priceAffectingKeys = new Set<keyof ReceiptItem>([
  "quantity",
  "unitPrice",
  "discount",
  "taxRate",
  "category1",
  "category2",
  "totalPrice"
]);

export function emptyReceipt(): ReceiptFormType {
  return {
    invoiceRegistrationNumber: "",
    supplierName: "",
    supplierImage: "",
    receiptDate: today(),
    receiptTime: nowTime(),
    taxFlag: "0",
    totalPrice: 0,
    receiptDetails: [{ ...blankItem }]
  };
}

type ReceiptFormProps = {
  category1: Category1[];
  category2: Category2[];
  initial?: ReceiptFormType;
  submitLabel?: string;
  busy?: boolean;
  compact?: boolean;
  onSubmit: (receipt: ReceiptFormType) => Promise<void>;
};

type SupplierLookupResult = {
  supplierName: string;
  supplierLogo?: string;
  taxFlag?: string | number;
};

export function ReceiptForm({
  category1,
  category2,
  initial,
  submitLabel = "登録",
  busy,
  compact,
  onSubmit
}: ReceiptFormProps) {
  const [form, setForm] = useState<ReceiptFormType>(() => normalizeReceiptForForm(initial || emptyReceipt(), category2));
  const [invoiceInput, setInvoiceInput] = useState(invoiceDigits(initial?.invoiceRegistrationNumber));
  const [lookupBusy, setLookupBusy] = useState(false);
  const [pendingTaxFlag, setPendingTaxFlag] = useState<TaxFlag | null>(null);
  const [pendingSupplier, setPendingSupplier] = useState<SupplierLookupResult | null>(null);
  const [removedItem, setRemovedItem] = useState<{ item: ReceiptItem; index: number } | null>(null);

  useEffect(() => {
    const next = initial || emptyReceipt();
    setForm(normalizeReceiptForForm(next, category2));
    setInvoiceInput(invoiceDigits(next.invoiceRegistrationNumber));
    setPendingTaxFlag(null);
    setPendingSupplier(null);
    setRemovedItem(null);
  }, [initial, category2]);

  const detailTotal = useMemo(
    () => form.receiptDetails.reduce((sum, item) => sum + parseNumber(item.totalPrice), 0),
    [form.receiptDetails]
  );
  const receiptTotal = parseNumber(form.totalPrice) || detailTotal;
  const totalDifference = receiptTotal - detailTotal;
  const logoSrc = buildImageSrc(form.supplierImage);

  function patch(next: Partial<ReceiptFormType>) {
    setForm(current => ({ ...current, ...next }));
  }

  function updateTaxFlag(taxFlag: TaxFlag) {
    if (taxFlag === form.taxFlag) return;
    setPendingTaxFlag(taxFlag);
  }

  function applyTaxFlag(taxFlag: TaxFlag) {
    setForm(current => {
      const receiptDetails = current.receiptDetails.map(item =>
        withTaxBreakdown(unitPriceForTaxFlag(normalizeReceiptItem(item), taxFlag), taxFlag, category2)
      );
      return {
        ...current,
        taxFlag,
        receiptDetails
      };
    });
    setPendingTaxFlag(null);
  }

  function updateItem(index: number, patchItem: Partial<ReceiptItem>) {
    setForm(current => {
      const affectsPrice = Object.keys(patchItem).some(key => priceAffectingKeys.has(key as keyof ReceiptItem));
      const receiptDetails = current.receiptDetails.map((item, i) => {
        if (i !== index) return item;
        const next = normalizeReceiptItem({ ...item, ...patchItem });
        return affectsPrice ? withTaxBreakdown(next, current.taxFlag, category2) : next;
      });
      const nextDetailTotal = receiptDetails.reduce((sum, item) => sum + parseNumber(item.totalPrice), 0);
      return {
        ...current,
        receiptDetails,
        totalPrice: parseNumber(current.totalPrice) || nextDetailTotal
      };
    });
  }

  function updateItemTotal(index: number, value: number) {
    setForm(current => {
      const receiptDetails = current.receiptDetails.map((item, i) => {
        if (i !== index) return item;
        return withManualTotal(normalizeReceiptItem(item), value, current.taxFlag, category2);
      });
      return {
        ...current,
        receiptDetails,
        totalPrice: parseNumber(current.totalPrice)
          || receiptDetails.reduce((sum, item) => sum + parseNumber(item.totalPrice), 0)
      };
    });
  }

  function recalculateTaxIncludedPrices() {
    setForm(current => {
      const receiptDetails = current.receiptDetails.map(item =>
        withTaxBreakdown(normalizeReceiptItem(item), "0", category2)
      );
      return {
        ...current,
        receiptDetails,
        totalPrice: receiptDetails.reduce((sum, item) => sum + parseNumber(item.totalPrice), 0)
      };
    });
  }

  function addRow() {
    setForm(current => ({ ...current, receiptDetails: [...current.receiptDetails, { ...blankItem }] }));
  }

  function removeRow(index: number) {
    setForm(current => {
      const item = current.receiptDetails[index];
      const receiptDetails = current.receiptDetails.filter((_, i) => i !== index);
      const nextRows = receiptDetails.length ? receiptDetails : [{ ...blankItem }];
      if (item) setRemovedItem({ item, index });
      return {
        ...current,
        receiptDetails: nextRows,
        totalPrice: nextRows.reduce((sum, item) => sum + parseNumber(item.totalPrice), 0)
      };
    });
  }

  function restoreRemovedRow() {
    if (!removedItem) return;
    setForm(current => {
      const currentRows = current.receiptDetails.length === 1 && isBlankItem(current.receiptDetails[0])
        ? []
        : current.receiptDetails;
      const receiptDetails = [...currentRows];
      receiptDetails.splice(Math.min(removedItem.index, receiptDetails.length), 0, removedItem.item);
      return {
        ...current,
        receiptDetails,
        totalPrice: receiptDetails.reduce((sum, item) => sum + parseNumber(item.totalPrice), 0)
      };
    });
    setRemovedItem(null);
  }

  async function lookupSupplier() {
    let invoiceNo = "";
    try {
      invoiceNo = normalizeInvoice(invoiceInput);
    } catch (error) {
      alert((error as Error).message);
      return;
    }

    setLookupBusy(true);
    try {
      const rows = await api.master.supplierByInvoice(invoiceNo);
      const found = rows?.[0];
      if (found) {
        patch({ invoiceRegistrationNumber: invoiceNo });
        setPendingSupplier(found);
      } else {
        patch({ invoiceRegistrationNumber: invoiceNo });
      }
    } finally {
      setLookupBusy(false);
    }
  }

  function applySupplier() {
    if (!pendingSupplier) return;
    const taxFlag: TaxFlag = String(pendingSupplier.taxFlag) === "1" ? "1" : "0";
    const changesTaxFlag = taxFlag !== form.taxFlag;
    const receiptDetails = changesTaxFlag
      ? form.receiptDetails.map(item =>
          withTaxBreakdown(unitPriceForTaxFlag(normalizeReceiptItem(item), taxFlag), taxFlag, category2)
        )
      : form.receiptDetails;
    patch({
      supplierName: pendingSupplier.supplierName || form.supplierName,
      supplierImage: pendingSupplier.supplierLogo || form.supplierImage,
      taxFlag,
      receiptDetails
    });
    setPendingSupplier(null);
  }

  async function onLogoFile(file?: File) {
    if (!file) return;
    patch({ supplierImage: await fileToDataUrl(file) });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const invoiceRegistrationNumber = invoiceInput.trim()
        ? normalizeInvoice(invoiceInput)
        : form.invoiceRegistrationNumber?.startsWith("A")
          ? form.invoiceRegistrationNumber
          : "";
      const receiptDetails = form.receiptDetails
        .filter(item => item.itemName || item.unitPrice || item.totalPrice)
        .map(item => {
          const normalized = normalizeReceiptItem(item);
          return hasTaxBreakdown(normalized)
            ? normalized
            : withTaxBreakdown(normalized, form.taxFlag, category2);
        });

      if (!form.receiptDate || !form.receiptTime || receiptDetails.length === 0) {
        throw new Error("必須項目を入力してください。");
      }

      await onSubmit({
        ...form,
        invoiceRegistrationNumber,
        receiptDetails,
        totalPrice: parseNumber(form.totalPrice)
          || receiptDetails.reduce((sum, item) => sum + parseNumber(item.totalPrice), 0)
      });
    } catch (error) {
      alert((error as Error).message);
    }
  }

  return (
    <form className={`receipt-form ${compact ? "receipt-form--compact" : ""}`} onSubmit={submit}>
      <section className="panel receipt-hero-panel">
        <div className="section-heading">
          <div>
            <span className="section-kicker">レシート</span>
            <h2>支出登録</h2>
          </div>
          <div className="total-pill">
            <label htmlFor="receipt-total">レシート合計</label>
            <div className="receipt-total-input">
              <span>¥</span>
              <input
                id="receipt-total"
                type="number"
                min="0"
                value={numberFieldValue(form.totalPrice)}
                onChange={event => patch({ totalPrice: numberFieldParse(event.target.value) })}
              />
            </div>
            <small>明細合計 {yen(detailTotal)}</small>
            {totalDifference !== 0 && <small>差額 {yen(totalDifference)}</small>}
          </div>
        </div>

        <div className="form-grid form-grid--receipt">
          <label className="field invoice-field">
            <span>インボイス登録番号（任意）</span>
            <div className="prefix-input">
              <b>T</b>
              <input
                value={invoiceInput}
                inputMode="numeric"
                maxLength={13}
                onChange={event => setInvoiceInput(event.target.value.replace(/\D/g, "").slice(0, 13))}
              />
              <button type="button" onClick={lookupSupplier} disabled={lookupBusy || invoiceInput.length !== 13}>
                <WandSparkles size={16} /> 店舗情報を取得
              </button>
            </div>
            <small className="field-hint">13桁の登録番号から店舗名・店舗画像・税区分を取得します。</small>
          </label>
          <label className="field">
            <span>店舗名（任意）</span>
            <input value={form.supplierName} placeholder="電気代・家賃などは空欄でも保存できます" onChange={event => patch({ supplierName: event.target.value })} />
          </label>
          <label className="field">
            <span>日付</span>
            <input type="date" value={form.receiptDate} onChange={event => patch({ receiptDate: event.target.value })} />
          </label>
          <label className="field">
            <span>時刻</span>
            <input type="time" value={form.receiptTime} onChange={event => patch({ receiptTime: event.target.value })} />
          </label>
          <fieldset className="segmented">
            <legend>単価の税区分</legend>
            <button type="button" className={form.taxFlag === "1" ? "is-active" : ""} onClick={() => updateTaxFlag("1")}>
              単価は税込
            </button>
            <button type="button" className={form.taxFlag === "0" ? "is-active" : ""} onClick={() => updateTaxFlag("0")}>
              単価は税抜
            </button>
            <small className="tax-mode-help">
              {form.taxFlag === "0"
                ? "入力した単価を税抜価格として、税込金額を計算します。"
                : "入力した単価を税込価格として扱います。"}
            </small>
          </fieldset>
        </div>

        <div className="logo-strip">
          <div className="logo-preview">
            {logoSrc ? <img src={logoSrc} alt="" /> : <span>店舗画像なし</span>}
          </div>
          <label className="file-button">
            店舗画像
            <input type="file" accept="image/*,.svg,.webp,.avif,.gif,.bmp,.ico,.tif,.tiff" onChange={event => onLogoFile(event.target.files?.[0])} />
          </label>
        </div>
      </section>

      <section className="panel">
        <div className="table-toolbar">
          <h3>明細</h3>
          <div className="toolbar-actions">
            {form.taxFlag === "0" && (
              <button
                type="button"
                className="command-button command-button--ghost"
                onClick={recalculateTaxIncludedPrices}
              >
                <WandSparkles size={17} /> 分類税率で税込価格を再計算
              </button>
            )}
            <button type="button" className="command-button command-button--ghost" onClick={addRow}>
              <Plus size={17} /> 行追加
            </button>
          </div>
        </div>

        <div className="line-table">
          <div className="line-table-head">
            <span>商品</span>
            <span>分類</span>
            <span>小分類</span>
            <span>数量</span>
            <span>{form.taxFlag === "0" ? "税抜単価" : "税込単価"}</span>
            <span>値引額</span>
            <span>税込金額</span>
            <span></span>
          </div>
          {form.receiptDetails.map((item, index) => (
            <div className="line-row" key={index}>
              <label className="line-field" data-label="商品">
                <input value={item.itemName} onChange={event => updateItem(index, { itemName: event.target.value })} />
              </label>
              <label className="line-field" data-label="分類">
                <select value={item.category1} onChange={event => updateItem(index, { category1: event.target.value, category2: "" })}>
                <option value=""></option>
                {category1.map(row => <option key={row.category1Name} value={row.category1Name}>{row.category1Name}</option>)}
                </select>
              </label>
              <label className="line-field" data-label="小分類">
                <select value={item.category2} onChange={event => updateItem(index, { category2: event.target.value })}>
                <option value=""></option>
                {category2
                  .filter(row => !item.category1 || row.category1Name === item.category1)
                  .map(row => <option key={`${row.category1Name}-${row.category2Name}`} value={row.category2Name}>{row.category2Name}</option>)}
                </select>
              </label>
              <label className="line-field" data-label="数量">
                <input
                  type="number"
                  min="1"
                  value={numberFieldValue(item.quantity)}
                  onChange={event => updateItem(index, { quantity: numberFieldParse(event.target.value) })}
                  onBlur={() => {
                    if (!parseNumber(item.quantity)) updateItem(index, { quantity: 1 });
                  }}
                />
              </label>
              <label className="line-field" data-label={form.taxFlag === "0" ? "税抜単価" : "税込単価"}>
                <input type="number" value={numberFieldValue(item.unitPrice)} onChange={event => updateItem(index, { unitPrice: numberFieldParse(event.target.value) })} />
              </label>
              <label className="line-field" data-label="値引額">
                <input
                  type="number"
                  min="0"
                  placeholder="50円引きなら50"
                  value={numberFieldValue(item.discount)}
                  onChange={event => updateItem(index, { discount: numberFieldParse(event.target.value) })}
                />
              </label>
              <label className="line-field line-field--total" data-label="税込金額">
                <input
                  type="number"
                  min="0"
                  value={numberFieldValue(item.totalPrice)}
                  onChange={event => updateItemTotal(index, numberFieldParse(event.target.value))}
                />
                <small>手入力した金額を優先</small>
              </label>
              <div className="line-field line-field--action">
                <IconButton label="削除" icon={Trash2} variant="danger" onClick={() => removeRow(index)} />
              </div>
            </div>
          ))}
        </div>
        <p className="receipt-detail-note">
          商品名または金額を入力した明細が保存されます。明細合計とレシート合計が一致しない場合でも保存できます。
        </p>
        {removedItem && (
          <div className="receipt-undo-notice" role="status">
            <span>明細を削除しました。</span>
            <button type="button" onClick={restoreRemovedRow}><Undo2 size={15} />元に戻す</button>
          </div>
        )}
      </section>

      <div className="sticky-submit">
        <div>
          <span>今回保存する支出額</span>
          <strong>{yen(receiptTotal)}</strong>
          {totalDifference !== 0 && <small>明細合計 {yen(detailTotal)} / 差額 {yen(totalDifference)}</small>}
        </div>
        <button type="submit" className="command-button command-button--primary" disabled={busy}>
          <Save size={18} /> {busy ? "保存中" : submitLabel}
        </button>
      </div>

      {pendingTaxFlag && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="tax-change-title">
          <section className="panel receipt-confirm-modal">
            <div className="receipt-confirm-icon"><WandSparkles size={21} /></div>
            <div>
              <h3 id="tax-change-title">税区分を変更しますか？</h3>
              <p>
                「単価は{pendingTaxFlag === "0" ? "税抜" : "税込"}」に変更し、
                入力済みの単価と値引額からすべての明細金額を再計算します。
              </p>
            </div>
            <div className="receipt-confirm-actions">
              <button type="button" className="command-button" onClick={() => setPendingTaxFlag(null)}>キャンセル</button>
              <button type="button" className="command-button command-button--primary" onClick={() => applyTaxFlag(pendingTaxFlag)}>
                再計算して変更
              </button>
            </div>
          </section>
        </div>
      )}

      {pendingSupplier && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="supplier-apply-title">
          <section className="panel receipt-confirm-modal">
            <div className="receipt-confirm-icon"><Store size={21} /></div>
            <div>
              <h3 id="supplier-apply-title">店舗情報を反映しますか？</h3>
              <p>
                「{pendingSupplier.supplierName || "取得した店舗"}」の店舗名・店舗画像・税区分を反映します。
                税区分が変わる場合は明細金額も再計算されます。
              </p>
            </div>
            <div className="receipt-confirm-actions">
              <button type="button" className="command-button" onClick={() => setPendingSupplier(null)}>キャンセル</button>
              <button type="button" className="command-button command-button--primary" onClick={applySupplier}>反映する</button>
            </div>
          </section>
        </div>
      )}
    </form>
  );
}

function isBlankItem(item: ReceiptItem): boolean {
  return !item.itemName
    && !item.category1
    && !item.category2
    && !parseNumber(item.unitPrice)
    && !parseNumber(item.discount)
    && !parseNumber(item.totalPrice);
}

function normalizeReceiptForForm(receipt: ReceiptFormType, category2: Category2[]): ReceiptFormType {
  const receiptDetails = (receipt.receiptDetails.length ? receipt.receiptDetails : [{ ...blankItem }]).map(item => {
    const normalized = unitPriceForTaxFlag(normalizeReceiptItem(item), receipt.taxFlag);
    return {
      ...normalized,
      totalPrice: normalized.totalPrice || calcItemTotal(normalized, receipt.taxFlag, category2)
    };
  });
  const detailTotal = receiptDetails.reduce((sum, item) => sum + parseNumber(item.totalPrice), 0);
  return {
    ...receipt,
    receiptDetails,
    totalPrice: parseNumber(receipt.totalPrice) || detailTotal
  };
}

function unitPriceForTaxFlag(item: ReceiptItem, taxFlag: TaxFlag): ReceiptItem {
  const storedPrice = taxFlag === "0"
    ? item.taxExcludedUnitPrice
    : item.taxIncludedUnitPrice;
  return storedPrice === undefined || storedPrice === null
    ? item
    : { ...item, unitPrice: parseNumber(storedPrice) };
}

function taxRateForItem(item: ReceiptItem, category2: Category2[]): number {
  const found = category2.find(row =>
    row.category1Name === item.category1 && row.category2Name === item.category2
  );
  return parseNumber(found?.taxRate ?? item.taxRate ?? 0.1);
}

function withTaxBreakdown(item: ReceiptItem, taxFlag: TaxFlag, category2: Category2[]): ReceiptItem {
  const taxRate = taxRateForItem(item, category2);
  const taxMultiplier = 1 + taxRate;
  const quantity = parseNumber(item.quantity) || 1;
  const unitPrice = parseNumber(item.unitPrice);
  const discount = parseNumber(item.discount);
  const baseTotal = Math.max(0, quantity * unitPrice - discount);
  if (taxFlag === "0") {
    const taxIncludedUnitPrice = Math.round(unitPrice * taxMultiplier);
    const taxIncludedTotalPrice = Math.round(baseTotal * taxMultiplier);
    return {
      ...item,
      taxRate,
      totalPrice: taxIncludedTotalPrice,
      taxExcludedUnitPrice: unitPrice,
      taxExcludedTotalPrice: baseTotal,
      taxIncludedUnitPrice,
      taxIncludedTotalPrice
    };
  }

  return {
    ...item,
    taxRate,
    totalPrice: baseTotal,
    taxExcludedUnitPrice: taxMultiplier ? Math.round(unitPrice / taxMultiplier) : unitPrice,
    taxExcludedTotalPrice: taxMultiplier ? Math.round(baseTotal / taxMultiplier) : baseTotal,
    taxIncludedUnitPrice: unitPrice,
    taxIncludedTotalPrice: baseTotal
  };
}

function withManualTotal(item: ReceiptItem, totalPrice: number, taxFlag: TaxFlag, category2: Category2[]): ReceiptItem {
  const taxRate = taxRateForItem(item, category2);
  const taxMultiplier = 1 + taxRate;
  const normalizedTotal = Math.max(0, parseNumber(totalPrice));
  if (taxFlag === "0") {
    const taxExcludedTotalPrice = taxMultiplier ? Math.round(normalizedTotal / taxMultiplier) : normalizedTotal;
    return {
      ...item,
      taxRate,
      totalPrice: normalizedTotal,
      taxExcludedUnitPrice: parseNumber(item.unitPrice),
      taxExcludedTotalPrice,
      taxIncludedUnitPrice: Math.round(parseNumber(item.unitPrice) * taxMultiplier),
      taxIncludedTotalPrice: normalizedTotal
    };
  }
  return {
    ...item,
    taxRate,
    totalPrice: normalizedTotal,
    taxExcludedUnitPrice: taxMultiplier ? Math.round(parseNumber(item.unitPrice) / taxMultiplier) : parseNumber(item.unitPrice),
    taxExcludedTotalPrice: taxMultiplier ? Math.round(normalizedTotal / taxMultiplier) : normalizedTotal,
    taxIncludedUnitPrice: parseNumber(item.unitPrice),
    taxIncludedTotalPrice: normalizedTotal
  };
}

function hasTaxBreakdown(item: ReceiptItem): boolean {
  return [
    item.taxExcludedUnitPrice,
    item.taxExcludedTotalPrice,
    item.taxIncludedUnitPrice,
    item.taxIncludedTotalPrice
  ].every(value => value !== undefined && value !== null);
}

function normalizeReceiptItem(item: ReceiptItem): ReceiptItem {
  return {
    ...item,
    quantity: parseNumber(item.quantity) || 1,
    unitPrice: parseNumber(item.unitPrice),
    discount: parseNumber(item.discount),
    taxRate: item.taxRate === undefined ? undefined : parseNumber(item.taxRate),
    totalPrice: parseNumber(item.totalPrice),
    taxExcludedUnitPrice: item.taxExcludedUnitPrice === undefined ? undefined : parseNumber(item.taxExcludedUnitPrice),
    taxExcludedTotalPrice: item.taxExcludedTotalPrice === undefined ? undefined : parseNumber(item.taxExcludedTotalPrice),
    taxIncludedUnitPrice: item.taxIncludedUnitPrice === undefined ? undefined : parseNumber(item.taxIncludedUnitPrice),
    taxIncludedTotalPrice: item.taxIncludedTotalPrice === undefined ? undefined : parseNumber(item.taxIncludedTotalPrice)
  };
}

function numberFieldValue(value: number | string | null | undefined, hideZero = true) {
  const parsed = parseNumber(value);
  if (hideZero && parsed === 0) return "";
  if (value === null || value === undefined) return "";
  return String(value);
}

function numberFieldParse(value: string) {
  return value.trim() === "" ? 0 : parseNumber(value);
}
