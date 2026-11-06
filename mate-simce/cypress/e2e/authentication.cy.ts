import { login } from "../support/login";

describe("E1 — Autenticación real", () => {
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
    cy.reload();
    cy.location("pathname").should("eq", "/");
    cy.contains("h1", "Bienvenido a MateSIMCE").should("be.visible");
    cy.contains("button", "Cerrar sesión").click();
    cy.location("pathname").should("eq", "/login");
    cy.get('input[name="email"]').should("have.value", "");
    cy.visit("/");
    cy.location("pathname").should("eq", "/login");
    cy.get('input[name="password"]').should("be.visible");
  });
});
