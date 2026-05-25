import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type { Category1, Category2, SalaryCategory } from "../api/types";

export function useMasterData(scopeKey = "") {
  const [category1, setCategory1] = useState<Category1[]>([]);
  const [category2, setCategory2] = useState<Category2[]>([]);
  const [salaryCategories, setSalaryCategories] = useState<SalaryCategory[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!scopeKey) {
      setCategory1([]);
      setCategory2([]);
      setSalaryCategories([]);
      return;
    }

    setLoading(true);
    try {
      const [cat1, cat2, salaries] = await Promise.all([
        api.master.category1(),
        api.master.category2(),
        api.master.salaryCategories()
      ]);
      setCategory1(uniqueBy(cat1 || [], row => row.CATEGORY1_NAME));
      setCategory2(uniqueBy(cat2 || [], row => `${row.CATEGORY1_NAME}_${row.CATEGORY2_NAME}`));
      setSalaryCategories(uniqueBy(salaries || [], row => row.SAL_CAT));
    } finally {
      setLoading(false);
    }
  }, [scopeKey]);

  useEffect(() => {
    refresh().catch(console.error);
  }, [refresh]);

  return { category1, category2, salaryCategories, loading, refresh };
}

function uniqueBy<T>(rows: T[], getKey: (row: T) => string): T[] {
  return Array.from(new Map(rows.map(row => [getKey(row), row])).values());
}
