export function isUuidV4(value: unknown): value is string {
	return (
		typeof value === 'string' &&
		/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
			value,
		)
	);
}

export function createUuid(): string {
	return crypto.randomUUID();
}

export function isTaskKey(value: unknown): value is string {
	return typeof value === 'string' && /^[A-Z][A-Z0-9]*-[1-9]\d*$/.test(value);
}
