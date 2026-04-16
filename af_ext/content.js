const STORAGE_KEY = "autofillUserData";
const MIN_SCORE = 60;
const RECHECK_DELAY_MS = 300;
const DEBUG_EVENT_NAME = "autofill:field-score";
const extApi = typeof browser !== "undefined" ? browser : chrome;

const FIELD_DEFINITIONS = [
	{
		key: "fullName",
		keywords: ["nome completo", "full name", "fullname"],
		autocomplete: ["name"]
	},
	{
		key: "firstName",
		keywords: ["primeiro nome", "first name", "firstname", "given name", "given-name"],
		autocomplete: ["given-name"]
	},
	{
		key: "lastName",
		keywords: ["sobrenome", "last name", "lastname", "surname", "family name", "family-name"],
		autocomplete: ["family-name"]
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
		keywords: ["telefone", "celular", "phone", "mobile", "whatsapp"],
		autocomplete: ["tel", "tel-national"]
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
		keywords: ["cidade", "city", "municipio"],
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
];

const PROTECTED_HINTS = ["password", "senha", "captcha", "recaptcha", "token", "otp"];

let debounceHandle = null;

init();

function init() {
	runAutofill();
	observeDynamicForms();

	extApi.runtime.onMessage.addListener((message, _sender, sendResponse) => {
		if (message?.type !== "AUTOFILL_NOW") {
			return undefined;
		}

		runAutofill()
			.then((result) => sendResponse({ ok: true, ...result }))
			.catch((error) => sendResponse({ ok: false, error: String(error) }));

		return true;
	});
}

async function runAutofill() {
	const userData = await readUserData();
	if (!userData) {
		return { filled: 0 };
	}

	const targets = collectCandidateFields();
	const evaluations = targets
		.map((field) => ({ field, inference: inferField(field) }))
		.filter((item) => item.inference);

	const inferences = evaluations.filter((item) => item.inference.score >= MIN_SCORE);

	if (inferences.length === 0) {
		for (const item of evaluations) {
			emitScoreDebugEvent({
				field: describeField(item.field),
				matchedKey: item.inference?.key || "",
				score: item.inference?.score || 0,
				threshold: MIN_SCORE,
				passesThreshold: false,
				filled: false,
				reasons: item.inference?.reasons || [],
				valuePreview: ""
			});
		}
		return { filled: 0 };
	}

	const hasSplitName =
		inferences.some((item) => item.inference.key === "firstName") &&
		inferences.some((item) => item.inference.key === "lastName");

	let filled = 0;

	for (const item of evaluations) {
		const passesThreshold = item.inference.score >= MIN_SCORE;
		const value = passesThreshold
			? resolveValue(item.inference.key, item.field, userData, hasSplitName)
			: "";

		let didFill = false;
		if (passesThreshold && value) {
			didFill = setFieldValue(item.field, value);
			if (didFill) {
				filled += 1;
			}
		}

		emitScoreDebugEvent({
			field: describeField(item.field),
			matchedKey: item.inference.key,
			score: item.inference.score,
			threshold: MIN_SCORE,
			passesThreshold,
			filled: didFill,
			reasons: item.inference.reasons || [],
			valuePreview: maskValuePreview(item.inference.key, value)
		});
	}

	return { filled };
}

async function readUserData() {
	const result = await storageGet(STORAGE_KEY);
	return result[STORAGE_KEY] || null;
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

function collectCandidateFields() {
	return Array.from(document.querySelectorAll("input, select, textarea"))
		.filter((field) => !field.disabled)
		.filter((field) => !field.readOnly)
		.filter((field) => {
			if (!(field instanceof HTMLElement)) {
				return false;
			}

			if (field instanceof HTMLInputElement) {
				const type = (field.type || "").toLowerCase();
				if (["hidden", "password", "file", "submit", "button", "reset"].includes(type)) {
					return false;
				}
			}

			if (String(field.value || "").trim()) {
				return false;
			}

			return !looksProtected(field);
		});
}

function looksProtected(field) {
	const attrs = [
		field.getAttribute("name"),
		field.getAttribute("id"),
		field.getAttribute("aria-label"),
		field.getAttribute("placeholder"),
		field.getAttribute("autocomplete")
	]
		.filter(Boolean)
		.map(normalizeText)
		.join(" ");

	return PROTECTED_HINTS.some((hint) => attrs.includes(hint));
}

function inferField(field) {
	const signals = buildSignals(field);
	let best = null;

	for (const def of FIELD_DEFINITIONS) {
		const scoreResult = scoreField(def, field, signals);
		if (!best || scoreResult.score > best.score) {
			best = { key: def.key, score: scoreResult.score, reasons: scoreResult.reasons };
		}
	}

	return best;
}

function buildSignals(field) {
	const autocomplete = normalizeText(field.getAttribute("autocomplete") || "");
	const name = normalizeText(field.getAttribute("name") || "");
	const id = normalizeText(field.getAttribute("id") || "");
	const placeholder = normalizeText(field.getAttribute("placeholder") || "");
	const aria = normalizeText(field.getAttribute("aria-label") || "");
	const type = normalizeText(field.getAttribute("type") || "");

	const labelText = normalizeText(resolveLabelText(field));

	return {
		autocomplete,
		name,
		id,
		placeholder,
		aria,
		labelText,
		type
	};
}

function scoreField(def, field, signals) {
	let score = 0;
	const reasons = [];

	function addPoints(points, source, keyword) {
		score += points;
		reasons.push({ points, source, keyword: keyword || "" });
	}

	if (signals.type === "email" && def.key === "email") {
		addPoints(50, "type", "email");
	}

	if (signals.type === "tel" && def.key === "phone") {
		addPoints(25, "type", "tel");
	}

	if (signals.autocomplete && def.autocomplete.some((token) => signals.autocomplete.includes(token))) {
		addPoints(50, "autocomplete", signals.autocomplete);
	}

	for (const keyword of def.keywords) {
		if (containsToken(signals.name, keyword)) {
			addPoints(40, "name", keyword);
		}

		if (containsToken(signals.id, keyword)) {
			addPoints(30, "id", keyword);
		}

		if (containsToken(signals.labelText, keyword)) {
			addPoints(30, "label", keyword);
		}

		if (containsToken(signals.placeholder, keyword) || containsToken(signals.aria, keyword)) {
			addPoints(20, "placeholder_or_aria", keyword);
		}
	}

	if (def.key === "cpf" && field instanceof HTMLInputElement) {
		const maxLen = Number(field.maxLength || 0);
		if ([11, 14].includes(maxLen)) {
			addPoints(10, "maxlength", String(maxLen));
		}
	}

	if (def.key === "cep" && field instanceof HTMLInputElement) {
		const maxLen = Number(field.maxLength || 0);
		if ([8, 9].includes(maxLen)) {
			addPoints(10, "maxlength", String(maxLen));
		}
	}

	return { score, reasons };
}

function resolveLabelText(field) {
	const directLabels = field.labels ? Array.from(field.labels) : [];
	if (directLabels.length > 0) {
		return directLabels.map((label) => label.textContent || "").join(" ");
	}

	const parentLabel = field.closest("label");
	if (parentLabel) {
		return parentLabel.textContent || "";
	}

	return "";
}

function resolveValue(fieldKey, field, userData, hasSplitName) {
	const birth = splitBirthDate(userData.birthDate || userData.birthDateBr || "");

	switch (fieldKey) {
		case "fullName":
			if (hasSplitName) {
				return "";
			}
			return userData.fullName || [userData.firstName, userData.lastName].filter(Boolean).join(" ").trim();
		case "firstName":
			return userData.firstName || "";
		case "lastName":
			return userData.lastName || "";
		case "email":
			return userData.email || "";
		case "cpf":
			return wantsRawDigits(field) ? userData.cpfRaw || "" : userData.cpf || userData.cpfRaw || "";
		case "rg":
			return userData.rg || "";
		case "phone":
			return wantsRawDigits(field) ? userData.phoneRaw || "" : userData.phone || userData.phoneRaw || "";
		case "cep":
			return wantsRawDigits(field) ? userData.cepRaw || "" : userData.cep || userData.cepRaw || "";
		case "street":
			return userData.street || "";
		case "number":
			return userData.number || "";
		case "complement":
			return userData.complement || "";
		case "district":
			return userData.district || "";
		case "city":
			return userData.city || "";
		case "state":
			return chooseStateValue(field, userData);
		case "birthDate":
			if (field instanceof HTMLInputElement && field.type === "date") {
				return userData.birthDate || "";
			}
			return userData.birthDateBr || "";
		case "birthDay":
			return birth.day;
		case "birthMonth":
			return birth.month;
		case "birthYear":
			return birth.year;
		default:
			return "";
	}
}

function splitBirthDate(value) {
	if (!value) {
		return { day: "", month: "", year: "" };
	}

	if (value.includes("-")) {
		const [year, month, day] = value.split("-");
		return { day: day || "", month: month || "", year: year || "" };
	}

	if (value.includes("/")) {
		const [day, month, year] = value.split("/");
		return { day: day || "", month: month || "", year: year || "" };
	}

	return { day: "", month: "", year: "" };
}

function chooseStateValue(field, userData) {
	if (field instanceof HTMLSelectElement) {
		return userData.stateCode || userData.stateName || "";
	}

	if (field instanceof HTMLInputElement && Number(field.maxLength) > 0 && field.maxLength <= 2) {
		return userData.stateCode || "";
	}

	return userData.stateName || userData.stateCode || "";
}

function wantsRawDigits(field) {
	if (!(field instanceof HTMLInputElement)) {
		return false;
	}

	const type = (field.type || "").toLowerCase();
	if (type === "number") {
		return true;
	}

	const maxLen = Number(field.maxLength || 0);
	if (maxLen > 0 && maxLen <= 11) {
		return true;
	}

	const pattern = normalizeText(field.getAttribute("pattern") || "");
	if (/[\.\-()\s]/.test(pattern)) {
		return false;
	}

	return pattern.includes("\\d");
}

function setFieldValue(field, value) {
	if (!value) {
		return false;
	}

	if (field instanceof HTMLSelectElement) {
		return setSelectValue(field, value);
	}

	field.value = String(value);
	triggerFieldEvents(field);
	return true;
}

function setSelectValue(select, targetValue) {
	const normalizedTarget = normalizeText(targetValue);
	const options = Array.from(select.options);
	const candidate =
		options.find((option) => normalizeText(option.value) === normalizedTarget) ||
		options.find((option) => normalizeText(option.textContent || "") === normalizedTarget) ||
		options.find((option) => normalizeText(option.value).includes(normalizedTarget)) ||
		options.find((option) => normalizeText(option.textContent || "").includes(normalizedTarget));

	if (!candidate) {
		return false;
	}

	select.value = candidate.value;
	triggerFieldEvents(select);
	return true;
}

function triggerFieldEvents(field) {
	field.dispatchEvent(new Event("input", { bubbles: true }));
	field.dispatchEvent(new Event("change", { bubbles: true }));
	field.dispatchEvent(new Event("blur", { bubbles: true }));
}

function emitScoreDebugEvent(payload) {
	try {
		document.dispatchEvent(new CustomEvent(DEBUG_EVENT_NAME, { detail: payload }));
	} catch (_error) {
		// Ignore debug event errors because they do not impact autofill behavior.
	}
}

function describeField(field) {
	return {
		tag: field.tagName ? field.tagName.toLowerCase() : "",
		type: field instanceof HTMLInputElement ? String(field.type || "") : "",
		name: String(field.getAttribute("name") || ""),
		id: String(field.getAttribute("id") || ""),
		autocomplete: String(field.getAttribute("autocomplete") || ""),
		placeholder: String(field.getAttribute("placeholder") || ""),
		label: String(resolveLabelText(field) || "").replace(/\s+/g, " ").trim().slice(0, 120)
	};
}

function maskValuePreview(fieldKey, value) {
	if (!value) {
		return "";
	}

	if (["cpf", "rg", "phone", "cep"].includes(fieldKey)) {
		const digits = String(value).replace(/\D+/g, "");
		if (!digits) {
			return "***";
		}
		if (digits.length <= 3) {
			return "*".repeat(digits.length);
		}
		return `${"*".repeat(digits.length - 3)}${digits.slice(-3)}`;
	}

	if (fieldKey === "email") {
		const [local, domain] = String(value).split("@");
		if (!domain) {
			return "***";
		}
		const localPreview = (local || "").slice(0, 2);
		return `${localPreview}***@${domain}`;
	}

	const asText = String(value);
	if (asText.length <= 40) {
		return asText;
	}

	return `${asText.slice(0, 37)}...`;
}

function normalizeText(value) {
	return String(value || "")
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/\s+/g, " ")
		.trim();
}

function containsToken(text, token) {
	if (!text || !token) {
		return false;
	}

	const normalizedText = ` ${normalizeText(text)} `;
	const normalizedToken = ` ${normalizeText(token)} `;
	return normalizedText.includes(normalizedToken);
}

function observeDynamicForms() {
	const observer = new MutationObserver((mutations) => {
		const hasFieldMutation = mutations.some((mutation) => {
			if (mutation.type !== "childList") {
				return false;
			}

			return Array.from(mutation.addedNodes).some((node) => {
				if (!(node instanceof HTMLElement)) {
					return false;
				}

				if (node.matches?.("input, select, textarea")) {
					return true;
				}

				return Boolean(node.querySelector?.("input, select, textarea"));
			});
		});

		if (!hasFieldMutation) {
			return;
		}

		if (debounceHandle) {
			clearTimeout(debounceHandle);
		}

		debounceHandle = setTimeout(() => {
			runAutofill();
		}, RECHECK_DELAY_MS);
	});

	observer.observe(document.documentElement, { childList: true, subtree: true });
}
