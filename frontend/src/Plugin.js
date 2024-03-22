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
  TrashIcon,
  Heading,
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
  const [details, setDetails] = useState(false)
  const handleToggleDetails = (event) => {
    setDetails((prevDetails) => !prevDetails)
  };

  return (
    <Box borderWidth={1} borderRadius="md" p={4} mb={4}>
      <Heading size="lg">SPR Node Details</Heading>
      <VStack alignItems="flex-start" spacing={2}>
        <HStack>
          <Text fontWeight="bold">Backend State:</Text>
          <Text>{status.BackendState}</Text>
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
          <Badge size="lg" action={status.Self.Online ? "success" : "warning"}>
            <BadgeText size="lg">{status.Self.Online ? "Online" : "Offline"}</BadgeText>
          </Badge>
        </HStack>
        {details ? (
          <>
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
            <Text fontWeight="bold">Addresses:</Text>
              <VStack alignItems="flex-start">
                {status.Self.Addrs.map((addr, index) => (
                  <Text key={index}>{addr}</Text>
                ))}
              </VStack>)
          </HStack>
          <HStack>
            <Text fontWeight="bold">Relay:</Text>
            <Text>{status.Self.Relay}</Text>
          </HStack>
          <HStack>
            <Text fontWeight="bold">Last Handshake:</Text>
            <Text>{status.Self.LastHandshake}</Text>
          </HStack>
          </>)
          : null }
        <Button action="primary" size="sm" onPress={handleToggleDetails}>
          <ButtonText> {details ? "Hide Details" :  "Show Details"}</ButtonText>
        </Button>
      </VStack>
    </Box>
  );
};


const defaultGroup = 'tailnet'

const PeerInfo = ({ configGroups, showAlert, device }) => {
  const [policies, setPolicies] = useState([]);
  const [groups, setGroups] = useState(configGroups);
  const [tags, setTags] = useState([]);

  const [details, setDetails] = useState(false)

  const [groupInput, setGroupInput] = useState("");

  const handleInputChange = (event) => {
    setGroupInput(event.target.value.toLowerCase().trim());
  };

  const handleToggleDetails = (event) => {
    setDetails((prevDetails) => !prevDetails)
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
    <Box borderWidth={1} borderRadius="md" p={4} mb={4}>
      <VStack alignItems="flex-start" spacing={2}>
        <HStack>
          <Text fontWeight="bold">DNS Name:</Text>
          <Text>{device.DNSName}</Text>
        </HStack>
        <HStack>
          <Text fontWeight="bold">Status:</Text>
          <Badge action={device.Online ? "success" : "warning"}>
            <BadgeText>{device.Online ? "Online" : "Offline"}</BadgeText>
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
        {details ? (
          <>
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
          </>
        ) : null }
        <Button action="primary" size="sm" onPress={handleToggleDetails}>
          <ButtonText> {details ? "Hide Details" :  "Show Details"}</ButtonText>
        </Button>
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
            size="sm"
          >
          <InputField
            placeholder="Add group..."
            value={groupInput}
            onChange={handleInputChange}
          />
          </Input>
          <Button size="sm" onPress={handleAddGroup}>
            <ButtonText>Add</ButtonText>
          </Button>
        </HStack>
      </VStack>
    </Box>
  );
};

const PeerList = ({ showAlert, devices, config }) => {


  const getGroups = (config, device) => {
    for (let peer of config.Peers) {
      if (peer.IP == device.TailscaleIPs[0]) {
        let groups = peer.Groups
        if (!groups.includes('tailnet')) {
          groups = ['tailnet'].concat(groups)
        }
        return groups
      }
    }
    return ['tailnet']
  }

  return (
    <Box>
      {Object.values(devices).map((device, index) => (
        <PeerInfo configGroups={getGroups(config, device)} showAlert={showAlert} key={index} device={device} />
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
  const [tailscaleConfig, setTailscaleConfig] = useState({})

  const showAlert = (title, message) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setShowAlertDialog(true);
  };

  const getConfig = (callback) => {
    api
      .get('/plugins/spr-tailscale/config')
      .then((res) => {
        let result = JSON.parse(res)
        callback(result)
      })
      .catch(async (err) => {
        if (err.response) {
          let msg = await err.response.text() // setup already done
          showAlert('Error', `Could not retrieve configuration: ${msg}.`);
        } else {
          showAlert('Error', `Failed to fetch tailscale config`)
        }
      })
  }

  useEffect(() => {
    getConfig((result) => {
      if (result.TailscaleAuthKey) {
        setTailscaleAuthKey(result.TailscaleAuthKey)
        setTailscaleConfig(result)
        setConfigured(true)
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
          { tailscaleStatus.Self != null ?
            (
              <>
              <Heading size="md">Tailscale Node</Heading>
              <StatusInfo status={tailscaleStatus} />
              </>
            )
            : <Text> Could not get tailscale status </Text>
          }
          <Heading size="md">Tailscale Peers</Heading>
          <PeerList config={tailscaleConfig} showAlert={showAlert} devices={tailscalePeers}/>
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
