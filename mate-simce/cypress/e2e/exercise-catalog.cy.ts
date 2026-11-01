import { login } from "../support/login";

const browser = '[data-cy="exercise-browser"]';
const topic = '[data-cy="exercise-topic"]';
const openExercise = '[data-cy="exercise-open"]';

function inspectTopic(index: number, count: number) {
  cy.get(topic).eq(index).click().should("have.attr", "aria-pressed", "true");
  cy.get(browser).should("have.attr", "aria-busy", "false");
  cy.get('[aria-labelledby="exercise-list-title"]').should("be.visible").then(($list) => {
    if ($list.find(openExercise).length > 0) {
      cy.get(openExercise).first().closest("li").find("h3").invoke("text").then((title) => {
        let axisSelector = "";
        let attemptsBefore = 0;
        cy.get('[data-cy="practice-diagnosis"]').should("have.attr", "aria-busy", "false");
        cy.get(topic).eq(index).invoke("attr", "data-category").then((category) => {
          expect(category).to.be.oneOf(["numeros", "algebra_y_funciones", "geometria", "estadistica_y_probabilidades"]);
          axisSelector = `[data-cy="practice-axis"][data-category="${category}"]`;
          cy.get(axisSelector).find('[data-cy="practice-attempts"]').invoke("text").then((text) => { attemptsBefore = Number(text); });
        });
        cy.get(openExercise).first().click();
        cy.get("#exercise-detail-title").should("have.text", title);
        cy.get('[data-cy="exercise-statement"]').should("be.visible").and("not.be.empty");
        cy.get('[data-cy="exercise-browser"]').should("have.attr", "aria-busy", "false");
        cy.get('[data-cy="exercise-retry"]').should("not.exist");
        cy.get('[aria-labelledby="exercise-detail-title"]').then(($detail) => {
          if ($detail.find("#exercise-choices-title").length) {
            cy.get('[aria-labelledby="exercise-choices-title"] ol li').should("have.length.at.least", 2)
              .each(($choice) => { expect($choice.text().trim()).not.to.eq(""); });
          }
        });
        cy.get('[data-cy="exercise-check"]').click();
        cy.contains('[role="alert"]', "Selecciona una alternativa antes de comprobar tu respuesta.").should("be.visible");
        cy.get('input[name="exercise-choice"]').should("have.length", 4).first().check();
        cy.get('[data-cy="exercise-check"]').click();
        cy.get('[data-cy="exercise-feedback"]', { timeout: 30000 }).should("be.visible");
        cy.get("#answer-feedback-title").invoke("text").should("match", /^Respuesta (correcta|incorrecta)$/);
        cy.get('[data-cy="exercise-feedback"] .katex').should("exist");
        cy.contains('[data-cy="exercise-feedback"]', "Tu respuesta quedó guardada.").should("be.visible");
        cy.get('[data-cy="exercise-check"]').should("be.disabled").and("contain.text", "Respuesta comprobada");
        cy.get('[data-cy="practice-diagnosis"]').should("have.attr", "aria-busy", "false");
        cy.then(() => { cy.get(axisSelector).find('[data-cy="practice-attempts"]').should("have.text", String(attemptsBefore + 1)); });
        cy.get('[data-cy="exercise-retry"]').click();
        cy.get("#exercise-detail-title").should("have.text", title);
        cy.get('[data-cy="exercise-browser"]').should("have.attr", "aria-busy", "false");
        cy.get('[data-cy="exercise-feedback"]').should("not.exist");
        cy.get('[data-cy="exercise-retry"]').should("not.exist");
        cy.get('input[name="exercise-choice"]:checked').should("not.exist");
        cy.get('input[name="exercise-choice"]').eq(1).should("not.be.disabled").check();
        cy.get('[data-cy="exercise-check"]').click();
        cy.get('[data-cy="exercise-feedback"]', { timeout: 30000 }).should("be.visible").and("contain.text", "Tu respuesta quedó guardada.");
        cy.contains("button", "Volver al listado").click();
        cy.get('[aria-labelledby="exercise-list-title"]').should("be.visible");
        cy.get('[data-cy="practice-diagnosis"]').should("have.attr", "aria-busy", "false");
        cy.then(() => { cy.get(axisSelector).find('[data-cy="practice-attempts"]').should("have.text", String(attemptsBefore + 2)); });
        cy.reload();
        cy.get('nav[aria-label="Navegación principal"]').contains("button", "Ejercicios").click();
        cy.get('[data-cy="practice-diagnosis"]').should("have.attr", "aria-busy", "false");
        cy.then(() => { cy.get(axisSelector).find('[data-cy="practice-attempts"]').should("have.text", String(attemptsBefore + 2)); });
        cy.task("report", "E2: dos intentos reales del mismo ejercicio mediante Volver a intentar; selección y explicación reiniciadas, incremento exacto de dos y diagnóstico conservado tras recargar. Cuenta adulta de pruebas.");
      });
    } else {
      cy.contains('[role="status"]', "Todavía no hay ejercicios publicados para este tema").should("be.visible");
      cy.get(topic).should("have.length", count); 
      if (index + 1 < count) inspectTopic(index + 1, count);
      else cy.task("report", "E2: todos los temas consultados están vacíos. Detalle positivo PENDIENTE; no se usaron mocks.");
    }
  });
}

describe("E2 — Catálogo real de II medio", () => {
  it("consulta temas y comprueba el contenido o el estado vacío real", () => {
    login();
    cy.get('nav[aria-label="Navegación principal"]').contains("button", "Ejercicios").click();
    cy.contains("h1", "Ejercicios de matemática").should("be.visible");
    cy.contains("h2", "Contenidos de 2.º medio").should("be.visible");
    cy.get(browser).should("have.attr", "aria-busy", "false");
    cy.get(topic).should("have.length.at.least", 2).then(($topics) => inspectTopic(0, $topics.length));
    cy.get('nav[aria-label="Navegación principal"]').contains("button", "Inicio").click();
    cy.contains("h1", "Bienvenido a MateSIMCE").should("be.visible");
    cy.contains("button", "Cerrar sesión").click();
    cy.location("pathname").should("eq", "/login");
  });
});
