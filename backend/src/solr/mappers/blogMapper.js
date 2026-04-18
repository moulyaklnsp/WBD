function mapBlogToSolrDoc(blog) {
  const id = blog?._id != null ? String(blog._id) : '';
  const title = String(blog?.title || '').trim();
  const status = String(blog?.status || '').trim().toLowerCase();
  const published = Boolean(blog?.published === true || status === 'published');
  const coordinator = String(blog?.coordinator || '').trim().toLowerCase();

  const contentPieces = [];
  if (blog?.excerpt) contentPieces.push(String(blog.excerpt));
  if (blog?.content) contentPieces.push(String(blog.content));
  if (Array.isArray(blog?.blocks)) {
    for (const b of blog.blocks) {
      if (String(b?.type || '').toLowerCase() === 'text' && b?.value) contentPieces.push(String(b.value));
    }
  }

  return {
    id: id ? `blogs:${id}` : undefined,
    blog_title_txt: title || undefined,
    blog_status_s: status || undefined,
    blog_published_b: published,
    blog_coordinator_s: coordinator || undefined,
    blog_content_txt: contentPieces.join('\n\n').trim() || undefined,
    blog_published_at_dt: blog?.published_at || undefined,
    blog_updated_date_dt: blog?.updated_date || blog?.updated_at || undefined,
    blog_created_date_dt: blog?.created_date || blog?.created_at || undefined,
    visible_to: published ? ['public'] : ['admin']
  };
}

module.exports = { mapBlogToSolrDoc };

