export type SupplementalUnit = {
  amount: number;
  unit: string;
  unitLabel: string;
  capacity?: { amount: number; unit: string; unitLabel: string };
};
export type UsageBreakdown = { usage: string; amount: number | null; unit: string; unitLabel: string };
export type IngredientLine = {
  itemId: string;
  name: string;
  amount: number | null;
  unit: string;
  unitLabel: string;
  category: string;
  scalable: boolean;
  shoppingRequired: boolean;
  usage?: string;
  usages?: UsageBreakdown[];
  supplementalUnit?: SupplementalUnit;
};
export type Ingredient = { name: string; quantity: number; unit: string };
export type Recipe = {
  schemaVersion: string;
  recipeId: string;
  name: string;
  source: string;
  baseServings: number;
  servingUnit: string;
  cookTimeMin: number;
  materials: IngredientLine[];
  seasonings: IngredientLine[];
  ingredients: Ingredient[];
  steps: string[];
  videoUrl: string;
  notes: string;
  updatedAt?: string;
};
export type PlanItem = { recipeId: string; count: number; people: number };
export type ShoppingRow = Ingredient & { key: string };
export type RecipeSelection = { recipeId: string; targetServings: number; cookCount: number };
export type MaterialSource = { recipeId: string; recipeName: string; usage: string };
export type ShoppingMaterial = {
  rowId: string;
  itemId: string;
  name: string;
  category: string;
  calculatedAmount: number | null;
  purchaseAmount: number | null;
  unit: string;
  unitLabel: string;
  sources: MaterialSource[];
};
export type ShoppingMaterialGroup = { category: string; items: ShoppingMaterial[] };
export type ShoppingSeasoning = {
  rowId: string;
  itemId: string;
  name: string;
  category: string;
  sources: MaterialSource[];
};
export type ShoppingPreview = {
  generatedAt: string;
  selections: Array<RecipeSelection & { recipeName: string }>;
  materialGroups: ShoppingMaterialGroup[];
  seasonings: ShoppingSeasoning[];
  summary: { recipeCount: number; materialCount: number; seasoningCount: number };
};
export type ManualShoppingItem = {
  manualId: string;
  rowId: string;
  name: string;
  quantity: string;
  category: string;
};
export type ShoppingPlan = {
  selections: RecipeSelection[];
  items: PlanItem[];
  checked: string[];
  manualItems: ManualShoppingItem[];
  preview: ShoppingPreview;
  shoppingList: ShoppingRow[];
};
export type MasterIngredient = {
  itemId: string;
  name: string;
  category: string;
  units: Array<{ unit: string; unitLabel: string }>;
  supplementalUnits: SupplementalUnit[];
};
export type ExportFile = { filename: string; mediaType: string; contentBase64: string };

export type FamilyMember = { userId: string; role: "owner" | "member"; name: string };
export type Family = { familyId: string; name: string; ownerUserId: string; members: FamilyMember[] };
export type Baby = { babyId?: string; familyId: string; name: string; birthDate: string; notes: string };
export type BabyEventType = "feed" | "diaper" | "temperature" | "sleep" | "bath" | "growth" | "note";
export type BabyEvent = {
  eventId?: string;
  babyId: string;
  type: BabyEventType;
  happenedAt: string;
  data: Record<string, string | number>;
  createdBy?: string;
};
export type BabyDay = {
  events: BabyEvent[];
  summary: { feeds: number; milkMl: number; wet: number; stool: number; sleepMinutes: number; baths: number; temperatures: number[] };
};
export type BabyMonthDay = { date: string; count: number; eventTypes: BabyEventType[]; summary: BabyDay["summary"] };
export type BabyMonth = { month: string; days: BabyMonthDay[] };
