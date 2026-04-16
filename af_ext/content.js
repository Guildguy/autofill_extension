// @ts-nocheck
(() => {
    const STORAGE_KEY = AutofillShared.STORAGE_KEY;
    const MIN_SCORE = AutofillShared.MIN_SCORE;
    const RECHECK_DELAY_MS = AutofillShared.RECHECK_DELAY_MS;
    const DEBUG_EVENT_NAME = AutofillShared.DEBUG_EVENT_NAME;
    const extApi = typeof browser !== "undefined" ? browser : chrome;
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
            return { filled: 0 };
        }
        const targets = collectCandidateFields();
        const evaluations = targets
            .map((field) => ({ field, inference: AutofillAutofillCore.inferField(field) }))
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
            return !AutofillAutofillCore.looksProtected(field);
        });
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
        const candidate = options.find((option) => normalizeText(option.value) === normalizedTarget) ||
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
})();
//# sourceMappingURL=content.js.map