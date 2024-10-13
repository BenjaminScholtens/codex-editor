import type { WebviewApi } from "vscode-webview";
import { MessageType } from "../types";

class VSCodeAPIWrapper {
    private readonly vsCodeApi: WebviewApi<unknown> | undefined;

    constructor() {
        // Check if the acquireVsCodeApi function exists in the current development
        // context (i.e. VS Code development window or web browser)
        if (typeof acquireVsCodeApi === "function") {
            this.vsCodeApi = acquireVsCodeApi();
        }
    }

    /**
     * Post a message (i.e. send arbitrary data) to the owner of the webview.
     *
     * @remarks When running webview code inside a web browser, postMessage will instead
     * log the given message to the console.
     *
     * @param message Abitrary data (must be JSON serializable) to send to the extension context.
     */
    public postMessage(message: { readonly type: MessageType; readonly payload: unknown }) {
        if (this.vsCodeApi) {
            this.vsCodeApi.postMessage(message);
        }
    }

    public setMessageListeners(callback?: (event: MessageEvent) => void) {
        if (this.vsCodeApi) {
            window.addEventListener(
                "message",
                callback
                    ? callback
                    : (event) => {
                          const message = event.data; // The json data that the extension sent
                          switch (message.type) {
                              case MessageType.showDialog:
                                  return;
                          }
                      }
            );
        } else {
            console.error("NO VSCODE API FOUND");
        }
    }

    /**
     * Get the persistent state stored for this webview.
     *
     * @remarks When running webview source code inside a web browser, getState will retrieve state
     * from local storage (https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage).
     *
     * @return The current state or `undefined` if no state has been set.
     */
    public getState(): unknown | undefined {
        if (this.vsCodeApi) {
            return this.vsCodeApi.getState();
        } else {
            const state = localStorage.getItem("vscodeState");
            return state ? JSON.parse(state) : undefined;
        }
    }

    /**
     * Set the persistent state stored for this webview.
     *
     * @remarks When running webview source code inside a web browser, setState will set the given
     * state using local storage (https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage).
     *
     * @param newState New persisted state. This must be a JSON serializable object. Can be retrieved
     * using {@link getState}.
     *
     * @return The new state.
     */
    public setState<T extends unknown | undefined>(newState: T): T {
        if (this.vsCodeApi) {
            return this.vsCodeApi.setState(newState);
        } else {
            localStorage.setItem("vscodeState", JSON.stringify(newState));
            return newState;
        }
    }
}

// Exports class singleton to prevent multiple invocations of acquireVsCodeApi.
export const vscode = new VSCodeAPIWrapper();
