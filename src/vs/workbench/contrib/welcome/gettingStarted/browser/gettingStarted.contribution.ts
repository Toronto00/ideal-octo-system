/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { GettingStartedAction, GettingStartedInputFactory } from 'vs/workbench/contrib/welcome/gettingStarted/browser/gettingStarted';
import { Registry } from 'vs/platform/registry/common/platform';
import { Extensions as EditorInputExtensions, IEditorInputFactoryRegistry } from 'vs/workbench/common/editor';
import { IWorkbenchActionRegistry, Extensions } from 'vs/workbench/common/actions';
import { SyncActionDescriptor, MenuRegistry, MenuId } from 'vs/platform/actions/common/actions';

Registry.as<IWorkbenchActionRegistry>(Extensions.WorkbenchActions)
	.registerWorkbenchAction(
		SyncActionDescriptor.from(GettingStartedAction),
		'Help: Getting Started', localize('help', "Help"));

Registry.as<IEditorInputFactoryRegistry>(EditorInputExtensions.EditorInputFactories).registerEditorInputFactory(GettingStartedInputFactory.ID, GettingStartedInputFactory);

MenuRegistry.appendMenuItem(MenuId.MenubarHelpMenu, {
	group: '1_welcome',
	command: {
		id: 'workbench.action.showGettingStarted',
		title: localize({ key: 'miGettingStarted', comment: ['&& denotes a mnemonic'] }, "Getting Started")
	},
	order: 2
});
