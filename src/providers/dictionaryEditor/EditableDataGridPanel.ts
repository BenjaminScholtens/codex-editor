import { Disposable, Webview, WebviewPanel, window, commands, Uri, ViewColumn, ExtensionContext, workspace } from "vscode";
import { getUri } from "../../utils/webviewUtils/getUri";
import { getNonce } from "../../utils/webviewUtils/getNonce";
import { Dictionary, DictionaryEntry } from 'codex-types';

export class EditableDataGridPanel {
  public static currentPanel: EditableDataGridPanel | undefined;
  private readonly _panel: WebviewPanel;
  private _disposables: Disposable[] = [];
  private _data: Dictionary;
  private _fileUri: Uri;

  private constructor(panel: WebviewPanel, extensionUri: Uri, fileUri: Uri) {
    this._panel = panel;
    this._data = { id: '', label: '', entries: [], metadata: {} };
    this._fileUri = fileUri;

    // Read the dictionary data from the file
    this.readDictionaryFile().then(data => {
      this._data = data;
      // Send initial data to webview
      this._panel.webview.postMessage({ command: 'setInitialData', data: this.formatDataForGrid(this._data.entries) });
    });

    // Set up the initial HTML content
    this._panel.webview.html = this._getWebviewContent(this._panel.webview, extensionUri);

    // Set up message passing
    this._setUpMessageListener();

    // Set an event listener to listen for when the panel is disposed
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  public static async render(extensionUri: Uri) {
    const workspaceFolders = workspace.workspaceFolders;
    if (!workspaceFolders) {
      window.showErrorMessage("No workspace folder found.");
      return;
    }

    const fileUri = Uri.joinPath(workspaceFolders[0].uri, 'files', 'project.dictionary');

    if (EditableDataGridPanel.currentPanel) {
      EditableDataGridPanel.currentPanel._panel.reveal(ViewColumn.One);
    } else {
      const panel = window.createWebviewPanel(
        "showEditableDataGrid",
        "Editable Data Grid",
        ViewColumn.One,
        {
          enableScripts: true,
          localResourceRoots: [Uri.joinPath(extensionUri, "webviews", "codex-webviews", "dist", "DictionaryEditor")],
        }
      );

      EditableDataGridPanel.currentPanel = new EditableDataGridPanel(panel, extensionUri, fileUri);
    }
  }

  public async dispose() {
    EditableDataGridPanel.currentPanel = undefined;

    // Write the current data to the file before disposing
    await this.writeDictionaryFile();

    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  private _getWebviewContent(webview: Webview, extensionUri: Uri) {
    const webviewUri = getUri(webview, extensionUri, [
      "webviews",
      "codex-webviews",
      "dist",
      "DictionaryEditor",
      "index.js",
    ]);
    const nonce = getNonce();

    return /*html*/ `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${webview.cspSource} 'nonce-${nonce}'; style-src ${webview.cspSource} 'unsafe-inline';">
          <title>Dictionary Editor</title>
        </head>
        <body>
          <h1>Dictionary Editor</h1>
          <vscode-data-grid id="basic-grid"></vscode-data-grid>
          <script type="module" nonce="${nonce}" src="${webviewUri}"></script>
        </body>
      </html>
    `;
  }

  private _setUpMessageListener() {
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'getInitialData':
            this._panel.webview.postMessage({ command: 'setInitialData', data: this.formatDataForGrid(this._data.entries) });
            break;
          case 'updateData':
            this.updateDictionaryFromGrid(message.data);
            await this.writeDictionaryFile();
            break;
        }
      },
      null,
      this._disposables
    );
  }

  private async readDictionaryFile(): Promise<Dictionary> {
    try {
      const fileData = await workspace.fs.readFile(this._fileUri);
      const fileContent = new TextDecoder().decode(fileData);
      return JSON.parse(fileContent) as Dictionary;
    } catch (error) {
      console.error('Error reading dictionary file:', error);
      window.showErrorMessage('Failed to read dictionary file.');
      return { id: '', label: '', entries: [], metadata: {} };
    }
  }

  private async writeDictionaryFile() {
    try {
      const fileContent = JSON.stringify(this._data, null, 2);
      const fileData = new TextEncoder().encode(fileContent);
      await workspace.fs.writeFile(this._fileUri, fileData);
    } catch (error) {
      console.error('Error writing dictionary file:', error);
      window.showErrorMessage('Failed to write dictionary file.');
    }
  }

  private formatDataForGrid(entries: DictionaryEntry[]): any[] {
    return entries;
  }

  private updateDictionaryFromGrid(gridData: any[]) {
    this._data.entries = this._data.entries.map(entry => {
      const updatedEntry = gridData.find(item => item.id === entry.id);
      if (updatedEntry) {
        return {
          ...entry,
          headForm: updatedEntry.headForm,
          definition: updatedEntry.definition,
          // Update more fields as needed
        };
      }
      return entry;
    });
  }
}

export function registerDictionaryEditorProvider(context: ExtensionContext) {
  const showEditableDataGrid = commands.registerCommand(
    "editable-data-grid.showEditableDataGrid",
    () => {
      EditableDataGridPanel.render(context.extensionUri);
    }
  );

  context.subscriptions.push(showEditableDataGrid);
}