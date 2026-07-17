import type { HeatmapCell } from './heatmap-model';

export type CheckInHistory = Record<string, string[]>;
export type CheckInHistories = Record<string, CheckInHistory>;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;

function iso(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function previousDate(value: string): string {
	const [year = 0, month = 1, day = 1] = value.split('-').map(Number);
	const date = new Date(year, month - 1, day);
	date.setDate(date.getDate() - 1);
	return iso(date);
}

export function normalizeCheckInHistory(value: unknown): CheckInHistory {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
	return Object.fromEntries(Object.entries(value as Record<string, unknown>).flatMap(([date, events]) => {
		if (!ISO_DATE.test(date) || !Array.isArray(events)) return [];
		const normalized = [...new Set(events.filter((event): event is string =>
			typeof event === 'string' && Number.isFinite(Date.parse(event)),
		))].sort().slice(0, 100);
		return normalized.length > 0 ? [[date, normalized]] : [];
	}));
}

export function normalizeCheckInHistories(value: unknown): CheckInHistories {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
	return Object.fromEntries(Object.entries(value as Record<string, unknown>).flatMap(([cardId, history]) => {
		const normalized = normalizeCheckInHistory(history);
		return cardId.trim() && Object.keys(normalized).length > 0 ? [[cardId.trim(), normalized]] : [];
	}));
}

export function checkInHistoryFor(histories: CheckInHistories, cardId: string | null | undefined): CheckInHistory {
	return cardId ? histories[cardId] ?? {} : {};
}

export function checkInSummary(history: CheckInHistory, today: string, dailyTarget: number) {
	const target = Math.min(20, Math.max(1, Math.round(dailyTarget)));
	const todayCount = history[today]?.length ?? 0;
	let currentStreak = 0;
	let cursor = today;
	while ((history[cursor]?.length ?? 0) > 0) {
		currentStreak += 1;
		cursor = previousDate(cursor);
	}
	return {
		todayCount,
		dailyTarget: target,
		completedToday: todayCount >= target,
		progress: Math.min(1, todayCount / target),
		totalDays: Object.values(history).filter((events) => events.length > 0).length,
		currentStreak,
	};
}

export function buildCheckInHeatmap(
	history: CheckInHistory,
	days: number,
	now = new Date(),
): { cells: HeatmapCell[]; total: number; maximum: number } {
	const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const start = new Date(end);
	start.setDate(start.getDate() - Math.max(1, days) + 1);
	start.setDate(start.getDate() - start.getDay());
	const last = new Date(end);
	last.setDate(last.getDate() + (6 - last.getDay()));
	const maximum = Math.max(0, ...Object.values(history).map((events) => events.length));
	const cells: HeatmapCell[] = [];
	for (const cursor = new Date(start); cursor <= last; cursor.setDate(cursor.getDate() + 1)) {
		const date = iso(cursor);
		const count = history[date]?.length ?? 0;
		cells.push({ date, count, level: count === 0 || maximum === 0 ? 0 : Math.max(1, Math.ceil(count / maximum * 4)) });
	}
	return { cells, total: cells.reduce((sum, cell) => sum + cell.count, 0), maximum };
}
