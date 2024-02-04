import { ItemView, WorkspaceLeaf } from 'obsidian';
import * as React from "react";
import * as ReactDOM from "react-dom";
import { createRoot, Root } from 'react-dom/client';

import {VideoPanel, VideoPanelProps} from "./VideoPanel";

export type VideoViewEphemeralState = VideoPanelProps | {focus?: boolean}

export const isVideoPanelProps = (value: any): value is VideoPanelProps => {
	return value.spec !== undefined
}

export const VIDEO_VIEW = "video-view";

export class VideoView extends ItemView {
	root: Root
	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
		this.root = createRoot(this.containerEl.children[1])

		// this.root.render(React.createElement(VideoPanel, {spec: null, }, null))
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

	setEphemeralState(props: VideoViewEphemeralState) {
		console.log("setEphemeralState", props)
		if (!isVideoPanelProps(props)) {
			return
		}

		// Create a root element for the view to render into
		this.root.render(React.createElement(VideoPanel, props, null))
	}

	async onClose() {
		this.root.unmount()
		ReactDOM.unmountComponentAtNode(this.containerEl.children[1]);
	}
}

