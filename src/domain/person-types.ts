import type { Uuid } from './common-types';

export interface Person {
	id: Uuid;
	name: string;
	active: boolean;
	sourcePath?: string;
	metadata?: Record<string, unknown>;
}

export type PersonMetadataFieldType =
	| 'text'
	| 'multiline-text'
	| 'number'
	| 'boolean'
	| 'date'
	| 'datetime'
	| 'single-select'
	| 'multi-select';

export interface PersonMetadataFieldDefinition {
	id: string;
	key: string;
	title: string;
	type: PersonMetadataFieldType;
	active: boolean;
	sourceProperty?: string;
	icon?: string;
	color?: string;
	options?: CustomFieldOption[];
}

export interface PersonNamePresentation {
	title: string;
	icon?: string;
	color?: string;
	/** 引用统一元数据字段池中的字段 ID */
	unifiedMetadataFieldId?: string;
}

export interface CustomFieldOption {
	id: string;
	name: string;
}