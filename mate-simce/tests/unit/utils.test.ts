import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn: clases de los componentes", () => {
  it("combina clases que no entran en conflicto", () => {
    expect(cn("rounded-md", "px-4", "text-sm")).toBe(
      "rounded-md px-4 text-sm",
    );
  });

  it("incluye solo las clases condicionales activas", () => {
    expect(cn("border", { "opacity-50": true, "cursor-wait": false })).toBe(
      "border opacity-50",
    );
  });

  it("permite que las clases posteriores reemplacen utilidades en conflicto", () => {
    expect(cn("px-2 py-1", "px-6")).toBe("py-1 px-6");
  });

  it("conserva las variantes de foco al cambiar el fondo base", () => {
    expect(
      cn("bg-white focus:bg-slate-100", "bg-slate-50"),
    ).toBe("focus:bg-slate-100 bg-slate-50");
  });

  it("ignora valores ausentes y admite entradas vacías", () => {
    expect(cn(null, undefined, false, "", "block")).toBe("block");
    expect(cn()).toBe("");
  });
});
