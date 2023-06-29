import * as fs from 'fs';
import * as vscode from 'vscode';
import { WalletTemplate } from './asledgehammer/wallet/WalletTemplate';

export function activate(context: vscode.ExtensionContext) {
    const { extensionPath: root } = context;

    const templates = WalletTemplate.loadTemplates(`${root}/assets/lua/`);

    const provider1 = vscode.languages.registerCompletionItemProvider('lua', {
        provideCompletionItems(
            document: vscode.TextDocument,
            position: vscode.Position,
            token: vscode.CancellationToken,
            context: vscode.CompletionContext
        ) {
            const templateSnippets: vscode.CompletionItem[] = [];
            for (const key of Object.keys(templates)) {
                templateSnippets.push(templates[key].tooltip(document));
            }
            return templateSnippets;
        },
    });

    context.subscriptions.push(provider1);
}
