import vscode from "vscode";
import { CodexCellEditorProvider } from "./providers/codexCellEditorProvider/codexCellEditorProvider";
import { CustomWebviewProvider } from "./providers/parallelPassagesWebview/customParallelPassagesWebviewProvider";
import { globalMessage } from "../types";

export class GlobalProvider {
    private static instance: GlobalProvider;
    private providers: Map<string, CodexCellEditorProvider | CustomWebviewProvider>;

    private constructor() {
        this.providers = new Map();
    }

    public static getInstance(): GlobalProvider {
        if (!GlobalProvider.instance) {
            GlobalProvider.instance = new GlobalProvider();
        }
        return GlobalProvider.instance;
    }

    public registerProvider(
        key: string,
        provider: CodexCellEditorProvider | CustomWebviewProvider
    ): void {
        this.providers.set(key, provider);
    }

    public postMessageToAllWebviews({
        command,
        targetContent,
        sourceContent,
        cellId,
        path,
    }: {
        command: string;
        targetContent?: string;
        sourceContent?: string;
        cellId?: string;
        path?: string;
    }): void {
        // Implement logic to post message to all webviews
        // This is a placeholder implementation
        const message: globalMessage = {
            command,
            targetContent,
            sourceContent,
            cellId,
            path,
        };
        console.log("Posting message to all webviews:", message);
        this.providers.forEach((provider, key) => {
            provider.postMessage(message);
        });
    }
    public async openWebview(key: string): Promise<void> {
        // This is only really relevant to panels
        try {
            // Check if the command exists before executing it
            const allCommands = await vscode.commands.getCommands();
            const focusCommand = `${key}.focus`;
            if (allCommands.includes(focusCommand)) {
                await vscode.commands.executeCommand(focusCommand);
            } else {
                console.warn(`Command '${focusCommand}' not found. Skipping focus.`);
            }
        } catch (error) {
            console.error(`Error opening webview: ${error}`);
        }
    }

    public async openAndPostMessageToWebview({
        key,
        command,
        targetContent,
        sourceContent,
        cellId,
        path,
    }: {
        key: string;
        command: string;
        targetContent?: string;
        sourceContent?: string;
        cellId?: string;
        path?: string;
    }): Promise<void> {
        const message: globalMessage = {
            command,
            targetContent,
            sourceContent,
            cellId,
            path,
        };
        await this.openWebview(key);
       
        // Check for it to be open
        if (this.providers.has(key)) {
            this.providers.get(key)?.postMessage(message);
            console.log(
                `post: Message posted to webview with key: ${key} and message: ${JSON.stringify(message)}`
            );
        } else {
            throw new Error(`Webview with key '${key}' not found.`);
        }
    }
}
