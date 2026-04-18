import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../../styles/playerNeoNoir.css';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchAsCoordinator } from '../../utils/fetchWithRole';
import usePlayerTheme from '../../hooks/usePlayerTheme';
import AnimatedSidebar from '../../components/AnimatedSidebar';
import { GlobalLoader } from '../../components/ChessTransformation';
import { coordinatorLinks } from '../../constants/coordinatorLinks';


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

const PAGE_SIZE = 10;

const sectionVariants = {
  hidden: { opacity: 0, y: 28, scale: 0.97 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      delay: i * 0.12,
      duration: 0.55,
      ease: [0.22, 1, 0.36, 1]
    }
  })
};

const listVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.12 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] }
  }
};

function CoordinatorBlogs() {
  const [isDark, toggleTheme] = usePlayerTheme();
  const navigate = useNavigate();
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState(null);

  // Form state
  const [form, setForm] = useState({ title: '', status: 'published' });
  const [blocks, setBlocks] = useState([{ id: `${Date.now()}-block`, type: 'text', value: '' }]);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);

  const showMessage = (text, type = 'success') => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const createBlockId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const addBlock = (type) => {
    setBlocks((prev) => [...prev, { id: createBlockId(), type, value: '', file: null, preview: '' }]);
  };

  const updateBlockValue = (id, value) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, value } : b)));
  };

  const updateBlockFile = (id, file) => {
    setBlocks((prev) => prev.map((b) => {
      if (b.id !== id) return b;
      if (b.preview) {
        try { URL.revokeObjectURL(b.preview); } catch {}
      }
      const preview = file ? URL.createObjectURL(file) : '';
      return { ...b, file, preview, value: file ? b.value : b.value };
    }));
  };

  const removeBlock = (id) => {
    setBlocks((prev) => {
      const target = prev.find((b) => b.id === id);
      if (target?.preview) {
        try { URL.revokeObjectURL(target.preview); } catch {}
      }
      return prev.filter((b) => b.id !== id);
    });
  };

  const buildBlocksFromBlog = (blog) => {
    const existingBlocks = Array.isArray(blog?.blocks)
      ? blog.blocks
      : (Array.isArray(blog?.content_blocks) ? blog.content_blocks : []);
    if (existingBlocks.length > 0) {
      return existingBlocks.map((b) => ({
        id: createBlockId(),
        type: b.type || 'text',
        value: b.value || '',
        file: null,
        preview: b.type === 'image' ? b.value : ''
      }));
    }

    const content = (blog?.content || '').trim();
    const paragraphs = content ? content.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean) : [];
    const images = Array.isArray(blog?.image_urls)
      ? blog.image_urls
      : (Array.isArray(blog?.imageUrls)
          ? blog.imageUrls
          : (blog?.image_url ? [blog.image_url] : []));
    const nextBlocks = [];
    paragraphs.forEach((p) => nextBlocks.push({ id: createBlockId(), type: 'text', value: p, file: null, preview: '' }));
    images.forEach((url) => nextBlocks.push({ id: createBlockId(), type: 'image', value: url, file: null, preview: url }));
    return nextBlocks.length > 0 ? nextBlocks : [{ id: createBlockId(), type: 'text', value: '', file: null, preview: '' }];
  };


  const loadBlogs = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetchAsCoordinator('/coordinator/api/blogs');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load blogs');
      setBlogs(Array.isArray(data) ? data : (data.blogs || []));
    } catch (e) {
      console.error('Blog load error:', e);
      setError('Error loading blogs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBlogs();
  }, [loadBlogs]);

  useEffect(() => {
    setPage(1);
  }, [blogs.length]);

  const totalPages = Math.max(1, Math.ceil(blogs.length / PAGE_SIZE));
  const paginatedBlogs = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return blogs.slice(start, start + PAGE_SIZE);
  }, [blogs, page]);

  const resetForm = () => {
    setForm({ title: '', status: 'published' });
    setBlocks([{ id: createBlockId(), type: 'text', value: '', file: null, preview: '' }]);
    setEditingId(null);
  };

  const handleEdit = (blog) => {
    setForm({
      title: blog.title || '',
      status: blog.status || (blog.published ? 'published' : 'draft')
    });
    setBlocks(buildBlocksFromBlog(blog));
    setEditingId(blog._id || blog.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (blogId) => {
    const ok = window.confirm('Are you sure you want to delete this blog?');
    if (!ok) return;
    try {
      const res = await fetchAsCoordinator(`/coordinator/api/blogs/${blogId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete blog');
      showMessage('Blog deleted successfully.');
      setBlogs((prev) => prev.filter((b) => (b._id || b.id) !== blogId));
      if (editingId === blogId) resetForm();
    } catch (e) {
      console.error('Delete error:', e);
      showMessage(e.message || 'Error deleting blog.', 'error');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const title = form.title.trim();
    if (!title) {
      showMessage('Title is required.', 'error');
      return;
    }

    const urlBlocks = blocks.filter((b) => b.type === 'image' && !b.file && b.value.trim());
    const invalidUrlBlock = urlBlocks.find((b) => !/^(https?:\/\/|data:|\/uploads\/|\/public\/uploads\/)/i.test(b.value.trim()) && !/^www\./i.test(b.value.trim()));
    if (invalidUrlBlock) {
      showMessage('Please enter a valid image URL starting with http:// or https://', 'error');
      return;
    }

    const textBlocks = blocks
      .filter((b) => b.type === 'text')
      .map((b) => b.value.trim())
      .filter(Boolean);
    if (textBlocks.length === 0) {
      showMessage('Please add at least one text paragraph.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      let uploadedUrls = [];
      const fileBlocks = blocks.filter((b) => b.type === 'image' && b.file);
      if (fileBlocks.length > 0) {
        const formData = new FormData();
        fileBlocks.forEach((b) => formData.append('images', b.file));
        const uploadRes = await fetchAsCoordinator('/coordinator/api/blogs/upload-images', {
          method: 'POST',
          body: formData
        });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.error || 'Failed to upload images');
        uploadedUrls = Array.isArray(uploadData.images) ? uploadData.images.map((img) => img.url).filter(Boolean) : [];
      }

      let uploadIndex = 0;
      const normalizedBlocks = blocks.map((b) => {
        if (b.type === 'text') {
          const value = b.value.trim();
          return value ? { type: 'text', value } : null;
        }
        if (b.type === 'image') {
          let value = b.value.trim();
          if (b.file) {
            value = uploadedUrls[uploadIndex] || '';
            uploadIndex += 1;
          }
          if (value && /^www\./i.test(value)) value = `https://${value}`;
          return value ? { type: 'image', value } : null;
        }
        return null;
      }).filter(Boolean);

      const content = normalizedBlocks.filter((b) => b.type === 'text').map((b) => b.value).join('\n\n');
      const imageUrls = normalizedBlocks.filter((b) => b.type === 'image').map((b) => b.value);

      const normalizedStatus = form.status === 'draft' ? 'draft' : 'published';
      const payload = {
        title,
        content,
        imageUrls,
        imageUrl: imageUrls[0] || '',
        blocks: normalizedBlocks,
        status: normalizedStatus,
        published: normalizedStatus === 'published'
      };
      let res;
      if (editingId) {
        res = await fetchAsCoordinator(`/coordinator/api/blogs/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetchAsCoordinator('/coordinator/api/blogs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save blog');
      showMessage(editingId ? 'Blog updated successfully.' : 'Blog created successfully.');
      resetForm();
      loadBlogs();
    } catch (e) {
      console.error('Submit error:', e);
      showMessage(e.message || 'Error saving blog.', 'error');
    } finally {
      setSubmitting(false);
    }
  };



  return (
    <div style={{ minHeight: '100vh' }}>
      <style>{`
        * { margin:0; padding:0; box-sizing:border-box; }
        body, #root { min-height: 100vh; }
        .page { font-family: 'Playfair Display', serif; background-color: var(--page-bg); min-height: 100vh; display:flex; color: var(--text-color); }
        .content { flex-grow:1; margin-left:0; padding:2rem; }
        h1 { font-family:'Cinzel', serif; color:var(--sea-green); margin-bottom:2rem; font-size:2.5rem; display:flex; align-items:center; gap:1rem; }
        .updates-section { background:var(--card-bg); border-radius:15px; padding:2rem; margin-bottom:2rem; box-shadow:none; border:1px solid var(--card-border); transition: transform 0.3s ease; }
        .updates-section:hover { transform: translateY(-5px); }
        .updates-section h3 { font-family:'Cinzel', serif; color:var(--sea-green); margin-bottom:1.5rem; display:flex; align-items:center; gap:0.8rem; font-size:1.5rem; }
        .form-group { margin-bottom:1.2rem; }
        .form-group label { display:block; font-family:'Cinzel', serif; font-weight:bold; color:var(--sea-green); margin-bottom:0.4rem; }
        .form-group input, .form-group textarea, .form-group select { width:100%; padding:0.8rem 1rem; border-radius:8px; border:1px solid var(--card-border); background:var(--page-bg); color:var(--text-color); font-family:'Playfair Display', serif; font-size:1rem; resize:vertical; }
        .form-group input:focus, .form-group textarea:focus, .form-group select:focus { outline:none; border-color:var(--sea-green); box-shadow:0 0 0 2px rgba(46,139,87,0.2); }
        .btn-primary { background:var(--sea-green); color:var(--on-accent); border:none; padding:0.8rem 1.5rem; border-radius:8px; cursor:pointer; font-family:'Cinzel', serif; font-weight:bold; display:inline-flex; align-items:center; gap:0.5rem; transition:all 0.3s ease; }
        .btn-primary:hover { transform:translateY(-2px); }
        .btn-primary:disabled { opacity:0.6; cursor:not-allowed; transform:none; }
        .btn-secondary { background:var(--card-bg); color:var(--text-color); border:1px solid var(--card-border); padding:0.6rem 1.2rem; border-radius:8px; cursor:pointer; font-family:'Cinzel', serif; font-weight:bold; display:inline-flex; align-items:center; gap:0.5rem; transition:all 0.3s ease; }
        .btn-secondary:hover { border-color:var(--sea-green); color:var(--sea-green); }
        .btn-danger { background:#d32f2f; color:#fff; border:none; padding:0.6rem 1.2rem; border-radius:8px; cursor:pointer; font-family:'Cinzel', serif; font-weight:bold; display:inline-flex; align-items:center; gap:0.5rem; transition:all 0.3s ease; }
        .btn-danger:hover { background:#b71c1c; transform:translateY(-2px); }
        .blog-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:1.5rem; }
        .blog-card { background:var(--card-bg); border-radius:15px; overflow:hidden; border:1px solid var(--card-border); transition:all 0.3s ease; }
        .blog-card:hover { transform:translateY(-5px); border-color:var(--sea-green); }
        .blog-card-img { width:100%; height:180px; object-fit:cover; }
        .blog-card-body { padding:1.5rem; }
        .blog-card-title { font-family:'Cinzel', serif; color:var(--sea-green); font-size:1.2rem; margin-bottom:0.5rem; }
        .blog-card-date { font-size:0.85rem; opacity:0.6; margin-bottom:0.8rem; }
        .blog-card-preview { font-size:0.95rem; line-height:1.5; margin-bottom:1rem; opacity:0.85; }
        .blog-card-actions { display:flex; gap:0.5rem; flex-wrap:wrap; }
        .pagination { display:flex; justify-content:center; align-items:center; gap:0.5rem; margin-top:1.5rem; }
        .page-btn { background:var(--card-bg); color:var(--text-color); border:1px solid var(--card-border); padding:0.5rem 1rem; border-radius:8px; cursor:pointer; font-family:'Cinzel', serif; font-weight:bold; transition:all 0.2s ease; }
        .page-btn.active { background:var(--sea-green); color:var(--on-accent); border-color:var(--sea-green); }
        .page-btn:hover:not(.active) { border-color:var(--sea-green); color:var(--sea-green); }
        .message-bar { padding:0.8rem 1.2rem; border-radius:8px; margin-bottom:1.5rem; font-weight:600; display:flex; align-items:center; gap:0.5rem; }
        .message-success { background:rgba(46,139,87,0.15); color:#2e7d32; border:1px solid rgba(46,139,87,0.3); }
        .message-error { background:rgba(211,47,47,0.1); color:#c62828; border:1px solid rgba(211,47,47,0.3); }
      `}</style>

      <div className="page player-neo">
        <motion.div
          className="chess-knight-float"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 0.14, scale: 1 }}
          transition={{ delay: 0.9, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 0, fontSize: '2.5rem', color: 'var(--sea-green)' }}
          aria-hidden="true"
        >
          <i className="fas fa-blog" />
        </motion.div>

        <AnimatedSidebar links={coordinatorLinks} logo={<i className="fas fa-chess" />} title={`ChessHive`} />

        <div className="coordinator-dash-header" style={{ position: 'fixed', top: 18, right: 18, zIndex: 1001, display: 'flex', gap: '12px', alignItems: 'center' }}>
          <motion.button
            type="button"
            onClick={toggleTheme}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              color: 'var(--text-color)',
              width: 40,
              height: 40,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '1.1rem'
            }}
          >
            <i className={isDark ? 'fas fa-sun' : 'fas fa-moon'} />
          </motion.button>
        </div>

        <div className="content">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <i className="fas fa-blog" /> Blog Management
          </motion.h1>

          <AnimatePresence>
            {message && (
              <motion.div
                className={`message-bar ${message.type === 'success' ? 'message-success' : 'message-error'}`}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <i className={`fas fa-${message.type === 'success' ? 'check-circle' : 'exclamation-circle'}`} />
                {message.text}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Create / Edit Form */}
          <motion.div
            className="updates-section"
            custom={0}
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
          >
            <h3>
              <i className={editingId ? 'fas fa-edit' : 'fas fa-plus-circle'} />
              {editingId ? 'Edit Blog' : 'Create New Blog'}
            </h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="blog-title"><i className="fas fa-heading" /> Title</label>
                <input
                  id="blog-title"
                  type="text"
                  placeholder="Enter blog title..."
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  maxLength={200}
                />
              </div>
              <div className="form-group">
                <label><i className="fas fa-align-left" /> Content Blocks</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                  {blocks.map((block, index) => (
                    <div key={block.id} style={{ border: '1px solid var(--card-border)', borderRadius: 10, padding: '0.9rem', background: 'rgba(var(--sea-green-rgb, 27, 94, 63), 0.06)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                        <strong>{block.type === 'text' ? `Paragraph ${index + 1}` : `Image ${index + 1}`}</strong>
                        {blocks.length > 1 && (
                          <button type="button" className="btn-secondary" onClick={() => removeBlock(block.id)}>
                            <i className="fas fa-trash" /> Remove
                          </button>
                        )}
                      </div>
                      {block.type === 'text' ? (
                        <textarea
                          placeholder="Write a paragraph..."
                          value={block.value}
                          onChange={(e) => updateBlockValue(block.id, e.target.value)}
                          rows={4}
                          style={{ width: '100%', minHeight: '110px' }}
                        />
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => updateBlockFile(block.id, e.target.files?.[0] || null)}
                          />
                          <input
                            type="text"
                            placeholder="Or paste an image URL..."
                            value={block.value}
                            onChange={(e) => updateBlockValue(block.id, e.target.value)}
                          />
                          {(block.preview || block.value) && (
                            <img
                              src={block.preview || block.value}
                              alt="Preview"
                              style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--card-border)' }}
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <button type="button" className="btn-secondary" onClick={() => addBlock('text')}>
                      <i className="fas fa-plus" /> Add Paragraph
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => addBlock('image')}>
                      <i className="fas fa-image" /> Add Image
                    </button>
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="blog-status"><i className="fas fa-toggle-on" /> Status</label>
                <select
                  id="blog-status"
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                >
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
                <motion.button
                  type="submit"
                  className="btn-primary"
                  disabled={submitting}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <i className={`fas fa-${submitting ? 'spinner fa-spin' : (editingId ? 'save' : 'paper-plane')}`} />
                  {submitting ? 'Saving...' : (editingId ? 'Update Blog' : 'Publish Blog')}
                </motion.button>
                {editingId && (
                  <motion.button
                    type="button"
                    className="btn-secondary"
                    onClick={resetForm}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <i className="fas fa-times" /> Cancel Edit
                  </motion.button>
                )}
              </div>
            </form>
          </motion.div>

          {/* Blog List */}
          <motion.div
            className="updates-section"
            custom={1}
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
          >
            <h3><i className="fas fa-list" /> All Blogs ({blogs.length})</h3>

            {loading ? (
              <GlobalLoader style={{ padding: '2rem' }} />
            ) : error ? (
              <p style={{ textAlign: 'center', color: '#c62828', padding: '1rem' }}><i className="fas fa-exclamation-triangle" /> {error}</p>
            ) : blogs.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '2rem', opacity: 0.6 }}><i className="fas fa-info-circle" /> No blogs yet. Create your first blog above.</p>
            ) : (
              <>
                <motion.div className="blog-grid" variants={listVariants} initial="hidden" animate="visible">
                  {paginatedBlogs.map((blog) => {
                    const blogId = blog._id || blog.id;
                    const blogImage = resolveBlogImage(blog);
                    const blogDate = blog.createdAt || blog.created_at || blog.date;
                    return (
                      <motion.div
                        key={blogId}
                        className="blog-card"
                        variants={itemVariants}
                        onClick={() => navigate(`/coordinator/blogs/${blogId}`)}
                        style={{ cursor: 'pointer' }}
                      >
                        {blogImage ? (
                          <img
                            src={blogImage}
                            alt={blog.title}
                            className="blog-card-img"
                            onError={(e) => {
                              if (process.env.NODE_ENV !== 'production') {
                                console.debug('Coordinator blog image failed:', blog.title, blogImage);
                              }
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = '/images/error.svg';
                            }}
                          />
                        ) : null}
                        <div className="blog-card-body">
                          <div className="blog-card-title">{blog.title}</div>
                          {blogDate && (
                            <div className="blog-card-date">
                              <i className="fas fa-calendar-alt" /> {new Date(blogDate).toLocaleDateString()}
                            </div>
                          )}
                          <div className="blog-card-preview">
                            {(blog.content || '').length > 100
                              ? blog.content.substring(0, 100) + '...'
                              : blog.content}
                          </div>
                          <div className="blog-card-actions">
                            <motion.button
                              type="button"
                              className="btn-secondary"
                              onClick={(e) => { e.stopPropagation(); handleEdit(blog); }}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              <i className="fas fa-edit" /> Edit
                            </motion.button>
                            <motion.button
                              type="button"
                              className="btn-danger"
                              onClick={(e) => { e.stopPropagation(); handleDelete(blogId); }}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              <i className="fas fa-trash" /> Delete
                            </motion.button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="pagination">
                    <button
                      type="button"
                      className="page-btn"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <i className="fas fa-chevron-left" />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        type="button"
                        className={`page-btn ${p === page ? 'active' : ''}`}
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="page-btn"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      <i className="fas fa-chevron-right" />
                    </button>
                  </div>
                )}
              </>
            )}
          </motion.div>

          <div style={{ textAlign: 'right', marginTop: '1rem' }}>
            <Link to="/coordinator/coordinator_dashboard" className="back-to-dashboard">
              <i className="fas fa-arrow-left" /> Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CoordinatorBlogs;











