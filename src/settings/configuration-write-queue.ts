export class ConfigurationWriteQueue<T> {
	private tail: Promise<void> = Promise.resolve();
	private nextSnapshot: T | null = null;
	private writing = false;

	constructor(private readonly write: (snapshot: T) => Promise<void>) {}

	enqueue(snapshot: T): Promise<void> {
		this.nextSnapshot = structuredClone(snapshot);
		if (this.writing) {
			return this.tail.then(() => this.flush());
		}
		return this.flush();
	}

	private async flush(): Promise<void> {
		this.writing = true;
		try {
			while (this.nextSnapshot) {
				const snapshot = this.nextSnapshot;
				this.nextSnapshot = null;
				// Chain onto the tail to serialize writes
				this.tail = this.tail
					.catch(() => undefined)
					.then(() => this.write(snapshot));
				await this.tail;
			}
		} finally {
			this.writing = false;
		}
	}

	get isIdle(): boolean {
		return !this.writing;
	}
}