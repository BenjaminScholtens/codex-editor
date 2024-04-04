import { LanguageCodes } from "./languageUtils";
import { nonCanonicalBookRefs } from "./verseRefUtils/verseData";
import { LanguageMetadata, LanguageProjectStatus, Project } from "codex-types";
import { getAllBookRefs } from ".";
import * as vscode from "vscode";
import { v5 as uuidV5 } from "uuid";

import ProjectTemplate from "../providers/obs/data/TextTemplate.json";
import moment from "moment";

export interface ProjectDetails {
    projectName: string;
    projectCategory: string;
    userName: string;
    abbreviation: string;
    sourceLanguage: LanguageMetadata;
    targetLanguage: LanguageMetadata;
}

export async function promptForProjectDetails(): Promise<
    ProjectDetails | undefined
> {
    // Prompt user for project details and return them

    const projectCategory = await vscode.window.showQuickPick(
        ["Scripture", "Gloss", "Parascriptural", "Peripheral"],
        { placeHolder: "Select the project category" },
    );
    if (!projectCategory) return;

    const projectName = await vscode.window.showInputBox({
        prompt: "Enter the project name",
    });
    if (!projectName) return;

    const userName = await vscode.window.showInputBox({
        prompt: "Enter your username",
    });
    if (!userName) return;

    const abbreviation = await vscode.window.showInputBox({
        prompt: "Enter the project abbreviation",
        placeHolder: "e.g. KJV, NASB, RSV, etc.",
    });
    if (!abbreviation) return;
    const languages = LanguageCodes;
    const sourceLanguagePick = await vscode.window.showQuickPick(
        languages.map(
            (lang: LanguageMetadata) => `${lang.refName} (${lang.tag})`,
        ),
        {
            placeHolder: "Select the source language",
        },
    );
    if (!sourceLanguagePick) return;

    const sourceLanguage = languages.find(
        (lang: LanguageMetadata) =>
            `${lang.refName} (${lang.tag})` === sourceLanguagePick,
    );
    if (!sourceLanguage) return;

    const targetLanguagePick = await vscode.window.showQuickPick(
        languages.map(
            (lang: LanguageMetadata) => `${lang.refName} (${lang.tag})`,
        ),
        {
            placeHolder: "Select the target language",
        },
    );
    if (!targetLanguagePick) return;

    const targetLanguage = languages.find(
        (lang: LanguageMetadata) =>
            `${lang.refName} (${lang.tag})` === targetLanguagePick,
    );
    if (!targetLanguage) return;

    // Add project status to the selected languages
    sourceLanguage.projectStatus = LanguageProjectStatus.SOURCE;
    targetLanguage.projectStatus = LanguageProjectStatus.TARGET;

    return {
        projectName,
        projectCategory,
        userName,
        abbreviation,
        sourceLanguage,
        targetLanguage,
    };
}

export function generateProjectScope(
    skipNonCanonical: boolean = true,
): Project["type"]["flavorType"]["currentScope"] {
    /** For now, we are just setting the scope as all books, but allowing the vref.ts file to determine the books.
     * We could add a feature to allow users to select which books they want to include in the project.
     * And we could even drill down to specific chapter/verse ranges.
     *
     * FIXME: need to sort out whether the scope can sometimes be something other than books, like stories, etc.
     */
    const books: string[] = getAllBookRefs();

    // The keys will be the book refs, and the values will be empty arrays
    const projectScope: any = {}; // NOTE: explicit any type here because we are dynamically generating the keys

    skipNonCanonical
        ? books
              .filter((book) => !nonCanonicalBookRefs.includes(book))
              .forEach((book) => {
                  projectScope[book] = [];
              })
        : books.forEach((book) => {
              projectScope[book] = [];
          });
    return projectScope;
}

export async function initializeProjectMetadata(details: ProjectDetails) {
    // Initialize a new project with the given details and return the project object

    const newProject = ProjectTemplate as Record<string, any>;

    newProject.projectName = details.projectName;
    newProject.meta.category = details.projectCategory;
    newProject.meta.generator.userName = details.userName;
    newProject.meta.dateCreated = moment().format();

    const key = details.userName + details.projectName + moment().format();
    const id = uuidV5(key, "1b671a64-40d5-491e-99b0-da01ff1f3341");

    newProject.identification.primary = {
        scribe: {
            [id]: {
                revision: "1",
                timestamp: moment().format(),
            },
        },
    };

    newProject.languages[0].tag = details.targetLanguage.tag;
    newProject.languages[0].scriptDirection =
        details.targetLanguage.scriptDirection?.toLowerCase();
    newProject.identification.name.en = details.projectName;
    newProject.identification.abbreviation.en = details.abbreviation;
    newProject.languages[0].name.en = details.targetLanguage.refName;
    newProject.copyright.licenses[0].ingredient = "license.md";

    newProject.type.flavorType.currentScope = generateProjectScope();

    const workspaceFolder = vscode.workspace.workspaceFolders
        ? vscode.workspace.workspaceFolders[0].uri.fsPath
        : undefined;

    if (!workspaceFolder) {
        console.error("No workspace folder found.");
        return;
    }

    const WORKSPACE_FOLDER =
        vscode?.workspace?.workspaceFolders &&
        vscode?.workspace?.workspaceFolders[0];

    if (!WORKSPACE_FOLDER) {
        console.error("No workspace folder found.");
        return;
    }

    const projectFilePath = vscode.Uri.joinPath(
        WORKSPACE_FOLDER.uri,
        "metadata.json",
    );
    const projectFileData = Buffer.from(
        JSON.stringify(newProject, null, 4),
        "utf8",
    );

    // FIXME: need to handle the case where the file does not exist
    vscode.workspace.fs
        .writeFile(projectFilePath, projectFileData)
        .then(() =>
            vscode.window.showInformationMessage(
                `Project created at ${projectFilePath.fsPath}`,
            ),
        );
    const languages = [];

    languages.push(details.sourceLanguage);
    languages.push(details.targetLanguage);

    newProject.languages = languages;

    return newProject;
}
