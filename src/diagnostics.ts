import * as vscode from 'vscode';
import { getFuncSignature } from './lib/get-func-signature';

/** Code that is used to associate diagnostic entries with code actions. */
export const POSSIBLE_RENAME = 'possible_rename';

// Basic regex to mock the interface checks: todo: implement real interface checks
import interfaces from './interfaces.json';
import { InterfaceMethod, Method, parseSignature } from './lib/parse-signature';

function getKey(method: Method) {
	return [...method.params.map(p => p.type), '_', ...method.returns.map(r => r.type)].join('_');
}

const signatures = new Map<string, Array<InterfaceMethod>>();
for (const method of interfaces) {
	const key = getKey(method as InterfaceMethod);
	if (!signatures.has(key)) {
		signatures.set(key, []);
	}

	const methods = signatures.get(key);
	methods!.push(method as InterfaceMethod);
}


// const check = {
// 	pattern: /func\s*\(.*?\)\s+(\w+)\s*\([^)]*input\s*\[\]\s*byte[^)]*\)\s*\([^)]*\)/, // captures any method with signature: (input []byte) (int, error)
// 	expectedName: "Write",
// 	interfaceName: "io.Writer"
// };

/**
 * Analyzes the text document for problems. 
 * @param doc text document to analyze
 * @param interfaceDiagnostics diagnostic collection
 */
export function refreshDiagnostics(doc: vscode.TextDocument, interfaceDiagnostics: vscode.DiagnosticCollection): void {
	const diagnostics: vscode.Diagnostic[] = [];

	for (let lineIndex = 0; lineIndex < doc.lineCount; lineIndex++) {
		const lineOfText = doc.lineAt(lineIndex);
		const text = lineOfText.text;

		if (!text.trim().startsWith('func')) continue;

		const signature = getFuncSignature(text);
		if (!signature) continue;

		const method = parseSignature(signature);
		const matches = signatures.get(getKey(method));
		if (!matches) continue;

		// bail when when already match to one of the interfaces
		const hasMatch = matches.some(m => m.name === method.name);
		if (hasMatch) continue;
		
		// group by method name, some interfaces share signature, like io.Reader.Read and io.Writer.Write
		// make suggestions for all of them
		const groupedMatches = new Map<string, Array<InterfaceMethod>>();
		for (const match of matches) {
			if (!groupedMatches.has(match.name)) groupedMatches.set(match.name, []);
			groupedMatches.get(match.name)!.push(match);
		}

		for (const matches of groupedMatches.values()) {
			diagnostics.push(createDiagnostic(doc, lineOfText, method, matches));
		}
	}

	interfaceDiagnostics.set(doc.uri, diagnostics);
}

function joinAnd(items: Array<string>): string {
	if (items.length === 1) return items[0];
	if (items.length === 2) return `${items[0]} and ${items[1]}`;
	return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function createDiagnostic(doc: vscode.TextDocument, lineOfText: vscode.TextLine, method: Method, matches: Array<InterfaceMethod>): vscode.Diagnostic {
	// find where in the line of that the method name begins
	const startIndex = lineOfText.text.indexOf(method.name);
	const endIndex = startIndex + method.name.length;

	// create range that represents, where in the document the method is
	const range = new vscode.Range(lineOfText.lineNumber, startIndex, lineOfText.lineNumber, endIndex);

	let interfaces = joinAnd(matches.map(m => `${m.package}.${m.interface}`))
	interfaces += interfaces.length > 1 ? ' interfaces' : ' interface';

	const matchName = matches[0].name;

	const diagnostic = new vscode.Diagnostic(range, `func ${method.name} conforms to the ${interfaces}, but the method name should be '${matchName}'`,
		vscode.DiagnosticSeverity.Information);
	diagnostic.code = POSSIBLE_RENAME;
	diagnostic.relatedInformation = [
		new vscode.DiagnosticRelatedInformation(new vscode.Location(doc.uri, range), `rename ${method.name} to ${matchName}`)
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