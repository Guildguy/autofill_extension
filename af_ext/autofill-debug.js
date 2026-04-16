// @ts-nocheck
(() => {
    const DEBUG_EVENT_NAME = AutofillShared.DEBUG_EVENT_NAME;
    const DEBUG_STORAGE_KEY = AutofillShared.DEBUG_STORAGE_KEY;
    const TOGGLE_SHORTCUT = AutofillShared.TOGGLE_SHORTCUT;
    const extApi = typeof browser !== "undefined" ? browser : chrome;
    let debugEnabled = false;
    bootDebugScript();
    async function bootDebugScript() {
        debugEnabled = hasDebugQueryParam() || (await readDebugFlag());
        applyDebugState(debugEnabled, "init");
        document.addEventListener("keydown", onToggleShortcut, true);
    }
    function hasDebugQueryParam() {
        const params = new URLSearchParams(window.location.search || "");
        return params.get("autofill_debug") === "1";
    }
    function onToggleShortcut(event) {
        if (!event.ctrlKey || !event.altKey || !event.shiftKey || event.code !== "KeyD") {
            return;
        }
        event.preventDefault();
        const nextState = !debugEnabled;
        applyDebugState(nextState, "shortcut");
        persistDebugFlag(nextState);
    }
    function applyDebugState(nextState, source) {
        debugEnabled = nextState;
        if (debugEnabled) {
            document.addEventListener(DEBUG_EVENT_NAME, onScoreEvent);
            console.info(`[AutoFill Debug] ativo (${source}). Atalho: ${TOGGLE_SHORTCUT}. Desative repetindo o atalho.`);
            return;
        }
        document.removeEventListener(DEBUG_EVENT_NAME, onScoreEvent);
        console.info(`[AutoFill Debug] desativado (${source}).`);
    }
    function onScoreEvent(event) {
        if (!debugEnabled) {
            return;
        }
        const detail = event.detail || {};
        const field = detail.field || {};
        const identity = field.name || field.id || field.placeholder || field.tag || "campo sem identificador";
        const key = detail.matchedKey || "sem correspondencia";
        const score = Number(detail.score || 0);
        const threshold = Number(detail.threshold || 0);
        console.groupCollapsed(`[AutoFill Score] ${identity} -> ${key} | score ${score}/${threshold} | fill ${detail.filled ? "sim" : "nao"}`);
        console.log("Campo:", field);
        console.log("Decisao:", {
            passesThreshold: Boolean(detail.passesThreshold),
            filled: Boolean(detail.filled),
            valuePreview: detail.valuePreview || ""
        });
        if (Array.isArray(detail.reasons) && detail.reasons.length > 0) {
            console.table(detail.reasons);
        }
        else {
            console.log("Sem razoes registradas para este campo.");
        }
        console.groupEnd();
    }
    async function readDebugFlag() {
        if (extApi.storage?.local?.get.length <= 1) {
            const data = await extApi.storage.local.get(DEBUG_STORAGE_KEY);
            return Boolean(data[DEBUG_STORAGE_KEY]);
        }
        return new Promise((resolve) => {
            extApi.storage.local.get(DEBUG_STORAGE_KEY, (data) => {
                if (extApi.runtime?.lastError) {
                    resolve(false);
                    return;
                }
                resolve(Boolean(data && data[DEBUG_STORAGE_KEY]));
            });
        });
    }
    async function persistDebugFlag(value) {
        const payload = { [DEBUG_STORAGE_KEY]: Boolean(value) };
        if (extApi.storage?.local?.set.length <= 1) {
            await extApi.storage.local.set(payload);
            return;
        }
        await new Promise((resolve) => {
            extApi.storage.local.set(payload, () => {
                resolve();
            });
        });
    }
})();
//# sourceMappingURL=autofill-debug.js.map