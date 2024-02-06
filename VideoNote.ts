import {stringifyYaml} from "obsidian";

export type VideoNoteData = {
  url?: string,
  title?: string,
  ts?: string
}

export function makeVideoNote(data: VideoNoteData): string {
  return ["```video-note\n", stringifyYaml(data), "```"].join("") + '\n'
}