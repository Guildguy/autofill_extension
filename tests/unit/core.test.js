import { describe, it, expect } from "vitest";
import { createRuntime } from "../helpers/runtime.js";

function loadCore(runtime) {
  runtime.loadScript("af_ext/shared/constants.js", ["AutofillShared"]);
  runtime.loadScript("af_ext/core/text-core.js", ["AutofillTextCore"]);
  runtime.loadScript("af_ext/core/profile-core.js", ["AutofillProfileCore"]);
  runtime.loadScript("af_ext/core/autofill-core.js", ["AutofillAutofillCore"]);
}

describe("Autofill core unit tests", () => {
  it("normaliza texto para token match ignorando pontuacao", () => {
    const runtime = createRuntime();
    loadCore(runtime);

    const { AutofillTextCore } = runtime.context;
    expect(AutofillTextCore.containsToken("E-mail:", "e mail")).toBe(true);
    expect(AutofillTextCore.containsToken("Country/Region", "country region")).toBe(true);
  });

  it("inferencia reconhece country por attr label", () => {
    const runtime = createRuntime();
    loadCore(runtime);

    const field = runtime.document.createElement("spl-autocomplete");
    field.setAttribute("label", "Country");

    const result = runtime.context.AutofillAutofillCore.inferField(field);
    expect(result.key).toBe("country");
    expect(result.score).toBeGreaterThanOrEqual(60);
  });

  it("buildProfileFromData deriva nomes e formata telefone internacional", () => {
    const runtime = createRuntime();
    loadCore(runtime);

    const data = {
      fullName: "Ada Lovelace",
      firstName: "",
      lastName: "",
      phone: "11987654321",
      phoneCountryCode: "+55",
      cpf: "39053344705",
      cep: "01310100",
      birthDate: "1990-02-03"
    };

    const profile = runtime.context.AutofillProfileCore.buildProfileFromData(
      data,
      runtime.context.AutofillShared.STATES
    );

    expect(profile.firstName).toBe("Ada");
    expect(profile.lastName).toBe("Lovelace");
    expect(profile.phoneIntl).toBe("+55 (11) 98765-4321");
    expect(profile.cpf).toBe("390.533.447-05");
    expect(profile.cep).toBe("01310-100");
    expect(profile.birthDateBr).toBe("03/02/1990");
  });
});
