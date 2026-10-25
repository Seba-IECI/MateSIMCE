import { afterAll, beforeAll, expect, it } from "vitest";
import request from "supertest";
import { loadEnvConfig } from "@next/env";
import { createServerClient } from "@supabase/ssr";

loadEnvConfig(process.cwd());
const baseURL = process.env.MATESIMCE_TEST_BASE_URL ?? "http://localhost:3100";
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(baseURL).hostname)) {
  throw new Error("Las integraciones solo admiten un servidor Next.js local.");
}
const http = request(baseURL);
const missingId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
let cookie = "";
let auth: ReturnType<typeof createServerClient> | undefined;

beforeAll(async () => {
  const email = process.env.MATESIMCE_TEST_EMAIL;
  const password = process.env.MATESIMCE_TEST_PASSWORD;
  if (!email && !password) {
    console.warn("SIN CREDENCIALES: I1–I4 verifican solo HTTP 401; las lecturas autenticadas NO se ejecutan.");
    return;
  }
  if (!email || !password) throw new Error("Falta una variable de la cuenta de prueba.");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || key.startsWith("sb_secret_")) throw new Error("Falta configuración pública de Supabase.");
  const jar = new Map<string, string>();
  auth = createServerClient(url, key, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (values) => { values.forEach(({ name, value }) => jar.set(name, value)); },
    },
  });
  const { error } = await auth.auth.signInWithPassword({ email, password });
  if (error) throw new Error("No se pudo autenticar la cuenta autorizada; no se muestran detalles ni credenciales.");
  cookie = [...jar].filter(([, value]) => value).map(([name, value]) => `${name}=${value}`).join("; ");
  if (!cookie) throw new Error("Auth no estableció cookies SSR.");
});

afterAll(async () => {
  if (auth) {
    const { error } = await auth.auth.signOut({ scope: "local" });
    cookie = "";
    if (error) throw new Error("No se pudo confirmar el cierre de la sesión de prueba.");
  }
});

async function denied(path: string) {
  const res = await http.get(path).expect(401).expect("Content-Type", /json/);
  expect(res.body).toEqual({ status: "unauthenticated" });
  expect(res.headers["cache-control"]).toContain("no-store");
  expect(res.headers["cache-control"]).toContain("private");
}

async function authorized(path: string, status = 200) {
  const res = await http.get(path).set("Cookie", cookie).expect(status).expect("Content-Type", /json/);
  expect(res.headers["cache-control"]).toContain("no-store");
  expect(JSON.stringify(res.body)).not.toMatch(/respuesta_correcta|indice_correcto|desarrollo_paso_a_paso|soluciones_ejercicios/);
  return res.body;
}

it("I1 GET /api/cursos/actual: acceso y curso único de II medio", async () => {
  await denied("/api/cursos/actual");
  if (!cookie) return;
  const body = await authorized("/api/cursos/actual");
  expect(body.status).toBe("ok");
  expect(body.data).toEqual({ id: expect.any(String), name: expect.any(String), level: "2_medio", description: expect.any(String) });
});

it("I2 GET /api/temas: acceso y temas disponibles del curso", async () => {
  await denied("/api/temas");
  if (!cookie) return;
  const body = await authorized("/api/temas");
  expect(body.status).toBe("ok");
  expect(Array.isArray(body.data)).toBe(true);
  for (const topic of body.data) {
    expect(topic).toEqual({ id: expect.any(String), name: expect.any(String), category: expect.any(String), description: expect.any(String) });
    expect(["numeros", "algebra_y_funciones", "geometria", "estadistica_y_probabilidades"]).toContain(topic.category);
  }
});

it("I3 GET /api/ejercicios: acceso, paginación y listado real sin soluciones", async () => {
  await denied(`/api/ejercicios?temaId=${missingId}&page=1`);
  await http.get(`/api/ejercicios?temaId=${missingId}&page=0`).expect(400).expect({ status: "invalid" });
  if (!cookie) return;
  const topics = await authorized("/api/temas");
  const topic = topics.data.find((item: { id: string }) => !process.env.MATESIMCE_TEST_TOPIC_ID || item.id === process.env.MATESIMCE_TEST_TOPIC_ID);
  if (!topic) throw new Error("Se necesita un tema activo para comprobar el listado autenticado.");
  const body = await authorized(`/api/ejercicios?temaId=${topic.id}&page=1`);
  expect(body.status).toBe("ok");
  expect(body.data.page).toBe(1);
  expect(typeof body.data.hasNext).toBe("boolean");
  expect(Array.isArray(body.data.exercises)).toBe(true);
  expect(body.data.exercises.length).toBeLessThanOrEqual(12);
  for (const exercise of body.data.exercises) {
    expect(exercise.id).toEqual(expect.any(String));
    expect(exercise.title).toEqual(expect.any(String));
    expect(exercise.topicName).toBe(topic.name);
  }
});

it("I4 GET /api/ejercicios/[id]: acceso y detalle real o 404 explícito", async () => {
  await denied(`/api/ejercicios/${missingId}`);
  if (!cookie) return;
  const id = process.env.MATESIMCE_TEST_EXERCISE_ID;
  if (!id) {
    expect(await authorized(`/api/ejercicios/${missingId}`, 404)).toEqual({ status: "not_found" });
    console.info("I4 autenticada: 404 comprobado; detalle positivo NO probado, falta ID publicado.");
    return;
  }
  const body = await authorized(`/api/ejercicios/${id}`);
  expect(body.status).toBe("ok");
  expect(body.data.id).toBe(id);
  expect(body.data.title).toEqual(expect.any(String));
  expect(body.data.statement).toEqual(expect.any(String));
  if (body.data.responseType === "opcion_multiple") {
    expect(Array.isArray(body.data.choices)).toBe(true);
    expect(body.data.choices.every((choice: unknown) => typeof choice === "string")).toBe(true);
  }
});
