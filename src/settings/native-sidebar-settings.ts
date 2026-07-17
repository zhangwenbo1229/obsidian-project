export interface PropertyGroupPresentation {
	id: string;
	name: string;
	order: number;
	icon?: string;
	color?: string;
}

export interface PropertyPresentation {
	icon?: string;
	color?: string;
	groupId?: string;
}

export interface NativeSidebarSettings {
	tagsEnabled: boolean;
	propertiesEnabled: boolean;
	propertyGroups: PropertyGroupPresentation[];
	propertyStyles: Record<string, PropertyPresentation>;
}

function record(value: unknown): Record<string, unknown> {
	return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function color(value: unknown): string | undefined {
	return typeof value === 'string' && /^#[0-9a-f]{6}$/iu.test(value.trim()) ? value.trim().toLowerCase() : undefined;
}

export function normalizeNativeSidebarSettings(value?: unknown): NativeSidebarSettings {
	const source = record(value);
	const groups = Array.isArray(source.propertyGroups) ? source.propertyGroups : [];
	const styles = record(source.propertyStyles);
	return {
		tagsEnabled: source.tagsEnabled !== false,
		propertiesEnabled: source.propertiesEnabled !== false,
		propertyGroups: groups.flatMap((value, index) => {
			const group = record(value);
			const id = typeof group.id === 'string' ? group.id.trim() : '';
			const name = typeof group.name === 'string' ? group.name.trim() : '';
			return id && name ? [{
				id, name, order: typeof group.order === 'number' && Number.isFinite(group.order) ? group.order : index,
				...(typeof group.icon === 'string' && group.icon.trim() ? { icon: group.icon.trim() } : {}),
				...(color(group.color) ? { color: color(group.color) } : {}),
			}] : [];
		}),
		propertyStyles: Object.fromEntries(Object.entries(styles).flatMap(([key, value]) => {
			const style = record(value);
			const normalized: PropertyPresentation = {
				...(typeof style.icon === 'string' && style.icon.trim() ? { icon: style.icon.trim() } : {}),
				...(color(style.color) ? { color: color(style.color) } : {}),
				...(typeof style.groupId === 'string' && style.groupId.trim() ? { groupId: style.groupId.trim() } : {}),
			};
			return key.trim() ? [[key.trim(), normalized]] : [];
		})),
	};
}
