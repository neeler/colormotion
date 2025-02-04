/**
 * @see https://prettier.io/docs/en/configuration.html
 * @type {import("prettier").Config & import("@trivago/prettier-plugin-sort-imports").PrettierConfig}
 */
const config = {
    singleQuote: true,
    tabWidth: 4,
    importOrder: [
        'regenerator-runtime',
        '<THIRD_PARTY_MODULES>',
        '^~/(.*)$',
        '^[./]',
    ],
    plugins: ['@trivago/prettier-plugin-sort-imports'],
};

module.exports = config;
