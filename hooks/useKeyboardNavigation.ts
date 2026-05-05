import { useState, useCallback, useEffect } from 'react';
import * as React from 'react';
import { TreeNodeData } from '../types';

export interface KeyboardNavResult {
    focusedId: string | null;
    setFocusedIndex: React.Dispatch<React.SetStateAction<number>>;
    handleKeyDown: (e: React.KeyboardEvent) => void;
}

export function useKeyboardNavigation(
    flatNodes: TreeNodeData[],
    expandedIds: Set<string>,
    onSelect: (node: TreeNodeData) => void,
    onExpand: (id: string) => void,
    onCollapse: (id: string) => void,
    onClose: () => void
): KeyboardNavResult {
    const [focusedIndex, setFocusedIndex] = useState(-1);

    const focusedId =
        focusedIndex >= 0 && focusedIndex < flatNodes.length
            ? flatNodes[focusedIndex].id
            : null;

    // Clamp focused index when the flat list shrinks (e.g. node collapsed)
    useEffect(() => {
        if (flatNodes.length === 0) {
            setFocusedIndex(-1);
            return;
        }
        setFocusedIndex(prev => {
            if (prev >= flatNodes.length) return flatNodes.length - 1;
            return prev;
        });
    }, [flatNodes.length]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            const total = flatNodes.length;
            if (total === 0 && e.key !== 'Escape') return;

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    setFocusedIndex(i => Math.min(total - 1, Math.max(0, i + 1)));
                    break;

                case 'ArrowUp':
                    e.preventDefault();
                    setFocusedIndex(i => Math.max(0, i <= 0 ? 0 : i - 1));
                    break;

                case 'ArrowRight': {
                    e.preventDefault();
                    if (focusedIndex < 0 || focusedIndex >= total) break;
                    const node = flatNodes[focusedIndex];
                    if (node.children.length > 0 && !expandedIds.has(node.id)) {
                        onExpand(node.id);
                    } else if (node.children.length > 0 && expandedIds.has(node.id)) {
                        // Move focus to first visible child
                        setFocusedIndex(i => Math.min(total - 1, i + 1));
                    }
                    break;
                }

                case 'ArrowLeft': {
                    e.preventDefault();
                    if (focusedIndex < 0 || focusedIndex >= total) break;
                    const node = flatNodes[focusedIndex];
                    if (node.children.length > 0 && expandedIds.has(node.id)) {
                        onCollapse(node.id);
                    } else if (node.parentId) {
                        const parentIdx = flatNodes.findIndex(n => n.id === node.parentId);
                        if (parentIdx >= 0) setFocusedIndex(parentIdx);
                    }
                    break;
                }

                case 'Enter':
                    e.preventDefault();
                    if (focusedIndex >= 0 && focusedIndex < total) {
                        onSelect(flatNodes[focusedIndex]);
                    }
                    break;

                case 'Escape':
                    e.preventDefault();
                    onClose();
                    break;
            }
        },
        [flatNodes, focusedIndex, expandedIds, onSelect, onExpand, onCollapse, onClose]
    );

    return { focusedId, setFocusedIndex, handleKeyDown };
}
