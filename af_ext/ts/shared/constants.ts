const AutofillShared = {
  STORAGE_KEY: "autofillUserData",
  DEBUG_STORAGE_KEY: "autofillDebugEnabled",
  DEBUG_EVENT_NAME: "autofill:field-score",
  AUTOFILL_NOW_MESSAGE: "AUTOFILL_NOW",
  MIN_SCORE: 60,
  RECHECK_DELAY_MS: 300,
  TOGGLE_SHORTCUT: "Ctrl+Alt+Shift+D",

  FIELD_IDS: [
    "firstName",
    "lastName",
    "fullName",
    "linkedin",
    "github",
    "phoneCountryCode",
    "cpf",
    "rg",
    "email",
    "phone",
    "birthDate",
    "cep",
    "street",
    "number",
    "complement",
    "district",
    "city",
    "stateCode",
    "stateName"
  ],

  STATES: {
    AC: "Acre",
    AL: "Alagoas",
    AP: "Amapa",
    AM: "Amazonas",
    BA: "Bahia",
    CE: "Ceara",
    DF: "Distrito Federal",
    ES: "Espirito Santo",
    GO: "Goias",
    MA: "Maranhao",
    MT: "Mato Grosso",
    MS: "Mato Grosso do Sul",
    MG: "Minas Gerais",
    PA: "Para",
    PB: "Paraiba",
    PR: "Parana",
    PE: "Pernambuco",
    PI: "Piaui",
    RJ: "Rio de Janeiro",
    RN: "Rio Grande do Norte",
    RS: "Rio Grande do Sul",
    RO: "Rondonia",
    RR: "Roraima",
    SC: "Santa Catarina",
    SP: "Sao Paulo",
    SE: "Sergipe",
    TO: "Tocantins"
  },

  PROTECTED_HINTS: ["password", "senha", "captcha", "recaptcha", "token", "otp"],

  FIELD_DEFINITIONS: [
    {
      key: "fullName",
      keywords: ["nome completo", "full name", "fullname"],
      autocomplete: ["name"]
    },
    {
      key: "firstName",
      keywords: ["nome", "primeiro nome", "first name", "firstname", "given name", "given-name"],
      autocomplete: ["given-name"]
    },
    {
      key: "lastName",
      keywords: ["sobrenome", "last name", "lastname", "surname", "family name", "family-name"],
      autocomplete: ["family-name"]
    },
    {
      key: "linkedin",
      keywords: ["linkedin", "linked in", "linkedin profile", "perfil linkedin"],
      autocomplete: ["url"]
    },
    {
      key: "github",
      keywords: ["github", "git hub", "github profile", "perfil github"],
      autocomplete: ["url"]
    },
    {
      key: "email",
      keywords: ["email", "e-mail", "mail"],
      autocomplete: ["email"]
    },
    {
      key: "cpf",
      keywords: ["cpf", "cadastro de pessoa fisica"],
      autocomplete: []
    },
    {
      key: "rg",
      keywords: ["rg", "identidade", "registro geral"],
      autocomplete: []
    },
    {
      key: "phone",
      keywords: [
        "telefone",
        "celular",
        "phone",
        "mobile",
        "whatsapp",
        "phone number",
        "numero telefone",
        "numero de telefone"
      ],
      autocomplete: ["tel", "tel-national"]
    },
    {
      key: "phoneCountry",
      keywords: [
        "country code",
        "phone country",
        "country dial",
        "dial code",
        "codigo pais",
        "codigo do pais",
        "ddi",
        "isd",
        "phone prefix",
        "prefixo"
      ],
      autocomplete: ["tel-country-code"]
    },
    {
      key: "cep",
      keywords: ["cep", "zip", "postal code", "codigo postal"],
      autocomplete: ["postal-code"]
    },
    {
      key: "street",
      keywords: ["rua", "logradouro", "street", "address line 1", "address1"],
      autocomplete: ["street-address", "address-line1"]
    },
    {
      key: "number",
      keywords: ["numero", "number", "house number", "address number"],
      autocomplete: ["address-line2"]
    },
    {
      key: "complement",
      keywords: ["complemento", "address line 2", "address2", "apt", "apto"],
      autocomplete: ["address-line2"]
    },
    {
      key: "district",
      keywords: ["bairro", "district", "neighborhood"],
      autocomplete: ["address-level3"]
    },
    {
      key: "city",
      keywords: [
        "cidade",
        "city",
        "municipio",
        "location",
        "location city",
        "city location",
        "localizacao",
        "localidade",
        "town"
      ],
      autocomplete: ["address-level2"]
    },
    {
      key: "state",
      keywords: ["estado", "uf", "state", "provincia"],
      autocomplete: ["address-level1"]
    },
    {
      key: "birthDate",
      keywords: ["data nascimento", "nascimento", "birth date", "birthdate", "date of birth"],
      autocomplete: ["bday"]
    },
    {
      key: "birthDay",
      keywords: ["dia nascimento", "nascimento dia", "birth day", "bday-day"],
      autocomplete: ["bday-day"]
    },
    {
      key: "birthMonth",
      keywords: ["mes nascimento", "nascimento mes", "birth month", "bday-month"],
      autocomplete: ["bday-month"]
    },
    {
      key: "birthYear",
      keywords: ["ano nascimento", "nascimento ano", "birth year", "bday-year"],
      autocomplete: ["bday-year"]
    }
  ] as AutofillFieldDefinition[]
};
