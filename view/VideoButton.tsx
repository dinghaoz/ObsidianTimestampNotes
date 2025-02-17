import React from "react";
import styled from "styled-components";
import {getIcon} from "obsidian";
import {IconView} from "./IconView";
import {VideoNoteData} from "../VideoNote";



const Container = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: start;
  width: fit-content;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid var(--color-base-50);
  border-radius: 4px;
  cursor: default;
  &:hover {
    background-color: var(--color-base-30);
  }
`

const Time = styled.div`
  color: var(--color-base-60);
  flex-shrink: 0;
  padding: 0 2px;
  font-family: monospace;
  background-color: transparent;
`

const Title = styled.div`
  width: auto;
`

export function VideoButton(props: {data: VideoNoteData, onClick: ()=>void}) {

  let title = props.data.title
  if (!title && !props.data.ts) {
    title = props.data.url
  }


  return (
    <Container onClick={props.onClick}>
      <IconView name={"youtube"}/>
      {props.data.ts && <Time>{props.data.ts}</Time>}
      {title && <Title>{title}</Title>}
    </Container>
  )
}