import React, { useState, useEffect } from 'react';
import {
  Button,
  ButtonText,
  Input, InputField,
  Text,
  VStack,
  View
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

const SPRTailscaleSetup = () => {
  const [tailscaleAuthKey, setTailscaleAuthKey] = useState('');
  const [configured, setConfigured] = useState(false)
  const [showAlertDialog, setShowAlertDialog] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');

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
        let msg = await err.response.text() // setup already done
        showAlert('Error', `Could not retrieve configuration: ${msg}.`);
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
        <Text> Tailscale Configured </Text>
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
