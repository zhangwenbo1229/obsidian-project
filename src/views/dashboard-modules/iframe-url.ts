export function validateIframeUrl(value: string): string {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw new Error('网页卡片地址无效。');
	}
	if (url.protocol !== 'https:' && url.protocol !== 'http:') {
		throw new Error('网页卡片只允许 HTTP 或 HTTPS 地址。');
	}
	if (url.username || url.password) throw new Error('网页卡片地址不能包含用户名或密码。');
	return url.toString();
}
