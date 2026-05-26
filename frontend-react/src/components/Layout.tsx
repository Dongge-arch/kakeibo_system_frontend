import {
  Bot,
  ChartNoAxesCombined,
  ChevronRight,
  CircleDollarSign,
  Cloud,
  GalleryVerticalEnd,
  House,
  LibraryBig,
  LogOut,
  MapPinned,
  Menu,
  ReceiptText,
  Search,
  Settings,
  SlidersHorizontal,
  Tags,
  WalletCards,
  X
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import type { LucideProps } from "lucide-react";
import type { AuthSession } from "../api/types";
import { IconButton } from "./IconButton";

export type PageKey =
  | "dashboard"
  | "receipt"
  | "ai"
  | "ai-library"
  | "receipts"
  | "income"
  | "budget"
  | "places"
  | "categories"
  | "settings";

export type NavItem = {
  key: PageKey;
  label: string;
  icon: ComponentType<LucideProps>;
};

const homeItems: NavItem[] = [
  { key: "dashboard", label: "ホーム", icon: House }
];

const recordItems: NavItem[] = [
  { key: "ai", label: "レシートAI", icon: Bot },
  { key: "receipt", label: "手入力", icon: ReceiptText },
  { key: "income", label: "入金", icon: CircleDollarSign }
];

const historyItems: NavItem[] = [
  { key: "receipts", label: "明細履歴", icon: Search },
  { key: "ai-library", label: "AI履歴", icon: LibraryBig }
];

const planItems: NavItem[] = [
  { key: "budget", label: "予算", icon: WalletCards }
];

const manageItems: NavItem[] = [
  { key: "places", label: "店舗", icon: MapPinned },
  { key: "categories", label: "カテゴリ", icon: Tags },
  { key: "settings", label: "アカウント設定", icon: Settings }
];

export const navGroups = [
  { label: "ホーム", items: homeItems },
  { label: "記録", items: recordItems },
  { label: "履歴", items: historyItems },
  { label: "計画", items: planItems },
  { label: "管理", items: manageItems }
];

export const navItems: NavItem[] = [
  ...homeItems,
  ...recordItems,
  ...historyItems,
  ...planItems,
  ...manageItems
];

type LayoutProps = {
  page: PageKey;
  title: string;
  session: AuthSession | null;
  budgetEnabled: boolean;
  onNavigate: (page: PageKey) => void;
  onLogout: () => void;
  children: ReactNode;
};

export function Layout({ page, title, session, budgetEnabled, onNavigate, onLogout, children }: LayoutProps) {
  const loggedIn = !!session;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [page]);

  useEffect(() => {
    function handleTouchStart(event: TouchEvent) {
      const touch = event.touches[0];
      touchStartX.current = touch.clientX;
      touchStartY.current = touch.clientY;
    }

    function handleTouchEnd(event: TouchEvent) {
      if (touchStartX.current === null || touchStartY.current === null) return;
      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - touchStartX.current;
      const deltaY = touch.clientY - touchStartY.current;
      const startX = touchStartX.current;
      touchStartX.current = null;
      touchStartY.current = null;

      if (Math.abs(deltaY) > 70 || Math.abs(deltaX) < 72) return;
      if (!mobileMenuOpen && startX <= 34 && deltaX > 0) {
        setMobileMenuOpen(true);
      }
      if (mobileMenuOpen && deltaX < 0) {
        setMobileMenuOpen(false);
      }
    }

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [mobileMenuOpen]);

  function navigate(nextPage: PageKey) {
    onNavigate(nextPage);
    setMobileMenuOpen(false);
  }

  return (
    <div className={`app-shell ${mobileMenuOpen ? "is-mobile-menu-open" : ""}`}>
      {mobileMenuOpen && (
        <button
          type="button"
          className="mobile-menu-backdrop"
          aria-label="メニューを閉じる"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      <aside className="side-rail">
        <div className="brand-mark" aria-label="Home Kakeibo">
          <div className="brand-symbol"><ChartNoAxesCombined size={24} /></div>
          <div>
            <strong>家計簿</strong>
            <span>Home Kakeibo</span>
          </div>
        </div>
        <button type="button" className="mobile-menu-close" aria-label="メニューを閉じる" onClick={() => setMobileMenuOpen(false)}>
          <X size={19} />
        </button>

        <nav className="nav-stack">
          {navGroups.map(group => {
            const items = group.items.filter(item => budgetEnabled || item.key !== "budget");
            if (!items.length) return null;
            return (
              <div className="nav-group" key={group.label}>
                <span className="nav-group-label">{group.label}</span>
                {items.map(item => {
                  const Icon = item.icon;
                  const active = page === item.key;
                  const locked = !loggedIn && item.key !== "settings";
                  const label = item.key === "settings"
                    ? loggedIn ? "アカウント設定" : "ログイン"
                    : item.label;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      className={`nav-link ${active ? "is-active" : ""}`}
                      disabled={locked}
                      title={locked ? "ログイン後に利用できます" : label}
                      onClick={() => navigate(item.key)}
                    >
                      <Icon size={19} />
                      <span>{label}</span>
                      {active && <ChevronRight size={17} className="nav-caret" />}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </aside>

      <main className="workbench">
        <header className="topbar">
          <button type="button" className="mobile-menu-button" aria-label="メニューを開く" onClick={() => setMobileMenuOpen(true)}>
            <Menu size={20} />
          </button>
          <div>
            <p className="eyebrow"><Cloud size={15} /> クラウド家計簿</p>
            <h1>{title}</h1>
          </div>
          <div className="topbar-actions">
            <button type="button" className="user-chip" onClick={() => navigate("settings")}>
              <GalleryVerticalEnd size={17} />
              <span>{session?.nickname || "ゲスト"}</span>
            </button>
            {session && <IconButton label="ログアウト" icon={LogOut} onClick={onLogout} />}
            <IconButton label="設定" icon={SlidersHorizontal} onClick={() => navigate("settings")} />
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
