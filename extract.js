import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const historyFile = './migrated_prompt_history/prompt_2026-02-12T20:59:13.901Z.json';
const data = JSON.parse(fs.readFileSync(historyFile, 'utf8'));

function traverse(obj) {
  if (Array.isArray(obj)) {
    obj.forEach(traverse);
  } else if (obj && typeof obj === 'object') {
    if (obj.path && obj.path.startsWith('components/')) {
      const content = obj.replacement || obj.content;
      if (content) {
        const fullPath = path.join(__dirname, obj.path);
        console.log('Writing to:', fullPath);
        fs.writeFileSync(fullPath, content);
      }
    }
    Object.values(obj).forEach(traverse);
  }
}

traverse(data);
