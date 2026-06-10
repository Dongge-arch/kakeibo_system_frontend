import {
  CalendarClock,
  CheckCircle2,
  DownloadCloud,
  KeyRound,
  LogIn,
  Play,
  Save,
  ShieldCheck,
  Store,
  Trash2
} from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { AutoLinkagePlace, AutoLinkageRunResult } from "../api/types";

type Props = {
  notify: (message: string, tone?: "success" | "error" | "info") => void;
};

export function AutoLinkagePage({ notify }: Props) {
  const [places, setPlaces] = useState<AutoLinkagePlace[]>([]);
  const [selected, setSelected] = useState<AutoLinkagePlace | null>(null);
  const [accountId, setAccountId] = useState("");
  const [password, setPassword] = useState("");
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [runResult, setRunResult] = useState<AutoLinkageRunResult | null>(null);
  const [captcha, setCaptcha] = useState("");

  useEffect(() => {
    loadPlaces();
  }, []);

  const belc = places.find(place => place.connectionType === "BELC");

  async function loadPlaces() {
    try {
      const rows = await api.autoLinkage.list();
      setPlaces(rows);
      setAutoEnabled(Boolean(rows.find(place => place.connectionType === "BELC")?.enabled));
    } catch (error) {
      notify((error as Error).message, "error");
    }
  }

  async function openManualSettings(place: AutoLinkagePlace) {
    setBusy(true);
    try {
      const detail = await api.autoLinkage.get(place.connectionType);
      setSelected(detail);
      setAccountId(detail.accountId || "");
      setPassword("");
      setRunResult(null);
      setCaptcha("");
    } catch (error) {
      notify((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function saveAutomaticSetting() {
    if (!belc) return;
    setBusy(true);
    try {
      const detail = await api.autoLinkage.get("BELC");
      const result = await api.autoLinkage.update("BELC", {
        accountId: detail.accountId || "",
        enabled: autoEnabled
      });
      notify(result.message || "自動データ連携の設定を保存しました。", "success");
      await loadPlaces();
    } catch (error) {
      notify((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function saveCredentials() {
    if (!selected) return;
    setBusy(true);
    try {
      const result = await api.autoLinkage.update(selected.connectionType, {
        accountId,
        password,
        enabled: selected.connectionType === "BELC" ? autoEnabled : false
      });
      notify(result.message || "ログイン情報を保存しました。", "success");
      await loadPlaces();
      await openManualSettings(selected);
    } catch (error) {
      notify((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCredentials() {
    if (!selected) return;
    setBusy(true);
    try {
      const result = await api.autoLinkage.login(selected.connectionType, { accountId, password });
      notify(result.message || "ログイン情報を確認しました。", "success");
      await openManualSettings(selected);
    } catch (error) {
      notify((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function runManualLinkage() {
    if (!selected) return;
    setBusy(true);
    try {
      const result = await api.autoLinkage.run(selected.connectionType, { runAction: "start" });
      setRunResult(result);
      setCaptcha("");
      const defaultMessage = selected.connectionType === "SUICA"
        ? "画像認証を取得しました。"
        : "ベルクのデータ連携が完了しました。";
      notify(result.message || defaultMessage, result.ok ? "success" : "info");
    } catch (error) {
      notify((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function submitSuicaCaptcha() {
    if (!selected || !runResult?.challengeId || !captcha.trim()) return;
    setBusy(true);
    try {
      const result = await api.autoLinkage.run(selected.connectionType, {
        runAction: "submit",
        challengeId: runResult.challengeId,
        captcha: captcha.trim()
      });
      setRunResult(result);
      notify(result.message || "Suicaのデータ連携を実行しました。", result.ok ? "success" : "error");
    } catch (error) {
      notify((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function removeAccount() {
    if (!selected || !window.confirm(`${selected.supplierName}のログイン情報を削除しますか。`)) return;
    setBusy(true);
    try {
      const result = await api.autoLinkage.remove(selected.connectionType);
      notify(result.message || "ログイン情報を削除しました。", "success");
      setSelected(null);
      await loadPlaces();
    } catch (error) {
      notify((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auto-linkage-page">
      <section className="panel linkage-section linkage-section--automatic">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Automatic Linkage</span>
            <h2>自動データ連携</h2>
            <p className="setting-description">有効にすると、毎日午前0時に新しい購入履歴を自動で取り込みます。</p>
          </div>
          <span className={`status-badge ${autoEnabled ? "is-enabled" : ""}`}>
            {autoEnabled ? "自動連携中" : "停止中"}
          </span>
        </div>

        <div className="linkage-service-card">
          <div className="linkage-service-icon"><Store size={24} /></div>
          <div className="linkage-service-copy">
            <strong>ベルク</strong>
            <span><CalendarClock size={15} /> 毎日 午前0時に実行</span>
            <small>現在、自動データ連携に対応しているサービスはベルクのみです。</small>
          </div>
          <label className="linkage-switch">
            <input
              type="checkbox"
              checked={autoEnabled}
              disabled={busy || !belc?.configured}
              onChange={event => setAutoEnabled(event.target.checked)}
            />
            <span>{autoEnabled ? "ON" : "OFF"}</span>
          </label>
        </div>

        {!belc?.configured && (
          <div className="linkage-notice">
            <KeyRound size={17} />
            <span>先に手動データ連携からベルクのログイン情報を保存してください。</span>
          </div>
        )}
        <div className="auto-linkage-actions">
          <button
            type="button"
            className="command-button command-button--primary"
            disabled={busy || !belc?.configured}
            onClick={saveAutomaticSetting}
          >
            <Save size={17} />自動連携設定を保存
          </button>
        </div>
      </section>

      <section className="panel linkage-section">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Manual Linkage</span>
            <h2>手動データ連携</h2>
            <p className="setting-description">サービスを選択してログイン情報を保存すると、必要な時にすぐデータを取り込めます。</p>
          </div>
          <DownloadCloud size={26} />
        </div>

        <div className="manual-linkage-grid">
          {places.map(place => (
            <button
              key={place.connectionType}
              type="button"
              className={`manual-linkage-card ${selected?.connectionType === place.connectionType ? "is-selected" : ""}`}
              disabled={busy}
              onClick={() => openManualSettings(place)}
            >
              <span className="linkage-service-icon">
                {place.connectionType === "BELC" ? <Store size={22} /> : <ShieldCheck size={22} />}
              </span>
              <span>
                <strong>{place.connectionType === "BELC" ? "ベルク" : "Mobile Suica"}</strong>
                <small>{place.configured ? "ログイン情報設定済み" : "ログイン情報未設定"}</small>
              </span>
              <span className={`linkage-card-status ${place.configured ? "is-ready" : ""}`}>
                {place.configured ? <CheckCircle2 size={15} /> : <KeyRound size={15} />}
                {place.configured ? "利用可能" : "設定"}
              </span>
            </button>
          ))}
        </div>

        {selected && (
          <div className="manual-linkage-settings">
            <div className="manual-linkage-heading">
              <div>
                <span className="section-kicker">Account Settings</span>
                <h3>{selected.connectionType === "BELC" ? "ベルク" : "Mobile Suica"} ログイン設定</h3>
              </div>
              <span className={`status-badge ${selected.configured ? "is-enabled" : ""}`}>
                {selected.configured ? "設定済み" : "未設定"}
              </span>
            </div>

            <div className="linkage-credential-grid">
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
            </div>

            <div className="auto-linkage-actions">
              <button type="button" className="command-button command-button--primary" disabled={busy} onClick={saveCredentials}>
                <Save size={17} />{busy ? "処理中..." : "ログイン情報を保存"}
              </button>
              <button type="button" className="command-button" disabled={busy} onClick={verifyCredentials}>
                <LogIn size={17} />{busy ? "処理中..." : "ログイン情報を確認"}
              </button>
              <button
                type="button"
                className="command-button linkage-run-button"
                disabled={busy || !selected.configured}
                onClick={runManualLinkage}
              >
                <Play size={17} />{busy ? "連携実行中..." : "今すぐデータ連携"}
              </button>
              {selected.configured && (
                <button type="button" className="command-button command-button--danger" disabled={busy} onClick={removeAccount}>
                  <Trash2 size={17} />ログイン情報を削除
                </button>
              )}
            </div>
            <p className="setting-description">
              {selected.passwordRegistered
                ? "パスワードを入力しない場合は、保存済みのパスワードを使用します。"
                : "ログイン情報を保存すると、認証確認とデータ連携を実行できます。"}
            </p>

            {selected.connectionType === "SUICA" && (
              <p className="setting-description">
                Mobile Suicaは実行時に画像認証が必要です。表示された文字を入力すると利用履歴を取り込みます。
              </p>
            )}

            {runResult?.status === "CAPTCHA_REQUIRED" && runResult.captchaImage && (
              <div className="suica-captcha-panel">
                <img src={runResult.captchaImage} alt="Mobile Suica 画像認証" />
                <label className="field">
                  <span>画像に表示されている文字</span>
                  <input value={captcha} autoComplete="off" onChange={event => setCaptcha(event.target.value)} />
                </label>
                <div className="auto-linkage-actions">
                  <button type="button" className="command-button command-button--primary" disabled={busy || !captcha.trim()} onClick={submitSuicaCaptcha}>
                    <LogIn size={17} />画像認証を送信して連携
                  </button>
                  <button type="button" className="command-button" disabled={busy} onClick={runManualLinkage}>
                    画像を再取得
                  </button>
                </div>
              </div>
            )}

            {runResult && runResult.status !== "CAPTCHA_REQUIRED" && (
              <div className="auto-linkage-result">
                <strong>データ連携結果: {runResult.status}</strong>
                <span>
                  取得 {runResult.fetchedCount ?? 0}件 / 新規 {runResult.insertedCount ?? 0}件 /
                  重複 {runResult.duplicateCount ?? 0}件 / 登録 {runResult.registeredCount ?? 0}件
                </span>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
