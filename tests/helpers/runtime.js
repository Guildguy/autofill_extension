import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(process.cwd());

function readScript(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function createChromeMock(storageData, listeners) {
  const storage = { ...storageData };

  return {
    __storage: storage,
    runtime: {
      lastError: null,
      onMessage: {
        addListener(fn) {
          listeners.push(fn);
        }
      }
    },
    storage: {
      local: {
        get(key, callback) {
          const result = key ? { [key]: storage[key] } : { ...storage };
          if (typeof callback === "function") {
            callback(result);
            return;
          }
          return Promise.resolve(result);
        },
        set(value, callback) {
          Object.assign(storage, value || {});
          if (typeof callback === "function") {
            callback();
            return;
          }
          return Promise.resolve();
        }
      }
    }
  };
}

export function createRuntime({ html = "<!doctype html><html><body></body></html>", storageData = {} } = {}) {
  const dom = new JSDOM(html, {
    url: "https://example.com/form",
    runScripts: "outside-only"
  });

  const listeners = [];
  const chrome = createChromeMock(storageData, listeners);
  const context = dom.getInternalVMContext();

  context.chrome = chrome;
  context.browser = undefined;

  function loadScript(relativePath, expose = []) {
    const source = readScript(relativePath);
    const exposeCode = expose.map((name) => `globalThis.${name} = ${name};`).join("\n");
    const wrapped = `${source}\n${exposeCode}`;
    vm.runInContext(wrapped, context, { filename: relativePath });
  }

  async function flushTimers(ms = 0) {
    await new Promise((resolve) => {
      dom.window.setTimeout(resolve, ms);
    });
  }

  async function sendRuntimeMessage(message) {
    const listener = listeners[0];
    if (!listener) {
      return undefined;
    }

    return new Promise((resolve) => {
      let resolved = false;

      const maybeSyncResponse = listener(message, {}, (response) => {
        resolved = true;
        resolve(response);
      });

      if (maybeSyncResponse !== true && !resolved) {
        resolve(undefined);
      }
    });
  }

  return {
    dom,
    window: dom.window,
    document: dom.window.document,
    chrome,
    context,
    loadScript,
    flushTimers,
    sendRuntimeMessage
  };
}
