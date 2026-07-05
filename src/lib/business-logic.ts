export interface Post {
  id: string;
  courseId: string;
}

export interface SavedPost {
  userId: string;
  postId: string;
  isActive: boolean;
  savedAt: Date;
}

export interface User {
  id: string;
  role: 'student' | 'moderator';
}

export interface BusinessLogicAdapter {
  getPost(postId: string): Promise<Post | null>;
  isStudentEnrolled(userId: string, courseId: string): Promise<boolean>;
  getSavedPost(userId: string, postId: string): Promise<SavedPost | null>;
  upsertSavedPost(userId: string, postId: string, isActive: boolean, savedAt: Date): Promise<void>;
  getUser(userId: string): Promise<User | null>;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

export async function savePost(
  userId: string,
  postId: string,
  adapter: BusinessLogicAdapter
): Promise<{ success: boolean; action: 'created' | 'reactivated' | 'noop' }> {
  // 1. Get user to check role
  const user = await adapter.getUser(userId);
  if (!user) {
    throw new AuthError('Unauthenticated request.', 401);
  }

  // 2. Validate post exists
  const post = await adapter.getPost(postId);
  if (!post) {
    throw new AuthError('Request for a post that doesn\'t exist.', 404);
  }

  // 3. Enforce course access boundary
  if (user.role === 'student') {
    const isEnrolled = await adapter.isStudentEnrolled(userId, post.courseId);
    if (!isEnrolled) {
      throw new AuthError('Student saving / reading a post in a course they\'re not enrolled in.', 403);
    }
  }

  // 4. Retrieve existing save record (including soft-deleted ones)
  const existing = await adapter.getSavedPost(userId, postId);

  if (!existing) {
    // Fresh save
    await adapter.upsertSavedPost(userId, postId, true, new Date());
    return { success: true, action: 'created' };
  }

  if (!existing.isActive) {
    // Reactivate soft-deleted save
    await adapter.upsertSavedPost(userId, postId, true, new Date());
    return { success: true, action: 'reactivated' };
  }

  // Already active - no-op (idempotent)
  return { success: true, action: 'noop' };
}

export async function unsavePost(
  userId: string,
  postId: string,
  adapter: BusinessLogicAdapter
): Promise<{ success: boolean; action: 'soft_deleted' | 'noop' }> {
  // 1. Get user to check role
  const user = await adapter.getUser(userId);
  if (!user) {
    throw new AuthError('Unauthenticated request.', 401);
  }

  // 2. Validate post exists
  const post = await adapter.getPost(postId);
  if (!post) {
    throw new AuthError('Request for a post that doesn\'t exist.', 404);
  }

  // 3. Enforce course access boundary
  if (user.role === 'student') {
    const isEnrolled = await adapter.isStudentEnrolled(userId, post.courseId);
    if (!isEnrolled) {
      throw new AuthError('Student saving / reading a post in a course they\'re not enrolled in.', 403);
    }
  }

  // 4. Retrieve existing save record
  const existing = await adapter.getSavedPost(userId, postId);

  if (existing && existing.isActive) {
    // Soft delete by updating isActive to false, retaining the timestamp of save
    await adapter.upsertSavedPost(userId, postId, false, existing.savedAt);
    return { success: true, action: 'soft_deleted' };
  }

  // Not saved or already inactive - no-op
  return { success: true, action: 'noop' };
}
