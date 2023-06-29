import * as fs from 'fs';

import parser = require('luaparse');
import { WalletTemplateInfo } from './WalletTemplateInfo';

export const getFileNameFromURI = (uri: string): string => {
    const split = uri.replace(/\\/g, '/').split('/');
    return split[split.length - 1].toLowerCase().replace('.lua', '');
};

export const toStringArray = (value: parser.TableConstructorExpression): string[] => {
    const lines = [];
    for (const field of value.fields) {
        if (field.type !== 'TableValue') continue;
        if (field.value.type !== 'StringLiteral') continue;
        lines.push(field.value.raw.substring(1, field.value.raw.length - 1));
    }
    return lines;
};

export const toMultiLine = (value: parser.TableConstructorExpression): string => toStringArray(value).join('\n');

export const getTemplateBlock = (text: string): string => {
    let inside = false;
    const linesFiltered = [];
    const lines = text.split('\r\n');

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

    while (linesFiltered.length !== 0 && linesFiltered[0] === '') {
        linesFiltered.reverse();
        linesFiltered.pop();
        linesFiltered.reverse();
    }

    while (linesFiltered.length !== 0 && linesFiltered[linesFiltered.length - 1] === '') {
        linesFiltered.pop();
    }

    return linesFiltered.join('\r\n');
};

export const getTemplateInfo = (uri: string, tableTemplate: parser.LocalStatement) => {
    const fileName = getFileNameFromURI(uri);

    const info: WalletTemplateInfo = {
        name: fileName,
        authors: [],
        version: undefined,
        description: undefined,
    };

    const exp: parser.TableConstructorExpression = tableTemplate.init[0] as parser.TableConstructorExpression;
    for (const next of exp.fields) {
        const field: parser.TableKeyString = next as parser.TableKeyString;
        const name = field.key.name;

        switch (name) {
            case 'name': {
                if (field.value.type === 'StringLiteral') {
                    info.name = (field.value as parser.StringLiteral).raw;
                    info.name = info.name.substring(1, info.name.length - 1);
                }
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
                if (field.value.type === 'StringLiteral') {
                    info.version = (field.value as parser.StringLiteral).raw;
                    info.version = info.version.substring(1, info.version.length - 1);
                }
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

    if (info.description === 'external') {
        const uriMD = uri.replace('.lua', '.md');
        if (fs.existsSync(uriMD)) {
            info.description = fs.readFileSync(uriMD).toString().trim();
        } else {
            info.description = undefined;
        }
    }

    return info;
};
