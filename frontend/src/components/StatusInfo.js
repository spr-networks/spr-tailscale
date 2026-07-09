import React, { useState } from 'react'
import {
  Badge,
  BadgeText,
  Box,
  HStack,
  Heading,
  Icon,
  InfoIcon,
  Pressable,
  Text,
  VStack
} from '@gluestack-ui/themed'

import { Card, StatusDot, StatTile, KeyVal } from './ui'

const StatusInfo = ({ status }) => {
  const [expanded, setExpanded] = useState(false)
  const self = status.Self || {}
  const online = self.Online === true
  const running = status.BackendState === 'Running'
  const primaryIP = self.TailscaleIPs ? self.TailscaleIPs[0] : null

  return (
    <Card>
      <VStack space="lg">
        {/* Hero row: identity + live state */}
        <HStack space="md" alignItems="center" justifyContent="space-between" flexWrap="wrap">
          <HStack space="md" alignItems="center" flexShrink={1}>
            <StatusDot online={online} warn={!online && running} size={12} />
            <VStack>
              <Heading size="md" color="$textLight900" sx={{ _dark: { color: '$textDark50' } }}>
                {self.HostName || 'This node'}
              </Heading>
              <Text size="sm" color="$muted500">
                {self.DNSName ? self.DNSName.replace(/\.$/, '') : 'Tailscale gateway'}
              </Text>
            </VStack>
          </HStack>

          <HStack space="sm" alignItems="center">
            <Badge action={running ? 'success' : 'warning'} variant="solid" borderRadius="$full">
              <BadgeText>{status.BackendState || 'Unknown'}</BadgeText>
            </Badge>
            <Badge action={online ? 'success' : 'muted'} variant="outline" borderRadius="$full">
              <BadgeText>{online ? 'Online' : 'Offline'}</BadgeText>
            </Badge>
          </HStack>
        </HStack>

        {/* Metric grid */}
        <HStack space="sm" flexWrap="wrap">
          <StatTile label="Tailscale IP" value={primaryIP} mono />
          <StatTile label="Version" value={status.Version ? String(status.Version).split('-')[0] : null} />
          <StatTile label="Relay" value={self.Relay ? self.Relay.toUpperCase() : null} />
          <StatTile label="Last handshake" value={self.LastHandshake ? timeAgo(self.LastHandshake) : 'Direct'} />
        </HStack>

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
            pt="$4"
            sx={{ _dark: { borderColor: '$borderColorCardDark' } }}
          >
            <VStack space="sm">
              <KeyVal label="Backend state" value={status.BackendState} />
              <KeyVal label="Full version" value={status.Version} />
              <KeyVal label="Public key" value={self.PublicKey} mono />
              <KeyVal label="DNS name" value={self.DNSName} mono />
              <KeyVal
                label="Tailscale IPs"
                value={self.TailscaleIPs ? self.TailscaleIPs.join(', ') : null}
                mono
              />
              <KeyVal
                label="Endpoints"
                value={self.Addrs ? self.Addrs.join(', ') : null}
                mono
              />
            </VStack>
          </Box>
        )}
      </VStack>
    </Card>
  )
}

// Best-effort humanizer; Tailscale timestamps are RFC3339 strings.
const timeAgo = (ts) => {
  const then = Date.parse(ts)
  if (Number.isNaN(then)) return String(ts)
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (secs < 60) return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

export default StatusInfo
