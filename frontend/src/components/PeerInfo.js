import React, { useState, useEffect } from 'react';
import {
  Badge,
  BadgeText,
  Box,
  Button,
  ButtonIcon,
  ButtonText,
  HStack,
  Input, InputField,
  Text,
  VStack,
  View,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Checkbox,
  IconButton,
  Icon,
  InfoIcon,
  AddIcon,
  TrashIcon,
  Heading,
  Tooltip,
  TooltipContent,
  TooltipText,
  Divider
} from '@gluestack-ui/themed';

import { api } from '../API'

const defaultGroup = 'tailnet'

const PeerInfo = ({ configGroups, showAlert, device }) => {
  const [policies, setPolicies] = useState([]);
  const [groups, setGroups] = useState(configGroups);
  const [tags, setTags] = useState([]);

  const [groupInput, setGroupInput] = useState("");

  const handleInputChange = (event) => {
    setGroupInput(event.target.value.toLowerCase().trim());
  };

  const handleAddGroup = () => {
    let group = groupInput.toLowerCase().trim()
    if (group == "") {
      return
    }

    if (groups.includes(group)) {
      //already have it, dont dup
      return
    }

    let newGroups = groups.concat(group)
    api.put('/plugins/spr-tailscale/setSPRPeer', {
      IP: device.TailscaleIPs[0],
      NodeKey: device.PublicKey.split(":")[1],
      Groups: newGroups
    }).then((result) => {
      setGroups((prevGroups) => [...prevGroups, group]);
      setGroupInput("");
    }).catch(async (err) => {
      if (err.response) {
        let msg = await err.response.text() // setup already done
        showAlert('Error', `Could not set groups: ${msg}.`);
      } else {
        showAlert('Error', `Failed to fetch tailscale config`)
      }
    })

  };

  const handleDeleteGroup = (index) => {
    if (groups[index] == defaultGroup) {
      return
    }
    let newGroups = groups.filter((_, i) => i !== index)

    //make the API call
    api.put('/plugins/spr-tailscale/setSPRPeer', {
      IP: device.TailscaleIPs[0],
      NodeKey: device.PublicKey.split(":")[1],
      Groups: newGroups
    }).then((result) => {
      setGroups(newGroups);
    }).catch(async (err) => {
      if (err.response) {
        let msg = await err.response.text() // setup already done
        showAlert('Error', `Could not set groups: ${msg}.`);
      } else {
        showAlert('Error', `Failed to fetch tailscale config`)
      }
    })
  };

  return (
    <Box p={4}>
      <VStack flex={2} space="md" mx="$4" sx={{ '@md': { w: '$1/2' } }}>
        <VStack alignItems="flex-start" space="xs">
          <HStack flex={2}>
            <Text mr="$1" fontWeight="bold">Host:</Text>
            <Text mr="$4">{device.HostName}</Text>
            <Tooltip
              placement="bottom"
              trigger={(triggerProps) => (
                <VStack>
                  <HStack {...triggerProps}>
                    <Icon as={InfoIcon} sz="md" />
                  </HStack>
                </VStack>
              )}
            >
              <TooltipContent bg="white">
                <VStack space="xs" p="$2">
                  <HStack>
                    <Text fontWeight="bold">Public Key:</Text>
                    <Text>{device.PublicKey}</Text>
                  </HStack>
                  <HStack>
                    <Text fontWeight="bold">Hostname:</Text>
                    <Text>{device.HostName}</Text>
                  </HStack>
                  <HStack>
                    <Text fontWeight="bold">OS:</Text>
                    <Text>{device.OS}</Text>
                  </HStack>
                  <HStack>
                    <Text fontWeight="bold">Last Seen:</Text>
                    <Text>{device.LastSeen}</Text>
                  </HStack>
                  <HStack>
                    <Text fontWeight="bold">Last Handshake:</Text>
                    <Text>{device.LastHandshake}</Text>
                  </HStack>
                </VStack>
              </TooltipContent>
            </Tooltip>
          </HStack>
          <HStack>
            <Text fontWeight="bold">Status:</Text>
            <Badge action={device.Online ? "success" : "warning"}>
              <BadgeText>{device.Online ? "Online" : "Offline"}</BadgeText>
            </Badge>
          </HStack>
          <HStack>
            <Text fontWeight="bold">DNS: </Text>
            <Text>{device.DNSName}</Text>
          </HStack>
          <HStack>
            <Text fontWeight="bold">IP Addresses:</Text>
            <VStack alignItems="flex-start">
              {device.TailscaleIPs.map((ip, index) => (
                <Text key={index}>{ip}</Text>
              ))}
            </VStack>
          </HStack>
        </VStack>


        <HStack>
          <Text fontWeight="bold">Groups:</Text>
          <HStack spacing={2}>
            {groups.map((group, index) => (
              <Badge
                key={index}
                borderRadius="full"
                variant="solid"
                colorScheme="blue"
                onClick={() => handleDeleteGroup(index)}
              >
                <BadgeText>{group}</BadgeText>
                {group != defaultGroup ?
                  <ButtonIcon as={TrashIcon} color="$red700" />
                : null }
              </Badge>
            ))}
          </HStack>
        </HStack>
        <HStack>
          <Input
            size="md"
          >
          <InputField
            value={groupInput}
            onChange={handleInputChange}
            onSubmitEditing={handleAddGroup}
          />
          </Input>
          <Button size="sm" onPress={handleAddGroup}>
            <ButtonIcon as={AddIcon} />
          </Button>
        </HStack>
      </VStack>
      <Divider my="$4" />
    </Box>
  );
};

export default PeerInfo;
