import * as vscode from "vscode";
import { importTranslations } from "../../projectManager/translationImporter";
import { FileType } from "../../../types";
import { importSourceText } from "../../projectManager/sourceTextImporter";

function getNonce(): string {
    let text = "";
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
export class SourceUploadProvider
    implements vscode.TextDocumentContentProvider, vscode.CustomTextEditorProvider
{
    public static readonly viewType = "sourceUploadProvider";
    onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
    onDidChange = this.onDidChangeEmitter.event;
    private fileSystemWatcher: vscode.FileSystemWatcher | undefined;
    private refreshDebounceTimeout: NodeJS.Timeout | undefined;
    private watchedFiles: Set<string> = new Set();

    constructor(private readonly context: vscode.ExtensionContext) {
        this.setupFileSystemWatcher();
    }

    private setupFileSystemWatcher() {
        this.fileSystemWatcher = vscode.workspace.createFileSystemWatcher("**/*.{source,codex}");
        this.fileSystemWatcher.onDidCreate(this.handleFileCreated.bind(this));
        this.fileSystemWatcher.onDidDelete(this.handleFileDeleted.bind(this));
        this.fileSystemWatcher.onDidChange(this.handleFileChanged.bind(this));
    }

    private handleFileCreated(uri: vscode.Uri) {
        const filePath = uri.fsPath;
        if (!this.watchedFiles.has(filePath)) {
            this.watchedFiles.add(filePath);
            this.refreshWebview(`[handleFileCreated] ${filePath} created`);
        }
    }

    private handleFileDeleted(uri: vscode.Uri) {
        const filePath = uri.fsPath;
        if (this.watchedFiles.has(filePath)) {
            this.watchedFiles.delete(filePath);
            this.refreshWebview(`[handleFileDeleted] ${filePath} deleted`);
        }
    }

    private handleFileChanged(uri: vscode.Uri) {
        const filePath = uri.fsPath;
        if (this.watchedFiles.has(filePath)) {
            this.refreshWebview(`[handleFileChanged] ${filePath} changed`);
        }
    }

    private refreshWebview(callingSignature: string) {
        console.log("Refreshing webview due to file change", callingSignature);
        if (this.refreshDebounceTimeout) {
            clearTimeout(this.refreshDebounceTimeout);
        }
        this.refreshDebounceTimeout = setTimeout(() => {
            vscode.commands.executeCommand("workbench.action.webview.reloadWebviewAction");
        }, 1000);
    }

    public async resolveCustomDocument(
        document: vscode.CustomDocument,
        cancellationToken: vscode.CancellationToken
    ): Promise<void> {}

    provideTextDocumentContent(uri: vscode.Uri): string {
        return "Source Upload Provider Content";
    }

    async openCustomDocument(
        uri: vscode.Uri,
        openContext: vscode.CustomDocumentOpenContext,
        token: vscode.CancellationToken
    ): Promise<vscode.CustomDocument> {
        return { uri, dispose: () => {} };
    }

    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.context.extensionUri],
        };

        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

        webviewPanel.webview.onDidReceiveMessage(async (message) => {
            const sourceFiles = await vscode.workspace.findFiles("**/*.source");
            const targetFiles = await vscode.workspace.findFiles("**/*.codex");
            switch (message.command) {
                case "getCodexFiles":
                    webviewPanel.webview.postMessage({
                        command: "updateCodexFiles",
                        sourceFiles: sourceFiles.map((uri) => ({
                            name: uri.fsPath.split("/").pop(),
                            uri: uri.toString(),
                        })),
                        targetFiles: targetFiles.map((uri) => ({
                            name: uri.fsPath.split("/").pop(),
                            uri: uri.toString(),
                        })),
                    });
                    break;
                case "uploadSourceText":
                    try {
                        const fileUri = await this.saveUploadedFile(
                            message.fileContent,
                            message.fileName
                        );
                        await importSourceText(this.context, fileUri);
                        vscode.window.showInformationMessage("Source text uploaded successfully.");
                        this.refreshWebview(`[uploadSourceText] ${message.fileName}`);
                    } catch (error) {
                        console.error(`Error uploading source text: ${error}`);
                        vscode.window.showErrorMessage(`Error uploading source text: ${error}`);
                    }
                    break;
                case "uploadTranslation":
                    console.log("uploadTranslation message in provider", message);
                    try {
                        const fileUri = await this.saveUploadedFile(
                            message.fileContent,
                            message.fileName
                        );
                        await importTranslations(this.context, fileUri, message.sourceFileName);
                        vscode.window.showInformationMessage("Translation uploaded successfully.");
                        this.refreshWebview(`[uploadTranslation] ${message.fileName}`);
                    } catch (error) {
                        console.error(`Error uploading translation: ${error}`);
                        vscode.window.showErrorMessage(`Error uploading translation: ${error}`);
                    }
                    break;
            }
        });
    }

    private async saveUploadedFile(content: string, fileName: string): Promise<vscode.Uri> {
        const tempDirUri = vscode.Uri.joinPath(this.context.globalStorageUri, "temp");
        await vscode.workspace.fs.createDirectory(tempDirUri);
        const fileUri = vscode.Uri.joinPath(tempDirUri, fileName);
        await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, "utf8"));
        return fileUri;
    }

    private getHtmlForWebview(webview: vscode.Webview): string {
        const styleResetUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, "src", "assets", "reset.css")
        );
        const styleVSCodeUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, "src", "assets", "vscode.css")
        );
        const codiconsUri = webview.asWebviewUri(
            vscode.Uri.joinPath(
                this.context.extensionUri,
                "node_modules",
                "@vscode/codicons",
                "dist",
                "codicon.css"
            )
        );
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(
                this.context.extensionUri,
                "webviews",
                "codex-webviews",
                "dist",
                "SourceUpload",
                "index.js"
            )
        );

        const nonce = getNonce();
        return /*html*/ `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; worker-src ${webview.cspSource}; img-src ${webview.cspSource} https:; font-src ${webview.cspSource};">
                <link href="${styleResetUri}" rel="stylesheet" nonce="${nonce}">
                <link href="${styleVSCodeUri}" rel="stylesheet" nonce="${nonce}">
                <link href="${codiconsUri}" rel="stylesheet" nonce="${nonce}" />
                <title>Codex Uploader</title>
            </head>
            <body>
                <div id="root"></div>
                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
    }
}
