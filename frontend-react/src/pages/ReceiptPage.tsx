import { useState } from "react";
import { api } from "../api/client";
import type { Category1, Category2, ReceiptForm as ReceiptFormType } from "../api/types";
import { emptyReceipt, ReceiptForm } from "../components/ReceiptForm";

type ReceiptPageProps = {
  category1: Category1[];
  category2: Category2[];
  onSaved: () => void;
  notify: (message: string, tone?: "success" | "error" | "info") => void;
};

export function ReceiptPage({ category1, category2, onSaved, notify }: ReceiptPageProps) {
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);

  async function submit(receipt: ReceiptFormType) {
    setBusy(true);
    try {
      const result = await api.receipt.create(receipt);
      notify(`登録しました: ${result.receiptId}`, "success");
      setVersion(current => current + 1);
      onSaved();
    } catch (error) {
      notify((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ReceiptForm
      key={version}
      category1={category1}
      category2={category2}
      initial={emptyReceipt()}
      submitLabel="登録する"
      busy={busy}
      onSubmit={submit}
    />
  );
}
