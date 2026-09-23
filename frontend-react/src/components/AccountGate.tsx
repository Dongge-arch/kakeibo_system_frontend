import { LockKeyhole, LogIn, UserPlus } from "lucide-react";
import { useState } from "react";

type Props = {
  login: (email: string, password: string) => Promise<unknown>;
  register: (email: string, password: string) => Promise<unknown>;
  notify: (message: string, tone?: "success" | "error" | "info") => void;
};

export function AccountGate({ login, register, notify }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await (mode === "login" ? login(email, password) : register(email, password));
      notify("ログインしました。", "success");
    } catch (error) {
      notify((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return <section className="account-gate">
    <div className="module-heading"><LockKeyhole size={25} /><h2>ログイン</h2></div>
    <form onSubmit={submit} className="module-form">
      <label className="field"><span>メールアドレス</span><input type="email" value={email} onChange={event => setEmail(event.target.value)} required /></label>
      <label className="field"><span>パスワード</span><input type="password" value={password} onChange={event => setPassword(event.target.value)} required /></label>
      <button type="submit" className="command-button command-button--primary" disabled={busy}>
        {mode === "login" ? <LogIn size={17} /> : <UserPlus size={17} />}{mode === "login" ? "ログイン" : "新規登録"}
      </button>
    </form>
    <button type="button" className="text-command" onClick={() => setMode(mode === "login" ? "register" : "login")}>
      {mode === "login" ? "アカウントを作成" : "ログインに戻る"}
    </button>
  </section>;
}
