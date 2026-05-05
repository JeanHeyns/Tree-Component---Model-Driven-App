import { IInputs } from './generated/ManifestTypes';

export interface RawRecord {
    [key: string]: unknown;
}

export interface TreeNodeData {
    id: string;
    displayName: string;
    parentId: string | null;
    children: TreeNodeData[];
    isOrphan: boolean;
    raw: RawRecord;
}

export type SelectionMode = 'single' | 'multiple';

export interface ComponentConfig {
    targetEntityName: string;
    parentLookupField: string | null;
    displayField: string;
    idField: string;
    additionalSelectFields: string[];
    targetViewId: string | null;
    orderBy: string;
    selectionMode: SelectionMode;
    relationshipSchemaName: string | null;
    sourceEntityName: string | null;
}

export interface UIResources {
    placeholderNoSelection: string;
    emptyStateNoRecords: string;
    emptyStateNoSearchResults: string;
    searchPlaceholder: string;
    clearButtonAriaLabel: string;
    orphanRecordTooltip: string;
}

export interface TreeSelectorProps {
    context: ComponentFramework.Context<IInputs>;
    onSelectionChange: (value: ComponentFramework.LookupValue[] | undefined) => void;
}

export interface RecordReference {
    entityType: string;
    id: string;
}
