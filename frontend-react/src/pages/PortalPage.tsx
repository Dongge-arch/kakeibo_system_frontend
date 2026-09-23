import { ArrowRight, Baby, BookOpenText, ChartNoAxesCombined, LogIn, LogOut, NotebookTabs, ShoppingBasket } from "lucide-react";
import type { AuthSession } from "../api/types";

export type PortalModule = "kakeibo" | "meal" | "childcare";

type Props = {
  session: AuthSession | null;
  onOpen: (module: PortalModule) => void;
  onLogin: () => void;
  onLogout: () => void;
};

const modules = [
  { key: "kakeibo", name: "家計簿", detail: "出費・入金・予算", icon: ChartNoAxesCombined, className: "portal-module--money" },
  { key: "meal", name: "献立ノート", detail: "レシピ・買い物リスト", icon: ShoppingBasket, className: "portal-module--meal" },
  { key: "childcare", name: "育児ノート", detail: "赤ちゃんの記録・家族共有", icon: Baby, className: "portal-module--baby" }
] as const;

export function PortalPage({ session, onOpen, onLogin, onLogout }: Props) {
  return (
    <main className="portal-page">
      <header className="portal-header">
        <div className="portal-brand"><NotebookTabs size={27} /><span>暮らしのポータル</span></div>
        <div className="portal-account">
          <span>{session?.nickname || session?.username || "ゲスト"}</span>
          {session ? <button type="button" title="ログアウト" onClick={onLogout}><LogOut size={18} /></button>
            : <button type="button" onClick={onLogin}><LogIn size={18} /> ログイン</button>}
        </div>
      </header>
      <section className="portal-content" aria-label="アプリを選ぶ">
        <div className="portal-heading"><BookOpenText size={22} /><h1>アプリを選ぶ</h1></div>
        <div className="portal-modules">
          {modules.map(item => {
            const Icon = item.icon;
            return <button key={item.key} type="button" className={`portal-module ${item.className}`} onClick={() => onOpen(item.key)}>
              <span className="portal-module-icon"><Icon size={31} /></span>
              <span className="portal-module-label"><strong>{item.name}</strong><small>{item.detail}</small></span>
              <ArrowRight size={22} />
            </button>;
          })}
        </div>
      </section>
    </main>
  );
}
