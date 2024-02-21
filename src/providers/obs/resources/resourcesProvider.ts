import path from "node:path";
import * as vscode from "vscode";
import { MessageType } from "../CreateProject/types";
import { downloadResource } from "./functions/download";
import {
    addDownloadedResourceToProjectConfig,
    getDownloadedResourcesFromProjectConfig,
} from "./functions/projectConfig";
import {
    openBible,
    openOBS,
    openTn,
    openTranslationHelper,
} from "./functions/openResource";
import { getUri } from "../CreateProject/utilities/getUri";
import { getNonce } from "../CreateProject/utilities/getNonce";
import { DownloadedResource, OpenResource } from "./types";
import { VIEW_TYPES } from "../utilities";

export class ResourcesProvider implements vscode.WebviewViewProvider {
    private _webviewView: vscode.WebviewView | undefined;
    private _context: vscode.ExtensionContext | undefined;
    public static register(
        context: vscode.ExtensionContext,
    ): vscode.Disposable {
        const provider = new ResourcesProvider(context);
        const providerRegistration = vscode.window.registerWebviewViewProvider(
            ResourcesProvider.viewType,
            provider,
        );
        return providerRegistration;
    }

    public static async initProjectResources(context: vscode.ExtensionContext) {
        const resources = await getDownloadedResourcesFromProjectConfig();
        context.workspaceState.update("downloadedResources", resources);
    }

    private static readonly viewType = "scribe-vsc.obs-resources";

    constructor(private readonly context: vscode.ExtensionContext) {
        this._context = context;
        this._registerCommands();
    }

    public async resolveWebviewView(
        webviewPanel: vscode.WebviewView,
        ctx: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ): Promise<void> {
        webviewPanel.webview.options = {
            enableScripts: true,
        };
        webviewPanel.webview.html = this._getWebviewContent(
            webviewPanel.webview,
            this.context.extensionUri,
        );

        const disposable = vscode.window.tabGroups.onDidChangeTabs((e) => {
            this.syncDownloadedResources();
        });

        this._context?.subscriptions.push(disposable);

        // Receive message from the webview.
        webviewPanel.webview.onDidReceiveMessage(
            async (e: { type: MessageType; payload: unknown }) => {
                switch (e.type) {
                    case MessageType.DOWNLOAD_RESOURCE: {
                        const context = this._context;
                        if (!context) {
                            vscode.window.showErrorMessage(
                                "No workspace opened as no context found!",
                            );
                            return;
                        }
                        const downloadedResourceInfo = await downloadResource(
                            (e.payload as any)?.resource as any,
                        );
                        const downloadedResource: DownloadedResource = {
                            name: downloadedResourceInfo.resource.name,
                            id: downloadedResourceInfo.resource.id,
                            localPath: path.relative(
                                vscode.workspace.workspaceFolders?.[0].uri
                                    .path ?? "",
                                downloadedResourceInfo.folder.path,
                            ),
                            type: downloadedResourceInfo.resourceType,
                            remoteUrl: downloadedResourceInfo.resource.url,
                            version:
                                downloadedResourceInfo.resource.release
                                    .tag_name,
                        };

                        await addDownloadedResourceToProjectConfig(
                            downloadedResource,
                        );

                        const allDownloadedResources =
                            (context?.workspaceState.get(
                                "downloadedResources",
                            ) ?? []) as DownloadedResource[];

                        const newDownloadedResources: DownloadedResource[] = [
                            ...allDownloadedResources,
                            downloadedResource,
                        ];

                        await context.workspaceState.update(
                            "downloadedResources",
                            newDownloadedResources,
                        );
                        await this.syncDownloadedResources();
                        break;
                    }
                    case MessageType.OPEN_RESOURCE:
                        console.log("Opening resource: ", e.payload);
                        this._openResource((e.payload as any)?.resource as any);
                        break;

                    case MessageType.SYNC_DOWNLOADED_RESOURCES:
                        await this.syncDownloadedResources().then(() => {
                            console.log(
                                "Downloaded resources synced! From the action!",
                            );
                        });
                        break;
                    default:
                        break;
                }
            },
        );
        this.syncDownloadedResources().then(() => {
            console.log("Downloaded resources synced!");
        });

        this._webviewView = webviewPanel;
    }

    public revive(panel: vscode.WebviewView) {
        this._webviewView = panel;
    }

    private async _registerCommands() {
        const commands: {
            command: string;
            title: string;
            handler: (...args: any[]) => any;
        }[] = [];

        const registeredCommands = await vscode.commands.getCommands();

        commands.forEach((command) => {
            if (!registeredCommands.includes(command.command)) {
                this._context?.subscriptions.push(
                    vscode.commands.registerCommand(
                        command.command,
                        command.handler,
                    ),
                );
            }
        });
    }

    private _getWebviewContent(
        webview: vscode.Webview,
        extensionUri: vscode.Uri,
    ) {
        // The CSS file from the React build output

        const stylesUri = getUri(webview, extensionUri, [
            "webviews",
            "obs",
            "build",
            "assets",
            "index.css",
        ]);
        // The View JS file from the React build output
        const scriptUri = getUri(webview, extensionUri, [
            "webviews",
            "obs",
            "build",
            "assets",
            "views",
            "Resources.js",
        ]);

        const nonce = getNonce();

        // Tip: Install the es6-string-html VS Code extension to enable code highlighting below
        return /*html*/ `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <!-- <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';"> -->
          <link rel="stylesheet" type="text/css" href="${stylesUri}">
          <title>Sidebar vscode obs Resources</title>
        </head>
        <body>
          <div id="root"></div>
          <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
        </body>
      </html>
    `;
    }

    private async _openResource(resource: DownloadedResource) {
        const openResources = (this._context?.workspaceState.get(
            "openResources",
            [],
        ) ?? []) as OpenResource[];

        // Enable this when we track the closing of tabs
        // if (openResources.find((r) => r.id === resource.id)) {
        //   vscode.window.showInformationMessage("Resource already opened!");
        //   return;
        // }

        // open resource
        let newViewCol: vscode.ViewColumn | undefined =
            vscode.ViewColumn.Beside;

        const currentStoryId: string | undefined =
            this._context?.workspaceState.get("currentStoryId");

        switch (resource.type) {
            case "obs":
                newViewCol = (await openOBS(resource, currentStoryId))
                    ?.viewColumn;
                break;
            case "bible":
                newViewCol = (await openBible(resource))?.viewColumn;
                break;
            case "tn" || "obs-tn":
                newViewCol = (await openTn(resource))?.viewColumn;
                break;
            default:
                newViewCol = (await openTranslationHelper(resource))
                    ?.viewColumn;
                break;
        }

        const newResources = [
            ...openResources,
            { ...resource, viewColumn: newViewCol },
        ];
        // save to workspace state
        await this._context?.workspaceState.update(
            "openResources",
            newResources,
        );

        const updatedResources = (this._context?.workspaceState.get(
            "openResources",
            [],
        ) ?? []) as OpenResource[];

        console.log("Updated resources: ", updatedResources);

        return {
            viewColumn: newViewCol,
        };
    }

    public static async syncOpenResourcesWithStory(
        context: vscode.ExtensionContext,
        storyId: string,
    ) {
        const openResources = (context?.workspaceState.get(
            "openResources",
            [],
        ) ?? []) as OpenResource[];

        // TODO: Add the filter when downloading all resources
        // const obsResources = openResources.filter(
        //   (resource) => resource.type === "obs"
        // );

        openResources.forEach(async (resource) => {
            const workspaceRootUri = vscode.workspace.workspaceFolders?.[0].uri;

            if (!workspaceRootUri) {
                return;
            }

            const resourceRootUri = workspaceRootUri?.with({
                path: vscode.Uri.joinPath(
                    workspaceRootUri,
                    ".scribe/resources",
                    resource.name,
                ).path,
            });

            const resourceStoryUri = vscode.Uri.joinPath(
                resourceRootUri,
                "content",
                `${storyId}.md`,
            );

            await vscode.commands.executeCommand(
                "vscode.openWith",
                resourceStoryUri,
                VIEW_TYPES.EDITOR, // use resource type to load the according view
                {
                    viewColumn: resource.viewColumn ?? vscode.ViewColumn.Beside,
                    preview: true,
                },
            );
        });
    }

    syncDownloadedResources = async () => {
        const context = this._context;
        const webviewPanel = this._webviewView;
        if (!context) {
            vscode.window.showErrorMessage(
                "No workspace opened as no context found!",
            );
            return;
        }
        const downloadedResources = (context?.workspaceState.get(
            "downloadedResources",
        ) ?? []) as DownloadedResource[];

        if (!webviewPanel?.webview) {
            console.log("Webview not found!");
        }

        await ResourcesProvider.initProjectResources(context);

        await webviewPanel?.webview.postMessage({
            type: MessageType.SYNC_DOWNLOADED_RESOURCES,
            payload: { downloadedResources },
        });
    };
}
