import React from 'react'
import {
  Badge,
  BadgeText,
  Box,
  HStack,
  Heading,
  Pressable,
  Text,
  VStack
} from '@gluestack-ui/themed'

// Shared design primitives — a small, Unifi-flavored system built on SPR's
// gluestack tokens (backgroundCard*, borderColorCard*, primary = blueGray).

export const Card = ({ children, p = '$5', ...props }) => (
  <Box
    bg="$backgroundCardLight"
    borderColor="$borderColorCardLight"
    borderWidth={1}
    borderRadius="$xl"
    p={p}
    sx={{
      '@base': { shadowColor: '$black', shadowOpacity: 0.04, shadowRadius: 12 },
      _dark: { bg: '$backgroundCardDark', borderColor: '$borderColorCardDark' }
    }}
    {...props}
  >
    {children}
  </Box>
)

// A soft status ring + solid core. Green when online, muted/amber otherwise.
export const StatusDot = ({ online, warn = false, size = 10 }) => {
  const core = online ? '$green500' : warn ? '$amber500' : '$muted400'
  const ring = online ? 'rgba(34,197,94,0.20)' : warn ? 'rgba(245,158,11,0.20)' : 'rgba(163,163,163,0.20)'
  return (
    <Box
      w={size + 8}
      h={size + 8}
      borderRadius="$full"
      alignItems="center"
      justifyContent="center"
      sx={{ '@base': { backgroundColor: ring } }}
    >
      <Box w={size} h={size} borderRadius="$full" bg={core} />
    </Box>
  )
}

// Compact metric cell used in a wrapping grid inside cards.
export const StatTile = ({ label, value, mono = false }) => (
  <VStack
    space="xs"
    py="$2"
    px="$3"
    borderRadius="$lg"
    minWidth={140}
    flexGrow={1}
    flexBasis={140}
    bg="$backgroundContentLight"
    sx={{ _dark: { bg: '$backgroundContentDark' } }}
  >
    <Text
      size="2xs"
      color="$muted500"
      fontWeight="$medium"
      sx={{ '@base': { letterSpacing: 0.6, textTransform: 'uppercase' } }}
    >
      {label}
    </Text>
    <Text
      size="sm"
      fontWeight="$semibold"
      color="$textLight900"
      sx={{
        _dark: { color: '$textDark50' },
        '@base': mono ? { fontFamily: 'monospace' } : {}
      }}
    >
      {value ?? '—'}
    </Text>
  </VStack>
)

export const SectionHeader = ({ title, count, right }) => (
  <HStack alignItems="center" justifyContent="space-between" mb="$3" mt="$2">
    <HStack alignItems="center" space="sm">
      <Heading size="sm" color="$textLight900" sx={{ _dark: { color: '$textDark50' } }}>
        {title}
      </Heading>
      {count != null && (
        <Badge action="muted" variant="solid" borderRadius="$full">
          <BadgeText>{count}</BadgeText>
        </Badge>
      )}
    </HStack>
    {right}
  </HStack>
)

// Self-contained pill toggle (avoids depending on gluestack Switch semantics).
export const Toggle = ({ value, onPress, disabled = false }) => (
  <Pressable onPress={disabled ? undefined : onPress} opacity={disabled ? 0.5 : 1}>
    <Box
      w={46}
      h={26}
      borderRadius="$full"
      p={3}
      justifyContent="center"
      bg={value ? '$primary600' : '$muted300'}
      sx={{ _dark: { bg: value ? '$primary500' : '$muted700' } }}
    >
      <Box w={20} h={20} borderRadius="$full" bg="$white" ml={value ? 20 : 0} />
    </Box>
  </Pressable>
)

// Humanize an RFC3339 timestamp, returning null for anything that isn't a real
// time — empty, unparseable, or Go's zero value (0001-01-01T00:00:00Z), which
// Tailscale uses for "never handshaked". Callers render null as an em dash.
export const timeAgo = (ts) => {
  if (!ts) return null
  const then = Date.parse(ts)
  if (Number.isNaN(then)) return null
  const secs = Math.floor((Date.now() - then) / 1000)
  if (secs < 0) return 'just now' // clock skew / future stamp
  if (secs > 60 * 60 * 24 * 3650) return null // >~10y ago → treat as never
  if (secs < 60) return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

export const KeyVal = ({ label, value, mono = false }) => (
  <HStack space="sm" alignItems="flex-start" flexWrap="wrap">
    <Text size="sm" color="$muted500" minWidth={110}>
      {label}
    </Text>
    <Text
      size="sm"
      color="$textLight900"
      flexShrink={1}
      sx={{ _dark: { color: '$textDark100' }, '@base': mono ? { fontFamily: 'monospace' } : {} }}
    >
      {value ?? '—'}
    </Text>
  </HStack>
)
