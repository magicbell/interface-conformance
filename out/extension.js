"use strict";
/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.InterfaceConformance = exports.activate = void 0;
const vscode = require("vscode");
const diagnostics_1 = require("./diagnostics");
const COMMAND = 'interface-conformance.renameMethod';
function activate(context) {
    const interfaceDiagnostics = vscode.languages.createDiagnosticCollection("interface-diagnostics");
    context.subscriptions.push(interfaceDiagnostics);
    (0, diagnostics_1.subscribeToDocumentChanges)(context, interfaceDiagnostics);
    context.subscriptions.push(vscode.languages.registerCodeActionsProvider('go', new InterfaceConformance(), {
        providedCodeActionKinds: InterfaceConformance.providedCodeActionKinds
    }));
    context.subscriptions.push(vscode.commands.registerCommand(COMMAND, (uri, range, text) => {
        // here we want to invoke the 'rename symbol' command
        vscode.commands.executeCommand("vscode.executeDocumentRenameProvider", uri, range.start, text).then((edit) => {
            if (edit) {
                vscode.workspace.applyEdit(edit);
            }
        });
    }));
}
exports.activate = activate;
/**
 * Provides code actions corresponding to diagnostic problems.
 */
class InterfaceConformance {
    provideCodeActions(document, range, context, token) {
        // for each diagnostic entry that has the matching `code`, create a code action command
        return context.diagnostics
            .filter(diagnostic => diagnostic.code === diagnostics_1.POSSIBLE_RENAME)
            .map(diagnostic => this.createCommandCodeAction(diagnostic));
    }
    createCommandCodeAction(diagnostic) {
        const action = new vscode.CodeAction('Rename method...', vscode.CodeActionKind.QuickFix);
        if (diagnostic.relatedInformation) {
            const uri = diagnostic.relatedInformation[0].location.uri;
            const range = diagnostic.relatedInformation[0].location.range;
            const text = diagnostic.relatedInformation[0].message;
            // we want to 'rename symbol' starting from the method name (index 0) to the end of the identifier
            action.command = { command: COMMAND, title: 'Rename method...', arguments: [uri, range, text] };
        }
        action.diagnostics = [diagnostic];
        action.isPreferred = true;
        return action;
    }
}
exports.InterfaceConformance = InterfaceConformance;
InterfaceConformance.providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix
];
//# sourceMappingURL=extension.js.map