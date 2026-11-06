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
const hasCredentials = Boolean(process.env.MATESIMCE_TEST_EMAIL && process.env.MATESIMCE_TEST_PASSWORD);

beforeAll(async () => {
  const email = process.env.MATESIMCE_TEST_EMAIL;
  const password = process.env.MATESIMCE_TEST_PASSWORD;
  if (!email && !password) {
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

it("I0 HTTP sin sesión: rechaza las cuatro rutas y la página inválida sin consultar contenido", async () => {
  await denied("/api/cursos/actual");
  await denied("/api/temas");
  await denied(`/api/ejercicios?temaId=${missingId}&page=1`);
  await denied(`/api/ejercicios/${missingId}`);
  await http.get(`/api/ejercicios?temaId=${missingId}&page=0`).expect(400).expect({ status: "invalid" });
});

it.skipIf(!hasCredentials)("I1 GET /api/cursos/actual: acceso y curso único de II medio", async () => {
  const body = await authorized("/api/cursos/actual");
  expect(body.status).toBe("ok");
  expect(body.data).toEqual({ id: expect.any(String), name: expect.any(String), level: "2_medio", description: expect.any(String) });
});

it.skipIf(!hasCredentials)("I2 GET /api/temas: acceso y temas disponibles del curso", async () => {
  const body = await authorized("/api/temas");
  expect(body.status).toBe("ok");
  expect(Array.isArray(body.data)).toBe(true);
  expect(body.data.length).toBeGreaterThanOrEqual(4);
  for (const topic of body.data) {
    expect(topic).toEqual({ id: expect.any(String), name: expect.any(String), category: expect.any(String), description: expect.any(String) });
    expect(["numeros", "algebra_y_funciones", "geometria", "estadistica_y_probabilidades"]).toContain(topic.category);
  }
});

it.skipIf(!hasCredentials)("I3 GET /api/ejercicios: acceso, paginación y listado real sin soluciones", async () => {
  const topics = await authorized("/api/temas");
  const topic = topics.data.find((item: { id: string }) => !process.env.MATESIMCE_TEST_TOPIC_ID || item.id === process.env.MATESIMCE_TEST_TOPIC_ID);
  if (!topic) throw new Error("Se necesita un tema activo para comprobar el listado autenticado.");
  const body = await authorized(`/api/ejercicios?temaId=${topic.id}&page=1`);
  expect(body.status).toBe("ok");
  expect(body.data.page).toBe(1);
  expect(typeof body.data.hasNext).toBe("boolean");
  expect(Array.isArray(body.data.exercises)).toBe(true);
  expect(body.data.exercises.length).toBeGreaterThan(0);
  expect(body.data.exercises.length).toBeLessThanOrEqual(12);
  for (const exercise of body.data.exercises) {
    expect(exercise.id).toEqual(expect.any(String));
    expect(exercise.title).toEqual(expect.any(String));
    expect(exercise.topicName).toBe(topic.name);
  }
});

it.skipIf(!hasCredentials)("I4 GET /api/ejercicios/[id]: detalle publicado real sin soluciones y 404", async () => {
  expect(await authorized(`/api/ejercicios/${missingId}`, 404)).toEqual({ status: "not_found" });
  let id = process.env.MATESIMCE_TEST_EXERCISE_ID;
  if (!id) {
    const topics = await authorized("/api/temas");
    for (const topic of topics.data) {
      const listing = await authorized(`/api/ejercicios?temaId=${topic.id}&page=1`);
      id = listing.data.exercises[0]?.id;
      if (id) break;
    }
  }
  if (!id) throw new Error("Se necesita un ejercicio publicado para comprobar el detalle positivo.");
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
