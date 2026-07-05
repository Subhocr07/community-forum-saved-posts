import { NextRequest } from 'next/server';
import { db } from '@/db';
import { posts, savedPosts } from '@/db/schema';
import { getAuthContext, handleApiError } from '@/lib/auth';
import { AuthError } from '@/lib/business-logic';
import { eq, and, desc, sql } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);

    const url = new URL(req.url);
    const requestedUserId = url.searchParams.get('userId');
    
    // Enforce OWN constraint: a student can only read their own saved list.
    if (requestedUserId && requestedUserId !== auth.userId) {
      throw new AuthError('A student can only read their own saved list — never another user\'s.', 403);
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

    const result = await db
      .select({
        id: posts.id,
        courseId: posts.courseId,
        title: posts.title,
        content: posts.content,
        authorId: posts.authorId,
        createdAt: posts.createdAt,
        savedAt: savedPosts.savedAt,
        savesCount: sql<number>`coalesce(${savesCountSubquery.count}, 0)`,
        hasSaved: sql<number>`1`,
      })
      .from(savedPosts)
      .innerJoin(posts, eq(savedPosts.postId, posts.id))
      .leftJoin(savesCountSubquery, eq(posts.id, savesCountSubquery.postId))
      .where(and(eq(savedPosts.userId, auth.userId), eq(savedPosts.isActive, true)))
      .orderBy(desc(savedPosts.savedAt))
      .limit(limit)
      .offset(offset);

    const hydratedPosts = result.map((item) => ({
      ...item,
      savesCount: Number(item.savesCount),
      hasSaved: true,
    }));

    return Response.json(hydratedPosts);
  } catch (error) {
    return handleApiError(error);
  }
}
