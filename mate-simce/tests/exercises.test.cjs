const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const { runInNewContext } = require("node:vm");
const ts = require("typescript");

// Production modules with isolated adapters; no Supabase connection or real accounts.
function load(file, mocks = {}, globals = {}) {
  const { outputText } = ts.transpileModule(readFileSync(join(__dirname, "..", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  const testModule = { exports: {} };
  const execute = runInNewContext(`(function(require, module, exports) { ${outputText}\n })`, { URL, ...globals });
  execute((name) => {
    if (name === "server-only") return {};
    if (Object.hasOwn(mocks, name)) return mocks[name];
    throw new Error(`Unexpected dependency: ${name}`);
  }, testModule, testModule.exports);
  return testModule.exports;
}

const courseId = "11111111-1111-4111-8111-111111111111";
const topicId = "22222222-2222-4222-8222-222222222222";
const exerciseId = "33333333-3333-4333-8333-333333333333";
const course = { id: courseId, nombre: "Curso de prueba", nivel: "2_medio", descripcion: "Contenido de prueba", activo: true };
const topic = { id: topicId, curso_id: courseId, nombre: "Tema de prueba", categoria: "numeros", descripcion: "Potencias", orden: 1, activo: true, curso: course };
const exercise = {
  id: exerciseId, tema_id: topicId, titulo: "Ejercicio simulado", enunciado: "Calcula $2^3$.",
  instrucciones: "Lee las alternativas.", tipo_respuesta: "opcion_multiple", opciones: ["$6$", "$8$"],
  dificultad: "media", nivel_desafio: "inicial", tiempo_estimado_segundos: 90, imagen_url: null,
  publicado: true, tema: topic,
};

function fixture(options = {}) {
  const calls = [];
  const tables = { cursos: [course], temas: [topic], ejercicios: [exercise], ...options.tables };
  const supabase = {
    from(table) {
      calls.push({ operation: "from", table });
      const filters = [];
      const orders = [];
      let range;
      let limit;
      let single = false;
      const builder = {
        select(columns) { calls.push({ operation: "select", columns }); return builder; },
        eq(column, value) { filters.push([column, value]); return builder; },
        order(column) { orders.push(column); return builder; },
        range(first, last) { range = [first, last]; return builder; },
        limit(value) { limit = value; return builder; },
        maybeSingle() { single = true; return builder; },
        then(resolve, reject) {
          if (options.throws) return Promise.reject(new Error("private SQL details")).then(resolve, reject);
          calls.push({ operation: "execute", table, filters, range, limit });
          const path = (item, column) => column.split(".").reduce((value, key) => value?.[key], item);
          let result = tables[table].filter((item) => filters.every(([column, value]) => path(item, column) === value));
          result = [...result].sort((a, b) => {
            for (const column of orders) {
              const difference = String(a[column]).localeCompare(String(b[column]));
              if (difference) return difference;
            }
            return 0;
          });
          if (range) result = result.slice(range[0], range[1] + 1);
          if (limit !== undefined) result = result.slice(0, limit);
          return Promise.resolve({ data: single ? result[0] ?? null : result, error: options.error ?? null }).then(resolve, reject);
        },
      };
      return builder;
    },
  };
  const queries = load("lib/exercises/queries.ts", {
    "@/lib/auth/student": { async getStudentAccess() { return { status: options.access ?? "authorized" }; } },
    "@/lib/supabase/server": { async createClient() { return supabase; } },
  }, { process: { env: { NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" } } });
  return { queries, calls };
}

test("the server resolves only the unique active 2_medio course before reading topics", async () => {
  const { queries, calls } = fixture({ tables: { cursos: [
    { ...course, id: "other-level", nivel: "3_medio" },
    { ...course, id: "inactive", activo: false }, course,
  ] } });
  const result = await queries.listTopics();
  assert.equal(result.status, "ok");
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].id, topicId);
  const resolution = calls.find((call) => call.operation === "execute" && call.table === "cursos");
  assert.deepEqual(resolution.filters, [["activo", true], ["nivel", "2_medio"]]);
  assert.equal(resolution.limit, 2);
  assert.deepEqual(Object.keys(result.data[0]).sort(), ["category", "description", "id", "name"]);
  assert.ok(calls.some((call) => call.columns === "id"));
});

test("topics must be active and belong to the server-resolved 2_medio course", async () => {
  const { queries } = fixture({ tables: { temas: [topic,
    { ...topic, id: "inactive", activo: false },
    { ...topic, id: "other-course", curso_id: "other" },
    { ...topic, id: "inactive-course", curso: { ...course, activo: false } },
  ] } });
  const result = await queries.listTopics();
  assert.equal(result.status, "ok");
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].id, topicId);
});

for (const [name, courses, status] of [
  ["no course", [], "course_unavailable"],
  ["only inactive 2_medio", [{ ...course, activo: false }], "course_unavailable"],
  ["only another level", [{ ...course, nivel: "3_medio" }], "course_unavailable"],
  ["multiple active 2_medio courses", [course, { ...course, id: "another-course", nombre: "Another name" }], "course_ambiguous"],
]) {
  test(`${name} fails clearly without picking a course or reading its content`, async () => {
    const { queries, calls } = fixture({ tables: { cursos: courses } });
    for (const action of [() => queries.listTopics(), () => queries.listExercises(topicId), () => queries.getExercise(exerciseId)]) {
      assert.equal((await action()).status, status);
    }
    assert.ok(calls.filter((call) => call.table).every((call) => call.table === "cursos"));
  });
}

test("course resolution works with a different installation UUID and ignores client course arguments", async () => {
  const otherId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const otherCourse = { ...course, id: otherId };
  const { queries, calls } = fixture({ tables: {
    cursos: [otherCourse], temas: [{ ...topic, curso_id: otherId, curso: otherCourse }],
  } });
  const { getTopicsAction } = load("app/exercises-actions.ts", {
    "node:crypto": { randomUUID: () => "55555555-5555-4555-8555-555555555555" },
    "@/lib/exercises/queries": queries,
    "@/lib/exercises/progress": { getPracticeDiagnosis() { throw new Error("Unexpected diagnosis request"); } },
    "@/lib/exercises/correction": { checkExerciseAnswer() { throw new Error("Unexpected correction request"); } },
    "@/lib/exercises/tutor": { getTutorFeedback() { throw new Error("Unexpected tutor request"); } },
  });
  const result = await getTopicsAction(courseId);
  assert.equal(result.status, "ok");
  assert.equal(result.data[0].id, topicId);
  assert.ok(calls.some((call) => call.table === "temas" && call.filters?.some(([column, value]) => column === "curso_id" && value === otherId)));
});

test("manually submitted topic and exercise IDs from another level cannot expose content", async () => {
  const otherCourse = { ...course, id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", nivel: "3_medio" };
  const otherTopic = { ...topic, id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", curso_id: otherCourse.id, curso: otherCourse };
  const otherExercise = { ...exercise, id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", tema_id: otherTopic.id, tema: otherTopic };
  const { queries } = fixture({ tables: {
    cursos: [otherCourse, course], temas: [otherTopic, topic], ejercicios: [otherExercise, exercise],
  } });
  const topics = await queries.listTopics();
  assert.equal(topics.data.length, 1);
  assert.equal(topics.data[0].id, topicId);
  assert.equal((await queries.listExercises(otherTopic.id)).data.exercises.length, 0);
  assert.equal((await queries.getExercise(otherExercise.id)).status, "not_found");
});

test("listing excludes unpublished exercises and inactive or unrelated ancestors", async () => {
  const { queries } = fixture({ tables: { ejercicios: [exercise,
    { ...exercise, id: "draft", publicado: false },
    { ...exercise, id: "other-topic", tema_id: "other" },
    { ...exercise, id: "inactive-topic", tema: { ...topic, activo: false } },
    { ...exercise, id: "inactive-course", tema: { ...topic, curso: { ...course, activo: false } } },
  ] } });
  const result = await queries.listExercises(topicId);
  assert.equal(result.status, "ok");
  assert.equal(result.data.exercises.length, 1);
  assert.equal(result.data.exercises[0].id, exerciseId);
});

for (const access of ["unauthenticated", "forbidden", "unavailable"]) {
  test(`content requests with ${access} access never query educational tables`, async () => {
    const { queries, calls } = fixture({ access });
    for (const action of [() => queries.listTopics(),
      () => queries.listExercises(topicId), () => queries.getExercise(exerciseId)]) {
      assert.equal((await action()).status, access);
    }
    assert.equal(calls.length, 0);
  });
}

test("invalid identifiers and page numbers never reach Supabase", async () => {
  const { queries, calls } = fixture();
  for (const action of [() => queries.getExercise(null),
    () => queries.listExercises(topicId, -1), () => queries.listExercises(topicId, 1.5),
    () => queries.listExercises(topicId, 1001), () => queries.listExercises("id,publicado.eq.false")]) {
    assert.equal((await action()).status, "invalid");
  }
  assert.equal(calls.length, 0);
});

test("detail reads only published exercises with active ancestors", async () => {
  for (const item of [{ ...exercise, publicado: false },
    { ...exercise, tema: { ...topic, activo: false } },
    { ...exercise, tema: { ...topic, curso: { ...course, activo: false } } }]) {
    const { queries } = fixture({ tables: { ejercicios: [item] } });
    assert.equal((await queries.getExercise(exerciseId)).status, "not_found");
  }
});

test("missing exercises return a safe not-found result", async () => {
  const { queries } = fixture({ tables: { ejercicios: [] } });
  assert.equal((await queries.getExercise(exerciseId)).status, "not_found");
});

test("detail contains educational fields and text alternatives, never solution fields", async () => {
  const { queries, calls } = fixture({ tables: { ejercicios: [{ ...exercise,
    respuesta_correcta: "SOLUTION_SECRET", desarrollo_paso_a_paso: "SOLUTION_SECRET",
    soluciones_ejercicios: { respuesta_correcta: "SOLUTION_SECRET" },
  }] } });
  const result = await queries.getExercise(exerciseId);
  assert.equal(result.status, "ok");
  assert.equal(result.data.statement, exercise.enunciado);
  assert.equal(result.data.choices.join(","), "$6$,$8$");
  assert.doesNotMatch(JSON.stringify(result), /SOLUTION_SECRET|respuesta_correcta|desarrollo_paso_a_paso|soluciones_ejercicios/);
  assert.ok(calls.filter((call) => call.columns).every((call) => !call.columns.includes("*") && !call.columns.includes("soluciones")));
  assert.ok(calls.filter((call) => call.table).every((call) => call.table === "cursos" || call.table === "ejercicios"));
});

test("unverified option objects are not serialized, including correctness flags", async () => {
  const { queries } = fixture({ tables: { ejercicios: [{ ...exercise, opciones: [{ texto: "UNVERIFIED_OPTION_TEXT", correcta: "OPTION_SECRET" }] }] } });
  const result = await queries.getExercise(exerciseId);
  assert.equal(result.status, "ok");
  assert.equal(result.data.choices, null);
  assert.doesNotMatch(JSON.stringify(result), /OPTION_SECRET|correcta|UNVERIFIED_OPTION_TEXT/);
});

test("image URLs are limited to HTTPS public storage in this Supabase project", async () => {
  for (const [url, expected] of [
    ["https://example.supabase.co/storage/v1/object/public/exercises/figure.png", true],
    ["https://other.example.test/figure.png", false],
    ["http://example.supabase.co/storage/v1/object/public/exercises/figure.png", false],
    ["https://example.supabase.co/storage/v1/object/sign/exercises/figure.png", false],
    ["javascript:alert(1)", false],
  ]) {
    const { queries } = fixture({ tables: { ejercicios: [{ ...exercise, imagen_url: url }] } });
    const result = await queries.getExercise(exerciseId);
    assert.equal(result.status, "ok");
    assert.equal(Boolean(result.data.imageUrl), expected);
    assert.equal(result.data.imageUnavailable, !expected);
  }
});

test("pagination is bounded, deterministic, and detects a following page", async () => {
  const items = Array.from({ length: 13 }, (_, i) => ({ ...exercise, id: `item-${i}`, titulo: `Exercise ${String(i).padStart(2, "0")}` }));
  const { queries } = fixture({ tables: { ejercicios: items } });
  const first = await queries.listExercises(topicId, 1);
  const second = await queries.listExercises(topicId, 2);
  assert.equal(first.data.exercises.length, 12);
  assert.equal(first.data.hasNext, true);
  assert.equal(second.data.exercises.length, 1);
  assert.equal(second.data.hasNext, false);
  assert.notEqual(first.data.exercises[0].id, second.data.exercises[0].id);
});

test("no active topics and no published exercises are successful empty results", async () => {
  const { queries } = fixture({ tables: { temas: [], ejercicios: [{ ...exercise, publicado: false }] } });
  assert.equal((await queries.listTopics()).data.length, 0);
  assert.equal((await queries.listExercises(topicId)).data.exercises.length, 0);
});

for (const options of [{ error: { message: "private SQL details" } }, { throws: true }]) {
  test(`Supabase failure stays generic: ${JSON.stringify(options)}`, async () => {
    const result = await fixture(options).queries.listTopics();
    assert.equal(result.status, "error");
    assert.deepEqual(Object.keys(result), ["status"]);
  });
}

// Minimal React adapters exercise the component's callbacks and states in memory.
// These checks are not browser tests or remote RLS verification.
function ui(actions) {
  const hooks = [];
  let cursor = 0;
  let firstRender = true;
  const effects = [];
  const { ExerciseBrowser } = load("components/exercises/exercise-browser.tsx", {
    react: {
      startTransition(action) { return action(); },
      useState(initial) {
        const index = cursor++;
        if (!(index in hooks)) hooks[index] = initial;
        return [hooks[index], (value) => { hooks[index] = typeof value === "function" ? value(hooks[index]) : value; }];
      },
      useRef(value) { const index = cursor++; return hooks[index] ??= { current: value }; },
      useEffect(effect) { if (firstRender) effects.push(effect); },
    },
    "react/jsx-runtime": { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    "next/image": { default: "img" },
    "lucide-react": {},
    katex: { default: { renderToString: (_text, options) => {
      assert.equal(options.trust, false);
      return '<span class="katex">rendered math</span>';
    } } },
    "katex/dist/katex.min.css": {},
    "@/app/exercises-actions": { getPracticeDiagnosisAction: async () => ({ status: "ok", data: [] }), ...actions },
    "@/components/ui/button": { Button: "button" },
  });
  function render() {
    cursor = 0;
    const tree = ExerciseBrowser();
    if (firstRender) { firstRender = false; effects.forEach((effect) => effect()); }
    return tree;
  }
  return { render };
}

function nodes(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (typeof node.type === "function") return nodes(node.type(node.props));
  return [node, ...nodes(node.props?.children)];
}

function content(node) {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (Array.isArray(node)) return node.map(content).join("");
  if (typeof node !== "object") return String(node);
  if (typeof node.type === "function") return content(node.type(node.props));
  return content(node.props?.children);
}

function actions(queries) {
  return { getTopicsAction: queries.listTopics,
    getExercisesAction: queries.listExercises, async getExerciseAction(id) {
      const result = await queries.getExercise(id);
      return result.status === "ok" ? { status: "ok", data: { ...result.data, attemptId: "55555555-5555-4555-8555-555555555555" } } : result;
    } };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));

test("simulated practice UI requires a selection, waits for the server and clears feedback on return", async () => {
  let finish;
  const submitted = [];
  const queries = fixture({ tables: { ejercicios: [{ ...exercise, opciones: ["6", "8", "9", "16"] }] } }).queries;
  const app = ui({ ...actions(queries), checkExerciseAnswerAction(id, index, attemptId) {
    submitted.push([id, index, attemptId]);
    return new Promise((resolve) => { finish = resolve; });
  } });
  app.render(); await flush();
  await nodes(app.render()).find((n) => n.type === "button" && content(n).includes("Tema de prueba")).props.onClick();
  await nodes(app.render()).find((n) => n.type === "button" && content(n) === "Ver ejercicio").props.onClick();
  const check = () => nodes(app.render()).find((n) => n.props["data-cy"] === "exercise-check");
  await check().props.onClick();
  assert.match(content(app.render()), /Selecciona una alternativa antes/);
  assert.equal(submitted.length, 0);
  nodes(app.render()).filter((n) => n.type === "input")[1].props.onChange();
  const pending = check().props.onClick();
  assert.equal(check().props.disabled, true);
  assert.match(content(app.render()), /Comprobando/);
  assert.deepEqual(submitted, [[exerciseId, 1, "55555555-5555-4555-8555-555555555555"]]);
  finish({ status: "ok", data: { exerciseId, selectedIndex: 1, correct: true, explanation: "$2^3=8$." } });
  await pending;
  assert.match(content(app.render()), /Respuesta correcta/);
  assert.ok(nodes(app.render()).some((n) => n.props["data-cy"] === "exercise-feedback"));
  nodes(app.render()).find((n) => n.type === "button" && content(n).includes("Volver al listado")).props.onClick();
  assert.doesNotMatch(content(app.render()), /Respuesta correcta|Respuesta comprobada/);
});

test("simulated practice UI releases the button on failure and renders incorrect-answer feedback", async () => {
  let fail = true;
  const queries = fixture({ tables: { ejercicios: [{ ...exercise, opciones: ["6", "8", "9", "16"] }] } }).queries;
  const app = ui({ ...actions(queries), async checkExerciseAnswerAction() {
    if (fail) throw new Error("PRIVATE NETWORK");
    return { status: "ok", data: { exerciseId, selectedIndex: 0, correct: false, explanation: "$2^3=8$." } };
  } });
  app.render(); await flush();
  await nodes(app.render()).find((n) => n.type === "button" && content(n).includes("Tema de prueba")).props.onClick();
  await nodes(app.render()).find((n) => n.type === "button" && content(n) === "Ver ejercicio").props.onClick();
  nodes(app.render()).find((n) => n.type === "input").props.onChange();
  const check = () => nodes(app.render()).find((n) => n.props["data-cy"] === "exercise-check");
  await check().props.onClick();
  assert.equal(check().props.disabled, false);
  assert.match(content(app.render()), /No pudimos conectar/);
  assert.doesNotMatch(content(app.render()), /PRIVATE NETWORK/);
  fail = false;
  await check().props.onClick();
  assert.match(content(app.render()), /Respuesta incorrecta/);
});

test("simulated tutor unlocks after grading, caches each help type and handles failures without duplicate requests", async () => {
  const attemptId = "55555555-5555-4555-8555-555555555555";
  const queries = fixture({ tables: { ejercicios: [{ ...exercise, opciones: ["6", "8", "9", "16"] }] } }).queries;
  const calls = [];
  let resolve;
  let reject;
  const app = ui({ ...actions(queries), async checkExerciseAnswerAction() {
    return { status: "ok", data: { attemptId, exerciseId, selectedIndex: 0, correct: false, explanation: "Verified procedure" } };
  }, getTutorFeedbackAction(id, kind) {
    calls.push([id, kind]);
    return new Promise((yes, no) => { resolve = yes; reject = no; });
  } });
  const button = (id) => nodes(app.render()).find((n) => n.props["data-cy"] === id);
  app.render(); await flush();
  await nodes(app.render()).find((n) => n.type === "button" && content(n).includes("Tema de prueba")).props.onClick();
  await nodes(app.render()).find((n) => n.type === "button" && content(n) === "Ver ejercicio").props.onClick();
  assert.equal(button("exercise-tutor"), undefined);
  nodes(app.render()).find((n) => n.type === "input").props.onChange();
  await button("exercise-check").props.onClick();
  assert.ok(button("exercise-tutor"));
  const hintClick = button("tutor-hint").props.onClick;
  const hint = hintClick(); await hintClick();
  assert.deepEqual(calls, [[attemptId, "hint"]]);
  assert.equal(button("tutor-hint").props.disabled, true);
  resolve({ status: "ok", data: { attemptId, exerciseId, kind: "hint", title: "Hint", text: "Orientación $2^3$" } }); await hint;
  assert.ok(nodes(button("tutor-response")).some((n) => n.props.dangerouslySetInnerHTML?.__html.includes('class="katex"')));
  await button("tutor-hint").props.onClick();
  assert.equal(calls.length, 1);
  const error = button("tutor-error").props.onClick();
  reject(new Error("PRIVATE NETWORK")); await error;
  assert.match(content(app.render()), /No pudimos cargar la ayuda/);
  assert.doesNotMatch(content(app.render()), /PRIVATE NETWORK/);
  assert.equal(button("tutor-error").props.disabled, false);
  const errorRetry = button("tutor-error").props.onClick();
  resolve({ status: "ok", data: { attemptId, exerciseId, kind: "error", title: "Revisión", text: "Sin atribuir una causa no observada." } }); await errorRetry;
  const procedure = button("tutor-procedure").props.onClick();
  resolve({ status: "ok", data: { attemptId, exerciseId, kind: "procedure", title: "Procedimiento", text: "$2^3=8$" } }); await procedure;
  assert.match(content(button("tutor-response")), /Procedimiento/);
  assert.equal(calls.length, 4);
});

test("simulated retry keeps the exercise, renews its attempt and ignores a late preceding response", async () => {
  const queries = fixture({ tables: { ejercicios: [{ ...exercise, opciones: ["6", "8", "9", "16"] }] } }).queries;
  const base = actions(queries);
  const attemptIds = ["55555555-5555-4555-8555-555555555555", "66666666-6666-4666-8666-666666666666"];
  const opened = [];
  const submitted = [];
  const finish = [];
  let finishTutor;
  const app = ui({ ...base, async getExerciseAction(id) {
    const result = await base.getExerciseAction(id);
    opened.push(id);
    return { ...result, data: { ...result.data, attemptId: attemptIds[opened.length - 1] } };
  }, checkExerciseAnswerAction(id, index, attemptId) {
    submitted.push([id, index, attemptId]);
    return new Promise((resolve) => finish.push(resolve));
  }, getTutorFeedbackAction() {
    return new Promise((resolve) => { finishTutor = resolve; });
  } });
  app.render(); await flush();
  await nodes(app.render()).find((n) => n.type === "button" && content(n).includes("Tema de prueba")).props.onClick();
  await nodes(app.render()).find((n) => n.type === "button" && content(n) === "Ver ejercicio").props.onClick();
  const button = (name) => nodes(app.render()).find((n) => n.props["data-cy"] === name);
  assert.equal(button("exercise-retry"), undefined);
  nodes(app.render()).find((n) => n.type === "input").props.onChange();
  // Simulate two sends of the same opening before React has committed its pending state.
  const send = button("exercise-check").props.onClick;
  const late = send();
  const first = send();
  const feedback = (attemptId, selectedIndex) => ({ status: "ok", data: {
    exerciseId, attemptId, selectedIndex, correct: true, explanation: "PREVIOUS EXPLANATION",
  } });
  finish[1](feedback(attemptIds[0], 0)); await first;
  assert.ok(button("exercise-retry"));
  const lateTutor = button("tutor-hint").props.onClick();
  const retry = button("exercise-retry").props.onClick();
  assert.match(content(app.render()), /Cargando contenido/);
  await retry;
  finish[0](feedback(attemptIds[0], 0)); await late;
  finishTutor({ status: "ok", data: { attemptId: attemptIds[0], exerciseId, kind: "hint", title: "LATE_TUTOR", text: "LATE_TUTOR" } }); await lateTutor;
  assert.deepEqual(opened, [exerciseId, exerciseId]);
  assert.equal(nodes(app.render()).find((n) => n.props.id === "exercise-detail-title") !== undefined, true);
  assert.equal(button("exercise-feedback"), undefined);
  assert.equal(button("exercise-retry"), undefined);
  assert.doesNotMatch(content(app.render()), /PREVIOUS EXPLANATION/);
  assert.doesNotMatch(content(app.render()), /LATE_TUTOR/);
  assert.equal(button("exercise-tutor"), undefined);
  assert.ok(nodes(app.render()).filter((n) => n.type === "input").every((n) => !n.props.checked));
  nodes(app.render()).filter((n) => n.type === "input")[1].props.onChange();
  const second = button("exercise-check").props.onClick();
  assert.deepEqual(submitted, [[exerciseId, 0, attemptIds[0]], [exerciseId, 0, attemptIds[0]], [exerciseId, 1, attemptIds[1]]]);
  finish[2](feedback(attemptIds[1], 1)); await second;
  assert.ok(button("exercise-feedback"));
  nodes(app.render()).find((n) => n.type === "button" && content(n).includes("Volver al listado")).props.onClick();
  assert.equal(button("exercise-feedback"), undefined);
  assert.ok(nodes(app.render()).some((n) => n.props["aria-labelledby"] === "exercise-list-title"));
});

test("simulated UI loads topics automatically without a course selector and opens a read-only detail", async () => {
  const app = ui(actions(fixture().queries));
  assert.match(content(app.render()), /Cargando contenido/);
  await flush();
  assert.equal(nodes(app.render()).filter((node) => node.type === "select").length, 0);
  assert.doesNotMatch(content(app.render()), /Selecciona un curso|Selecciona contenidos/);
  assert.match(content(app.render()), /Contenidos de 2.º medio/);
  const topicButton = nodes(app.render()).find((node) => node.type === "button" && content(node).includes("Tema de prueba"));
  await topicButton.props.onClick();
  assert.equal(nodes(app.render()).find((node) => node.type === "button" && content(node).includes("Tema de prueba")).props["aria-pressed"], true);
  assert.match(content(app.render()), /Ejercicio simulado/);
  const open = nodes(app.render()).find((node) => node.type === "button" && content(node) === "Ver ejercicio");
  await open.props.onClick();
  const tree = app.render();
  assert.ok(nodes(tree).some((node) => node.type === "article"));
  assert.match(content(tree), /Lee las alternativas/);
  assert.match(content(tree), /Vista de consulta/);
  assert.equal(nodes(tree).filter((node) => node.type === "input" || node.type === "textarea").length, 0);
  assert.ok(nodes(tree).some((node) => node.props.dangerouslySetInnerHTML?.__html.includes('class="katex"')));
  nodes(tree).find((node) => node.type === "button" && content(node).includes("Volver al listado")).props.onClick();
  assert.equal(nodes(app.render()).filter((node) => node.type === "article").length, 0);
  assert.match(content(app.render()), /Ver ejercicio/);
});

test("simulated UI clearly reports a topic without published exercises", async () => {
  const app = ui(actions(fixture({ tables: { ejercicios: [] } }).queries));
  app.render(); await flush();
  await nodes(app.render()).find((node) => node.type === "button" && content(node).includes("Tema de prueba")).props.onClick();
  assert.match(content(app.render()), /Todavía no hay ejercicios publicados para este tema/);
});

test("simulated UI distinguishes unavailable 2_medio contents from an empty topic list", async () => {
  const empty = ui(actions(fixture({ tables: { cursos: [] } }).queries));
  empty.render(); await flush();
  assert.match(content(empty.render()), /Los contenidos de Matemática de 2.º medio aún no están disponibles/);
  const noTopics = ui(actions(fixture({ tables: { temas: [] } }).queries));
  noTopics.render(); await flush();
  assert.match(content(noTopics.render()), /Todavía no hay temas disponibles para 2.º medio/);
});

test("simulated UI reports ambiguous course configuration without displaying topics", async () => {
  const app = ui(actions(fixture({ tables: { cursos: [course, { ...course, id: "duplicate-course" }] } }).queries));
  app.render(); await flush();
  assert.match(content(app.render()), /La configuración requiere revisión/);
  assert.doesNotMatch(content(app.render()), /Tema de prueba/);
  assert.equal(nodes(app.render()).filter((node) => node.type === "select").length, 0);
});

test("simulated UI reports expired sessions and hides content selection", async () => {
  const app = ui(actions(fixture({ access: "unauthenticated" }).queries));
  app.render(); await flush();
  const tree = app.render();
  assert.match(content(tree), /Tu sesión ya no está disponible/);
  assert.equal(nodes(tree).filter((node) => node.type === "select").length, 0);
  assert.ok(nodes(tree).some((node) => node.type === "a" && node.props.href === "/login"));
});

test("simulated UI handles a failed request with a retry and no provider details", async () => {
  const app = ui(actions(fixture({ error: { message: "private SQL details" } }).queries));
  app.render(); await flush();
  assert.match(content(app.render()), /No pudimos cargar el contenido/);
  assert.doesNotMatch(content(app.render()), /private SQL/);
  assert.ok(nodes(app.render()).some((node) => node.type === "button" && content(node) === "Reintentar"));
});
