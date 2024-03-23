import React, { useState } from 'react';
import {
  Badge,
  BadgeText,
  Box,
  Button,
  ButtonText,
  HStack,
  Heading,
  Icon,
  InfoIcon,
  Text,
  Tooltip,
  TooltipContent,
  TooltipText,
  VStack,
} from '@gluestack-ui/themed';

const StatusInfo = ({ status }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const handleToggleTooltip = () => {
    setShowTooltip((prevShowTooltip) => !prevShowTooltip);
  };

  return (
    <Box>
      <VStack flex={2} space="md" mx="$4" sx={{ '@md': { w: '$1/2' } }}>
      <HStack>
          <Text  mr="$1" fontWeight="bold">Host:</Text>
          <Text mr="$4">{status.Self.HostName}</Text>

          <Tooltip
            placement="top"
            isOpen={showTooltip}
            onOpen={handleToggleTooltip}
            onClose={handleToggleTooltip}
            trigger={(triggerProps) => (
              <HStack {...triggerProps}>
                <Icon as={InfoIcon} sz="md" />
              </HStack>
            )}
          >
            <TooltipContent bg="white" color="black" p={4}>
              <VStack alignItems="flex-start" spacing={2}>
                <HStack>
                  <Text fontWeight="bold">Backend State:</Text>
                  <Text>{status.BackendState}</Text>
                </HStack>
                <HStack>
                  <Text fontWeight="bold">Version:</Text>
                  <Text>{status.Version}</Text>
                </HStack>
                <HStack>
                  <Text fontWeight="bold">Public Key:</Text>
                  <Text>{status.Self.PublicKey}</Text>
                </HStack>
                <HStack>
                  <Text fontWeight="bold">Hostname:</Text>
                  <Text>{status.Self.HostName}</Text>
                </HStack>
                <HStack>
                  <Text fontWeight="bold">Tailscale IPs:</Text>
                  <VStack alignItems="flex-start">
                    {status.Self.TailscaleIPs.map((ip, index) => (
                      <Text key={index}>{ip}</Text>
                    ))}
                  </VStack>
                </HStack>
                <HStack>
                  <Text fontWeight="bold">Addresses:</Text>
                  <VStack alignItems="flex-start">
                    {status.Self.Addrs.map((addr, index) => (
                      <Text key={index}>{addr}</Text>
                    ))}
                  </VStack>
                </HStack>
                <HStack>
                  <Text fontWeight="bold">Relay:</Text>
                  <Text>{status.Self.Relay}</Text>
                </HStack>
                <HStack>
                  <Text fontWeight="bold">Last Handshake:</Text>
                  <Text>{status.Self.LastHandshake}</Text>
                </HStack>
              </VStack>
            </TooltipContent>
          </Tooltip>
        </HStack>
        <HStack>
          <Text fontWeight="bold">Tailscale IP:</Text>
          <Text>{status.Self.TailscaleIPs[0]}</Text>
        </HStack>
        <HStack>
          <Badge size="lg" action={status.BackendState == "Running" ? "success" : "warning"}>
            <BadgeText size="lg">{status.BackendState}</BadgeText>
          </Badge>
          <Badge size="lg" action={status.Self.Online ? "success" : "warning"}>
            <BadgeText size="lg">{status.Self.Online ? "Online" : "Offline"}</BadgeText>
          </Badge>
        </HStack>

      </VStack>

    </Box>
  );
};

export default StatusInfo;
