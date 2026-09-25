import api from '~/generated/api.json';

/**
 * The API reference generated from the library source by scripts/api.mts (`npm run docs:api` in the
 * repo root). A key that no longer exists fails the docs type-check.
 */
export { api };

/** `new Theme`, `Theme#update` (instance member), `Theme.random` (static member), or a function's name. */
export type MemberKey = keyof typeof api.members;

export type TypeName = keyof typeof api.types;

/** The order of the Types section; any exported type not listed here follows, in export order. */
const TYPE_ORDER: TypeName[] = [
    'ThemeConfig',
    'InitialThemeColors',
    'ColorUpdateConfig',
    'RandomPaletteConfig',
    'RandomColorConfig',
    'ThemeUpdateEvent',
    'ThemeUpdateCallback',
    'ColorInput',
    'InterpolationMode',
    'BrightnessMode',
    'RandomFunction',
    'ColorPalette',
    'ColorPaletteConfig',
    'ColorPaletteColors',
];

/** Types with their own section elsewhere on the page. */
const DOCUMENTED_ELSEWHERE: Partial<Record<TypeName, string>> = {
    Theme: '#theme',
};

/** The types in the Types section, in order. */
export const TYPE_SECTIONS: TypeName[] = [
    ...TYPE_ORDER,
    ...(Object.keys(api.types) as TypeName[]).filter(
        (name) => !TYPE_ORDER.includes(name) && !DOCUMENTED_ELSEWHERE[name],
    ),
];

export const typeAnchor = (name: TypeName) => `type-${name}`;

/** Where each type name in a code block links to. */
export const TYPE_LINKS: Record<string, string> = {
    ...DOCUMENTED_ELSEWHERE,
    ...Object.fromEntries(
        TYPE_SECTIONS.map((name) => [name, `#${typeAnchor(name)}`]),
    ),
    // chroma-js types
    Color: 'https://gka.github.io/chroma.js/#color',
    Scale: 'https://gka.github.io/chroma.js/#chroma-scale',
};
