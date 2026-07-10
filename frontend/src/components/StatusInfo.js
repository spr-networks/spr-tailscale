import React, { useState } from 'react'
import {
  Badge,
  BadgeText,
  Box,
  Card,
  HStack,
  Heading,
  Icon,
  InfoIcon,
  KeyVal,
  Pressable,
  StatTile,
  StatusDot,
  Text,
  VStack,
  timeAgo
} from '@spr-networks/plugin-ui'

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

        {/* Daemon health warnings — surfaces the real login error, e.g.
            "last login error=invalid key: API key ... not valid" */}
        {!running && status.Health?.length > 0 && (
          <Box
            borderRadius="$lg"
            borderWidth={1}
            borderColor="$amber300"
            bg="$amber50"
            p="$3"
            sx={{ _dark: { bg: 'rgba(245,158,11,0.10)', borderColor: '$amber700' } }}
          >
            <VStack space="xs">
              {status.Health.map((msg, index) => (
                <Text key={index} size="sm" color="$amber800" sx={{ _dark: { color: '$amber300' } }}>
                  {msg}
                </Text>
              ))}
            </VStack>
          </Box>
        )}

        {/* Metric grid */}
        <HStack space="sm" flexWrap="wrap">
          <StatTile label="Tailscale IP" value={primaryIP} mono />
          <StatTile label="Version" value={status.Version ? String(status.Version).split('-')[0] : null} />
          <StatTile label="Relay" value={self.Relay ? self.Relay.toUpperCase() : null} />
          <StatTile label="Last handshake" value={timeAgo(self.LastHandshake)} />
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

export default StatusInfo
