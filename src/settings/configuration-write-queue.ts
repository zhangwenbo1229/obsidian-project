export class ConfigurationWriteQueue<T> {
	private tail: Promise<void> = Promise.resolve();

	constructor(private readonly write: (snapshot: T) => Promise<void>) {}

	enqueue(snapshot: T): Promise<void> {
		const captured = structuredClone(snapshot);
		const pending = this.tail
			.catch(() => undefined)
			.then(() => this.write(captured));
		this.tail = pending.catch(() => undefined);
		return pending;
	}
}
