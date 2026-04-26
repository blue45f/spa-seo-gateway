/**
 * config 의 zod 스키마에서 JSON Schema 를 생성해 schema/ 디렉토리에 저장.
 * seo-gateway.config.json 의 $schema 가 이 파일을 가리키면 IDE 자동완성이 활성화됨.
 *
 *   tsx scripts/generate-schema.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ConfigSchema } from '@spa-seo-gateway/core';
// @ts-expect-error — zod is a transitive dep of core; resolve via node module resolution
import { z } from 'zod';

const schema = z.toJSONSchema(ConfigSchema, {
  target: 'draft-2020-12',
});

const outDir = resolve(process.cwd(), 'schema');
mkdirSync(outDir, { recursive: true });
const outFile = resolve(outDir, 'seo-gateway.config.schema.json');
writeFileSync(outFile, `${JSON.stringify(schema, null, 2)}\n`, 'utf8');
console.log(`✓ JSON Schema written: ${outFile}`);
