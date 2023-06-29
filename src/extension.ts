import * as fs from 'fs';
import * as vscode from 'vscode';
import { WalletTemplate } from './asledgehammer/wallet/WalletTemplate';

export function activate(context: vscode.ExtensionContext) {
    const { extensionPath: root } = context;

    const templates = loadTemplates();

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

    function loadTemplates() {
        const templates: { [id: string]: WalletTemplate } = {};

        function readFolder(dir: string) {
            const files = fs.readdirSync(dir);
            for (const file of files) {
                if (file === '..') continue;
                const fileURI = `${dir}/${file}`;
                const stats = fs.statSync(fileURI);
                if (stats.isDirectory()) {
                    readFolder(fileURI);
                } else {
                    if (!file.toLowerCase().endsWith('.lua')) continue;

                    try {
                        const template = WalletTemplate.fromFile(fileURI);
                        if (template !== undefined) {
                            console.log(`Loaded template: ${fileURI.split('/assets/lua//')[1]}`);
                            templates[template.id] = template;
                        }
                    } catch (err) {
                        console.error(`Failed to load template: ${fileURI}`);
                        console.error(err);
                    }
                }
            }
        }

        const dirLua = `${root}/assets/lua/`;

        readFolder(dirLua);

        return templates;
    }
}
