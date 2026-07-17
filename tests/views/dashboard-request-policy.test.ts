// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest';
import { DashboardRequestPolicy, validateDashboardUrl } from '../../src/views/dashboard-modules/request-policy';

describe('dashboard network request policy', () => {
	it('allows public HTTPS and rejects insecure or private destinations', () => {
		expect(validateDashboardUrl('https://example.com/feed')).toBe('https://example.com/feed');
		for (const url of [
			'http://example.com/feed', 'https://localhost/feed', 'https://127.0.0.1/feed',
			'https://10.0.0.1/feed', 'https://192.168.1.2/feed', 'https://169.254.1.1/feed', 'https://[::1]/feed',
		]) expect(() => validateDashboardUrl(url)).toThrow();
	});

	it('deduplicates concurrent requests', async () => {
		let resolve!: (value: string) => void;
		const request = vi.fn(() => new Promise<string>((done) => (resolve = done)));
		const policy = new DashboardRequestPolicy(request, 1000);
		const first = policy.request('https://example.com/feed');
		const second = policy.request('https://example.com/feed');
		expect(request).toHaveBeenCalledTimes(1);
		resolve('ok');
		await expect(Promise.all([first, second])).resolves.toEqual(['ok', 'ok']);
	});

	it('times out stalled requests', async () => {
		vi.useFakeTimers();
		const policy = new DashboardRequestPolicy(() => new Promise(() => undefined), 50);
		const pending = policy.request('https://example.com/feed');
		const rejection = expect(pending).rejects.toThrow('超时');
		await vi.advanceTimersByTimeAsync(51);
		await rejection;
		vi.useRealTimers();
	});
});
