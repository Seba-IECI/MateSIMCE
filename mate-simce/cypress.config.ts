/// <reference types="node" />

import { loadEnvConfig } from "@next/env";
import { defineConfig } from "cypress";

export default defineConfig({
  viewportWidth: 1366,
  viewportHeight: 768,
  video: false,
  screenshotOnRunFailure: false,
  e2e: {
    baseUrl: "http://127.0.0.1:3100",
    specPattern: "cypress/e2e/*.cy.ts",
    supportFile: false,
    testIsolation: true,
    defaultCommandTimeout: 20000,
    setupNodeEvents(on, config) {
      // Read only the two approved test secrets, never expose the whole .env.
      const previousMode = process.env.NODE_ENV;
      process.env.NODE_ENV = "test";
      const { combinedEnv } = loadEnvConfig(config.projectRoot);
      if (previousMode === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousMode;
      const email = combinedEnv.MATESIMCE_TEST_EMAIL;
      const password = combinedEnv.MATESIMCE_TEST_PASSWORD;
      if (!email || !password) throw new Error("Configura la cuenta adulta de pruebas en .env.test.local.");
      config.env.testEmail = email;
      config.env.testPassword = password;
      on("task", {
        report(message: string) { console.log(message); return null; },
      });
      return config;
    },
  },
});
