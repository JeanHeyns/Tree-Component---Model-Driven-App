import { IInputs, IOutputs } from './generated/ManifestTypes';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { TreeSelector } from './components/TreeSelector';

export class TreeLookup implements ComponentFramework.StandardControl<IInputs, IOutputs> {
    private notifyOutputChanged!: () => void;
    private container!: HTMLDivElement;
    private currentOutput: IOutputs = {};

    // Stable callback reference — created once so React memoisation is not defeated
    private readonly handleSelectionChange = (
        value: ComponentFramework.LookupValue[] | undefined
    ): void => {
        this.currentOutput = { selectedValue: value };
        this.notifyOutputChanged();
    };

    public init(
        context: ComponentFramework.Context<IInputs>,
        notifyOutputChanged: () => void,
        state: ComponentFramework.Dictionary,
        container: HTMLDivElement
    ): void {
        this.notifyOutputChanged = notifyOutputChanged;
        this.container = container;
        context.mode.trackContainerResize(true);
    }

    public updateView(
        context: ComponentFramework.Context<IInputs>
    ): void {
        ReactDOM.render(React.createElement(TreeSelector, {
            context,
            onSelectionChange: this.handleSelectionChange,
        }), this.container);
    }

    public getOutputs(): IOutputs {
        return this.currentOutput;
    }

    public destroy(): void {
        ReactDOM.unmountComponentAtNode(this.container);
    }
}
