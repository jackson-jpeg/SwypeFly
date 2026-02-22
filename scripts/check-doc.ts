import fs from 'fs';
import path from 'path';
import { Client, Databases, Query } from 'node-appwrite';

for (const f of ['.env', '.env.local']) {
  const p = path.resolve(process.cwd(), f);
  if (!fs.existsSync(p)) continue;
  for (const l of fs.readFileSync(p, 'utf-8').split('\n')) {
    const t = l.trim(); if (!t || t.startsWith('#')) continue;
    const [k, ...r] = t.split('=');
    process.env[k.trim()] = r.join('=').trim().replace(/^["']|["']$/g, '');
  }
}

const c = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);
const db = new Databases(c);

async function main() {
  const r = await db.listDocuments('sogojet', 'destinations', [Query.limit(1)]);
  console.log(JSON.stringify(r.documents[0], null, 2));
}
main();
