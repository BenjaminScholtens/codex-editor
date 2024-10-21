import * as vscode from "vscode";
import { registerTextSelectionHandler } from "./handlers/textSelectionHandler";
import { registerReferencesCodeLens } from "./referencesCodeLensProvider";
import { registerSourceCodeLens } from "./sourceCodeLensProvider";
import { indexVerseRefsInSourceText } from "./commands/indexVrefsCommand";
import { registerProviders } from "./providers/registerProviders";
import { registerCommands } from "./activationHelpers/contextAware/commands";
import { initializeWebviews } from "./activationHelpers/contextAware/webviewInitializers";
import { registerCompletionsCodeLensProviders } from "./activationHelpers/contextAware/completionsCodeLensProviders";
import { initializeBibleData } from "./activationHelpers/contextAware/sourceData";
import { registerLanguageServer } from "./tsServer/registerLanguageServer";
import { registerClientCommands } from "./tsServer/registerClientCommands";
import registerClientOnRequests from "./tsServer/registerClientOnRequests";
import { registerSmartEditCommands } from "./smartEdits/registerSmartEditCommands";
import { LanguageClient } from "vscode-languageclient/node";
import { registerProjectManager } from "./projectManager";
import {
    temporaryMigrationScript_checkMatthewNotebook,
    migration_changeDraftFolderToFilesFolder,
} from "./projectManager/utils/migrationUtils";
import { createIndexWithContext } from "./activationHelpers/contextAware/miniIndex/indexes";
import { registerSourceUploadCommands } from "./providers/SourceUpload/registerCommands";
import { migrateSourceFiles } from "./utils/codexNotebookUtils";
import { VideoEditorProvider } from "./providers/VideoEditor/VideoEditorProvider";
import { registerVideoPlayerCommands } from "./providers/VideoPlayer/registerCommands";
import { SourceUploadProvider } from "./providers/SourceUpload/SourceUploadProvider";
import { StatusBarItem } from "vscode";

let client: LanguageClient | undefined;
let clientCommandsDisposable: vscode.Disposable;
let autoCompleteStatusBarItem: StatusBarItem;

export async function activate(context: vscode.ExtensionContext) {
    vscode.workspace.getConfiguration().update("workbench.startupEditor", "none", true);

    const fs = vscode.workspace.fs;
    const workspaceFolders = vscode.workspace.workspaceFolders;

    // Always register the project manager
    registerProjectManager(context);

    if (workspaceFolders && workspaceFolders.length > 0) {
        const metadataUri = vscode.Uri.joinPath(workspaceFolders[0].uri, "metadata.json");

        let metadataExists = false;
        try {
            await fs.stat(metadataUri);
            metadataExists = true;
        } catch {
            metadataExists = false;
        }

        if (!metadataExists) {
            console.log("metadata.json not found. Waiting for initialization.");
            await watchForInitialization(context, metadataUri);
        } else {
            await initializeExtension(context, metadataExists);
        }
    } else {
        console.log("No workspace folder found");
        vscode.commands.executeCommand("codex-project-manager.showProjectOverview");
    }

    // Register these commands regardless of metadata existence
    registerVideoPlayerCommands(context);
    registerSmartEditCommands(context); // For the language server onRequest stuff
    await registerSourceUploadCommands(context);
    registerProviders(context);
    await registerCommands(context);
    await initializeWebviews(context);

    await executeCommandsAfter();
    await temporaryMigrationScript_checkMatthewNotebook();
    await migration_changeDraftFolderToFilesFolder();
    await migrateSourceFiles();

    // Create the status bar item
    autoCompleteStatusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
    );
    autoCompleteStatusBarItem.text = "$(sync~spin) Auto-completing...";
    autoCompleteStatusBarItem.hide();
    context.subscriptions.push(autoCompleteStatusBarItem);
}

async function initializeExtension(context: vscode.ExtensionContext, metadataExists: boolean) {
    console.log("Initializing extension");

    if (metadataExists) {
        console.log("metadata.json exists");
        vscode.commands.executeCommand("codex-project-manager.showProjectOverview");

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            const relativePattern = new vscode.RelativePattern(workspaceFolders[0], "**/*.codex");
            const codexNotebooksUris = await vscode.workspace.findFiles(relativePattern);
            if (codexNotebooksUris.length === 0) {
                vscode.commands.executeCommand("codex-project-manager.openSourceUpload");
            }
        } else {
            console.log("No workspace folder found");
        }

        registerCodeLensProviders(context);
        registerTextSelectionHandler(context, () => undefined);
        await initializeBibleData(context);

        client = await registerLanguageServer(context);

        if (client) {
            clientCommandsDisposable = registerClientCommands(context, client);
            await registerClientOnRequests(client); // So that the language server thread can interface with the main extension commands
            context.subscriptions.push(clientCommandsDisposable);
        }

        await indexVerseRefsInSourceText();
        await createIndexWithContext(context);
    } else {
        console.log("metadata.json not found. Showing project overview.");
        vscode.commands.executeCommand("codex-project-manager.showProjectOverview");
    }
}

let watcher: vscode.FileSystemWatcher | undefined;

async function watchForInitialization(context: vscode.ExtensionContext, metadataUri: vscode.Uri) {
    const fs = vscode.workspace.fs;
    watcher = vscode.workspace.createFileSystemWatcher("**/*");

    const checkInitialization = async () => {
        let metadataExists = false;
        try {
            await fs.stat(metadataUri);
            metadataExists = true;
        } catch {
            metadataExists = false;
        }

        if (metadataExists) {
            watcher?.dispose();
            await initializeExtension(context, metadataExists);
        }
    };

    watcher.onDidCreate(checkInitialization);
    watcher.onDidChange(checkInitialization);
    watcher.onDidDelete(checkInitialization);

    context.subscriptions.push(watcher);

    // Show project overview immediately, don't wait for metadata
    vscode.commands.executeCommand("codex-project-manager.showProjectOverview");
}

function registerCodeLensProviders(context: vscode.ExtensionContext) {
    registerReferencesCodeLens(context);
    registerSourceCodeLens(context);
    registerCompletionsCodeLensProviders(context);
}

async function executeCommandsAfter() {
    vscode.commands.executeCommand("workbench.action.focusAuxiliaryBar");
    vscode.commands.executeCommand("codexNotebookTreeView.refresh");
    vscode.commands.executeCommand("codex-editor-extension.setEditorFontToTargetLanguage");
}

export function deactivate() {
    if (clientCommandsDisposable) {
        clientCommandsDisposable.dispose();
    }
    if (client) {
        return client.stop();
    }
}

export function getAutoCompleteStatusBarItem(): StatusBarItem {
    return autoCompleteStatusBarItem;
}
