import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  role: text('role', { enum: ['student', 'moderator'] }).notNull(),
});

export const courses = sqliteTable('courses', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
});

export const enrollments = sqliteTable('enrollments', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  courseId: text('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
}, (table) => [
  primaryKey({ columns: [table.userId, table.courseId] })
]);

export const posts = sqliteTable('posts', {
  id: text('id').primaryKey(),
  courseId: text('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  content: text('content').notNull(),
  authorId: text('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const savedPosts = sqliteTable('saved_posts', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  postId: text('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  savedAt: integer('saved_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.postId] })
]);
