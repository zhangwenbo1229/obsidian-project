import type { Uuid } from './common-types';
import type { Person, PersonMetadataFieldDefinition, PersonNamePresentation } from './person-types';
import type { UnifiedMetadataField, PersonMetadataRef } from './metadata-types';

export interface GlobalConfig {
	kind: 'global-config';
	schema: 1;
	projectConfigDirectory: string;
	defaultTaskDirectory: string;
	currentUserId: Uuid;
	people: Person[];
	/** @deprecated 迁移后使用 personMetadataRefs */
	personMetadataFields: PersonMetadataFieldDefinition[];
	personNamePresentation?: PersonNamePresentation;
	/** 统一元数据池 */
	unifiedMetadataFields?: UnifiedMetadataField[];
	/** 人员元数据引用（迁移后新格式） */
	personMetadataRefs?: PersonMetadataRef[];
}