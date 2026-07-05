import { NextRequest } from 'next/server';
import { dbAdapter } from '@/db/adapter';
import { unsavePost } from '@/lib/business-logic';
import { getAuthContext, handleApiError } from '@/lib/auth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const auth = await getAuthContext(req);
    const { postId } = await params;

    const result = await unsavePost(auth.userId, postId, dbAdapter);
    return Response.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
