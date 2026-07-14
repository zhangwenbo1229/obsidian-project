export async function mapConcurrent<T, R>(
	items: readonly T[],
	concurrency: number,
	map: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
	const results = new Array<R>(items.length);
	let nextIndex = 0;
	const worker = async () => {
		while (nextIndex < items.length) {
			const index = nextIndex;
			nextIndex += 1;
			results[index] = await map(items[index]!, index);
		}
	};
	const workerCount = Math.min(items.length, Math.max(1, Math.floor(concurrency)));
	await Promise.all(Array.from({ length: workerCount }, () => worker()));
	return results;
}
