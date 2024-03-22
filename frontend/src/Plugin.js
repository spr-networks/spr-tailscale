import React, { useState, useEffect } from 'react';
import {
  Badge,
  Box,
  Button,
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
  useDisclosure
 } from '@gluestack-ui/themed';

import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogCloseButton,
  AlertDialogFooter,
  AlertDialogBody,
} from "@gluestack-ui/themed";

import { api } from './API'

const StatusInfo = ({ status }) => {
  return (
    <Box borderWidth={1} borderRadius="md" p={4} mb={4}>
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
          <Text fontWeight="bold">DNS Name:</Text>
          <Text>{status.Self.DNSName}</Text>
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
        <HStack>
          <Text fontWeight="bold">Online:</Text>
          <Badge colorScheme={status.Self.Online ? "green" : "red"}>
            {status.Self.Online ? "Online" : "Offline"}
          </Badge>
        </HStack>
      </VStack>
    </Box>
  );
};


const PeerInfo = ({ device }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [policies, setPolicies] = useState([]);
  const [groups, setGroups] = useState([]);
  const [tags, setTags] = useState([]);

  const handleInputChange = (setter) => (event) => {
    const input = event.target.value;
    if (input.endsWith(",")) {
      const value = input.slice(0, -1).trim();
      if (value) {
        setter((prevValues) => [...prevValues, value]);
      }
      event.target.value = "";
    }
  };

  const handleDeleteItem = (setter) => (index) => {
    setter((prevValues) => prevValues.filter((_, i) => i !== index));
  };
  return (
    <Box borderWidth={1} borderRadius="md" p={4} mb={4}>
      <Button onClick={() => setIsModalOpen(true)}>Configure</Button>

      <VStack alignItems="flex-start" spacing={2}>
        <HStack>
          <Text fontWeight="bold">DNS Name:</Text>
          <Text>{device.DNSName}</Text>
        </HStack>
        <HStack>
          <Text fontWeight="bold">Online Status:</Text>
          <Badge colorScheme={device.Online ? "green" : "red"}>
            {device.Online ? "Online" : "Offline"}
          </Badge>
        </HStack>
        <HStack>
          <Text fontWeight="bold">IP Addresses:</Text>
          <VStack alignItems="flex-start">
            {device.TailscaleIPs.map((ip, index) => (
              <Text key={index}>{ip}</Text>
            ))}
          </VStack>
        </HStack>
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
    </Box>
  );
};

const PeerList = ({ devices }) => {
  return (
    <Box>
      {Object.values(devices).map((device, index) => (
        <PeerInfo key={index} device={device} />
      ))}
    </Box>
  );
};



const SPRTailscaleSetup = () => {
  const [tailscaleAuthKey, setTailscaleAuthKey] = useState('');
  const [configured, setConfigured] = useState(false)
  const [showAlertDialog, setShowAlertDialog] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');

  const [tailscalePeers, setTailscalePeers] = useState([]);
  const [tailscaleStatus, setTailscaleStatus] = useState([]);

  const showAlert = (title, message) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setShowAlertDialog(true);
  };


  useEffect(() => {
    api
      .get('/plugins/spr-tailscale/config')
      .then((res) => {
        let result = JSON.parse(res)
        if (result.TailscaleAuthKey) {
          setTailscaleAuthKey(result.TailscaleAuthKey)
          setConfigured(true)
        }
      })
      .catch(async (err) => {
        if (err.response) {
          let msg = await err.response.text() // setup already done
          showAlert('Error', `Could not retrieve configuration: ${msg}.`);
        } else {
          showAlert('Error', `Failed to fetch tailscale config`)
        }
      })


      api
        .get('/plugins/spr-tailscale/peers')
        .then((res) => {
          let result = JSON.parse(res)
          if (result) {
            setTailscalePeers(result)
          }
        })
        .catch(async (err) => {
          if (err.response) {
            let msg = await err.response.text()
            showAlert('Error', `Could not retrieve tasilscale peers: ${msg}.`);
          } else {
            showAlert('Error', `Failed to fetch tailscale peers`)
          }
        })

        api
          .get('/plugins/spr-tailscale/status')
          .then((res) => {
            let result = JSON.parse(res)
            if (result) {
              setTailscaleStatus(result)
            }
          })
          .catch(async (err) => {
            if (err.response) {
              let msg = await err.response.text()
              showAlert('Error', `Could not retrieve tasilscale status: ${msg}.`);
            } else {
              showAlert('Error', `Failed to fetch tailscale status`)
            }
          })

  }, [])

  const handleSetup = async () => {
    if (!tailscaleAuthKey) {
      showAlert('Error', 'Need Tailscale auth key, generate one with Tailscale on https://login.tailscale.com/admin/settings/keys');
      return;
    }

    // Send setup parameters to the API
    api
      .put('/plugins/spr-tailscale/config', {
        TailScaleAuthKey: tailscaleAuthKey
      })
      .then((res) => {
        showAlert('Success', 'Setup completed successfully!');
        setConfigured(true)
      })
      .catch(err => {
        alert(err.message)
        showAlert('Error', 'An error occurred during setup. Please try again.');
      })
  };

  return (
    <View
      h="$full"
      bg="$backgroundContentLight"
      sx={{ _dark: { bg: '$backgroundContentDark' } }}
    >
      {configured ?
        <VStack>
          { tailscaleStatus != null ?
            <StatusInfo status={tailscaleStatus} />
            : <Text> Could not get tailscale status </Text>
          }
          <Text> Peers: </Text>
          <PeerList devices={tailscalePeers}/>
        </VStack>
          :
      (
        <VStack>
          <Text> Configure Tailscale: </Text>
          <Text>Please enter your TAILSCALE_AUTH_KEY:</Text>
          <Input size="md">
            <InputField
              value={tailscaleAuthKey}
              onChangeText={(value) => setTailscaleAuthKey(value)}
              onSubmitEditing={(value) => setTailscaleAuthKey(value)}
            />
          </Input>
          <Button onPress={handleSetup}>
            <ButtonText>Set Up</ButtonText>
          </Button>
        </VStack>
      )}
      <AlertDialog isOpen={showAlertDialog} onClose={() => setShowAlertDialog(false)}>
        <AlertDialogBackdrop />
        <AlertDialogContent>
          <AlertDialogHeader>
            <Text>{alertTitle}</Text>
            <AlertDialogCloseButton onPress={() => setShowAlertDialog(false)} />
          </AlertDialogHeader>
          <AlertDialogBody>
            <Text>{alertMessage}</Text>
          </AlertDialogBody>
          <AlertDialogFooter>
            <Button onPress={() => setShowAlertDialog(false)}>
              <ButtonText>OK</ButtonText>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
};

export default SPRTailscaleSetup;
