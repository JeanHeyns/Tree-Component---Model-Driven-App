# TreeLookup PCF Control

A generic, fully-configurable PCF (PowerApps Component Framework) control for
Dynamics 365 / Model-Driven Apps. Renders a Fluent UI v8 combobox that opens a
searchable tree view so users can select one record from any self-referencing
hierarchical table.

---

## Prerequisites

| Tool | Minimum version |
|------|----------------|
| Node.js | 18 LTS |
| npm | 9+ |
| Power Platform CLI (`pac`) | 1.29+ |
| Dynamics 365 environment | Any with custom entities |

---

## Build & deploy

### 1 — Initial scaffold (run once in the parent folder)

```bash
pac pcf init \
  --namespace Exerti \
  --name TreeLookup \
  --template field \
  --framework React \
  --outputDirectory TreeSelectControlModelDriven
```

Then replace the generated source files with the ones in this repo (the scaffold
overwrites `package.json` and `tsconfig.json`; the source files in this repo are
the authoritative versions).

### 2 — Install dependencies

```bash
npm install
```

### 3 — Generate manifest types

```bash
npm run refreshTypes
```

This regenerates `generated/ManifestTypes.d.ts` from the manifest. The file
included in the repo is a stub that enables TypeScript compilation before the
first build; replace it with the generated version.

### 4 — Local dev server

```bash
npm start
```

Opens the PCF test harness at `http://localhost:8181`. You can mock the Web API
responses via the harness.

### 5 — Production build

```bash
npm run build
```

Output goes to `out/controls/TreeLookup/`.

### 6 — Push to environment

```bash
pac pcf push --publisher-prefix exerti
```

Or create a managed solution:

```bash
pac solution init --publisher-name Exerti --publisher-prefix exerti
pac solution add-reference --path .
msbuild /t:build /restore
```

---

## Configuration reference

Configure the control in the form editor → **Properties** panel.

### Required properties

| Property | Description | Example |
|---|---|---|
| `targetEntityName` | Logical name of the hierarchical table | `new_category` |
| `displayField` | Field shown as the node label | `new_name` |

> **OData note**: when `parentLookupField` is filled, the control automatically
> derives the OData lookup value field (`_new_parentcategoryid_value`). Provide
> only the "normal" logical name - do **not** include the underscore prefix or
> `_value` suffix. Leave `parentLookupField` empty to render a flat searchable
> list.

### Optional properties

| Property | Default | Description |
|---|---|---|
| `parentLookupField` | _(empty)_ | Logical name of the self-referencing lookup. Leave empty for a flat searchable list |
| `idField` | `<entityName>id` | Primary key field name |
| `additionalSelectFields` | _(empty)_ | Comma-separated extra fields to retrieve |
| `targetViewId` | _(empty)_ | System or personal view GUID used to filter the target records |
| `orderBy` | `<displayField> asc` | OData `$orderby` expression |
| `selectionMode` | `single` | Use `single` for lookup storage or `multiple` for N:N relationship storage |
| `relationshipSchemaName` | _(empty)_ | Required when `selectionMode` is `multiple`; N:N relationship schema/navigation name |
| `sourceEntityName` | Current form table | Optional current form table logical name override |
| `placeholderText` | Resource string | Trigger placeholder when nothing is selected |
| `searchPlaceholderText` | Resource string | Search box placeholder |

---

## Use-case examples

### Example 1 — Organisation hierarchy

| Property | Value |
|---|---|
| `targetEntityName` | `businessunit` |
| `parentLookupField` | `parentbusinessunitid` |
| `displayField` | `name` |
| `idField` | `businessunitid` |

### Example 2 — Product categories

| Property | Value |
|---|---|
| `targetEntityName` | `new_productcategory` |
| `parentLookupField` | `new_parentcategoryid` |
| `displayField` | `new_name` |
| `orderBy` | `new_name asc` |

### Example 3 — Geographic regions

| Property | Value |
|---|---|
| `targetEntityName` | `new_region` |
| `parentLookupField` | `new_parentregionid` |
| `displayField` | `new_fullname` |
| `additionalSelectFields` | `new_code,new_level` |
| `idField` | `new_regionid` |

### Example 4 - Program multiselect through N:N

| Property | Value |
|---|---|
| `targetEntityName` | `msdyn_projectprogram` |
| `parentLookupField` | _(empty)_ |
| `displayField` | `msdyn_name` |
| `idField` | `msdyn_projectprogramid` |
| `orderBy` | `msdyn_name asc` |
| `selectionMode` | `multiple` |
| `relationshipSchemaName` | `<your N:N relationship schema name>` |
| `sourceEntityName` | `<current form table logical name>` |

In multiple mode the control writes associations directly to Dataverse. The
current form record must be saved before selections can be added or removed.

### Example 5 - Filter by Dataverse view

| Property | Value |
|---|---|
| `targetEntityName` | `exp_lookup` |
| `parentLookupField` | _(empty or hierarchy lookup field)_ |
| `displayField` | `exp_name` |
| `idField` | `exp_lookupid` |
| `targetViewId` | `<GUID of the Admin Lines or Cost Center view>` |

When `targetViewId` is filled, the control reads the view FetchXML from
Dataverse and uses its filters. This works for system views (`savedquery`) and
personal views (`userquery`) that the current user can read.

---

## Localisation

Add a `strings/TreeLookup.<LCID>.resx` file for each language (e.g.
`TreeLookup.1043.resx` for Dutch). The control resolves strings at runtime from
the culture-matching resource file. Makers can also override the two placeholder
strings via the manifest properties, which take precedence over resource strings.

String keys used in code:

| Key | Purpose |
|---|---|
| `Placeholder_NoSelection` | Trigger placeholder |
| `EmptyState_NoRecords` | Tree is empty |
| `EmptyState_NoSearchResults` | Search returned nothing |
| `Search_Placeholder` | Search box placeholder |
| `ClearButton_AriaLabel` | Clear (×) button ARIA label |
| `OrphanRecord_Tooltip` | Tooltip on orphan nodes |

---

## Architecture

```
index.ts                     PCF entry - StandardControl class with React rendering
types.ts                     Shared interfaces
generated/ManifestTypes.d.ts Auto-generated from manifest (do not edit)

services/
  configValidator.ts         Validates required properties; parses config
  dataService.ts             Web API fetch, tree build, filter, flatten

hooks/
  useTreeData.ts             Fetches records, memoises tree
  useKeyboardNavigation.ts   Arrow key / Enter / Escape handling

components/
  TreeSelector.tsx           Root component — trigger + Callout orchestration
  TreeNode.tsx               Recursive, React.memo-wrapped node renderer
  ErrorState.tsx             Configuration / API error display

strings/
  TreeLookup.1033.resx       English resource strings
```

### Data flow

1. `index.ts` creates a stable `handleSelectionChange` callback on the class
   instance and passes it with `context` to `TreeSelector`.
2. `TreeSelector` reads config from `context.parameters`, validates it, and
   passes a `ComponentConfig` to `useTreeData`.
3. `useTreeData` calls `fetchRecords` (Web API), builds the tree with
   `buildTree`, and returns a memoised `TreeNodeData[]`.
4. User interaction updates local state (`expandedIds`, `searchTerm`) and calls
   `handleSelectionChange` → `getOutputs()` → framework writes the lookup field.

### Tree construction

Records are fetched in one call with `$select` (only needed fields) and
`$orderby`, unless `targetViewId` is configured. In that case the control reads
the Dataverse view FetchXML and adds the fields needed for rendering before
retrieving records. When `parentLookupField` is configured, the control derives the
OData lookup value column by prefixing and suffixing the field name:
`_<field>_value`. Circular references are detected via iterative DFS and broken
by promoting the offending node to root level. Orphan records (parent GUID not
found in the result set) are also promoted to root and marked visually with a
warning icon. When `parentLookupField` is empty, every record is rendered as a
root node.

---

## Troubleshooting

### Tree is empty but records exist in Dataverse

- Check the logged-in user has **Read** access on the table and on the
  `displayField` column. If hierarchy is configured, also check the
  `parentLookupField` column.
- Open the browser console: `[TreeLookup]` prefixed warnings explain orphan
  and circular-reference decisions.
- Confirm `targetEntityName` is the **logical** name (lowercase, with
  publisher prefix), not the display name.

### OData error: "Could not find a property named '_x_value'"

The `parentLookupField` value is incorrect. Verify in **Maker Portal →
Tables → Columns** that the field exists and is a Lookup type. The control
adds the `_` prefix and `_value` suffix automatically — do not include them
in the property value.

### Tree shows records but hierarchy is flat (all at root)

- If `parentLookupField` is empty, this is expected: the control is configured
  as a flat searchable list.
- Verify `parentLookupField` is the correct self-referencing column (not the
  display name column).
- Check that parent GUIDs are actually populated in Dataverse - if all parent
  values are null the tree is correctly flat.

### Control shows "Configuration missing: …"

One or more required properties (`targetEntityName`, `displayField`) are empty
in the form editor. Open **Properties -> Advanced** and fill in both.

### Performance on large datasets (> 5 000 records)

The Web API returns a maximum of 5 000 records per call. For larger datasets
add a `$filter` via `additionalSelectFields` (currently not supported as a
dedicated property) or implement server-side paging in `dataService.ts`. The
client-side tree build and `React.memo` on `TreeNode` keep rendering fast for
up to a few thousand nodes.
