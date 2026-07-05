'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePersona, personas } from '@/contexts/persona';
import { useI18n } from '@/i18n/context';
import { 
  Bookmark, 
  BookOpen, 
  ShieldAlert, 
  Loader2, 
  User, 
  ChevronDown, 
  Check, 
  BookmarkCheck,
  Menu,
  X
} from 'lucide-react';

interface Post {
  id: string;
  courseId: string;
  title: string;
  content: string;
  authorId: string;
  createdAt: string;
  savesCount: number;
  hasSaved: boolean;
}

interface Course {
  id: string;
  name: string;
}

export default function Home() {
  const { activePersona, setActivePersona, getHeaders } = usePersona();
  const { locale, setLocale, t, formatSaves } = useI18n();
  const queryClient = useQueryClient();

  const [selectedCourseId, setSelectedCourseId] = useState<string>('course-1');
  const [isSavedView, setIsSavedView] = useState<boolean>(false);
  const [isPersonaOpen, setIsPersonaOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Invalidate queries when persona changes to reload feed with correct credentials
  useEffect(() => {
    queryClient.invalidateQueries();
    setErrorMessage(null);
  }, [activePersona, queryClient]);

  // Query: Get Courses
  const { 
    data: courses, 
    isLoading: coursesLoading,
    error: coursesError 
  } = useQuery<Course[]>({
    queryKey: ['courses', activePersona.id],
    queryFn: async () => {
      const res = await fetch('/api/courses', { headers: getHeaders() });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw { status: res.status, message: errData.error || 'Failed to fetch courses' };
      }
      return res.json();
    },
    retry: false
  });

  // Query: Get Posts in Course
  const { 
    data: posts, 
    isLoading: postsLoading,
    error: postsError 
  } = useQuery<Post[]>({
    queryKey: ['posts', selectedCourseId, activePersona.id],
    queryFn: async () => {
      const res = await fetch(`/api/posts?courseId=${selectedCourseId}`, { headers: getHeaders() });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw { status: res.status, message: errData.error || 'Failed to fetch posts' };
      }
      return res.json();
    },
    enabled: !isSavedView && !!selectedCourseId,
    retry: false
  });

  // Query: Get Saved Posts
  const { 
    data: savedPosts, 
    isLoading: savedLoading,
    error: savedError 
  } = useQuery<Post[]>({
    queryKey: ['saved-posts', activePersona.id],
    queryFn: async () => {
      const res = await fetch(`/api/saved-posts?userId=${activePersona.id === 'unauthenticated' ? 'guest' : activePersona.id}`, { headers: getHeaders() });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw { status: res.status, message: errData.error || 'Failed to fetch saved posts' };
      }
      return res.json();
    },
    enabled: isSavedView,
    retry: false
  });

  // Mutation: Toggle Save Post
  const toggleSaveMutation = useMutation({
    mutationFn: async ({ postId, currentlySaved }: { postId: string; currentlySaved: boolean }) => {
      const endpoint = currentlySaved ? `/api/posts/${postId}/unsave` : `/api/posts/${postId}/save`;
      const res = await fetch(endpoint, { method: 'POST', headers: getHeaders() });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw { status: res.status, message: errData.error || 'Failed to toggle save state' };
      }
      return res.json();
    },
    onMutate: async ({ postId, currentlySaved }) => {
      // Invalidate queries to prevent race conditions, then cancel them
      await queryClient.cancelQueries({ queryKey: ['posts', selectedCourseId, activePersona.id] });
      await queryClient.cancelQueries({ queryKey: ['saved-posts', activePersona.id] });

      // Save previous queries
      const previousPosts = queryClient.getQueryData<Post[]>(['posts', selectedCourseId, activePersona.id]);
      const previousSaved = queryClient.getQueryData<Post[]>(['saved-posts', activePersona.id]);

      // Optimistically update course feed
      queryClient.setQueryData<Post[]>(
        ['posts', selectedCourseId, activePersona.id],
        (old) => old?.map(p => p.id === postId ? {
          ...p,
          hasSaved: !currentlySaved,
          savesCount: Math.max(0, p.savesCount + (currentlySaved ? -1 : 1))
        } : p)
      );

      // Optimistically update saved posts
      queryClient.setQueryData<Post[]>(
        ['saved-posts', activePersona.id],
        (old) => {
          if (currentlySaved) {
            return old?.filter(p => p.id !== postId);
          } else {
            // Find post in active feed to insert
            const postToAdd = previousPosts?.find(p => p.id === postId);
            if (postToAdd && old) {
              return [{ ...postToAdd, hasSaved: true, savesCount: postToAdd.savesCount + 1 }, ...old];
            }
            return old;
          }
        }
      );

      return { previousPosts, previousSaved };
    },
    onError: (err, variables, context) => {
      // Reset error message to show UI banner
      const error = err as { message?: string };
      setErrorMessage(error.message || 'Operation failed');
      // Rollback values
      if (context?.previousPosts) {
        queryClient.setQueryData(['posts', selectedCourseId, activePersona.id], context.previousPosts);
      }
      if (context?.previousSaved) {
        queryClient.setQueryData(['saved-posts', activePersona.id], context.previousSaved);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['posts', selectedCourseId, activePersona.id] });
      queryClient.invalidateQueries({ queryKey: ['saved-posts', activePersona.id] });
    }
  });

  // Handle active error messages
  const activeError = isSavedView ? savedError : postsError || coursesError;
  const currentError = (activeError as { status?: number; message?: string } | null) || (errorMessage ? { message: errorMessage } : null);

  const getErrorText = (err: { status?: number; message?: string } | null) => {
    if (err?.status === 401) return t('errorCodes.401');
    if (err?.status === 403) return t('errorCodes.403');
    if (err?.status === 404) return t('errorCodes.404');
    return err?.message || t('errorCodes.unknown');
  };

  const handleToggleSave = (postId: string, hasSaved: boolean) => {
    setErrorMessage(null);
    toggleSaveMutation.mutate({ postId, currentlySaved: hasSaved });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(locale === 'en' ? 'en-US' : 'es-ES', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const displayPosts = isSavedView ? savedPosts : posts;
  const displayLoading = isSavedView ? savedLoading : postsLoading || coursesLoading;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />

      {/* Main Container */}
      <div className="relative flex flex-col min-h-screen">
        
        {/* Header */}
        <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 text-slate-400 hover:text-slate-200 transition-colors"
              >
                {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center font-bold text-lg text-white shadow-lg shadow-violet-500/20">
                  F
                </div>
                <div>
                  <h1 className="font-semibold text-base leading-none text-slate-100">{t('appTitle')}</h1>
                  <span className="text-xs text-slate-400 font-medium">Saved Posts Slice</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Language Switcher */}
              <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
                <button
                  onClick={() => setLocale('en')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                    locale === 'en' 
                      ? 'bg-violet-600 text-white shadow-md' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  EN
                </button>
                <button
                  onClick={() => setLocale('es')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                    locale === 'es' 
                      ? 'bg-violet-600 text-white shadow-md' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ES
                </button>
              </div>

              {/* Persona Switcher Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setIsPersonaOpen(!isPersonaOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-lg text-sm font-medium transition-all focus:outline-none"
                >
                  <User size={15} className="text-violet-400" />
                  <span className="max-w-[120px] truncate">{activePersona.name}</span>
                  <ChevronDown size={14} className={`text-slate-400 transition-transform ${isPersonaOpen ? 'rotate-185' : ''}`} />
                </button>

                {isPersonaOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsPersonaOpen(false)} />
                    <div className="absolute right-0 mt-2 w-64 origin-top-right rounded-xl border border-slate-800 bg-slate-900/95 p-1 shadow-2xl backdrop-blur-lg z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                      <div className="px-3 py-2 border-b border-slate-800 mb-1">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">{t('personaSwitcher')}</span>
                      </div>
                      {Object.values(personas).map((persona) => (
                        <button
                          key={persona.id}
                          onClick={() => {
                            setActivePersona(persona.id);
                            setIsPersonaOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 text-left rounded-lg text-xs transition-colors ${
                            activePersona.id === persona.id
                              ? 'bg-violet-600/10 text-violet-400 font-semibold'
                              : 'text-slate-350 hover:bg-slate-800 hover:text-slate-100'
                          }`}
                        >
                          <div>
                            <div className="font-semibold">{persona.name}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">{persona.description}</div>
                          </div>
                          {activePersona.id === persona.id && <Check size={14} className="text-violet-400" />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Content Wrapper */}
        <div className="flex-1 max-w-7xl w-full mx-auto px-4 flex gap-6 py-6 relative">
          
          {/* Sidebar - Desktop */}
          <aside className="hidden md:flex flex-col w-64 shrink-0 gap-2">
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 backdrop-blur-sm sticky top-22">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4 px-2">Navigation</h2>
              
              <nav className="flex flex-col gap-1.5">
                {/* Course List */}
                {courses?.map((course) => (
                  <button
                    key={course.id}
                    onClick={() => {
                      setSelectedCourseId(course.id);
                      setIsSavedView(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      !isSavedView && selectedCourseId === course.id
                        ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/10'
                        : 'text-slate-350 hover:bg-slate-800/50 hover:text-slate-100'
                    }`}
                  >
                    <BookOpen size={16} />
                    <span className="truncate">{course.name}</span>
                  </button>
                ))}

                <div className="my-2 border-t border-slate-800/80" />

                {/* Saved Posts Nav */}
                <button
                  onClick={() => setIsSavedView(true)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    isSavedView
                      ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/10'
                      : 'text-slate-350 hover:bg-slate-800/50 hover:text-slate-100'
                  }`}
                >
                  <BookmarkCheck size={16} />
                  <span>{t('savedTitle')}</span>
                </button>
              </nav>
            </div>
          </aside>

          {/* Mobile Sidebar overlay */}
          {isMobileMenuOpen && (
            <>
              <div 
                className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 md:hidden"
                onClick={() => setIsMobileMenuOpen(false)}
              />
              <aside className="fixed left-0 top-0 bottom-0 w-72 bg-slate-900 border-r border-slate-800 p-6 z-50 animate-in slide-in-from-left duration-200 md:hidden">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center font-bold text-white">F</div>
                    <span className="font-bold text-slate-200">Forum Menu</span>
                  </div>
                  <button onClick={() => setIsMobileMenuOpen(false)} className="p-1 text-slate-400">
                    <X size={20} />
                  </button>
                </div>
                
                <nav className="flex flex-col gap-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1">Courses</span>
                  {courses?.map((course) => (
                    <button
                      key={course.id}
                      onClick={() => {
                        setSelectedCourseId(course.id);
                        setIsSavedView(false);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                        !isSavedView && selectedCourseId === course.id
                          ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/10'
                          : 'text-slate-350 hover:bg-slate-800/50 hover:text-slate-100'
                      }`}
                    >
                      <BookOpen size={16} />
                      <span className="truncate">{course.name}</span>
                    </button>
                  ))}

                  <div className="my-2 border-t border-slate-800/80" />

                  <button
                    onClick={() => {
                      setIsSavedView(true);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      isSavedView
                        ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/10'
                        : 'text-slate-350 hover:bg-slate-800/50 hover:text-slate-100'
                    }`}
                  >
                    <BookmarkCheck size={16} />
                    <span>{t('savedTitle')}</span>
                  </button>
                </nav>
              </aside>
            </>
          )}

          {/* Main Feed */}
          <main className="flex-1 min-w-0">
            {/* Title / Section Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-100">
                  {isSavedView 
                    ? t('savedTitle') 
                    : courses?.find(c => c.id === selectedCourseId)?.name || t('feedTitle')}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {isSavedView ? 'Your active bookmarks' : 'Discussion feed for this course'}
                </p>
              </div>
            </div>

            {/* Error Banner */}
            {currentError && (
              <div className="mb-6 p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 flex items-start gap-3 text-rose-350 backdrop-blur-sm animate-in fade-in slide-in-from-top-1 duration-150">
                <ShieldAlert className="shrink-0 mt-0.5" size={18} />
                <div>
                  <h4 className="font-semibold text-sm leading-none mb-1">{t('errorTitle')}</h4>
                  <p className="text-xs opacity-90">{getErrorText(currentError)}</p>
                </div>
              </div>
            )}

            {/* Loading State */}
            {displayLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 size={32} className="animate-spin text-violet-500" />
                <span className="text-sm text-slate-400 font-medium">{t('loading')}</span>
              </div>
            ) : currentError && currentError.status !== 500 ? (
              // Don't show empty/posts list if we failed auth checks
              null
            ) : !displayPosts || displayPosts.length === 0 ? (
              /* Empty State */
              <div className="border border-dashed border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center bg-slate-900/10 backdrop-blur-sm">
                <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mb-4 text-slate-450">
                  <Bookmark size={20} />
                </div>
                <h3 className="font-semibold text-slate-200 mb-1">
                  {isSavedView ? t('noSavedPosts') : t('noPosts')}
                </h3>
                <p className="text-xs text-slate-400 max-w-sm">
                  {isSavedView 
                    ? 'Bookmarked discussions will appear here for easy reference later.' 
                    : 'Be the first to create a topic in this course forum.'}
                </p>
              </div>
            ) : (
              /* Posts Feed List */
              <div className="flex flex-col gap-4">
                {displayPosts.map((post) => (
                  <article 
                    key={post.id}
                    className="group border border-slate-800/80 bg-slate-900/20 rounded-2xl p-5 hover:border-slate-700/60 hover:bg-slate-900/30 hover:scale-[1.005] active:scale-[1.0] transition-all duration-200 flex items-start gap-4 shadow-sm"
                  >
                    {/* Post Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-800 border border-slate-700 text-slate-350">
                          {post.authorId === 'charlie' ? 'Charlie' : post.authorId === 'alice' ? 'Alice' : 'Bob'}
                        </span>
                        <span className="text-[10px] text-slate-450">•</span>
                        <span className="text-[10px] text-slate-450 font-medium">
                          {formatDate(post.createdAt)}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-slate-200 group-hover:text-slate-100 transition-colors mb-1.5">
                        {post.title}
                      </h3>
                      <p className="text-sm text-slate-350 leading-relaxed">
                        {post.content}
                      </p>
                    </div>

                    {/* Bookmark Toggle Button */}
                    <button
                      onClick={() => handleToggleSave(post.id, post.hasSaved)}
                      disabled={toggleSaveMutation.isPending}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all select-none ${
                        post.hasSaved
                          ? 'bg-violet-600/10 border-violet-500/40 text-violet-400 hover:bg-violet-600/20'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                      }`}
                      title={post.hasSaved ? t('unsaveBtn') : t('saveBtn')}
                    >
                      <Bookmark 
                        size={14} 
                        className={`transition-transform duration-200 group-active:scale-90 ${post.hasSaved ? 'fill-violet-400 text-violet-400' : 'text-slate-400'}`} 
                      />
                      <span>{formatSaves(post.savesCount)}</span>
                    </button>
                  </article>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
