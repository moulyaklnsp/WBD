import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Blogs from './Blogs';

jest.mock('../components/ChessBackground', () => () => null);
jest.mock('../components/AnimatedSidebar', () => () => null);
jest.mock('../components/ChessTransformation', () => ({ GlobalLoader: () => <div>Loading...</div> }));
jest.mock('../utils/backendBase', () => ({ getBackendBase: () => 'http://backend.test' }));

function renderBlogs() {
  return render(
    <MemoryRouter>
      <Blogs />
    </MemoryRouter>
  );
}

describe('Blogs page', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('shows a loader while fetching, then shows empty state for empty list', async () => {
    let resolveFetch;
    global.fetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
    );

    renderBlogs();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();

    resolveFetch({ ok: true, json: async () => [] });
    expect(await screen.findByText(/no published blogs yet/i)).toBeInTheDocument();
  });

  it('renders blogs returned by the API and links to the blog detail page', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { _id: 'b1', title: 'My Blog', excerpt: 'Hello world', image_url: '' },
      ],
    });

    renderBlogs();
    const link = await screen.findByRole('link', { name: /my blog/i });
    expect(link).toHaveAttribute('href', '/blogs/b1');
    expect(screen.getByText(/hello world/i)).toBeInTheDocument();
  });

  it('shows an error message when the API returns a failure response', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Failed to load blogs' }),
    });

    renderBlogs();
    expect(await screen.findByText('Failed to load blogs')).toBeInTheDocument();
  });

  it('shows the empty state when API returns no blogs', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ blogs: [] }) });

    renderBlogs();
    expect(await screen.findByText(/no published blogs yet/i)).toBeInTheDocument();
  });

  it('falls back to the error image when a blog image fails to load', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { _id: 'b2', title: 'With Image', excerpt: 'x', image_url: 'https://example.com/img.png' },
      ],
    });

    renderBlogs();
    const img = await screen.findByRole('img', { name: /with image/i });
    fireEvent.error(img);
    expect(img.getAttribute('src')).toContain('/images/error.svg');
  });

  it('prefixes /uploads image paths with backend base URL', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { _id: 'b3', title: 'Upload Image', excerpt: 'x', image_url: '/uploads/pic.png' },
      ],
    });

    renderBlogs();
    const img = await screen.findByRole('img', { name: /upload image/i });
    expect(img.getAttribute('src')).toBe('http://backend.test/uploads/pic.png');
  });
});

