import { useState, useEffect, useMemo } from 'react';
import { RawRecord, TreeNodeData, ComponentConfig } from '../types';
import { fetchRecords, buildTree } from '../services/dataService';

export interface TreeDataState {
    tree: TreeNodeData[];
    loading: boolean;
    error: string | null;
}

export function useTreeData(
    webAPI: ComponentFramework.WebApi,
    config: ComponentConfig | null
): TreeDataState {
    const [records, setRecords] = useState<RawRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Stable cache key — only refetch when config fields that affect the query change
    const configKey = config
        ? [
              config.targetEntityName,
              config.parentLookupField,
              config.displayField,
              config.idField,
              config.additionalSelectFields.join(','),
              config.targetViewId,
              config.orderBy,
          ].join('|')
        : null;

    useEffect(() => {
        if (!config || !configKey) {
            setRecords([]);
            return;
        }

        let cancelled = false;
        setLoading(true);
        setError(null);

        fetchRecords(webAPI, config)
            .then(data => {
                if (!cancelled) {
                    setRecords(data);
                    setLoading(false);
                }
            })
            .catch((err: Error) => {
                if (!cancelled) {
                    setError(err.message ?? 'Failed to load records');
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [configKey]);

    const tree = useMemo<TreeNodeData[]>(() => {
        if (!config || records.length === 0) return [];
        return buildTree(records, config);
    }, [records, config]);

    return { tree, loading, error };
}
