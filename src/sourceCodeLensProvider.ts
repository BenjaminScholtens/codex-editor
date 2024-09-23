import * as vscode from "vscode";
import { NOTEBOOK_TYPE } from "./utils/codexNotebookUtils";
import { extractVerseRefFromLine, findReferences, findVerseRef } from "./utils/verseRefUtils";
import { searchVerseRefPositionIndex } from "./commands/indexVrefsCommand";
const commandName = "showSource";
class ScriptureReferenceProvider {
    async provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.Definition | null> {
        const line = document.lineAt(position);
        const verseRef = extractVerseRefFromLine(line.text);
        if (!verseRef) {
            return null;
        }

        const references = await findReferences({ verseRef });
        if (!references) {
            return null;
        }

        return references.map(
            (filePath) => new vscode.Location(vscode.Uri.file(filePath), new vscode.Position(0, 0))
        );
    }
}

class SourceCodeLensProvider {
    private _onDidChangeCodeLenses: vscode.EventEmitter<void>;
    public onDidChangeCodeLenses: vscode.Event<void>;
    constructor() {
        this._onDidChangeCodeLenses = new vscode.EventEmitter();
        this.onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;
    }

    refresh() {
        this._onDidChangeCodeLenses.fire();
    }
    provideCodeLenses(
        document: vscode.TextDocument,
        token: vscode.CancellationToken
    ): vscode.CodeLens[] {
        const lenses: vscode.CodeLens[] = [];
        const activeEditor = vscode.window.activeTextEditor;
        if (
            activeEditor &&
            activeEditor.document.uri.toString() === document.uri.toString() &&
            !activeEditor.document.fileName.endsWith(".bible")
        ) {
            const cursorPosition = activeEditor.selection.active;
            const line = document.lineAt(cursorPosition.line);
            const verseRef = extractVerseRefFromLine(line.text);
            if (verseRef) {
                const range = new vscode.Range(
                    cursorPosition.line,
                    0,
                    cursorPosition.line,
                    line.text.length
                );
                lenses.push(
                    new vscode.CodeLens(range, {
                        title: "📖 Source",
                        command: `codex-editor-extension.${commandName}`,
                        arguments: [verseRef],
                    })
                );
            }
        }
        return lenses;
    }
}

const registerReferences = (context: vscode.ExtensionContext) => {
    const scriptureReferenceProvider = new SourceCodeLensProvider();
    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider(
            { language: "scripture" },
            scriptureReferenceProvider
        )
    );

    context.subscriptions.push(
        vscode.window.onDidChangeTextEditorSelection(() => scriptureReferenceProvider.refresh())
    );

    context.subscriptions.push(
        vscode.languages.registerDefinitionProvider(
            // { scheme: "file" }, // all files option
            ["scripture"],
            new ScriptureReferenceProvider()
        )
    );
    context.subscriptions.push(
        vscode.languages.registerDefinitionProvider(
            { notebookType: NOTEBOOK_TYPE }, // This targets notebook cells within "codex-type" notebooks
            new ScriptureReferenceProvider()
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            `codex-editor-extension.${commandName}`,
            (verseRef: string) => {
                if (verseRef) {
                    const results = searchVerseRefPositionIndex(verseRef);
                    if (!results || results.length < 1) {
                        vscode.window.showInformationMessage(`No references found for ${verseRef}`);
                        return;
                    }
                    // Create an array of vscode.Location objects for all results
                    const locations = results.map((result) => {
                        const uri = vscode.Uri.file(result.uri);
                        const range = new vscode.Range(
                            new vscode.Position(result.position.line, result.position.character),
                            new vscode.Position(result.position.line, result.position.character)
                        );
                        return new vscode.Location(uri, range);
                    });

                    // Check if there are any locations to show
                    if (locations.length > 0) {
                        const activeEditor = vscode.window.activeTextEditor;
                        if (activeEditor) {
                            vscode.commands.executeCommand(
                                "editor.action.peekLocations",
                                activeEditor.document.uri,
                                activeEditor.selection.start,
                                locations,
                                "peek"
                            );
                        }
                    } else {
                        vscode.window.showInformationMessage(`No references found for ${verseRef}`);
                    }
                } else {
                    vscode.window.showInformationMessage(`No references found for ${verseRef}`);
                }
            }
        )
    );
};

export { registerReferences as registerSourceCodeLens };
