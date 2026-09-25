/**
 * Generates the API reference the docs site shows (docs/src/generated/api.json) from the library source:
 * a signature for every public class member and exported function, and every exported type and class with
 * its fields' documentation. Exported values other than classes and functions (constants such as
 * InterpolationModes) are not included. tests/api.test.ts fails when the file is out of date.
 *
 * Run with `npm run docs:api` (Node 22.18 or later).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as prettier from 'prettier';
import ts from 'typescript';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'src');
const ENTRY = path.join(SOURCE, 'index.ts');
export const API_JSON = path.join(ROOT, 'docs/src/generated/api.json');

export interface ApiField {
    name: string;
    doc: string;
}

export interface ApiType {
    /** The declaration, without comments or `export` (for a class, its public members). */
    code: string;
    doc: string;
    /** The documented fields (or class members), in declaration order. */
    fields: ApiField[];
}

export interface Api {
    /**
     * Signatures of the public class members and exported functions, keyed `new Theme` (constructor),
     * `Theme#update` (instance member), `Theme.random` (static member) or the function's name.
     */
    members: Record<string, { code: string }>;
    /** Exported types and classes, keyed by name. */
    types: Record<string, ApiType>;
}

const TYPE_FLAGS =
    ts.TypeFormatFlags.NoTruncation |
    ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope;

/** Whether a file is part of the library's source (TypeScript writes paths with forward slashes). */
function inSource(file: ts.SourceFile) {
    const relative = path.relative(SOURCE, path.resolve(file.fileName));
    return !relative.startsWith('..') && !path.isAbsolute(relative);
}

export async function generateApi(): Promise<Api> {
    // the library's own compiler options
    const tsconfig = ts.getParsedCommandLineOfConfigFile(
        path.join(ROOT, 'tsconfig.json'),
        undefined,
        { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} },
    )!;
    const program = ts.createProgram([ENTRY], tsconfig.options);
    const checker = program.getTypeChecker();
    const entry = program.getSourceFile(ENTRY)!;
    const printer = ts.createPrinter({ removeComments: true });
    const prettierConfig = await prettier.resolveConfig(ENTRY);
    const indent = new RegExp(`^ {${prettierConfig?.tabWidth ?? 4}}`);

    /** Formats TypeScript as the library does, and writes chroma-js's Color as colormotion exports it. */
    async function format(code: string) {
        const formatted = await prettier.format(code, {
            parser: 'typescript',
            singleQuote: prettierConfig?.singleQuote,
            tabWidth: prettierConfig?.tabWidth,
        });
        return formatted.replace(/\bchroma\.Color\b/g, 'Color').trimEnd();
    }

    const print = (node: ts.Node) =>
        printer.printNode(ts.EmitHint.Unspecified, node, node.getSourceFile());

    /** Prints a type on one line, so object types written inline stay inline when they fit. */
    function printInline(node: ts.TypeNode) {
        const flatten = (child: ts.Node): void => {
            if (ts.isTypeLiteralNode(child)) {
                ts.setEmitFlags(child, ts.EmitFlags.SingleLine);
            }
            ts.forEachChild(child, flatten);
        };
        flatten(node);
        return print(node);
    }

    /** JSDoc text, with {@link X} as `X`. */
    const partsText = (parts: ts.SymbolDisplayPart[] = []) =>
        parts
            .map((part) =>
                part.kind === 'link'
                    ? ''
                    : part.kind === 'linkName'
                      ? `\`${part.text}\``
                      : part.text,
            )
            .join('');

    /**
     * A symbol's JSDoc, followed by its @param tags as a list and its @returns and @deprecated tags, each
     * as its own paragraph.
     */
    function docOf(symbol: ts.Symbol | undefined, withTags = true) {
        if (!symbol) return '';
        const params: string[] = [];
        const notes: string[] = [];
        for (const tag of withTags ? symbol.getJsDocTags(checker) : []) {
            if (tag.name === 'param') {
                const name = tag.text?.find(
                    (part) => part.kind === 'parameterName',
                );
                const text = partsText(
                    tag.text?.filter((part) => part !== name),
                ).trim();
                if (name && text) params.push(`- \`${name.text}\`: ${text}`);
            } else if (tag.name === 'returns' || tag.name === 'return') {
                notes.push(`Returns: ${partsText(tag.text).trim()}`);
            } else if (tag.name === 'deprecated') {
                const text = partsText(tag.text).trim();
                notes.push(text ? `Deprecated: ${text}` : 'Deprecated.');
            }
        }
        return [
            partsText(symbol.getDocumentationComment(checker)),
            params.join('\n'),
            ...notes,
        ]
            .filter(Boolean)
            .join('\n\n');
    }

    /** A type as written, or as inferred when it isn't. */
    const typeText = (
        node: ts.TypeNode | undefined,
        inferred: () => ts.Type,
        at: ts.Node,
    ) =>
        node
            ? printInline(node)
            : checker.typeToString(inferred(), at, TYPE_FLAGS);

    const typeParameters = (node: ts.DeclarationWithTypeParameterChildren) =>
        node.typeParameters
            ? `<${node.typeParameters.map(print).join(', ')}>`
            : '';

    function parameter(p: ts.ParameterDeclaration) {
        // a destructured parameter is an options object
        const name = ts.isIdentifier(p.name) ? p.name.text : 'options';
        const rest = p.dotDotDotToken ? '...' : '';
        const optional = checker.isOptionalParameter(p) ? '?' : '';
        const type = typeText(
            p.type,
            () => checker.getTypeAtLocation(p.name),
            p,
        );
        return `${rest}${name}${optional}: ${type}`;
    }

    const parameters = (fn: ts.SignatureDeclaration) =>
        fn.parameters.map(parameter).join(', ');

    const returnType = (
        fn:
            | ts.MethodDeclaration
            | ts.FunctionDeclaration
            | ts.GetAccessorDeclaration,
    ) =>
        typeText(
            fn.type,
            () =>
                checker.getReturnTypeOfSignature(
                    checker.getSignatureFromDeclaration(fn)!,
                ),
            fn,
        );

    const modifiers = (node: ts.Declaration) =>
        ts.getCombinedModifierFlags(node);

    const isPublic = (node: ts.Declaration) =>
        !(
            modifiers(node) &
            (ts.ModifierFlags.Private | ts.ModifierFlags.Protected)
        );

    /** The public members of a class, without overload implementations (their overloads are listed). */
    const publicMembers = (node: ts.ClassDeclaration) =>
        node.members.filter(
            (member) =>
                !(member.name && ts.isPrivateIdentifier(member.name)) &&
                isPublic(member) &&
                !(
                    ts.isFunctionLike(member) &&
                    checker.isImplementationOfOverload(member)
                ),
        );

    function modifierPrefix(node: ts.Declaration) {
        const flags = modifiers(node);
        return (
            (flags & ts.ModifierFlags.Static ? 'static ' : '') +
            (flags & ts.ModifierFlags.Readonly ? 'readonly ' : '')
        );
    }

    /** A member as a .d.ts declares it, without the semicolon. */
    function declaration(member: ts.ClassElement): string | undefined {
        const prefix = modifierPrefix(member);
        const name = member.name?.getText();
        const optional = (member as ts.MethodDeclaration).questionToken
            ? '?'
            : '';
        if (ts.isConstructorDeclaration(member)) {
            return `constructor(${parameters(member)})`;
        }
        if (ts.isMethodDeclaration(member)) {
            return `${prefix}${name}${optional}${typeParameters(member)}(${parameters(member)}): ${returnType(member)}`;
        }
        if (ts.isGetAccessorDeclaration(member)) {
            return `${prefix}get ${name}(): ${returnType(member)}`;
        }
        if (ts.isSetAccessorDeclaration(member)) {
            return `${prefix}set ${name}(${parameters(member)})`;
        }
        if (ts.isPropertyDeclaration(member)) {
            const type = typeText(
                member.type,
                () => checker.getTypeAtLocation(member),
                member,
            );
            return `${prefix}${name}${optional}: ${type}`;
        }
        return undefined;
    }

    /** Declarations formatted as the body of a class. */
    const classBody = (className: string, declarations: string[]) =>
        format(
            `declare class ${className} {\n${declarations.map((d) => `${d};`).join('\n')}\n}`,
        );

    /** Declarations formatted as members of a class, outside it. */
    async function formatMembers(className: string, declarations: string[]) {
        const lines = (await classBody(className, declarations)).split('\n');
        return lines
            .slice(1, -1)
            .map((line) => line.replace(indent, ''))
            .join('\n');
    }

    /** Fields of the object types written in a type, not of the types it refers to. */
    function literalFields(node: ts.TypeNode, fields: Map<string, string>) {
        if (ts.isTypeLiteralNode(node)) {
            for (const member of node.members) {
                if (!member.name) continue;
                const name = member.name.getText();
                // a field in several branches of a union keeps the first documentation found
                if (!fields.get(name)) {
                    fields.set(
                        name,
                        docOf(checker.getSymbolAtLocation(member.name)),
                    );
                }
            }
        } else if (
            ts.isUnionTypeNode(node) ||
            ts.isIntersectionTypeNode(node)
        ) {
            node.types.forEach((type) => literalFields(type, fields));
        } else if (ts.isParenthesizedTypeNode(node)) {
            literalFields(node.type, fields);
        }
    }

    const documented = (fields: Map<string, string>) =>
        [...fields]
            .filter(([, doc]) => doc)
            .map(([name, doc]) => ({ name, doc }));

    const unparenthesized = (node: ts.TypeNode): ts.TypeNode =>
        ts.isParenthesizedTypeNode(node) ? unparenthesized(node.type) : node;

    /** The value X of a type written `(typeof X)[keyof typeof X]` (the values of a constant object). */
    function valuesOf(node: ts.TypeNode): ts.Symbol | undefined {
        const type = unparenthesized(node);
        if (!ts.isIndexedAccessTypeNode(type)) return undefined;
        const object = unparenthesized(type.objectType);
        return ts.isTypeQueryNode(object)
            ? checker.getSymbolAtLocation(object.exprName)
            : undefined;
    }

    const api: Api = { members: {}, types: {} };

    async function addClass(name: string, node: ts.ClassDeclaration) {
        const outline: string[] = [];
        const fields = new Map<string, string>();
        // declarations under each key: a getter and its setter, or a method's overloads, share one
        const signatures = new Map<string, string[]>();
        const add = (key: string, text: string) => {
            outline.push(text);
            signatures.set(key, [...(signatures.get(key) ?? []), text]);
        };
        const addField = (
            field: string,
            symbolNode: ts.Node,
            withTags = true,
        ) => {
            if (!fields.get(field)) {
                fields.set(
                    field,
                    docOf(checker.getSymbolAtLocation(symbolNode), withTags),
                );
            }
        };
        for (const member of publicMembers(node)) {
            const text = declaration(member);
            if (text === undefined) continue;
            if (ts.isConstructorDeclaration(member)) {
                add(`new ${name}`, text);
                // parameter properties (constructor(readonly seed: number)) are properties too
                for (const p of member.parameters) {
                    if (
                        ts.isParameterPropertyDeclaration(p, member) &&
                        isPublic(p)
                    ) {
                        const property = p.name.getText();
                        const type = typeText(
                            p.type,
                            () => checker.getTypeAtLocation(p.name),
                            p,
                        );
                        add(
                            `${name}#${property}`,
                            `${modifierPrefix(p)}${property}${p.questionToken ? '?' : ''}: ${type}`,
                        );
                        // its @param tag is its documentation
                        addField(property, p.name, false);
                    }
                }
                continue;
            }
            const memberName = member.name!.getText();
            const isStatic = modifiers(member) & ts.ModifierFlags.Static;
            add(`${name}${isStatic ? '.' : '#'}${memberName}`, text);
            addField(
                isStatic ? `static ${memberName}` : memberName,
                member.name!,
            );
        }
        for (const [key, texts] of signatures) {
            api.members[key] = {
                code: (await formatMembers(name, texts)).replace(
                    /^constructor/gm,
                    `new ${name}`,
                ),
            };
        }
        api.types[name] = {
            code: (
                await classBody(`${name}${typeParameters(node)}`, outline)
            ).replace(/^declare /, ''),
            doc: docOf(checker.getSymbolAtLocation(node.name!)),
            fields: documented(fields),
        };
    }

    for (const exported of checker.getExportsOfModule(
        checker.getSymbolAtLocation(entry)!,
    )) {
        const symbol =
            exported.flags & ts.SymbolFlags.Alias
                ? checker.getAliasedSymbol(exported)
                : exported;
        const name = exported.name;
        const functions: string[] = [];
        for (const node of symbol.declarations ?? []) {
            // only the library's own declarations: chroma-js has its own docs
            if (!inSource(node.getSourceFile())) continue;
            if (name !== symbol.name) {
                throw new Error(
                    `scripts/api.mts doesn't support renamed exports yet (${symbol.name} as ${name})`,
                );
            }

            if (ts.isClassDeclaration(node)) {
                await addClass(name, node);
            } else if (ts.isFunctionDeclaration(node)) {
                if (checker.isImplementationOfOverload(node)) continue;
                functions.push(
                    `declare function ${name}${typeParameters(node)}(${parameters(node)}): ${returnType(node)};`,
                );
            } else if (ts.isInterfaceDeclaration(node)) {
                const fields = new Map<string, string>();
                for (const property of checker.getPropertiesOfType(
                    checker.getDeclaredTypeOfSymbol(symbol),
                )) {
                    fields.set(property.name, docOf(property));
                }
                api.types[name] = {
                    code: (await format(print(node))).replace(/^export /, ''),
                    doc: docOf(symbol),
                    fields: documented(fields),
                };
            } else if (ts.isTypeAliasDeclaration(node)) {
                // the values of a constant object read better as the union they resolve to,
                // documented by the constant and its members
                const source = valuesOf(node.type);
                const fields = new Map<string, string>();
                let code: string;
                let doc = docOf(symbol);
                if (source) {
                    const resolved = checker.typeToString(
                        checker.getDeclaredTypeOfSymbol(symbol),
                        undefined,
                        TYPE_FLAGS | ts.TypeFormatFlags.InTypeAlias,
                    );
                    code = `type ${name} = ${resolved};`;
                    doc ||= docOf(source);
                    for (const property of checker.getPropertiesOfType(
                        checker.getTypeOfSymbol(source),
                    )) {
                        fields.set(property.name, docOf(property));
                    }
                } else {
                    code = print(node);
                    literalFields(node.type, fields);
                }
                api.types[name] = {
                    code: (await format(code)).replace(/^export /, ''),
                    doc,
                    fields: documented(fields),
                };
            } else if (ts.isEnumDeclaration(node)) {
                throw new Error(
                    `scripts/api.mts doesn't support enums yet (${name})`,
                );
            }
        }
        if (functions.length > 0) {
            api.members[name] = {
                code: (await format(functions.join('\n'))).replace(
                    /^declare /gm,
                    '',
                ),
            };
        }
    }
    return api;
}

/** The API reference as written to API_JSON. */
export async function formatApi(api: Api) {
    return prettier.format(JSON.stringify(api), {
        parser: 'json',
        tabWidth: (await prettier.resolveConfig(API_JSON))?.tabWidth,
    });
}

if (
    process.argv[1] &&
    import.meta.url === pathToFileURL(process.argv[1]).href
) {
    await mkdir(path.dirname(API_JSON), { recursive: true });
    await writeFile(API_JSON, await formatApi(await generateApi()));
    console.log(`Wrote ${path.relative(ROOT, API_JSON)}`);
}
