import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { API_JSON, formatApi, generateApi } from '../scripts/api.mts';

test('the docs site API reference is up to date (run `npm run docs:api` to update it)', async () => {
    const committed = readFileSync(API_JSON, 'utf8');
    expect(committed).toBe(await formatApi(await generateApi()));
}, 60_000);
