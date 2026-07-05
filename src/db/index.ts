import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import { seedVercel } from './seed-vercel';
import path from 'path';
import fs from 'fs';

const isVercel = !!process.env.VERCEL;
const dbPath = isVercel ? '/tmp/sqlite.db' : 'sqlite.db';

const sqlite = new Database(dbPath);
export const db = drizzle(sqlite, { schema });
export type DbClient = typeof db;

// Programmatically create schema and seed data in Vercel environment
if (isVercel) {
  try {
    const tableExists = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
    if (!tableExists) {
      console.log('Vercel environment detected. Initializing database schema and seeding...');
      
      const sqlFilePath = path.join(process.cwd(), 'src/db/migrations/0000_hot_black_tom.sql');
      if (fs.existsSync(sqlFilePath)) {
        const sqlContent = fs.readFileSync(sqlFilePath, 'utf-8');
        const statements = sqlContent.split('--> statement-breakpoint');
        
        for (const statement of statements) {
          if (statement.trim()) {
            sqlite.exec(statement);
          }
        }
        console.log('Schema created successfully.');
        
        // Seed database
        seedVercel(db);
        console.log('Database seeded successfully.');
      } else {
        console.warn('SQL migration file not found at:', sqlFilePath);
      }
    }
  } catch (error) {
    console.error('Error during Vercel database initialization:', error);
  }
}
