import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getPosts } from './posts/route';
import { GET as getSavedPosts } from './saved-posts/route';
import { POST as savePost } from './posts/[postId]/save/route';
import { POST as unsavePost } from './posts/[postId]/unsave/route';
import { db } from '@/db';
import { savedPosts } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

describe('API Authorization & Integration Tests', () => {
  // Clear any saved posts before each test to keep it clean
  beforeEach(async () => {
    await db.delete(savedPosts);
  });

  const createRequest = (url: string, headers?: Record<string, string>, method = 'GET') => {
    return new NextRequest(url, {
      method,
      headers: new Headers(headers),
    });
  };

  describe('Authentication Check (401)', () => {
    it('should return 401 for GET /api/posts without headers', async () => {
      const req = createRequest('http://localhost/api/posts?courseId=course-1');
      const res = await getPosts(req);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe('Unauthenticated request.');
    });

    it('should return 401 for POST /api/posts/post-1/save without headers', async () => {
      const req = createRequest(
        'http://localhost/api/posts/post-1/save',
        undefined,
        'POST'
      );
      const res = await savePost(req, { params: Promise.resolve({ postId: 'post-1' }) });
      expect(res.status).toBe(401);
    });
  });

  describe('Course Enrollment Access Check (403)', () => {
    it('should return 403 when student Alice tries to read Course 2 (Physics)', async () => {
      const req = createRequest('http://localhost/api/posts?courseId=course-2', {
        'x-user-id': 'alice',
        'x-role': 'student',
      });
      const res = await getPosts(req);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toContain('Student saving / reading a post in a course they\'re not enrolled in');
    });

    it('should allow student Alice to read Course 1 (Math)', async () => {
      const req = createRequest('http://localhost/api/posts?courseId=course-1', {
        'x-user-id': 'alice',
        'x-role': 'student',
      });
      const res = await getPosts(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThan(0);
    });

    it('should return 403 when student Alice tries to save Course 2 post (post-3)', async () => {
      const req = createRequest(
        'http://localhost/api/posts/post-3/save',
        {
          'x-user-id': 'alice',
          'x-role': 'student',
        },
        'POST'
      );
      const res = await savePost(req, { params: Promise.resolve({ postId: 'post-3' }) });
      expect(res.status).toBe(403);
    });

    it('should allow moderator Mallory to read Course 2 (Physics) even if not enrolled', async () => {
      const req = createRequest('http://localhost/api/posts?courseId=course-2', {
        'x-user-id': 'mallory',
        'x-role': 'moderator',
      });
      const res = await getPosts(req);
      expect(res.status).toBe(200);
    });
  });

  describe('Post Existence check (404)', () => {
    it('should return 404 when saving a non-existent post', async () => {
      const req = createRequest(
        'http://localhost/api/posts/non-existent/save',
        {
          'x-user-id': 'alice',
          'x-role': 'student',
        },
        'POST'
      );
      const res = await savePost(req, { params: Promise.resolve({ postId: 'non-existent' }) });
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toContain('Request for a post that doesn\'t exist');
    });
  });

  describe('OWN Constraint check (OWN)', () => {
    it('should return 403 when Alice tries to view Bob\'s saved list', async () => {
      const req = createRequest('http://localhost/api/saved-posts?userId=bob', {
        'x-user-id': 'alice',
        'x-role': 'student',
      });
      const res = await getSavedPosts(req);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toContain('A student can only read their own saved list');
    });

    it('should allow Alice to view her own saved list', async () => {
      const req = createRequest('http://localhost/api/saved-posts?userId=alice', {
        'x-user-id': 'alice',
        'x-role': 'student',
      });
      const res = await getSavedPosts(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
    });
  });

  describe('Happy Path: Save -> Hydrated Flag Check -> Unsave', () => {
    it('should save a post, verify hydrated flags, and then unsave', async () => {
      const headers = {
        'x-user-id': 'alice',
        'x-role': 'student',
      };

      interface TestPost {
        id: string;
        hasSaved: boolean;
        savesCount: number;
      }

      // 1. Initial check: post-1 has hasSaved = false, savesCount = 0
      const getReqBefore = createRequest('http://localhost/api/posts?courseId=course-1', headers);
      const getResBefore = await getPosts(getReqBefore);
      const postsBefore = (await getResBefore.json()) as TestPost[];
      const post1Before = postsBefore.find((p) => p.id === 'post-1');
      expect(post1Before).toBeDefined();
      expect(post1Before?.hasSaved).toBe(false);
      expect(post1Before?.savesCount).toBe(0);

      // 2. Alice saves post-1
      const saveReq = createRequest('http://localhost/api/posts/post-1/save', headers, 'POST');
      const saveRes = await savePost(saveReq, { params: Promise.resolve({ postId: 'post-1' }) });
      expect(saveRes.status).toBe(200);

      // 3. Verify in feed: post-1 should have hasSaved = true, savesCount = 1
      const getReqAfter = createRequest('http://localhost/api/posts?courseId=course-1', headers);
      const getResAfter = await getPosts(getReqAfter);
      const postsAfter = (await getResAfter.json()) as TestPost[];
      const post1After = postsAfter.find((p) => p.id === 'post-1');
      expect(post1After).toBeDefined();
      expect(post1After?.hasSaved).toBe(true);
      expect(post1After?.savesCount).toBe(1);

      // 4. Verify in Alice's saved posts list
      const savedListReq = createRequest('http://localhost/api/saved-posts', headers);
      const savedListRes = await getSavedPosts(savedListReq);
      const savedPostsList = (await savedListRes.json()) as TestPost[];
      expect(savedPostsList.length).toBe(1);
      expect(savedPostsList[0].id).toBe('post-1');
      expect(savedPostsList[0].hasSaved).toBe(true);
      expect(savedPostsList[0].savesCount).toBe(1);

      // 5. Alice unsaves post-1
      const unsaveReq = createRequest('http://localhost/api/posts/post-1/unsave', headers, 'POST');
      const unsaveRes = await unsavePost(unsaveReq, { params: Promise.resolve({ postId: 'post-1' }) });
      expect(unsaveRes.status).toBe(200);

      // 6. Verify feed: post-1 has hasSaved = false, savesCount = 0
      const getReqFinal = createRequest('http://localhost/api/posts?courseId=course-1', headers);
      const getResFinal = await getPosts(getReqFinal);
      const postsFinal = (await getResFinal.json()) as TestPost[];
      const post1Final = postsFinal.find((p) => p.id === 'post-1');
      expect(post1Final).toBeDefined();
      expect(post1Final?.hasSaved).toBe(false);
      expect(post1Final?.savesCount).toBe(0);

      // 7. Verify soft deleted record in DB is preserved
      const dbSaved = await db
        .select()
        .from(savedPosts)
        .where(and(eq(savedPosts.userId, 'alice'), eq(savedPosts.postId, 'post-1')));
      expect(dbSaved.length).toBe(1);
      expect(dbSaved[0].isActive).toBe(false);
    });
  });
});
