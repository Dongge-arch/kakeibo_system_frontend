import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  CreditCard,
  DownloadCloud,
  KeyRound,
  LogIn,
  Play,
  Save,
  ShieldCheck,
  ShoppingBag,
  Store,
  TrainFront,
  Trash2
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { AutoLinkagePlace, AutoLinkageRunResult } from "../api/types";

type Props = {
  notify: (message: string, tone?: "success" | "error" | "info") => void;
  featureEnabled: boolean;
  onOpenSettings: () => void;
};

type LinkageGroupKey = "transport" | "shopping" | "other";
type LinkageSupportStatus = "supported" | "planned";
type LinkageAutomationMode = "automatic" | "manual" | "planned";
type LinkageIcon = "train" | "shopping" | "store" | "etc" | "card";

type LinkageService = AutoLinkagePlace & {
  group: LinkageGroupKey;
  displayName: string;
  historyName: string;
  description: string;
  supportStatus: LinkageSupportStatus;
  automationMode: LinkageAutomationMode;
  icon: LinkageIcon;
};
type SupportedLinkageService = LinkageService & { supportStatus: "supported" };

const SERVICE_DEFINITIONS: LinkageService[] = [
  {
    connectionType: "SUICA",
    group: "transport",
    displayName: "Mobile Suica",
    supplierName: "東日本旅客鉄道株式会社",
    invoiceRegistrationNumber: "T9011001029597",
    historyName: "Mobile Suica利用履歴",
    description: "交通系ICカードの利用履歴を取り込みます。",
    supportStatus: "supported",
    automationMode: "manual",
    icon: "train",
    configured: false,
    enabled: false
  },
  {
    connectionType: "PASMO",
    group: "transport",
    displayName: "PASMO",
    supplierName: "株式会社パスモ",
    invoiceRegistrationNumber: "",
    historyName: "PASMO利用履歴",
    description: "PASMOの利用履歴を取り込みます。",
    supportStatus: "supported",
    automationMode: "manual",
    icon: "train",
    configured: false,
    enabled: false
  },
  {
    connectionType: "ICOCA",
    group: "transport",
    displayName: "ICOCA",
    supplierName: "西日本旅客鉄道株式会社",
    invoiceRegistrationNumber: "",
    historyName: "ICOCA利用履歴",
    description: "ICOCAの利用履歴を取り込みます。",
    supportStatus: "supported",
    automationMode: "manual",
    icon: "train",
    configured: false,
    enabled: false
  },
  {
    connectionType: "PITAPA",
    group: "transport",
    displayName: "PiTaPa",
    supplierName: "株式会社スルッとKANSAI",
    invoiceRegistrationNumber: "",
    historyName: "PiTaPa利用履歴",
    description: "PiTaPaの利用履歴を取り込みます。",
    supportStatus: "supported",
    automationMode: "manual",
    icon: "train",
    configured: false,
    enabled: false
  },
  {
    connectionType: "TOICA",
    group: "transport",
    displayName: "TOICA",
    supplierName: "東海旅客鉄道株式会社",
    invoiceRegistrationNumber: "",
    historyName: "TOICA利用履歴",
    description: "TOICAの利用履歴を取り込みます。",
    supportStatus: "supported",
    automationMode: "manual",
    icon: "train",
    configured: false,
    enabled: false
  },
  {
    connectionType: "MANACA",
    group: "transport",
    displayName: "manaca",
    supplierName: "株式会社エムアイシー",
    invoiceRegistrationNumber: "",
    historyName: "manaca利用履歴",
    description: "manacaの利用履歴を取り込みます。",
    supportStatus: "supported",
    automationMode: "manual",
    icon: "train",
    configured: false,
    enabled: false
  },
  {
    connectionType: "SUGOCA",
    group: "transport",
    displayName: "SUGOCA",
    supplierName: "九州旅客鉄道株式会社",
    invoiceRegistrationNumber: "",
    historyName: "SUGOCA利用履歴",
    description: "SUGOCAの利用履歴を取り込みます。",
    supportStatus: "supported",
    automationMode: "manual",
    icon: "train",
    configured: false,
    enabled: false
  },
  {
    connectionType: "NIMOCA",
    group: "transport",
    displayName: "nimoca",
    supplierName: "株式会社ニモカ",
    invoiceRegistrationNumber: "",
    historyName: "nimoca利用履歴",
    description: "nimocaの利用履歴を取り込みます。",
    supportStatus: "supported",
    automationMode: "manual",
    icon: "train",
    configured: false,
    enabled: false
  },
  {
    connectionType: "HAYAKAKEN",
    group: "transport",
    displayName: "はやかけん",
    supplierName: "福岡市交通局",
    invoiceRegistrationNumber: "",
    historyName: "はやかけん利用履歴",
    description: "はやかけんの利用履歴を取り込みます。",
    supportStatus: "supported",
    automationMode: "manual",
    icon: "train",
    configured: false,
    enabled: false
  },
  {
    connectionType: "KITACA",
    group: "transport",
    displayName: "Kitaca",
    supplierName: "北海道旅客鉄道株式会社",
    invoiceRegistrationNumber: "",
    historyName: "Kitaca利用履歴",
    description: "Kitacaの利用履歴を取り込みます。",
    supportStatus: "supported",
    automationMode: "manual",
    icon: "train",
    configured: false,
    enabled: false
  },
  {
    connectionType: "AMAZON",
    group: "shopping",
    displayName: "Amazon",
    supplierName: "Amazon",
    invoiceRegistrationNumber: "",
    historyName: "Amazon注文履歴",
    description: "Amazonの注文履歴を取り込みます。",
    supportStatus: "supported",
    automationMode: "manual",
    icon: "shopping",
    configured: false,
    enabled: false
  },
  {
    connectionType: "RAKUTEN",
    group: "shopping",
    displayName: "楽天市場",
    supplierName: "楽天グループ株式会社",
    invoiceRegistrationNumber: "",
    historyName: "楽天購入履歴",
    description: "楽天市場の購入履歴連携は準備中です。",
    supportStatus: "planned",
    automationMode: "planned",
    icon: "shopping",
    configured: false,
    enabled: false
  },
  {
    connectionType: "NITORI",
    group: "shopping",
    displayName: "Nitori",
    supplierName: "株式会社ニトリ",
    invoiceRegistrationNumber: "",
    historyName: "Nitori購入履歴",
    description: "Nitoriの購入履歴連携は準備中です。",
    supportStatus: "planned",
    automationMode: "planned",
    icon: "shopping",
    configured: false,
    enabled: false
  },
  {
    connectionType: "YAHOO_SHOPPING",
    group: "shopping",
    displayName: "Yahoo!ショッピング",
    supplierName: "LINEヤフー株式会社",
    invoiceRegistrationNumber: "",
    historyName: "Yahoo!ショッピング購入履歴",
    description: "Yahoo!ショッピングの購入履歴連携は準備中です。",
    supportStatus: "planned",
    automationMode: "planned",
    icon: "shopping",
    configured: false,
    enabled: false
  },
  {
    connectionType: "YODOBASHI",
    group: "shopping",
    displayName: "ヨドバシ.com",
    supplierName: "株式会社ヨドバシカメラ",
    invoiceRegistrationNumber: "",
    historyName: "ヨドバシ.com購入履歴",
    description: "ヨドバシ.comの購入履歴連携は準備中です。",
    supportStatus: "planned",
    automationMode: "planned",
    icon: "shopping",
    configured: false,
    enabled: false
  },
  {
    connectionType: "BELC",
    group: "shopping",
    displayName: "ベルク",
    supplierName: "ベルク",
    invoiceRegistrationNumber: "T8030001085963",
    historyName: "ベルク購入履歴",
    description: "ベルクの購入履歴を取り込みます。",
    supportStatus: "supported",
    automationMode: "automatic",
    icon: "store",
    configured: false,
    enabled: false
  },
  {
    connectionType: "ETC",
    group: "other",
    displayName: "ETC利用照会サービス",
    supplierName: "東日本高速道路株式会社",
    invoiceRegistrationNumber: "T9010001095716",
    historyName: "ETC利用明細",
    description: "ETC利用照会サービスの利用明細を取り込みます。",
    supportStatus: "supported",
    automationMode: "automatic",
    icon: "etc",
    configured: false,
    enabled: false
  }
];

const SERVICE_GROUPS: { key: LinkageGroupKey; title: string; description: string }[] = [
  { key: "transport", title: "交通カード", description: "Suica、PASMOなど交通系ICカードの利用履歴を管理します。" },
  { key: "shopping", title: "ショッピング", description: "Amazon、楽天、Nitoriなど購入履歴の連携候補を管理します。" },
  { key: "other", title: "その他", description: "ETCなど交通カード・ショッピング以外の連携を管理します。" }
];

function isSupportedService(service: LinkageService | null): service is SupportedLinkageService {
  return Boolean(service && service.supportStatus === "supported");
}

function serviceIcon(service: LinkageService) {
  if (service.icon === "train") return <TrainFront size={22} />;
  if (service.icon === "shopping") return <ShoppingBag size={22} />;
  if (service.icon === "store") return <Store size={22} />;
  if (service.icon === "etc") return <ShieldCheck size={22} />;
  return <CreditCard size={22} />;
}

function mergeSupportedPlaces(rows: AutoLinkagePlace[] | null | undefined): LinkageService[] {
  // APIに未作成の連携先が含まれない場合も、画面上の設定入口は常に表示する。
  return SERVICE_DEFINITIONS.map(defaultService => {
    const saved = (rows || []).find(place => place.connectionType === defaultService.connectionType);
    return saved ? { ...defaultService, ...saved } : defaultService;
  });
}

function runStatusLabel(result: AutoLinkageRunResult): string {
  if (result.status === "CAPTCHA_REQUIRED") return "画像認証が必要です";
  if (result.status === "OTP_REQUIRED") return "確認コードが必要です";
  if (result.status === "CHALLENGE_REQUIRED") return "Amazonの追加確認が必要です";
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
  const [places, setPlaces] = useState<LinkageService[]>(SERVICE_DEFINITIONS);
  const [selected, setSelected] = useState<LinkageService | null>(null);
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

  const automaticTargets = useMemo(
    () => places.filter(place => place.automationMode === "automatic"),
    [places]
  );
  const hasAutomaticEnabled = automaticTargets.some(place => Boolean(automaticSettings[place.connectionType]));
  const canSaveAutomatic = automaticTargets.some(place => place.configured);

  async function loadPlaces() {
    try {
      const rows = await api.autoLinkage.list();
      const supportedPlaces = mergeSupportedPlaces(Array.isArray(rows) ? rows : []);
      setPlaces(supportedPlaces);
      setAutomaticSettings(Object.fromEntries(
        supportedPlaces.map(place => [place.connectionType, Boolean(place.enabled)])
      ));
    } catch (error) {
      // 通信失敗時も画面の連携候補は消さず、再試行できる状態を維持する。
      setPlaces(SERVICE_DEFINITIONS);
      setAutomaticSettings({});
      notify((error as Error).message, "error");
    }
  }

  async function openManualSettings(place: LinkageService) {
    setRunResult(null);
    setCaptcha("");
    setRemoveConfirmOpen(false);
    if (!isSupportedService(place)) {
      setSelected(place);
      setAccountId("");
      setPassword("");
      notify(`${place.displayName}の連携は現在準備中です。`, "info");
      return;
    }

    setBusy(true);
    try {
      const detail = await api.autoLinkage.get(place.connectionType);
      setSelected({ ...place, ...detail });
      setAccountId(detail.accountId || "");
      setPassword("");
    } catch (error) {
      notify((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function saveAutomaticSetting() {
    setBusy(true);
    try {
      const targets = automaticTargets.filter(place => place.configured);
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
    if (!isSupportedService(selected)) return;
    if (!accountId.trim() || (!password && !selected.passwordRegistered)) {
      notify("会員IDとパスワードを入力してください。", "error");
      return;
    }
    setBusy(true);
    try {
      const result = await api.autoLinkage.update(selected.connectionType, {
        accountId: accountId.trim(),
        password,
        enabled: selected.automationMode === "automatic"
          ? Boolean(automaticSettings[selected.connectionType])
          : false
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
    if (!isSupportedService(selected)) return;
    setBusy(true);
    try {
      const result = await api.autoLinkage.run(selected.connectionType, { runAction: "start" });
      setRunResult(result);
      setCaptcha("");
      const defaultMessage = selected.connectionType === "SUICA"
        ? "画像認証を取得しました。"
        : `${selected.displayName}のデータ連携が完了しました。`;
      notify(result.message || defaultMessage, result.ok ? "success" : "info");
    } catch (error) {
      notify((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function submitVerificationCode() {
    if (!isSupportedService(selected) || !runResult?.challengeId || !captcha.trim()) return;
    setBusy(true);
    try {
      const result = await api.autoLinkage.run(selected.connectionType, {
        runAction: "submit",
        challengeId: runResult.challengeId,
        captcha: captcha.trim(),
        verificationCode: captcha.trim()
      });
      setRunResult(result);
      notify(result.message || `${selected.displayName}のデータ連携を実行しました。`, result.ok ? "success" : "error");
    } catch (error) {
      notify((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function removeAccount() {
    if (!isSupportedService(selected)) return;
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
            <p className="setting-description">連携したいサービスをカテゴリごとに選び、会員アカウントを設定します。</p>
          </div>
          <KeyRound size={26} />
        </div>

        <div className="linkage-board-grid">
          {SERVICE_GROUPS.map(group => {
            const groupPlaces = places.filter(place => place.group === group.key);
            return (
              <section className="linkage-board" key={group.key}>
                <div className="linkage-board-head">
                  <div>
                    <h3>{group.title}</h3>
                    <p>{group.description}</p>
                  </div>
                  <span>{groupPlaces.length}件</span>
                </div>
                <div className="manual-linkage-grid">
                  {groupPlaces.map(place => (
                    <button
                      key={place.connectionType}
                      type="button"
                      className={`manual-linkage-card ${selected?.connectionType === place.connectionType ? "is-selected" : ""} ${place.supportStatus === "planned" ? "is-planned" : ""}`}
                      disabled={busy}
                      onClick={() => openManualSettings(place)}
                    >
                      <span className="linkage-service-icon">
                        {serviceIcon(place)}
                      </span>
                      <span>
                        <strong>{place.displayName}</strong>
                        <small>{place.supportStatus === "planned" ? place.description : place.configured ? "ログイン情報設定済み" : "ログイン情報未設定"}</small>
                      </span>
                      <span className={`linkage-card-status ${place.configured ? "is-ready" : ""} ${place.supportStatus === "planned" ? "is-planned" : ""}`}>
                        {place.supportStatus === "planned" ? <Clock3 size={15} /> : place.configured ? <CheckCircle2 size={15} /> : <KeyRound size={15} />}
                        {place.supportStatus === "planned" ? "準備中" : place.configured ? "利用可能" : "設定"}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        {selected && (
          <div className="manual-linkage-settings">
            <div className="manual-linkage-heading">
              <div>
                <span className="section-kicker">Account Settings</span>
                <h3>{selected.displayName} ログイン設定</h3>
              </div>
              <span className={`status-badge ${selected.configured ? "is-enabled" : ""}`}>
                {selected.supportStatus === "planned" ? "準備中" : selected.configured ? "設定済み" : "未設定"}
              </span>
            </div>

            {selected.supportStatus === "planned" ? (
              <div className="linkage-notice linkage-notice--planned">
                <Clock3 size={17} />
                <span>{selected.displayName}は連携候補として表示しています。取り込み処理は未実装のため、ログイン情報はまだ保存しません。</span>
              </div>
            ) : (
              <>
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
              </>
            )}
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
              <strong>{selected.historyName}</strong>
              <p className="setting-description">
                {selected.supportStatus === "planned"
                  ? "このサービスの取り込み処理は準備中です。"
                  : selected.group === "transport"
                    ? `${selected.displayName}は取り込み時に画像認証または追加確認が必要です。`
                    : selected.connectionType === "AMAZON"
                      ? "Amazonは取り込み時にSMS等の確認コードが必要になる場合があります。"
                    : selected.connectionType === "ETC"
                      ? "ETC利用照会サービスの利用明細を今すぐ取得します。"
                      : `${selected.displayName}の購入履歴を今すぐ取得します。`}
              </p>
            </div>
            <button
              type="button"
              className="command-button linkage-run-button"
              disabled={busy || !featureEnabled || !isSupportedService(selected) || !selected.configured}
              onClick={runManualLinkage}
            >
              <Play size={17} />{busy ? "取り込み中..." : `${selected.displayName}履歴を取り込む`}
            </button>
            {selected.supportStatus === "planned" && (
              <p className="linkage-disabled-reason">連携処理が実装されるまで取り込みは実行できません。</p>
            )}
            {selected.supportStatus !== "planned" && !selected.configured && (
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
                  <button type="button" className="command-button command-button--primary" disabled={busy || !captcha.trim()} onClick={submitVerificationCode}>
                    <LogIn size={17} />画像認証を送信して連携
                  </button>
                  <button type="button" className="command-button" disabled={busy} onClick={runManualLinkage}>
                    画像を再取得
                  </button>
                </div>
              </div>
            )}
            {runResult?.status === "OTP_REQUIRED" && (
              <div className="suica-captcha-panel">
                <label className="field">
                  <span>{runResult.verificationLabel || "確認コード"}</span>
                  <input value={captcha} autoComplete="one-time-code" inputMode="numeric" onChange={event => setCaptcha(event.target.value)} />
                </label>
                <div className="auto-linkage-actions">
                  <button type="button" className="command-button command-button--primary" disabled={busy || !captcha.trim()} onClick={submitVerificationCode}>
                    <LogIn size={17} />確認コードを送信して連携
                  </button>
                  <button type="button" className="command-button" disabled={busy} onClick={runManualLinkage}>
                    確認コードを再取得
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
            {runResult && !["COMPLETED", "SUCCESS", "CAPTCHA_REQUIRED", "OTP_REQUIRED"].includes(runResult.status) && (
              <div className="auto-linkage-result auto-linkage-result--warning">
                <strong>{runStatusLabel(runResult)}</strong>
                <span>{runResult.message || "連携処理を完了できませんでした。"}</span>
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
            <p className="setting-description">無人実行に対応しているサービスの新しい履歴を毎日午前0時に自動で取り込みます。</p>
          </div>
          <span className={`status-badge ${hasAutomaticEnabled ? "is-enabled" : ""}`}>
            {hasAutomaticEnabled ? "自動取り込み中" : "停止中"}
          </span>
        </div>

        {automaticTargets.map(place => (
          <div className="linkage-service-card" key={place.connectionType}>
            <div className="linkage-service-icon">{serviceIcon(place)}</div>
            <div className="linkage-service-copy">
              <strong>{place.displayName}</strong>
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
          <div className="linkage-service-icon"><TrainFront size={24} /></div>
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

        {!canSaveAutomatic && (
          <div className="linkage-notice">
            <KeyRound size={17} />
            <span>自動実行に対応しているサービスのログイン情報を保存すると、自動取り込みを設定できます。</span>
          </div>
        )}
        <div className="auto-linkage-actions">
          <button
            type="button"
            className="command-button command-button--primary"
            disabled={busy || !featureEnabled || !canSaveAutomatic}
            onClick={saveAutomaticSetting}
          >
            <Save size={17} />自動取り込み設定を保存
          </button>
        </div>
      </section>

      {removeConfirmOpen && isSupportedService(selected) && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="remove-linkage-title">
          <section className="panel linkage-confirm-modal">
            <div className="linkage-confirm-icon"><Trash2 size={22} /></div>
            <div>
              <h3 id="remove-linkage-title">{selected.displayName}のログイン情報を削除しますか？</h3>
              <p>保存済みの会員ID・パスワードが削除されます。自動取り込みをONにしている場合は停止します。</p>
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
