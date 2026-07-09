const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'regulatory-hot', 'prisma', 'regulatory.db');
const db = new Database(dbPath);

const sqlPath = path.join(__dirname, '..', 'regulatory-hot', 'prisma', 'migrations', '20260709033000_add_fts', 'migration.sql');
const sql = fs.readFileSync(sqlPath, 'utf-8');

const statements = sql.split(';').filter(s => s.trim());
let applied = 0;
for (const stmt of statements) {
  try { db.exec(stmt + ';'); applied++; } catch (e) {
    if (!e.message.includes('already exists')) console.log('skip: ' + e.message.slice(0, 80));
  }
}
console.log('Applied ' + applied + ' FTS5 statements');

const count = db.prepare('SELECT count(*) as c FROM events_fts').get();
console.log('FTS entries: ' + count.c);

const r = db.prepare("SELECT e.id, e.titleCn FROM events e INNER JOIN events_fts f ON e.rowid = f.rowid WHERE events_fts MATCH ? LIMIT 3").all('FDA');
console.log('Search "FDA": ' + r.length + ' results');
r.forEach(x => console.log('  ' + (x.titleCn || '(no title)').slice(0, 50)));

db.close();
