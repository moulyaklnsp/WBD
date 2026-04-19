import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import BlogDetail from './BlogDetail';

jest.mock('../components/ChessBackground', () => () => null);
jest.mock('../components/AnimatedSidebar', () => () => null);
jest.mock('../components/ChessTransformation', () => ({ GlobalLoader: () => <div>Loading...</div> }));
jest.mock('../components/ImageCarousel', () => ({ images }) => (
  <div data-testid="carousel">{(images || []).join('|')}</div>
));
jest.mock('../utils/backendBase', () => ({ getBackendBase: () => 'http://backend.test' }));

function renderBlogDetail(id = '123') {
  return render(
    <MemoryRouter initialEntries={[`/blogs/${id}`]}>
      <Routes>
        <Route path="/blogs/:id" element={<BlogDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('BlogDetail page', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('loads and renders blog details', async () => {
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ blog: { title: 'Hello', content: 'Body' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ reviews: [] }) });

    renderBlogDetail('abc');
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Hello' })).toBeInTheDocument();
  });

  it('shows an error message when blog fetch fails', async () => {
    global.fetch
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Failed to load blog' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ reviews: [] }) });

    renderBlogDetail();
    expect(await screen.findByText('Failed to load blog')).toBeInTheDocument();
  });

  it('shows "Blog not found" when API returns no blog', async () => {
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ blog: null }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ reviews: [] }) });

    renderBlogDetail();
    expect(await screen.findByText(/blog not found/i)).toBeInTheDocument();
  });

  it('renders reviews when reviews API returns items', async () => {
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ blog: { title: 'Hello', content: 'Body' } }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ reviews: [{ user_name: 'Ana', comment: 'Nice post', created_at: Date.now() }] }),
      });

    renderBlogDetail();
    expect(await screen.findByText('Nice post')).toBeInTheDocument();
    expect(screen.getByText('Ana')).toBeInTheDocument();
  });

  it('does not submit a review when comment is empty', async () => {
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ blog: { title: 'Hello', content: 'Body' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ reviews: [] }) });

    renderBlogDetail();
    await screen.findByRole('heading', { name: 'Hello' });

    await userEvent.click(screen.getByRole('button', { name: /submit review/i }));
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('submits a review, shows submitting state, then clears the form on success', async () => {
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ blog: { title: 'Hello', content: 'Body' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ reviews: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ reviews: [{ comment: 'Great!', user_name: 'User' }] }) });

    renderBlogDetail('abc');
    await screen.findByRole('heading', { name: 'Hello' });

    await userEvent.type(screen.getByPlaceholderText(/write your review/i), 'Great!');
    await userEvent.click(screen.getByRole('button', { name: /submit review/i }));

    expect(await screen.findByRole('button', { name: /submitting/i })).toBeDisabled();
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(4));
    await waitFor(() => expect(screen.getByPlaceholderText(/write your review/i)).toHaveValue(''));
  });

  it('renders content paragraphs when blocks are not provided', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ blog: { title: 'Hello', content: 'Para one\n\nPara two' } }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ reviews: [] }) });

    renderBlogDetail();
    expect(await screen.findByText('Para one')).toBeInTheDocument();
    expect(screen.getByText('Para two')).toBeInTheDocument();
  });
});
