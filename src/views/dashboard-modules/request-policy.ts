type DashboardRequest<T> = (url: string) => Promise<T>;

function privateIpv4(hostname: string): boolean {
	const parts = hostname.split('.').map(Number);
	if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
	const [first, second] = parts as [number, number, number, number];
	return first === 10 || first === 127 || first === 0 ||
		(first === 169 && second === 254) ||
		(first === 172 && second >= 16 && second <= 31) ||
		(first === 192 && second === 168) ||
		(first === 100 && second >= 64 && second <= 127);
}

function privateIpv6(hostname: string): boolean {
	const value = hostname.replace(/^\[|\]$/gu, '').toLowerCase();
	return value === '::1' || value === '::' || value.startsWith('fc') || value.startsWith('fd') ||
		/^fe[89ab]/u.test(value);
}

export function validateDashboardUrl(value: string): string {
	let url: URL;
	try { url = new URL(value); }
	catch { throw new Error('联网地址无效。'); }
	if (url.protocol !== 'https:') throw new Error('联网卡片只允许 HTTPS 地址。');
	const hostname = url.hostname.toLowerCase().replace(/\.$/u, '');
	if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || privateIpv4(hostname) || privateIpv6(hostname)) {
		throw new Error('联网卡片不能访问本机或私有网络地址。');
	}
	url.username = '';
	url.password = '';
	return url.toString();
}

export class DashboardRequestPolicy<T> {
	private readonly inFlight = new Map<string, Promise<T>>();

	constructor(private readonly requestFn: DashboardRequest<T>, private readonly timeoutMs = 15_000) {}

	request(value: string): Promise<T> {
		const url = validateDashboardUrl(value);
		const existing = this.inFlight.get(url);
		if (existing) return existing;
		let timer: number | undefined;
		const timeout = new Promise<never>((_, reject) => {
			timer = window.setTimeout(() => reject(new Error(`联网请求超时（${Math.ceil(this.timeoutMs / 1000)} 秒）。`)), this.timeoutMs);
		});
		const pending = Promise.race([this.requestFn(url), timeout]).finally(() => {
			if (timer) window.clearTimeout(timer);
			this.inFlight.delete(url);
		});
		this.inFlight.set(url, pending);
		return pending;
	}
}
