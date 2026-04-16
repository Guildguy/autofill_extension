const STORAGE_KEY = "autofillUserData";
const extApi = typeof browser !== "undefined" ? browser : chrome;

const FIELD_IDS = [
  "firstName",
  "lastName",
  "fullName",
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
];

const STATES = {
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
};

const form = document.getElementById("profile-form");
const fillNowButton = document.getElementById("fill-now");
const statusEl = document.getElementById("status");

document.addEventListener("DOMContentLoaded", () => {
  loadProfile();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const profile = buildProfileFromForm();
  await saveProfile(profile);
  setStatus("Dados salvos com sucesso.");
});

fillNowButton.addEventListener("click", async () => {
  const profile = buildProfileFromForm();
  await saveProfile(profile);

  const [tab] = await queryActiveTab();
  if (!tab || !tab.id) {
    setStatus("Nao foi possivel acessar a aba atual.");
    return;
  }

  try {
    await sendMessageToTab(tab.id, { type: "AUTOFILL_NOW" });
    setStatus("Preenchimento executado na aba atual.");
  } catch (_error) {
    setStatus("A pagina atual nao permite content scripts (paginas internas do navegador).", true);
  }
});

async function loadProfile() {
  const { [STORAGE_KEY]: profile } = await storageGet(STORAGE_KEY);
  if (!profile) {
    return;
  }

  for (const id of FIELD_IDS) {
    const el = document.getElementById(id);
    if (!el) {
      continue;
    }
    el.value = profile[id] || "";
  }
}

function buildProfileFromForm() {
  const data = {};
  for (const id of FIELD_IDS) {
    const el = document.getElementById(id);
    data[id] = el ? String(el.value || "").trim() : "";
  }

  const cpfRaw = digitsOnly(data.cpf);
  const phoneRaw = digitsOnly(data.phone);
  const cepRaw = digitsOnly(data.cep);

  const normalizedStateCode = String(data.stateCode || "").toUpperCase();
  const stateFromCode = STATES[normalizedStateCode] || "";
  const stateName = data.stateName || stateFromCode;

  const fullName =
    data.fullName || [data.firstName, data.lastName].filter(Boolean).join(" ").trim();
  const [derivedFirstName, ...restNameParts] = fullName.split(/\s+/).filter(Boolean);
  const derivedLastName = restNameParts.join(" ");

  const firstName = data.firstName || derivedFirstName || "";
  const lastName = data.lastName || derivedLastName || "";

  return {
    ...data,
    firstName,
    lastName,
    fullName,
    cpfRaw,
    cpf: formatCpf(cpfRaw),
    phoneRaw,
    phone: formatPhone(phoneRaw),
    cepRaw,
    cep: formatCep(cepRaw),
    stateCode: normalizedStateCode,
    stateName,
    birthDate: normalizeIsoDate(data.birthDate),
    birthDateBr: isoToBrDate(data.birthDate)
  };
}

async function saveProfile(profile) {
  await storageSet({ [STORAGE_KEY]: profile });
}

async function storageGet(key) {
  if (extApi.storage?.local?.get.length <= 1) {
    return extApi.storage.local.get(key);
  }

  return new Promise((resolve, reject) => {
    extApi.storage.local.get(key, (result) => {
      if (extApi.runtime?.lastError) {
        reject(new Error(extApi.runtime.lastError.message));
        return;
      }
      resolve(result || {});
    });
  });
}

async function storageSet(value) {
  if (extApi.storage?.local?.set.length <= 1) {
    return extApi.storage.local.set(value);
  }

  return new Promise((resolve, reject) => {
    extApi.storage.local.set(value, () => {
      if (extApi.runtime?.lastError) {
        reject(new Error(extApi.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

async function queryActiveTab() {
  if (extApi.tabs?.query.length <= 1) {
    return extApi.tabs.query({ active: true, currentWindow: true });
  }

  return new Promise((resolve, reject) => {
    extApi.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (extApi.runtime?.lastError) {
        reject(new Error(extApi.runtime.lastError.message));
        return;
      }
      resolve(tabs || []);
    });
  });
}

async function sendMessageToTab(tabId, message) {
  if (extApi.tabs?.sendMessage.length <= 2) {
    return extApi.tabs.sendMessage(tabId, message);
  }

  return new Promise((resolve, reject) => {
    extApi.tabs.sendMessage(tabId, message, (response) => {
      if (extApi.runtime?.lastError) {
        reject(new Error(extApi.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#991b1b" : "#155e75";
}

function digitsOnly(value) {
  return String(value || "").replace(/\D+/g, "");
}

function formatCpf(raw) {
  const cleaned = digitsOnly(raw).slice(0, 11);
  if (cleaned.length !== 11) {
    return cleaned;
  }

  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function formatPhone(raw) {
  const cleaned = digitsOnly(raw).slice(0, 11);
  if (cleaned.length < 10) {
    return cleaned;
  }

  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  }

  return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
}

function formatCep(raw) {
  const cleaned = digitsOnly(raw).slice(0, 8);
  if (cleaned.length !== 8) {
    return cleaned;
  }

  return cleaned.replace(/(\d{5})(\d{3})/, "$1-$2");
}

function normalizeIsoDate(dateValue) {
  if (!dateValue) {
    return "";
  }
  const parts = String(dateValue).split("-");
  if (parts.length !== 3) {
    return "";
  }
  return `${parts[0]}-${parts[1]}-${parts[2]}`;
}

function isoToBrDate(dateValue) {
  if (!dateValue || !dateValue.includes("-")) {
    return "";
  }

  const [year, month, day] = dateValue.split("-");
  if (!year || !month || !day) {
    return "";
  }

  return `${day}/${month}/${year}`;
}