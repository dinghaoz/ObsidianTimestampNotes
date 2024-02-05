import {ItemView, Menu, Notice, WorkspaceLeaf} from 'obsidian';
import * as React from "react";
import * as ReactDOM from "react-dom";
import { createRoot, Root } from 'react-dom/client';

import {PlayItem, VideoPanel, VideoPanelStatesAccessor} from "./VideoPanel";
import ReactPlayer from "react-player/lazy";
import {subtitleRedirect} from "../handlers/server";


export const VIDEO_VIEW = "video-view";

export type PlayCommand = {
	commandName: "play"
	url: string
	seekTime: number
}

export type SeekCommand = {
	commandName: "seek"
	offset: number
}
export type SeekToCommand = {
	commandName: "seekTo"
	seekTime: number
}

export type ToggleCommand = {
	commandName: "toggle"
}

export type GetStampCommand = {
	commandName: "getStamp",
	callback: (rawUrl: string|null, playItem: PlayItem|null, playTime: number|null)=>void
}

export type ActionCommand = {
	commandName: "action",
	action: "add-local-media" | "add-subtitles" | "video-snapshot" | "close-video"
}

export type PlayerCommand = PlayCommand | SeekCommand | ToggleCommand | SeekToCommand | GetStampCommand | ActionCommand

export type VideoViewEphemeralState = PlayerCommand | {focus?: boolean}

export const isPlayerCommand = (value: any): value is PlayerCommand => {
	return !!value.commandName
}



export class VideoView extends ItemView {

	root: Root
	statesAccessor?: VideoPanelStatesAccessor
	player?: ReactPlayer

	pendingSeekTime?: number

	constructor(
		leaf: WorkspaceLeaf
	) {
		super(leaf);
		this.root = createRoot(this.containerEl.children[1])

		// Create a root element for the view to render into
		this.root.render(React.createElement(VideoPanel, {
			onExportStateAccess: statesAccessor => {this.statesAccessor = statesAccessor},
			onPlayerReady: player => {
				this.player = player
				if (this.pendingSeekTime) {
					player.seekTo(this.pendingSeekTime)
					this.pendingSeekTime = undefined
				}
			},
			onMoreOptions: (event: React.MouseEvent<HTMLDivElement>) => {
				this.showMoreOptionsMenu(event)
			},
			onCommitUrl: url => {
				if (this.statesAccessor) {
					this.statesAccessor.setRawUrl(url)
				}
			}
		}, null))
	}

	showMoreOptionsMenu(event: React.MouseEvent<HTMLDivElement>) {
		if (!this.statesAccessor)
			return

		const menu = new Menu();

		menu.addItem(item => item
				.setTitle("Open Local File...")
				.onClick(()=>this.chooseLocalFile())
		);

		const playItem = this.statesAccessor.getPlayItem()
		if (playItem) {
			if (this.player) {
				menu.addItem(item => item
					.setTitle("Add Subtitles...")
					.onClick(()=>this.chooseSubtitles())
				);
			}

			menu.addItem(item => item
				.setTitle("Capture Snapshot")
				.onClick(() => this.captureSnapshot())
			)

			menu.addItem(item => item
				.setTitle("Close")
				.onClick(()=>this.statesAccessor?.setRawUrl(null))
			);
		}

		menu.showAtMouseEvent(event.nativeEvent);
	}

	captureSnapshot() {
		const video = document.querySelector("video");
		if (!video || video.videoHeight==0 || video.videoWidth==0) {
			new Notice("Current player is not supported for taking snapshot!");
			return
		}

		const canvas = document.createElement("canvas");

		canvas.width = video.videoWidth;
		canvas.height = video.videoHeight;

		const context = canvas.getContext("2d")
		if (!context) return

		context.drawImage(video, 0, 0);

		// https://stackoverflow.com/a/60401130
		canvas.toBlob(async (blob) => {
			if (!blob) return

			navigator.clipboard
				.write([
					// @ts-ignore
					new ClipboardItem({
						[blob.type]: blob,
					}),
				])
				.then(async () => {
					// document.execCommand("paste");
					new Notice("Snapshot copied to clipboard!");
				});
		});
	}

	chooseLocalFile() {
		const input = document.createElement("input");
		input.setAttribute("type", "file");
		input.accept = "video/*, audio/*, .mpd, .flv";
		input.onchange = (e: any) => {
			const url = e.target.files[0].path.trim();
			if (this.statesAccessor) {
				this.statesAccessor.setRawUrl(url)
			}
		};
		input.click();
	}

	chooseSubtitles() {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = ".srt,.vtt";
		input.onchange = (e: any) => {
			if (!this.player) return

			const files = e.target.files;
			for (let i = 0; i < files.length; i++) {
				const file = files[i];
				const track = document.createElement("track");
				track.kind = "subtitles";
				track.label = file.name;
				track.src = subtitleRedirect(file.path);
				// track.mode = i == files.length - 1 ? "showing" : "hidden";
				this.player.getInternalPlayer().appendChild(track);
			}
		};

		input.click();
	}

	getViewType() {
		return VIDEO_VIEW;
	}

	getDisplayText() {
		return "Timestamp Video";
	}

	getIcon(): string {
		return "video";
	}

	setEphemeralState(state: VideoViewEphemeralState) {
		if (!isPlayerCommand(state))
			return

		if (!this.statesAccessor)
			return

		switch (state.commandName) {
			case "play":
				this.statesAccessor.setRawUrl(state.url)
				this.statesAccessor.setPlaying(true)
				if (this.player) {
					this.player.seekTo(state.seekTime)
				} else {
					this.pendingSeekTime = state.seekTime
				}
				break
			case "seek":
				if (this.player) {
					this.player.seekTo(this.player.getCurrentTime() + state.offset)
				}
				break
			case "seekTo":
				if (this.player) {
					this.player.seekTo(state.seekTime)
				}
				break
			case "toggle":
				this.statesAccessor.setPlaying(value => !value)
				break
			case "getStamp":
				state.callback(this.statesAccessor.getRawUrl(), this.statesAccessor.getPlayItem(), this.player?.getCurrentTime() ?? null)
				break
			case "action":
				switch (state.action) {
					case "add-local-media":
						this.chooseLocalFile()
						break
					case "add-subtitles":
						this.chooseSubtitles()
						break
					case "video-snapshot":
						this.captureSnapshot()
						break
					case "close-video":
						this.statesAccessor.setRawUrl(null)
						break
				}
		}
	}

	async onClose() {
		this.root.unmount()
		ReactDOM.unmountComponentAtNode(this.containerEl.children[1]);
		this.player = undefined
		this.pendingSeekTime = undefined
		this.statesAccessor = undefined
	}
}



export function VideoPanelPlay(leaf: WorkspaceLeaf, command: Omit<PlayCommand, "commandName">) {
	leaf.setEphemeralState({
		commandName: "play",
		...command
	})
}

export function VideoPanelToggle(leaf: WorkspaceLeaf) {
	leaf.setEphemeralState({
		commandName: "toggle"
	})
}

export function VideoPanelSeek(leaf: WorkspaceLeaf, offset: number) {
	leaf.setEphemeralState({
		commandName: "seek",
		offset: offset
	})
}
export function VideoPanelSeekTo(leaf: WorkspaceLeaf, seekTime: number) {
	leaf.setEphemeralState({
		commandName: "seekTo",
		seekTime: seekTime
	})
}

export function VideoPanelGetStamp(leaf: WorkspaceLeaf, callback: GetStampCommand["callback"]) {
	leaf.setEphemeralState({
		commandName: "getStamp",
		callback: callback
	})
}

export function VideoPanelPerformAction(leaf: WorkspaceLeaf, action: ActionCommand["action"]) {
	leaf.setEphemeralState({
		commandName: "action",
		action: action
	})
}
