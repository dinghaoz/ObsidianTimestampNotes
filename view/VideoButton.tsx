import React, {useEffect, useMemo, useRef} from "react";
import styled from "styled-components";
import {getIcon} from "obsidian";

export type VideoButtonData = {
  url?: string,
  title?: string,
  ts?: string
}

const Container = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: start;
  width: fit-content;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid lightgray;
  border-radius: 4px;
  cursor: default;
`

const Time = styled.div`
  color: gray;
  flex-shrink: 0;
  padding: 0 2px;
  font-family: monospace;
  background-color: transparent;
`

const Title = styled.div`
  width: auto;
`

export function VideoButton(props: {data: VideoButtonData, onClick: ()=>void}) {

  let title = props.data.title
  if (!title && !props.data.ts) {
    title = props.data.url
  }

  function addIconIfNeeded(e: HTMLDivElement|null) {
    if (e) {
      if (!(e.firstChild instanceof SVGSVGElement)) {
        const icon = getIcon("video")
        icon.style.flexShrink = '0'
        e.insertBefore(icon, e.firstChild)
      }
    }
  }

  return (
    <Container onClick={props.onClick} ref={addIconIfNeeded}>
      {props.data.ts && <Time>{props.data.ts}</Time>}
      {title && <Title>{title}</Title>}
    </Container>
  )
}