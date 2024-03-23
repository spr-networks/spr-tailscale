import React, { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogCloseButton,
  AlertDialogFooter,
  AlertDialogBody,
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
  Heading
 } from '@gluestack-ui/themed';

import { api } from './API'

import StatusInfo from './components/StatusInfo'
import PeerInfo from './components/PeerInfo'

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
        <PeerInfo key={"peer-" + index} configGroups={getGroups(config, device)} showAlert={showAlert} key={index} device={device} />
      ))}
    </Box>
  );
};


const SPRTailscale = () => {
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
      bg="white"
      sx={{ _dark: { bg: '$backgroundContentDark' } }}
    >
      {configured ?
        <VStack my="$4">
          { tailscaleStatus.Self != null ?
            (
              <>
              <Heading my="$4" size="md">Tailscale Node</Heading>
              <StatusInfo status={tailscaleStatus} />
              </>
            )
            : <Text> Could not get tailscale status </Text>
          }
          <Heading my="$4" size="md">Tailscale Peers</Heading>
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

export default SPRTailscale;
