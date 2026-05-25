import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api/client";
import { currentMonth, groupReceipts, monthRange } from "./api/normalizers";
import type { AiUsageSummary, AppSettings, Budget, Income, ReceiptSummary } from "./api/types";
import { Layout, navItems, type PageKey } from "./components/Layout";
import { Toast } from "./components/Toast";
import { useAuth } from "./hooks/useAuth";
import { useMasterData } from "./hooks/useMasterData";
import { AiLibraryPage } from "./pages/AiLibraryPage";
import { AiReceiptPage } from "./pages/AiReceiptPage";
import { BudgetPage } from "./pages/BudgetPage";
import { CategoriesPage } from "./pages/CategoriesPage";
import { DashboardPage } from "./pages/DashboardPage";
import { IncomePage } from "./pages/IncomePage";
import { PlacesPage } from "./pages/PlacesPage";
import { ReceiptPage } from "./pages/ReceiptPage";
import { ReceiptsPage } from "./pages/ReceiptsPage";
import { SettingsPage } from "./pages/SettingsPage";
import "./styles/app.css";

type ToastState = {
  message: string;
  tone: "success" | "error" | "info";
};

const defaultSettings: AppSettings = {
  budgetEnabled: false,
  budgetPeriod: "month",
  darkMode: false,
  autoDark: false,
  sunrise: "06:00",
  sunset: "18:00",
  largeTextMode: false,
  colorTheme: "teal"
};

export default function App() {
  const auth = useAuth();
  const master = useMasterData(auth.session?.userId || "");
  const [page, setPage] = useState<PageKey>("settings");
  const [month, setMonth] = useState(currentMonth());
  const [receipts, setReceipts] = useState<ReceiptSummary[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [aiUsage, setAiUsage] = useState<AiUsageSummary | null>(null);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const title = useMemo(() => {
    if (!auth.session) return "ログイン";
    if (page === "settings") return "アカウント設定";
    return navItems.find(item => item.key === page)?.label || "家計簿";
  }, [page, auth.session]);

  const notify = useCallback((message: string, tone: ToastState["tone"] = "info") => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(current => current?.message === message ? null : current), 3200);
  }, []);

  const applySettings = useCallback((next: AppSettings) => {
    document.documentElement.dataset.theme = resolveDarkMode(next) ? "dark" : "light";
    document.documentElement.dataset.largeText = next.largeTextMode ? "true" : "false";
    document.documentElement.dataset.color = next.colorTheme || "teal";
  }, []);

  const refreshDashboard = useCallback(async () => {
    if (!auth.session) {
      setReceipts([]);
      setIncomes([]);
      setBudgets([]);
      setAiUsage(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [receiptResult, incomeRows, budgetRows, usage] = await Promise.all([
        api.receipt.search(monthRange(month)),
        api.income.list(month),
        settings.budgetEnabled ? api.budget.list().catch(() => []) : Promise.resolve([]),
        api.ai.usage().catch(() => null)
      ]);
      setReceipts(groupReceipts(receiptResult.receiptDetails || []));
      setIncomes(incomeRows || []);
      setBudgets(budgetRows || []);
      setAiUsage(usage);
    } catch (error) {
      notify((error as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }, [auth.session, month, notify, settings.budgetEnabled]);

  useEffect(() => {
    if (!auth.session && page !== "settings") {
      setPage("settings");
    }
  }, [auth.session, page]);

  useEffect(() => {
    refreshDashboard().catch(console.error);
  }, [refreshDashboard]);

  useEffect(() => {
    if (page === "budget" && !settings.budgetEnabled) {
      setPage("dashboard");
    }
  }, [page, settings.budgetEnabled]);

  useEffect(() => {
    if (!auth.session) {
      setSettings(defaultSettings);
      applySettings(defaultSettings);
      return;
    }

    api.settings.get()
      .then(row => {
        const next = { ...defaultSettings, ...(row || {}) };
        setSettings(next);
        applySettings(next);
      })
      .catch(() => applySettings(defaultSettings));
  }, [auth.session?.userId, applySettings]);

  function previewSettings(next: AppSettings) {
    setSettings(next);
    applySettings(next);
  }

  function renderPage() {
    if (!auth.session) {
      return (
        <SettingsPage
          session={auth.session}
          settings={settings}
          onPreviewSettings={previewSettings}
          login={auth.login}
          register={auth.register}
          logout={auth.logout}
          notify={notify}
        />
      );
    }

    if (page === "dashboard") {
      return (
        <DashboardPage
          month={month}
          receipts={receipts}
          incomes={incomes}
          budgets={budgets}
          aiUsage={aiUsage}
          budgetEnabled={settings.budgetEnabled}
          budgetPeriod={settings.budgetPeriod}
          loading={loading}
          onMonthChange={setMonth}
          onRefresh={refreshDashboard}
        />
      );
    }
    if (page === "receipt") {
      return <ReceiptPage category1={master.category1} category2={master.category2} onSaved={refreshDashboard} notify={notify} />;
    }
    if (page === "ai") {
      return (
        <AiReceiptPage
          category1={master.category1}
          category2={master.category2}
          onSaved={refreshDashboard}
          onOpenLibrary={() => setPage("ai-library")}
          notify={notify}
        />
      );
    }
    if (page === "ai-library") return <AiLibraryPage notify={notify} />;
    if (page === "receipts") {
      return <ReceiptsPage category1={master.category1} category2={master.category2} onChanged={refreshDashboard} notify={notify} />;
    }
    if (page === "income") {
      return <IncomePage salaryCategories={master.salaryCategories} onChanged={refreshDashboard} notify={notify} />;
    }
    if (page === "budget") {
      return (
        <BudgetPage
          category1={master.category1}
          category2={master.category2}
          budgetEnabled={settings.budgetEnabled}
          budgetPeriod={settings.budgetPeriod}
          onChanged={refreshDashboard}
          notify={notify}
        />
      );
    }
    if (page === "places") return <PlacesPage notify={notify} />;
    if (page === "categories") {
      return (
        <CategoriesPage
          category1={master.category1}
          category2={master.category2}
          salaryCategories={master.salaryCategories}
          refresh={() => master.refresh().catch(error => notify((error as Error).message, "error"))}
          notify={notify}
        />
      );
    }
    return (
      <SettingsPage
        session={auth.session}
        settings={settings}
        onPreviewSettings={previewSettings}
        login={auth.login}
        register={auth.register}
        logout={auth.logout}
        notify={notify}
      />
    );
  }

  return (
    <>
      <Layout
        page={auth.session ? page : "settings"}
        title={title}
        session={auth.session}
        budgetEnabled={settings.budgetEnabled}
        onNavigate={setPage}
        onLogout={auth.logout}
      >
        {renderPage()}
      </Layout>
      {toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
    </>
  );
}

function resolveDarkMode(settings: AppSettings) {
  if (!settings.autoDark) return settings.darkMode;
  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();
  const sunrise = parseTime(settings.sunrise || "06:00");
  const sunset = parseTime(settings.sunset || "18:00");
  return current < sunrise || current >= sunset;
}

function parseTime(value: string) {
  const parts = value.split(":");
  const hour = Number(parts[0] || 0);
  const minute = Number(parts[1] || 0);
  return hour * 60 + minute;
}
