/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as vscode from 'vscode';
import {subscribeToDocumentChanges, POSSIBLE_RENAME} from './diagnostics';

const COMMAND = 'interface-conformance.renameMethod';

export function activate(context: vscode.ExtensionContext) {
	const interfaceDiagnostics = vscode.languages.createDiagnosticCollection("interface-diagnostics");
	context.subscriptions.push(interfaceDiagnostics);

	subscribeToDocumentChanges(context, interfaceDiagnostics);

	context.subscriptions.push(
		vscode.languages.registerCodeActionsProvider('go', new InterfaceConformance(), {
			providedCodeActionKinds: InterfaceConformance.providedCodeActionKinds
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand(COMMAND, (uri: vscode.Uri, range: vscode.Range, text: string) => {
			// here we want to invoke the 'rename symbol' command
			vscode.commands.executeCommand("vscode.executeDocumentRenameProvider",
				uri,
				range.start,
				text
			).then((edit: any) => {
				if (edit) {
					vscode.workspace.applyEdit(edit);
				}
			});
		})
	);
}

/**
 * Provides code actions corresponding to diagnostic problems.
 */
export class InterfaceConformance implements vscode.CodeActionProvider {

	public static readonly providedCodeActionKinds = [
		vscode.CodeActionKind.QuickFix
	];

	provideCodeActions(document: vscode.TextDocument, range: vscode.Range | vscode.Selection, context: vscode.CodeActionContext, token: vscode.CancellationToken): vscode.CodeAction[] {
		// for each diagnostic entry that has the matching `code`, create a code action command
		return context.diagnostics
			.filter(diagnostic => diagnostic.code === POSSIBLE_RENAME)
			.map(diagnostic => this.createCommandCodeAction(diagnostic));
	}

	private createCommandCodeAction(diagnostic: vscode.Diagnostic): vscode.CodeAction {
		const action = new vscode.CodeAction('Rename method...', vscode.CodeActionKind.QuickFix);
		if (diagnostic.relatedInformation) {
			const uri = diagnostic.relatedInformation[0].location.uri;
			const range = diagnostic.relatedInformation[0].location.range;
			const text = diagnostic.relatedInformation[0].message;
			// we want to 'rename symbol' starting from the method name (index 0) to the end of the identifier
			action.command = {command: COMMAND, title: 'Rename method...', arguments: [uri, range, text]};
		}
		action.diagnostics = [diagnostic];
		action.isPreferred = true;
		return action;
	}
}