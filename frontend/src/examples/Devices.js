import React, { useState } from 'react'

import {
  Button,
  ButtonText,
  HStack,
  Heading,
  Text,
  VStack
} from '@gluestack-ui/themed'
import { api } from '../API'

const Devices = () => {
  const [devices, setDevices] = useState([])

  const onPress = () => {
    api
      .get('/devices')
      .then((res) => {
        setDevices(Object.values(res))
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
      <Heading size="sm">SPR Device List</Heading>
      <Button onPress={onPress}>
        <ButtonText>Get Devices</ButtonText>
      </Button>
      <VStack space="sm" maxWidth={300}>
        {devices.map((device) => (
          <HStack key={device.MAC} space="md">
            <Text flex="1" bold>
              {device.RecentIP}
            </Text>
            <Text flex="1">{device.Name}</Text>
          </HStack>
        ))}
      </VStack>
    </VStack>
  )
}

export default Devices
