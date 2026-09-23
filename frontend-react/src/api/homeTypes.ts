export type Ingredient = { name: string; quantity: number; unit: string };
export type Recipe = {
  recipeId?: string;
  name: string;
  baseServings: number;
  ingredients: Ingredient[];
  steps: string[];
  videoUrl: string;
  notes: string;
  updatedAt?: string;
};
export type PlanItem = { recipeId: string; count: number; people: number };
export type ShoppingRow = Ingredient & { key: string };
export type ShoppingPlan = { items: PlanItem[]; checked: string[]; shoppingList: ShoppingRow[] };

export type FamilyMember = { userId: string; role: "owner" | "member"; name: string };
export type Family = { familyId: string; name: string; ownerUserId: string; members: FamilyMember[] };
export type Baby = { babyId?: string; familyId: string; name: string; birthDate: string; notes: string };
export type BabyEventType = "feed" | "diaper" | "temperature" | "sleep" | "growth" | "note";
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
  summary: { feeds: number; milkMl: number; wet: number; stool: number; sleepMinutes: number; temperatures: number[] };
};
