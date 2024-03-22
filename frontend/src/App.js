import React, { useEffect, useRef, useState } from 'react'
import { GluestackUIProvider } from '@gluestack-ui/themed'
import { config } from './gluestack-ui.config'
import Plugin from './Plugin'

export default function App() {
  const [colorMode, setColorMode] = useState('light')
  const ref = useRef()

  //NOTE decode opts from main. for now only colorMode
  const handleMessage = (message) => {
    try {
      let o = JSON.parse(message)
      if (o.colorMode) {
        setColorMode(o.colorMode)
      }

      return true
    } catch (err) {
      return false
    }
  }

  useEffect(() => {
    //NOTE pass via location to avoid waiting
    let colorMode = new URLSearchParams(window.location.search).get('colorMode')
    if (['light', 'dark'].includes(colorMode)) {
      setColorMode(colorMode)
    }

    window.addEventListener(
      'message',
      (event) => {
        const ORIGINS_OK = [
          'http://localhost:3000',
          'http://spr',
          'http://spr.local'
        ]
        // NOTE get from ourselves
        if (
          event.origin === 'http://localhost:8080' &&
          event.isTrusted === true
        ) {
          return
        }

        if (!ORIGINS_OK.includes(event.origin)) {
          console.error(
            'invalid origin:',
            event.origin,
            'event=',
            JSON.stringify(event)
          )
          return
        }

        if (!handleMessage(event.data)) {
          ref.current.onMessage(event)
        }
      },
      false
    )
  }, [])

  return (
    <GluestackUIProvider config={config} colorMode={colorMode}>
      <Plugin ref={ref} />
    </GluestackUIProvider>
  )
}
