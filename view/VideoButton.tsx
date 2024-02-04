import React from "react";
import styled from "styled-components";
import {getIcon} from "obsidian";
import {IconView} from "./IconView";

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
  &:hover {
    background-color: lightgray;
  }
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


  return (
    <Container onClick={props.onClick}>
      <IconView name={"video"}/>
      {props.data.ts && <Time>{props.data.ts}</Time>}
      {title && <Title>{title}</Title>}
    </Container>
  )
}