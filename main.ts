import {Editor, MarkdownView, Plugin, Modal, App, Notice, parseYaml, getIcon} from 'obsidian';
import ReactPlayer from 'react-player/lazy'

import {
	VideoView,
	VIDEO_VIEW,
	VideoPanelPlay,
	VideoPanelSeekTo,
	VideoPanelGetStamp,
	VideoPanelToggle, VideoPanelSeek, VideoPanelPerformAction, VideoActionId
} from './view/VideoView';
import { TimestampPluginSettings, TimestampPluginSettingTab, DEFAULT_SETTINGS } from 'settings';

import * as http from "http";
import { AddressInfo } from "node:net";
import { server, startServer, PORT, localVideoRedirect, subtitleRedirect } from "handlers/server";
import { isLocalFile, cleanUrl, isSameVideo } from "handlers/misc";
import { getBiliInfo, isBiliUrl } from 'handlers/bilibili';
import React, {ReactDOM} from "react";
import {createRoot} from "react-dom/client";
import {VideoButton} from "./view/VideoButton";
import {makeVideoNote, VideoNoteData} from "./VideoNote";
import {getPageTitle} from "./utils";

const ERRORS: { [key: string]: string } = {
	"INVALID_URL": "\n> [!error] Invalid Video URL\n> The highlighted link is not a valid video url. Please try again with a valid link.\n",
	"NO_ACTIVE_VIDEO": "\n> [!caution] Select Video\n> A video needs to be opened before using this hotkey.\n Highlight your video link and input your 'Open video player' hotkey to register a video.\n",
}

function getSeconds(ts: string) {
	const timeArr = ts.split(":").map((v) => parseInt(v));
	const [hh, mm, ss] = timeArr.length === 2 ? [0, ...timeArr] : timeArr;
	return (hh || 0) * 3600 + (mm || 0) * 60 + (ss || 0);
}

function getDisplayTime(playTime: number) {
	const leadingZero = (num: number) => num < 10 ? "0" + num.toFixed(0) : num.toFixed(0);
	const totalSeconds = Number(playTime.toFixed(2));
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds - (hours * 3600)) / 60);
	const seconds = totalSeconds - (hours * 3600) - (minutes * 60);
	return (hours > 0 ? leadingZero(hours) + ":" : "") + leadingZero(minutes) + ":" + leadingZero(seconds);
}

export default class TimestampPlugin extends Plugin {

	settings!: TimestampPluginSettings;
	server!: http.Server;

	async onload() {
		// Register view
		this.registerView(
			VIDEO_VIEW,
			(leaf) => new VideoView(leaf)
		);

		// Register settings
		await this.loadSettings();

		// Start local server
		if (!server) await startServer(this.settings.port);
		this.server = server;

		// Markdown processor that turns video urls into buttons to open views of the video
		this.registerMarkdownCodeBlockProcessor("video-note", (source, el, ctx) => {

			let content: VideoNoteData
			try {
				content = parseYaml(source.trim())
			} catch (e) {
				new Notice(`Wrong format ${e}`)
				return;
			}

			if (content.url && !(isLocalFile(content.url) || ReactPlayer.canPlay(content.url) || isBiliUrl(content.url))) {
				new Notice(ERRORS["INVALID_URL"]);

				return
			}


			let seconds: number|null = null
			if (content.ts) {
				const match = content.ts.match(/\d+:\d+:\d+|\d+:\d+/g)
				if (match) {
					seconds = getSeconds(match[0])
				}
			}

			const root = createRoot(el);
			root.render(React.createElement(VideoButton, {
				data: content,
				onClick: ()=> {
					this.play(content.url ?? null, seconds)
				}
			}, null))
		});

		// Command that gets selected video link and sends it to view which passes it to React component
		this.addCommand({
			id: 'create-video-note',
			name: 'Turn the selected URL into a video note block',
			editorCallback: async (editor, view) => {
				// Get selected text or clipboard content and match against video url to convert link to video id
				const url = editor.getSelection().trim() || (await navigator.clipboard.readText()).trim();

				// Activate the view with the valid link
				if (isLocalFile(url) || ReactPlayer.canPlay(url) || isBiliUrl(url)) {
					getPageTitle(url).then(t => {
						const title = (t ?? undefined)
						const content = makeVideoNote({
							url: url,
							title: title
						})
						editor.replaceSelection(content)
					})

				} else {
					new Notice(ERRORS["INVALID_URL"])
				}
			}
		});

		// This command inserts the timestamp of the playing video into the editor
		this.addCommand({
			id: 'video-note-insert-time',
			name: 'Insert Video Note from current video with timestamp',
			editorCallback: (editor, view) => {
				const videoLeaf = this.getVideoLeaf()
				if (!videoLeaf) return;

				VideoPanelGetStamp(videoLeaf, (rawUrl, playItem, videoTitle, playTime)=> {
					if (playItem && playTime) {
						const displayTime = getDisplayTime(playTime)
						const content = makeVideoNote({
							ts: displayTime,
							url: playItem.displayUrl,
							title: videoTitle ?? undefined
						})

						// insert timestamp into editor
						editor.replaceSelection(content)
					}
				})
			}
		});

		this.addCommand({
			id: 'video-note-insert',
			name: 'Insert Video Note from current video',
			editorCallback: (editor, view) => {
				const videoLeaf = this.getVideoLeaf()
				if (!videoLeaf) return;

				VideoPanelGetStamp(videoLeaf, (rawUrl, playItem, videoTitle, playTime)=> {
					if (playItem) {
						const content = makeVideoNote({
							url: playItem.displayUrl,
							title: videoTitle ?? undefined
						})

						// insert timestamp into editor
						editor.replaceSelection(content)
					}
				})
			}
		});

		//Command that play/pauses the video
		this.addCommand({
			id: 'toggle-pause-player',
			name: 'Play/Pause player',
			callback: () => {
				const videoLeaf = this.getVideoLeaf()
				if (!videoLeaf) return;

				VideoPanelToggle(videoLeaf)
			}
		});

		// Seek forward by set amount of seconds
		this.addCommand({
			id: 'seek-forward',
			name: 'Seek Forward',
			callback: () => {

				const videoLeaf = this.getVideoLeaf()
				if (!videoLeaf) return;

				VideoPanelSeek(videoLeaf, parseInt(this.settings.forwardSeek))
			}
		});

		// Seek backwards by set amount of seconds
		this.addCommand({
			id: 'seek-backward',
			name: 'Seek Backward',
			callback: () => {
				const videoLeaf = this.getVideoLeaf()
				if (!videoLeaf) return;

				VideoPanelSeek(videoLeaf, -parseInt(this.settings.forwardSeek))
			}
		});

		const actionCmds = [
			{id: "add-local-media", name: "Open a Local Media File"},
			{id: "add-subtitles", name: "Add Subtitle Files"},
			{id: "video-snapshot", name: "Capture Video Snapshot and Copy it into Clipboard"}
		] as {id: VideoActionId, name: string}[]

		actionCmds.forEach(cmd => {
			this.addCommand({
				id: cmd.id,
				name: cmd.name,
				editorCallback: (editor, view) => {
					const videoLeaf = this.getVideoLeaf()
					if (!videoLeaf) return;

					VideoPanelPerformAction(videoLeaf, cmd.id)
				}
			})
		})



		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new TimestampPluginSettingTab(this.app, this));
	}

	async onunload() {
		this.app.workspace.detachLeavesOfType(VIDEO_VIEW);
		this.server.close();
	}

	getVideoLeaf() {
		return this.app.workspace.getLeavesOfType(VIDEO_VIEW).filter(leaf => leaf.view instanceof VideoView).first()
	}

	// This is called when a valid url is found => it activates the View which loads the React view
	async play(url: string|null, seconds: number|null) {
		// this.app.workspace.detachLeavesOfType(VIDEO_VIEW);
		if (this.app.workspace.getLeavesOfType(VIDEO_VIEW).length == 0) {
			await this.app.workspace.getRightLeaf(false).setViewState({
				type: VIDEO_VIEW,
				active: true,
			});
		}

		// This triggers the React component to be loaded
		const videoLeaf = this.getVideoLeaf()
		if (!videoLeaf) return

		if (url) {
			VideoPanelPlay(videoLeaf, {
				url: url,
				seekTime: seconds ?? (this.settings.startAtLastPosition ? ~~(this.settings.urlStartTimeMap.get(url) ?? 0) : 0)
			})
		} else if (seconds) {
			VideoPanelSeekTo(videoLeaf, seconds)
		}

		await this.saveSettings();
	}

	async loadSettings() {
		// Fix for a weird bug that turns default map into a normal object when loaded
		const data = await this.loadData()
		if (data) {
			const map = new Map(Object.keys(data.urlStartTimeMap).map(k => [k, data.urlStartTimeMap[k]]))
			this.settings = { ...DEFAULT_SETTINGS, ...data, urlStartTimeMap: map };
		} else {
			this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
