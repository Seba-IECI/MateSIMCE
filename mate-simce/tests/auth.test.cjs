const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const { runInNewContext } = require("node:vm");
const ts = require("typescript");

// Exercise the production modules in memory with isolated Supabase/Next adapters.
// No test creates users, contacts Supabase, or reads real credentials.
function load(file, mocks = {}, globals = {}) {
  const source = readFileSync(join(__dirname, "..", file), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });
  const testModule = { exports: {} };
  const execute = runInNewContext(`(function(require, module, exports) { ${outputText}\n })`, {
    URL, FormData, Headers, ...globals,
  });
  execute((name) => {
    if (name === "server-only") return {};
    if (Object.hasOwn(mocks, name)) return mocks[name];
    throw new Error(`Unexpected dependency: ${name}`);
  }, testModule, testModule.exports);
  return testModule.exports;
}

const { getStudentAccess } = load("lib/auth/student.ts");

function client(options = {}) {
  const calls = [];
  const supabase = {
    auth: {
      async getUser() {
        calls.push(["getUser"]);
        if (options.authThrows) throw new Error("private network details");
        return {
          data: { user: options.noUser ? null : { id: "student-a" } },
          error: options.authError || null,
        };
      },
      async signInWithPassword(credentials) {
        calls.push(["signInWithPassword", credentials]);
        return { error: options.loginError || null };
      },
      async signOut(scope) {
        calls.push(["signOut", scope]);
        if (options.logoutThrows) throw new Error("private revoke details");
        return { error: options.logoutError || null };
      },
    },
    from(table) {
      calls.push(["from", table]);
      return {
        select(columns) {
          calls.push(["select", columns]);
          return {
            eq(column, value) {
              calls.push(["eq", column, value]);
              return {
                async maybeSingle() {
                  return {
                    data: options.noProfile ? null : {
                      id: options.profileId || "student-a",
                      nombre: "Alumno de prueba",
                      activo: options.active ?? true,
                    },
                    error: options.profileError || null,
                  };
                },
              };
            },
          };
        },
      };
    },
    async rpc(name, args) {
      calls.push(["rpc", name, args]);
      return { data: options.isStudent ?? true, error: options.roleError || null };
    },
  };
  return { supabase, calls };
}

test("verified active student is authorized using only their own profile", async () => {
  const { supabase, calls } = client();
  const access = await getStudentAccess(supabase);
  assert.equal(access.status, "authorized");
  assert.equal(access.student.id, "student-a");
  assert.deepEqual(calls.find(([name]) => name === "eq"), ["eq", "id", "student-a"]);
  const rpc = calls.find(([name]) => name === "rpc");
  assert.equal(rpc[1], "usuario_tiene_rol");
  assert.equal(rpc[2].roles_permitidos.join(","), "alumno");
  assert.deepEqual(Object.keys(access.student).sort(), ["id", "name"]);
});

test("a request without verified identity never reads a profile", async () => {
  const { supabase, calls } = client({ noUser: true });
  assert.equal((await getStudentAccess(supabase)).status, "unauthenticated");
  assert.deepEqual(calls, [["getUser"]]);
});

test("a subsequent request rechecks deactivation instead of reusing authorization", async () => {
  const options = { active: true };
  const { supabase } = client(options);
  assert.equal((await getStudentAccess(supabase)).status, "authorized");
  options.active = false;
  assert.equal((await getStudentAccess(supabase)).status, "forbidden");
});

for (const [name, options] of [
  ["invalid identity", { authError: { message: "forged token" } }],
  ["inactive student", { active: false }],
  ["missing profile", { noProfile: true }],
  ["another user's profile", { profileId: "student-b" }],
  ["teacher or inactive role", { isStudent: false }],
  ["non-boolean role result", { isStudent: "true" }],
]) {
  test(`${name} cannot enter the student page`, async () => {
    assert.notEqual((await getStudentAccess(client(options).supabase)).status, "authorized");
  });
}

for (const [name, options] of [
  ["profile RLS/permission failure", { profileError: { message: "private SQL" } }],
  ["role RPC failure", { roleError: { message: "private SQL" } }],
  ["network failure", { authThrows: true }],
]) {
  test(`${name} fails closed without returning provider details`, async () => {
    const result = await getStudentAccess(client(options).supabase);
    assert.equal(result.status, "unavailable");
    assert.deepEqual(Object.keys(result), ["status"]);
  });
}

function loginModule(options = {}) {
  const { supabase, calls } = client(options);
  let clears = 0;
  const { login } = load("app/login/actions.ts", {
    "@/lib/auth/student": { getStudentAccess },
    "@/lib/supabase/server": {
      async createClient(settings) {
        assert.equal(settings.writableCookies, true);
        return supabase;
      },
      async clearSessionCookies() { clears += 1; },
    },
  });
  return { login, calls, clears: () => clears };
}

function credentials(email = "student@example.test", password = " a valid password ") {
  const form = new FormData();
  form.set("email", email);
  form.set("password", password);
  return form;
}

test("login validates on the server before contacting Auth", async () => {
  const fixture = loginModule();
  const result = await fixture.login({}, credentials("not-an-email", ""));
  assert.equal(result.success, false);
  assert.ok(result.errors.email);
  assert.ok(result.errors.password);
  assert.deepEqual(fixture.calls, []);
});

test("successful login trims only email and never returns credentials", async () => {
  const fixture = loginModule();
  const result = await fixture.login({}, credentials(" student@example.test "));
  assert.equal(result.success, true);
  const sent = fixture.calls.find(([name]) => name === "signInWithPassword")[1];
  assert.equal(sent.email, "student@example.test");
  assert.equal(sent.password, " a valid password ");
  assert.deepEqual(Object.keys(result).sort(), ["message", "success"]);
});

test("login ignores roles submitted by the browser", async () => {
  const fixture = loginModule();
  const form = credentials();
  form.set("rol", "administrador");
  form.set("usuario_id", "student-b");
  assert.equal((await fixture.login({}, form)).success, true);
  const sent = fixture.calls.find(([name]) => name === "signInWithPassword")[1];
  assert.deepEqual(Object.keys(sent).sort(), ["email", "password"]);
});

test("incorrect credentials do not expose account or provider details", async () => {
  const fixture = loginModule({ loginError: { status: 400, message: "account does not exist" } });
  const result = await fixture.login({}, credentials());
  assert.equal(result.success, false);
  assert.doesNotMatch(result.message, /account|exist|SQL/);
});

test("rate limiting produces a safe retry message", async () => {
  const fixture = loginModule({ loginError: { status: 429 } });
  assert.match((await fixture.login({}, credentials())).message, /demasiados intentos/);
});

for (const options of [{ active: false }, { isStudent: false }, { noProfile: true }, { roleError: {} }]) {
  test(`login clears newly created cookies when access is denied: ${JSON.stringify(options)}`, async () => {
    const fixture = loginModule(options);
    assert.equal((await fixture.login({}, credentials())).success, false);
    assert.equal(fixture.clears(), 1);
    assert.ok(fixture.calls.some(([name, scope]) => name === "signOut" && scope.scope === "local"));
  });
}

function nextResponse() {
  return class NextResponse extends Response {
    static redirect(url, status = 307) {
      return new this(null, { status, headers: { Location: url.toString() } });
    }
    constructor(body, init) {
      super(body, init);
      const values = new Map();
      this.cookies = {
        getAll: () => [...values.values()],
        set(name, value, options) {
          const cookie = typeof name === "object" ? name : { name, value, ...options };
          values.set(cookie.name, cookie);
        },
      };
    }
    static next() {
      return new this();
    }
  };
}

test("logout rejects a cross-origin POST before touching the session", async () => {
  let calls = 0;
  const { POST } = load("app/auth/logout/route.ts", {
    "next/server": { NextResponse: nextResponse() },
    "@/lib/supabase/server": {
      async createClient() { calls += 1; },
      async clearSessionCookies() { calls += 1; },
    },
  });
  const response = await POST({
    headers: new Headers({ origin: "https://other.example.test", host: "matesimce.example.test" }),
    nextUrl: new URL("https://matesimce.example.test/auth/logout"),
  });
  assert.equal(response.status, 403);
  assert.equal(calls, 0);
});

for (const failure of [false, true]) {
  test(`logout removes local cookies and redirects even with revocation failure=${failure}`, async () => {
    const { supabase, calls } = client({ logoutThrows: failure });
    let cleared = false;
    const { POST } = load("app/auth/logout/route.ts", {
      "next/server": { NextResponse: nextResponse() },
      "@/lib/supabase/server": {
        async createClient() { return supabase; },
        async clearSessionCookies() { cleared = true; },
      },
    });
    const url = "https://matesimce.example.test/auth/logout";
    const response = await POST({
      url, nextUrl: new URL(url),
      headers: new Headers({ origin: "https://matesimce.example.test", host: "matesimce.example.test" }),
    });
    assert.equal(response.status, 303);
    assert.equal(cleared, true);
    assert.match(response.headers.get("location"), failure ? /salida-local/ : /sesion-cerrada/);
    assert.match(response.headers.get("cache-control"), /no-store/);
    assert.equal(calls[0][1].scope, "local");
  });
}

test("logout preserves the browser's loopback host despite NextURL normalization", async () => {
  const { supabase } = client();
  const { POST } = load("app/auth/logout/route.ts", {
    "next/server": { NextResponse: nextResponse() },
    "@/lib/supabase/server": {
      async createClient() { return supabase; },
      async clearSessionCookies() {},
    },
  });
  const { NextRequest } = require("next/server");
  const request = new NextRequest("http://127.0.0.1:3100/auth/logout", {
    method: "POST",
    headers: { origin: "http://127.0.0.1:3100", host: "127.0.0.1:3100" },
  });
  assert.equal(request.nextUrl.hostname, "localhost");
  const response = await POST(request);
  assert.equal(response.status, 303);
  assert.match(response.headers.get("location"), /^http:\/\/127\.0\.0\.1:3100\/login/);
});

test("Proxy forwards refreshed chunks to both the request and response, without caching", async () => {
  const cookies = new Map();
  const request = { nextUrl: { pathname: "/login" }, cookies: {
    getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
    set: (name, value) => cookies.set(name, value),
  } };
  const { updateSession } = load("lib/supabase/proxy.ts", {
    "@/lib/auth/student": { getStudentAccess },
    "next/server": { NextResponse: nextResponse() },
    "@/lib/supabase/config": {
      getSupabaseConfig: () => ({ url: "https://example.supabase.co", key: "public-test-key" }),
      authCookieOptions: { path: "/", sameSite: "lax" },
    },
    "@supabase/ssr": {
      createServerClient(_url, _key, options) {
        return { auth: { async getClaims() {
          options.cookies.setAll([{ name: "token.0", value: "first", options: { path: "/" } }], { "Cache-Control": "private, no-store" });
          options.cookies.setAll([{ name: "token.1", value: "second", options: { path: "/" } }], {});
        } } };
      },
    },
  });
  const response = await updateSession(request);
  assert.equal(cookies.get("token.0"), "first");
  assert.equal(cookies.get("token.1"), "second");
  assert.equal(response.cookies.getAll().length, 2);
  assert.match(response.headers.get("cache-control"), /private.*no-store/);
});

test("server cookie adapter persists action cookies and clears only this project's chunks", async () => {
  const values = new Map([
    ["sb-example-auth-token.0", "old-token"],
    ["sb-other-auth-token.0", "another-project"],
  ]);
  const cookieStore = {
    getAll: () => [...values].map(([name, value]) => ({ name, value })),
    set(name, value, options) {
      if (options.maxAge === 0) values.delete(name);
      else values.set(name, value);
    },
  };
  const server = load("lib/supabase/server.ts", {
    "@supabase/ssr": {
      createServerClient(_url, _key, options) { return options; },
      clearAuthCookiesAtScopes: require("@supabase/ssr").clearAuthCookiesAtScopes,
    },
    "next/headers": { async cookies() { return cookieStore; } },
    "@/lib/supabase/config": {
      getSupabaseConfig: () => ({ url: "https://example.supabase.co", key: "public-test-key" }),
      authCookieOptions: { path: "/", sameSite: "lax" },
    },
  });
  const actionClient = await server.createClient({ writableCookies: true });
  actionClient.cookies.setAll([{ name: "sb-example-auth-token.1", value: "refreshed", options: { path: "/" } }]);
  assert.equal(values.get("sb-example-auth-token.1"), "refreshed");
  await server.clearSessionCookies();
  assert.equal(values.has("sb-example-auth-token.0"), false);
  assert.equal(values.has("sb-example-auth-token.1"), false);
  assert.equal(values.get("sb-other-auth-token.0"), "another-project");
});

for (const [status, destination] of [
  ["unauthenticated", "/login"],
  ["forbidden", "/login?motivo=sin-acceso"],
  ["unavailable", "/login?motivo=servicio-no-disponible"],
]) {
  test(`the protected page redirects ${status} before rendering student data`, async () => {
    const { default: page } = load("app/alumno/page.tsx", {
      "react/jsx-runtime": {},
      "next/navigation": { redirect(url) { throw new Error(`redirect:${url}`); } },
      "lucide-react": {},
      "@/components/auth/logout-button": {},
      "@/components/auth/student-session": {},
      "@/lib/auth/student": { async getStudentAccess() { return { status }; } },
      "@/lib/supabase/server": { async createClient() { return {}; } },
    });
    await assert.rejects(page(), (error) => error.message === `redirect:${destination}`);
  });
}

test("the legacy student route redirects authorized students to home", async () => {
  const { default: page } = load("app/alumno/page.tsx", {
    "next/navigation": { redirect(url) { throw new Error(`redirect:${url}`); } },
    "@/lib/auth/student": { getStudentAccess },
    "@/lib/supabase/server": { async createClient() { return client().supabase; } },
  });
  await assert.rejects(page(), (error) => error.message === "redirect:/");
});

function navigationProxy(options = {}) {
  const { supabase, calls } = client(options);
  const { updateSession } = load("lib/supabase/proxy.ts", {
    "next/server": { NextResponse: nextResponse() },
    "@/lib/auth/student": { getStudentAccess },
    "@/lib/supabase/config": {
      getSupabaseConfig: () => ({ url: "https://example.supabase.co", key: "public-test-key" }),
      authCookieOptions: { path: "/", sameSite: "lax" },
    },
    "@supabase/ssr": {
      createServerClient(_url, _key, adapter) {
        supabase.auth.getClaims = async () => {
          adapter.cookies.setAll([{ name: "test-refresh", value: "test-only", options: { path: "/" } }], {});
        };
        return supabase;
      },
    },
  });
  const { NextRequest } = require("next/server");
  return {
    calls,
    request: (path = "/") => updateSession(new NextRequest(`http://192.168.1.8:3000${path}`)),
  };
}

for (const [name, options, destination] of [
  ["no session", { noUser: true }, "/login"],
  ["invalid session", { authError: {} }, "/login"],
  ["another role", { isStudent: false }, "/login?motivo=sin-acceso"],
  ["inactive profile", { active: false }, "/login?motivo=sin-acceso"],
  ["missing profile", { noProfile: true }, "/login?motivo=sin-acceso"],
  ["unavailable authorization", { roleError: {} }, "/login?motivo=servicio-no-disponible"],
]) {
  test(`home rejects ${name} on the server before rendering`, async () => {
    const fixture = navigationProxy(options);
    const response = await fixture.request("/?discard=this");
    assert.equal(response.status, 307);
    assert.equal(response.headers.get("location"), `http://192.168.1.8:3000${destination}`);
    assert.match(response.headers.get("cache-control"), /private.*no-store/);
    assert.equal(response.cookies.getAll().length, 1);
    // The login request must proceed to the page rather than loop in Proxy.
    const loginResponse = await fixture.request(destination);
    assert.equal(loginResponse.status, 200);
    assert.equal(loginResponse.headers.get("location"), null);
  });
}

test("home permits only a verified active student and rechecks after logout", async () => {
  const options = {};
  const fixture = navigationProxy(options);
  const response = await fixture.request();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("location"), null);
  assert.ok(fixture.calls.some(([name]) => name === "getUser"));
  assert.ok(fixture.calls.some(([name]) => name === "rpc"));
  options.noUser = true;
  const afterLogout = await fixture.request();
  assert.equal(afterLogout.status, 307);
  assert.match(afterLogout.headers.get("location"), /\/login$/);
});

test("the proxy matcher includes the exact home route", () => {
  const { config } = load("proxy.ts", { "@/lib/supabase/proxy": {} });
  assert.ok(config.matcher.includes("/"));
});

for (const [name, options, shouldRedirect] of [
  ["active student", {}, true],
  ["no session", { noUser: true }, false],
  ["another role", { isStudent: false }, false],
  ["inactive student", { active: false }, false],
  ["unavailable authorization", { roleError: {} }, false],
]) {
  test(`login navigation for ${name} does not create a redirect loop`, async () => {
    const { default: page } = load("app/login/page.tsx", {
      "react/jsx-runtime": { jsx: () => ({}), jsxs: () => ({}) },
      "next/link": {},
      "next/navigation": { redirect(url) { throw new Error(`redirect:${url}`); } },
      "lucide-react": {},
      "@/components/auth/login-form": {},
      "@/lib/auth/student": { getStudentAccess },
      "@/lib/supabase/server": { async createClient() { return client(options).supabase; } },
    });
    const render = () => page({ searchParams: Promise.resolve({}) });
    if (shouldRedirect) await assert.rejects(render(), (error) => error.message === "redirect:/");
    else await assert.doesNotReject(render());
  });
}

test("a successful form discards client state and navigates directly to home", () => {
  let reset = false;
  let destination;
  const { LoginForm } = load("components/auth/login-form.tsx", {
    "react": {
      useActionState: () => [{ success: true, message: null }, () => {}, false],
      useRef: () => ({ current: { reset() { reset = true; } } }),
      useEffect: (effect) => effect(),
    },
    "react/jsx-runtime": { jsx: () => ({}), jsxs: () => ({}) },
    "lucide-react": {},
    "@/app/login/actions": { login: () => {} },
    "@/components/ui/button": {},
  }, { window: { location: { replace(url) { destination = url; } } } });
  LoginForm({});
  assert.equal(reset, true);
  assert.equal(destination, "/");
});
