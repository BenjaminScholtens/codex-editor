import * as vscode from "vscode";
import { DownloadedResource } from "../types";
import { TranslationWordsProvider } from "../../../translationWords/provider";

enum ViewTypes {
    OBS = "scribe.obs",
    BIBLE = "default",
    TRANSLATION_HELPER = "resources.translationHelper",
    TN = "codex.translationNotesEditor",
}

export const openOBS = async (
    resource: DownloadedResource,
    storyId?: string,
) => {
    const workspaceRootUri = vscode.workspace.workspaceFolders?.[0].uri;
    if (!workspaceRootUri) {
        return;
    }
    const resourceRootUri = vscode.Uri.joinPath(
        workspaceRootUri,
        resource.localPath,
    );

    const resourceStoryUri = vscode.Uri.joinPath(
        resourceRootUri,
        "content",
        `${storyId ?? "01"}.md`,
    );

    const existingViewCols = vscode.window.tabGroups.all.map(
        (editor) => editor.viewColumn,
    );

    await vscode.commands.executeCommand(
        "vscode.openWith",
        resourceStoryUri,
        ViewTypes.OBS, // use resource type to load the according view
        { viewColumn: vscode.ViewColumn.Beside, preview: true },
    );

    // get the view cols and tab id of the opened resource

    const newViewCols = vscode.window.tabGroups.all.map(
        (tabGroup) => tabGroup.viewColumn,
    );

    const newViewCol = newViewCols.find(
        (col) => !existingViewCols.includes(col),
    );

    return {
        viewColumn: newViewCol,
    };
};

export const openBible = async (
    resource: DownloadedResource,
    bibleBook?: string,
) => {
    const workspaceRootUri = vscode.workspace.workspaceFolders?.[0].uri;
    if (!workspaceRootUri) {
        return;
    }
    const resourceRootUri = vscode.Uri.joinPath(
        workspaceRootUri,
        resource.localPath,
    );

    const bookUri = vscode.Uri.joinPath(
        resourceRootUri,
        `${bibleBook ?? "01-GEN"}.usfm`,
    );

    const existingViewCols = vscode.window.tabGroups.all.map(
        (editor) => editor.viewColumn,
    );

    await vscode.commands.executeCommand(
        "vscode.openWith",
        bookUri,
        ViewTypes.BIBLE, // use resource type to load the according view
        { viewColumn: vscode.ViewColumn.Beside, preview: true },
    );

    // get the view cols and tab id of the opened resource

    const newViewCols = vscode.window.tabGroups.all.map(
        (tabGroup) => tabGroup.viewColumn,
    );

    const newViewCol = newViewCols.find(
        (col) => !existingViewCols.includes(col),
    );

    return {
        viewColumn: newViewCol,
    };
};

export const openTranslationHelper = async (resource: DownloadedResource) => {
    const workspaceRootUri = vscode.workspace.workspaceFolders?.[0].uri;
    if (!workspaceRootUri) {
        return;
    }
    const resourceRootUri = vscode.Uri.joinPath(
        workspaceRootUri,
        resource.localPath,
    );

    const translationHelperUri = vscode.Uri.joinPath(
        resourceRootUri,
        "metadata.json",
    );
    // .with({ scheme: ViewTypes.TRANSLATION_HELPER });

    const existingViewCols = vscode.window.tabGroups.all.map(
        (editor) => editor.viewColumn,
    );

    await vscode.commands.executeCommand(
        "vscode.openWith",
        translationHelperUri,
        ViewTypes.TRANSLATION_HELPER, // use resource type to load the according view
        { viewColumn: vscode.ViewColumn.Beside, preview: true },
    );

    // get the view cols and tab id of the opened resource

    const newViewCols = vscode.window.tabGroups.all.map(
        (tabGroup) => tabGroup.viewColumn,
    );

    const newViewCol = newViewCols.find(
        (col) => !existingViewCols.includes(col),
    );

    return {
        viewColumn: newViewCol,
    };
};

export const openTn = async (resource: DownloadedResource, bookID: string) => {
    const workspaceRootUri = vscode.workspace.workspaceFolders?.[0].uri;
    if (!workspaceRootUri) {
        return;
    }
    const resourceRootUri = vscode.Uri.joinPath(
        workspaceRootUri,
        resource.localPath,
    );

    const noteUri = vscode.Uri.joinPath(resourceRootUri, `tn_${bookID}.tsv`);

    const existingViewCols = vscode.window.tabGroups.all.map(
        (editor) => editor.viewColumn,
    );

    await vscode.commands.executeCommand(
        "vscode.openWith",
        noteUri,
        ViewTypes.TN, // use resource type to load the according view
        { viewColumn: vscode.ViewColumn.Beside, preview: true },
    );

    // get the view cols and tab id of the opened resource

    const newViewCols = vscode.window.tabGroups.all.map(
        (tabGroup) => tabGroup.viewColumn,
    );

    const newViewCol = newViewCols.find(
        (col) => !existingViewCols.includes(col),
    );

    return {
        viewColumn: newViewCol,
    };
};

export const openTw = async (
    context: vscode.ExtensionContext,
    resource: DownloadedResource,
) => {
    const twProvider = new TranslationWordsProvider(context, resource);

    return await twProvider.startWebview();
};
