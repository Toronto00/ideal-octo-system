/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as cp from 'child_process';
import * as net from 'net';
import { getNLSConfiguration } from 'vs/server/remoteLanguagePacks';
import { uriTransformerPath } from 'vs/server/remoteUriTransformer';
import { getPathFromAmdModule } from 'vs/base/common/amd';
import { join, delimiter } from 'vs/base/common/path';
import { VSBuffer } from 'vs/base/common/buffer';
import { IRemoteConsoleLog } from 'vs/base/common/console';
import { Emitter, Event } from 'vs/base/common/event';
import { NodeSocket, WebSocketNodeSocket } from 'vs/base/parts/ipc/node/ipc.net';
import { getShellEnvironment } from 'vs/code/node/shellEnv';
import { ILogService } from 'vs/platform/log/common/log';
import { IRemoteExtensionHostStartParams } from 'vs/platform/remote/common/remoteAgentConnection';
import { IExtHostReadyMessage, IExtHostSocketMessage, IExtHostReduceGraceTimeMessage } from 'vs/workbench/services/extensions/common/extensionHostProtocol';
import { ServerEnvironmentService } from 'vs/server/remoteExtensionHostAgent';

export class ExtensionHostConnection {

	private _onClose = new Emitter<void>();
	readonly onClose: Event<void> = this._onClose.event;

	private _disposed: boolean;
	private _remoteAddress: string;
	private _extensionHostProcess: cp.ChildProcess | null;
	private _rendererConnection: net.Socket | null;
	private _initialDataChunk: VSBuffer | null;
	private _skipWebSocketFrames: boolean;

	constructor(
		private readonly _environmentService: ServerEnvironmentService,
		private readonly _logService: ILogService,
		private readonly _reconnectionToken: string,
		remoteAddress: string,
		_socket: NodeSocket | WebSocketNodeSocket,
		initialDataChunk: VSBuffer
	) {
		this._disposed = false;
		this._remoteAddress = remoteAddress;
		this._extensionHostProcess = null;
		const { skipWebSocketFrames, socket } = this._getUnderlyingSocket(_socket);
		this._skipWebSocketFrames = skipWebSocketFrames;
		this._rendererConnection = socket;
		this._rendererConnection.pause();
		this._initialDataChunk = initialDataChunk;

		this._log(`New connection established.`);
	}

	private _log(_str: string): void {
		this._logService.info(`[${this._remoteAddress}][${this._reconnectionToken.substr(0, 8)}][ExtensionHostConnection] ${_str}`);
	}

	private _logError(_str: string): void {
		this._logService.error(`[${this._remoteAddress}][${this._reconnectionToken.substr(0, 8)}][ExtensionHostConnection] ${_str}`);
	}

	private _getUnderlyingSocket(socket: NodeSocket | WebSocketNodeSocket): { skipWebSocketFrames: boolean; socket: net.Socket; } {
		if (socket instanceof NodeSocket) {
			return {
				skipWebSocketFrames: true,
				socket: socket.socket
			};
		} else {
			return {
				skipWebSocketFrames: false,
				socket: socket.socket.socket
			};
		}
	}

	public shortenReconnectionGraceTimeIfNecessary(): void {
		if (!this._extensionHostProcess) {
			return;
		}
		const msg: IExtHostReduceGraceTimeMessage = {
			type: 'VSCODE_EXTHOST_IPC_REDUCE_GRACE_TIME'
		};
		this._extensionHostProcess.send(msg);
	}

	public acceptReconnection(remoteAddress: string, _socket: NodeSocket | WebSocketNodeSocket, initialDataChunk: VSBuffer): void {
		this._remoteAddress = remoteAddress;
		this._log(`The client has reconnected.`);
		const { skipWebSocketFrames, socket } = this._getUnderlyingSocket(_socket);

		if (!this._extensionHostProcess) {
			// The extension host didn't even start up yet
			this._skipWebSocketFrames = skipWebSocketFrames;
			this._rendererConnection = socket;
			this._rendererConnection.pause();
			this._initialDataChunk = initialDataChunk;
			return;
		}

		socket.pause();
		const msg: IExtHostSocketMessage = {
			type: 'VSCODE_EXTHOST_IPC_SOCKET',
			initialDataChunk: (<Buffer>initialDataChunk.buffer).toString('base64'),
			skipWebSocketFrames: skipWebSocketFrames
		};
		this._extensionHostProcess.send(msg, socket);
	}

	private _cleanResources(): void {
		if (this._disposed) {
			// already called
			return;
		}
		this._disposed = true;
		if (this._rendererConnection) {
			this._rendererConnection.end();
			this._rendererConnection = null;
		}
		if (this._extensionHostProcess) {
			this._extensionHostProcess.kill();
			this._extensionHostProcess = null;
		}
		this._onClose.fire(undefined);
	}

	public async start(startParams: IRemoteExtensionHostStartParams): Promise<void> {
		try {
			const nlsConfig = await getNLSConfiguration(startParams.language, this._environmentService.userDataPath);

			let execArgv: string[] = [];
			if (startParams.port && !(<any>process).pkg) {
				execArgv = [`--inspect${startParams.break ? '-brk' : ''}=0.0.0.0:${startParams.port}`];
			}

			const userShellEnv = await getShellEnvironment(this._logService, this._environmentService);
			const processEnv = process.env;
			const binFolder = this._environmentService.isBuilt ? join(this._environmentService.appRoot, 'bin') : join(this._environmentService.appRoot, 'resources', 'server', 'bin-dev');
			let PATH = userShellEnv['PATH'] || processEnv['PATH'];
			if (PATH) {
				PATH = binFolder + delimiter + PATH;
			} else {
				PATH = binFolder;
			}
			const opts = {
				env: <{ [key: string]: string }>{
					...processEnv,
					...userShellEnv,
					...{
						AMD_ENTRYPOINT: 'vs/server/remoteExtensionHostProcess',
						PIPE_LOGGING: 'true',
						VERBOSE_LOGGING: 'true',
						VSCODE_EXTHOST_WILL_SEND_SOCKET: 'true',
						VSCODE_HANDLES_UNCAUGHT_ERRORS: 'true',
						VSCODE_LOG_STACK: 'false',
						VSCODE_NLS_CONFIG: JSON.stringify(nlsConfig, undefined, 0),
					},
					...(startParams.env || {})
				},
				execArgv,
				silent: true
			};
			setCaseInsensitive(opts.env, 'PATH', PATH);
			removeNulls(opts.env);

			// Run Extension Host as fork of current process
			this._extensionHostProcess = cp.fork(getPathFromAmdModule(require, 'bootstrap-fork'), ['--type=extensionHost', `--uriTransformerPath=${uriTransformerPath}`], opts);
			const pid = this._extensionHostProcess.pid;
			this._log(`<${pid}> Launched Extension Host Process.`);

			// Catch all output coming from the extension host process
			this._extensionHostProcess.stdout.setEncoding('utf8');
			this._extensionHostProcess.stderr.setEncoding('utf8');
			const onStdout = Event.fromNodeEventEmitter<string>(this._extensionHostProcess.stdout, 'data');
			const onStderr = Event.fromNodeEventEmitter<string>(this._extensionHostProcess.stderr, 'data');
			onStdout((e) => console.log(`EXTHOST-STDOUT::::::::` + e));
			onStderr((e) => console.log(`EXTHOST-STDERR::::::::` + e));


			// Support logging from extension host
			this._extensionHostProcess.on('message', msg => {
				if (msg && (<IRemoteConsoleLog>msg).type === '__$console') {
					console.log(`EXTHOST-LOG:::::`);
					console.log((<IRemoteConsoleLog>msg).arguments);
					// this._logExtensionHostMessage(<IRemoteConsoleLog>msg);
				}
			});

			// Lifecycle
			this._extensionHostProcess.on('error', (err) => {
				this._logError(`<${pid}> Extension Host Process had an error`);
				this._logService.error(err);
				this._cleanResources();
			});

			this._extensionHostProcess.on('exit', (code: number, signal: string) => {
				this._log(`<${pid}> Extension Host Process exited with code: ${code}, signal: ${signal}.`);
				this._cleanResources();
			});

			const messageListener = (msg: IExtHostReadyMessage) => {
				if (msg.type === 'VSCODE_EXTHOST_IPC_READY') {
					this._extensionHostProcess!.removeListener('message', messageListener);
					const reply: IExtHostSocketMessage = {
						type: 'VSCODE_EXTHOST_IPC_SOCKET',
						initialDataChunk: (<Buffer>this._initialDataChunk!.buffer).toString('base64'),
						skipWebSocketFrames: this._skipWebSocketFrames
					};
					this._extensionHostProcess!.send(reply, this._rendererConnection!);
					this._initialDataChunk = null;
					this._rendererConnection = null;
				}
			};
			this._extensionHostProcess.on('message', messageListener);

		} catch (error) {
			console.error('ExtensionHostConnection errored');
			if (error) {
				console.error(error);
			}
		}
	}
}

function setCaseInsensitive(env: { [key: string]: string }, key: string, value: string): void {
	const pathKeys = Object.keys(env).filter(k => k.toLowerCase() === key.toLowerCase());
	const pathKey = pathKeys.length > 0 ? pathKeys[0] : key;
	env[pathKey] = value;
}

function removeNulls(env: { [key: string]: string | null }): void {
	// Don't delete while iterating the object itself
	for (let key of Object.keys(env)) {
		if (env[key] === null) {
			delete env[key];
		}
	}
}
