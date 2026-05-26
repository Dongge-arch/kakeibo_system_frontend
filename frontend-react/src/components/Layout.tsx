import {
  Bot,
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
import type { Language } from "../i18n";
import { t } from "../i18n";
import { IconButton } from "./IconButton";

export type PageKey =
  | "dashboard"
  | "receipt"
  | "recurring"
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
  label: (language: Language) => string;
  icon: ComponentType<LucideProps>;
};

const homeItems: NavItem[] = [
  { key: "dashboard", label: language => t(language, "dashboard"), icon: House }
];

const recordItems: NavItem[] = [
  { key: "ai", label: language => t(language, "aiExpense"), icon: Bot },
  { key: "receipt", label: language => t(language, "manualExpense"), icon: ReceiptText },
  { key: "recurring", label: language => t(language, "recurringExpense"), icon: WalletCards },
  { key: "income", label: language => t(language, "incomeEntry"), icon: CircleDollarSign }
];

const historyItems: NavItem[] = [
  { key: "receipts", label: language => t(language, "expenseHistory"), icon: Search },
  { key: "ai-library", label: language => t(language, "aiHistory"), icon: LibraryBig }
];

const planItems: NavItem[] = [
  { key: "budget", label: language => t(language, "budget"), icon: WalletCards }
];

const manageItems: NavItem[] = [
  { key: "places", label: language => t(language, "places"), icon: MapPinned },
  { key: "categories", label: language => t(language, "categories"), icon: Tags },
  { key: "settings", label: language => t(language, "settings"), icon: Settings }
];

export const navGroups = [
  { label: (language: Language) => t(language, "homeGroup"), items: homeItems },
  { label: (language: Language) => t(language, "recordGroup"), items: recordItems },
  { label: (language: Language) => t(language, "historyGroup"), items: historyItems },
  { label: (language: Language) => t(language, "planGroup"), items: planItems },
  { label: (language: Language) => t(language, "manageGroup"), items: manageItems }
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
  language: Language;
  onNavigate: (page: PageKey) => void;
  onLogout: () => void;
  children: ReactNode;
};

export function Layout({ page, title, session, budgetEnabled, language, onNavigate, onLogout, children }: LayoutProps) {
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
          <div className="brand-symbol"><KakeiboLogo /></div>
          <div>
            <strong>Kakei</strong>
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
              <div className="nav-group" key={group.label(language)}>
                <span className="nav-group-label">{group.label(language)}</span>
                {items.map(item => {
                  const Icon = item.icon;
                  const active = page === item.key;
                  const locked = !loggedIn && item.key !== "settings";
                  const label = item.key === "settings"
                    ? loggedIn ? t(language, "settings") : t(language, "login")
                    : item.label(language);
                  return (
                    <button
                      key={item.key}
                      type="button"
                      className={`nav-link ${active ? "is-active" : ""}`}
                      disabled={locked}
                      title={locked ? t(language, "locked") : label}
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
            <p className="eyebrow"><Cloud size={15} /> {t(language, "cloudKakeibo")}</p>
            <h1>{title}</h1>
          </div>
          <div className="topbar-actions">
            <button type="button" className="user-chip" onClick={() => navigate("settings")}>
              <GalleryVerticalEnd size={17} />
              <span>{session?.nickname || t(language, "guest")}</span>
            </button>
            {session && <IconButton label={t(language, "logout")} icon={LogOut} onClick={onLogout} />}
            <IconButton label={t(language, "settings")} icon={SlidersHorizontal} onClick={() => navigate("settings")} />
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}

function KakeiboLogo() {
  return (
    <svg viewBox="0 0 48 48" role="img" aria-hidden="true">
      <path d="M8 18 24 7l16 11v20a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3V18Z" fill="currentColor" opacity=".22" />
      <path d="M14 21h20v15H14z" fill="currentColor" opacity=".92" />
      <path d="M17 25h14M17 30h10" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M31 13c2.4 2.5 2.4 5.1 0 7.7-2.4-2.6-2.4-5.2 0-7.7Z" fill="#f6c453" />
    </svg>
  );
}
