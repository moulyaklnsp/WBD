import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GlobalLoader } from '../components/ChessTransformation';
import ChessBackground from '../components/ChessBackground';
import AnimatedSidebar from '../components/AnimatedSidebar';
import { GlassCard } from '../components/AnimatedCard';


function resolveBlogImage(blog) {
  const arrayCandidate = Array.isArray(blog?.image_urls)
    ? blog.image_urls.find((value) => typeof value === 'string' && value.trim())
    : (Array.isArray(blog?.imageUrls)
        ? blog.imageUrls.find((value) => typeof value === 'string' && value.trim())
        : '');
  const raw = [
    arrayCandidate,
    blog?.image_url,
    blog?.imageUrl,
    blog?.image,
    blog?.coverImage,
    blog?.cover_image
  ].find((value) => typeof value === 'string' && value.trim());

  if (!raw) return '';
  const trimmed = raw.trim();

  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:')) return trimmed;

  if (trimmed.startsWith('/')) {
    if (trimmed.startsWith('/uploads') || trimmed.startsWith('/public/uploads')) {
      const apiBase = process.env.REACT_APP_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:3001`;
      return `${apiBase}${trimmed}`;
    }
    return trimmed;
  }

  if (/^www\./i.test(trimmed)) return `https://${trimmed}`;

  return trimmed;
}

export default function Blogs() {
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadBlogs = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await fetch('/api/public/coordinator-blogs');
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.error || 'Failed to load blogs');
        }

        const list = Array.isArray(data) ? data : (data.blogs || []);
        if (process.env.NODE_ENV !== 'production') {
          console.debug('Blogs API response sample:', list[0]);
        }
        if (isMounted) {
          setBlogs(list);
        }
      } catch (err) {
        if (isMounted) {
          setError(err?.message || 'Failed to load blogs');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadBlogs();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div style={{ minHeight: '100vh', position: 'relative' }}>
      <ChessBackground wallpaperUrl="/images/abstract-chess-pieces-digital-art-style.jpg" />
      <AnimatedSidebar />

      <main style={{ padding: '40px', position: 'relative', zIndex: 1, minHeight: '100vh' }}>
        <GlassCard>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            style={{
              textAlign: 'center',
              fontFamily: "'Cinzel', serif",
              color: '#FFFDD0',
              marginBottom: '2rem',
              fontSize: 'clamp(2rem, 5vw, 3rem)'
            }}
          >
            Coordinator Blogs
          </motion.h1>

          {loading ? (
            <GlobalLoader />
          ) : error ? (
            <p style={{ textAlign: 'center', color: '#ffb4b4' }}>{error}</p>
          ) : blogs.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'rgba(255, 253, 208, 0.75)' }}>No published blogs yet.</p>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '1rem'
              }}
            >
              {blogs.map((blog) => {
                const blogId = blog._id || blog.id;
                const blogImage = resolveBlogImage(blog);
                const blogDate = blog.published_at || blog.updated_date || blog.created_date || blog.date;
                const text = blog.excerpt || blog.content || '';
                const preview = text.length > 240 ? `${text.slice(0, 240)}...` : text;

                return (
                  <Link
                    key={blogId}
                    to={`/blogs/${blogId}`}
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <article
                      style={{
                        background: 'rgba(6, 18, 32, 0.72)',
                        border: '1px solid rgba(46, 139, 87, 0.3)',
                        borderRadius: '14px',
                        overflow: 'hidden',
                        cursor: 'pointer'
                      }}
                    >
                    {blogImage ? (
                      <img
                        src={blogImage}
                        alt={blog.title || 'Blog image'}
                        style={{ width: '100%', height: '180px', objectFit: 'cover' }}
                        onError={(e) => {
                          if (process.env.NODE_ENV !== 'production') {
                            console.debug('Blog image failed to load:', blog.title, blogImage);
                          }
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = '/images/error.svg';
                        }}
                      />
                    ) : null}
                    <div style={{ padding: '1rem' }}>
                      <h2
                        style={{
                          margin: '0 0 0.5rem 0',
                          color: '#87CEEB',
                          fontFamily: "'Cinzel', serif",
                          fontSize: '1.1rem'
                        }}
                      >
                        {blog.title || 'Untitled Blog'}
                      </h2>
                      {blogDate ? (
                        <p style={{ margin: '0 0 0.6rem 0', color: 'rgba(255, 253, 208, 0.65)', fontSize: '0.85rem' }}>
                          {new Date(blogDate).toLocaleDateString()}
                        </p>
                      ) : null}
                      <p style={{ margin: 0, color: 'rgba(255, 253, 208, 0.85)', lineHeight: 1.55 }}>
                        {preview}
                      </p>
                    </div>
                    </article>
                  </Link>
                );
              })}
            </div>
          )}
        </GlassCard>
      </main>
    </div>
  );
}
