/**
 * @type {import('semantic-release').GlobalConfig}
 */
module.exports = {
    branches: ['main'],
    plugins: [
        [
            '@semantic-release/commit-analyzer',
            {
                preset: 'conventionalcommits',
                releaseRules: [
                    // Major Releases are for Breaking Changes only!
                    { breaking: true, release: 'major' },

                    // Minor Releases:
                    { type: 'feat', release: 'minor' },
                    { type: 'feature', release: 'minor' },

                    // Patch Releases:
                    { revert: true, release: 'patch' },
                    { type: 'revert', release: 'patch' },
                    { type: 'chore', release: 'patch' },
                    { type: 'fix', release: 'patch' },
                    { type: 'perf', release: 'patch' },
                    { type: 'chore', release: 'patch' },
                    { type: 'refactor', release: 'patch' },
                    { type: 'build', release: 'patch' },
                    { type: 'docs', scope: 'README', release: 'patch' },
                    { type: 'docs', scope: 'code', release: 'patch' },
                    { type: 'test', release: 'patch' },
                    { type: 'style', release: 'patch' },

                    // No Releases:
                    { type: 'ci', release: false },
                    { type: 'docs', scope: 'pages', release: false },
                ],
            },
        ],
        [
            '@semantic-release/release-notes-generator',
            {
                preset: 'conventionalcommits',
                presetConfig: {
                    types: [
                        { type: 'feat', section: 'Features', hidden: false },
                        { type: 'feature', section: 'Features', hidden: false },
                        { type: 'fix', section: 'Bug Fixes', hidden: false },
                        {
                            type: 'perf',
                            section: 'Performance Improvements',
                            hidden: false,
                        },
                        { type: 'revert', section: 'Reverts', hidden: false },
                        {
                            type: 'docs',
                            section: 'Documentation',
                            hidden: false,
                        },
                        { type: 'style', section: 'Styles', hidden: false },
                        {
                            type: 'chore',
                            section: 'Miscellaneous Chores',
                            hidden: false,
                        },
                        {
                            type: 'refactor',
                            section: 'Code Refactoring',
                            hidden: false,
                        },
                        { type: 'test', section: 'Tests', hidden: false },
                        {
                            type: 'build',
                            section: 'Build System',
                            hidden: false,
                        },
                        {
                            type: 'ci',
                            section: 'Continuous Integration',
                            hidden: false,
                        },
                    ],
                },
            },
        ],
        '@semantic-release/github',
        '@semantic-release/npm',
    ],
};
