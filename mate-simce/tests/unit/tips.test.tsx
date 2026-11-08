import { afterEach, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { AcademicTips } from "@/components/academic-tips";
import { academicTips, loadTipSession, saveTipSession, TIP_SESSION_KEY } from "@/lib/academic-tips";
afterEach(() => vi.restoreAllMocks());

function storage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}
it("contiene 20 consejos únicos, cinco por cada eje", () => {
  expect(academicTips).toHaveLength(20);
  expect(new Set(academicTips.map((tip) => tip.text)).size).toBe(20);
  const counts = academicTips.reduce<Record<string, number>>((result, tip) => { result[tip.axis] = (result[tip.axis] ?? 0) + 1; return result; }, {});
  expect(Object.values(counts)).toEqual([5, 5, 5, 5]);
});
it("mezcla una vez por sesión y conserva orden y posición en recargas", () => {
  const store = storage(), random = vi.fn(() => 0.3);
  const first = loadTipSession(store, random);
  expect(new Set(first.order).size).toBe(20);
  expect(random).toHaveBeenCalledTimes(19);
  saveTipSession({ ...first, position: 7 }, store);
  expect(loadTipSession(store, random)).toEqual({ ...first, position: 7 });
  expect(random).toHaveBeenCalledTimes(19);
  store.removeItem(TIP_SESSION_KEY);
  expect(loadTipSession(store, () => 0.8).order).not.toEqual(first.order);
});
it("reconstruye datos corruptos y funciona cuando sessionStorage está bloqueado", () => {
  const store = storage(); store.setItem(TIP_SESSION_KEY, JSON.stringify({ order: Array(20).fill(0), position: 99 }));
  expect(new Set(loadTipSession(store).order).size).toBe(20);
  const denied = { getItem() { throw new Error("Blocked"); }, setItem() { throw new Error("Blocked"); } };
  expect(loadTipSession(denied).order).toHaveLength(20);
});
it("SSR genera contenido estable sin mezclar ni consultar almacenamiento del navegador", () => {
  const random = vi.spyOn(Math, "random");
  const first = renderToString(<AcademicTips />);
  expect(renderToString(<AcademicTips />)).toBe(first);
  expect(first.replace(/<!--.*?-->/g, "")).toContain("1 / 20");
  expect(random).not.toHaveBeenCalled();
});
