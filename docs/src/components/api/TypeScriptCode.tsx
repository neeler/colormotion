import SyntaxHighlighter, { createElement } from 'react-syntax-highlighter';
import { hybrid } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { TYPE_LINKS } from '~/components/api/api';

const TYPE_NAME = new RegExp(`\\b(${Object.keys(TYPE_LINKS).join('|')})\\b`);

const LINK_CLASSES = [
    'underline',
    'decoration-white/30',
    'underline-offset-2',
    'hover:decoration-white',
];

/** hljs tokens whose text is never a type name. */
const PLAIN_TOKENS = ['hljs-string', 'hljs-comment'];

/** Turns each type name in the highlighted code into a link to its documentation. */
function linkTypes(node: rendererNode, exclude?: string): rendererNode[] {
    if (
        node.properties?.className.some((name) => PLAIN_TOKENS.includes(name))
    ) {
        return [node];
    }
    if (node.type !== 'text') {
        return [
            {
                ...node,
                children: node.children?.flatMap((child) =>
                    linkTypes(child, exclude),
                ),
            },
        ];
    }
    // splitting on a capturing pattern keeps the matches, at the odd indexes
    return String(node.value ?? '')
        .split(TYPE_NAME)
        .flatMap((part, i): rendererNode[] => {
            if (!part) return [];
            if (i % 2 === 0 || part === exclude) {
                return [{ type: 'text', value: part }];
            }
            const href = TYPE_LINKS[part]!;
            const external = href.startsWith('http');
            return [
                {
                    type: 'element',
                    tagName: 'a',
                    properties: {
                        className: LINK_CLASSES,
                        href,
                        ...(external && {
                            target: '_blank',
                            rel: 'nofollow noreferrer',
                        }),
                    },
                    children: [{ type: 'text', value: part }],
                },
            ];
        });
}

/**
 * TypeScript highlighted like the page's other code, with each documented type name linked to its
 * documentation (except `self`, the type being shown).
 */
export function TypeScriptCode({
    code,
    self,
}: {
    code: string;
    self?: string;
}) {
    return (
        <SyntaxHighlighter
            language="typescript"
            style={hybrid}
            renderer={({ rows, stylesheet, useInlineStyles }) =>
                rows
                    .flatMap((row) => linkTypes(row, self))
                    .map((node, i) =>
                        createElement({
                            node,
                            stylesheet,
                            useInlineStyles,
                            key: `code-${i}`,
                        }),
                    )
            }
        >
            {code}
        </SyntaxHighlighter>
    );
}
