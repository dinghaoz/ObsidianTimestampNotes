import { ItemView, WorkspaceLeaf } from 'obsidian';
import * as React from "react";
import * as ReactDOM from "react-dom";
import { createRoot, Root } from 'react-dom/client';

import { VideoContainer, VideoContainerProps } from "./VideoContainer"
import styled from "styled-components";

export interface VideoViewProps extends VideoContainerProps {
	saveTimeOnUnload: () => void;
	focus?: boolean
}

const Container = styled.div`
	display: flex;
	flex-direction: column;
`

export const VIDEO_VIEW = "video-view";
export class VideoView extends ItemView {
	component: ReactDOM.Renderer
	saveTimeOnUnload: () => void
	root: Root
	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
		this.saveTimeOnUnload = () => { };
		this.root = createRoot(this.containerEl.children[1])
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

	setEphemeralState(props: VideoViewProps) {
		console.log("setEphemeralState", props)
		if (props.focus) {
			return
		}

		// Allows view to save the playback time in the setting state when the view is closed 
		this.saveTimeOnUnload = props.saveTimeOnUnload;

		// Create a root element for the view to render into
		this.root.render(
			<Container>
				{(props.url || props.main_url) && <VideoContainer
					url={props.url}
					main_url={props.main_url}
					start={props.start}
					setupPlayer={props.setupPlayer}
					setupError={props.setupError}
					onCapture={props.onCapture}
					subtitles={props.subtitles}
				/>}

				<button style={{marginTop:10}} onClick={(e)=>props.onCapture()}>Copy Snapshot</button>
			</Container>
		);
	}

	async onClose() {
		if (this.saveTimeOnUnload) await this.saveTimeOnUnload();
		this.root.unmount()
		ReactDOM.unmountComponentAtNode(this.containerEl.children[1]);
	}
}
