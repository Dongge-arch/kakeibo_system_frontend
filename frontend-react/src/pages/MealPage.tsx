import {
  BookOpenText,
  Check,
  ChefHat,
  CirclePlus,
  Clock3,
  Download,
  Eye,
  EyeOff,
  ExternalLink,
  ListChecks,
  Minus,
  PackageOpen,
  Pause,
  Play,
  Plus,
  Save,
  Search,
  RotateCcw,
  Timer,
  Trash2
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type {
  IngredientLine,
  ManualShoppingItem,
  MasterIngredient,
  Recipe,
  RecipeSelection,
  ShoppingPreview
} from "../api/homeTypes";

type Props = { notify: (message: string, tone?: "success" | "error" | "info") => void };
type Tab = "shopping" | "recipes" | "cook";

const UNIT_OPTIONS = [
  { value: "g", label: "g" },
  { value: "kg", label: "kg" },
  { value: "ml", label: "ml" },
  { value: "l", label: "L" },
  { value: "count", label: "個・本など" },
  { value: "pack", label: "パック" },
  { value: "bag", label: "袋" },
  { value: "bunch", label: "束" },
  { value: "block", label: "丁" },
  { value: "bottle", label: "瓶" },
  { value: "box", label: "箱" },
  { value: "tbsp", label: "大さじ" },
  { value: "tsp", label: "小さじ" },
  { value: "cm", label: "cm" },
  { value: "as_needed", label: "適量" }
] as const;

const CATEGORY_OPTIONS = [
  "野菜", "肉", "魚介", "卵", "乳製品", "豆腐", "加工肉", "麺類",
  "米・穀類", "粉類", "乾物", "調味料", "スパイス", "油", "その他"
];

const emptyPreview = (): ShoppingPreview => ({
  generatedAt: "",
  selections: [],
  materialGroups: [],
  seasonings: [],
  summary: { recipeCount: 0, materialCount: 0, seasoningCount: 0 }
});

function emptyIngredient(kind: "material" | "seasoning"): IngredientLine {
  return {
    itemId: "",
    name: "",
    amount: 1,
    unit: kind === "material" ? "count" : "tsp",
    unitLabel: kind === "material" ? "個" : "小さじ",
    category: kind === "material" ? "野菜" : "調味料",
    scalable: true,
    shoppingRequired: true,
    usage: ""
  };
}

function emptyRecipe(): Recipe {
  return {
    schemaVersion: "shopping_recipe_v4",
    recipeId: "",
    name: "",
    source: "",
    baseServings: 2,
    servingUnit: "人",
    cookTimeMin: 20,
    materials: [emptyIngredient("material")],
    seasonings: [],
    ingredients: [],
    steps: [""],
    videoUrl: "",
    notes: ""
  };
}

function cloneRecipe(recipe: Recipe): Recipe {
  return JSON.parse(JSON.stringify(recipe)) as Recipe;
}

function formatAmount(value: number | null, unitLabel: string): string {
  if (value === null) return "適量";
  const display = Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
  return display + unitLabel;
}

function youtubeEmbed(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const id = host === "youtu.be"
      ? parsed.pathname.slice(1)
      : ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(host)
        ? parsed.searchParams.get("v")
        : null;
    return id && /^[a-zA-Z0-9_-]{11}$/.test(id)
      ? `https://www.youtube-nocookie.com/embed/${id}`
      : null;
  } catch {
    return null;
  }
}

function downloadBase64(filename: string, mediaType: string, contentBase64: string): void {
  const binary = atob(contentBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  const url = URL.createObjectURL(new Blob([bytes], { type: mediaType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type IngredientEditorProps = {
  kind: "material" | "seasoning";
  line: IngredientLine;
  index: number;
  master: MasterIngredient[];
  canRemove: boolean;
  onChange: (line: IngredientLine) => void;
  onRemove: () => void;
};

function IngredientEditor({ kind, line, index, master, canRemove, onChange, onRemove }: IngredientEditorProps) {
  const prefix = kind === "material" ? "材料" : "調味料";
  const listId = `kitchen-${kind}-master`;

  function applyMaster(name: string) {
    const found = master.find(item => item.name === name);
    if (!found) return;
    const unit = found.units[0];
    onChange({
      ...line,
      itemId: found.itemId,
      name: found.name,
      category: found.category,
      unit: unit?.unit || line.unit,
      unitLabel: unit?.unitLabel || line.unitLabel,
      supplementalUnit: found.supplementalUnits[0] || line.supplementalUnit
    });
  }

  return <article className="kitchen-ingredient-card">
    <div className="kitchen-ingredient-head">
      <strong>{prefix} {index + 1}</strong>
      <button type="button" className="icon-command danger-text" title={`${prefix}を削除`} disabled={!canRemove} onClick={onRemove}>
        <Trash2 size={17} />
      </button>
    </div>
    <div className="kitchen-ingredient-grid">
      <label className="field kitchen-field-wide"><span>名称</span><input
        list={listId}
        value={line.name}
        onChange={event => onChange({ ...line, itemId: "", name: event.target.value })}
        onBlur={event => applyMaster(event.target.value)}
      /></label>
      <datalist id={listId}>{master.map(item => <option key={item.itemId} value={item.name} />)}</datalist>
      <label className="field"><span>分量</span><input
        type="number"
        min="0.001"
        step="any"
        disabled={line.unit === "as_needed"}
        value={line.amount ?? ""}
        onChange={event => onChange({ ...line, amount: event.target.value === "" ? null : Number(event.target.value) })}
      /></label>
      <label className="field"><span>計量単位</span><select value={line.unit} onChange={event => {
        const unit = event.target.value;
        const option = UNIT_OPTIONS.find(item => item.value === unit);
        onChange({ ...line, unit, unitLabel: option?.label || line.unitLabel, amount: unit === "as_needed" ? null : line.amount ?? 1, scalable: unit !== "as_needed" });
      }}>{UNIT_OPTIONS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <label className="field"><span>表示単位</span><input value={line.unitLabel} onChange={event => onChange({ ...line, unitLabel: event.target.value })} /></label>
      <label className="field"><span>カテゴリ</span><select value={line.category} onChange={event => onChange({ ...line, category: event.target.value })}>
        {CATEGORY_OPTIONS.map(category => <option key={category}>{category}</option>)}
      </select></label>
      <label className="field kitchen-field-wide"><span>用途・メモ</span><input placeholder={kind === "seasoning" ? "下味、仕上げなど" : "付け合わせなど"} value={line.usage || ""} onChange={event => onChange({ ...line, usage: event.target.value })} /></label>
    </div>
    <div className="kitchen-check-row">
      <label><input type="checkbox" checked={line.shoppingRequired} onChange={event => onChange({ ...line, shoppingRequired: event.target.checked })} /> 買い物リストに含める</label>
      <label><input type="checkbox" disabled={line.unit === "as_needed"} checked={line.scalable} onChange={event => onChange({ ...line, scalable: event.target.checked })} /> 人数で分量を変える</label>
      <button type="button" className="text-command" onClick={() => onChange({
        ...line,
        supplementalUnit: line.supplementalUnit ? undefined : { amount: 1, unit: "count", unitLabel: "個" }
      })}><PackageOpen size={15} /> {line.supplementalUnit ? "補助単位を解除" : "購入単位を設定"}</button>
    </div>
    {line.supplementalUnit && <div className="kitchen-supplemental">
      <strong>購入単位への換算</strong>
      <label className="field"><span>購入数</span><input type="number" min="0.001" step="any" value={line.supplementalUnit.amount} onChange={event => onChange({ ...line, supplementalUnit: { ...line.supplementalUnit!, amount: Number(event.target.value) } })} /></label>
      <label className="field"><span>内部単位</span><select value={line.supplementalUnit.unit} onChange={event => onChange({ ...line, supplementalUnit: { ...line.supplementalUnit!, unit: event.target.value } })}>{UNIT_OPTIONS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <label className="field"><span>表示</span><input value={line.supplementalUnit.unitLabel} onChange={event => onChange({ ...line, supplementalUnit: { ...line.supplementalUnit!, unitLabel: event.target.value } })} /></label>
      <label className="field"><span>1購入単位の内容量</span><input type="number" min="0.001" step="any" value={line.supplementalUnit.capacity?.amount ?? ""} onChange={event => {
        const raw = event.target.value;
        onChange({ ...line, supplementalUnit: {
          ...line.supplementalUnit!,
          capacity: raw === "" ? undefined : {
            amount: Number(raw),
            unit: line.supplementalUnit?.capacity?.unit || line.unit,
            unitLabel: line.supplementalUnit?.capacity?.unitLabel || line.unitLabel
          }
        } });
      }} /></label>
      {line.supplementalUnit.capacity && <>
        <label className="field"><span>内容量単位</span><select value={line.supplementalUnit.capacity.unit} onChange={event => onChange({ ...line, supplementalUnit: { ...line.supplementalUnit!, capacity: { ...line.supplementalUnit!.capacity!, unit: event.target.value } } })}>{UNIT_OPTIONS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label className="field"><span>内容量表示</span><input value={line.supplementalUnit.capacity.unitLabel} onChange={event => onChange({ ...line, supplementalUnit: { ...line.supplementalUnit!, capacity: { ...line.supplementalUnit!.capacity!, unitLabel: event.target.value } } })} /></label>
      </>}
    </div>}
  </article>;
}

export function MealPage({ notify }: Props) {
  const [tab, setTab] = useState<Tab>("shopping");
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [master, setMaster] = useState<MasterIngredient[]>([]);
  const [selections, setSelections] = useState<RecipeSelection[]>([]);
  const [checked, setChecked] = useState<string[]>([]);
  // 2026-09-30 Codex: レシピ外の日用品も同じ買い物計画として端末間で共有する。
  const [manualItems, setManualItems] = useState<ManualShoppingItem[]>([]);
  const [manualDraft, setManualDraft] = useState({ name: "", quantity: "", category: "その他" });
  const [hideCompleted, setHideCompleted] = useState(false);
  const [preview, setPreview] = useState<ShoppingPreview>(emptyPreview);
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [query, setQuery] = useState("");
  const [cookId, setCookId] = useState("");
  const [doneSteps, setDoneSteps] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | null>(null);
  const [timerMinutes, setTimerMinutes] = useState(5);
  const [timerRemaining, setTimerRemaining] = useState(5 * 60);
  const [timerRunning, setTimerRunning] = useState(false);

  const visibleRecipes = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase();
    if (!keyword) return recipes;
    return recipes.filter(recipe => [
      recipe.name,
      recipe.source,
      ...recipe.materials.map(item => item.name)
    ].join(" ").toLocaleLowerCase().includes(keyword));
  }, [query, recipes]);
  const cooking = recipes.find(recipe => recipe.recipeId === cookId) || recipes[0];
  const generatedRowIds = preview.materialGroups.flatMap(group => group.items.map(item => item.rowId))
    .concat(preview.seasonings.map(item => item.rowId));
  const allShoppingRowIds = generatedRowIds.concat(manualItems.map(item => item.rowId));
  const completedCount = allShoppingRowIds.filter(rowId => checked.includes(rowId)).length;
  const hasShoppingItems = allShoppingRowIds.length > 0;

  async function load() {
    try {
      const [savedRecipes, savedMaster, savedPlan] = await Promise.all([
        api.meal.recipes(),
        api.meal.ingredientMaster(),
        api.meal.plan()
      ]);
      setRecipes(savedRecipes || []);
      setMaster(savedMaster || []);
      setSelections(savedPlan.selections || []);
      setChecked(savedPlan.checked || []);
      setManualItems(savedPlan.manualItems || []);
      setPreview(savedPlan.preview || emptyPreview());
      setCookId(current => current || savedRecipes[0]?.recipeId || "");
    } catch (error) {
      notify((error as Error).message, "error");
    }
  }

  useEffect(() => { load().catch(console.error); }, []);
  useEffect(() => {
    if (!timerRunning) return;
    const timerId = window.setInterval(() => setTimerRemaining(current => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(timerId);
  }, [timerRunning]);
  useEffect(() => {
    if (!timerRunning || timerRemaining > 0) return;
    setTimerRunning(false);
    notify("タイマーが終了しました。", "success");
  }, [timerRemaining, timerRunning]);

  async function persistPlan(nextSelections: RecipeSelection[], nextChecked = checked, nextManualItems = manualItems) {
    setSelections(nextSelections);
    setChecked(nextChecked);
    setManualItems(nextManualItems);
    try {
      const result = await api.meal.savePlan(nextSelections, nextChecked, nextManualItems);
      setSelections(result.selections || nextSelections);
      setChecked(result.checked || []);
      setManualItems(result.manualItems || nextManualItems);
      setPreview(result.preview || emptyPreview());
    } catch (error) {
      notify((error as Error).message, "error");
    }
  }

  async function addManualItem() {
    const name = manualDraft.name.trim();
    if (!name) return;
    const manualId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const next = [...manualItems, {
      manualId,
      rowId: `manual-${manualId}`,
      name,
      quantity: manualDraft.quantity.trim(),
      category: manualDraft.category
    }];
    setManualDraft({ name: "", quantity: "", category: "その他" });
    await persistPlan(selections, checked, next);
  }

  async function removeManualItem(item: ManualShoppingItem) {
    await persistPlan(
      selections,
      checked.filter(rowId => rowId !== item.rowId),
      manualItems.filter(row => row.manualId !== item.manualId)
    );
  }

  function setKitchenTimer(minutes: number) {
    // 2026-09-30 Codex: 誤入力で極端な時間にならないよう、調理向けの範囲へ丸める。
    const safeMinutes = Math.max(1, Math.min(180, Math.round(minutes || 1)));
    setTimerMinutes(safeMinutes);
    setTimerRemaining(safeMinutes * 60);
    setTimerRunning(false);
  }

  async function saveRecipe() {
    if (!editing) return;
    setBusy(true);
    try {
      const result = await api.meal.saveRecipe(editing);
      notify("レシピを保存しました。", "success");
      setEditing(null);
      setCookId(result.recipeId);
      await load();
    } catch (error) {
      notify((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function deleteRecipe(recipe: Recipe) {
    if (!recipe.recipeId || !confirm(`「${recipe.name}」を削除しますか？`)) return;
    try {
      await api.meal.deleteRecipe(recipe.recipeId);
      await persistPlan(selections.filter(item => item.recipeId !== recipe.recipeId), checked);
      notify("レシピを削除しました。", "success");
      await load();
    } catch (error) {
      notify((error as Error).message, "error");
    }
  }

  function updateIngredient(kind: "materials" | "seasonings", index: number, line: IngredientLine) {
    if (!editing) return;
    setEditing({ ...editing, [kind]: editing[kind].map((item, position) => position === index ? line : item) });
  }

  async function exportShopping(format: "pdf" | "xlsx") {
    if (!selections.length && !manualItems.length) return;
    setExporting(format);
    try {
      const layout = window.matchMedia("(max-width: 720px), (pointer: coarse)").matches ? "mobile" : "desktop";
      const file = await api.meal.exportFile(selections, format, layout, manualItems);
      downloadBase64(file.filename, file.mediaType, file.contentBase64);
      notify(`${format === "pdf" ? "PDF" : "Excel"}を作成しました。`, "success");
    } catch (error) {
      notify((error as Error).message, "error");
    } finally {
      setExporting(null);
    }
  }

  const embed = cooking ? youtubeEmbed(cooking.videoUrl) : null;

  return <div className="module-workspace kitchen-workspace">
    <div className="module-tabs" role="tablist" aria-label="キッチン">
      <button type="button" className={tab === "shopping" ? "is-active" : ""} onClick={() => setTab("shopping")}><ListChecks size={17} /> 買い物リスト</button>
      <button type="button" className={tab === "recipes" ? "is-active" : ""} onClick={() => setTab("recipes")}><BookOpenText size={17} /> レシピ管理</button>
      <button type="button" className={tab === "cook" ? "is-active" : ""} onClick={() => setTab("cook")}><ChefHat size={17} /> 調理</button>
    </div>

    {tab === "shopping" && <div className="kitchen-shopping-layout">
      <section className="module-section kitchen-selection-section">
        <div className="module-heading"><div><h1>作るレシピ</h1><p>人数と作る回数から、必要な購入量をまとめます。</p></div></div>
        <div className="module-action-row">
          <select aria-label="追加するレシピ" id="kitchen-recipe-select" defaultValue=""><option value="" disabled>レシピを選択</option>{recipes.map(recipe => <option key={recipe.recipeId} value={recipe.recipeId}>{recipe.name}</option>)}</select>
          <button type="button" className="command-button command-button--primary" disabled={!recipes.length} onClick={() => {
            const select = document.getElementById("kitchen-recipe-select") as HTMLSelectElement;
            const recipe = recipes.find(item => item.recipeId === select.value);
            if (recipe) persistPlan([...selections, { recipeId: recipe.recipeId, targetServings: recipe.baseServings, cookCount: 1 }]);
          }}><Plus size={17} /> 追加</button>
        </div>
        <div className="kitchen-selection-list">
          {selections.map((selection, index) => {
            const recipe = recipes.find(item => item.recipeId === selection.recipeId);
            return <div className="kitchen-selection-row" key={`${selection.recipeId}-${index}`}>
              <div><strong>{recipe?.name || "削除されたレシピ"}</strong><small>基準 {recipe?.baseServings || "-"}人分</small></div>
              <label><span>人数</span><input type="number" min="0.1" max="100" step="0.1" value={selection.targetServings} onChange={event => setSelections(selections.map((item, position) => position === index ? { ...item, targetServings: Number(event.target.value) } : item))} onBlur={() => persistPlan(selections)} /></label>
              <label><span>作る回数</span><input type="number" min="1" max="99" step="1" value={selection.cookCount} onChange={event => setSelections(selections.map((item, position) => position === index ? { ...item, cookCount: Number(event.target.value) } : item))} onBlur={() => persistPlan(selections)} /></label>
              <button type="button" className="icon-command" title="選択から削除" onClick={() => persistPlan(selections.filter((_, position) => position !== index))}><Trash2 size={17} /></button>
            </div>;
          })}
          {!selections.length && <p className="module-empty">レシピを追加すると買い物リストを作成できます。</p>}
        </div>
      </section>

      <section className="module-section kitchen-result" aria-label="買い物リスト">
        <div className="module-heading">
          <div><h2>買い物リスト</h2><p>{completedCount} / {allShoppingRowIds.length} 品を購入済み</p></div>
          <div className="module-action-row kitchen-export-actions">
            <button type="button" className="icon-command" title={hideCompleted ? "購入済みも表示" : "未購入だけ表示"} onClick={() => setHideCompleted(current => !current)}>{hideCompleted ? <Eye size={18} /> : <EyeOff size={18} />}</button>
            <button type="button" className="command-button command-button--ghost" disabled={!hasShoppingItems || exporting !== null} onClick={() => exportShopping("pdf")}><Download size={16} /> PDF</button>
            <button type="button" className="command-button command-button--ghost" disabled={!hasShoppingItems || exporting !== null} onClick={() => exportShopping("xlsx")}><Download size={16} /> Excel</button>
          </div>
        </div>
        <div className="kitchen-shopping-progress" aria-label={`買い物の進捗 ${completedCount}/${allShoppingRowIds.length}`}><span style={{ width: `${allShoppingRowIds.length ? completedCount / allShoppingRowIds.length * 100 : 0}%` }} /></div>
        <div className="kitchen-manual-form">
          <label className="field"><span>買い足すもの</span><input placeholder="牛乳、ラップなど" value={manualDraft.name} onChange={event => setManualDraft({ ...manualDraft, name: event.target.value })} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addManualItem(); } }} /></label>
          <label className="field"><span>数量・メモ</span><input placeholder="2本、予備1個など" value={manualDraft.quantity} onChange={event => setManualDraft({ ...manualDraft, quantity: event.target.value })} /></label>
          <label className="field"><span>売り場</span><select value={manualDraft.category} onChange={event => setManualDraft({ ...manualDraft, category: event.target.value })}>{CATEGORY_OPTIONS.map(category => <option key={category}>{category}</option>)}</select></label>
          <button type="button" className="command-button command-button--primary" disabled={!manualDraft.name.trim()} onClick={addManualItem}><Plus size={17} /> 追加</button>
        </div>
        {!!completedCount && <button type="button" className="text-command kitchen-clear-completed" onClick={() => persistPlan(selections, [], manualItems.filter(item => !checked.includes(item.rowId)))}><Trash2 size={15} /> 購入済みを整理</button>}
        {!!manualItems.length && <div className="kitchen-manual-list"><h3>買い足し</h3>{manualItems.filter(item => !hideCompleted || !checked.includes(item.rowId)).map(item => <label className={`kitchen-shopping-row ${checked.includes(item.rowId) ? "is-checked" : ""}`} key={item.rowId}>
          <input type="checkbox" checked={checked.includes(item.rowId)} onChange={() => persistPlan(selections, checked.includes(item.rowId) ? checked.filter(key => key !== item.rowId) : [...checked, item.rowId])} />
          <span><strong>{item.name}</strong><small>{item.category}</small></span>
          <b>{item.quantity}</b>
          <button type="button" className="icon-command danger-text" title="買い足しから削除" onClick={event => { event.preventDefault(); removeManualItem(item); }}><Trash2 size={16} /></button>
        </label>)}</div>}
        {hasShoppingItems ? <div className="kitchen-shopping-columns">
          <div className="kitchen-shopping-column">
            <h3>材料</h3>
            {preview.materialGroups.filter(group => group.items.some(item => !hideCompleted || !checked.includes(item.rowId))).map(group => <section className="kitchen-shopping-group" key={group.category}>
              <h4>{group.category}</h4>
              {group.items.filter(item => !hideCompleted || !checked.includes(item.rowId)).map(item => <label className={`kitchen-shopping-row ${checked.includes(item.rowId) ? "is-checked" : ""}`} key={item.rowId}>
                <input type="checkbox" checked={checked.includes(item.rowId)} onChange={() => {
                  const next = checked.includes(item.rowId) ? checked.filter(key => key !== item.rowId) : [...checked, item.rowId];
                  persistPlan(selections, next);
                }} />
                <span><strong>{item.name}</strong><small>{item.sources.map(source => source.recipeName).join("、")}</small></span>
                <b>{formatAmount(item.purchaseAmount, item.unitLabel)}</b>
              </label>)}
            </section>)}
          </div>
          <div className="kitchen-shopping-column kitchen-seasoning-column">
            <h3>調味料・在庫確認</h3>
            <p>分量は表示せず、在庫の有無を確認します。</p>
            {preview.seasonings.filter(item => !hideCompleted || !checked.includes(item.rowId)).map(item => <label className={`kitchen-shopping-row ${checked.includes(item.rowId) ? "is-checked" : ""}`} key={item.rowId}>
              <input type="checkbox" checked={checked.includes(item.rowId)} onChange={() => {
                const next = checked.includes(item.rowId) ? checked.filter(key => key !== item.rowId) : [...checked, item.rowId];
                persistPlan(selections, next);
              }} />
              <span><strong>{item.name}</strong><small>{item.sources.map(source => source.recipeName + (source.usage ? `／${source.usage}` : "")).join("、")}</small></span>
            </label>)}
            {!preview.seasonings.length && <p className="module-empty">調味料はありません。</p>}
          </div>
        </div> : <p className="module-empty">レシピを選ぶか、買い足すものを追加してください。</p>}
      </section>
    </div>}

    {tab === "recipes" && <div className="kitchen-recipe-layout">
      <section className="module-section kitchen-recipe-library">
        <div className="module-heading"><div><h1>レシピ管理</h1><p>{recipes.length}件のレシピ</p></div><button type="button" className="command-button command-button--primary" onClick={() => setEditing(emptyRecipe())}><CirclePlus size={17} /> 新規</button></div>
        <label className="kitchen-search"><Search size={17} /><input aria-label="レシピを検索" placeholder="料理名・食材で検索" value={query} onChange={event => setQuery(event.target.value)} /></label>
        <div className="kitchen-recipe-list">
          {visibleRecipes.map(recipe => <article key={recipe.recipeId} className="kitchen-recipe-card">
            <div><small>{recipe.source || "出典未登録"}</small><strong>{recipe.name}</strong><span>{recipe.baseServings}人分・約{recipe.cookTimeMin}分・材料{recipe.materials.length}品</span></div>
            <div className="module-action-row"><button type="button" className="command-button command-button--ghost" onClick={() => setEditing(cloneRecipe(recipe))}>編集</button><button type="button" className="icon-command danger-text" title="削除" onClick={() => deleteRecipe(recipe)}><Trash2 size={17} /></button></div>
          </article>)}
          {!visibleRecipes.length && <p className="module-empty">該当するレシピがありません。</p>}
        </div>
      </section>

      {editing && <section className="module-section kitchen-recipe-editor">
        <div className="module-heading"><h2>{editing.recipeId ? "レシピ編集" : "新しいレシピ"}</h2></div>
        <div className="module-form-grid kitchen-basic-grid">
          <label className="field"><span>料理名</span><input value={editing.name} onChange={event => setEditing({ ...editing, name: event.target.value })} /></label>
          <label className="field"><span>出典</span><input placeholder="家庭のレシピ・URLなど" value={editing.source} onChange={event => setEditing({ ...editing, source: event.target.value })} /></label>
          <label className="field"><span>基準人数</span><input type="number" min="0.1" max="100" step="0.1" value={editing.baseServings} onChange={event => setEditing({ ...editing, baseServings: Number(event.target.value) })} /></label>
          <label className="field"><span>調理時間（分）</span><input type="number" min="0" max="1440" step="1" value={editing.cookTimeMin} onChange={event => setEditing({ ...editing, cookTimeMin: Number(event.target.value) })} /></label>
          <label className="field module-span"><span>動画URL</span><input type="url" value={editing.videoUrl} onChange={event => setEditing({ ...editing, videoUrl: event.target.value })} /></label>
        </div>

        <div className="module-subheading"><div><h3>材料</h3><small>人数換算し、同じ食材をまとめます。</small></div><button type="button" className="icon-command" title="材料を追加" onClick={() => setEditing({ ...editing, materials: [...editing.materials, emptyIngredient("material")] })}><Plus size={18} /></button></div>
        <div className="kitchen-ingredient-list">{editing.materials.map((line, index) => <IngredientEditor key={index} kind="material" line={line} index={index} master={master} canRemove={editing.materials.length > 1} onChange={next => updateIngredient("materials", index, next)} onRemove={() => setEditing({ ...editing, materials: editing.materials.filter((_, position) => position !== index) })} />)}</div>

        <div className="module-subheading"><div><h3>調味料</h3><small>分量を表示せず、在庫確認用に重複をまとめます。</small></div><button type="button" className="icon-command" title="調味料を追加" onClick={() => setEditing({ ...editing, seasonings: [...editing.seasonings, emptyIngredient("seasoning")] })}><Plus size={18} /></button></div>
        <div className="kitchen-ingredient-list">{editing.seasonings.map((line, index) => <IngredientEditor key={index} kind="seasoning" line={line} index={index} master={master} canRemove onChange={next => updateIngredient("seasonings", index, next)} onRemove={() => setEditing({ ...editing, seasonings: editing.seasonings.filter((_, position) => position !== index) })} />)}{!editing.seasonings.length && <p className="module-empty kitchen-inline-empty">調味料は任意です。</p>}</div>

        <div className="module-subheading"><h3>手順</h3><button type="button" className="icon-command" title="手順を追加" onClick={() => setEditing({ ...editing, steps: [...editing.steps, ""] })}><Plus size={18} /></button></div>
        {editing.steps.map((step, index) => <div className="step-edit-row" key={index}><span>{index + 1}</span><textarea aria-label={`手順${index + 1}`} value={step} onChange={event => setEditing({ ...editing, steps: editing.steps.map((item, position) => position === index ? event.target.value : item) })} /><button type="button" className="icon-command" title="手順を削除" onClick={() => setEditing({ ...editing, steps: editing.steps.filter((_, position) => position !== index) })}><Minus size={17} /></button></div>)}
        <label className="field"><span>メモ</span><textarea value={editing.notes} onChange={event => setEditing({ ...editing, notes: event.target.value })} /></label>
        <div className="module-action-row kitchen-editor-actions"><button type="button" className="command-button command-button--ghost" onClick={() => setEditing(null)}>キャンセル</button><button type="button" className="command-button command-button--primary" disabled={busy} onClick={saveRecipe}><Save size={17} /> 保存</button></div>
      </section>}
    </div>}

    {tab === "cook" && <section className="module-section cook-section">
      <div className="module-heading"><h1>調理</h1><select aria-label="調理する料理" value={cooking?.recipeId || ""} onChange={event => { const recipe = recipes.find(item => item.recipeId === event.target.value); setCookId(event.target.value); setDoneSteps([]); if (recipe?.cookTimeMin) setKitchenTimer(recipe.cookTimeMin); }}><option value="">料理を選択</option>{recipes.map(recipe => <option key={recipe.recipeId} value={recipe.recipeId}>{recipe.name}</option>)}</select></div>
      {cooking ? <div className="cook-layout">
        <div className="cook-media">{embed ? <iframe src={embed} title={`${cooking.name}の動画`} allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
          : cooking.videoUrl.match(/\.(mp4|webm|ogg)(\?|$)/i) ? <video src={cooking.videoUrl} controls />
          : cooking.videoUrl ? <a href={cooking.videoUrl} target="_blank" rel="noopener noreferrer"><Play size={20} /> 動画を開く <ExternalLink size={16} /></a>
          : <div className="module-empty">動画なし</div>}
          {cooking.notes && <p>{cooking.notes}</p>}
          <div className="cook-timer" aria-label="調理タイマー">
            <div className="cook-timer-heading"><Timer size={20} /><strong>タイマー</strong><time>{String(Math.floor(timerRemaining / 60)).padStart(2, "0")}:{String(timerRemaining % 60).padStart(2, "0")}</time></div>
            <div className="cook-timer-presets"><button type="button" onClick={() => setKitchenTimer(3)}>3分</button><button type="button" onClick={() => setKitchenTimer(5)}>5分</button><button type="button" onClick={() => setKitchenTimer(10)}>10分</button>{cooking.cookTimeMin > 0 && <button type="button" onClick={() => setKitchenTimer(cooking.cookTimeMin)}><Clock3 size={14} /> {cooking.cookTimeMin}分</button>}</div>
            <div className="cook-timer-controls"><label><span>分</span><input type="number" min="1" max="180" value={timerMinutes} onChange={event => setKitchenTimer(Number(event.target.value))} /></label><button type="button" className="icon-command" title={timerRunning ? "一時停止" : "開始"} onClick={() => { if (timerRemaining === 0) setTimerRemaining(timerMinutes * 60); setTimerRunning(current => !current); }}>{timerRunning ? <Pause size={19} /> : <Play size={19} />}</button><button type="button" className="icon-command" title="リセット" onClick={() => setKitchenTimer(timerMinutes)}><RotateCcw size={18} /></button></div>
          </div>
        </div>
        <div className="cook-steps"><h2>{cooking.name}</h2><span>{cooking.baseServings}人分・約{cooking.cookTimeMin}分</span>
          <h3>材料</h3><ul>{cooking.materials.map((ingredient, index) => <li key={index}>{ingredient.name}<strong>{formatAmount(ingredient.amount, ingredient.unitLabel)}</strong></li>)}</ul>
          {!!cooking.seasonings.length && <><h3>調味料</h3><ul>{cooking.seasonings.map((ingredient, index) => <li key={index}>{ingredient.name}<strong>{formatAmount(ingredient.amount, ingredient.unitLabel)}</strong></li>)}</ul></>}
          <h3>手順</h3>{cooking.steps.map((step, index) => <button type="button" key={index} className={`cook-step ${doneSteps.includes(index) ? "is-done" : ""}`} onClick={() => setDoneSteps(doneSteps.includes(index) ? doneSteps.filter(position => position !== index) : [...doneSteps, index])}><span>{doneSteps.includes(index) ? <Check size={18} /> : index + 1}</span><span>{step}</span></button>)}
        </div>
      </div> : <p className="module-empty">レシピを登録してください。</p>}
    </section>}
  </div>;
}
