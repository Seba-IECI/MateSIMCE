// Each spec uses the real form and gets its own session. No cy.session or stubs.
export function login() {
  cy.visit("/login");
  cy.location("pathname").should("eq", "/login");
  cy.env(["testEmail", "testPassword"]).then(({ testEmail, testPassword }) => {
    cy.get('input[name="email"]').type(testEmail, { log: false });
    cy.get('input[name="password"]').type(testPassword, { log: false });
  });
  cy.get('form button[type="submit"]').click();
  cy.location("pathname").should("eq", "/");
  cy.contains("h1", "Bienvenido a MateSIMCE").should("be.visible");
}
