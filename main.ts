import {Editor, MarkdownView, Plugin, Modal, App, Notice, parseYaml, getIcon} from 'obsidian';
import ReactPlayer from 'react-player/lazy'

import { VideoView, VIDEO_VIEW } from './view/VideoView';
import { TimestampPluginSettings, TimestampPluginSettingTab, DEFAULT_SETTINGS } from 'settings';

import * as http from "http";
import { AddressInfo } from "node:net";
import { server, startServer, PORT, localVideoRedirect, subtitleRedirect } from "handlers/server";
import { isLocalFile, cleanUrl, isSameVideo } from "handlers/misc";
import { getBiliInfo, isBiliUrl } from 'handlers/bilibili';
import React, {ReactDOM} from "react";
import {createRoot} from "react-dom/client";
import {VideoButton, VideoButtonData} from "./view/VideoButton";

const ERRORS: { [key: string]: string } = {
	"INVALID_URL": "\n> [!error] Invalid Video URL\n> The highlighted link is not a valid video url. Please try again with a valid link.\n",
	"NO_ACTIVE_VIDEO": "\n> [!caution] Select Video\n> A video needs to be opened before using this hotkey.\n Highlight your video link and input your 'Open video player' hotkey to register a video.\n",
}

function getSeconds(ts: string) {
	const timeArr = ts.split(":").map((v) => parseInt(v));
	const [hh, mm, ss] = timeArr.length === 2 ? [0, ...timeArr] : timeArr;
	return (hh || 0) * 3600 + (mm || 0) * 60 + (ss || 0);
}

export default class TimestampPlugin extends Plugin {
	settings: TimestampPluginSettings;
	player: ReactPlayer;
	setPlaying: React.Dispatch<React.SetStateAction<boolean>>;
	editor: Editor;
	server: http.Server;

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

		// Markdown processor that turns timestamps into buttons
		this.registerMarkdownCodeBlockProcessor("timestamp", (source, el, ctx) => {
			// Match mm:ss or hh:mm:ss timestamp format
			const regExp = /\d+:\d+:\d+|\d+:\d+/g;
			const rows = source.split("\n").filter((row) => row.length > 0);
			rows.forEach((row) => {
				const match = row.match(regExp);
				if (match) {
					//create button for each timestamp
					const div = el.createEl("div");
					const button = div.createEl("button");
					button.innerText = match[0];
					button.style.backgroundColor = this.settings.timestampColor;
					button.style.color = this.settings.timestampTextColor;

					// convert timestamp to seconds and seek to that position when clicked
					button.addEventListener("click", () => {
						const timeArr = match[0].split(":").map((v) => parseInt(v));
						const [hh, mm, ss] = timeArr.length === 2 ? [0, ...timeArr] : timeArr;
						const seconds = (hh || 0) * 3600 + (mm || 0) * 60 + (ss || 0);
						if (this.player) this.player.seekTo(seconds);
					});
					div.appendChild(button);
				}
			})
		});


		// Markdown processor that turns video urls into buttons to open views of the video
		this.registerMarkdownCodeBlockProcessor("timestamp-url", (source, el, ctx) => {
			const url = source.trim();
			// Creates button for video url
			const div = el.createEl("div");
			const button = div.createEl("button");
			button.innerText = url;
			button.style.backgroundColor = "GRAY";
			button.style.color = this.settings.urlTextColor;
			if (isLocalFile(url) || ReactPlayer.canPlay(url) || isBiliUrl(url)) {
			button.style.backgroundColor = this.settings.urlColor;
			
			button.addEventListener("click", () => {
				if (isSameVideo(this.player, url)) {	
					this.player?.seekTo(0);
				  } else {
					this.activateView(url, null, this.editor);
				  }			
				});
			} else {
				if (this.editor) {
					this.editor.replaceSelection(this.editor.getSelection() + "\n" + ERRORS["INVALID_URL"]);
				}
			}
		});


		// Markdown processor that turns video urls into buttons to open views of the video
		this.registerMarkdownCodeBlockProcessor("video-note", (source, el, ctx) => {

			let content: VideoButtonData
			try {
				content = parseYaml(source.trim())
			} catch (e) {
				new Notice(`Wrong format ${e}`)
				return;
			}

			if (content.url && !(isLocalFile(content.url) || ReactPlayer.canPlay(content.url) || isBiliUrl(content.url))) {
				if (this.editor) {
					this.editor.replaceSelection(this.editor.getSelection() + "\n" + ERRORS["INVALID_URL"]);
				}
				return
			}


			let seconds: number | null = null
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
					if (content.url) {
						if (isSameVideo(this.player, content.url)) {
							this.player?.seekTo(seconds ?? 1);
						} else {
							this.activateView(content.url, seconds, this.editor).then(()=> {
								this.player?.seekTo(seconds ?? 0);
							})
						}
					} else if (seconds !== null) {
						this.player?.seekTo(seconds)
					}
				}
			}, null))
		});

		// Command that gets selected video link and sends it to view which passes it to React component
		this.addCommand({
			id: 'trigger-player',
			name: 'Open video player (copy video url and use hotkey)',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				// Get selected text or clipboard content and match against video url to convert link to video video id
				const url = editor.getSelection().trim() || (await navigator.clipboard.readText()).trim();

				// Activate the view with the valid link
				if (isLocalFile(url) || ReactPlayer.canPlay(url) || isBiliUrl(url)) {
					this.activateView(url, null, editor).catch();
					const noteTitle = this.settings.noteTitle
					let content = ""
					if (noteTitle) {
						content += `${noteTitle}\n`
					}

					content += [
						"```video-note",
						`url: ${url}`,
						"```"
					].join('\n') + '\n'

					editor.replaceSelection(content)
					this.editor = editor;
				} else {
					editor.replaceSelection(ERRORS["INVALID_URL"])
				}
				editor.setCursor(editor.getCursor().line + 1)
			}
		});

		// This command inserts the timestamp of the playing video into the editor
		this.addCommand({
			id: 'timestamp-insert',
			name: 'Insert timestamp based on videos current play time',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				if (!this.player) {
					editor.replaceSelection(ERRORS["NO_ACTIVE_VIDEO"])
					return
				}


				// convert current video time into timestamp
				const leadingZero = (num: number) => num < 10 ? "0" + num.toFixed(0) : num.toFixed(0);
				const totalSeconds = Number(this.player.getCurrentTime().toFixed(2));
				const hours = Math.floor(totalSeconds / 3600);
				const minutes = Math.floor((totalSeconds - (hours * 3600)) / 60);
				const seconds = totalSeconds - (hours * 3600) - (minutes * 60);
				const time = (hours > 0 ? leadingZero(hours) + ":" : "") + leadingZero(minutes) + ":" + leadingZero(seconds);

				let content = ""

				content += [
					"```video-note",
					`ts: ${time}`,
					`url: ${this.player.props.main_url ?? this.player.props.url}`,
					"```"
				].join('\n') + '\n'

				// insert timestamp into editor
				editor.replaceSelection(content)
			}
		});

		//Command that play/pauses the video
		this.addCommand({
			id: 'pause-player',
			name: 'Pause player',
			callback: () => {
				this.setPlaying(!this.player.props.playing)
			}
		});

		// Seek forward by set amount of seconds
		this.addCommand({
			id: 'seek-forward',
			name: 'Seek Forward',
			callback: () => {
				if (this.player) this.player.seekTo(this.player.getCurrentTime() + parseInt(this.settings.forwardSeek));
			}
		});

		// Seek backwards by set amount of seconds
		this.addCommand({
			id: 'seek-backward',
			name: 'Seek Backward',
			callback: () => {
				if (this.player) this.player.seekTo(this.player.getCurrentTime() - parseInt(this.settings.backwardsSeek));
			}
		});

		// // This adds a complex command that can check whether the current state of the app allows execution of the command
		// this.addCommand({
		// 	id: 'open-sample-modal-complex',
		// 	name: 'Open sample modal (complex)',
		// 	editorCallback: (editor: Editor, view: MarkdownView) => {
		// 		this.editor = editor;
		// 		new SampleModal(this.app, this.activateView.bind(this), editor).open();
		// 		// This command will only show up in Command Palette when the check function returns true
		// 		return true;
		// 	}
		// });

		this.addCommand({
			id: "add-local-media",
			name: "Open Local Media",
			editorCallback: (editor: Editor, view: MarkdownView) => {
				const input = document.createElement("input");
				input.setAttribute("type", "file");
				input.accept = "video/*, audio/*, .mpd, .flv";
				input.onchange = (e: any) => {
				  var url = e.target.files[0].path.trim();
				  this.activateView(url, null, this.editor);
				  editor.replaceSelection("\n" + "```timestamp-url \n " + url + "\n ```\n");
				};	  
			  input.click();
			},
		  });

		this.addCommand({
			id: "add-subtitles",
			name: "Add subtitle file",
			callback: async () => {
				if (!this.player) {
					return new Notice("Player is not working right now")
				}
				var input = document.createElement("input");
				input.type = "file";
				input.accept = ".srt,.vtt";
				input.onchange = (e: any) => {
				var files = e.target.files;
				for (let i = 0; i < files.length; i++) {
					var file = files[i];
					var track = document.createElement("track");
					track.kind = "subtitles";
					track.label = file.name;
					track.src = subtitleRedirect(file.path);
					// track.mode = i == files.length - 1 ? "showing" : "hidden";
					this.player.getInternalPlayer().appendChild(track);
				}
				};
		
				input.click();
			},
		});

		this.addCommand({
			id: "video-snapshot",
			name: "Take and copy to clipboard snapshot from video",
			callback: async () => {
			  await this.copySnapshot()
			},
		  });
	  

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new TimestampPluginSettingTab(this.app, this));
	}

	async copySnapshot() {
		// https://github.com/ilkkao/capture-video-frame/blob/master/capture-video-frame.js
		if (!this.player) return;
		var video = document.querySelector("video");
		if (!video || video.videoHeight==0 || video.videoWidth==0) {
			return new Notice("Current player is not supported for taking snapshot!");
		}

		var canvas = document.createElement("canvas");

		canvas.width = video.videoWidth;
		canvas.height = video.videoHeight;

		canvas.getContext("2d").drawImage(video, 0, 0);

		// https://stackoverflow.com/a/60401130
		canvas.toBlob(async (blob) => {
			navigator.clipboard
				.write([
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

	async onunload() {
		this.player = null;
		this.editor = null;
		this.setPlaying = null;
		this.app.workspace.detachLeavesOfType(VIDEO_VIEW);
		this.server.close();
	}

	// This is called when a valid url is found => it activates the View which loads the React view
	async activateView(url: string, seconds: number|null, editor: Editor) {
		// this.app.workspace.detachLeavesOfType(VIDEO_VIEW);
		if (this.app.workspace.getLeavesOfType(VIDEO_VIEW).length == 0) {
			await this.app.workspace.getRightLeaf(false).setViewState({
				type: VIDEO_VIEW,
				active: true,
			});
		}
		// this.app.workspace.revealLeaf(
		// 	this.app.workspace.getLeavesOfType(VIDEO_VIEW)[0]
		// );

		// This triggers the React component to be loaded
		const videoLeaf = this.app.workspace.getLeavesOfType(VIDEO_VIEW).filter(leaf => leaf.view instanceof VideoView).first()
		if (!videoLeaf) return


		const setupPlayer = (player: ReactPlayer, setPlaying: React.Dispatch<React.SetStateAction<boolean>>) => {
			this.player = player;
			this.setPlaying = setPlaying;
		}

		const setupError = (err: string) => {
			editor.replaceSelection(editor.getSelection() + `\n> [!error] Streaming Error \n> ${err}\n`);
		}

		const onCapture = () => {
			this.copySnapshot().catch()
		}

		const saveTimeOnUnload = async () => {
			if (this.player) {
				this.settings.urlStartTimeMap.set(url, Number(this.player.getCurrentTime().toFixed(0)));
			}
			await this.saveSettings();
		}


		// create a new video instance, sets up state/unload functionality, and passes in a start time if available else 0
		videoLeaf.setEphemeralState({
			spec: {
				url: url,
				start: seconds ?? (this.settings.startAtLastPosition ? ~~this.settings.urlStartTimeMap.get(url) : 0)
			},
			clickTime: new Date().getTime(),
			setupPlayer,
			setupError,
			onCapture,
		});

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
