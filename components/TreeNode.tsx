import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import { Checkbox } from '@fluentui/react/lib/Checkbox';
import { TooltipHost } from '@fluentui/react/lib/Tooltip';
import { mergeStyleSets } from '@fluentui/react/lib/Styling';
import { useTheme } from '@fluentui/react/lib/Theme';
import { TreeNodeData } from '../types';

interface TreeNodeProps {
    node: TreeNodeData;
    level: number;
    selectedId?: string | null;
    selectedIds?: Set<string>;
    selectionMode: 'single' | 'multiple';
    focusedId: string | null;
    expandedIds: Set<string>;
    visibleIds: Set<string> | null;
    onSelect: (node: TreeNodeData) => void;
    onToggle: (id: string) => void;
    orphanTooltip: string;
    isDisabled: boolean;
}

const TreeNodeInner: React.FC<TreeNodeProps> = ({
    node,
    level,
    selectedId,
    selectedIds,
    selectionMode,
    focusedId,
    expandedIds,
    visibleIds,
    onSelect,
    onToggle,
    orphanTooltip,
    isDisabled,
}) => {
    const theme = useTheme();
    const isExpanded = expandedIds.has(node.id);
    const isSelected = selectionMode === 'multiple'
        ? selectedIds?.has(node.id) ?? false
        : selectedId === node.id;
    const isFocused = focusedId === node.id;
    const hasChildren = node.children.length > 0;

    const styles = mergeStyleSets({
        row: {
            display: 'flex',
            alignItems: 'center',
            paddingLeft: `${level * 16 + 4}px`,
            paddingRight: 8,
            paddingTop: 4,
            paddingBottom: 4,
            minHeight: 28,
            cursor: isDisabled ? 'default' : 'pointer',
            userSelect: 'none',
            backgroundColor: isSelected
                ? theme.palette.themeLighterAlt
                : isFocused
                ? theme.palette.neutralLighter
                : 'transparent',
            outline: isFocused ? `1px solid ${theme.palette.themePrimary}` : 'none',
            outlineOffset: -1,
            selectors: {
                ':hover': {
                    backgroundColor: isDisabled
                        ? 'transparent'
                        : isSelected
                        ? theme.palette.themeLighterAlt
                        : theme.palette.neutralLighter,
                },
            },
        },
        chevron: {
            width: 16,
            height: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontSize: 10,
            color: theme.palette.neutralSecondary,
            selectors: {
                ':hover': { color: isDisabled ? undefined : theme.palette.neutralPrimary },
            },
        },
        label: {
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: theme.fonts.small.fontSize as string,
            color: theme.palette.neutralPrimary,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
        },
        orphanIcon: {
            color: theme.semanticColors.warningIcon,
            flexShrink: 0,
            fontSize: 12,
        },
        checkIcon: {
            marginLeft: 'auto',
            flexShrink: 0,
            fontSize: 10,
            color: theme.palette.themePrimary,
        },
        checkbox: {
            marginRight: 4,
            flexShrink: 0,
        },
    });

    const handleRowClick = () => {
        if (!isDisabled) onSelect(node);
    };

    const handleChevronClick = (e: React.MouseEvent) => {
        if (!isDisabled) {
            e.stopPropagation();
            onToggle(node.id);
        }
    };

    return (
        <div>
            <div
                className={styles.row}
                onClick={handleRowClick}
                role="treeitem"
                aria-expanded={hasChildren ? isExpanded : undefined}
                aria-selected={isSelected}
                data-node-id={node.id}
            >
                <span className={styles.chevron} onClick={handleChevronClick}>
                    {hasChildren && (
                        <Icon iconName={isExpanded ? 'ChevronDown' : 'ChevronRight'} />
                    )}
                </span>

                {selectionMode === 'multiple' && (
                    <span onClick={e => e.stopPropagation()}>
                    <Checkbox
                        checked={isSelected}
                        className={styles.checkbox}
                        disabled={isDisabled}
                        onChange={handleRowClick}
                    />
                    </span>
                )}

                <span className={styles.label}>
                    {node.isOrphan && (
                        <TooltipHost content={orphanTooltip}>
                            <Icon iconName="Warning" className={styles.orphanIcon} />
                        </TooltipHost>
                    )}
                    {node.displayName}
                </span>

                {selectionMode === 'single' && isSelected && (
                    <Icon iconName="CheckMark" className={styles.checkIcon} />
                )}
            </div>

            {isExpanded && hasChildren && (
                <div role="group">
                    {node.children.map(child => {
                        if (visibleIds !== null && !visibleIds.has(child.id)) return null;
                        return (
                            <TreeNode
                                key={child.id}
                                node={child}
                                level={level + 1}
                                selectedId={selectedId}
                                selectedIds={selectedIds}
                                selectionMode={selectionMode}
                                focusedId={focusedId}
                                expandedIds={expandedIds}
                                visibleIds={visibleIds}
                                onSelect={onSelect}
                                onToggle={onToggle}
                                orphanTooltip={orphanTooltip}
                                isDisabled={isDisabled}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
};

TreeNodeInner.displayName = 'TreeNode';

export const TreeNode = React.memo(TreeNodeInner);
