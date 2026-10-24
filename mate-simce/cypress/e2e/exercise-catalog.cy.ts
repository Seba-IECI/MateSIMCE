import { login } from "../support/login";

const browser = '[data-cy="exercise-browser"]';
const topic = '[data-cy="exercise-topic"]';
const openExercise = '[data-cy="exercise-open"]';

// Branch only after the real UI finishes loading. Inspect every topic until
// finding content; if all are empty, explicitly record the untested detail.
function inspectTopic(index: number, count: number) {
  cy.get(topic).eq(index).click().should("have.attr", "aria-pressed", "true");
  cy.get(browser).should("have.attr", "aria-busy", "false");
  cy.get('[aria-labelledby="exercise-list-title"]').should("be.visible").then(($list) => {
    if ($list.find(openExercise).length > 0) {
      cy.get(openExercise).first().closest("li").find("h3").invoke("text").then((title) => {
        cy.get(openExercise).first().click();
        cy.get("#exercise-detail-title").should("have.text", title);
        cy.get('[data-cy="exercise-statement"]').should("be.visible").and("not.be.empty");
        cy.get('[data-cy="exercise-browser"]').should("have.attr", "aria-busy", "false");
        cy.get('[aria-labelledby="exercise-detail-title"]').then(($detail) => {
          if ($detail.find("#exercise-choices-title").length) {
            cy.get('[aria-labelledby="exercise-choices-title"] ol li').should("have.length.at.least", 2)
              .each(($choice) => { expect($choice.text().trim()).not.to.eq(""); });
          }
        });
        cy.contains("button", "Volver al listado").click();
        cy.get('[aria-labelledby="exercise-list-title"]').should("be.visible");
        cy.task("report", "E2: detalle positivo real visitado; título, enunciado y alternativas cuando corresponden.");
      });
    } else {
      cy.contains('[role="status"]', "Todavía no hay ejercicios publicados para este tema").should("be.visible");
      cy.get(topic).should("have.length", count); // Themes remain available above the empty listing.
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
