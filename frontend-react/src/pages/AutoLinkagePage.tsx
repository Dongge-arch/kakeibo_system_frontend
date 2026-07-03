import {
  AlertCircle,
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
  featureEnabled: boolean;
  onOpenSettings: () => void;
};

const DEFAULT_PLACES: AutoLinkagePlace[] = [
  {
    connectionType: "BELC",
    supplierName: "ベルク",
    invoiceRegistrationNumber: "T8030001085963",
    configured: false,
    enabled: false
  },
  {
    connectionType: "SUICA",
    supplierName: "東日本旅客鉄道株式会社",
    invoiceRegistrationNumber: "T9011001029597",
    configured: false,
    enabled: false
  },
  {
    connectionType: "ETC",
    supplierName: "東日本高速道路株式会社",
    invoiceRegistrationNumber: "T9010001095716",
    configured: false,
    enabled: false
  }
];

function serviceName(connectionType: AutoLinkagePlace["connectionType"]): string {
  if (connectionType === "BELC") return "ベルク";
  if (connectionType === "SUICA") return "Mobile Suica";
  return "ETC利用照会サービス";
}

function historyName(connectionType: AutoLinkagePlace["connectionType"]): string {
  if (connectionType === "BELC") return "ベルク購入履歴";
  if (connectionType === "SUICA") return "Mobile Suica利用履歴";
  return "ETC利用明細";
}

function serviceIcon(connectionType: AutoLinkagePlace["connectionType"]) {
  return connectionType === "BELC" ? <Store size={22} /> : <ShieldCheck size={22} />;
}

function mergeSupportedPlaces(rows: AutoLinkagePlace[] | null | undefined): AutoLinkagePlace[] {
  // APIに未作成の連携先が含まれない場合も、画面上の設定入口は常に表示する。
  return DEFAULT_PLACES.map(defaultPlace => {
    const saved = (rows || []).find(place => place.connectionType === defaultPlace.connectionType);
    return saved ? { ...defaultPlace, ...saved } : defaultPlace;
  });
}

function runStatusLabel(result: AutoLinkageRunResult): string {
  if (result.status === "CAPTCHA_REQUIRED") return "画像認証が必要です";
  if (
    result.status === "COMPLETED"
    && (result.insertedCount ?? 0) === 0
    && (result.registeredCount ?? 0) === 0
  ) return "新しい履歴はありません";
  if (result.status === "COMPLETED" || result.status === "SUCCESS") return "取り込み完了";
  if (result.status === "LOGIN_FAILED") return "ログインに失敗しました";
  return result.ok ? "取り込み処理が完了しました" : "取り込みに失敗しました";
}

export function AutoLinkagePage({ notify, featureEnabled, onOpenSettings }: Props) {
  const [places, setPlaces] = useState<AutoLinkagePlace[]>(DEFAULT_PLACES);
  const [selected, setSelected] = useState<AutoLinkagePlace | null>(null);
  const [accountId, setAccountId] = useState("");
  const [password, setPassword] = useState("");
  const [automaticSettings, setAutomaticSettings] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [runResult, setRunResult] = useState<AutoLinkageRunResult | null>(null);
  const [captcha, setCaptcha] = useState("");
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);

  useEffect(() => {
    loadPlaces();
  }, []);

  const belc = places.find(place => place.connectionType === "BELC");
  const etc = places.find(place => place.connectionType === "ETC");

  async function loadPlaces() {
    try {
      const rows = await api.autoLinkage.list();
      const supportedPlaces = mergeSupportedPlaces(Array.isArray(rows) ? rows : []);
      setPlaces(supportedPlaces);
      setAutomaticSettings(Object.fromEntries(
        supportedPlaces.map(place => [place.connectionType, Boolean(place.enabled)])
      ));
    } catch (error) {
      // 通信失敗時も設定入口を消さず、再試行可能な状態を維持する。
      setPlaces(DEFAULT_PLACES);
      setAutomaticSettings({});
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
      setRemoveConfirmOpen(false);
    } catch (error) {
      notify((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function saveAutomaticSetting() {
    setBusy(true);
    try {
      const targets = [belc, etc].filter((place): place is AutoLinkagePlace => Boolean(place?.configured));
      await Promise.all(targets.map(async place => {
        const detail = await api.autoLinkage.get(place.connectionType);
        await api.autoLinkage.update(place.connectionType, {
          accountId: detail.accountId || "",
          enabled: Boolean(automaticSettings[place.connectionType])
        });
      }));
      notify("自動データ連携の設定を保存しました。", "success");
      await loadPlaces();
    } catch (error) {
      notify((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function saveCredentials() {
    if (!selected) return;
    if (!accountId.trim() || (!password && !selected.passwordRegistered)) {
      notify("会員IDとパスワードを入力してください。", "error");
      return;
    }
    setBusy(true);
    try {
      const result = await api.autoLinkage.update(selected.connectionType, {
        accountId: accountId.trim(),
        password,
        enabled: selected.connectionType === "SUICA"
          ? false
          : Boolean(automaticSettings[selected.connectionType])
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
    if (!selected) return;
    setBusy(true);
    try {
      const result = await api.autoLinkage.remove(selected.connectionType);
      notify(result.message || "ログイン情報を削除しました。", "success");
      setSelected(null);
      setRemoveConfirmOpen(false);
      await loadPlaces();
    } catch (error) {
      notify((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auto-linkage-page">
      {!featureEnabled && (
        <section className="linkage-feature-notice">
          <AlertCircle size={20} />
          <div>
            <strong>出費自動連携は設定でOFFになっています</strong>
            <span>ログイン情報の設定と取り込みを使用するには、アプリ設定で機能をONにしてください。</span>
          </div>
          <button type="button" className="command-button" onClick={onOpenSettings}>
            設定を開く
          </button>
        </section>
      )}

      <section className="panel linkage-section">
        <div className="section-heading">
          <div>
            <span className="linkage-step-label">1</span>
            <h2>ログイン情報設定</h2>
            <p className="setting-description">利用するサービスを選び、会員アカウントを設定します。</p>
          </div>
          <KeyRound size={26} />
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
                {serviceIcon(place.connectionType)}
              </span>
              <span>
                <strong>{serviceName(place.connectionType)}</strong>
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
                <h3>{serviceName(selected.connectionType)} ログイン設定</h3>
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
              <button type="button" className="command-button command-button--primary" disabled={busy || !featureEnabled} onClick={saveCredentials}>
                <Save size={17} />{busy ? "保存中..." : "ログイン情報を保存"}
              </button>
              {selected.configured && (
                <button type="button" className="command-button command-button--danger" disabled={busy || !featureEnabled} onClick={() => setRemoveConfirmOpen(true)}>
                  <Trash2 size={17} />ログイン情報を削除
                </button>
              )}
            </div>
            <p className="setting-description">
              {selected.passwordRegistered
                ? "パスワードを入力しない場合は保存済みのパスワードを使用します。実際のログイン確認は取り込み時に行います。"
                : "ログイン情報を保存すると取り込みを実行できます。実際のログイン確認は取り込み時に行います。"}
            </p>

          </div>
        )}
      </section>

      <section className="panel linkage-section">
        <div className="section-heading">
          <div>
            <span className="linkage-step-label">2</span>
            <h2>今すぐ取り込み</h2>
            <p className="setting-description">選択したサービスの最新履歴を家計簿へ取り込みます。</p>
          </div>
          <DownloadCloud size={26} />
        </div>

        {selected ? (
          <div className="manual-linkage-settings linkage-run-panel">
            <div>
              <strong>{historyName(selected.connectionType)}</strong>
              <p className="setting-description">
                {selected.connectionType === "SUICA"
                  ? "Mobile Suicaは取り込み時に画像認証が必要です。"
                  : selected.connectionType === "ETC"
                    ? "ETC利用照会サービスの利用明細を今すぐ取得します。"
                    : "ベルクの購入履歴を今すぐ取得します。"}
              </p>
            </div>
            <button
              type="button"
              className="command-button linkage-run-button"
              disabled={busy || !featureEnabled || !selected.configured}
              onClick={runManualLinkage}
            >
              <Play size={17} />{busy ? "取り込み中..." : `${serviceName(selected.connectionType)}履歴を取り込む`}
            </button>
            {!selected.configured && (
              <p className="linkage-disabled-reason">ログイン情報を保存すると実行できます。</p>
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

            {runResult && ["COMPLETED", "SUCCESS"].includes(runResult.status) && (
              <div className="auto-linkage-result">
                <strong>{runStatusLabel(runResult)}</strong>
                <span>
                  取得 {runResult.fetchedCount ?? 0}件 / 新規 {runResult.insertedCount ?? 0}件 /
                  重複 {runResult.duplicateCount ?? 0}件 / 登録 {runResult.registeredCount ?? 0}件
                  {(runResult.failedCount ?? 0) > 0 && ` / 失敗 ${runResult.failedCount}件`}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="linkage-notice">
            <KeyRound size={17} />
            <span>先に上のサービスを選択して、ログイン情報を設定してください。</span>
          </div>
        )}
      </section>

      <section className="panel linkage-section linkage-section--automatic">
        <div className="section-heading">
          <div>
            <span className="linkage-step-label">3</span>
            <h2>自動取り込み設定</h2>
            <p className="setting-description">ベルクとETCの新しい履歴を毎日午前0時に自動で取り込みます。</p>
          </div>
          <span className={`status-badge ${Object.values(automaticSettings).some(Boolean) ? "is-enabled" : ""}`}>
            {Object.values(automaticSettings).some(Boolean) ? "自動取り込み中" : "停止中"}
          </span>
        </div>

        {[belc, etc].filter((place): place is AutoLinkagePlace => Boolean(place)).map(place => (
          <div className="linkage-service-card" key={place.connectionType}>
            <div className="linkage-service-icon">{serviceIcon(place.connectionType)}</div>
            <div className="linkage-service-copy">
              <strong>{serviceName(place.connectionType)}</strong>
              <span><CalendarClock size={15} /> 毎日 午前0時に実行</span>
              <small>EventBridgeから自動入力バッチを起動します。</small>
            </div>
            <label className="linkage-switch">
              <input
                type="checkbox"
                checked={Boolean(automaticSettings[place.connectionType])}
                disabled={busy || !featureEnabled || !place.configured}
                onChange={event => setAutomaticSettings(current => ({
                  ...current,
                  [place.connectionType]: event.target.checked
                }))}
              />
              <span>{automaticSettings[place.connectionType] ? "ON" : "OFF"}</span>
            </label>
          </div>
        ))}

        <div className="linkage-service-card">
          <div className="linkage-service-icon"><ShieldCheck size={24} /></div>
          <div className="linkage-service-copy">
            <strong>Mobile Suica</strong>
            <span><CalendarClock size={15} /> 手動取り込みのみ</span>
            <small>画像認証が必要なため、EventBridgeによる無人実行には対応できません。</small>
          </div>
          <label className="linkage-switch">
            <input type="checkbox" checked={false} disabled />
            <span>手動</span>
          </label>
        </div>

        {(!belc?.configured || !etc?.configured) && (
          <div className="linkage-notice">
            <KeyRound size={17} />
            <span>各サービスのログイン情報を保存すると、そのサービスの自動取り込みを設定できます。</span>
          </div>
        )}
        <div className="auto-linkage-actions">
          <button
            type="button"
            className="command-button command-button--primary"
            disabled={busy || !featureEnabled || (!belc?.configured && !etc?.configured)}
            onClick={saveAutomaticSetting}
          >
            <Save size={17} />自動取り込み設定を保存
          </button>
        </div>
      </section>

      {removeConfirmOpen && selected && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="remove-linkage-title">
          <section className="panel linkage-confirm-modal">
            <div className="linkage-confirm-icon"><Trash2 size={22} /></div>
            <div>
              <h3 id="remove-linkage-title">{serviceName(selected.connectionType)}のログイン情報を削除しますか？</h3>
              <p>保存済みの会員ID・パスワードが削除されます。ベルクの場合は自動取り込みも停止します。</p>
            </div>
            <div className="auto-linkage-actions linkage-confirm-actions">
              <button type="button" className="command-button" disabled={busy} onClick={() => setRemoveConfirmOpen(false)}>
                キャンセル
              </button>
              <button type="button" className="command-button command-button--danger" disabled={busy} onClick={removeAccount}>
                <Trash2 size={17} />削除する
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
