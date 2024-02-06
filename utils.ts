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

export async function getPageTitle(urlStr: string): Promise<string|null> {
  if (isLocalFile(urlStr)) return urlStr.split('/').last() ?? null
  const response = await requestUrl(urlStr)
  const html = response.text

  const doc = new DOMParser().parseFromString(html, 'text/html')
  const title = doc.querySelectorAll('title')[0]
  return title.innerText
      .replace(" - YouTube", "")
      .replace("_哔哩哔哩_bilibili", "")
      .replace(" - video Dailymotion", "")
    ?? null
}