import { NextRequest } from 'next/server';
import { db } from '@/db';
import { posts, savedPosts, enrollments } from '@/db/schema';
import { getAuthContext, handleApiError } from '@/lib/auth';
import { AuthError } from '@/lib/business-logic';
import { eq, and, desc, sql } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);

    const url = new URL(req.url);
    const courseId = url.searchParams.get('courseId');
    if (!courseId) {
      return new Response(JSON.stringify({ error: 'Missing courseId parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 1. Enforce student enrollment check
    if (auth.role === 'student') {
      const [enrollment] = await db
        .select()
        .from(enrollments)
        .where(and(eq(enrollments.userId, auth.userId), eq(enrollments.courseId, courseId)))
        .limit(1);

      if (!enrollment) {
        throw new AuthError('Student saving / reading a post in a course they\'re not enrolled in.', 403);
      }
    }

    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.max(1, parseInt(url.searchParams.get('limit') || '10'));
    const offset = (page - 1) * limit;

    // Subquery for total active saves per post
    const savesCountSubquery = db
      .select({
        postId: savedPosts.postId,
        count: sql<number>`count(*)`.as('count'),
      })
      .from(savedPosts)
      .where(eq(savedPosts.isActive, true))
      .groupBy(savedPosts.postId)
      .as('saves_count_sub');

    // Subquery to check if current user has saved the post
    const hasSavedSubquery = db
      .select({
        postId: savedPosts.postId,
        hasSaved: sql<number>`1`.as('has_saved'),
      })
      .from(savedPosts)
      .where(and(eq(savedPosts.userId, auth.userId), eq(savedPosts.isActive, true)))
      .as('has_saved_sub');

    const result = await db
      .select({
        id: posts.id,
        courseId: posts.courseId,
        title: posts.title,
        content: posts.content,
        authorId: posts.authorId,
        createdAt: posts.createdAt,
        savesCount: sql<number>`coalesce(${savesCountSubquery.count}, 0)`,
        hasSaved: sql<number>`coalesce(${hasSavedSubquery.hasSaved}, 0)`,
      })
      .from(posts)
      .leftJoin(savesCountSubquery, eq(posts.id, savesCountSubquery.postId))
      .leftJoin(hasSavedSubquery, eq(posts.id, hasSavedSubquery.postId))
      .where(eq(posts.courseId, courseId))
      .orderBy(desc(posts.createdAt))
      .limit(limit)
      .offset(offset);

    // Map to proper types (number and boolean)
    const hydratedPosts = result.map((item) => ({
      ...item,
      savesCount: Number(item.savesCount),
      hasSaved: item.hasSaved === 1,
    }));

    return Response.json(hydratedPosts);
  } catch (error) {
    return handleApiError(error);
  }
}
