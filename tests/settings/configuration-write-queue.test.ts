import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('configuration write queue', () => {
	it('serializes concurrent snapshots and leaves the newest snapshot last', async () => {
		const moduleUrl = new URL('../../src/settings/configuration-write-queue.ts', import.meta.url);
		expect(existsSync(moduleUrl)).toBe(true);
		if (!existsSync(moduleUrl)) return;
		const { ConfigurationWriteQueue } = await import('../../src/settings/configuration-write-queue');
		const starts: number[] = [];
		const finishes: number[] = [];
		const releases: Array<() => void> = [];
		let active = 0;
		let maximumActive = 0;
		const queue = new ConfigurationWriteQueue<{ revision: number }>(async (snapshot) => {
			starts.push(snapshot.revision);
			active += 1;
			maximumActive = Math.max(maximumActive, active);
			await new Promise<void>((resolve) => releases.push(resolve));
			finishes.push(snapshot.revision);
			active -= 1;
		});
		const first = queue.enqueue({ revision: 1 });
		const second = queue.enqueue({ revision: 2 });
		await new Promise((resolve) => setImmediate(resolve));
		expect(starts).toEqual([1]);
		releases.shift()?.();
		await first;
		await new Promise((resolve) => setImmediate(resolve));
		expect(starts).toEqual([1, 2]);
		releases.shift()?.();
		await second;
		expect(maximumActive).toBe(1);
		expect(finishes).toEqual([1, 2]);
	});

	it('continues with the next snapshot after a failed write', async () => {
		const moduleUrl = new URL('../../src/settings/configuration-write-queue.ts', import.meta.url);
		if (!existsSync(moduleUrl)) return;
		const { ConfigurationWriteQueue } = await import('../../src/settings/configuration-write-queue');
		const writes: number[] = [];
		const queue = new ConfigurationWriteQueue<{ revision: number }>(async (snapshot) => {
			writes.push(snapshot.revision);
			if (snapshot.revision === 1) throw new Error('write failed');
		});
		await expect(queue.enqueue({ revision: 1 })).rejects.toThrow('write failed');
		await expect(queue.enqueue({ revision: 2 })).resolves.toBeUndefined();
		expect(writes).toEqual([1, 2]);
	});
});
