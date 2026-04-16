// @ts-nocheck
(() => {
    const STORAGE_KEY = AutofillShared.STORAGE_KEY;
    const extApi = typeof browser !== "undefined" ? browser : chrome;
    const form = document.getElementById("profile-form");
    const fillNowButton = document.getElementById("fill-now");
    const statusEl = document.getElementById("status");
    document.addEventListener("DOMContentLoaded", () => {
        attachInputConstraints();
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
            const alreadyFilledCount = Number(response.alreadyFilled || 0);
            if (alreadyFilledCount > 0) {
                setStatus(`Os campos compativeis ja estavam preenchidos (${alreadyFilledCount}).`);
                return;
            }
            setStatus("Nenhum campo compativel foi encontrado nessa pagina.", true);
        }
        catch (_error) {
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
            data[id] = el ? sanitizeByField(id, String(el.value || "").trim()) : "";
        }
        return AutofillProfileCore.buildProfileFromData(data, AutofillShared.STATES);
    }
    function attachInputConstraints() {
        const cpfInput = document.getElementById("cpf");
        const cepInput = document.getElementById("cep");
        const phoneInput = document.getElementById("phone");
        const stateCodeInput = document.getElementById("stateCode");
        const phoneCountryCodeSelect = document.getElementById("phoneCountryCode");
        if (cpfInput) {
            cpfInput.addEventListener("input", () => {
                cpfInput.value = AutofillTextCore.digitsOnly(cpfInput.value).slice(0, 11);
            });
        }
        if (cepInput) {
            cepInput.addEventListener("input", () => {
                cepInput.value = AutofillTextCore.digitsOnly(cepInput.value).slice(0, 8);
            });
        }
        if (phoneInput) {
            const normalizePhoneInput = () => {
                const maxDigits = resolvePhoneMaxDigits(phoneCountryCodeSelect?.value || "+55");
                phoneInput.value = AutofillTextCore.digitsOnly(phoneInput.value).slice(0, maxDigits);
            };
            phoneInput.addEventListener("input", normalizePhoneInput);
            phoneCountryCodeSelect?.addEventListener("change", normalizePhoneInput);
        }
        if (stateCodeInput) {
            stateCodeInput.addEventListener("input", () => {
                stateCodeInput.value = String(stateCodeInput.value || "")
                    .replace(/[^a-zA-Z]/g, "")
                    .toUpperCase()
                    .slice(0, 2);
            });
        }
        if (phoneCountryCodeSelect) {
            phoneCountryCodeSelect.addEventListener("change", () => {
                phoneCountryCodeSelect.value = normalizeDialCode(phoneCountryCodeSelect.value);
            });
        }
    }
    function sanitizeByField(fieldId, value) {
        switch (fieldId) {
            case "cpf":
                return AutofillTextCore.digitsOnly(value).slice(0, 11);
            case "cep":
                return AutofillTextCore.digitsOnly(value).slice(0, 8);
            case "phone": {
                const phoneCountryCode = getElementValue("phoneCountryCode") || "+55";
                const maxDigits = resolvePhoneMaxDigits(phoneCountryCode);
                return AutofillTextCore.digitsOnly(value).slice(0, maxDigits);
            }
            case "phoneCountryCode":
                return normalizeDialCode(value);
            case "stateCode":
                return value.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 2);
            case "linkedin":
            case "github":
                return value.slice(0, 255);
            case "email":
                return value.slice(0, 120);
            case "firstName":
                return value.slice(0, 60);
            case "lastName":
                return value.slice(0, 80);
            case "fullName":
                return value.slice(0, 120);
            case "street":
                return value.slice(0, 120);
            case "number":
                return value.slice(0, 10);
            case "complement":
                return value.slice(0, 80);
            case "district":
                return value.slice(0, 80);
            case "city":
                return value.slice(0, 80);
            case "stateName":
                return value.slice(0, 40);
            case "rg":
                return value.slice(0, 20);
            default:
                return value;
        }
    }
    function normalizeDialCode(value) {
        const digits = AutofillTextCore.digitsOnly(value).slice(0, 4);
        if (!digits) {
            return "+55";
        }
        return `+${digits}`;
    }
    function resolvePhoneMaxDigits(phoneCountryCode) {
        const dialDigits = AutofillTextCore.digitsOnly(phoneCountryCode);
        if (dialDigits === "55") {
            return 11;
        }
        return 15;
    }
    function getElementValue(id) {
        const el = document.getElementById(id);
        if (!el) {
            return "";
        }
        return String(el.value || "");
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
//# sourceMappingURL=popup.js.map