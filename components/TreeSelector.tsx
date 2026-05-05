import * as React from 'react';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { Callout, DirectionalHint } from '@fluentui/react/lib/Callout';
import { SearchBox } from '@fluentui/react/lib/SearchBox';
import { Icon } from '@fluentui/react/lib/Icon';
import { Spinner, SpinnerSize } from '@fluentui/react/lib/Spinner';
import { mergeStyleSets } from '@fluentui/react/lib/Styling';
import { useTheme } from '@fluentui/react/lib/Theme';
import { IInputs } from '../generated/ManifestTypes';
import { TreeSelectorProps, TreeNodeData, UIResources, ComponentConfig, RecordReference } from '../types';
import { validateConfig, parseConfig } from '../services/configValidator';
import {
    associateRecord,
    disassociateRecord,
    fetchRelatedRecords,
    filterTree,
    flattenVisible,
} from '../services/dataService';
import { useTreeData } from '../hooks/useTreeData';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';
import { TreeNode } from './TreeNode';
import { ErrorState } from './ErrorState';

function safeString(resources: ComponentFramework.Resources, key: string, fallback: string): string {
    try {
        return resources.getString(key) || fallback;
    } catch {
        return fallback;
    }
}

function resolveResources(
    context: ComponentFramework.Context<IInputs>
): UIResources {
    const res = context.resources;
    return {
        placeholderNoSelection:
            context.parameters.placeholderText?.raw ||
            safeString(res, 'Placeholder_NoSelection', 'Select a value...'),
        emptyStateNoRecords: safeString(res, 'EmptyState_NoRecords', 'No records available'),
        emptyStateNoSearchResults: safeString(res, 'EmptyState_NoSearchResults', 'No results found'),
        searchPlaceholder:
            context.parameters.searchPlaceholderText?.raw ||
            safeString(res, 'Search_Placeholder', 'Search...'),
        clearButtonAriaLabel: safeString(res, 'ClearButton_AriaLabel', 'Clear selection'),
        orphanRecordTooltip: safeString(res, 'OrphanRecord_Tooltip', 'Parent record not found'),
    };
}

function normalizeGuid(id: string | null | undefined): string | null {
    const normalized = (id ?? '').replace(/[{}]/g, '').trim().toLowerCase();
    return normalized || null;
}

function getSourceRecord(
    context: ComponentFramework.Context<IInputs>,
    config: ComponentConfig | null
): RecordReference | null {
    const rawContext = context as unknown as {
        page?: { entityId?: string; entityTypeName?: string; entityName?: string };
        mode?: { contextInfo?: { entityId?: string; entityTypeName?: string; entityName?: string } };
    };
    const id = normalizeGuid(
        rawContext.page?.entityId ??
            rawContext.mode?.contextInfo?.entityId
    );
    const entityType =
        config?.sourceEntityName ??
        rawContext.page?.entityTypeName ??
        rawContext.page?.entityName ??
        rawContext.mode?.contextInfo?.entityTypeName ??
        rawContext.mode?.contextInfo?.entityName ??
        null;

    return id && entityType ? { id, entityType } : null;
}

export const TreeSelector: React.FC<TreeSelectorProps> = ({ context, onSelectionChange }) => {
    const theme = useTheme();
    const triggerRef = React.useRef<HTMLDivElement>(null);

    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [relatedSelectedIds, setRelatedSelectedIds] = useState<Set<string>>(new Set());
    const [relationshipLoading, setRelationshipLoading] = useState(false);
    const [relationshipError, setRelationshipError] = useState<string | null>(null);
    const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
    const [triggerWidth, setTriggerWidth] = useState(0);

    const isDisabled = context.mode.isControlDisabled;

    // Resources are stable after init; re-resolve only when override props change
    const resources = useMemo(
        () => resolveResources(context),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [context.parameters.placeholderText?.raw, context.parameters.searchPlaceholderText?.raw]
    );

    // Config validation — re-runs only when the three required fields change
    const validation = useMemo(
        () => validateConfig(context.parameters),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [
            context.parameters.targetEntityName?.raw,
            context.parameters.parentLookupField?.raw,
            context.parameters.displayField?.raw,
            context.parameters.targetViewId?.raw,
        ]
    );

    const config = useMemo<ComponentConfig | null>(() => {
        if (!validation.isValid) return null;
        return parseConfig(context.parameters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        validation.isValid,
        context.parameters.targetEntityName?.raw,
        context.parameters.parentLookupField?.raw,
        context.parameters.displayField?.raw,
        context.parameters.idField?.raw,
        context.parameters.additionalSelectFields?.raw,
        context.parameters.targetViewId?.raw,
        context.parameters.orderBy?.raw,
        context.parameters.selectionMode?.raw,
        context.parameters.relationshipSchemaName?.raw,
        context.parameters.sourceEntityName?.raw,
    ]);

    const sourceRecord = useMemo(
        () => getSourceRecord(context, config),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [config, (context as unknown as { page?: { entityId?: string } }).page?.entityId]
    );
    const isMultiple = config?.selectionMode === 'multiple';

    // Current selection comes directly from context (source of truth)
    const currentLookup = context.parameters.selectedValue?.raw;
    const selectedId: string | null = currentLookup?.[0]?.id ?? null;
    const selectedDisplayName: string | null = currentLookup?.[0]?.name ?? null;

    // Data layer
    const { tree, loading, error: dataError } = useTreeData(context.webAPI, config);

    useEffect(() => {
        if (!isOpen) return;
        const width = triggerRef.current?.getBoundingClientRect().width ?? 0;
        if (width > 0) setTriggerWidth(width);
    }, [isOpen, context.mode.allocatedWidth]);

    useEffect(() => {
        if (!isMultiple || !config?.relationshipSchemaName) {
            setRelatedSelectedIds(new Set());
            setRelationshipError(null);
            setRelationshipLoading(false);
            return;
        }

        if (!sourceRecord) {
            setRelatedSelectedIds(new Set());
            setRelationshipError('Save this record before selecting multiple values.');
            setRelationshipLoading(false);
            return;
        }

        let cancelled = false;
        setRelationshipLoading(true);
        setRelationshipError(null);

        fetchRelatedRecords(context.webAPI, sourceRecord, config)
            .then(records => {
                if (cancelled) return;
                setRelatedSelectedIds(new Set(
                    records
                        .map(record => normalizeGuid(String(record[config.idField] ?? '')))
                        .filter((id): id is string => Boolean(id))
                ));
                setRelationshipLoading(false);
            })
            .catch((err: Error) => {
                if (cancelled) return;
                setRelationshipError(err.message ?? 'Failed to load related records');
                setRelationshipLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [context.webAPI, config, isMultiple, sourceRecord]);

    // Search filter
    const { visibleIds, autoExpandIds } = useMemo(() => {
        const trimmed = searchTerm.trim();
        if (!trimmed) return { visibleIds: null, autoExpandIds: new Set<string>() };
        return filterTree(tree, trimmed);
    }, [tree, searchTerm]);

    // Effective expanded: union of manual + auto-expanded from search
    const effectiveExpandedIds = useMemo(() => {
        if (!searchTerm.trim()) return expandedIds;
        const combined = new Set(expandedIds);
        autoExpandIds.forEach(id => combined.add(id));
        return combined;
    }, [expandedIds, autoExpandIds, searchTerm]);

    // Flat node list for keyboard navigation
    const flatNodes = useMemo(
        () => flattenVisible(tree, effectiveExpandedIds, visibleIds),
        [tree, effectiveExpandedIds, visibleIds]
    );

    const nodeNameById = useMemo(() => {
        const names = new Map<string, string>();
        const visit = (node: TreeNodeData) => {
            const id = normalizeGuid(node.id);
            if (id) names.set(id, node.displayName);
            node.children.forEach(visit);
        };
        tree.forEach(visit);
        return names;
    }, [tree]);

    // Handlers (stable references)
    const handleSelect = useCallback(
        async (node: TreeNodeData) => {
            if (isMultiple) {
                if (!config?.relationshipSchemaName || !sourceRecord) {
                    setRelationshipError('Save this record before selecting multiple values.');
                    return;
                }

                const targetId = normalizeGuid(node.id) ?? node.id;
                const target: RecordReference = {
                    entityType: config.targetEntityName,
                    id: targetId,
                };
                const isSelected = relatedSelectedIds.has(targetId);

                // Optimistic update — UI responds immediately
                if (isSelected) {
                    setRelatedSelectedIds(prev => {
                        const next = new Set(prev);
                        next.delete(targetId);
                        return next;
                    });
                } else {
                    setRelatedSelectedIds(prev => new Set([...prev, targetId]));
                }

                setSavingIds(prev => new Set([...prev, targetId]));
                setRelationshipError(null);

                try {
                    if (isSelected) {
                        await disassociateRecord(sourceRecord, target, config.relationshipSchemaName);
                    } else {
                        await associateRecord(sourceRecord, target, config.relationshipSchemaName);
                    }
                } catch (err) {
                    // Rollback optimistic update
                    if (isSelected) {
                        setRelatedSelectedIds(prev => new Set([...prev, targetId]));
                    } else {
                        setRelatedSelectedIds(prev => {
                            const next = new Set(prev);
                            next.delete(targetId);
                            return next;
                        });
                    }
                    setRelationshipError((err as Error).message ?? 'Failed to update relationship');
                } finally {
                    setSavingIds(prev => {
                        const next = new Set(prev);
                        next.delete(targetId);
                        return next;
                    });
                }
                return;
            }

            setIsOpen(false);
            setSearchTerm('');
            onSelectionChange([
                {
                    id: node.id,
                    name: node.displayName,
                    entityType: config?.targetEntityName ?? '',
                },
            ]);
        },
        [config, isMultiple, onSelectionChange, relatedSelectedIds, sourceRecord]
    );

    const handleExpand = useCallback((id: string) => {
        setExpandedIds(prev => new Set([...prev, id]));
    }, []);

    const handleCollapse = useCallback((id: string) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
    }, []);

    const handleToggle = useCallback((id: string) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const handleClose = useCallback(() => {
        setIsOpen(false);
        setSearchTerm('');
    }, []);

    const handleClear = useCallback(
        async (e: React.MouseEvent) => {
            e.stopPropagation();
            if (isMultiple) {
                if (!config?.relationshipSchemaName || !sourceRecord) return;
                const ids = Array.from(relatedSelectedIds);
                setSavingIds(new Set(ids));
                setRelationshipError(null);

                // Optimistic clear
                setRelatedSelectedIds(new Set());

                try {
                    await Promise.all(ids.map(id =>
                        disassociateRecord(
                            sourceRecord,
                            { entityType: config.targetEntityName, id },
                            config.relationshipSchemaName!
                        )
                    ));
                } catch (err) {
                    // Rollback optimistic clear
                    setRelatedSelectedIds(new Set(ids));
                    setRelationshipError((err as Error).message ?? 'Failed to clear relationships');
                } finally {
                    setSavingIds(new Set());
                }
                return;
            }
            onSelectionChange(undefined);
        },
        [config, isMultiple, onSelectionChange, relatedSelectedIds, sourceRecord]
    );

    const handleTriggerClick = useCallback(() => {
        if (!isDisabled) setIsOpen(prev => !prev);
    }, [isDisabled]);

    const handleTriggerKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLDivElement>) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleTriggerClick();
            }
        },
        [handleTriggerClick]
    );

    // Keyboard navigation inside the callout
    const { focusedId, handleKeyDown } = useKeyboardNavigation(
        flatNodes,
        effectiveExpandedIds,
        handleSelect,
        handleExpand,
        handleCollapse,
        handleClose
    );

    // Derived render flags
    const showEmptyTree = !loading && tree.length === 0 && !dataError;
    const selectedCount = relatedSelectedIds.size;
    const selectedNames = useMemo(
        () => Array.from(relatedSelectedIds)
            .map(id => nodeNameById.get(id))
            .filter((name): name is string => Boolean(name)),
        [nodeNameById, relatedSelectedIds]
    );
    const triggerLabel = isMultiple
        ? selectedNames.length > 0
            ? selectedNames.join(', ')
            : selectedCount > 0
            ? `${selectedCount} selected`
            : resources.placeholderNoSelection
        : selectedDisplayName ?? resources.placeholderNoSelection;
    const showNoResults =
        !loading &&
        searchTerm.trim().length > 0 &&
        visibleIds !== null &&
        visibleIds.size === 0;

    // Callout width matches trigger width, with a sensible minimum
    const calloutWidth = Math.max(triggerWidth || triggerRef.current?.offsetWidth || 0, 280);
    const hasSelection = isMultiple ? selectedCount > 0 : Boolean(selectedDisplayName);

    // Styles
    const styles = mergeStyleSets({
        trigger: {
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            boxSizing: 'border-box' as const,
            cursor: isDisabled ? 'default' : 'pointer',
            padding: '0 0 0 12px',
            fontFamily: "'Segoe UI', sans-serif",
            fontSize: '14px',
            fontWeight: 400,
            lineHeight: '20px',
            textAlign: 'left' as const,
            color: 'var(--colorNeutralForeground4)',
            backgroundColor: '#f3f3f3',
            border: 'none',
            borderRadius: 4,
            minHeight: 30,
            height: 30,
            selectors: {
                ':hover': {
                    backgroundColor: '#f3f3f3',
                },
                ':focus-visible': {
                    outline: `1px solid ${theme.palette.neutralPrimary}`,
                    outlineOffset: -1,
                },
            },
        },
        triggerLabel: {
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: '14px',
            lineHeight: '20px',
            color: hasSelection ? 'var(--colorNeutralForeground1)' : 'var(--colorNeutralForeground4)',
        },
        chevronIcon: {
            flexShrink: 0,
            justifySelf: 'end',
            width: 32,
            textAlign: 'center' as const,
            fontSize: 12,
            color: theme.palette.neutralSecondary,
            transition: 'transform 0.15s ease',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
        },
        calloutInner: {
            display: 'flex',
            flexDirection: 'column' as const,
            maxHeight: 380,
        },
        searchWrapper: {
            padding: '6px 8px 4px',
            borderBottom: `1px solid ${theme.palette.neutralLighter}`,
            flexShrink: 0,
        },
        treeContainer: {
            overflowY: 'auto' as const,
            flex: 1,
            padding: '4px 0',
        },
        emptyState: {
            padding: '12px 16px',
            color: theme.palette.neutralSecondary,
            fontSize: theme.fonts.small.fontSize as string,
            textAlign: 'center' as const,
        },
    });

    // Guard: missing required config
    if (!validation.isValid) {
        return (
            <ErrorState
                message={`Configuration missing: ${validation.missingProperties.join(', ')}`}
            />
        );
    }

    // Guard: Web API error
    if (dataError) {
        return <ErrorState message={dataError} />;
    }

    if (relationshipError && isMultiple && !isOpen) {
        return <ErrorState message={relationshipError} />;
    }

    return (
        <div>
            {/* Trigger */}
            <div
                ref={triggerRef}
                className={styles.trigger}
                onClick={handleTriggerClick}
                onKeyDown={handleTriggerKeyDown}
                role="combobox"
                aria-expanded={isOpen}
                aria-haspopup="tree"
                tabIndex={isDisabled ? -1 : 0}
            >
                <span className={styles.triggerLabel}>
                    {triggerLabel}
                </span>

                <Icon iconName="ChevronDown" className={styles.chevronIcon} />
            </div>

            {/* Dropdown callout */}
            {isOpen && (
                <Callout
                    target={triggerRef}
                    onDismiss={handleClose}
                    directionalHint={DirectionalHint.bottomLeftEdge}
                    isBeakVisible={false}
                    calloutWidth={calloutWidth}
                    styles={{ calloutMain: { padding: 0 } }}
                    setInitialFocus={false}
                >
                    <div className={styles.calloutInner}>
                        {/* Search */}
                        <div className={styles.searchWrapper}>
                            <SearchBox
                                placeholder={resources.searchPlaceholder}
                                value={searchTerm}
                                onChange={(_, val) => setSearchTerm(val ?? '')}
                                onKeyDown={handleKeyDown}
                                // eslint-disable-next-line jsx-a11y/no-autofocus
                                autoFocus
                                disableAnimation
                                underlined
                                styles={{ root: { width: '100%' } }}
                            />
                        </div>

                        {/* Tree */}
                        <div
                            className={styles.treeContainer}
                            role="tree"
                            aria-label="Select value"
                            onKeyDown={handleKeyDown}
                            tabIndex={-1}
                        >
                            {loading && (
                                <Spinner
                                    size={SpinnerSize.small}
                                    labelPosition="right"
                                    styles={{ root: { padding: 8 } }}
                                />
                            )}

                            {relationshipLoading && (
                                <Spinner
                                    size={SpinnerSize.small}
                                    labelPosition="right"
                                    styles={{ root: { padding: 8 } }}
                                />
                            )}

                            {relationshipError && (
                                <div className={styles.emptyState}>
                                    {relationshipError}
                                </div>
                            )}

                            {showEmptyTree && (
                                <div className={styles.emptyState}>
                                    {resources.emptyStateNoRecords}
                                </div>
                            )}

                            {showNoResults && (
                                <div className={styles.emptyState}>
                                    {resources.emptyStateNoSearchResults}
                                </div>
                            )}

                            {!loading &&
                                !showEmptyTree &&
                                !showNoResults &&
                                tree.map(root => {
                                    if (visibleIds !== null && !visibleIds.has(root.id)) return null;
                                    return (
                                        <TreeNode
                                            key={root.id}
                                            node={root}
                                            level={0}
                                            selectedId={selectedId}
                                            selectedIds={relatedSelectedIds}
                                            selectionMode={config?.selectionMode ?? 'single'}
                                            focusedId={focusedId}
                                            expandedIds={effectiveExpandedIds}
                                            visibleIds={visibleIds}
                                            onSelect={handleSelect}
                                            onToggle={handleToggle}
                                            orphanTooltip={resources.orphanRecordTooltip}
                                            isDisabled={isDisabled || savingIds.size > 0 || relationshipLoading}
                                        />
                                    );
                                })}
                        </div>
                    </div>
                </Callout>
            )}
        </div>
    );
};
