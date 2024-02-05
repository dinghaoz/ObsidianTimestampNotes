import styled from "styled-components";
import {useEffect, useRef, useState} from "react";
import ReactPlayer from "react-player/lazy";
import * as React from "react";
import {IconView} from "./IconView";
import {cleanUrl, isLocalFile} from "../handlers/misc";
import {localVideoRedirect} from "../handlers/server";
import {getBiliInfo, isBiliUrl} from "../handlers/bilibili";
import {requestUrl} from "obsidian";


const Container = styled.div`
	display: flex;
	flex-direction: column;
`

const Button = styled.div`
	border: 1px solid lightgray;
	border-radius: 8px;
	padding: 0 10px;
	height: 38px;

  box-sizing: border-box;

  display: flex;
  justify-content: center;
  align-items: center;

  font-size: 12px;
  font-weight: 600;
  text-align: center;
`


export type PlayItem = {
  playingUrl: string
  displayUrl: string
  subtitles: any[]
}


export type VideoPanelStatesAccessor = {
  getRawUrl: ()=>string|null
  setRawUrl:  React.Dispatch<React.SetStateAction<string|null>>

  getPlayItem: ()=>PlayItem|null
  setPlayItem:  React.Dispatch<React.SetStateAction<PlayItem|null>>

  getPlaying: ()=>boolean
  setPlaying: React.Dispatch<React.SetStateAction<boolean>>
}

export type VideoPanelProps = {
  onExportStateAccess: (statesAccessor: VideoPanelStatesAccessor)=>void,
  onPlayerReady: (player: ReactPlayer)=>void,
  onMoreOptions: (event: React.MouseEvent<HTMLDivElement>)=>void,
  onCommitUrl: (url: string)=>void,
}

export const HStack = styled.div`
  background-image: var(--image, null);
  display: flex;
  flex-direction: row;

  // align left and center
  justify-content: start;
  align-items: center;
`

const Favicon = styled.img`
  width: 16px;
  height: 16px;
`

async function getPlayItem(rawUrl: string|null): Promise<PlayItem | null> {
  if (rawUrl === null)
    return null

  if (isLocalFile(rawUrl)) {
    const playingUrl = localVideoRedirect(rawUrl);
    const displayUrl = rawUrl.toString().replace(/^\"(.+)\"$/, "$1");

    return {
      playingUrl: playingUrl,
      displayUrl: displayUrl,
      subtitles: []
    }
  } else if (isBiliUrl(rawUrl)) {
    let bili_info = await getBiliInfo(rawUrl);
    return {
      playingUrl: bili_info.url,
      displayUrl: rawUrl,
      subtitles: bili_info.subtitles
    }
  } else{
    const cleaned = cleanUrl(rawUrl)
    return {
      playingUrl: cleaned,
      displayUrl: cleaned,
      subtitles: []
    }
  }
}

async function getFaviconUrl(urlStr: string): Promise<string|null> {
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

export function VideoPanel(props: VideoPanelProps) {
  const [rawUrl, setRawUrl] = useState<string|null>(null)
  const [playItem, setPlayItem] = useState<PlayItem|null>(null)
  const [editingUrl, setEditingUrl] = useState<string>("")
  const [playing, setPlaying] = useState(true)

  const [faviconUrl, setFaviconUrl] = useState<string|null>(null)

  useEffect(() => {
    props.onExportStateAccess({
      getRawUrl: ()=>rawUrl,
      setRawUrl: (rawUrl)=>setRawUrl(rawUrl),

      getPlayItem: ()=>playItem,
      setPlayItem: (playItem)=>setPlayItem(playItem),

      getPlaying: ()=>playing,
      setPlaying: (playing)=>setPlaying(playing),
    })
  }, [rawUrl, playItem, playing]);

  useEffect(() => {
    if (playItem) {
      setFaviconUrl(null)
      getFaviconUrl(playItem.displayUrl).then(url => setFaviconUrl(url)).catch()
    } else {
      setFaviconUrl(null)
    }
  }, [playItem]);

  useEffect(() => {
    if (rawUrl) {
      getPlayItem(rawUrl).then(playItem => {
        setEditingUrl(playItem?.displayUrl ?? "")
        setPlayItem(playItem)
      })
    } else {
      setPlayItem(null)
    }
  }, [rawUrl]);

  return (<Container>
      <HStack style={{gap: 6}}>
        {faviconUrl && <Favicon src={faviconUrl}/> }
        <input type={"text"} style={{flexGrow: 1}}  value={editingUrl} onChange={e=>{setEditingUrl(e.currentTarget.value)}} onKeyUp={event => {
          if (event.key === "Enter") {
            event.preventDefault();
            props.onCommitUrl(editingUrl)
          }
        }}/>
        <div className={"clickable-icon"} onClick={props.onMoreOptions}>
          <IconView name={"more-horizontal"}/>
        </div>

        {playItem && <div className={"clickable-icon"} onClick={()=>setRawUrl(null)}>
          <IconView name={"power"}/>
        </div>}

      </HStack>

      {playItem &&
        <>
          <div style={{width:'100%', aspectRatio: '16/9', marginTop: 10, borderRadius: 8, overflow: "hidden"}}>
            <ReactPlayer
              key={playItem.displayUrl}
              url={playItem.playingUrl}
              playing={playing}
              controls={true}
              width='100%'
              height='100%'
              config={{
                file: {
                  // forceDASH: dash,
                  // forceFLV: true,
                  // forceVideo: true,
                  // dashVersion:"4.7.0",
                  attributes: {
                    crossOrigin: "anonymous",
                  },
                  tracks: playItem.subtitles,
                },
              }}
              onPlay={()=>setPlaying(true)}
              onPause={()=>setPlaying(false)}
              onReady={player => props.onPlayerReady(player)}
              onError={(err) => {
                const errMsg = err ?
                  err.message :
                  `Video is unplayable due to privacy settings, streaming permissions, etc.`
                console.error(errMsg)
              }} // Error handling for invalid URLs
            />
          </div>
        </>
      }

    </Container>
  )
}

