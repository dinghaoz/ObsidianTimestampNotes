import { ItemView, WorkspaceLeaf } from 'obsidian';
import * as React from "react";
import * as ReactDOM from "react-dom";
import { createRoot, Root } from 'react-dom/client';

import {VideoPanel, VideoPanelProps, VideoPlaySpec} from "./VideoPanel";
import ReactPlayer from "react-player/lazy";

export type VideoViewEphemeralState = VideoPlaySpec | {focus?: boolean}

export const isVideoPlaySpec = (value: any): value is VideoPlaySpec => {
	return !!value.url
}

export const VIDEO_VIEW = "video-view";

export class VideoView extends ItemView {
	root: Root
	constructor(
		leaf: WorkspaceLeaf,
		readonly onPlayerReady: (player: ReactPlayer, setPlaying: React.Dispatch<React.SetStateAction<boolean>>) => void
	) {

		super(leaf);
		this.root = createRoot(this.containerEl.children[1])

		this.root.render(React.createElement(VideoPanel, {
			spec: null,
			onPlayerReady: this.onPlayerReady,
			clickTime: new Date().getTime()
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
		console.log("setEphemeralState", state)
		if (!isVideoPlaySpec(state)) {
			console.log("setEphemeralState failed", state)
			return
		}

		// Create a root element for the view to render into
		this.root.render(React.createElement(VideoPanel, {
			spec: state,
			onPlayerReady: this.onPlayerReady,
			clickTime: new Date().getTime()
		}, null))
	}

	async onClose() {
		this.root.unmount()
		ReactDOM.unmountComponentAtNode(this.containerEl.children[1]);
	}
}

