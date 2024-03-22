import React, { useState } from 'react'

import { Button, ButtonText, Heading, Text, VStack } from '@gluestack-ui/themed'
import { api } from '../API'

const Status = () => {
  const [result, setResult] = useState('')

  const onPress = () => {
    api
      .get('/status')
      .then((res) => {
        setResult(`status=${res}`)
      })
      .catch((err) => console.error(`error: ${err}`))
  }

  return (
    <VStack
      p="$4"
      space="md"
      bg="$backgroundCardLight"
      sx={{ _dark: { bg: '$backgroundCardDark' } }}
    >
      <Heading size="sm">SPR Sample Status Plugin</Heading>
      <Button onPress={onPress}>
        <ButtonText>Check Status</ButtonText>
      </Button>
      <Text>{result}</Text>
    </VStack>
  )
}

export default Status
