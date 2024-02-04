import styled from "styled-components";
import {getIcon} from "obsidian";
import React from "react";

const Container = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: fit-content;
  height: fit-content;
  flex-shrink: 0;
`



export function IconView(props: {name: string}) {

  function addIconIfNeeded(e: HTMLDivElement|null) {
    if (e) {
      if (!(e.firstChild instanceof SVGSVGElement)) {
        const icon = getIcon(props.name)
        icon.style.flexShrink = '0'
        e.insertBefore(icon, e.firstChild)
      }
    }
  }

  return (
    <Container ref={addIconIfNeeded}>

    </Container>
  )
}