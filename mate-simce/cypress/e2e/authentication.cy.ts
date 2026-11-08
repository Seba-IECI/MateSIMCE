import { login } from "../support/login";

describe("E1 — Autenticación real", () => {
  it("permite pedir recuperación y explica enlaces inválidos sin enviar correos de prueba", () => {
    cy.visit("/login");
    cy.contains("a", "¿Olvidaste tu contraseña?").click();
    cy.contains("h2", "Recupera tu acceso").should("be.visible");
    cy.get("form").invoke("attr", "novalidate", "novalidate");
    cy.get('input[name="email"]').type("correo-invalido");
    cy.contains("button", "Enviar instrucciones").click();
    cy.contains("Ingresa un correo electrónico válido.").should("be.visible");
    cy.visit("/auth/confirm?type=recovery");
    cy.contains("El enlace de recuperación no es válido o ya expiró.").should("be.visible");
    cy.visit("/reset-password");
    cy.contains("El enlace o la sesión no están disponibles.").should("be.visible");
    cy.contains("a", "Solicitar un nuevo enlace").click();
    cy.contains("h2", "Recupera tu acceso").should("be.visible");
  });
  it("abre el registro, valida la confirmación y permite volver al login sin crear cuentas", () => {
    cy.visit("/login");
    cy.contains("h2", "Inicia sesión").should("be.visible");
    cy.screenshot("ux-login", { capture: "viewport" });
    cy.contains("a", "Registrarse").click();
    cy.contains("h2", "Crea tu cuenta").should("be.visible");
    cy.get('input[name="name"]').type("Prueba de formulario");
    cy.get('input[name="email"]').type("signup@example.test");
    cy.get('input[name="password"]').type("Synthetic-Password7!", { log: false });
    cy.get('input[name="confirmation"]').type("Different-Password8!", { log: false });
    cy.get('button[type="submit"]').click();
    cy.contains("Las contraseñas deben coincidir.").should("be.visible");
    cy.get('button[type="submit"]').should("be.enabled").and("contain", "Crear cuenta de alumno");
    cy.contains("a", "Volver a Iniciar sesión").click();
    cy.contains("h2", "Inicia sesión").should("be.visible");
  });

  it("inicia sesión, conserva acceso al recargar y lo pierde al cerrar sesión", () => {
    login();
    const seen: string[] = [];
    cy.get('button[aria-label="Consejo siguiente"]').should("be.enabled");
    for (let index = 0; index < 20; index++) {
      cy.get('[data-cy="tip-text"]').invoke("text").then((text) => { seen.push(text); });
      cy.get('button[aria-label="Consejo siguiente"]').should("be.enabled").click();
    }
    cy.then(() => expect(new Set(seen).size).to.eq(20));
    cy.get('[data-cy="tip-text"]').invoke("text").then((text) => expect(text).to.eq(seen[0]));
    cy.reload();
    cy.location("pathname").should("eq", "/");
    cy.contains("h1", "Bienvenido a MateSIMCE").should("be.visible");
    cy.get('[data-cy="tip-text"]').invoke("text").should((text) => expect(text).to.eq(seen[0]));
    cy.contains("button", "Cerrar sesión").click();
    cy.location("pathname").should("eq", "/login");
    cy.get('input[name="email"]').should("have.value", "");
    cy.visit("/");
    cy.location("pathname").should("eq", "/login");
    cy.get('input[name="password"]').should("be.visible");
  });
});
