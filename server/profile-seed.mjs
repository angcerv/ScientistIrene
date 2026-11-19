import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanProfile } from './profile.mjs';
import { emptyProfile } from './match.mjs';

export const seedPath = 'data/Perfil-Irene.json';

export function loadProfileSeed() {
  try {
    const seed = cleanProfile(JSON.parse(readFileSync(resolve(seedPath), 'utf8')));
    if (seed.education && seed.experience && seed.skills) return seed;
    throw new Error('El perfil inicial debe incluir formación, experiencia y habilidades.');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

export function initializeProfile(db, seed) {
  if (!seed) return;
  db.exec('BEGIN IMMEDIATE');
  try {
    const key = 'initial-profile';
    const applied = db.prepare('SELECT id FROM profile_setup WHERE id = ?').get(key);
    if (!applied) {
      const row = db.prepare('SELECT data FROM profile WHERE id = 1').get();
      const current = row ? cleanProfile(JSON.parse(row.data)) : emptyProfile;
      const hasCustomLocation = current.location && (current.location !== emptyProfile.location || current.interests || current.preferences);
      const merged = { ...seed };
      for (const [field, value] of Object.entries(current)) {
        if (value && (field !== 'location' || hasCustomLocation)) merged[field] = value;
      }
      db.prepare('INSERT INTO profile (id, data) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data')
        .run(JSON.stringify(merged));
      db.prepare('INSERT INTO profile_setup (id) VALUES (?)').run(key);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
