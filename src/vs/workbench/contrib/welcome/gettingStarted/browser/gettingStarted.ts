/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./gettingStarted';
import 'vs/workbench/contrib/welcome/gettingStarted/browser/vs_code_editor_getting_started';
import { localize } from 'vs/nls';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { Action } from 'vs/base/common/actions';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { URI } from 'vs/base/common/uri';
import { WalkThroughInput } from 'vs/workbench/contrib/welcome/walkThrough/browser/walkThroughInput';
import { Schemas } from 'vs/base/common/network';
import { IEditorInputFactory, EditorInput } from 'vs/workbench/common/editor';
import { Disposable } from 'vs/base/common/lifecycle';
import { IEditorOptions } from 'vs/platform/editor/common/editor';
import { assertIsDefined } from 'vs/base/common/types';
import { addDisposableListener } from 'vs/base/browser/dom';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { ConfigurationTarget } from 'vs/platform/configuration/common/configuration';
import { IProductService } from 'vs/platform/product/common/productService';

const typeId = 'workbench.editors.gettingStartedInput';
const telemetryFrom = 'gettingStartedPage';

export class GettingStartedAction extends Action {

	public static readonly ID = 'workbench.action.showGettingStarted';
	public static readonly LABEL = localize('editorGettingStarted', "Getting Started");

	constructor(
		id: string,
		label: string,
		@IInstantiationService private readonly instantiationService: IInstantiationService
	) {
		super(id, label);
	}

	public run(): Promise<void> {
		return this.instantiationService.createInstance(GettingStartedPage)
			.openEditor()
			.then(() => undefined);
	}
}

class GettingStartedPage extends Disposable {
	readonly editorInput: WalkThroughInput;
	private inProgressScroll = Promise.resolve();

	constructor(
		@IEditorService private readonly editorService: IEditorService,
		@ICommandService private readonly commandService: ICommandService,
		@IWorkbenchThemeService private readonly themeService: IWorkbenchThemeService,
		@IProductService private readonly productService: IProductService,
		@IInstantiationService private readonly instantiationService: IInstantiationService) {
		super();

		const resource = URI.parse(require.toUrl('./vs_code_editor_getting_started.md'))
			.with({
				scheme: Schemas.walkThrough,
				query: JSON.stringify({ moduleId: 'vs/workbench/contrib/welcome/gettingStarted/browser/vs_code_editor_getting_started' })
			});


		this.editorInput = this.instantiationService.createInstance(WalkThroughInput, {
			typeId,
			name: localize('editorGettingStarted.title', "Getting Started"),
			resource,
			telemetryFrom,
			onReady: (container: HTMLElement) => this.onReady(container)
		});
	}

	public openEditor(options: IEditorOptions = { pinned: false }) {
		return this.editorService.openEditor(this.editorInput, options);
	}

	private onReady(container: HTMLElement) {

		assertIsDefined(container.querySelector('#product-name')).textContent = this.productService.nameLong;

		// container.querySelectorAll('button').forEach(element => {
		// 	attachButtonStyler(element, this.themeService)
		// });

		container.querySelectorAll('[x-dispatch]').forEach(element => {
			const dispatch = element.getAttribute('x-dispatch');
			if (dispatch) {
				switch (dispatch) {
					case 'scrollNext':
						this._register(addDisposableListener(element, 'click', () => this.scrollNext(container)));
						break;
					case 'scrollPrev':
						this._register(addDisposableListener(element, 'click', () => this.scrollPrev(container)));
						break;
					case 'skip':
						this._register(addDisposableListener(element, 'click', () => this.commandService.executeCommand('workbench.action.closeActiveEditor')));
						break;
					case 'theme:light':
						this._register(addDisposableListener(element, 'click', () => this.themeService.setColorTheme('vs vscode-theme-defaults-themes-light_plus-json', ConfigurationTarget.USER)));
						break;
					case 'theme:dark':
						this._register(addDisposableListener(element, 'click', () => this.themeService.setColorTheme('vs-dark vscode-theme-defaults-themes-dark_plus-json', ConfigurationTarget.USER)));
						break;
					case 'theme:other':
						this._register(addDisposableListener(element, 'click', () => this.commandService.executeCommand('workbench.action.selectTheme')));
						break;
					default:
						console.error('Dispatch to ', dispatch, 'not defined');
						break;
				}
			}
		});
	}

	private async scrollNext(container: HTMLElement) {
		this.inProgressScroll = this.inProgressScroll.then(async () => {
			const slides = [...container.querySelectorAll('.gettingStartedSlide').values()];
			const currentSlide = slides.findIndex(element =>
				!element.classList.contains('prev') && !element.classList.contains('next'));
			if (currentSlide < slides.length - 1) {
				slides[currentSlide].classList.add('prev');
				assertIsDefined(slides[currentSlide + 1]).classList.remove('next');
				await new Promise(resolve => setTimeout(resolve, 500));
			}
		});
	}

	private async scrollPrev(container: HTMLElement) {
		this.inProgressScroll = this.inProgressScroll.then(async () => {
			const slides = [...container.querySelectorAll('.gettingStartedSlide').values()];
			const currentSlide = slides.findIndex(element =>
				!element.classList.contains('prev') && !element.classList.contains('next'));
			if (currentSlide > 0) {
				slides[currentSlide].classList.add('next');
				assertIsDefined(slides[currentSlide - 1]).classList.remove('prev');
				await new Promise(resolve => setTimeout(resolve, 500));
			}
		});
	}
}

export class GettingStartedInputFactory implements IEditorInputFactory {

	static readonly ID = typeId;

	public canSerialize(editorInput: EditorInput): boolean {
		return true;
	}

	public serialize(editorInput: EditorInput): string {
		return '{}';
	}

	public deserialize(instantiationService: IInstantiationService, serializedEditorInput: string): WalkThroughInput {
		return instantiationService.createInstance(GettingStartedPage).editorInput;
	}
}
