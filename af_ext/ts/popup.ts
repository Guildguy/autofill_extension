// @ts-nocheck
(() => {
const STORAGE_KEY = AutofillShared.STORAGE_KEY;
const extApi = typeof browser !== "undefined" ? browser : chrome;

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
    const response = await sendMessageToTab(tab.id, { type: AutofillShared.AUTOFILL_NOW_MESSAGE });

    if (!response) {
      setStatus("A extensao nao recebeu resposta da pagina atual.", true);
      return;
    }

    if (response.ok === false) {
      setStatus("Falha ao preencher na pagina atual.", true);
      return;
    }

    const filledCount = Number(response.filled || 0);
    if (filledCount > 0) {
      setStatus(`Preenchimento executado: ${filledCount} campo(s) alterado(s).`);
      return;
    }

    setStatus("Nenhum campo compativel foi encontrado nessa pagina.", true);
  } catch (_error) {
    setStatus("A pagina atual nao permite content scripts (paginas internas do navegador).", true);
  }
});

async function loadProfile() {
  const { [STORAGE_KEY]: profile } = await storageGet(STORAGE_KEY);
  if (!profile) {
    return;
  }

  for (const id of AutofillShared.FIELD_IDS) {
    const el = document.getElementById(id);
    if (!el) {
      continue;
    }
    el.value = profile[id] || "";
  }
}

function buildProfileFromForm() {
  const data = {};
  for (const id of AutofillShared.FIELD_IDS) {
    const el = document.getElementById(id);
    data[id] = el ? String(el.value || "").trim() : "";
  }

  return AutofillProfileCore.buildProfileFromData(data, AutofillShared.STATES);
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

})();