// @ts-nocheck
(() => {
    const STORAGE_KEY = AutofillShared.STORAGE_KEY;
    const MIN_SCORE = AutofillShared.MIN_SCORE;
    const RECHECK_DELAY_MS = AutofillShared.RECHECK_DELAY_MS;
    const DEBUG_EVENT_NAME = AutofillShared.DEBUG_EVENT_NAME;
    const extApi = typeof browser !== "undefined" ? browser : chrome;
    const FORM_FIELD_SELECTOR = "input, select, textarea, [contenteditable='true'], [role='textbox'], [role='combobox']";
    let debounceHandle = null;
    init();
    function init() {
        runAutofill();
        observeDynamicForms();
        extApi.runtime.onMessage.addListener((message, _sender, sendResponse) => {
            if (message?.type !== AutofillShared.AUTOFILL_NOW_MESSAGE) {
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
            return { filled: 0, alreadyFilled: 0 };
        }
        const targets = collectCandidateFields();
        const prefilledTargets = collectPrefilledCandidateFields();
        const evaluations = targets
            .map((field) => ({ field, inference: AutofillAutofillCore.inferField(field) }))
            .filter((item) => item.inference);
        const prefilledEvaluations = prefilledTargets
            .map((field) => ({ field, inference: AutofillAutofillCore.inferField(field) }))
            .filter((item) => item.inference);
        const inferences = evaluations.filter((item) => item.inference.score >= MIN_SCORE);
        const alreadyFilled = prefilledEvaluations.filter((item) => item.inference.score >= MIN_SCORE).length;
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
            return { filled: 0, alreadyFilled };
        }
        const hasSplitName = inferences.some((item) => item.inference.key === "firstName") &&
            inferences.some((item) => item.inference.key === "lastName");
        let filled = 0;
        for (const item of evaluations) {
            const passesThreshold = item.inference.score >= MIN_SCORE;
            const value = passesThreshold
                ? AutofillAutofillCore.resolveValue(item.inference.key, item.field, userData, hasSplitName)
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
                valuePreview: AutofillTextCore.maskValuePreview(item.inference.key, value)
            });
        }
        return { filled, alreadyFilled };
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
        return collectFormFieldsDeep()
            .filter((field) => !field.disabled)
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
            if (!isFillableField(field)) {
                return false;
            }
            if (getFieldCurrentValue(field)) {
                return false;
            }
            return !AutofillAutofillCore.looksProtected(field);
        });
    }
    function collectPrefilledCandidateFields() {
        return collectFormFieldsDeep()
            .filter((field) => !field.disabled)
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
            if (!isFillableField(field)) {
                return false;
            }
            if (!getFieldCurrentValue(field)) {
                return false;
            }
            return !AutofillAutofillCore.looksProtected(field);
        });
    }
    function collectFormFieldsDeep() {
        const collected = [];
        const roots = [document];
        const seenRoots = new Set();
        const seenFields = new Set();
        while (roots.length > 0) {
            const root = roots.pop();
            if (!root || seenRoots.has(root)) {
                continue;
            }
            seenRoots.add(root);
            const scopedFields = root.querySelectorAll ? Array.from(root.querySelectorAll(FORM_FIELD_SELECTOR)) : [];
            for (const field of scopedFields) {
                if (!(field instanceof HTMLElement)) {
                    continue;
                }
                if (seenFields.has(field)) {
                    continue;
                }
                seenFields.add(field);
                collected.push(field);
            }
            const descendants = root.querySelectorAll ? Array.from(root.querySelectorAll("*")) : [];
            for (const element of descendants) {
                if (element.shadowRoot) {
                    roots.push(element.shadowRoot);
                }
            }
        }
        return collected;
    }
    function isFillableField(field) {
        if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
            return true;
        }
        const role = AutofillTextCore.normalizeText(field.getAttribute("role") || "");
        if (["textbox", "combobox"].includes(role)) {
            return true;
        }
        return field.getAttribute("contenteditable") === "true";
    }
    function getFieldCurrentValue(field) {
        if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
            return String(field.value || "").trim();
        }
        if (field.getAttribute("contenteditable") === "true") {
            return String(field.textContent || "").trim();
        }
        const ariaValueText = String(field.getAttribute("aria-valuetext") || "").trim();
        if (ariaValueText) {
            return ariaValueText;
        }
        return String(field.textContent || "").trim();
    }
    function setFieldValue(field, value) {
        if (!value) {
            return false;
        }
        if (field instanceof HTMLSelectElement) {
            return setSelectValue(field, value);
        }
        if (field instanceof HTMLTextAreaElement) {
            setNativeTextValue(field, String(value));
            triggerFieldEvents(field);
            return true;
        }
        if (field instanceof HTMLInputElement) {
            setNativeTextValue(field, String(value));
            const previousReadOnly = field.readOnly;
            if (previousReadOnly) {
                field.readOnly = false;
            }
            triggerFieldEvents(field);
            if (previousReadOnly) {
                field.readOnly = true;
            }
            return true;
        }
        if (field.getAttribute("contenteditable") === "true") {
            field.textContent = String(value);
            triggerFieldEvents(field);
            return true;
        }
        field.textContent = String(value);
        triggerFieldEvents(field);
        field.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
        return true;
    }
    function setNativeTextValue(field, value) {
        const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const valueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
        if (valueSetter) {
            valueSetter.call(field, value);
            return;
        }
        field.value = value;
    }
    function setSelectValue(select, targetValue) {
        const normalizedTarget = AutofillTextCore.normalizeText(targetValue);
        const options = Array.from(select.options);
        const candidate = options.find((option) => AutofillTextCore.normalizeText(option.value) === normalizedTarget) ||
            options.find((option) => AutofillTextCore.normalizeText(option.textContent || "") === normalizedTarget) ||
            options.find((option) => AutofillTextCore.normalizeText(option.value).includes(normalizedTarget)) ||
            options.find((option) => AutofillTextCore.normalizeText(option.textContent || "").includes(normalizedTarget));
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
        }
        catch (_error) {
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
            label: String(AutofillAutofillCore.resolveLabelText(field) || "").replace(/\s+/g, " ").trim().slice(0, 120)
        };
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
                    if (node.matches?.(FORM_FIELD_SELECTOR)) {
                        return true;
                    }
                    if (Boolean(node.querySelector?.(FORM_FIELD_SELECTOR))) {
                        return true;
                    }
                    return Boolean(node.shadowRoot?.querySelector?.(FORM_FIELD_SELECTOR));
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
})();
//# sourceMappingURL=content.js.map