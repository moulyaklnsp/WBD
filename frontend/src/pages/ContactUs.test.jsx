import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ContactUs from './ContactUs';

jest.mock('../components/ChessBackground', () => () => null);
jest.mock('../components/AnimatedSidebar', () => () => null);

function fillContactForm({ name = 'Jane Doe', email = 'jane@example.com', message = 'Hello there' } = {}) {
  fireEvent.change(screen.getByPlaceholderText(/enter your name/i), { target: { value: name } });
  fireEvent.change(screen.getByPlaceholderText(/enter your email/i), { target: { value: email } });
  fireEvent.change(screen.getByPlaceholderText(/type your message here/i), { target: { value: message } });
}

describe('ContactUs page', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the contact form fields and submit button', () => {
    render(<ContactUs />);

    expect(screen.getByPlaceholderText(/enter your name/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/enter your email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/type your message here/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument();
  });

  it('shows required field errors when submitting empty form', async () => {
    render(<ContactUs />);

    await userEvent.click(screen.getByRole('button', { name: /send message/i }));

    expect(await screen.findByText('Name is required.')).toBeInTheDocument();
    expect(screen.getByText('Email is required.')).toBeInTheDocument();
    expect(screen.getByText('Message cannot be empty.')).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('validates email format on submit', async () => {
    render(<ContactUs />);

    fillContactForm({ email: 'not-an-email' });
    await userEvent.click(screen.getByRole('button', { name: /send message/i }));

    expect(await screen.findByText('Please enter a valid email address.')).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('blocks submit when message exceeds 200 words', async () => {
    render(<ContactUs />);

    const tooManyWords = Array.from({ length: 201 }).fill('word').join(' ');
    fillContactForm({ message: tooManyWords });

    expect(await screen.findByText('Message cannot exceed 200 words.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /send message/i }));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('submits the form and shows success message on success response', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, message: 'Message sent successfully!' }),
    });

    render(<ContactUs />);
    fillContactForm({ name: '  Jane  ', email: '  jane@example.com  ', message: '  hi  ' });

    await userEvent.click(screen.getByRole('button', { name: /send message/i }));

    await screen.findByText('Message sent successfully!');
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/contactus',
      expect.objectContaining({ method: 'POST', headers: { 'Content-Type': 'application/json' } })
    );

    expect(screen.getByPlaceholderText(/enter your name/i)).toHaveValue('');
    expect(screen.getByPlaceholderText(/enter your email/i)).toHaveValue('');
    expect(screen.getByPlaceholderText(/type your message here/i)).toHaveValue('');
  });

  it('shows server failure message when API returns success=false', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: false, message: 'Failed to send message.' }),
    });

    render(<ContactUs />);
    fillContactForm();

    await userEvent.click(screen.getByRole('button', { name: /send message/i }));

    expect(await screen.findByText('Failed to send message.')).toBeInTheDocument();
  });
});
