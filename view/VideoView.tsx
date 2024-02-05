import { ItemView, WorkspaceLeaf } from 'obsidian';
import * as React from "react";
import * as ReactDOM from "react-dom";
import { createRoot, Root } from 'react-dom/client';

import {PlayItem, VideoPanel, VideoPanelProps, VideoPanelStatesAccessor, VideoPlaySpec} from "./VideoPanel";
import ReactPlayer from "react-player/lazy";


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

export type PlayerCommand = PlayCommand | SeekCommand | ToggleCommand | SeekToCommand | GetStampCommand

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
			onChooseFile: () => {
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
			},
			onCommitUrl: url => {
				if (this.statesAccessor) {
					this.statesAccessor.setRawUrl(url)
				}
			}
		}, null))
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