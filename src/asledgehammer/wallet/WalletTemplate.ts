import * as vscode from 'vscode';
import * as fs from 'fs';

import parser = require('luaparse');
import { WalletTemplateInfo } from './WalletTemplateInfo';

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

        const item = new vscode.CompletionItem(this.id);
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
        const info: WalletTemplateInfo = {
            name: '',
            authors: [],
            version: '',
            description: undefined,
        };

        const luaFile = fs.readFileSync(uri).toString();

        // Ignore this file.
        if (luaFile.indexOf('@wallet-ignore') !== -1) return undefined;

        const ast = parser.parse(luaFile, { luaVersion: '5.1' });

        let tableTemplate = undefined;

        for (const entry of ast.body) {
            if (entry.type === 'LocalStatement' && entry.variables[0].name === 'template') {
                tableTemplate = entry;
                break;
            }
        }

        if (!tableTemplate) {
            throw new Error(`[WalletTemplate::${uri}] No template defined in file.`);
        }

        const toStringArray = (value: parser.TableConstructorExpression): string[] => {
            const lines = [];
            for (const field of value.fields) {
                if (field.type !== 'TableValue') continue;
                if (field.value.type !== 'StringLiteral') continue;
                lines.push(field.value.raw.substring(1, field.value.raw.length - 1));
            }
            return lines;
        };

        const toMultiLine = (value: parser.TableConstructorExpression): string => toStringArray(value).join('\n');

        const exp: parser.TableConstructorExpression = tableTemplate.init[0] as parser.TableConstructorExpression;
        for (const next of exp.fields) {
            const field: parser.TableKeyString = next as parser.TableKeyString;
            const name = field.key.name;

            switch (name) {
                case 'name': {
                    if (field.value.type !== 'StringLiteral') {
                        throw new Error(
                            `[WalletTemplate::${uri}] 'template['name'].value.type' is not a StringLiteral.`
                        );
                    }
                    info.name = (field.value as parser.StringLiteral).raw;
                    info.name = info.name.substring(1, info.name.length - 1);
                    break;
                }
                case 'authors': {
                    if (field.value.type === 'StringLiteral') {
                        info.authors = [field.value.raw.substring(1, field.value.raw.length - 1)];
                    } else if (field.value.type === 'TableConstructorExpression') {
                        info.authors = toStringArray(field.value);
                    }
                    break;
                }
                case 'version': {
                    if (field.value.type !== 'StringLiteral') {
                        throw new Error(
                            `[WalletTemplate::${uri}] 'template['version'].value.type' is not a StringLiteral.`
                        );
                    }
                    info.version = (field.value as parser.StringLiteral).raw;
                    info.version = info.version.substring(1, info.version.length - 1);
                    break;
                }
                case 'description': {
                    if (field.value.type === 'StringLiteral') {
                        info.description = (field.value as parser.StringLiteral).raw;
                        info.description = info.description.substring(1, info.description.length - 1);
                    } else if (field.value.type === 'TableConstructorExpression') {
                        info.description = toMultiLine(field.value);
                    }
                    break;
                }
            }
        }

        // Make sure we have all mandatory information.
        if (info.name === '' || info.version === '') {
            throw new Error(`[WalletTemplate::${uri}] Incomplete template information: ${JSON.stringify(info)}`);
        }

        if (info.description === 'external') {
            const uriMD = uri.replace('.lua', '.md');
            if (fs.existsSync(uriMD)) {
                info.description = fs.readFileSync(uriMD).toString().trim();
            } else {
                info.description = undefined;
            }
        }

        let inside = false;
        const linesFiltered = [];
        const lines = luaFile.split('\r\n');

        for (const line of lines) {
            const lineTrimmed = line.trim();
            if (inside) {
                if (lineTrimmed === '--- @template-block-end' || lineTrimmed === '---@template-block-end') {
                    inside = false;
                    continue;
                }
                if (lineTrimmed === '') {
                    linesFiltered.push('');
                } else {
                    linesFiltered.push(line.trimEnd());
                }
            } else {
                if (lineTrimmed === '--- @template-block-start' || lineTrimmed === '---@template-block-start') {
                    inside = true;
                    continue;
                }
            }
        }

        while (lines.length !== 0 && lines[0] === '') {
            lines.reverse();
            lines.pop();
            lines.reverse();
        }

        while (lines.length !== 0 && lines[lines.length - 1] === '') {
            lines.pop();
        }

        const split = uri.replace(/\\/g, '/').split('/');
        const fileName = split[split.length - 1].toLowerCase().replace('.lua', '');

        return new WalletTemplate(fileName, info, linesFiltered.join('\r\n'));
    }
}
