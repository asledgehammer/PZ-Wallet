import * as os from 'os';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { WalletTemplate } from './asledgehammer/wallet/WalletTemplate';
import { simpleGit, SimpleGit } from 'simple-git';

let templates: { [id: string]: WalletTemplate } = {};

let dirTemplates = `${os.homedir()}/documents`;
if (fs.existsSync(dirTemplates)) {
    dirTemplates += '/asledgehammer';
    if (!fs.existsSync(dirTemplates)) fs.mkdirSync(dirTemplates);
    dirTemplates += '/vscode';
    if (!fs.existsSync(dirTemplates)) fs.mkdirSync(dirTemplates);
    dirTemplates += '/pz-wallet';
    if (!fs.existsSync(dirTemplates)) fs.mkdirSync(dirTemplates);
    dirTemplates += '/templates';
    if (!fs.existsSync(dirTemplates)) fs.mkdirSync(dirTemplates);
}

export function activate(context: vscode.ExtensionContext) {
    try {
        pullFromGitHubRepo(
            'https://github.com/asledgehammer/PZ-Wallet-Templates.git',
            `${dirTemplates}/pz-wallet-templates`
        ).then(() => loadTemplates());

        const provider1 = vscode.languages.registerCompletionItemProvider('lua', {
            provideCompletionItems(
                document: vscode.TextDocument,
                position: vscode.Position,
                token: vscode.CancellationToken,
                context: vscode.CompletionContext
            ) {
                const templateSnippets: vscode.CompletionItem[] = [];
                for (const key of Object.keys(templates)) {
                    templateSnippets.push(templates[key].tooltip(templates, document));
                }
                return templateSnippets;
            },
        });

        const cmdReloadTemplates = vscode.commands.registerCommand('wallet-reload-templates', () =>
            pullFromGitHubRepo(
                'https://github.com/asledgehammer/PZ-Wallet-Templates.git',
                `${dirTemplates}/pz-wallet-templates`
            ).then(() => loadTemplates(true))
        );

        const cmdOpenTemplatesFolder = vscode.commands.registerCommand('wallet-open-templates-folder', () => {
            let dir = dirTemplates;
            while (dir.indexOf('\\') !== -1) dir = dir.replace('\\', '/');
            const uri = vscode.Uri.file(dir);
            vscode.commands.executeCommand(`vscode.openFolder`, uri, { forceNewWindow: true });
        });

        context.subscriptions.push(provider1, cmdReloadTemplates, cmdOpenTemplatesFolder);
    } catch (err) {
        vscode.window.showErrorMessage(`PZ-Wallet: Failed to activate extension.`, (err as any).stack);
    }
}

async function pullFromGitHubRepo(remote: string, dir: string, branch = 'main') {
    try {
        const exists = fs.existsSync(dir);
        if (!exists) {
            console.log(`Creating directory: '${dir}'..`);
            fs.mkdirSync(dir);
        }
        const git: SimpleGit = simpleGit();
        const isCloned = fs.existsSync(`${dir}/.git/`);
        if (isCloned) {
            console.log(`git pull: ${remote}`);
            await git.pull(remote, branch);
        } else {
            console.log(`git clone: ${remote}`);
            await git.clone(remote, dir);
        }
    } catch (err) {
        console.error(`Failed to process Git repository: ${remote}`);
        console.error(err);

        vscode.window.showErrorMessage(`PZ-Wallet: Failed to process Git repository: ${remote}`, (err as any).stack);
    }
}

async function loadTemplates(reload = false) {
    try {
        templates = WalletTemplate.loadTemplates(dirTemplates);
        if (reload) {
            vscode.window.showInformationMessage(
                `PZ-Wallet: Successfully loaded ${Object.keys(templates).length} template(s).`
            );
        }
    } catch (err) {
        vscode.window.showErrorMessage(`PZ-Wallet: Failed to load templates.`, (err as any).stack);
    }
}
