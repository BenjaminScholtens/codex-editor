import * as vscode from "vscode";
import { CellIdGlobalState, SelectedTextDataWithContext, OBSRef } from "../types";
type StateStoreUpdate =
    | { key: "cellId"; value: CellIdGlobalState }
    | { key: "uri"; value: string | null }
    | { key: "currentLineSelection"; value: SelectedTextDataWithContext }
    | { key: "plainTextNotes"; value: string }
    | { key: "obsRef"; value: OBSRef }
    | { key: "apiKey"; value: string }
    | { key: "verseRef"; value: { verseRef: string; uri: string } }
    | { key: "cellId"; value: CellIdGlobalState };

type StateStoreKey = StateStoreUpdate["key"];
type StateStoreValue<K extends StateStoreKey> = Extract<StateStoreUpdate, { key: K }>["value"];

const extensionId = "project-accelerate.shared-state-store";

type DisposeFunction = () => void;
export async function initializeStateStore() {
    let storeListener: <K extends StateStoreKey>(
        keyForListener: K,
        callBack: (value: StateStoreValue<K> | undefined) => void
    ) => DisposeFunction = () => () => undefined;

    let updateStoreState: (update: StateStoreUpdate) => void = () => undefined;
    let getStoreState: <K extends StateStoreKey>(
        key: K
    ) => Promise<StateStoreValue<K> | undefined> = () => Promise.resolve(undefined);

    const extension = vscode.extensions.getExtension(extensionId);
    if (extension) {
        const api = await extension.activate();
        if (!api) {
            console.log(`Extension ${extensionId} does not expose an API.`);
        } else {
            storeListener = api.storeListener;

            updateStoreState = api.updateStoreState;
            getStoreState = api.getStoreState;
            return {
                storeListener,
                updateStoreState,
                getStoreState,
            };
        }
    }
    console.error(`Extension ${extensionId} not found.`);
    return {
        storeListener,
        updateStoreState,
        getStoreState,
    };
}
