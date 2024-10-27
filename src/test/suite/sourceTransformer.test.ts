import * as assert from 'assert';
import * as vscode from 'vscode';
import { SourceTransformer } from '../../validation/sourceTransformer';
import { NotebookPreview } from '../../../types';

suite('Source Transformer Test Suite', () => {
    const transformer = new SourceTransformer();

    test('transforms WebVTT content correctly', async () => {
        const webvttContent = `WEBVTT

1
00:00:01.000 --> 00:00:04.000
Hello world

2
00:00:05.000 --> 00:00:08.000
Test content`;

        const uri = await createTempFile(webvttContent, '.vtt');
        const result = await transformer.transformToNotebooks(uri);

        validateNotebooks(result.sourceNotebooks[0], result.codexNotebooks[0], 2);
        assert.strictEqual(result.sourceNotebooks[0].cells[0].content, 'Hello world');
        assert.strictEqual(result.codexNotebooks[0].cells[0].content, '');
    });

    test('transforms USFM content correctly', async () => {
        const usfmContent = `\\id GEN
\\c 1
\\v 1 In the beginning
\\v 2 The earth was formless`;

        const uri = await createTempFile(usfmContent, '.usfm');
        const result = await transformer.transformToNotebooks(uri);

        validateNotebooks(result.sourceNotebooks[0], result.codexNotebooks[0], 2);
        assert.strictEqual(result.sourceNotebooks[0].cells[0].content, 'In the beginning');
        assert.strictEqual(result.codexNotebooks[0].cells[0].content, '');
    });

    test('transforms verse reference plaintext correctly', async () => {
        const plaintextContent = `GEN 1:1 In the beginning
GEN 1:2 The earth was formless`;

        const uri = await createTempFile(plaintextContent, '.txt');
        const result = await transformer.transformToNotebooks(uri);

        validateNotebooks(result.sourceNotebooks[0], result.codexNotebooks[0], 2);
        assert.strictEqual(result.sourceNotebooks[0].cells[0].id, 'GEN 1:1');
        assert.strictEqual(result.sourceNotebooks[0].cells[0].content, 'In the beginning');
    });
});

function validateNotebooks(source: NotebookPreview, target: NotebookPreview, expectedCellCount: number) {
    assert.strictEqual(source.cells.length, expectedCellCount);
    assert.strictEqual(target.cells.length, expectedCellCount);
    
    // Verify cell structure
    for (let i = 0; i < expectedCellCount; i++) {
        assert.ok(source.cells[i].id);
        assert.ok(source.cells[i].type);
        assert.ok(source.cells[i].content);
        
        assert.strictEqual(source.cells[i].id, target.cells[i].id);
        assert.strictEqual(source.cells[i].type, target.cells[i].type);
        assert.strictEqual(target.cells[i].content, '');
    }

    // Verify metadata
    assert.ok(source.metadata.sourceCreatedAt);
    assert.strictEqual(source.metadata.gitStatus, 'untracked');
    assert.strictEqual(target.metadata.gitStatus, 'untracked');
}

async function createTempFile(content: string, extension: string): Promise<vscode.Uri> {
    const tempFile = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri, `test${extension}`);
    await vscode.workspace.fs.writeFile(tempFile, Buffer.from(content));
    return tempFile;
}