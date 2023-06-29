import * as vscode from 'vscode';
import * as fs from 'fs';

import parser = require('luaparse');
import { WalletTemplateInfo } from './WalletTemplateInfo';
import { getFileNameFromURI, getTemplateBlock, getTemplateInfo } from './WalletTemplateUtils';

/**
 * **WalletTemplate**
 *
 * @author Jab
 */
export class WalletTemplate {
    readonly info: WalletTemplateInfo;
    readonly text: string;
    readonly id: string;

    constructor(id: string, info: WalletTemplateInfo, text: string) {
        this.id = id;
        this.info = info;
        this.text =
            text
                .split('\r\n')
                /* (Trim the ends) */
                .filter((s, index, $this) => !((index === 0 || index === $this.length - 1) && s === ''))
                .join('\r\n') + '\r\n';
    }

    tooltip(document: vscode.TextDocument): vscode.CompletionItem {
        const { info } = this;
        const { name, description, version, authors } = info;

        const hasInfo = authors.length || version !== undefined;
        let descString = description !== undefined ? `${description}${hasInfo ? '\n\n' : ''}` : '';

        if (hasInfo) {
            descString += '``(';

            if (authors.length) {
                descString += `Author(s): ${authors.join(', ')}`;
            }

            if (version !== undefined) {
                if (descString.length > 1) {
                    descString += ', ';
                }
                descString += `PZ Version: ${version}`;
            }

            descString += ')``';
        }

        const item = new vscode.CompletionItem(`wallet-${this.id}`);
        item.insertText = new vscode.SnippetString(this.apply(document));
        item.detail = name;
        item.documentation = new vscode.MarkdownString(descString);
        return item;
    }

    apply(document: vscode.TextDocument): string {
        /* (Grab the file's name of the open document) */
        let split = document.fileName.replace(/\\/g, '/').replace(/-/g, '_').split('/');
        split = split[split.length - 1].split('.');
        split.pop(); // Remove the extension and preserve any dots used in the name itself. AKA: My.Lua.File.lua = 'My_Lua_File'
        const fileName = split.join('.').replace('.', '_').replace(/\\s/g, '_');

        return this.text.replace(/(__FILE_NAME__)/g, fileName);
    }

    static fromFile(uri: string): WalletTemplate | undefined {
        const luaFile = fs.readFileSync(uri).toString();

        /* (Ignore files with this annotation) */
        if (luaFile.indexOf('@wallet-ignore') !== -1) return undefined;

        /* (Check for available template table definition) */
        let tableTemplate = undefined;
        const ast = parser.parse(luaFile, { luaVersion: '5.1' });
        for (const entry of ast.body) {
            if (entry.type === 'LocalStatement' && entry.variables[0].name === 'template') {
                tableTemplate = entry;
                break;
            }
        }
        if (!tableTemplate) {
            console.error(`[WalletTemplate::${uri}] No template defined in file.`);
            return undefined;
        }

        const fileName = getFileNameFromURI(uri);
        const info = getTemplateInfo(uri, tableTemplate);
        const block = getTemplateBlock(luaFile);
        return new WalletTemplate(fileName, info, block);
    }

    static loadTemplates(rootDirectory: string) {
        const templates: { [id: string]: WalletTemplate } = {};

        function recurse(dir: string) {
            const files = fs.readdirSync(dir);
            for (const file of files) {
                if (file === '..') continue;
                const filePath = `${dir}/${file}`;
                const stats = fs.statSync(filePath);
                if (stats.isDirectory()) {
                    recurse(filePath);
                } else {
                    if (!file.toLowerCase().endsWith('.lua')) continue;

                    try {
                        const template = WalletTemplate.fromFile(filePath);
                        if (template !== undefined) {
                            console.log(`Loaded template: ${filePath.split('/assets/lua//')[1]}`);
                            templates[template.id] = template;
                        }
                    } catch (err) {
                        console.error(`Failed to load template: ${filePath}`);
                        console.error(err);
                    }
                }
            }
        }
        recurse(rootDirectory);
        return templates;
    }
}
