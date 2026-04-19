import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GlobalLoader } from '../components/ChessTransformation';
import ChessBackground from '../components/ChessBackground';
import AnimatedSidebar from '../components/AnimatedSidebar';
import { GlassCard } from '../components/AnimatedCard';
import ImageCarousel from '../components/ImageCarousel';
import { getBackendBase } from '../utils/backendBase';

function resolveBlogImages(blog) {
  const arrayImages = Array.isArray(blog?.image_urls)
    ? blog.image_urls
    : (Array.isArray(blog?.imageUrls) ? blog.imageUrls : []);
  const single = [
    blog?.image_url,
    blog?.imageUrl,
    blog?.image,
    blog?.coverImage,
    blog?.cover_image
  ].find((value) => typeof value === 'string' && value.trim());
  const combined = Array.from(new Set([...(arrayImages || []), single].filter(Boolean)));
  return combined.map((raw) => {
    const trimmed = String(raw || '').trim();
    if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:')) return trimmed;
    if (trimmed.startsWith('/')) {
      if (trimmed.startsWith('/uploads') || trimmed.startsWith('/public/uploads')) {
        const apiBase = getBackendBase() || window.location.origin;
        return `${apiBase}${trimmed}`;
      }
      return trimmed;
    }
    if (/^www\./i.test(trimmed)) return `https://${trimmed}`;
    return trimmed;
  });
}

function normalizeImageSrc(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:')) return trimmed;
  if (trimmed.startsWith('/')) {
    if (trimmed.startsWith('/uploads') || trimmed.startsWith('/public/uploads')) {
      const apiBase = getBackendBase() || window.location.origin;
      return `${apiBase}${trimmed}`;
    }
    return trimmed;
  }
  if (/^www\./i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

export default function BlogDetail() {
  const { id } = useParams();
  const [blog, setBlog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviews, setReviews] = useState([]);
  const [reviewForm, setReviewForm] = useState({ name: '', comment: '' });
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadBlog = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await fetch(`/api/public/coordinator-blogs/${id}`, { credentials: 'include' });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed to load blog');
        if (isMounted) setBlog(data.blog || null);
      } catch (err) {
        if (isMounted) setError(err?.message || 'Failed to load blog');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    const loadReviews = async () => {
      try {
        const res = await fetch(`/api/public/coordinator-blogs/${id}/reviews`, { credentials: 'include' });
        const data = await res.json();
        if (res.ok && isMounted) {
          setReviews(Array.isArray(data.reviews) ? data.reviews : []);
        }
      } catch {
        if (isMounted) setReviews([]);
      }
    };

    loadBlog();
    loadReviews();

    return () => { isMounted = false; };
  }, [id]);

  const blocks = useMemo(() => {
    if (!blog) return [];
    if (Array.isArray(blog.blocks) && blog.blocks.length > 0) return blog.blocks;
    const content = (blog.content || '').trim();
    const paragraphs = content ? content.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean) : [];
    return paragraphs.map((p) => ({ type: 'text', value: p }));
  }, [blog]);

  const renderItems = useMemo(() => {
    const items = [];
    let imageBuffer = [];
    blocks.forEach((block) => {
      if (block.type === 'image') {
        const src = normalizeImageSrc(block.value);
        if (src) imageBuffer.push(src);
        return;
      }
      if (imageBuffer.length > 0) {
        items.push({ type: 'carousel', images: imageBuffer });
        imageBuffer = [];
      }
      items.push({ type: 'text', value: block.value });
    });
    if (imageBuffer.length > 0) {
      items.push({ type: 'carousel', images: imageBuffer });
    }
    return items;
  }, [blocks]);

  const images = useMemo(() => resolveBlogImages(blog || {}), [blog]);
  const publishDate = blog?.published_at || blog?.updated_date || blog?.created_date || blog?.date;

  const submitReview = async () => {
    const name = reviewForm.name.trim();
    const comment = reviewForm.comment.trim();
    if (!comment) return;
    setReviewSubmitting(true);
    try {
      const res = await fetch(`/api/public/coordinator-blogs/${id}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, comment })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to submit review');
      setReviewForm({ name: '', comment: '' });
      const reviewRes = await fetch(`/api/public/coordinator-blogs/${id}/reviews`, { credentials: 'include' });
      const reviewData = await reviewRes.json();
      if (reviewRes.ok) setReviews(Array.isArray(reviewData.reviews) ? reviewData.reviews : []);
    } catch {
      // ignore for now
    } finally {
      setReviewSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', position: 'relative' }}>
      <ChessBackground wallpaperUrl="/images/abstract-chess-pieces-digital-art-style.jpg" />
      <AnimatedSidebar />

      <main style={{ padding: '40px', position: 'relative', zIndex: 1, minHeight: '100vh' }}>
        <GlassCard>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            style={{ marginBottom: '1.5rem' }}
          >
            <Link to="/blogs" style={{ color: '#87CEEB', textDecoration: 'none', fontFamily: "'Cinzel', serif" }}>
              <i className="fas fa-arrow-left" /> Back to Blogs
            </Link>
          </motion.div>

          {loading ? (
            <GlobalLoader />
          ) : error ? (
            <p style={{ textAlign: 'center', color: '#ffb4b4' }}>{error}</p>
          ) : !blog ? (
            <p style={{ textAlign: 'center', color: 'rgba(255, 253, 208, 0.75)' }}>Blog not found.</p>
          ) : (
            <>
              <h1 style={{ color: '#FFFDD0', fontFamily: "'Cinzel', serif", marginBottom: '0.5rem' }}>{blog.title}</h1>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem', color: 'rgba(255, 253, 208, 0.75)' }}>
                <span><i className="fas fa-user" /> {blog.author || blog.coordinator || 'Coordinator'}</span>
                {publishDate && <span><i className="fas fa-calendar-alt" /> {new Date(publishDate).toLocaleDateString()}</span>}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {renderItems.map((item, idx) => (
                  <div key={`${item.type}-${idx}`}>
                    {item.type === 'carousel' ? (
                      <ImageCarousel images={item.images} maxHeight={400} />
                    ) : (
                      <p style={{ color: 'rgba(255, 253, 208, 0.9)', lineHeight: 1.7, fontSize: '1.05rem' }}>
                        {item.value}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {blocks.length === 0 && images.length > 0 && (
                <div style={{ marginTop: '1.5rem' }}>
                  <ImageCarousel images={images} maxHeight={400} />
                </div>
              )}

              <div style={{ marginTop: '2rem', borderTop: '1px solid rgba(46, 139, 87, 0.3)', paddingTop: '1.5rem' }}>
                <h2 style={{ color: '#87CEEB', fontFamily: "'Cinzel', serif", marginBottom: '1rem' }}>Reviews</h2>
                {reviews.length === 0 ? (
                  <p style={{ color: 'rgba(255, 253, 208, 0.75)' }}>No reviews yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {reviews.map((review, idx) => (
                      <div key={review._id || idx} style={{ border: '1px solid rgba(46, 139, 87, 0.3)', borderRadius: 12, padding: '1rem', background: 'rgba(6, 18, 32, 0.65)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <strong style={{ color: '#FFFDD0' }}>{review.user_name || 'User'}</strong>
                          <span style={{ color: 'rgba(255, 253, 208, 0.6)' }}>{new Date(review.created_at || Date.now()).toLocaleDateString()}</span>
                        </div>
                        <p style={{ color: 'rgba(255, 253, 208, 0.85)', margin: 0 }}>{review.comment}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ marginTop: '1.5rem' }}>
                  <h3 style={{ color: '#FFFDD0', fontFamily: "'Cinzel', serif", marginBottom: '0.6rem' }}>Add a Review</h3>
                  <div style={{ display: 'grid', gap: '0.6rem', maxWidth: 500 }}>
                    <input
                      type="text"
                      placeholder="Your name (optional)"
                      value={reviewForm.name}
                      onChange={(e) => setReviewForm((f) => ({ ...f, name: e.target.value }))}
                      style={{ padding: '0.7rem', borderRadius: 8, border: '1px solid rgba(46, 139, 87, 0.4)', background: 'rgba(6, 18, 32, 0.8)', color: '#FFFDD0' }}
                    />
                    <textarea
                      placeholder="Write your review..."
                      value={reviewForm.comment}
                      onChange={(e) => setReviewForm((f) => ({ ...f, comment: e.target.value }))}
                      rows={4}
                      style={{ padding: '0.7rem', borderRadius: 8, border: '1px solid rgba(46, 139, 87, 0.4)', background: 'rgba(6, 18, 32, 0.8)', color: '#FFFDD0' }}
                    />
                    <button
                      type="button"
                      onClick={submitReview}
                      disabled={reviewSubmitting}
                      style={{
                        background: '#2E8B57',
                        color: '#fff',
                        border: 'none',
                        padding: '0.75rem',
                        borderRadius: 8,
                        cursor: 'pointer',
                        fontFamily: "'Cinzel', serif",
                        fontWeight: 700
                      }}
                    >
                      {reviewSubmitting ? 'Submitting...' : 'Submit Review'}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </GlassCard>
      </main>
    </div>
  );
}
