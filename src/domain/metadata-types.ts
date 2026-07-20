import type { CustomFieldOption } from './person-types';

// 合并三种系统所有字段类型
export type UnifiedFieldType =
	| 'text'
	| 'multiline-text'
	| 'number'
	| 'boolean'
	| 'date'
	| 'datetime'
	| 'single-select'
	| 'multi-select'
	| 'user'
	| 'task-reference';

export interface UnifiedMetadataField {
	id: string;
	key: string;
	name: string;
	type: UnifiedFieldType;
	icon: string;
	color: string;
	required: boolean;
	defaultValue: unknown;
	options?: CustomFieldOption[];
	isBuiltIn?: boolean;
	builtInKey?: string;
}

// 项目模板引用统一元数据
export interface ProjectTemplateMetadataRef {
	unifiedMetadataFieldId: string;
	taskTypeIds?: string[];
}

// 人员配置引用统一元数据
export interface PersonMetadataRef {
	unifiedMetadataFieldId: string;
	sourceProperty?: string;
}

// 任务元数据引用统一元数据
export interface TaskMetadataRef {
	unifiedMetadataFieldId: string;
	showInTaskView: boolean;
	showInProjectCards: boolean;
}