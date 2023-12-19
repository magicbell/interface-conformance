/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

/** To demonstrate code actions associated with Diagnostics problems, this file provides a mock diagnostics entries. */

import * as vscode from 'vscode';

/** Code that is used to associate diagnostic entries with code actions. */
export const POSSIBLE_RENAME = 'possible_rename';

// Basic regex to mock the interface checks: todo: implement real interface checks
const check = {
	pattern: /func\s*\(.*?\)\s+(\w+)\s*\([^)]*input\s*\[\]\s*byte[^)]*\)\s*\([^)]*\)/, // captures any method with signature: (input []byte) (int, error)
	expectedName: "Write",
	interfaceName: "io.Writer"
};

/**
 * Analyzes the text document for problems. 
 * @param doc text document to analyze
 * @param interfaceDiagnostics diagnostic collection
 */
export function refreshDiagnostics(doc: vscode.TextDocument, interfaceDiagnostics: vscode.DiagnosticCollection): void {
	const diagnostics: vscode.Diagnostic[] = [];

	for (let lineIndex = 0; lineIndex < doc.lineCount; lineIndex++) {
		const lineOfText = doc.lineAt(lineIndex);

		const match = lineOfText.text.match(check.pattern);
		if (match && match[1] !== check.expectedName) {
			diagnostics.push(createDiagnostic(doc, lineOfText, lineIndex, match[1]));
		}
	}

	interfaceDiagnostics.set(doc.uri, diagnostics);
}

function createDiagnostic(doc: vscode.TextDocument, lineOfText: vscode.TextLine, lineIndex: number, methodName: string): vscode.Diagnostic {
	// find where in the line of that the method name begins
	const index = lineOfText.text.indexOf(methodName);

	// create range that represents, where in the document the method is
	const range = new vscode.Range(lineIndex, index, lineIndex, index + methodName.length);

	const diagnostic = new vscode.Diagnostic(range, `This almost conforms to the ${check.interfaceName} interface, but the method name should be '${check.expectedName}'`,
		vscode.DiagnosticSeverity.Information);
	diagnostic.code = POSSIBLE_RENAME;
	diagnostic.relatedInformation = [
		new vscode.DiagnosticRelatedInformation(new vscode.Location(doc.uri, range), check.expectedName)
	];
	return diagnostic;
}

export function subscribeToDocumentChanges(context: vscode.ExtensionContext, interfaceDiagnostics: vscode.DiagnosticCollection): void {
	if (vscode.window.activeTextEditor) {
		refreshDiagnostics(vscode.window.activeTextEditor.document, interfaceDiagnostics);
	}
	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor(editor => {
			if (editor) {
				refreshDiagnostics(editor.document, interfaceDiagnostics);
			}
		})
	);

	context.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument(e => refreshDiagnostics(e.document, interfaceDiagnostics))
	);

	context.subscriptions.push(
		vscode.workspace.onDidCloseTextDocument(doc => interfaceDiagnostics.delete(doc.uri))
	);

}