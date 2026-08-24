#!/usr/bin/env node
/**
 * Switch the Prisma datasource provider between PostgreSQL (production target)
 * and SQLite (zero-install local development).
 *
 * The schema is written so that ONLY this one line differs between the two —
 * no native enums, no Json columns, no array columns, no `@db.*` attributes.
 * That keeps a single source of truth instead of two schemas that drift.
 *
 *   node scripts/set-db-provider.mjs sqlite
 *   node scripts/set-db-provider.mjs postgresql
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const VALID = new Set(['postgresql', 'sqlite']);

const target = process.argv[2];
if (!target || !VALID.has(target)) {
  console.error(
    `Usage: node scripts/set-db-provider.mjs <${[...VALID].join('|')}>`,
  );
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(here, '..', 'prisma', 'schema.prisma');

const original = readFileSync(schemaPath, 'utf8');
const providerLine = /(datasource\s+db\s*\{[^}]*?provider\s*=\s*)"[a-z]+"/s;

if (!providerLine.test(original)) {
  console.error('Could not locate the datasource provider in prisma/schema.prisma');
  process.exit(1);
}

const updated = original.replace(providerLine, `$1"${target}"`);

if (updated === original) {
  console.log(`Prisma datasource provider already set to "${target}".`);
} else {
  writeFileSync(schemaPath, updated, 'utf8');
  console.log(`Prisma datasource provider set to "${target}".`);
}

if (target === 'sqlite') {
  console.log('\nSet DATABASE_URL in .env to a file URL, for example:');
  console.log('  DATABASE_URL="file:./dev.db"');
} else {
  console.log('\nSet DATABASE_URL in .env to your PostgreSQL connection string, for example:');
  console.log('  DATABASE_URL="postgresql://user:password@localhost:5432/fodan_college?schema=public"');
}
