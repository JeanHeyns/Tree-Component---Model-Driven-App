/*
*This is auto generated from the ControlManifest.Input.xml file
*/

// Define IInputs and IOutputs Type. They should match with ControlManifest.
export interface IInputs {
    selectedValue: ComponentFramework.PropertyTypes.LookupProperty;
    targetEntityName: ComponentFramework.PropertyTypes.StringProperty;
    parentLookupField: ComponentFramework.PropertyTypes.StringProperty;
    displayField: ComponentFramework.PropertyTypes.StringProperty;
    idField: ComponentFramework.PropertyTypes.StringProperty;
    additionalSelectFields: ComponentFramework.PropertyTypes.StringProperty;
    targetViewId: ComponentFramework.PropertyTypes.StringProperty;
    orderBy: ComponentFramework.PropertyTypes.StringProperty;
    selectionMode: ComponentFramework.PropertyTypes.StringProperty;
    relationshipSchemaName: ComponentFramework.PropertyTypes.StringProperty;
    sourceEntityName: ComponentFramework.PropertyTypes.StringProperty;
    placeholderText: ComponentFramework.PropertyTypes.StringProperty;
    searchPlaceholderText: ComponentFramework.PropertyTypes.StringProperty;
}
export interface IOutputs {
    selectedValue?: ComponentFramework.LookupValue[];
}
