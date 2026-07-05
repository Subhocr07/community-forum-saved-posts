import { NextRequest } from 'next/server';
import { db } from '@/db';
import { courses } from '@/db/schema';
import { getAuthContext, handleApiError } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    await getAuthContext(req);
    const allCourses = await db.select().from(courses);
    return Response.json(allCourses);
  } catch (error) {
    return handleApiError(error);
  }
}
