import type { Uuid } from './common-types';
import type { Person, PersonMetadataFieldDefinition, PersonNamePresentation } from './person-types';

export interface GlobalConfig {
	kind: 'global-config';
	schema: 1;
	projectConfigDirectory: string;
	defaultTaskDirectory: string;
	currentUserId: Uuid;
	people: Person[];
	personMetadataFields: PersonMetadataFieldDefinition[];
	personNamePresentation?: PersonNamePresentation;
}