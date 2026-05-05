import { RawRecord, TreeNodeData, ComponentConfig, RecordReference } from '../types';

interface XrmWebApiRequest {
    getMetadata: () => {
        boundParameter: null;
        parameterTypes: Record<string, never>;
        operationType: 2;
        operationName: 'Associate' | 'Disassociate';
    };
}

interface AssociateRequest extends XrmWebApiRequest {
    target: RecordReference;
    relatedEntities: RecordReference[];
    relationship: string;
}

interface DisassociateRequest extends XrmWebApiRequest {
    target: RecordReference;
    relatedEntityId: string;
    relationship: string;
}

interface XrmWebApiOnline {
    execute: (request: XrmWebApiRequest) => Promise<{ ok: boolean; status: number; statusText: string }>;
}

interface XrmWebApi {
    online?: {
        execute: (request: XrmWebApiRequest) => Promise<{ ok: boolean; status: number; statusText: string }>;
    };
}

interface ViewRecord {
    fetchxml?: string;
}

type XrmExecute = XrmWebApiOnline['execute'];

declare const Xrm: { WebApi?: XrmWebApi } | undefined;

function normalizeGuid(id: string): string {
    return id.replace(/[{}]/g, '').toLowerCase();
}

export async function fetchRecords(
    webAPI: ComponentFramework.WebApi,
    config: ComponentConfig
): Promise<RawRecord[]> {
    const parentODataField = config.parentLookupField
        ? `_${config.parentLookupField}_value`
        : null;

    const selectFields = Array.from(
        new Set([
            config.idField,
            config.displayField,
            ...(parentODataField ? [parentODataField] : []),
            ...config.additionalSelectFields,
        ])
    );

    if (config.targetViewId) {
        const viewFetchXml = await retrieveViewFetchXml(webAPI, config.targetViewId);
        const fetchXml = ensureFetchXmlAttributes(viewFetchXml, config.targetEntityName, selectFields);
        return retrieveAllRecords(webAPI, config.targetEntityName, `?fetchXml=${fetchXml}`);
    }

    const options = `?$select=${selectFields.join(',')}&$orderby=${config.orderBy}`;
    return retrieveAllRecords(webAPI, config.targetEntityName, options);
}

async function retrieveViewFetchXml(
    webAPI: ComponentFramework.WebApi,
    targetViewId: string
): Promise<string> {
    const viewId = normalizeGuid(targetViewId);

    try {
        const systemView = await webAPI.retrieveRecord('savedquery', viewId, '?$select=fetchxml') as ViewRecord;
        if (systemView.fetchxml) return systemView.fetchxml;
    } catch {
        // Try personal views below.
    }

    try {
        const personalView = await webAPI.retrieveRecord('userquery', viewId, '?$select=fetchxml') as ViewRecord;
        if (personalView.fetchxml) return personalView.fetchxml;
    } catch {
        // Throw a clearer message below.
    }

    throw new Error(`View ${targetViewId} was not found as a system or personal view, or it does not expose FetchXML.`);
}

function ensureFetchXmlAttributes(
    fetchXml: string,
    targetEntityName: string,
    requiredFields: readonly string[]
): string {
    const parser = new DOMParser();
    const xml = parser.parseFromString(fetchXml, 'text/xml');
    const parserError = xml.getElementsByTagName('parsererror')[0];
    if (parserError) {
        throw new Error('The configured view contains invalid FetchXML.');
    }

    const entity = Array.from(xml.getElementsByTagName('entity'))
        .find(node => node.getAttribute('name') === targetEntityName);
    if (!entity) {
        throw new Error(`The configured view does not target ${targetEntityName}.`);
    }

    const existingAttributes = new Set(
        Array.from(entity.getElementsByTagName('attribute'))
            .map(node => node.getAttribute('name'))
            .filter((name): name is string => Boolean(name))
    );

    for (const field of requiredFields) {
        if (existingAttributes.has(field)) continue;
        const attribute = xml.createElement('attribute');
        attribute.setAttribute('name', field);
        entity.appendChild(attribute);
    }

    return new XMLSerializer().serializeToString(xml);
}

async function retrieveAllRecords(
    webAPI: ComponentFramework.WebApi,
    entityType: string,
    initialOptions: string
): Promise<RawRecord[]> {
    const records: RawRecord[] = [];
    let options: string | undefined = initialOptions;

    do {
        const result: ComponentFramework.WebApi.RetrieveMultipleResponse =
            await webAPI.retrieveMultipleRecords(entityType, options);
        records.push(...(result.entities as unknown as RawRecord[]));
        options = result.nextLink ? result.nextLink.substring(result.nextLink.indexOf('?')) : undefined;
    } while (options);

    return records;
}

export function buildTree(records: RawRecord[], config: ComponentConfig): TreeNodeData[] {
    const parentODataField = config.parentLookupField
        ? `_${config.parentLookupField}_value`
        : null;
    const nodeMap = new Map<string, TreeNodeData>();

    for (const record of records) {
        const id = normalizeGuid(String(record[config.idField] ?? '').trim());
        if (!id) continue;

        const parentRaw = parentODataField ? record[parentODataField] : null;
        const parentId = parentRaw ? normalizeGuid(String(parentRaw).trim()) : null;

        nodeMap.set(id, {
            id,
            displayName: String(record[config.displayField] ?? ''),
            parentId,
            children: [],
            isOrphan: false,
            raw: record,
        });
    }

    // Detect and break circular references with iterative DFS
    const resolved = new Set<string>();
    const inStack = new Set<string>();

    function breakCycle(id: string): void {
        if (resolved.has(id) || !nodeMap.has(id)) return;
        if (inStack.has(id)) {
            const node = nodeMap.get(id)!;
            console.warn(`[TreeLookup] Circular reference at record ${id} - promoting to root`);
            node.parentId = null;
            return;
        }
        inStack.add(id);
        const node = nodeMap.get(id)!;
        if (node.parentId) breakCycle(node.parentId);
        inStack.delete(id);
        resolved.add(id);
    }

    for (const id of nodeMap.keys()) breakCycle(id);

    // Assemble tree
    const roots: TreeNodeData[] = [];

    for (const node of nodeMap.values()) {
        if (!node.parentId) {
            roots.push(node);
        } else {
            const parent = nodeMap.get(node.parentId);
            if (parent) {
                parent.children.push(node);
            } else {
                node.isOrphan = true;
                roots.push(node);
            }
        }
    }

    return roots;
}

export async function fetchRelatedRecords(
    webAPI: ComponentFramework.WebApi,
    source: RecordReference,
    config: ComponentConfig
): Promise<RawRecord[]> {
    if (!config.relationshipSchemaName) return [];

    const selectFields = Array.from(new Set([config.idField, config.displayField]));
    const options = `?$expand=${config.relationshipSchemaName}($select=${selectFields.join(',')})`;
    const result = await webAPI.retrieveRecord(source.entityType, source.id, options);
    const related = result[config.relationshipSchemaName] as RawRecord[] | undefined;
    return related ?? [];
}

function getOnlineExecute(): XrmExecute {
    const online = typeof Xrm !== 'undefined' ? Xrm.WebApi?.online : undefined;
    if (!online?.execute) {
        throw new Error('Xrm.WebApi.online.execute is not available. N:N multiselect requires an online model-driven app context.');
    }
    return online.execute.bind(online);
}

export async function associateRecord(
    source: RecordReference,
    target: RecordReference,
    relationshipSchemaName: string
): Promise<void> {
    const request: AssociateRequest = {
        target: { ...source, id: normalizeGuid(source.id) },
        relatedEntities: [{ ...target, id: normalizeGuid(target.id) }],
        relationship: relationshipSchemaName,
        getMetadata: () => ({
            boundParameter: null,
            parameterTypes: {},
            operationType: 2,
            operationName: 'Associate',
        }),
    };

    await getOnlineExecute()(request);
}

export async function disassociateRecord(
    source: RecordReference,
    target: RecordReference,
    relationshipSchemaName: string
): Promise<void> {
    const request: DisassociateRequest = {
        target: { ...source, id: normalizeGuid(source.id) },
        relatedEntityId: normalizeGuid(target.id),
        relationship: relationshipSchemaName,
        getMetadata: () => ({
            boundParameter: null,
            parameterTypes: {},
            operationType: 2,
            operationName: 'Disassociate',
        }),
    };

    await getOnlineExecute()(request);
}

export function filterTree(
    tree: TreeNodeData[],
    searchTerm: string
): { visibleIds: Set<string>; autoExpandIds: Set<string> } {
    const term = searchTerm.toLowerCase();
    const visibleIds = new Set<string>();
    const autoExpandIds = new Set<string>();

    function visit(node: TreeNodeData, ancestorIds: readonly string[]): boolean {
        const selfMatch = node.displayName.toLowerCase().includes(term);
        const childAncestors = [...ancestorIds, node.id];
        const anyChildMatch = node.children.some(child => visit(child, childAncestors));

        if (selfMatch || anyChildMatch) {
            visibleIds.add(node.id);
            for (const aid of ancestorIds) {
                visibleIds.add(aid);
                autoExpandIds.add(aid);
            }
            if (anyChildMatch) autoExpandIds.add(node.id);
        }
        return selfMatch || anyChildMatch;
    }

    for (const root of tree) visit(root, []);
    return { visibleIds, autoExpandIds };
}

export function flattenVisible(
    nodes: TreeNodeData[],
    expandedIds: Set<string>,
    visibleIds: Set<string> | null
): TreeNodeData[] {
    const result: TreeNodeData[] = [];

    function traverse(node: TreeNodeData): void {
        if (visibleIds !== null && !visibleIds.has(node.id)) return;
        result.push(node);
        if (expandedIds.has(node.id)) {
            for (const child of node.children) traverse(child);
        }
    }

    for (const root of nodes) traverse(root);
    return result;
}
