const { connectDB } = require('../../config/database');
const { ObjectId } = require('mongodb');
const StorageModel = require('../../models/StorageModel');
const { safeTrim, requireCoordinator } = require('./coordinatorUtils');
const { getModel } = require('../../models');
const BlogsModel = getModel('blogs');
const BlogReviewsModel = getModel('blog_reviews');

const createError = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const resolveDb = async (db) => (db ? db : connectDB());

function normalizeImageUrlValue(rawValue) {
  if (typeof rawValue !== 'string') return '';
  const value = rawValue.trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value) || value.startsWith('data:')) return value;
  if (value.startsWith('/')) return value;
  if (/^www\./i.test(value)) return `https://${value}`;
  return value;
}

function normalizeImageArray(input) {
  if (!input) return [];
  const rawList = Array.isArray(input)
    ? input
    : (typeof input === 'string'
        ? input.split(',').map((v) => v.trim()).filter(Boolean)
        : []);
  return rawList
    .map((value) => normalizeImageUrlValue(String(value || '').trim()))
    .filter(Boolean);
}

function normalizeBlogBlocks(rawBlocks) {
  if (!rawBlocks) return [];
  let blocks = rawBlocks;
  if (typeof rawBlocks === 'string') {
    try {
      blocks = JSON.parse(rawBlocks);
    } catch {
      blocks = [];
    }
  }
  if (!Array.isArray(blocks)) return [];
  return blocks
    .map((block) => {
      const type = String(block?.type || '').trim().toLowerCase();
      if (!type || !['text', 'image'].includes(type)) return null;
      const value = type === 'text'
        ? safeTrim(block?.value || block?.text || '')
        : normalizeImageUrlValue(block?.value || block?.url || '');
      if (!value) return null;
      return { type, value };
    })
    .filter(Boolean);
}

function normalizeBlogResponse(blog) {
  const imageCandidate = [
    blog?.image_url,
    blog?.imageUrl,
    blog?.image,
    blog?.coverImage,
    blog?.cover_image
  ].find((v) => typeof v === 'string' && v.trim());

  const normalizedImage = normalizeImageUrlValue(imageCandidate);
  const normalizedImageArray = normalizeImageArray(blog?.image_urls || blog?.imageUrls || blog?.images);
  const normalizedBlocks = normalizeBlogBlocks(blog?.blocks || blog?.content_blocks || blog?.contentBlocks);

  return {
    ...blog,
    image_url: normalizedImage || blog?.image_url || '',
    imageUrl: normalizedImage || blog?.imageUrl || '',
    image_urls: normalizedImageArray,
    imageUrls: normalizedImageArray,
    blocks: normalizedBlocks
  };
}

const BlogsService = {
  async getBlogs(db, user) {
    requireCoordinator(user);
    const userEmail = user?.email;
    const database = await resolveDb(db);

    const blogs = await BlogsModel.findMany(
      database,
      { coordinator: userEmail },
      { sort: { created_date: -1 } }
    );

    return { blogs: (blogs || []).map(normalizeBlogResponse) };
  },

  async getPublishedBlogsPublic(db) {
    const database = await resolveDb(db);
    const blogs = await BlogsModel.findMany(
      database,
      {
        $or: [
          { status: 'published' },
          { published: true }
        ]
      },
      {
        sort: {
          published_at: -1,
          updated_date: -1,
          created_date: -1
        }
      }
    );

    return { blogs: (blogs || []).map(normalizeBlogResponse) };
  },

  async getBlogById(db, user, { id }) {
    requireCoordinator(user);
    if (!ObjectId.isValid(id)) throw createError('Invalid blog ID', 400);
    const database = await resolveDb(db);
    const userEmail = user?.email;
    const blog = await BlogsModel.findOne(database, { _id: new ObjectId(id), coordinator: userEmail });
    if (!blog) throw createError('Blog not found or access denied', 404);
    return { blog: normalizeBlogResponse(blog) };
  },

  async getBlogByIdPublic(db, user, { id }) {
    if (!ObjectId.isValid(id)) throw createError('Invalid blog ID', 400);
    const database = await resolveDb(db);
    const blog = await BlogsModel.findOne(database, { _id: new ObjectId(id) });
    if (!blog) throw createError('Blog not found', 404);

    const isOwner = user?.role === 'coordinator'
      && String(blog.coordinator || '').toLowerCase() === String(user?.email || '').toLowerCase();
    const isPublished = blog.status === 'published' || blog.published === true;
    if (!isPublished && !isOwner) {
      throw createError('Blog is not published', 403);
    }

    return { blog: normalizeBlogResponse(blog) };
  },

  async uploadBlogImages(db, user, { files }) {
    requireCoordinator(user);
    if (!files || files.length === 0) throw createError('No images uploaded', 400);
    void user;

    const uploads = [];
    for (const file of files) {
      const result = await StorageModel.uploadImageBuffer(file.buffer, {
        folder: 'blogs',
        public_id: `${Date.now()}_${file.originalname}`,
        resource_type: 'image'
      });
      uploads.push({
        url: result?.secure_url,
        public_id: result?.public_id,
        filename: file.originalname
      });
    }

    return { images: uploads.filter((u) => u.url) };
  },

  async getBlogReviews(db, { id }) {
    if (!ObjectId.isValid(id)) throw createError('Invalid blog ID', 400);
    const database = await resolveDb(db);
    const reviews = await BlogReviewsModel.findMany(
      database,
      { blog_id: new ObjectId(id) },
      { sort: { created_at: -1 } }
    );

    return {
      reviews: (reviews || []).map((r) => ({
        ...r,
        _id: r._id?.toString(),
        user_name: r.user_name || r.user_email || 'User',
        comment: r.comment || '',
        created_at: r.created_at || r.review_date || new Date()
      }))
    };
  },

  async addBlogReview(db, user, { id, body }) {
    if (!ObjectId.isValid(id)) throw createError('Invalid blog ID', 400);

    const comment = safeTrim(body?.comment || body?.review || '');
    const name = safeTrim(body?.name || body?.user_name || '');
    if (!comment) throw createError('Comment is required', 400);

    const database = await resolveDb(db);
    const blog = await BlogsModel.findOne(database, { _id: new ObjectId(id) });
    if (!blog) throw createError('Blog not found', 404);
    const isOwner = user?.role === 'coordinator'
      && String(blog.coordinator || '').toLowerCase() === String(user?.email || '').toLowerCase();
    const isPublished = blog.status === 'published' || blog.published === true;
    if (!isPublished && !isOwner) {
      throw createError('Blog is not published', 403);
    }

    const review = {
      blog_id: new ObjectId(id),
      user_name: name || user?.username || 'Anonymous',
      user_email: user?.email || '',
      user_role: user?.role || 'guest',
      comment,
      created_at: new Date()
    };
    await BlogReviewsModel.insertOne(database, review);
    return { success: true, review };
  },

  async createBlog(db, user, { body }) {
    requireCoordinator(user);
    const {
      title,
      content,
      excerpt,
      tags,
      published,
      status,
      imageUrl,
      image_url,
      image,
      coverImage,
      cover_image,
      imageUrls,
      image_urls,
      images,
      blocks,
      contentBlocks,
      content_blocks
    } = body || {};

    const database = await resolveDb(db);
    const coordinatorEmail = user?.email;

    const normalizedTitle = typeof title === 'string' ? title.trim() : '';
    const normalizedBlocks = normalizeBlogBlocks(blocks || contentBlocks || content_blocks);
    const normalizedContent = typeof content === 'string' ? content.trim() : '';
    const derivedContent = normalizedContent || normalizedBlocks.filter((b) => b.type === 'text').map((b) => b.value).join('\n\n');
    if (!normalizedTitle || !derivedContent) {
      throw createError('Title and content are required', 400);
    }

    const normalizedExcerpt = typeof excerpt === 'string' ? excerpt.trim() : '';
    const normalizedTags = Array.isArray(tags)
      ? tags.map((t) => String(t).trim()).filter(Boolean)
      : (typeof tags === 'string'
          ? tags.split(',').map((t) => t.trim()).filter(Boolean)
          : []);
    const normalizedStatus = typeof status === 'string' && status.trim() ? status.trim().toLowerCase() : null;
    const normalizedPublished = normalizedStatus
      ? normalizedStatus === 'published'
      : (typeof published === 'boolean'
          ? published
          : (typeof published === 'string' ? published.toLowerCase() === 'true' : false));
    const rawImageInput = [imageUrl, image_url, image, coverImage, cover_image]
      .find((v) => typeof v === 'string' && v.trim()) || '';
    const normalizedImageUrl = normalizeImageUrlValue(rawImageInput);
    const normalizedImageUrls = normalizeImageArray(imageUrls || image_urls || images);
    const blockImageUrls = normalizedBlocks.filter((b) => b.type === 'image').map((b) => b.value);
    const mergedImageUrls = Array.from(new Set([...(normalizedImageUrls || []), ...(blockImageUrls || [])].filter(Boolean)));

    const blog = {
      title: normalizedTitle,
      content: derivedContent,
      author: coordinatorEmail,
      coordinator: coordinatorEmail,
      created_date: new Date(),
      updated_date: new Date(),
      published: normalizedPublished,
      status: normalizedPublished ? 'published' : 'draft',
      published_at: normalizedPublished ? new Date() : null,
      tags: normalizedTags
    };

    if (normalizedExcerpt) blog.excerpt = normalizedExcerpt;
    if (normalizedImageUrl) {
      blog.image_url = normalizedImageUrl;
      blog.imageUrl = normalizedImageUrl;
    }
    if (mergedImageUrls.length > 0) {
      blog.image_urls = mergedImageUrls;
      blog.imageUrls = mergedImageUrls;
    }
    if (normalizedBlocks.length > 0) {
      blog.blocks = normalizedBlocks;
    }
    Object.keys(blog).forEach((k) => blog[k] === undefined && delete blog[k]);

    const result = await BlogsModel.insertOne(database, blog);
    blog._id = result.insertedId;

    return { success: true, blog: normalizeBlogResponse(blog) };
  },

  async updateBlog(db, user, { id, body }) {
    requireCoordinator(user);
    if (!ObjectId.isValid(id)) throw createError('Invalid blog ID', 400);

    const database = await resolveDb(db);
    const coordinatorEmail = user?.email;

    const blog = await BlogsModel.findOne(database, {
      _id: new ObjectId(id),
      coordinator: coordinatorEmail
    });
    if (!blog) throw createError('Blog not found or access denied', 404);

    const updates = body || {};
    const $set = { updated_date: new Date() };
    const $unset = {};

    if (updates.title !== undefined) {
      if (typeof updates.title !== 'string' || !updates.title.trim()) {
        throw createError('Title must be a non-empty string', 400);
      }
      $set.title = updates.title.trim();
    }

    if (updates.content !== undefined) {
      if (typeof updates.content !== 'string' || !updates.content.trim()) {
        throw createError('Content must be a non-empty string', 400);
      }
      $set.content = updates.content.trim();
    }

    if (updates.excerpt !== undefined) {
      if (updates.excerpt === null || (typeof updates.excerpt === 'string' && !updates.excerpt.trim())) {
        $unset.excerpt = '';
      } else if (typeof updates.excerpt === 'string') {
        $set.excerpt = updates.excerpt.trim();
      } else {
        throw createError('Excerpt must be a string', 400);
      }
    }

    if (updates.tags !== undefined) {
      if (Array.isArray(updates.tags)) {
        $set.tags = updates.tags.map((t) => String(t).trim()).filter(Boolean);
      } else if (typeof updates.tags === 'string') {
        $set.tags = updates.tags.split(',').map((t) => t.trim()).filter(Boolean);
      } else {
        throw createError('Tags must be an array or comma-separated string', 400);
      }
    }

    const incomingBlocks = updates.blocks !== undefined
      ? updates.blocks
      : (updates.contentBlocks !== undefined ? updates.contentBlocks : updates.content_blocks);
    if (incomingBlocks !== undefined) {
      const normalizedBlocks = normalizeBlogBlocks(incomingBlocks);
      if (normalizedBlocks.length === 0) {
        $unset.blocks = '';
      } else {
        $set.blocks = normalizedBlocks;
        if (updates.content === undefined) {
          $set.content = normalizedBlocks
            .filter((b) => b.type === 'text')
            .map((b) => b.value)
            .join('\n\n');
        }
      }
    }

    const incomingImageUrls = updates.imageUrls !== undefined
      ? updates.imageUrls
      : (updates.image_urls !== undefined ? updates.image_urls : updates.images);
    if (incomingImageUrls !== undefined) {
      const normalizedArray = normalizeImageArray(incomingImageUrls);
      if (normalizedArray.length === 0) {
        $unset.image_urls = '';
        $unset.imageUrls = '';
      } else {
        $set.image_urls = normalizedArray;
        $set.imageUrls = normalizedArray;
        if (!('image_url' in $set) && !('imageUrl' in $set)) {
          $set.image_url = normalizedArray[0];
          $set.imageUrl = normalizedArray[0];
        }
      }
    }

    if (updates.published !== undefined) {
      if (typeof updates.published === 'boolean') {
        $set.published = updates.published;
      } else if (typeof updates.published === 'string') {
        $set.published = updates.published.toLowerCase() === 'true';
      } else {
        throw createError('Published must be a boolean', 400);
      }
      $set.status = $set.published ? 'published' : 'draft';
      $set.published_at = $set.published ? new Date() : null;
    }

    if (updates.status !== undefined) {
      if (typeof updates.status !== 'string') {
        throw createError('Status must be a string', 400);
      }
      const normalizedStatus = updates.status.trim().toLowerCase();
      if (!['draft', 'published'].includes(normalizedStatus)) {
        throw createError('Status must be either draft or published', 400);
      }
      $set.status = normalizedStatus;
      $set.published = normalizedStatus === 'published';
      $set.published_at = normalizedStatus === 'published' ? new Date() : null;
    }

    const incomingImageUrl = updates.imageUrl !== undefined ? updates.imageUrl : (updates.image_url !== undefined ? updates.image_url : (updates.image !== undefined ? updates.image : (updates.coverImage !== undefined ? updates.coverImage : updates.cover_image)));
    if (incomingImageUrl !== undefined) {
      if (incomingImageUrl === null || (typeof incomingImageUrl === 'string' && !incomingImageUrl.trim())) {
        $unset.image_url = '';
        $unset.imageUrl = '';
      } else if (typeof incomingImageUrl === 'string') {
        const normalizedIncomingImage = normalizeImageUrlValue(incomingImageUrl);
        $set.image_url = normalizedIncomingImage;
        $set.imageUrl = normalizedIncomingImage;
      } else {
        throw createError('Image URL must be a string', 400);
      }
    }

    const updateDoc = { $set };
    if (Object.keys($unset).length > 0) updateDoc.$unset = $unset;

    await BlogsModel.updateOne(
      database,
      { _id: new ObjectId(id), coordinator: coordinatorEmail },
      updateDoc
    );

    return { success: true };
  },

  async deleteBlog(db, user, { id }) {
    requireCoordinator(user);
    if (!ObjectId.isValid(id)) throw createError('Invalid blog ID', 400);

    const database = await resolveDb(db);
    const coordinatorEmail = user?.email;

    const blog = await BlogsModel.findOne(database, {
      _id: new ObjectId(id),
      coordinator: coordinatorEmail
    });
    if (!blog) throw createError('Blog not found or access denied', 404);

    await BlogsModel.deleteOne(database, { _id: new ObjectId(id) });
    return { success: true };
  }
};

module.exports = BlogsService;
