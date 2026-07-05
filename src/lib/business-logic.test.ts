import { describe, it, expect, beforeEach } from 'vitest';
import { savePost, unsavePost, AuthError, type BusinessLogicAdapter, type Post, type SavedPost, type User } from './business-logic';

describe('Saved Posts Business Logic', () => {
  let mockDb: {
    users: Map<string, User>;
    posts: Map<string, Post>;
    enrollments: Set<string>; // key: "userId:courseId"
    savedPosts: Map<string, SavedPost>; // key: "userId:postId"
  };

  let adapter: BusinessLogicAdapter;

  beforeEach(() => {
    mockDb = {
      users: new Map(),
      posts: new Map(),
      enrollments: new Set(),
      savedPosts: new Map(),
    };

    adapter = {
      async getUser(userId) {
        return mockDb.users.get(userId) || null;
      },
      async getPost(postId) {
        return mockDb.posts.get(postId) || null;
      },
      async isStudentEnrolled(userId, courseId) {
        return mockDb.enrollments.has(`${userId}:${courseId}`);
      },
      async getSavedPost(userId, postId) {
        return mockDb.savedPosts.get(`${userId}:${postId}`) || null;
      },
      async upsertSavedPost(userId, postId, isActive, savedAt) {
        mockDb.savedPosts.set(`${userId}:${postId}`, {
          userId,
          postId,
          isActive,
          savedAt,
        });
      },
    };

    // Seed mock data
    mockDb.users.set('student-alice', { id: 'student-alice', role: 'student' });
    mockDb.users.set('student-bob', { id: 'student-bob', role: 'student' });
    mockDb.users.set('moderator-mallory', { id: 'moderator-mallory', role: 'moderator' });

    mockDb.posts.set('post-math', { id: 'post-math', courseId: 'course-math' });
    mockDb.posts.set('post-physics', { id: 'post-physics', courseId: 'course-physics' });

    mockDb.enrollments.add('student-alice:course-math');
    mockDb.enrollments.add('student-bob:course-physics');
  });

  describe('savePost', () => {
    it('should save a post for an enrolled student (happy path)', async () => {
      const result = await savePost('student-alice', 'post-math', adapter);
      expect(result.success).toBe(true);
      expect(result.action).toBe('created');

      const saved = mockDb.savedPosts.get('student-alice:post-math');
      expect(saved).toBeDefined();
      expect(saved?.isActive).toBe(true);
    });

    it('should be idempotent when saving an already saved post', async () => {
      // Pre-save
      await savePost('student-alice', 'post-math', adapter);
      const savedBefore = mockDb.savedPosts.get('student-alice:post-math');

      // Save again
      const result = await savePost('student-alice', 'post-math', adapter);
      expect(result.success).toBe(true);
      expect(result.action).toBe('noop');

      const savedAfter = mockDb.savedPosts.get('student-alice:post-math');
      expect(savedAfter?.savedAt).toEqual(savedBefore?.savedAt);
    });

    it('should reactivate a soft-deleted save post', async () => {
      // 1. Initial save
      await savePost('student-alice', 'post-math', adapter);
      // 2. Un-save (soft delete)
      await unsavePost('student-alice', 'post-math', adapter);
      
      const savedAfterUnsave = mockDb.savedPosts.get('student-alice:post-math');
      expect(savedAfterUnsave?.isActive).toBe(false);

      // 3. Re-save
      const result = await savePost('student-alice', 'post-math', adapter);
      expect(result.success).toBe(true);
      expect(result.action).toBe('reactivated');

      const savedFinal = mockDb.savedPosts.get('student-alice:post-math');
      expect(savedFinal?.isActive).toBe(true);
    });

    it('should throw 401 when the user is not found', async () => {
      await expect(savePost('non-existent', 'post-math', adapter)).rejects.toThrowError(
        new AuthError('Unauthenticated request.', 401)
      );
    });

    it('should throw 404 when the post is not found', async () => {
      await expect(savePost('student-alice', 'non-existent', adapter)).rejects.toThrowError(
        new AuthError('Request for a post that doesn\'t exist.', 404)
      );
    });

    it('should throw 403 when student is not enrolled in the course', async () => {
      await expect(savePost('student-alice', 'post-physics', adapter)).rejects.toThrowError(
        new AuthError('Student saving / reading a post in a course they\'re not enrolled in.', 403)
      );
    });

    it('should allow moderator to save posts in any course', async () => {
      const result = await savePost('moderator-mallory', 'post-physics', adapter);
      expect(result.success).toBe(true);
      expect(result.action).toBe('created');
    });
  });

  describe('unsavePost', () => {
    it('should soft delete an active saved post', async () => {
      // Pre-save
      await savePost('student-alice', 'post-math', adapter);
      
      const result = await unsavePost('student-alice', 'post-math', adapter);
      expect(result.success).toBe(true);
      expect(result.action).toBe('soft_deleted');

      const saved = mockDb.savedPosts.get('student-alice:post-math');
      expect(saved?.isActive).toBe(false);
    });

    it('should do nothing (noop) if the post is not saved', async () => {
      const result = await unsavePost('student-alice', 'post-math', adapter);
      expect(result.success).toBe(true);
      expect(result.action).toBe('noop');
    });

    it('should do nothing (noop) if the post is already soft-deleted', async () => {
      await savePost('student-alice', 'post-math', adapter);
      await unsavePost('student-alice', 'post-math', adapter);

      const result = await unsavePost('student-alice', 'post-math', adapter);
      expect(result.success).toBe(true);
      expect(result.action).toBe('noop');
    });

    it('should throw 403 when student is not enrolled in the course', async () => {
      await expect(unsavePost('student-alice', 'post-physics', adapter)).rejects.toThrowError(
        new AuthError('Student saving / reading a post in a course they\'re not enrolled in.', 403)
      );
    });
  });
});
