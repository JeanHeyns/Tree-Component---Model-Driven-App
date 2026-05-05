import { IInputs } from '../generated/ManifestTypes';
import { ComponentConfig } from '../types';

export interface ValidationResult {
    isValid: boolean;
    missingProperties: string[];
}

export function validateConfig(
    parameters: ComponentFramework.Context<IInputs>['parameters']
): ValidationResult {
    const selectionMode = (parameters.selectionMode?.raw ?? 'single').trim().toLowerCase();
    const required: Array<{ key: string; value: string | null | undefined }> = [
        { key: 'targetEntityName', value: parameters.targetEntityName?.raw },
        { key: 'displayField', value: parameters.displayField?.raw },
        ...(selectionMode === 'multiple'
            ? [{ key: 'relationshipSchemaName', value: parameters.relationshipSchemaName?.raw }]
            : []),
    ];

    const missingProperties = required
        .filter(p => !p.value || p.value.trim() === '')
        .map(p => p.key);

    return { isValid: missingProperties.length === 0, missingProperties };
}

export function parseConfig(
    parameters: ComponentFramework.Context<IInputs>['parameters']
): ComponentConfig {
    const targetEntityName = (parameters.targetEntityName.raw ?? '').trim();
    const displayField = (parameters.displayField.raw ?? '').trim();
    const parentLookupFieldRaw = (parameters.parentLookupField?.raw ?? '').trim();
    const idFieldRaw = (parameters.idField?.raw ?? '').trim();
    const additionalRaw = (parameters.additionalSelectFields?.raw ?? '').trim();
    const targetViewIdRaw = (parameters.targetViewId?.raw ?? '').trim();
    const orderByRaw = (parameters.orderBy?.raw ?? '').trim();
    const selectionModeRaw = (parameters.selectionMode?.raw ?? '').trim().toLowerCase();
    const relationshipSchemaNameRaw = (parameters.relationshipSchemaName?.raw ?? '').trim();
    const sourceEntityNameRaw = (parameters.sourceEntityName?.raw ?? '').trim();

    return {
        targetEntityName,
        parentLookupField: parentLookupFieldRaw || null,
        displayField,
        idField: idFieldRaw || `${targetEntityName}id`,
        additionalSelectFields: additionalRaw
            ? additionalRaw.split(',').map(f => f.trim()).filter(f => f.length > 0)
            : [],
        targetViewId: targetViewIdRaw || null,
        orderBy: orderByRaw || `${displayField} asc`,
        selectionMode: selectionModeRaw === 'multiple' ? 'multiple' : 'single',
        relationshipSchemaName: relationshipSchemaNameRaw || null,
        sourceEntityName: sourceEntityNameRaw || null,
    };
}
