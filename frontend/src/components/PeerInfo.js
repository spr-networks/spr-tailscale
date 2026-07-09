import React, { useState } from 'react'
import {
  AddIcon,
  Badge,
  BadgeText,
  Box,
  Button,
  ButtonIcon,
  HStack,
  Icon,
  InfoIcon,
  Input,
  InputField,
  Pressable,
  Text,
  VStack
} from '@gluestack-ui/themed'

import { api } from '../API'
import { Card, StatusDot, KeyVal } from './ui'

const defaultGroup = 'tailnet'

const osLabel = (os) => {
  if (!os) return null
  const map = { linux: 'Linux', macOS: 'macOS', windows: 'Windows', iOS: 'iOS', android: 'Android' }
  return map[os] || os.charAt(0).toUpperCase() + os.slice(1)
}

const timeAgo = (ts) => {
  const then = Date.parse(ts)
  if (Number.isNaN(then)) return ts ? String(ts) : '—'
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (secs < 60) return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

const PeerInfo = ({ configGroups, configPolicies, showAlert, device }) => {
  const [groups, setGroups] = useState(configGroups)
  const [policies, setPolicies] = useState(configPolicies)
  const [groupInput, setGroupInput] = useState('')
  const [expanded, setExpanded] = useState(false)

  const online = device.Online === true
  const primaryIP = device.TailscaleIPs ? device.TailscaleIPs[0] : null

  const handleInputChange = (event) => {
    setGroupInput(event.target.value.toLowerCase().trim())
  }

  const handleAddGroup = () => {
    let group = groupInput.toLowerCase().trim()
    if (group === '') {
      return
    }
    if (groups.includes(group)) {
      return
    }
    let newGroups = [...groups, group]
    api
      .put('/plugins/spr-tailscale/setSPRPeer', {
        IP: device.TailscaleIPs[0],
        NodeKey: device.PublicKey.split(':')[1],
        Groups: newGroups
      })
      .then(() => {
        setGroups(newGroups)
        setGroupInput('')
      })
      .catch(async (err) => {
        if (err.response) {
          let msg = await err.response.text()
          showAlert('Error', `Could not set groups: ${msg}.`)
        } else {
          showAlert('Error', `Failed to fetch tailscale config`)
        }
      })
  }

  const handleDeleteGroup = (index) => {
    if (groups[index] === defaultGroup) {
      return
    }
    let newGroups = groups.filter((_, i) => i !== index)
    api
      .put('/plugins/spr-tailscale/setSPRPeer', {
        IP: device.TailscaleIPs[0],
        NodeKey: device.PublicKey.split(':')[1],
        Groups: newGroups,
        Policies: policies
      })
      .then(() => {
        setGroups(newGroups)
      })
      .catch(async (err) => {
        if (err.response) {
          let msg = await err.response.text()
          showAlert('Error', `Could not set groups: ${msg}.`)
        } else {
          showAlert('Error', `Failed to fetch tailscale config`)
        }
      })
  }

  return (
    <Card p="$4">
      <VStack space="md">
        {/* Header: identity + reachability */}
        <HStack space="md" alignItems="center" justifyContent="space-between" flexWrap="wrap">
          <HStack space="md" alignItems="center" flexShrink={1}>
            <StatusDot online={online} size={10} />
            <VStack flexShrink={1}>
              <HStack space="sm" alignItems="center" flexWrap="wrap">
                <Text
                  size="md"
                  fontWeight="$semibold"
                  color="$textLight900"
                  sx={{ _dark: { color: '$textDark50' } }}
                >
                  {device.HostName}
                </Text>
                {osLabel(device.OS) && (
                  <Badge action="muted" variant="outline" borderRadius="$full" size="sm">
                    <BadgeText>{osLabel(device.OS)}</BadgeText>
                  </Badge>
                )}
              </HStack>
              {primaryIP && (
                <Text size="sm" color="$muted500" sx={{ '@base': { fontFamily: 'monospace' } }}>
                  {primaryIP}
                </Text>
              )}
            </VStack>
          </HStack>

          <Badge action={online ? 'success' : 'muted'} variant="solid" borderRadius="$full">
            <BadgeText>{online ? 'Online' : 'Offline'}</BadgeText>
          </Badge>
        </HStack>

        {/* Access groups */}
        <VStack space="xs">
          <Text size="2xs" color="$muted500" fontWeight="$medium" sx={{ '@base': { letterSpacing: 0.6, textTransform: 'uppercase' } }}>
            Access groups
          </Text>
          <HStack space="sm" flexWrap="wrap" alignItems="center">
            {groups.map((group, index) => {
              const removable = group !== defaultGroup
              return (
                <Pressable key={index} onPress={() => removable && handleDeleteGroup(index)}>
                  <Badge
                    action={group === defaultGroup ? 'info' : 'muted'}
                    variant="solid"
                    borderRadius="$full"
                  >
                    <BadgeText>{group}</BadgeText>
                    {removable && (
                      <Text size="xs" color="$textLight0" ml="$1" sx={{ _dark: { color: '$textDark0' } }}>
                        ✕
                      </Text>
                    )}
                  </Badge>
                </Pressable>
              )
            })}

            <HStack space="xs" alignItems="center">
              <Input size="sm" w={130} variant="rounded">
                <InputField
                  placeholder="add group"
                  value={groupInput}
                  onChange={handleInputChange}
                  onSubmitEditing={handleAddGroup}
                />
              </Input>
              <Button size="sm" action="primary" borderRadius="$full" onPress={handleAddGroup}>
                <ButtonIcon as={AddIcon} />
              </Button>
            </HStack>
          </HStack>
        </VStack>

        {/* Details disclosure */}
        <Pressable onPress={() => setExpanded((v) => !v)}>
          <HStack space="xs" alignItems="center">
            <Icon as={InfoIcon} size="sm" color="$primary600" sx={{ _dark: { color: '$primary400' } }} />
            <Text size="sm" color="$primary600" fontWeight="$medium" sx={{ _dark: { color: '$primary400' } }}>
              {expanded ? 'Hide details' : 'Show details'}
            </Text>
          </HStack>
        </Pressable>

        {expanded && (
          <Box
            borderTopWidth={1}
            borderColor="$borderColorCardLight"
            pt="$3"
            sx={{ _dark: { borderColor: '$borderColorCardDark' } }}
          >
            <VStack space="sm">
              <KeyVal label="DNS name" value={device.DNSName} mono />
              <KeyVal
                label="IP addresses"
                value={device.TailscaleIPs ? device.TailscaleIPs.join(', ') : null}
                mono
              />
              <KeyVal label="Public key" value={device.PublicKey} mono />
              <KeyVal label="Last seen" value={timeAgo(device.LastSeen)} />
              <KeyVal label="Last handshake" value={timeAgo(device.LastHandshake)} />
            </VStack>
          </Box>
        )}
      </VStack>
    </Card>
  )
}

export default PeerInfo
