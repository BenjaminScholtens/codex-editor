import * as vscode from "vscode";
import { getUri } from "./utilities/getUri";
import { getNonce } from "./utilities/getNonce";
import { FileHandler } from './utilities/FileHandler';
import { Dictionary, DictionaryEntry } from "codex-types";
import { DictionarySummaryPostMessages } from "../../../types";

// Dictionary path constant
const dictionaryPath = "files/project.dictionary";

export class DictionarySummaryProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    public static readonly viewType = "dictionaryTable";
    private extensionUri: vscode.Uri;
    private lastSentDictionary: Dictionary;

    constructor(extensionUri: vscode.Uri) {
        this.extensionUri = extensionUri;
        this.setupFileChangeListener();
        this.lastSentDictionary = {
            id: '',
            label: '',
            entries: [],
            metadata: {},
        };

        // Register the command to update entry count
        vscode.commands.registerCommand('dictionaryTable.updateEntryCount', (count: number) => {
            this._view?.webview.postMessage({
                command: "updateEntryCount",
                count: count,
            } as DictionarySummaryPostMessages);
        });

        // Listen for dictionary updates
        vscode.commands.registerCommand('spellcheck.dictionaryUpdated', () => {
            this.refreshDictionary();
        });
    }

    private setupFileChangeListener() {
        vscode.workspace.onDidChangeTextDocument((event) => {
            if (event.document.uri.path.endsWith(dictionaryPath)) {
                this.updateWebviewData();
            }
        });
    }

    private async updateWebviewData() {
        const { data } = await FileHandler.readFile(dictionaryPath);
        let dictionary: Dictionary;
        if (!data) {
            dictionary = {
                id: '',
                label: '',
                entries: [],
                metadata: {},
            };
        } else {
            dictionary = this.parseDictionaryData(data);
        }

        // Add a check to prevent unnecessary updates
        if (JSON.stringify(this.lastSentDictionary) !== JSON.stringify(dictionary)) {
            this.lastSentDictionary = dictionary;
            this._view?.webview.postMessage({
                command: "providerSendsDataToWebview",
                data: dictionary,
            } as DictionarySummaryPostMessages);

            let wordFrequencies;
            try {
                wordFrequencies = await vscode.commands.executeCommand('translators-copilot.getWordFrequencies');
            } catch (error) {
                console.error('Error fetching word frequencies:', error);
                wordFrequencies = [];
            }
            this._view?.webview.postMessage({
                command: "providerSendsUpdatedWordFrequenciesToWebview",
                wordFrequencies: wordFrequencies,
            } as DictionarySummaryPostMessages);

            // Get frequent words
            const allFrequentWords = await vscode.commands.executeCommand('translators-copilot.getWordsAboveThreshold') as string[];

            // Filter out words that are already in the dictionary
            const existingWords = new Set(dictionary.entries.map(entry => entry.headWord.toLowerCase()));
            const newFrequentWords = allFrequentWords.filter(word => !existingWords.has(word.toLowerCase()));

            this._view?.webview.postMessage({
                command: "providerSendsFrequentWordsToWebview",
                words: newFrequentWords,
            } as DictionarySummaryPostMessages);
        }
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        token: vscode.CancellationToken,
    ): void | Thenable<void> {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri],
        };

        webviewView.webview.html = this.getWebviewContent(webviewView.webview);
        this.setWebviewMessageListener(webviewView.webview);
        this.updateWebviewData();
    }

    private getWebviewContent(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(
                this.extensionUri,
                "webviews",
                "codex-webviews",
                "dist",
                "DictionarySidePanel",
                "index.js"
            )
        );
        // const stylesUri = webview.asWebviewUri(
        //     vscode.Uri.joinPath(
        //         this.extensionUri,
        //         "webviews",
        //         "codex-webviews",
        //         "dist",
        //         "DictionarySidePanel",
        //         "index.css"
        //     )
        // );
        const codiconsUri = webview.asWebviewUri(
            vscode.Uri.joinPath(
                this.extensionUri,
                "node_modules",
                "@vscode/codicons",
                "dist",
                "codicon.css"
            )
        );

        const nonce = getNonce();

        return `
          <!DOCTYPE html>
          <html lang="en">
          <head>
              <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https:; font-src ${webview.cspSource};">
            <link href="${codiconsUri}" rel="stylesheet" />
              <title>Dictionary Table</title>
          </head>
          <body>
              <div id="root"></div>
              <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
          </body>
          </html>
        `;
    }

    private setWebviewMessageListener(webview: vscode.Webview) {
        webview.onDidReceiveMessage(
            async (message: DictionarySummaryPostMessages) => {
                switch (message.command) {
                    case "updateData": {
                        this.updateWebviewData();
                        return;
                    }
                    case "showDictionaryTable": {
                        vscode.commands.executeCommand("dictionaryTable.showDictionaryTable");
                        return;
                    }
                    case "refreshWordFrequency": {
                        vscode.window.showInformationMessage("Refreshing word frequency");
                        // Refresh the word index
                        await vscode.commands.executeCommand('translators-copilot.refreshWordIndex');
                        // Update the webview data
                        await this.updateWebviewData();
                        return;
                    }
                    case "addFrequentWordsToDictionary": {
                        const words = message.words;
                        for (const word of words) {
                            await vscode.commands.executeCommand('spellcheck.addToDictionary', word);
                        }
                        vscode.window.showInformationMessage(`Added ${words.length} words to the dictionary.`);

                        // Refresh the word index
                        await vscode.commands.executeCommand('translators-copilot.refreshWordIndex');

                        // Update the webview data
                        await this.updateWebviewData();
                        return;
                    }
                }
            },
            undefined,
            [],
        );
    }

    private parseDictionaryData(data: string): Dictionary {
        try {
            // Try parsing as JSONL first
            const entries = data
                .split('\n')
                .filter(line => line.trim().length > 0)
                .map(line => JSON.parse(line) as DictionaryEntry);
            return {
                id: '',
                label: '',
                entries,
                metadata: {},
            };
        } catch (jsonlError) {
            try {
                // If JSONL parsing fails, try parsing as a single JSON object
                const parsed = JSON.parse(data);
                if (Array.isArray(parsed.entries)) {
                    return parsed as Dictionary;
                } else {
                    throw new Error('Invalid JSON format: missing or invalid entries array.');
                }
            } catch (jsonError) {
                console.error("Could not parse dictionary as JSONL or JSON:", jsonError);
                return {
                    id: '',
                    label: '',
                    entries: [],
                    metadata: {},
                };
            }
        }
    }

    private refreshDictionary() {
        // Logic to refresh the dictionary view
        // For example, request the latest dictionary data from the server
        this.updateWebviewData();
    }
}
