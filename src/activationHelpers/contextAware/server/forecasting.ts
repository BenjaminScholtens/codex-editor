import {
    TextDocument,
    Position,
    CompletionItem,
    CompletionItemKind,
    CancellationToken,
    CompletionContext
} from 'vscode-languageserver/node';
import * as fs from 'fs';
import * as path from 'path';

class MarkovChain {
    private chain: Map<string, Map<string, number>>;

    constructor() {
        this.chain = new Map();
    }

    addPair(word1: string, word2: string) {
        if (!this.chain.has(word1)) {
            this.chain.set(word1, new Map());
        }
        const nextWords = this.chain.get(word1)!;
        nextWords.set(word2, (nextWords.get(word2) || 0) + 1);
    }

    getNextWords(word: string): string[] {
        const nextWords = this.chain.get(word);
        if (!nextWords) return [];
        return Array.from(nextWords.entries())
            .sort((a, b) => b[1] - a[1])
            .map(entry => entry[0]);
    }
}

export class WordSuggestionProvider {
    private markovChain: MarkovChain;

    constructor(workspaceFolder: string) {
        this.markovChain = new MarkovChain();
        this.buildMarkovChain(workspaceFolder);
    }

    private async buildMarkovChain(workspaceFolder: string) {
        const completeDraftPath = path.join(workspaceFolder, '.project', 'complete_drafts.txt');
        try {
            const content = await fs.promises.readFile(completeDraftPath, 'utf8');
            const words = content.split(/\s+/).filter((word: string) => word.length > 0);

            for (let i = 0; i < words.length - 1; i++) {
                const word1 = words[i].toLowerCase().replace(/[^\p{L}\s]/gu, "");
                const word2 = words[i + 1].toLowerCase().replace(/[^\p{L}\s]/gu, "");
                if (word1 && word2) {
                    this.markovChain.addPair(word1, word2);
                }
            }
        } catch (error) {
            console.error(`Failed to build Markov chain: ${error}`);
        }
    }

    provideCompletionItems(
        document: TextDocument,
        position: Position,
        token: CancellationToken,
        context: CompletionContext
    ): CompletionItem[] {
        const text = document.getText();
        const offset = document.offsetAt(position);
        const linePrefix = text.substr(0, offset);
        const words = linePrefix.split(/\s+/).filter(word => word.length > 0);
        const lastWord = words[words.length - 1].toLowerCase().replace(/[^\p{L}\s]/gu, "");

        let suggestions: string[] = [];
        if (lastWord) {
            suggestions = this.markovChain.getNextWords(lastWord);
        }

        if (suggestions.length === 0 && words.length > 1) {
            const secondLastWord = words[words.length - 2].toLowerCase().replace(/[^\p{L}\s]/gu, "");
            suggestions = this.markovChain.getNextWords(secondLastWord);
        }

        return suggestions.slice(0, 5).map(word => ({
            label: word,
            kind: CompletionItemKind.Text,
            detail: 'Suggested word'
        }));
    }
}