import { users, courses, enrollments, posts } from './schema';
import { sql } from 'drizzle-orm';
import { type DbClient } from './index';

export function seedVercel(db: DbClient) {
  // Enable foreign keys
  db.run(sql`PRAGMA foreign_keys = ON`);

  // 1. Seed courses
  const courseMath = { id: 'course-1', name: 'Introduction to Mathematics' };
  const coursePhysics = { id: 'course-2', name: 'Advanced Physics' };
  db.insert(courses).values([courseMath, coursePhysics]).run();

  // 2. Seed users
  const userAlice = { id: 'alice', name: 'Alice (Math Student)', role: 'student' as const };
  const userBob = { id: 'bob', name: 'Bob (Physics Student)', role: 'student' as const };
  const userCharlie = { id: 'charlie', name: 'Charlie (Dual Student)', role: 'student' as const };
  const userMallory = { id: 'mallory', name: 'Mallory (Moderator)', role: 'moderator' as const };
  db.insert(users).values([userAlice, userBob, userCharlie, userMallory]).run();

  // 3. Seed enrollments
  db.insert(enrollments).values([
    { userId: 'alice', courseId: 'course-1' },
    { userId: 'bob', courseId: 'course-2' },
    { userId: 'charlie', courseId: 'course-1' },
    { userId: 'charlie', courseId: 'course-2' },
  ]).run();

  // 4. Seed posts
  const now = new Date();
  db.insert(posts).values([
    {
      id: 'post-1',
      courseId: 'course-1',
      title: 'Algebra Basics',
      content: 'Let\'s discuss linear equations and matrices.',
      authorId: 'charlie',
      createdAt: new Date(now.getTime() - 1000 * 60 * 60),
    },
    {
      id: 'post-2',
      courseId: 'course-1',
      title: 'Calculus Limits',
      content: 'What is the intuitive definition of a limit? Is it just a boundary?',
      authorId: 'alice',
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 2),
    },
    {
      id: 'post-3',
      courseId: 'course-2',
      title: 'Quantum Mechanics',
      content: 'Discussion about wave-particle duality and the double-slit experiment.',
      authorId: 'bob',
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 3),
    },
    {
      id: 'post-4',
      courseId: 'course-2',
      title: 'Special Relativity',
      content: 'Let\'s talk about time dilation and length contraction near the speed of light.',
      authorId: 'charlie',
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 4),
    },
  ]).run();
}
