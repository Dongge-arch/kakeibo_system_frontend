import { Plus, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { Category1, Category2, SalaryCategory } from "../api/types";
import { IconButton } from "../components/IconButton";

type CategoriesPageProps = {
  category1: Category1[];
  category2: Category2[];
  salaryCategories: SalaryCategory[];
  refresh: () => Promise<void> | void;
  notify: (message: string, tone?: "success" | "error" | "info") => void;
};

const defaultCategory1 = ["食費", "日用品", "交通", "住居", "水道光熱", "通信", "医療", "美容", "衣服", "娯楽", "交際", "教育", "ペット", "税金・保険", "その他"];

const defaultCategory2 = [
  { category1_name: "食費", category2_name: "米・パン・麺", tax_rate: 0.08 },
  { category1_name: "食費", category2_name: "肉・魚", tax_rate: 0.08 },
  { category1_name: "食費", category2_name: "野菜・果物", tax_rate: 0.08 },
  { category1_name: "食費", category2_name: "卵・乳製品", tax_rate: 0.08 },
  { category1_name: "食費", category2_name: "惣菜・冷凍食品", tax_rate: 0.08 },
  { category1_name: "食費", category2_name: "菓子・デザート", tax_rate: 0.08 },
  { category1_name: "食費", category2_name: "調味料", tax_rate: 0.08 },
  { category1_name: "食費", category2_name: "飲料", tax_rate: 0.08 },
  { category1_name: "食費", category2_name: "外食", tax_rate: 0.1 },
  { category1_name: "食費", category2_name: "カフェ", tax_rate: 0.1 },
  { category1_name: "日用品", category2_name: "洗剤・掃除用品", tax_rate: 0.1 },
  { category1_name: "日用品", category2_name: "紙用品", tax_rate: 0.1 },
  { category1_name: "日用品", category2_name: "キッチン用品", tax_rate: 0.1 },
  { category1_name: "日用品", category2_name: "バス・トイレ用品", tax_rate: 0.1 },
  { category1_name: "日用品", category2_name: "衛生用品", tax_rate: 0.1 },
  { category1_name: "日用品", category2_name: "文具・事務用品", tax_rate: 0.1 },
  { category1_name: "日用品", category2_name: "小型雑貨", tax_rate: 0.1 },
  { category1_name: "交通", category2_name: "電車・バス", tax_rate: 0.1 },
  { category1_name: "交通", category2_name: "タクシー", tax_rate: 0.1 },
  { category1_name: "交通", category2_name: "ガソリン", tax_rate: 0.1 },
  { category1_name: "交通", category2_name: "駐車場", tax_rate: 0.1 },
  { category1_name: "交通", category2_name: "高速料金", tax_rate: 0.1 },
  { category1_name: "交通", category2_name: "自転車", tax_rate: 0.1 },
  { category1_name: "住居", category2_name: "家賃", tax_rate: 0.1 },
  { category1_name: "住居", category2_name: "管理費", tax_rate: 0.1 },
  { category1_name: "住居", category2_name: "家具", tax_rate: 0.1 },
  { category1_name: "住居", category2_name: "家電", tax_rate: 0.1 },
  { category1_name: "住居", category2_name: "修繕・工具", tax_rate: 0.1 },
  { category1_name: "水道光熱", category2_name: "電気", tax_rate: 0.1 },
  { category1_name: "水道光熱", category2_name: "ガス", tax_rate: 0.1 },
  { category1_name: "水道光熱", category2_name: "水道", tax_rate: 0.1 },
  { category1_name: "通信", category2_name: "携帯電話", tax_rate: 0.1 },
  { category1_name: "通信", category2_name: "インターネット", tax_rate: 0.1 },
  { category1_name: "通信", category2_name: "サブスク", tax_rate: 0.1 },
  { category1_name: "通信", category2_name: "郵便・配送", tax_rate: 0.1 },
  { category1_name: "医療", category2_name: "病院", tax_rate: 0.1 },
  { category1_name: "医療", category2_name: "薬・処方箋", tax_rate: 0.1 },
  { category1_name: "医療", category2_name: "歯科", tax_rate: 0.1 },
  { category1_name: "医療", category2_name: "検査・予防", tax_rate: 0.1 },
  { category1_name: "美容", category2_name: "美容院", tax_rate: 0.1 },
  { category1_name: "美容", category2_name: "化粧品", tax_rate: 0.1 },
  { category1_name: "美容", category2_name: "スキンケア", tax_rate: 0.1 },
  { category1_name: "美容", category2_name: "理容・ネイル", tax_rate: 0.1 },
  { category1_name: "衣服", category2_name: "服", tax_rate: 0.1 },
  { category1_name: "衣服", category2_name: "靴", tax_rate: 0.1 },
  { category1_name: "衣服", category2_name: "バッグ・小物", tax_rate: 0.1 },
  { category1_name: "衣服", category2_name: "クリーニング", tax_rate: 0.1 },
  { category1_name: "娯楽", category2_name: "映画・配信", tax_rate: 0.1 },
  { category1_name: "娯楽", category2_name: "書籍", tax_rate: 0.1 },
  { category1_name: "娯楽", category2_name: "ゲーム", tax_rate: 0.1 },
  { category1_name: "娯楽", category2_name: "旅行・宿泊", tax_rate: 0.1 },
  { category1_name: "娯楽", category2_name: "イベント", tax_rate: 0.1 },
  { category1_name: "娯楽", category2_name: "スポーツ", tax_rate: 0.1 },
  { category1_name: "交際", category2_name: "贈答", tax_rate: 0.1 },
  { category1_name: "交際", category2_name: "会食", tax_rate: 0.1 },
  { category1_name: "交際", category2_name: "冠婚葬祭", tax_rate: 0.1 },
  { category1_name: "交際", category2_name: "家族・友人", tax_rate: 0.1 },
  { category1_name: "教育", category2_name: "学習", tax_rate: 0.1 },
  { category1_name: "教育", category2_name: "教材・書籍", tax_rate: 0.1 },
  { category1_name: "教育", category2_name: "資格・試験", tax_rate: 0.1 },
  { category1_name: "ペット", category2_name: "フード", tax_rate: 0.1 },
  { category1_name: "ペット", category2_name: "用品", tax_rate: 0.1 },
  { category1_name: "ペット", category2_name: "病院・ケア", tax_rate: 0.1 },
  { category1_name: "税金・保険", category2_name: "保険料", tax_rate: 0.1 },
  { category1_name: "税金・保険", category2_name: "税金", tax_rate: 0.1 },
  { category1_name: "税金・保険", category2_name: "年金", tax_rate: 0.1 },
  { category1_name: "その他", category2_name: "手数料", tax_rate: 0.1 },
  { category1_name: "その他", category2_name: "現金調整", tax_rate: 0.1 },
  { category1_name: "その他", category2_name: "未分類", tax_rate: 0.1 }
];

const defaultSalaryCategories = ["給与", "賞与", "副業", "投資", "返金", "その他"];

export function CategoriesPage({ category1, category2, salaryCategories, refresh, notify }: CategoriesPageProps) {
  const [newCategory1, setNewCategory1] = useState("");
  const [selectedCategory1, setSelectedCategory1] = useState("");
  const [newCategory2, setNewCategory2] = useState("");
  const [taxRate, setTaxRate] = useState(0.1);
  const [newSalary, setNewSalary] = useState("");
  const [busy, setBusy] = useState(false);

  const visibleCategory2 = useMemo(() => {
    return category2.filter(item => item.CATEGORY1_NAME === selectedCategory1);
  }, [category2, selectedCategory1]);

  useEffect(() => {
    if (!category1.length) {
      if (selectedCategory1) setSelectedCategory1("");
      return;
    }
    if (!selectedCategory1) {
      setSelectedCategory1(category1[0]?.CATEGORY1_NAME || "");
      return;
    }
    if (category1.some(item => item.CATEGORY1_NAME === selectedCategory1) || busy) return;
    setSelectedCategory1(category1[0]?.CATEGORY1_NAME || "");
  }, [busy, category1, selectedCategory1]);

  async function run(action: () => Promise<unknown>, message: string, after?: () => void) {
    setBusy(true);
    try {
      await action();
      after?.();
      await refresh();
      notify(message, "success");
    } catch (error) {
      notify((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  function addCategory1() {
    const name = newCategory1.trim();
    if (!name) {
      notify("分類名を入力してください。", "error");
      return;
    }
    run(
      () => api.master.addCategory1(name),
      "追加しました。",
      () => {
        setNewCategory1("");
        setSelectedCategory1(name);
      }
    );
  }

  function addCategory2() {
    const name = newCategory2.trim();
    if (!selectedCategory1 || !name) {
      notify("分類を入力してください。", "error");
      return;
    }
    run(
      () => api.master.addCategory2(selectedCategory1, name, taxRate),
      "追加しました。",
      () => setNewCategory2("")
    );
  }

  function addSalaryCategory() {
    const name = newSalary.trim();
    if (!name) {
      notify("入金分類を入力してください。", "error");
      return;
    }
    run(
      () => api.master.addSalaryCategory(name),
      "追加しました。",
      () => setNewSalary("")
    );
  }

  function addDefaultCategories() {
    run(
      () => api.master.addDefaultCategories({
        category1: defaultCategory1,
        category2: defaultCategory2,
        salaryCategories: defaultSalaryCategories
      }),
      "デフォルト分類を追加しました。"
    );
  }

  return (
    <div className="category-layout">
      <section className="panel category-default-panel">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Default</span>
            <h2>標準分類</h2>
          </div>
          <button type="button" className="command-button command-button--primary" onClick={addDefaultCategories} disabled={busy}>
            <Sparkles size={17} /> デフォルト分類を追加
          </button>
        </div>
        <p className="panel-note">日常の家計簿で使いやすい出費分類、小分類、入金分類をまとめて追加します。既にある分類は重複登録しません。</p>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Expense</span>
            <h2>出費分類</h2>
          </div>
          <button type="button" className="command-button command-button--ghost" onClick={() => refresh()} disabled={busy}>
            <RefreshCw size={17} /> 更新
          </button>
        </div>
        <div className="inline-form">
          <input value={newCategory1} onChange={event => setNewCategory1(event.target.value)} placeholder="新しい分類" />
          <button type="button" className="command-button command-button--primary" onClick={addCategory1} disabled={busy}>
            <Plus size={17} /> 追加
          </button>
        </div>
        <div className="pill-list">
          {category1.map(item => (
            <span key={item.CATEGORY1_NAME} className={item.CATEGORY1_NAME === selectedCategory1 ? "is-selected" : ""}>
              <button type="button" onClick={() => setSelectedCategory1(item.CATEGORY1_NAME)}>
                {item.CATEGORY1_NAME}
              </button>
              <IconButton
                label="削除"
                icon={Trash2}
                variant="danger"
                onClick={() => run(() => api.master.deleteCategory1(item.CATEGORY1_NAME), "削除しました。")}
              />
            </span>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Sub</span>
            <h2>出費小分類</h2>
          </div>
        </div>
        <div className="inline-form inline-form--wide">
          <select value={selectedCategory1} onChange={event => setSelectedCategory1(event.target.value)}>
            {category1.map(item => <option key={item.CATEGORY1_NAME} value={item.CATEGORY1_NAME}>{item.CATEGORY1_NAME}</option>)}
          </select>
          <input value={newCategory2} onChange={event => setNewCategory2(event.target.value)} placeholder="新しい小分類" />
          <select value={taxRate} onChange={event => setTaxRate(Number(event.target.value))}>
            <option value={0.1}>10%</option>
            <option value={0.08}>8%（軽減税率）</option>
          </select>
          <button type="button" className="command-button command-button--primary" onClick={addCategory2} disabled={busy || !selectedCategory1}>
            <Plus size={17} /> 追加
          </button>
        </div>
        <div className="category-table">
          {!selectedCategory1 && <div className="empty-state">大分類を選択してください</div>}
          {selectedCategory1 && visibleCategory2.length === 0 && <div className="empty-state">小分類なし</div>}
          {visibleCategory2.map(item => (
            <div key={`${item.CATEGORY1_NAME}-${item.CATEGORY2_NAME}`}>
              <span>{item.CATEGORY1_NAME}</span>
              <strong>{item.CATEGORY2_NAME}</strong>
              <em>{Number(item.TAX_RATE) === 0.08 ? "8%" : "10%"}</em>
              <IconButton
                label="削除"
                icon={Trash2}
                variant="danger"
                onClick={() => run(() => api.master.deleteCategory2(item.CATEGORY1_NAME, item.CATEGORY2_NAME), "削除しました。")}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Income</span>
            <h2>入金分類</h2>
          </div>
        </div>
        <div className="inline-form">
          <input value={newSalary} onChange={event => setNewSalary(event.target.value)} placeholder="新しい入金分類" />
          <button type="button" className="command-button command-button--primary" onClick={addSalaryCategory} disabled={busy}>
            <Plus size={17} /> 追加
          </button>
        </div>
        <div className="pill-list">
          {salaryCategories.map(item => (
            <span key={item.SAL_CAT}>
              {item.SAL_CAT}
              <IconButton
                label="削除"
                icon={Trash2}
                variant="danger"
                onClick={() => run(() => api.master.deleteSalaryCategory(item.SAL_CAT), "削除しました。")}
              />
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
