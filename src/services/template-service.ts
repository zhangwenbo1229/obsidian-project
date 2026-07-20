import type { ProjectConfig, TaskConfigurationTemplate } from '../domain/types';
import type { ProjectTemplateMetadataRef } from '../domain/metadata-types';

export function applyConfigurationTemplate(
	project: ProjectConfig,
	template: TaskConfigurationTemplate,
): ProjectConfig {
	return {
		...structuredClone(project),
		templateId: template.id,
		taskTypes: structuredClone(template.taskTypes),
		customFields: structuredClone(template.customFields.map((field) => ({
			...field,
			taskTypeIds: [template.taskTypes[0]?.id].filter((id): id is string => Boolean(id)),
		}))),
		customFieldRefs: structuredClone(template.customFieldRefs ?? []),
		workflow: structuredClone(template.workflow),
	};
}

export function applyConfigurationTemplates(
	project: ProjectConfig,
	templates: readonly TaskConfigurationTemplate[],
): ProjectConfig {
	if (templates.length === 0) return { ...structuredClone(project), templateId: null, templateIds: [], customFieldRefs: [] };
	const taskTypes = templates.flatMap((template) => template.taskTypes.slice(0, 1));
	const fieldsByKey = new Map<string, TaskConfigurationTemplate['customFields'][number]>();
	for (const template of templates) {
		const taskTypeId = template.taskTypes[0]?.id;
		for (const field of template.customFields) {
			const existing = fieldsByKey.get(field.key);
			const taskTypeIds = [...new Set([
				...(existing?.taskTypeIds ?? []),
				...(taskTypeId ? [taskTypeId] : []),
			])];
			fieldsByKey.set(field.key, { ...structuredClone(field), taskTypeIds });
		}
	}
	const refsByFieldId = new Map<string, ProjectTemplateMetadataRef>();
	for (const template of templates) {
		const taskTypeId = template.taskTypes[0]?.id;
		for (const ref of template.customFieldRefs ?? []) {
			const existing = refsByFieldId.get(ref.unifiedMetadataFieldId);
			// ref.taskTypeIds 为空表示"适用所有任务类型"，保持空即可
			const refTaskTypeIds = ref.taskTypeIds ?? [];
			const taskTypeIds = refTaskTypeIds.length === 0
				? (existing?.taskTypeIds ?? [])
				: [...new Set([
					...(existing?.taskTypeIds ?? []),
					...(taskTypeId ? [taskTypeId] : []),
					...refTaskTypeIds,
				])];
			refsByFieldId.set(ref.unifiedMetadataFieldId, {
				unifiedMetadataFieldId: ref.unifiedMetadataFieldId,
				taskTypeIds,
			});
		}
	}
	return {
		...structuredClone(project),
		templateId: templates[0]!.id,
		templateIds: templates.map((template) => template.id),
		taskTypes: structuredClone(taskTypes),
		customFields: structuredClone([...fieldsByKey.values()]),
		customFieldRefs: structuredClone([...refsByFieldId.values()]),
		workflow: structuredClone(templates[0]!.workflow),
	};
}
