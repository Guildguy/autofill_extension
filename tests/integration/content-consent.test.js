import { describe, it, expect } from "vitest";
import { createRuntime } from "../helpers/runtime.js";

function loadContentRuntime(runtime) {
  runtime.loadScript("af_ext/shared/constants.js", ["AutofillShared"]);
  runtime.loadScript("af_ext/core/text-core.js", ["AutofillTextCore"]);
  runtime.loadScript("af_ext/core/autofill-core.js", ["AutofillAutofillCore"]);
  runtime.loadScript("af_ext/content.js");
}

describe("Content consent integration", () => {
  it("mostra popup de consentimento e nao preenche automaticamente", async () => {
    const runtime = createRuntime({
      html: "<!doctype html><html><body><input id='email-field' name='email' /></body></html>",
      storageData: {
        autofillUserData: {
          email: "user@example.com"
        }
      }
    });

    loadContentRuntime(runtime);
    await runtime.flushTimers(0);

    const promptHost = runtime.document.getElementById("autofill-consent-host");
    const emailField = runtime.document.getElementById("email-field");

    expect(promptHost).not.toBeNull();
    expect(emailField.value).toBe("");
  });

  it("preenche ao clicar em 'Preencher agora' no popup in-page", async () => {
    const runtime = createRuntime({
      html: "<!doctype html><html><body><input id='email-field' name='email' /></body></html>",
      storageData: {
        autofillUserData: {
          email: "user@example.com"
        }
      }
    });

    loadContentRuntime(runtime);
    await runtime.flushTimers(0);

    const promptHost = runtime.document.getElementById("autofill-consent-host");
    const fillButton = promptHost?.shadowRoot?.getElementById("autofill-yes");
    fillButton?.click();

    await runtime.flushTimers(0);

    const emailField = runtime.document.getElementById("email-field");
    expect(emailField.value).toBe("user@example.com");
    expect(runtime.document.getElementById("autofill-consent-host")).toBeNull();
  });

  it("mantem preenchimento manual via mensagem do popup da extensao", async () => {
    const runtime = createRuntime({
      html: "<!doctype html><html><body><input id='email-field' name='email' /></body></html>",
      storageData: {
        autofillUserData: {
          email: "manual@example.com"
        }
      }
    });

    loadContentRuntime(runtime);
    await runtime.flushTimers(0);

    const promptHost = runtime.document.getElementById("autofill-consent-host");
    const laterButton = promptHost?.shadowRoot?.getElementById("autofill-later");
    laterButton?.click();

    await runtime.flushTimers(0);

    const response = await runtime.sendRuntimeMessage({
      type: runtime.context.AutofillShared.AUTOFILL_NOW_MESSAGE
    });

    expect(response?.ok).toBe(true);
    expect(response?.filled).toBe(1);

    const emailField = runtime.document.getElementById("email-field");
    expect(emailField.value).toBe("manual@example.com");
  });
});
