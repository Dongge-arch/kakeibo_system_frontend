import { BookOpenText, Check, ChefHat, CirclePlus, ExternalLink, ListChecks, Minus, Play, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { Ingredient, PlanItem, Recipe, ShoppingRow } from "../api/homeTypes";

type Props = { notify: (message: string, tone?: "success" | "error" | "info") => void };
type Tab = "plan" | "recipes" | "cook";

const emptyRecipe = (): Recipe => ({ name: "", baseServings: 2, ingredients: [{ name: "", quantity: 1, unit: "" }], steps: [""], videoUrl: "", notes: "" });

function shoppingRows(recipes: Recipe[], items: PlanItem[]): ShoppingRow[] {
  const byId = new Map(recipes.map(recipe => [recipe.recipeId, recipe]));
  const totals = new Map<string, ShoppingRow>();
  for (const item of items) {
    const recipe = byId.get(item.recipeId);
    if (!recipe) continue;
    const factor = item.count * item.people / recipe.baseServings;
    for (const ingredient of recipe.ingredients) {
      const key = `${ingredient.name.trim().toLocaleLowerCase()}|${ingredient.unit.trim()}`;
      const previous = totals.get(key);
      totals.set(key, { key, name: ingredient.name, unit: ingredient.unit,
        quantity: Math.round(((previous?.quantity || 0) + ingredient.quantity * factor) * 100) / 100 });
    }
  }
  return [...totals.values()];
}

function youtubeEmbed(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const id = host === "youtu.be" ? parsed.pathname.slice(1) :
      host === "youtube.com" || host === "www.youtube.com" || host === "m.youtube.com" ? parsed.searchParams.get("v") : null;
    return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  } catch { return null; }
}

export function MealPage({ notify }: Props) {
  const [tab, setTab] = useState<Tab>("plan");
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [items, setItems] = useState<PlanItem[]>([]);
  const [checked, setChecked] = useState<string[]>([]);
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [cookId, setCookId] = useState("");
  const [doneSteps, setDoneSteps] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const shopping = useMemo(() => shoppingRows(recipes, items), [recipes, items]);
  const cooking = recipes.find(recipe => recipe.recipeId === cookId) || recipes[0];

  async function load() {
    try {
      const [savedRecipes, savedPlan] = await Promise.all([api.meal.recipes(), api.meal.plan()]);
      setRecipes(savedRecipes);
      setItems(savedPlan.items || []);
      setChecked(savedPlan.checked || []);
    } catch (error) { notify((error as Error).message, "error"); }
  }

  useEffect(() => { load().catch(console.error); }, []);

  async function changePlan(nextItems: PlanItem[], nextChecked = checked) {
    setItems(nextItems);
    setChecked(nextChecked);
    try { await api.meal.savePlan(nextItems, nextChecked); }
    catch (error) { notify((error as Error).message, "error"); }
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
    } catch (error) { notify((error as Error).message, "error"); }
    finally { setBusy(false); }
  }

  async function deleteRecipe(recipe: Recipe) {
    if (!recipe.recipeId || !confirm(`「${recipe.name}」を削除しますか？`)) return;
    try {
      await api.meal.deleteRecipe(recipe.recipeId);
      const nextItems = items.filter(item => item.recipeId !== recipe.recipeId);
      await api.meal.savePlan(nextItems, checked);
      notify("レシピを削除しました。", "success");
      await load();
    } catch (error) { notify((error as Error).message, "error"); }
  }

  function updateIngredient(index: number, patch: Partial<Ingredient>) {
    if (!editing) return;
    setEditing({ ...editing, ingredients: editing.ingredients.map((row, position) => position === index ? { ...row, ...patch } : row) });
  }

  const video = cooking?.videoUrl || "";
  const embed = youtubeEmbed(video);

  return <div className="module-workspace">
    <div className="module-tabs" role="tablist" aria-label="献立ノート">
      <button type="button" className={tab === "plan" ? "is-active" : ""} onClick={() => setTab("plan")}><ListChecks size={17} /> 献立と買い物</button>
      <button type="button" className={tab === "recipes" ? "is-active" : ""} onClick={() => setTab("recipes")}><BookOpenText size={17} /> レシピ</button>
      <button type="button" className={tab === "cook" ? "is-active" : ""} onClick={() => setTab("cook")}><ChefHat size={17} /> 調理</button>
    </div>

    {tab === "plan" && <div className="meal-plan-layout">
      <section className="module-section">
        <div className="module-heading"><h1>献立</h1></div>
        <div className="meal-plan-list">
          {items.map((item, index) => {
            const recipe = recipes.find(row => row.recipeId === item.recipeId);
            return <div className="meal-plan-row" key={`${item.recipeId}-${index}`}>
              <strong>{recipe?.name || "削除されたレシピ"}</strong>
              <label><span>回数</span><input type="number" min="1" max="100" value={item.count} onChange={event => changePlan(items.map((row, i) => i === index ? { ...row, count: Math.max(1, Number(event.target.value) || 1) } : row))} /></label>
              <label><span>人数</span><input type="number" min="1" max="100" value={item.people} onChange={event => changePlan(items.map((row, i) => i === index ? { ...row, people: Math.max(1, Number(event.target.value) || 1) } : row))} /></label>
              <button type="button" className="icon-command" title="献立から削除" onClick={() => changePlan(items.filter((_, i) => i !== index))}><Trash2 size={17} /></button>
            </div>;
          })}
          {!items.length && <p className="module-empty">献立がありません。</p>}
        </div>
        <div className="module-action-row">
          <select aria-label="追加する料理" id="meal-recipe-select" defaultValue=""><option value="" disabled>料理を選択</option>{recipes.map(recipe => <option key={recipe.recipeId} value={recipe.recipeId}>{recipe.name}</option>)}</select>
          <button type="button" className="command-button command-button--primary" disabled={!recipes.length} onClick={() => {
            const select = document.getElementById("meal-recipe-select") as HTMLSelectElement;
            if (select.value) changePlan([...items, { recipeId: select.value, count: 1, people: 2 }]);
          }}><Plus size={17} /> 追加</button>
        </div>
      </section>
      <section className="module-section">
        <div className="module-heading"><h2>買い物リスト</h2><span>{shopping.length} 品目</span></div>
        {shopping.length ? <div className="shopping-list">{shopping.map(row => <label key={row.key} className={checked.includes(row.key) ? "is-checked" : ""}>
          <input type="checkbox" checked={checked.includes(row.key)} onChange={() => {
            const next = checked.includes(row.key) ? checked.filter(key => key !== row.key) : [...checked, row.key];
            changePlan(items, next);
          }} /><span>{row.name}</span><strong>{row.quantity} {row.unit}</strong>
        </label>)}</div> : <p className="module-empty">料理を追加すると材料がまとまります。</p>}
      </section>
    </div>}

    {tab === "recipes" && <div className="recipe-layout">
      <section className="module-section">
        <div className="module-heading"><h1>レシピ</h1><button type="button" className="command-button command-button--primary" onClick={() => setEditing(emptyRecipe())}><CirclePlus size={17} /> 新規</button></div>
        <div className="recipe-list">{recipes.map(recipe => <article key={recipe.recipeId} className="recipe-row">
          <div><strong>{recipe.name}</strong><span>{recipe.baseServings}人分 · 材料{recipe.ingredients.length}件</span></div>
          <div className="module-action-row"><button type="button" className="command-button command-button--ghost" onClick={() => setEditing({ ...recipe })}>編集</button>
            <button type="button" className="icon-command" title="削除" onClick={() => deleteRecipe(recipe)}><Trash2 size={17} /></button></div>
        </article>)}{!recipes.length && <p className="module-empty">レシピがありません。</p>}</div>
      </section>
      {editing && <section className="module-section recipe-editor">
        <div className="module-heading"><h2>{editing.recipeId ? "レシピ編集" : "新しいレシピ"}</h2></div>
        <div className="module-form-grid">
          <label className="field"><span>料理名</span><input value={editing.name} onChange={event => setEditing({ ...editing, name: event.target.value })} /></label>
          <label className="field"><span>基準人数</span><input type="number" min="1" value={editing.baseServings} onChange={event => setEditing({ ...editing, baseServings: Number(event.target.value) })} /></label>
          <label className="field module-span"><span>動画URL</span><input type="url" value={editing.videoUrl} onChange={event => setEditing({ ...editing, videoUrl: event.target.value })} /></label>
        </div>
        <div className="module-subheading"><h3>材料</h3><button type="button" className="icon-command" title="材料を追加" onClick={() => setEditing({ ...editing, ingredients: [...editing.ingredients, { name: "", quantity: 1, unit: "" }] })}><Plus size={18} /></button></div>
        {editing.ingredients.map((ingredient, index) => <div className="ingredient-edit-row" key={index}>
          <input aria-label={`材料${index + 1}`} placeholder="材料名" value={ingredient.name} onChange={event => updateIngredient(index, { name: event.target.value })} />
          <input aria-label="分量" type="number" min="0.01" step="any" value={ingredient.quantity} onChange={event => updateIngredient(index, { quantity: Number(event.target.value) })} />
          <input aria-label="単位" placeholder="g・個など" value={ingredient.unit} onChange={event => updateIngredient(index, { unit: event.target.value })} />
          <button type="button" className="icon-command" title="材料を削除" disabled={editing.ingredients.length === 1} onClick={() => setEditing({ ...editing, ingredients: editing.ingredients.filter((_, i) => i !== index) })}><Minus size={17} /></button>
        </div>)}
        <div className="module-subheading"><h3>手順</h3><button type="button" className="icon-command" title="手順を追加" onClick={() => setEditing({ ...editing, steps: [...editing.steps, ""] })}><Plus size={18} /></button></div>
        {editing.steps.map((step, index) => <div className="step-edit-row" key={index}><span>{index + 1}</span><textarea aria-label={`手順${index + 1}`} value={step} onChange={event => setEditing({ ...editing, steps: editing.steps.map((row, i) => i === index ? event.target.value : row) })} /><button type="button" className="icon-command" title="手順を削除" onClick={() => setEditing({ ...editing, steps: editing.steps.filter((_, i) => i !== index) })}><Minus size={17} /></button></div>)}
        <label className="field"><span>メモ</span><textarea value={editing.notes} onChange={event => setEditing({ ...editing, notes: event.target.value })} /></label>
        <div className="module-action-row"><button type="button" className="command-button command-button--ghost" onClick={() => setEditing(null)}>キャンセル</button><button type="button" className="command-button command-button--primary" disabled={busy} onClick={saveRecipe}><Save size={17} /> 保存</button></div>
      </section>}
    </div>}

    {tab === "cook" && <section className="module-section cook-section">
      <div className="module-heading"><h1>調理</h1><select aria-label="調理する料理" value={cooking?.recipeId || ""} onChange={event => { setCookId(event.target.value); setDoneSteps([]); }}><option value="">料理を選択</option>{recipes.map(recipe => <option key={recipe.recipeId} value={recipe.recipeId}>{recipe.name}</option>)}</select></div>
      {cooking ? <div className="cook-layout">
        <div className="cook-media">{embed ? <iframe src={embed} title={`${cooking.name}の動画`} allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
          : video.match(/\.(mp4|webm|ogg)(\?|$)/i) ? <video src={video} controls />
          : video ? <a href={video} target="_blank" rel="noopener noreferrer"><Play size={20} /> 動画を開く <ExternalLink size={16} /></a>
          : <div className="module-empty">動画なし</div>}
          {cooking.notes && <p>{cooking.notes}</p>}
        </div>
        <div className="cook-steps"><h2>{cooking.name}</h2><span>{cooking.baseServings}人分</span>
          <h3>材料</h3><ul>{cooking.ingredients.map((ingredient, index) => <li key={index}>{ingredient.name}<strong>{ingredient.quantity} {ingredient.unit}</strong></li>)}</ul>
          <h3>手順</h3>{cooking.steps.map((step, index) => <button type="button" key={index} className={`cook-step ${doneSteps.includes(index) ? "is-done" : ""}`} onClick={() => setDoneSteps(doneSteps.includes(index) ? doneSteps.filter(i => i !== index) : [...doneSteps, index])}><span>{doneSteps.includes(index) ? <Check size={18} /> : index + 1}</span><span>{step}</span></button>)}
        </div>
      </div> : <p className="module-empty">レシピを登録してください。</p>}
    </section>}
  </div>;
}
