// Regenerate planning/SPEC.md from planning/flows/*.flow.json without starting the app.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSpec } from '../lib/spec.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const planning = process.env.PLANNING_DIR || path.resolve(here, '..', '..', 'planning');
const dir = path.join(planning, 'flows');
const flows = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith('.flow.json'))
  .sort()
  .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
fs.writeFileSync(path.join(planning, 'SPEC.md'), buildSpec(flows));
console.log(`Wrote ${path.join(planning, 'SPEC.md')} from ${flows.length} flows`);
