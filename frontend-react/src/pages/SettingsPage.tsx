import {
  ChartNoAxesCombined,
  KeyRound,
  LockKeyhole,
  LogIn,
  LogOut,
  Mail,
  MonitorCheck,
  ImagePlus,
  RefreshCw,
  Save,
  ShieldCheck,
  UserPlus
} from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";
import type { AppSettings, AuthSession } from "../api/types";
import { t } from "../i18n";

type SettingsPageProps = {
  session: AuthSession | null;
  settings: AppSettings;
  onPreviewSettings: (settings: AppSettings) => void;
  login: (email: string, password: string) => Promise<AuthSession>;
  register: (email: string, password: string) => Promise<AuthSession>;
  logout: () => Promise<void>;
  updateProfile: (profile: { nickname: string; avatarImage?: string }) => Promise<AuthSession>;
  previewProfile: (profile: { nickname?: string; avatarImage?: string }) => void;
  notify: (message: string, tone?: "success" | "error" | "info") => void;
};

type AuthMode = "login" | "register" | "reset";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SettingsPage({
  session,
  settings,
  onPreviewSettings,
  login,
  register,
  logout,
  updateProfile,
  previewProfile,
  notify
}: SettingsPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [issuedToken, setIssuedToken] = useState("");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [attemptedAuth, setAttemptedAuth] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileName, setProfileName] = useState(session?.nickname || "");
  const [profileAvatar, setProfileAvatar] = useState(session?.avatarImage || "");
  const [cropImage, setCropImage] = useState("");
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffsetX, setCropOffsetX] = useState(0);
  const [cropOffsetY, setCropOffsetY] = useState(0);
  const [draft, setDraft] = useState<AppSettings>(settings);
  const autosaveTimer = useRef<number | null>(null);
  const cropObjectUrl = useRef<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const cleanEmail = useMemo(() => email.trim().toLowerCase(), [email]);

  const emailError = attemptedAuth && !emailPattern.test(cleanEmail)
    ? "有効なメールアドレスを入力してください。"
    : "";
  const passwordError = attemptedAuth && authMode !== "reset" && (!password || (authMode === "register" && password.length < 8))
    ? authMode === "register" ? "8文字以上で入力してください。" : "パスワードを入力してください。"
    : "";
  const resetPasswordError = attemptedAuth && authMode === "reset" && resetToken && newPassword.length < 8
    ? "新しいパスワードは8文字以上で入力してください。"
    : "";

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  useEffect(() => {
    setProfileName(session?.nickname || "");
    setProfileAvatar(session?.avatarImage || "");
  }, [session?.nickname, session?.avatarImage]);

  useEffect(() => {
    if (!session) return;
    previewProfile({
      nickname: profileName || session.nickname,
      avatarImage: profileAvatar
    });
  }, [profileName, profileAvatar]);

  useEffect(() => {
    return () => {
      if (autosaveTimer.current) {
        window.clearTimeout(autosaveTimer.current);
      }
      revokeCropObjectUrl();
    };
  }, []);

  function patch(next: Partial<AppSettings>) {
    const merged = { ...draft, ...next };
    setDraft(merged);
    onPreviewSettings(merged);
    scheduleAutosave(merged);
  }

  function scheduleAutosave(next: AppSettings) {
    if (!session) return;
    if (autosaveTimer.current) {
      window.clearTimeout(autosaveTimer.current);
    }
    autosaveTimer.current = window.setTimeout(() => {
      api.settings.save(next).catch(error => notify((error as Error).message, "error"));
    }, 450);
  }

  function validateEmail() {
    if (!emailPattern.test(cleanEmail)) {
      notify("有効なメールアドレスを入力してください。", "error");
      return null;
    }
    return cleanEmail;
  }

  async function submitAuth(event: FormEvent) {
    event.preventDefault();
    setAttemptedAuth(true);
    const normalizedEmail = validateEmail();
    if (!normalizedEmail) return;

    setAuthBusy(true);
    try {
      if (authMode === "login") {
        if (!password) {
          notify("パスワードを入力してください。", "error");
          return;
        }
        await login(normalizedEmail, password);
        notify("ログインしました。", "success");
        setPassword("");
        setAttemptedAuth(false);
        return;
      }

      if (authMode === "register") {
        if (password.length < 8) {
          notify("新規登録のパスワードは8文字以上で入力してください。", "error");
          return;
        }
        await register(normalizedEmail, password);
        notify("アカウントを作成してログインしました。", "success");
        setPassword("");
        setAttemptedAuth(false);
        return;
      }

      if (!resetToken) {
        const result = await api.auth.requestPasswordReset(normalizedEmail);
        const token = result.resetToken || "";
        setIssuedToken(token);
        setResetToken(token);
        notify(result.message || "リセットコードを発行しました。", "success");
        return;
      }

      if (newPassword.length < 8) {
        notify("新しいパスワードは8文字以上で入力してください。", "error");
        return;
      }
      const result = await api.auth.resetPassword(normalizedEmail, resetToken, newPassword);
      notify(result.message || "パスワードを更新しました。", "success");
      setAuthMode("login");
      setPassword("");
      setNewPassword("");
      setResetToken("");
      setIssuedToken("");
      setAttemptedAuth(false);
    } catch (error) {
      notify((error as Error).message, "error");
    } finally {
      setAuthBusy(false);
    }
  }

  function switchAuthMode(mode: AuthMode) {
    setAuthMode(mode);
    setAttemptedAuth(false);
    if (mode !== "reset") {
      setResetToken("");
      setIssuedToken("");
      setNewPassword("");
    }
  }

  async function updateAccountProfile() {
    if (!profileName.trim()) {
      notify("表示名を入力してください。", "error");
      return;
    }
    setProfileBusy(true);
    try {
      await updateProfile({ nickname: profileName.trim(), avatarImage: profileAvatar });
      notify("プロフィールを更新しました。", "success");
    } catch (error) {
      notify((error as Error).message, "error");
    } finally {
      setProfileBusy(false);
    }
  }

  async function chooseAvatar(file: File | null) {
    if (!file) return;
    if (file.type && !file.type.startsWith("image/")) {
      notify("画像ファイルを選択してください。", "error");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      notify("画像ファイルは12MB以下にしてください。", "error");
      return;
    }
    revokeCropObjectUrl();
    const objectUrl = URL.createObjectURL(file);
    cropObjectUrl.current = objectUrl;
    setCropImage(objectUrl);
    setCropZoom(1);
    setCropOffsetX(0);
    setCropOffsetY(0);
  }

  async function applyAvatarCrop() {
    if (!cropImage) return;
    const cropped = await cropSquareImage(cropImage, cropZoom, cropOffsetX, cropOffsetY);
    setProfileAvatar(cropped);
    setCropImage("");
    revokeCropObjectUrl();
  }

  function closeAvatarCrop() {
    setCropImage("");
    revokeCropObjectUrl();
  }

  function revokeCropObjectUrl() {
    if (!cropObjectUrl.current) return;
    URL.revokeObjectURL(cropObjectUrl.current);
    cropObjectUrl.current = null;
  }

  const settingsPanel = (
    <section className="panel">
      <div className="section-heading">
        <div>
          <span className="section-kicker">App</span>
          <h2>{t(draft.language || "ja", "appSettings")}</h2>
        </div>
        <span className="autosave-badge">{t(draft.language || "ja", "autoSave")}</span>
      </div>

      <div className="settings-grid">
        <div className={`setting-card setting-card--budget ${draft.budgetEnabled ? "" : "is-muted"}`}>
          <Toggle label={t(draft.language || "ja", "budgetEnabled")} value={draft.budgetEnabled} onChange={value => patch({ budgetEnabled: value })} />
          {draft.budgetEnabled && (
            <div className="segmented-control" aria-label="予算単位">
              <button
                type="button"
                className={draft.budgetPeriod === "week" ? "is-active" : ""}
                onClick={() => patch({ budgetPeriod: "week" })}
              >
                {t(draft.language || "ja", "weeklyBudget")}
              </button>
              <button
                type="button"
                className={draft.budgetPeriod === "month" ? "is-active" : ""}
                onClick={() => patch({ budgetPeriod: "month" })}
              >
                {t(draft.language || "ja", "monthlyBudget")}
              </button>
            </div>
          )}
        </div>
        <div className={`setting-card setting-card--budget ${draft.autoLinkageEnabled ? "" : "is-muted"}`}>
          <Toggle
            label="出費自動連携機能を使用する"
            value={draft.autoLinkageEnabled}
            onChange={value => patch({ autoLinkageEnabled: value })}
          />
          <span className="setting-description">
            有効にすると、機能メニューから対応サービスの会員アカウントを設定できます。
          </span>
        </div>
        <Toggle label={t(draft.language || "ja", "darkMode")} value={draft.darkMode} onChange={value => patch({ darkMode: value })} />
        <Toggle label={t(draft.language || "ja", "autoDark")} value={draft.autoDark} onChange={value => patch({ autoDark: value })} />
        <Toggle label={t(draft.language || "ja", "largeText")} value={draft.largeTextMode} onChange={value => patch({ largeTextMode: value })} />
        <label className="field">
          <span>{t(draft.language || "ja", "sunrise")}</span>
          <input type="time" value={draft.sunrise} onChange={event => patch({ sunrise: event.target.value })} />
        </label>
        <label className="field">
          <span>{t(draft.language || "ja", "sunset")}</span>
          <input type="time" value={draft.sunset} onChange={event => patch({ sunset: event.target.value })} />
        </label>
        <label className="field">
          <span>{t(draft.language || "ja", "themeColor")}</span>
          <select value={draft.colorTheme} onChange={event => patch({ colorTheme: event.target.value as AppSettings["colorTheme"] })}>
            <option value="kakeibo">Kakei</option>
            <option value="teal">Teal</option>
            <option value="green">Green</option>
            <option value="orange">Orange</option>
            <option value="pink">Pink</option>
            <option value="indigo">Indigo</option>
            <option value="sakura">Sakura</option>
            <option value="sky">Sky</option>
            <option value="mono">Mono</option>
          </select>
        </label>
        <label className="field">
          <span>{t(draft.language || "ja", "language")}</span>
          <select value={draft.language || "ja"} onChange={event => patch({ language: event.target.value as AppSettings["language"] })}>
            <option value="ja">日本語</option>
            <option value="zh">中文</option>
            <option value="en">English</option>
          </select>
        </label>
      </div>
    </section>
  );

  if (!session) {
    return (
      <div className="auth-login-shell">
        <section className="auth-identity-panel">
          <div>
            <div className="auth-brand-symbol"><ChartNoAxesCombined size={26} /></div>
            <span className="section-kicker">Home Kakeibo</span>
            <h2>家計簿</h2>
          </div>
          <div className="device-retention">
            <MonitorCheck size={20} />
            <div>
              <strong>この端末に保存</strong>
              <span>ログアウトするまで、この端末でログイン状態を保持します。</span>
            </div>
          </div>
        </section>

        <form className="panel auth-card auth-form-panel" onSubmit={submitAuth}>
          <div className="section-heading">
            <div>
              <span className="section-kicker">Account</span>
              <h2>{authMode === "login" ? "ログイン" : authMode === "register" ? "新規登録" : "パスワード再設定"}</h2>
            </div>
            <strong className="auth-state">未ログイン</strong>
          </div>

          <div className="auth-mode-switch auth-mode-switch--three" role="tablist" aria-label="アカウント操作">
            <button type="button" className={authMode === "login" ? "is-active" : ""} onClick={() => switchAuthMode("login")}>
              ログイン
            </button>
            <button type="button" className={authMode === "register" ? "is-active" : ""} onClick={() => switchAuthMode("register")}>
              新規登録
            </button>
            <button type="button" className={authMode === "reset" ? "is-active" : ""} onClick={() => switchAuthMode("reset")}>
              再設定
            </button>
          </div>

          <div className="auth-form-grid auth-form-grid--login">
            <label className="field">
              <span>メールアドレス</span>
              <div className={`auth-input-wrap ${emailError ? "is-invalid" : ""}`}>
                <Mail size={18} />
                <input
                  value={email}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="name@example.com"
                  aria-invalid={!!emailError}
                  onChange={event => setEmail(event.target.value)}
                />
              </div>
              {emailError && <small className="field-error">{emailError}</small>}
            </label>

            {authMode !== "reset" && (
              <label className="field">
                <span>パスワード</span>
                <div className={`auth-input-wrap ${passwordError ? "is-invalid" : ""}`}>
                  <LockKeyhole size={18} />
                  <input
                    value={password}
                    type="password"
                    autoComplete={authMode === "login" ? "current-password" : "new-password"}
                    placeholder={authMode === "login" ? "パスワード" : "8文字以上"}
                    aria-invalid={!!passwordError}
                    onChange={event => setPassword(event.target.value)}
                  />
                </div>
                {passwordError && <small className="field-error">{passwordError}</small>}
              </label>
            )}

            {authMode === "reset" && (
              <>
                {issuedToken && (
                  <div className="reset-token-box">
                    <span>リセットコード</span>
                    <code>{issuedToken}</code>
                  </div>
                )}
                <label className="field">
                  <span>リセットコード</span>
                  <div className="auth-input-wrap">
                    <KeyRound size={18} />
                    <input
                      value={resetToken}
                      type="text"
                      autoComplete="one-time-code"
                      placeholder="発行されたコード"
                      onChange={event => setResetToken(event.target.value)}
                    />
                  </div>
                </label>
                <label className="field">
                  <span>新しいパスワード</span>
                  <div className={`auth-input-wrap ${resetPasswordError ? "is-invalid" : ""}`}>
                    <LockKeyhole size={18} />
                    <input
                      value={newPassword}
                      type="password"
                      autoComplete="new-password"
                      placeholder="8文字以上"
                      aria-invalid={!!resetPasswordError}
                      onChange={event => setNewPassword(event.target.value)}
                    />
                  </div>
                  {resetPasswordError && <small className="field-error">{resetPasswordError}</small>}
                </label>
              </>
            )}

            <div className="auth-primary-row">
              <button type="submit" className="command-button command-button--primary" disabled={authBusy}>
                {authMode === "login" ? <LogIn size={17} /> : authMode === "register" ? <UserPlus size={17} /> : resetToken ? <Save size={17} /> : <RefreshCw size={17} />}
                {authBusy
                  ? "処理中"
                  : authMode === "login"
                    ? "ログイン"
                    : authMode === "register"
                      ? "アカウント作成"
                      : resetToken
                        ? "パスワードを更新"
                        : "リセットコードを発行"}
              </button>
              <div className="auth-note">
                <ShieldCheck size={16} />
                <span>ログイン後に各機能を利用できます。</span>
              </div>
            </div>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="settings-layout">
      <section className="panel auth-card auth-card--session">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Account</span>
            <h2>アカウント</h2>
          </div>
          <strong className="auth-state is-login">ログイン中</strong>
        </div>

        <div className="session-summary">
          <div className="session-avatar">
            {session.avatarImage ? <img src={session.avatarImage} alt="" /> : (session.nickname || session.email || session.username || "U").slice(0, 1).toUpperCase()}
          </div>
          <div>
            <span>ログイン中</span>
            <strong>{session.nickname}</strong>
            <code>{session.email || session.username}</code>
          </div>
        </div>
        <div className="device-retention device-retention--light">
          <MonitorCheck size={19} />
          <div>
            <strong>この端末に保存済み</strong>
            <span>ログアウトするまでログイン状態を保持します。</span>
          </div>
        </div>
        <div className="profile-box">
          <div className="profile-edit-card">
            <div className="profile-avatar-editor">
              <div className="session-avatar session-avatar--large">
                {profileAvatar ? <img src={profileAvatar} alt="" /> : (profileName || session.email || "U").slice(0, 1).toUpperCase()}
              </div>
              <button
                type="button"
                className="command-button command-button--ghost"
                onClick={() => avatarInputRef.current?.click()}
              >
                <ImagePlus size={17} /> アイコン変更
              </button>
              <input
                ref={avatarInputRef}
                className="visually-hidden-file"
                type="file"
                accept="image/*,.heic,.heif"
                onChange={event => {
                  chooseAvatar(event.target.files?.[0] || null);
                  event.currentTarget.value = "";
                }}
              />
            </div>
            <label className="field">
              <span>表示名</span>
              <input value={profileName} onChange={event => setProfileName(event.target.value)} />
            </label>
            <button type="button" className="command-button command-button--primary" onClick={updateAccountProfile} disabled={profileBusy}>
              <Save size={17} /> {profileBusy ? "保存中" : "プロフィール保存"}
            </button>
          </div>
          <div>
            <span>表示名</span>
            <strong>{session.nickname}</strong>
          </div>
          <div>
            <span>メールアドレス</span>
            <code>{session.email || session.username}</code>
          </div>
          <button type="button" className="command-button command-button--ghost" onClick={logout}>
            <LogOut size={17} /> ログアウト
          </button>
        </div>
      </section>
      {settingsPanel}
      {cropImage && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <section className="panel avatar-crop-modal">
            <div className="section-heading">
              <div>
                <span className="section-kicker">Avatar</span>
                <h2>アイコンを切り抜く</h2>
              </div>
            </div>
            <div className="avatar-crop-stage">
              <img
                src={cropImage}
                alt=""
                onError={() => {
                  notify("画像を読み込めませんでした。SafariでHEICを選択した場合は、JPEGまたはPNGで再度選択してください。", "error");
                  closeAvatarCrop();
                }}
                style={{
                  transform: `translate(${cropOffsetX}px, ${cropOffsetY}px) scale(${cropZoom})`
                }}
              />
            </div>
            <div className="avatar-crop-controls">
              <label className="field">
                <span>拡大</span>
                <input type="range" min="1" max="3" step="0.05" value={cropZoom} onChange={event => setCropZoom(Number(event.target.value))} />
              </label>
              <label className="field">
                <span>左右</span>
                <input type="range" min="-90" max="90" step="1" value={cropOffsetX} onChange={event => setCropOffsetX(Number(event.target.value))} />
              </label>
              <label className="field">
                <span>上下</span>
                <input type="range" min="-90" max="90" step="1" value={cropOffsetY} onChange={event => setCropOffsetY(Number(event.target.value))} />
              </label>
            </div>
            <div className="toolbar-actions avatar-crop-actions">
              <button type="button" className="command-button command-button--ghost" onClick={closeAvatarCrop}>キャンセル</button>
              <button type="button" className="command-button command-button--primary" onClick={applyAvatarCrop}>切り抜く</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <input type="checkbox" checked={value} onChange={event => onChange(event.target.checked)} />
    </label>
  );
}

function cropSquareImage(dataUrl: string, zoom: number, offsetX: number, offsetY: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const size = 256;
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("画像を処理できませんでした。"));
        return;
      }
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, size, size);
      const baseScale = Math.max(size / image.width, size / image.height) * zoom;
      const drawWidth = image.width * baseScale;
      const drawHeight = image.height * baseScale;
      const x = (size - drawWidth) / 2 + offsetX;
      const y = (size - drawHeight) / 2 + offsetY;
      context.drawImage(image, x, y, drawWidth, drawHeight);
      resolve(canvas.toDataURL("image/jpeg", 0.86));
    };
    image.onerror = () => reject(new Error("画像を読み込めませんでした。"));
    image.src = dataUrl;
  });
}
