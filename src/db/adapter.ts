import { db } from './index';
import { users, enrollments, posts, savedPosts } from './schema';
import { eq, and } from 'drizzle-orm';
import { type BusinessLogicAdapter, type Post, type SavedPost, type User } from '../lib/business-logic';

export const dbAdapter: BusinessLogicAdapter = {
  async getUser(userId: string): Promise<User | null> {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    return user || null;
  },

  async getPost(postId: string): Promise<Post | null> {
    const [post] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
    return post || null;
  },

  async isStudentEnrolled(userId: string, courseId: string): Promise<boolean> {
    const [enrollment] = await db
      .select()
      .from(enrollments)
      .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)))
      .limit(1);
    return !!enrollment;
  },

  async getSavedPost(userId: string, postId: string): Promise<SavedPost | null> {
    const [saved] = await db
      .select()
      .from(savedPosts)
      .where(and(eq(savedPosts.userId, userId), eq(savedPosts.postId, postId)))
      .limit(1);
    return saved || null;
  },

  async upsertSavedPost(userId: string, postId: string, isActive: boolean, savedAt: Date): Promise<void> {
    await db
      .insert(savedPosts)
      .values({
        userId,
        postId,
        isActive,
        savedAt,
      })
      .onConflictDoUpdate({
        target: [savedPosts.userId, savedPosts.postId],
        set: {
          isActive,
          savedAt,
        },
      });
  },
};
