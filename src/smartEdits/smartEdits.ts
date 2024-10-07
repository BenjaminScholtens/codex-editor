import Chatbot from "./chat";
import MiniSearch from "minisearch";
import { minisearchDoc } from "../activationHelpers/contextAware/miniIndex/indexes/translationPairsIndex";
import { TranslationPair, SmartEditContext, SmartSuggestion, SavedSuggestions } from "../../types";
import {
    searchParallelCells,
    getTranslationPairFromProject,
} from "../activationHelpers/contextAware/miniIndex/indexes/search";
import * as fs from "fs/promises";
import * as path from "path";
import * as vscode from "vscode";

const SYSTEM_MESSAGE = `You are a helpful assistant. Given similar edits across a corpus, you will suggest edits to a new text. 
Your suggestions should follow this format:
    {'suggestions': [
        {
            "oldString": "The old string to be replaced",
            "newString": "The new string to replace the old string"
        },
        {
            "oldString": "The old string to be replaced",
            "newString": "The new string to replace the old string"
        }
    ]}
    Rules:
        1. These will be in languages you may not be familiar with, so try your best anyways and use the context to infer the correct potential edits.
        2. Do not make edits based only on HTML, but include whatever HTML tags are in the text rather than removing them. 
        3. If no edits are needed, return an empty array.
    `;

export class SmartEdits {
    private chatbot: Chatbot;
    private translationPairsIndex: MiniSearch<minisearchDoc>;
    private sourceTextIndex: MiniSearch;
    private smartEditsPath: string;

    constructor(
        translationPairsIndex: MiniSearch<minisearchDoc>,
        sourceTextIndex: MiniSearch,
        workspaceUri: vscode.Uri
    ) {
        this.chatbot = new Chatbot(SYSTEM_MESSAGE);
        this.translationPairsIndex = translationPairsIndex;
        this.sourceTextIndex = sourceTextIndex;
        this.smartEditsPath = path.join(workspaceUri.fsPath, "files", "smart_edits.json");
        console.log("SmartEdits initialized with path:", this.smartEditsPath);
    }

    async getEdits(text: string, cellId: string): Promise<SmartSuggestion[]> {
        console.log(`Getting edits for cellId: ${cellId}`);
        const savedSuggestions = await this.loadSavedSuggestions(cellId);

        if (savedSuggestions && savedSuggestions.lastCellValue === text) {
            console.log("Using saved suggestions for cellId:", cellId);
            return savedSuggestions.suggestions;
        }

        console.log("Finding similar entries...");
        const similarEntries = this.findSimilarEntries(text);
        console.log(`Found ${similarEntries.length} similar entries`);

        console.log("Getting similar texts...");
        const similarTexts = await this.getSimilarTexts(similarEntries);
        console.log(`Retrieved ${similarTexts.length} similar texts`);

        const similarTextsString = this.formatSimilarTexts(similarTexts);
        const message = this.createEditMessage(similarTextsString, text);

        console.log("Sending message to chatbot...");
        const jsonResponse = await this.chatbot.getJsonCompletion(message);
        console.log("Received response from chatbot:", jsonResponse);

        let suggestions: SmartSuggestion[] = [];
        if (Array.isArray(jsonResponse.suggestions)) {
            suggestions = jsonResponse.suggestions.map((suggestion: any) => ({
                oldString: suggestion.oldString || "",
                newString: suggestion.newString || "",
            }));
        }

        console.log(`Generated ${suggestions.length} suggestions`);
        await this.saveSuggestions(cellId, text, suggestions);
        return suggestions;
    }

    private async loadSavedSuggestions(cellId: string): Promise<SavedSuggestions | null> {
        try {
            console.log(`Loading saved suggestions for cellId: ${cellId}`);
            const fileContent = await fs.readFile(this.smartEditsPath, "utf8");
            const savedEdits: { [key: string]: SavedSuggestions } = JSON.parse(fileContent);
            const result = savedEdits[cellId] || null;
            console.log(`Loaded suggestions for cellId ${cellId}:`, result);
            return result;
        } catch (error) {
            console.error("Error loading saved suggestions:", error);
            return null;
        }
    }

    private async saveSuggestions(
        cellId: string,
        text: string,
        suggestions: SmartSuggestion[]
    ): Promise<void> {
        try {
            console.log(`Saving suggestions for cellId: ${cellId}`);
            let savedEdits: { [key: string]: SavedSuggestions } = {};
            try {
                const fileContent = await fs.readFile(this.smartEditsPath, "utf8");
                savedEdits = JSON.parse(fileContent);
            } catch (error) {
                console.log("No existing saved edits found, starting with empty object");
            }

            savedEdits[cellId] = {
                cellId,
                lastCellValue: text,
                suggestions,
            };

            await fs.writeFile(this.smartEditsPath, JSON.stringify(savedEdits, null, 2));
            console.log(`Saved suggestions for cellId: ${cellId}`);
        } catch (error) {
            console.error("Error saving suggestions:", error);
        }
    }

    private findSimilarEntries(text: string): string[] {
        console.log("Finding similar entries for text:", text);
        const results = searchParallelCells(this.translationPairsIndex, this.sourceTextIndex, text);
        const cellIds = results.map((result) => result.cellId);
        console.log(`Found ${cellIds.length} similar entries`);
        return cellIds;
    }

    private async getSimilarTexts(cellIds: string[]): Promise<SmartEditContext[]> {
        console.log(`Getting similar texts for ${cellIds.length} cellIds`);
        const similarTexts: SmartEditContext[] = [];
        for (const cellId of cellIds) {
            const pair = getTranslationPairFromProject(this.translationPairsIndex, cellId);
            if (pair && pair.targetCell.uri) {
                try {
                    const filePath = pair.targetCell.uri.replace(
                        "/.projects/sourceTexts/",
                        "/files/target"
                    );
                    console.log(`Reading file for cellId ${cellId}: ${filePath}`);
                    const fileContent = await fs.readFile(filePath, "utf8");
                    const jsonContent = JSON.parse(fileContent);
                    const cell = jsonContent.cells.find((cell: any) => cell.metadata.id === cellId);
                    if (cell) {
                        const context: SmartEditContext = {
                            cellId: cellId,
                            currentCellValue: cell.value,
                            edits: cell.metadata.edits || [],
                        };
                        similarTexts.push(context);
                        console.log(`Added context for cellId: ${cellId}`);
                    } else {
                        console.log(`Cell not found for cellId: ${cellId}`);
                    }
                } catch (error) {
                    console.error(`Error reading file for cellId ${cellId}:`, error);
                }
            } else {
                console.log(`No valid pair found for cellId: ${cellId}`);
            }
        }
        console.log(`Retrieved ${similarTexts.length} similar texts`);
        return similarTexts;
    }

    private formatSimilarTexts(similarTexts: SmartEditContext[]): string {
        console.log(`Formatting ${similarTexts.length} similar texts`);
        const formattedTexts = similarTexts.map((context) => {
            const revisions = context.edits
                .map((edit, index) => {
                    return `revision ${index + 1}: ${JSON.stringify(edit.cellValue)}`;
                })
                .join(",\n");
            return `"${context.cellId}": {\n${revisions}\n}`;
        });
        return `{\n${formattedTexts.join(",\n")}\n}`;
    }

    private createEditMessage(similarTextsString: string, text: string): string {
        console.log("Creating edit message");
        const message = `Similar Texts:\n${similarTextsString}\n\nEdit the following text based on the patterns you've seen in similar texts, or leave it as is if nothing needs to be changed:\n${text}`;
        console.log("Edit message created");
        return message;
    }
}
