/** @vitest-environment jsdom */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import SetupPage from './SetupPage';
import LoginPage from './LoginPage';

const { loginMock } = vi.hoisted(() => ({ loginMock: vi.fn() }));

vi.mock('@/lib/api', () => ({
  api: {
    login: loginMock,
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}));

describe('setup to login contract', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 })));
    loginMock.mockResolvedValue({ accessToken: 'token', expiresAt: '2026-08-28T00:00:00.000Z', user: { id: 1, email: 'setup.admin@example.com', role: 'admin', organizationId: 'org-1' } });
  });

  it('persists the setup email and LoginPage reuses it after redirect', async () => {
    render(<SetupPage onSetupCompleted={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Company Name'), { target: { value: 'Example Corp' } });
    fireEvent.change(screen.getByLabelText('Admin Email / Username'), { target: { value: 'setup.admin@example.com' } });
    fireEvent.change(screen.getByLabelText('Admin Password'), { target: { value: 'StrongPassword!123' } });
    fireEvent.click(screen.getByRole('button', { name: /Complete Setup/ }));

    await waitFor(() => expect(window.localStorage.getItem('sentinelpulse.adminEmail')).toBe('setup.admin@example.com'));

    render(<LoginPage onAuthenticated={vi.fn()} />);
    expect((screen.getByLabelText('Work email') as HTMLInputElement).value).toBe('setup.admin@example.com');
  });
});
