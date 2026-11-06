import { login } from "../support/login";

const browser = '[data-cy="exercise-browser"]';
const dashboardTopic = '[data-cy="dashboard-topic"]';
const openExercise = '[data-cy="exercise-open"]';
const ready = () => cy.get(browser).should("have.attr", "aria-busy", "false");
const home = () => cy.get('nav[aria-label="Navegación principal"]').contains("button", "Inicio").click();
function openDiagnosis() {
  cy.contains("summary", "Tu diagnóstico por eje").click();
  cy.get('[data-cy="practice-diagnosis"]').should("have.attr", "aria-busy", "false");
}

describe("E2 — Práctica real de II medio", () => {
  it("entra directamente por los cuatro ejes, responde, reintenta y avanza sin duplicar intentos", () => {
    login();
    cy.contains("button", "Consultar ejercicios").should("not.exist");
    cy.contains("button", "Mi progreso").should("not.exist");
    cy.get('[data-cy="tip-text"]').invoke("text").then((previous) => {
      cy.get('button[aria-label="Consejo siguiente"]').click();
      cy.get('[data-cy="tip-text"]').invoke("text").should("not.eq", previous);
    });
    cy.get(dashboardTopic).should("have.length", 4).and("not.be.disabled");
    cy.get('nav[aria-label="Navegación principal"]').contains("button", "Práctica por ejes").click();
    ready();
    cy.get('[data-cy="exercise-topic"]').should("have.length", 4).then(($cards) => {
      const rectangles = [...$cards].map((card) => card.getBoundingClientRect());
      expect(rectangles[0].top).to.eq(rectangles[1].top);
      expect(rectangles[2].top).to.eq(rectangles[3].top);
      expect(rectangles[2].top).to.be.greaterThan(rectangles[0].top);
    });
    home();
    cy.screenshot("ux-dashboard", { capture: "viewport" });
    cy.document().then((doc) => expect(doc.documentElement.scrollWidth).to.be.at.most(doc.documentElement.clientWidth));
    for (let axis = 0; axis < 4; axis += 1) {
      cy.get(dashboardTopic).eq(axis).click();
      ready();
      cy.get('[aria-labelledby="exercise-list-title"]').should("be.visible");
      cy.get(openExercise).should("have.length.at.least", 1);
      cy.get('[data-cy="exercise-topic"]').should("not.exist");
      home();
    }
    let category = "";
    let attemptsBefore = 0;
    cy.get(dashboardTopic).first().invoke("attr", "data-category").then((value) => { category = String(value); });
    cy.get(dashboardTopic).first().click();
    ready();
    openDiagnosis();
    cy.then(() => cy.get(`[data-cy="practice-axis"][data-category="${category}"] [data-cy="practice-attempts"]`).invoke("text").then((text) => { attemptsBefore = Number(text); }));
    cy.get(openExercise).first().click();
    ready();
    cy.get('[data-cy="practice-diagnosis"]').should("not.exist");
    cy.get('[data-cy="exercise-feedback"]').should("not.exist");
    cy.get('[data-cy="answer-toast"]').should("not.exist");
    cy.get('input[name="exercise-choice"]').should("have.length", 4);
    cy.get('[data-cy="exercise-hint"]').click();
    ready();
    cy.get('[data-cy="exercise-hint-response"]').should("be.visible");
    cy.get('input[name="exercise-choice"]:checked').should("not.exist");
    cy.get('[data-cy="exercise-feedback"]').should("not.exist");
    cy.screenshot("ux-practice", { capture: "viewport" });
    cy.get('[data-cy="exercise-check"]').click();
    cy.contains('[role="alert"]', "Selecciona una alternativa").should("be.visible");
    cy.get('input[name="exercise-choice"]').first().check();
    cy.get('[data-cy="exercise-check"]').dblclick();
    cy.get('[data-cy="exercise-feedback"]', { timeout: 30000 }).should("be.visible");
    cy.get('[data-cy="answer-toast"]').should("be.visible");
    cy.get("#answer-feedback-title").invoke("text").then((text) => {
      cy.get('[data-cy="answer-toast"]').should("contain.text", text === "Respuesta correcta" ? "¡Correcto!" : "Aún no es correcto");
    });
    cy.get('[aria-label="Cerrar notificación"]').click();
    cy.contains("summary", "Ver explicación").click();
    cy.get('[data-cy="exercise-feedback"] .katex').should("be.visible");
    cy.get('[data-cy="exercise-tutor"]').should("be.visible");
    cy.get('[data-cy="exercise-hint"]').should("not.exist");
    cy.get('[data-cy="tutor-error"]').should("be.visible");
    cy.get('[data-cy="tutor-procedure"]').should("be.visible");
    // Gemini is mocked in unit tests. This browser run consumes no generative API quota.
    cy.get('[data-cy="exercise-retry"]').click();
    ready();
    cy.get('input[name="exercise-choice"]:checked').should("not.exist");
    cy.get('[data-cy="exercise-feedback"]').should("not.exist");
    cy.get('[data-cy="exercise-hint-response"]').should("not.exist");
    cy.get('[data-cy="exercise-hint"]').should("be.visible");
    cy.get('[data-cy="answer-toast"]').should("not.exist");
    cy.get('input[name="exercise-choice"]').eq(1).check();
    cy.get('[data-cy="exercise-check"]').click();
    cy.get('[data-cy="exercise-feedback"]', { timeout: 30000 }).should("be.visible");
    cy.get('[aria-label="Cerrar notificación"]').click();
    cy.get("#exercise-detail-title").invoke("text").then((title) => {
      cy.get('[data-cy="exercise-next"]').click();
      ready();
      cy.get("#exercise-detail-title").should("not.have.text", title);
    });
    cy.get('[data-cy="exercise-feedback"]').should("not.exist");
    cy.contains("button", "Volver al listado").click();
    openDiagnosis();
    cy.then(() => cy.get(`[data-cy="practice-axis"][data-category="${category}"] [data-cy="practice-attempts"]`).should("have.text", String(attemptsBefore + 2)));
    cy.reload();
    cy.get('nav[aria-label="Navegación principal"]').contains("button", "Práctica por ejes").click();
    ready();
    openDiagnosis();
    cy.then(() => cy.get(`[data-cy="practice-axis"][data-category="${category}"] [data-cy="practice-attempts"]`).should("have.text", String(attemptsBefore + 2)));
    home();
    cy.contains("button", "Cerrar sesión").click();
    cy.location("pathname").should("eq", "/login");
  });
});
