const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const sqlPath = path.resolve(
  process.cwd(),
  process.argv[2] || path.join('audits', 'integridad-deportiva.sql'),
);

const prohibited = /\b(insert|update|delete|merge|alter|drop|create|truncate|grant|revoke|call|do|copy|vacuum|reindex|cluster|refresh)\b/i;

function parseAudits(source) {
  const marker = /^-- AUDIT: ([^|\r\n]+)\|([^|\r\n]+)\|([^\r\n]+)$/gm;
  const matches = [...source.matchAll(marker)];

  if (!matches.length) {
    throw new Error('El archivo no contiene marcadores -- AUDIT: CODIGO|NIVEL|DESCRIPCION');
  }

  return matches.map((match, index) => {
    const start = match.index + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index : source.length;
    const sql = source.slice(start, end).trim().replace(/;\s*$/, '');
    const withoutComments = sql.replace(/--.*$/gm, '').trim();

    if (!/^(select|with)\b/i.test(withoutComments)) {
      throw new Error(`La auditoria ${match[1].trim()} no empieza con SELECT o WITH`);
    }
    if (prohibited.test(withoutComments)) {
      throw new Error(`La auditoria ${match[1].trim()} contiene una instruccion no permitida`);
    }

    return {
      code: match[1].trim(),
      severity: match[2].trim().toLowerCase(),
      description: match[3].trim(),
      sql,
    };
  });
}

async function main() {
  const source = fs.readFileSync(sqlPath, 'utf8');
  const audits = parseAudits(source);
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE || 'ligas_barriales',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    application_name: 'ligas_barriales_readonly_audit',
  });

  const report = {
    generatedAt: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: process.env.DB_DATABASE || 'ligas_barriales',
    readOnly: true,
    source: path.relative(process.cwd(), sqlPath),
    totals: { audits: audits.length, findings: 0, errors: 0 },
    results: [],
  };

  await client.connect();
  try {
    await client.query('BEGIN READ ONLY');
    await client.query("SET LOCAL statement_timeout = '30s'");

    for (const audit of audits) {
      try {
        const result = await client.query(audit.sql);
        const rows = result.rows || [];
        report.totals.findings += rows.length;
        report.results.push({
          ...audit,
          sql: undefined,
          count: rows.length,
          rows: rows.slice(0, 100),
          truncated: rows.length > 100,
        });
      } catch (error) {
        report.totals.errors += 1;
        report.results.push({
          ...audit,
          sql: undefined,
          count: null,
          error: error.message,
        });
        break;
      }
    }
  } finally {
    await client.query('ROLLBACK').catch(() => undefined);
    await client.end();
  }

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.totals.errors > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(JSON.stringify({ readOnly: true, fatalError: error.message }, null, 2));
  process.exitCode = 1;
});
