import { Plus, Save, Trash2, WandSparkles } from "lucide-react";
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
  recalcItems,
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

  useEffect(() => {
    const next = initial || emptyReceipt();
    setForm(normalizeReceiptForForm(next, category2));
    setInvoiceInput(invoiceDigits(next.invoiceRegistrationNumber));
  }, [initial, category2]);

  const total = useMemo(
    () => form.receiptDetails.reduce((sum, item) => sum + parseNumber(item.totalPrice), 0),
    [form.receiptDetails]
  );
  const logoSrc = buildImageSrc(form.supplierImage);

  function patch(next: Partial<ReceiptFormType>) {
    setForm(current => ({ ...current, ...next }));
  }

  function updateTaxFlag(taxFlag: TaxFlag) {
    setForm(current => ({ ...current, taxFlag }));
  }

  function updateItem(index: number, patchItem: Partial<ReceiptItem>) {
    setForm(current => {
      const receiptDetails = current.receiptDetails.map((item, i) => {
        if (i !== index) return item;
        const next = normalizeReceiptItem({ ...item, ...patchItem });
        return { ...next, totalPrice: calcItemTotal(next, current.taxFlag, category2) };
      });
      return {
        ...current,
        receiptDetails,
        totalPrice: receiptDetails.reduce((sum, item) => sum + item.totalPrice, 0)
      };
    });
  }

  function addRow() {
    setForm(current => ({ ...current, receiptDetails: [...current.receiptDetails, { ...blankItem }] }));
  }

  function removeRow(index: number) {
    setForm(current => {
      const receiptDetails = current.receiptDetails.filter((_, i) => i !== index);
      const nextRows = receiptDetails.length ? receiptDetails : [{ ...blankItem }];
      return {
        ...current,
        receiptDetails: nextRows,
        totalPrice: nextRows.reduce((sum, item) => sum + parseNumber(item.totalPrice), 0)
      };
    });
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
        const taxFlag = String(found.taxFlag) === "1" ? "1" : "0";
        const receiptDetails = recalcItems(form.receiptDetails, taxFlag, category2);
        patch({
          invoiceRegistrationNumber: invoiceNo,
          supplierName: found.supplierName || form.supplierName,
          supplierImage: found.supplierLogo || form.supplierImage,
          taxFlag,
          receiptDetails,
          totalPrice: receiptDetails.reduce((sum, item) => sum + item.totalPrice, 0)
        });
      } else {
        patch({ invoiceRegistrationNumber: invoiceNo });
      }
    } finally {
      setLookupBusy(false);
    }
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
          return {
            ...normalized,
            totalPrice: parseNumber(normalized.totalPrice) || calcItemTotal(normalized, form.taxFlag, category2)
          };
        });

      if (!form.receiptDate || !form.receiptTime || receiptDetails.length === 0) {
        throw new Error("必須項目を入力してください。");
      }

      await onSubmit({
        ...form,
        invoiceRegistrationNumber,
        receiptDetails,
        totalPrice: receiptDetails.reduce((sum, item) => sum + parseNumber(item.totalPrice), 0)
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
            <span>合計</span>
            <strong>{yen(total)}</strong>
          </div>
        </div>

        <div className="form-grid form-grid--receipt">
          <label className="field invoice-field">
            <span>登録番号（空欄可）</span>
            <div className="prefix-input">
              <b>T</b>
              <input
                value={invoiceInput}
                inputMode="numeric"
                maxLength={13}
                onChange={event => setInvoiceInput(event.target.value.replace(/\D/g, "").slice(0, 13))}
                onBlur={() => {
                  if (invoiceInput.length === 13) lookupSupplier().catch(console.error);
                }}
              />
              <button type="button" onClick={lookupSupplier} disabled={lookupBusy || invoiceInput.length !== 13}>
                <WandSparkles size={16} /> 参照
              </button>
            </div>
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
            <legend>税区分</legend>
            <button type="button" className={form.taxFlag === "1" ? "is-active" : ""} onClick={() => updateTaxFlag("1")}>
              税込
            </button>
            <button type="button" className={form.taxFlag === "0" ? "is-active" : ""} onClick={() => updateTaxFlag("0")}>
              税抜
            </button>
          </fieldset>
        </div>

        <div className="logo-strip">
          <div className="logo-preview">
            {logoSrc ? <img src={logoSrc} alt="" /> : <span>LOGO</span>}
          </div>
          <label className="file-button">
            画像
            <input type="file" accept="image/*,.svg,.webp,.avif,.gif,.bmp,.ico,.tif,.tiff" onChange={event => onLogoFile(event.target.files?.[0])} />
          </label>
        </div>
      </section>

      <section className="panel">
        <div className="table-toolbar">
          <h3>明細</h3>
          <button type="button" className="command-button command-button--ghost" onClick={addRow}>
            <Plus size={17} /> 行追加
          </button>
        </div>

        <div className="line-table">
          <div className="line-table-head">
            <span>商品</span>
            <span>分類</span>
            <span>小分類</span>
            <span>数量</span>
            <span>単価</span>
            <span>割引</span>
            <span>金額</span>
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
                {category1.map(row => <option key={row.CATEGORY1_NAME} value={row.CATEGORY1_NAME}>{row.CATEGORY1_NAME}</option>)}
                </select>
              </label>
              <label className="line-field" data-label="小分類">
                <select value={item.category2} onChange={event => updateItem(index, { category2: event.target.value })}>
                <option value=""></option>
                {category2
                  .filter(row => !item.category1 || row.CATEGORY1_NAME === item.category1)
                  .map(row => <option key={`${row.CATEGORY1_NAME}-${row.CATEGORY2_NAME}`} value={row.CATEGORY2_NAME}>{row.CATEGORY2_NAME}</option>)}
                </select>
              </label>
              <label className="line-field" data-label="数量">
                <input type="number" value={numberFieldValue(item.quantity, false)} onChange={event => updateItem(index, { quantity: numberFieldParse(event.target.value) || 0 })} />
              </label>
              <label className="line-field" data-label="単価">
                <input type="number" value={numberFieldValue(item.unitPrice)} onChange={event => updateItem(index, { unitPrice: numberFieldParse(event.target.value) })} />
              </label>
              <label className="line-field" data-label="割引">
                <input type="number" value={numberFieldValue(item.discount)} onChange={event => updateItem(index, { discount: numberFieldParse(event.target.value) })} />
              </label>
              <label className="line-field line-field--output" data-label="金額">
                <output>{yen(item.totalPrice)}</output>
              </label>
              <div className="line-field line-field--action">
                <IconButton label="削除" icon={Trash2} variant="danger" onClick={() => removeRow(index)} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="sticky-submit">
        <div>
          <span>保存額</span>
          <strong>{yen(total)}</strong>
        </div>
        <button type="submit" className="command-button command-button--primary" disabled={busy}>
          <Save size={18} /> {busy ? "保存中" : submitLabel}
        </button>
      </div>
    </form>
  );
}

function normalizeReceiptForForm(receipt: ReceiptFormType, category2: Category2[]): ReceiptFormType {
  const receiptDetails = (receipt.receiptDetails.length ? receipt.receiptDetails : [{ ...blankItem }]).map(item => {
    const normalized = normalizeReceiptItem(item);
    return {
      ...normalized,
      totalPrice: normalized.totalPrice || calcItemTotal(normalized, receipt.taxFlag, category2)
    };
  });
  return {
    ...receipt,
    receiptDetails,
    totalPrice: receiptDetails.reduce((sum, item) => sum + parseNumber(item.totalPrice), 0)
  };
}

function normalizeReceiptItem(item: ReceiptItem): ReceiptItem {
  return {
    ...item,
    quantity: parseNumber(item.quantity) || 1,
    unitPrice: parseNumber(item.unitPrice),
    discount: parseNumber(item.discount),
    totalPrice: parseNumber(item.totalPrice)
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
