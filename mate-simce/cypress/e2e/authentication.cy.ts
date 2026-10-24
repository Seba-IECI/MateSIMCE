import { login } from "../support/login";

describe("E1 — Autenticación real", () => {
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
