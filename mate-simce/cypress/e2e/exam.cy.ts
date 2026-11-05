import { login } from "../support/login";

// Real student session and Supabase. Run only after enabling enable-practice-exam.sql.
// Creates an academic test attempt; use the dedicated adult test account.
describe("Ensayo breve real", () => {
  it("guarda una selección, la recupera al recargar y finaliza el intento", () => {
    login();
    let reviewAllowed = false;
    let finalRequest: { action: string; contentType: string; body: string } | null = null;
    let finishedAt = "";
    cy.intercept("POST", "/", (request) => {
      if (reviewAllowed && !finalRequest) finalRequest = {
        action: String(request.headers["next-action"]), contentType: String(request.headers["content-type"]),
        body: typeof request.body === "string" ? request.body : JSON.stringify(request.body),
      };
      request.continue((response) => {
        const body = String(response.body);
        // Resuming a previously completed attempt may legitimately include its review.
        if (!reviewAllowed && /"state":"en_curso"/.test(body)) expect(/"correctIndex"|"explanation"/.test(body), "sin soluciones antes de finalizar").to.eq(false);
        if (reviewAllowed) finishedAt = /"finishedAt":"([^"]+)"/.exec(body)?.[1] ?? "";
      });
    }).as("examAction");
    const open = () => cy.get('nav[aria-label="Navegación principal"]').contains("button", "Ensayo tipo SIMCE").click();
    const ready = () => cy.get('[data-cy="exam-browser"]').should("have.attr", "aria-busy", "false");
    open();
    cy.wait("@examAction");
    ready();
    cy.get('[data-cy="exam-browser"]').should("not.contain.text", "requiere habilitación");
    cy.get('[data-cy="exam-browser"]').then(($exam) => {
      if ($exam.find('[data-cy="exam-results"]').length) {
        cy.contains("button", "Comenzar otro ensayo").click();
        cy.wait("@examAction");
      } else if ($exam.find('[data-cy="exam-start"]').length) {
        cy.get('[data-cy="exam-start"]').click();
        cy.wait("@examAction");
      }
    });
    ready();
    cy.get('[data-cy="exam-results"]').should("not.exist");
    const axes: Record<string, number> = {};
    cy.get('[data-cy="exam-question-nav"]').should("have.length", 12).each((_button, i) => {
      cy.get('[data-cy="exam-question-nav"]').eq(i).click();
      cy.get('[data-cy="exam-question"] > p').invoke("text").then((axis) => { axes[axis] = (axes[axis] ?? 0) + 1; });
      cy.get('[data-cy="exam-choice"]').should("have.length", 4);
    }).then(() => expect(axes).to.deep.eq({ "Números": 3, "Álgebra y funciones": 3, "Geometría": 3, "Estadística y probabilidades": 3 }));
    cy.get('[data-cy="exam-question-nav"]').should("have.length", 12).first().click();
    cy.get('[data-cy="exam-choice"]').should("have.length", 4).first().then(($choice) => {
      if (!$choice.prop("checked")) {
        cy.get('[data-cy="exam-choice"]').first().check();
        cy.wait("@examAction");
      }
    });
    ready();
    cy.get('[data-cy="exam-browser"] [role="alert"]').should("not.exist");
    cy.get('[data-cy="exam-choice"]').first().should("be.checked");
    cy.get('[data-cy="exam-review"]').should("not.exist");
    cy.get('[data-cy="exercise-tutor"]').should("not.exist");
    cy.contains("button", "Siguiente").click();
    cy.contains("button", "Anterior").click();
    cy.get('[data-cy="exam-choice"]').first().should("be.checked");
    cy.reload();
    open();
    cy.wait("@examAction");
    ready();
    cy.get('[data-cy="exam-question-nav"]').first().click();
    cy.get('[data-cy="exam-choice"]').first().should("be.checked");
    cy.get('[data-cy="exam-finish"]').click();
    cy.then(() => { reviewAllowed = true; });
    cy.get('[data-cy="exam-confirm"]').click();
    cy.wait("@examAction");
    ready();
    cy.get('[data-cy="exam-results"]').should("be.visible");
    cy.get('[data-cy="exam-review"]').should("be.visible");
    cy.get('[data-cy="exam-choice"]').should("be.disabled");
    cy.contains("button", "Finalizar ensayo").should("not.exist");
    // Replay the real Server Action, with the browser's cookies; never log its body or headers.
    cy.then(() => {
      if (!finalRequest || !finishedAt) throw new Error("No se capturó la finalización real");
      return cy.request({ method: "POST", url: "/", log: false, failOnStatusCode: false,
        headers: { "Next-Action": finalRequest.action, "Content-Type": finalRequest.contentType,
          Origin: new URL(String(Cypress.config("baseUrl"))).origin }, body: finalRequest.body,
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(String(response.body).includes(finishedAt), "fecha de cierre intacta al finalizar dos veces").to.eq(true);
      });
    });
    cy.contains("button", "Volver al inicio").click();
    cy.contains("h1", "Bienvenido a MateSIMCE").should("be.visible");
  });
});
