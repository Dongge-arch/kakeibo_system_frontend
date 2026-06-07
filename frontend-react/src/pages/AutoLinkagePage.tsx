import { Cable, ChevronRight, KeyRound, LogIn, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { AutoLinkagePlace } from "../api/types";

type Props = {
  notify: (message: string, tone?: "success" | "error" | "info") => void;
};

export function AutoLinkagePage({ notify }: Props) {
  const [places, setPlaces] = useState<AutoLinkagePlace[]>([]);
  const [selected, setSelected] = useState<AutoLinkagePlace | null>(null);
  const [accountId, setAccountId] = useState("");
  const [password, setPassword] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadPlaces();
  }, []);

  async function loadPlaces() {
    try {
      setPlaces(await api.autoLinkage.list());
    } catch (error) {
      notify((error as Error).message, "error");
    }
  }

  async function openDetail(place: AutoLinkagePlace) {
    setBusy(true);
    try {
      const detail = await api.autoLinkage.get(place.connectionType);
      setSelected(detail);
      setAccountId(detail.accountId || "");
      setPassword("");
      setEnabled(detail.enabled);
    } catch (error) {
      notify((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!selected) return;
    setBusy(true);
    try {
      const result = await api.autoLinkage.update(selected.connectionType, { accountId, password, enabled });
      notify(result.message || "自動連携設定を保存しました。", "success");
      await loadPlaces();
      await openDetail(selected);
    } catch (error) {
      notify((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function login() {
    if (!selected) return;
    setBusy(true);
    try {
      const result = await api.autoLinkage.login(selected.connectionType, { accountId, password });
      notify(result.message || "認証情報を確認しました。", "success");
      await openDetail(selected);
    } catch (error) {
      notify((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function removeAccount() {
    if (!selected || !window.confirm(`${selected.supplierName}の会員アカウントを削除しますか。`)) return;
    setBusy(true);
    try {
      const result = await api.autoLinkage.remove(selected.connectionType);
      notify(result.message || "会員アカウントを削除しました。", "success");
      setSelected(null);
      await loadPlaces();
    } catch (error) {
      notify((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  if (selected) {
    return (
      <section className="panel auto-linkage-detail">
        <button type="button" className="text-button" onClick={() => setSelected(null)}>対応サービス一覧へ戻る</button>
        <div className="section-heading">
          <div>
            <span className="section-kicker">Auto Linkage</span>
            <h2>{selected.supplierName}</h2>
          </div>
          <span className={`status-badge ${enabled ? "is-enabled" : ""}`}>{enabled ? "連携中" : "停止中"}</span>
        </div>
        <div className="auto-linkage-form">
          <label className="toggle-row">
            <span>自動連携を有効にする</span>
            <input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} />
          </label>
          <label className="field">
            <span>会員ID・メールアドレス</span>
            <input value={accountId} autoComplete="username" onChange={event => setAccountId(event.target.value)} />
          </label>
          <label className="field">
            <span>パスワード</span>
            <input
              value={password}
              type="password"
              autoComplete="current-password"
              placeholder={selected.passwordRegistered ? "変更する場合のみ入力" : "パスワードを入力"}
              onChange={event => setPassword(event.target.value)}
            />
          </label>
          <div className="auto-linkage-actions">
            <button type="button" className="command-button command-button--primary" disabled={busy} onClick={save}>
              <Save size={17} />設定を保存
            </button>
            <button type="button" className="command-button" disabled={busy} onClick={login}>
              <LogIn size={17} />認証情報を確認
            </button>
            {selected.configured && (
              <button type="button" className="command-button command-button--danger" disabled={busy} onClick={removeAccount}>
                <Trash2 size={17} />アカウントを削除
              </button>
            )}
          </div>
          <p className="setting-description">
            入力した会員情報は、自動連携時に各サービスの公式サイトへログインするために使用します。
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <span className="section-kicker">Auto Linkage</span>
          <h2>対応サービス</h2>
        </div>
        <Cable size={24} />
      </div>
      <div className="auto-linkage-list">
        {places.map(place => (
          <button key={place.connectionType} type="button" className="auto-linkage-row" disabled={busy} onClick={() => openDetail(place)}>
            <span className="auto-linkage-icon"><KeyRound size={20} /></span>
            <span>
              <strong>{place.supplierName}</strong>
              <small>{place.configured ? place.enabled ? "自動連携中" : "設定済み・停止中" : "未設定"}</small>
            </span>
            <span className="auto-linkage-detail-label">詳細 <ChevronRight size={17} /></span>
          </button>
        ))}
      </div>
    </section>
  );
}
