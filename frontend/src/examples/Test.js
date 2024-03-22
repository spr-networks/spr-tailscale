import React, { useState } from 'react'

import { Button, ButtonText, Heading, Text, VStack } from '@gluestack-ui/themed'
import { api } from '../API'

// api @ /plugins/spr-sample-plugin
// ui  @ /plugins/spr-sample-plugin/ui

const Test = () => {
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const pluginURL = '/plugins/user/spr-sample-plugin'

  const onPress = () => {
    let apiURL = api.getApiURL()
    let gotAuth = api.getAuthHeaders()?.length ? true : false

    console.log('debug', `apiURL=${apiURL}, gotAuth=${gotAuth}`)

    api
      .get(`${pluginURL}/test`)
      .then((res) => {
        setResult(res)
      })
      .catch((err) => {
        console.error(`Error:`, err)
        let error = `Error: ${JSON.stringify(err)}`
        if (!apiURL) {
          error += '. Missing REACT_APP_API'
        }

        if (!gotAuth) {
          error += '. Missing REACT_APP_TOKEN'
        }

        setError(error)
      })
  }

  return (
    <VStack
      p="$4"
      space="md"
      bg="$backgroundCardLight"
      sx={{ _dark: { bg: '$backgroundCardDark' } }}
    >
      <Heading size="sm">SPR Custom API</Heading>
      <Button onPress={onPress}>
        <ButtonText>Get Result</ButtonText>
      </Button>
      <VStack space="sm">
        <Text>{result ? JSON.stringify(result) : null}</Text>
        <Text color="$red600">{error}</Text>
      </VStack>
    </VStack>
  )
}

export default Test
