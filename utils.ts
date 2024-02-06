import {isLocalFile} from "./handlers/misc";
import {requestUrl} from "obsidian";

export async function getFaviconUrl(urlStr: string): Promise<string|null> {
  if (isLocalFile(urlStr)) return null
  const response = await requestUrl(urlStr)
  const html = response.text

  const doc = new DOMParser().parseFromString(html, 'text/html')
  const links = Array.from(doc.getElementsByTagName("link"));
  const shortCutIcon = links.filter(l => l.rel === "icon" && l.sizes.value === "32x32")[0]
  if (shortCutIcon) {
    return shortCutIcon.href
  }

  const url = new URL(urlStr)
  return `${url.protocol}//${url.hostname}/favicon.ico`
}