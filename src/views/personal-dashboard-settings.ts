import type { DashboardCardKind } from '../domain/types';

export interface PersonalDashboardSettings {
	enabledCardKinds: DashboardCardKind[];
}

export const ALL_DASHBOARD_CARD_KINDS: DashboardCardKind[] = [
	'number',
	'percentage',
	'task-list',
	'weather',
	'calendar',
	'note-stats',
	'recent-files',
	'news',
	'directory',
];

export function normalizePersonalDashboardSettings(value?: unknown): PersonalDashboardSettings {
	const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
	if (!Array.isArray(source.enabledCardKinds)) {
		return { enabledCardKinds: [...ALL_DASHBOARD_CARD_KINDS] };
	}
	const supported = new Set<DashboardCardKind>(ALL_DASHBOARD_CARD_KINDS);
	return {
		enabledCardKinds: [...new Set(source.enabledCardKinds.filter((kind): kind is DashboardCardKind =>
			typeof kind === 'string' && supported.has(kind as DashboardCardKind),
		))],
	};
}
