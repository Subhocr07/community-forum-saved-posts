import { NextRequest } from 'next/server';
import { dbAdapter } from '../db/adapter';
import { AuthError } from './business-logic';

export interface AuthContext {
  userId: string;
  role: 'student' | 'moderator';
}

export async function getAuthContext(req: NextRequest): Promise<AuthContext> {
  const userId = req.headers.get('x-user-id');
  const role = req.headers.get('x-role');

  if (!userId || !role) {
    throw new AuthError('Unauthenticated request.', 401);
  }

  // Validate user exists in DB and roles match
  const user = await dbAdapter.getUser(userId);
  if (!user || user.role !== role) {
    throw new AuthError('Unauthenticated request.', 401);
  }

  return {
    userId,
    role: user.role,
  };
}

export function handleApiError(error: unknown) {
  if (error instanceof AuthError) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: error.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  console.error('Unhandled API Error:', error);
  return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
    status: 500,
    headers: { 'Content-Type': 'application/json' },
  });
}
