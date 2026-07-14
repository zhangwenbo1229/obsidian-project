import type { DashboardModuleKind } from '../../domain/types';
import { calendarDefinition } from './calendar-card';
import { directoryDefinition } from './directory-card';
import { newsDefinition } from './news-card';
import { noteStatsDefinition } from './note-stats-card';
import { recentFilesDefinition } from './recent-files-card';
import type { DashboardModuleDefinition } from './types';
import { weatherDefinition } from './weather-card';

export const DASHBOARD_MODULE_DEFINITIONS: DashboardModuleDefinition[] = [
	weatherDefinition,
	calendarDefinition,
	noteStatsDefinition,
	recentFilesDefinition,
	newsDefinition,
	directoryDefinition,
];

export function getDashboardModuleDefinition(kind: string): DashboardModuleDefinition | undefined {
	return DASHBOARD_MODULE_DEFINITIONS.find((definition) => definition.kind === kind as DashboardModuleKind);
}
