import * as vscode from "vscode";

export class FileHandler {
    // FIXME: I don't think this generic file handler should be here. We should probably refactor and look at other utils to come up with a standard way to do this, or else just rely on the vscode api to read files and handle errors.
    static async readFile(
        filePath: string
    ): Promise<{ data: string | undefined; uri: vscode.Uri | undefined }> {
        try {
            if (!vscode.workspace.workspaceFolders) {
                throw new Error("No workspace folder found");
            }
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0].uri;
            const metadataPath = vscode.Uri.joinPath(workspaceFolder, "metadata.json");

            if (await vscode.workspace.fs.stat(metadataPath)) {
                const fileUri = vscode.Uri.joinPath(workspaceFolder, filePath);
                let fileData;
                try {
                    fileData = await vscode.workspace.fs.readFile(fileUri);
                } catch (error) {
                    if ((error as Error).message.includes("ENOENT")) {
                        console.log("File does not exist, creating an empty file");
                        await vscode.workspace.fs.writeFile(fileUri, new TextEncoder().encode(""));
                        fileData = new Uint8Array();
                    } else {
                        console.error("Error message didn't include ENOENT");
                        throw error;
                    }
                }
                const data = new TextDecoder().decode(fileData);
                return { data, uri: fileUri };
            } else {
                throw new Error("metadata.json file not found in the workspace root");
            }
        } catch (error) {
            // vscode.window.showErrorMessage(`Error reading file: ${filePath}`);
            console.error("Error reading file in FileHandler:", { error });
            return { data: undefined, uri: undefined };
        }
    }

    static async writeFile(filePath: string, data: string): Promise<void> {
        try {
            if (!vscode.workspace.workspaceFolders) {
                throw new Error("No workspace folder found");
            }
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0].uri;
            const fileUri = vscode.Uri.joinPath(workspaceFolder, filePath);
            const fileData = new TextEncoder().encode(data);
            await vscode.workspace.fs.writeFile(fileUri, fileData);
        } catch (error) {
            console.error({ error });
            vscode.window.showErrorMessage(`Error writing to file: ${filePath}`);
        }
    }
}
