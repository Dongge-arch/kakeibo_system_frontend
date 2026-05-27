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
  { category1Name: "食費", category2Name: "米・パン・麺", taxRate: 0.08 },
  { category1Name: "食費", category2Name: "肉・魚", taxRate: 0.08 },
  { category1Name: "食費", category2Name: "野菜・果物", taxRate: 0.08 },
  { category1Name: "食費", category2Name: "卵・乳製品", taxRate: 0.08 },
  { category1Name: "食費", category2Name: "惣菜・冷凍食品", taxRate: 0.08 },
  { category1Name: "食費", category2Name: "菓子・デザート", taxRate: 0.08 },
  { category1Name: "食費", category2Name: "調味料", taxRate: 0.08 },
  { category1Name: "食費", category2Name: "飲料", taxRate: 0.08 },
  { category1Name: "食費", category2Name: "外食", taxRate: 0.1 },
  { category1Name: "食費", category2Name: "カフェ", taxRate: 0.1 },
  { category1Name: "日用品", category2Name: "洗剤・掃除用品", taxRate: 0.1 },
  { category1Name: "日用品", category2Name: "紙用品", taxRate: 0.1 },
  { category1Name: "日用品", category2Name: "キッチン用品", taxRate: 0.1 },
  { category1Name: "日用品", category2Name: "バス・トイレ用品", taxRate: 0.1 },
  { category1Name: "日用品", category2Name: "衛生用品", taxRate: 0.1 },
  { category1Name: "日用品", category2Name: "文具・事務用品", taxRate: 0.1 },
  { category1Name: "日用品", category2Name: "小型雑貨", taxRate: 0.1 },
  { category1Name: "交通", category2Name: "電車・バス", taxRate: 0.1 },
  { category1Name: "交通", category2Name: "タクシー", taxRate: 0.1 },
  { category1Name: "交通", category2Name: "ガソリン", taxRate: 0.1 },
  { category1Name: "交通", category2Name: "駐車場", taxRate: 0.1 },
  { category1Name: "交通", category2Name: "高速料金", taxRate: 0.1 },
  { category1Name: "交通", category2Name: "自転車", taxRate: 0.1 },
  { category1Name: "住居", category2Name: "家賃", taxRate: 0.1 },
  { category1Name: "住居", category2Name: "管理費", taxRate: 0.1 },
  { category1Name: "住居", category2Name: "家具", taxRate: 0.1 },
  { category1Name: "住居", category2Name: "家電", taxRate: 0.1 },
  { category1Name: "住居", category2Name: "修繕・工具", taxRate: 0.1 },
  { category1Name: "水道光熱", category2Name: "電気", taxRate: 0.1 },
  { category1Name: "水道光熱", category2Name: "ガス", taxRate: 0.1 },
  { category1Name: "水道光熱", category2Name: "水道", taxRate: 0.1 },
  { category1Name: "通信", category2Name: "携帯電話", taxRate: 0.1 },
  { category1Name: "通信", category2Name: "インターネット", taxRate: 0.1 },
  { category1Name: "通信", category2Name: "サブスク", taxRate: 0.1 },
  { category1Name: "通信", category2Name: "郵便・配送", taxRate: 0.1 },
  { category1Name: "医療", category2Name: "病院", taxRate: 0.1 },
  { category1Name: "医療", category2Name: "薬・処方箋", taxRate: 0.1 },
  { category1Name: "医療", category2Name: "歯科", taxRate: 0.1 },
  { category1Name: "医療", category2Name: "検査・予防", taxRate: 0.1 },
  { category1Name: "美容", category2Name: "美容院", taxRate: 0.1 },
  { category1Name: "美容", category2Name: "化粧品", taxRate: 0.1 },
  { category1Name: "美容", category2Name: "スキンケア", taxRate: 0.1 },
  { category1Name: "美容", category2Name: "理容・ネイル", taxRate: 0.1 },
  { category1Name: "衣服", category2Name: "服", taxRate: 0.1 },
  { category1Name: "衣服", category2Name: "靴", taxRate: 0.1 },
  { category1Name: "衣服", category2Name: "バッグ・小物", taxRate: 0.1 },
  { category1Name: "衣服", category2Name: "クリーニング", taxRate: 0.1 },
  { category1Name: "娯楽", category2Name: "映画・配信", taxRate: 0.1 },
  { category1Name: "娯楽", category2Name: "書籍", taxRate: 0.1 },
  { category1Name: "娯楽", category2Name: "ゲーム", taxRate: 0.1 },
  { category1Name: "娯楽", category2Name: "旅行・宿泊", taxRate: 0.1 },
  { category1Name: "娯楽", category2Name: "イベント", taxRate: 0.1 },
  { category1Name: "娯楽", category2Name: "スポーツ", taxRate: 0.1 },
  { category1Name: "交際", category2Name: "贈答", taxRate: 0.1 },
  { category1Name: "交際", category2Name: "会食", taxRate: 0.1 },
  { category1Name: "交際", category2Name: "冠婚葬祭", taxRate: 0.1 },
  { category1Name: "交際", category2Name: "家族・友人", taxRate: 0.1 },
  { category1Name: "教育", category2Name: "学習", taxRate: 0.1 },
  { category1Name: "教育", category2Name: "教材・書籍", taxRate: 0.1 },
  { category1Name: "教育", category2Name: "資格・試験", taxRate: 0.1 },
  { category1Name: "ペット", category2Name: "フード", taxRate: 0.1 },
  { category1Name: "ペット", category2Name: "用品", taxRate: 0.1 },
  { category1Name: "ペット", category2Name: "病院・ケア", taxRate: 0.1 },
  { category1Name: "税金・保険", category2Name: "保険料", taxRate: 0.1 },
  { category1Name: "税金・保険", category2Name: "税金", taxRate: 0.1 },
  { category1Name: "税金・保険", category2Name: "年金", taxRate: 0.1 },
  { category1Name: "その他", category2Name: "手数料", taxRate: 0.1 },
  { category1Name: "その他", category2Name: "現金調整", taxRate: 0.1 },
  { category1Name: "その他", category2Name: "未分類", taxRate: 0.1 }
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
    return category2.filter(item => item.category1Name === selectedCategory1);
  }, [category2, selectedCategory1]);

  useEffect(() => {
    if (!category1.length) {
      if (selectedCategory1) setSelectedCategory1("");
      return;
    }
    if (!selectedCategory1) {
      setSelectedCategory1(category1[0]?.category1Name || "");
      return;
    }
    if (category1.some(item => item.category1Name === selectedCategory1) || busy) return;
    setSelectedCategory1(category1[0]?.category1Name || "");
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
            <span key={item.category1Name} className={item.category1Name === selectedCategory1 ? "is-selected" : ""}>
              <button type="button" onClick={() => setSelectedCategory1(item.category1Name)}>
                {item.category1Name}
              </button>
              <IconButton
                label="削除"
                icon={Trash2}
                variant="danger"
                onClick={() => run(() => api.master.deleteCategory1(item.category1Name), "削除しました。")}
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
            {category1.map(item => <option key={item.category1Name} value={item.category1Name}>{item.category1Name}</option>)}
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
            <div key={`${item.category1Name}-${item.category2Name}`}>
              <span>{item.category1Name}</span>
              <strong>{item.category2Name}</strong>
              <em>{Number(item.taxRate) === 0.08 ? "8%" : "10%"}</em>
              <IconButton
                label="削除"
                icon={Trash2}
                variant="danger"
                onClick={() => run(() => api.master.deleteCategory2(item.category1Name, item.category2Name), "削除しました。")}
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
            <span key={item.salaryCategoryName}>
              {item.salaryCategoryName}
              <IconButton
                label="削除"
                icon={Trash2}
                variant="danger"
                onClick={() => run(() => api.master.deleteSalaryCategory(item.salaryCategoryName), "削除しました。")}
              />
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
