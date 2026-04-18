const { ObjectId } = require('mongodb');

function loadBlogsServiceWithMocks(overrides = {}) {
  jest.resetModules();

  const modelsByName = {
    blogs: {
      findMany: jest.fn(async () => []),
      findOne: jest.fn(async () => null),
      insertOne: jest.fn(async () => ({ insertedId: new ObjectId() })),
      updateOne: jest.fn(async () => ({})),
      deleteOne: jest.fn(async () => ({})),
      ...overrides.blogs
    },
    blog_reviews: {
      findMany: jest.fn(async () => []),
      insertOne: jest.fn(async () => ({})),
      ...overrides.blog_reviews
    }
  };

  const Cache = {
    invalidateTags: jest.fn(async () => ({ deleted: 0 })),
    ...overrides.cache
  };

  const coordinatorUtils = {
    safeTrim: (v) => String(v == null ? '' : v).trim(),
    requireCoordinator: (user) => {
      if (!user?.email) throw Object.assign(new Error('Unauthorized'), { statusCode: 401 });
      if (user.role !== 'coordinator') throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
    },
    ...overrides.coordinatorUtils
  };

  jest.doMock('../../../models', () => ({
    getModel: (name) => {
      const model = modelsByName[name];
      if (!model) throw new Error(`Unexpected model: ${name}`);
      return model;
    }
  }));
  jest.doMock('../../../utils/cache', () => Cache);
  jest.doMock('../../../services/coordinator/coordinatorUtils', () => coordinatorUtils);

  // eslint-disable-next-line global-require
  const BlogsService = require('../../../services/coordinator/blogsService');
  return { BlogsService, modelsByName, Cache };
}

describe('coordinator/blogsService', () => {
  test('getPublishedBlogsPublic normalizes image urls and blocks', async () => {
    const raw = {
      _id: new ObjectId(),
      title: 'Hello',
      imageUrl: 'www.example.com/img.png',
      image_urls: 'https://a.com/1.png, /local.png',
      blocks: JSON.stringify([{ type: 'text', value: ' Hi ' }, { type: 'image', url: 'www.example.com/2.png' }, { type: 'bad', value: 'x' }])
    };
    const { BlogsService } = loadBlogsServiceWithMocks({
      blogs: {
        findMany: jest.fn(async () => [raw])
      }
    });

    const result = await BlogsService.getPublishedBlogsPublic({});
    expect(result.blogs).toHaveLength(1);
    expect(result.blogs[0].image_url).toBe('https://www.example.com/img.png');
    expect(result.blogs[0].image_urls).toEqual(expect.arrayContaining(['https://a.com/1.png', '/local.png']));
    expect(result.blogs[0].blocks).toEqual([
      { type: 'text', value: 'Hi' },
      { type: 'image', value: 'https://www.example.com/2.png' }
    ]);
  });

  test('getBlogByIdPublic blocks access to unpublished blogs for non-owner', async () => {
    const id = new ObjectId();
    const { BlogsService } = loadBlogsServiceWithMocks({
      blogs: { findOne: jest.fn(async () => ({ _id: id, coordinator: 'owner@example.com', status: 'draft', published: false })) }
    });

    await expect(BlogsService.getBlogByIdPublic({}, { role: 'player', email: 'x@example.com' }, { id: id.toString() }))
      .rejects
      .toMatchObject({ statusCode: 403, message: 'Blog is not published' });
  });

  test('getBlogByIdPublic allows coordinator-owner to view draft blog', async () => {
    const id = new ObjectId();
    const { BlogsService } = loadBlogsServiceWithMocks({
      blogs: { findOne: jest.fn(async () => ({ _id: id, coordinator: 'owner@example.com', status: 'draft', published: false, title: 'T' })) }
    });

    const result = await BlogsService.getBlogByIdPublic({}, { role: 'coordinator', email: 'owner@example.com' }, { id: id.toString() });
    expect(result.blog).toMatchObject({ title: 'T' });
  });

  test('updateBlog applies tags, blocks, published status and invalidates cache', async () => {
    const id = new ObjectId();
    const { BlogsService, modelsByName, Cache } = loadBlogsServiceWithMocks({
      blogs: {
        findOne: jest.fn(async () => ({ _id: id, coordinator: 'c@example.com' })),
        updateOne: jest.fn(async () => ({}))
      }
    });

    const body = {
      title: ' New Title ',
      tags: 'a, b',
      blocks: JSON.stringify([{ type: 'text', value: 'Hello' }, { type: 'image', value: 'www.example.com/x.png' }]),
      published: 'true'
    };

    const result = await BlogsService.updateBlog({}, { email: 'c@example.com', role: 'coordinator' }, { id: id.toString(), body });
    expect(result).toEqual({ success: true });
    expect(modelsByName.blogs.updateOne).toHaveBeenCalledTimes(1);
    const updateDoc = modelsByName.blogs.updateOne.mock.calls[0][2];
    expect(updateDoc.$set.title).toBe('New Title');
    expect(updateDoc.$set.tags).toEqual(['a', 'b']);
    expect(updateDoc.$set.status).toBe('published');
    expect(updateDoc.$set.blocks).toEqual([
      { type: 'text', value: 'Hello' },
      { type: 'image', value: 'https://www.example.com/x.png' }
    ]);
    expect(Cache.invalidateTags).toHaveBeenCalledWith(['blogs'], expect.any(Object));
  });

  test('updateBlog rejects invalid tags type', async () => {
    const id = new ObjectId();
    const { BlogsService } = loadBlogsServiceWithMocks({
      blogs: {
        findOne: jest.fn(async () => ({ _id: id, coordinator: 'c@example.com' }))
      }
    });

    await expect(BlogsService.updateBlog({}, { email: 'c@example.com', role: 'coordinator' }, { id: id.toString(), body: { tags: 123 } }))
      .rejects
      .toMatchObject({ statusCode: 400, message: 'Tags must be an array or comma-separated string' });
  });

  test('deleteBlog: missing blog => 404', async () => {
    const id = new ObjectId();
    const { BlogsService } = loadBlogsServiceWithMocks({
      blogs: { findOne: jest.fn(async () => null) }
    });

    await expect(BlogsService.deleteBlog({}, { email: 'c@example.com', role: 'coordinator' }, { id: id.toString() }))
      .rejects
      .toMatchObject({ statusCode: 404 });
  });
});

