import React, { useState, useEffect } from 'react'
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
  ButtonText,
  Card,
  CloseIcon,
  Heading,
  HStack,
  Icon,
  Input,
  InputField,
  Pressable,
  SectionHeader,
  Text,
  Toggle,
  VStack,
  View
} from '@spr-networks/plugin-ui'

import { api } from './API'

import StatusInfo from './components/StatusInfo'
import PeerInfo from './components/PeerInfo'

const KEYS_URL = 'https://login.tailscale.com/admin/settings/keys'

const PeerList = ({ showAlert, devices, config }) => {
  const getGroups = (config, device) => {
    if (!config.Peers) {
      return ['tailnet']
    }
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

  const getPolicies = (config, device) => {
    if (!config.Peers) {
      return []
    }
    for (let peer of config.Peers) {
      if (peer.IP == device.TailscaleIPs[0]) {
        let policies = peer.Policies
        if (policies == null) {
          return []
        }
        return policies
      }
    }
    return []
  }

  return (
    <VStack space="md">
      {Object.values(devices).map((device, index) => (
        <PeerInfo
          key={index}
          configPolicies={getPolicies(config, device)}
          configGroups={getGroups(config, device)}
          showAlert={showAlert}
          device={device}
        />
      ))}
    </VStack>
  )
}

// App logomark + title bar.
const Header = ({ statusLabel, statusAction }) => (
  <HStack alignItems="center" justifyContent="space-between" flexWrap="wrap" mb="$2">
    <HStack space="md" alignItems="center">
      <Box
        w={44}
        h={44}
        borderRadius="$xl"
        alignItems="center"
        justifyContent="center"
        bg="$primary600"
        sx={{ _dark: { bg: '$primary500' } }}
      >
        <Heading size="sm" color="$white">
          ts
        </Heading>
      </Box>
      <VStack>
        <Heading size="lg" color="$textLight900" sx={{ _dark: { color: '$textDark50' } }}>
          Tailscale
        </Heading>
        <Text size="sm" color="$muted500">
          Mesh VPN · SPR
        </Text>
      </VStack>
    </HStack>
    {statusLabel && (
      <Badge action={statusAction} variant="outline" borderRadius="$full" size="md">
        <BadgeText>{statusLabel}</BadgeText>
      </Badge>
    )}
  </HStack>
)

const SPRTailscale = () => {
  const [tailscaleAuthKey, setTailscaleAuthKey] = useState('')
  const [configured, setConfigured] = useState(false)
  const [showAlertDialog, setShowAlertDialog] = useState(false)
  const [alertTitle, setAlertTitle] = useState('')
  const [alertMessage, setAlertMessage] = useState('')

  const [tailscalePeers, setTailscalePeers] = useState([])
  const [tailscaleStatus, setTailscaleStatus] = useState([])
  const [tailscaleConfig, setTailscaleConfig] = useState({})
  const [exitNode, setExitNode] = useState(false)

  const showAlert = (title, message) => {
    setAlertTitle(title)
    setAlertMessage(message)
    setShowAlertDialog(true)
  }

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
          showAlert('Error', `Could not retrieve configuration: ${msg}.`)
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
          showAlert('Error', `Could not retrieve tailscale peers: ${msg}.`)
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
          showAlert('Error', `Could not retrieve tailscale status: ${msg}.`)
        } else {
          showAlert('Error', `Failed to fetch tailscale status`)
        }
      })
  }, [])

  const getTailscaleContainerIP = (matchName, callback) => {
    api
      .get('/info/dockernetworks')
      .then((docker) => {
        let networked = docker.filter(
          (n) => n.Options && n.Options['com.docker.network.bridge.name']
        )

        for (let n of networked) {
          let iface = n.Options['com.docker.network.bridge.name']
          if (n.IPAM?.Config?.[0]?.Subnet) {
            if (iface == matchName) {
              callback(n.IPAM.Config[0].Subnet)
            }
          }
        }
      })
      .catch((err) => {})
  }

  const setCustomInterface = (done) => {
    getTailscaleContainerIP('spr-tailscale', (subnet) => {
      //hack
      let [ipAddress] = subnet.split('/')
      let octets = ipAddress.split('.')
      octets[3] = '2'
      let containerIP = octets.join('.')

      let crule = {
        RuleName: 'spr-tailscale-api-access',
        Disabled: false,
        SrcIP: containerIP,
        Interface: 'spr-tailscale',
        Policies: ['wan', 'dns', 'api'],
        Groups: [],
        Tags: []
      }

      api
        .put('/firewall/custom_interface', crule)
        .then(done)
        .catch(async (err) => {
          let msg = ''
          if (err.response) {
            msg = await err.response.text() // setup already done
          }
          if (!msg.includes('Duplicate rule')) {
            showAlert('Error', `Failed to set custom firewall rule ${msg}.`)
          } else {
            done()
          }
        })
    })
  }

  const handleReset = async () => {
    setTailscaleAuthKey('')
    setConfigured(false)
  }

  const toggleExitNode = () => {
    setExitNode((prev) => !prev)
    //call setup again now
    handleSetup()
  }

  const handleSetup = async () => {
    if (!tailscaleAuthKey) {
      showAlert(
        'Error',
        'Need Tailscale auth key, generate one with Tailscale on https://login.tailscale.com/admin/settings/keys'
      )
      return
    }

    // Send setup parameters to the API
    api
      .put('/plugins/spr-tailscale/config', {
        TailScaleAuthKey: tailscaleAuthKey.trim(),
        AdvertiseExitNode: exitNode
      })
      .then((res) => {
        setCustomInterface(() => {
          api
            .put('/plugins/spr-tailscale/up', {})
            .then((res) => {
              let result = {}
              try {
                result = typeof res === 'string' ? JSON.parse(res) : res
              } catch (e) {}

              if (result.Success === false) {
                // surface the real control-plane error, e.g.
                // "invalid key: API key kpP6QX4mZ921CNTRL not valid"
                let detail = result.Args?.Detail ? `\n\n${result.Args.Detail}` : ''
                showAlert('Tailscale Login Failed', `${result.Message}${detail}`)
                return
              }

              showAlert('Success', 'Setup completed successfully!')
              setConfigured(true)
            })
            .catch(async (err) => {
              let msg = ''
              if (err.response) {
                msg = await err.response.text()
              }
              showAlert('Error', `Failed to bring tailscale up. ${msg}`)
            })
        })
      })
      .catch(async (err) => {
        let msg = ''
        if (err.response) {
          msg = await err.response.text()
        }
        showAlert('Error', msg || 'An error occurred during setup. Please try again.')
      })
  }

  const self = tailscaleStatus.Self
  const online = self && self.Online === true
  const running = tailscaleStatus.BackendState === 'Running'

  let headerLabel = 'Not configured'
  let headerAction = 'muted'
  if (configured) {
    if (online) {
      headerLabel = 'Connected'
      headerAction = 'success'
    } else {
      headerLabel = 'Offline'
      headerAction = 'warning'
    }
  }

  return (
    <View
      minHeight="$full"
      bg="$backgroundContentLight"
      sx={{ _dark: { bg: '$backgroundContentDark' } }}
      px="$4"
      py="$6"
    >
      <VStack w="$full" space="lg" sx={{ '@base': { maxWidth: 860, marginLeft: 'auto', marginRight: 'auto' } }}>
        <Header statusLabel={headerLabel} statusAction={headerAction} />

        {configured ? (
          <>
            {self != null ? (
              <VStack space="sm">
                <SectionHeader title="Node" />
                <StatusInfo status={tailscaleStatus} />

                {online ? (
                  <Card p="$4">
                    <HStack alignItems="center" justifyContent="space-between" space="md">
                      <VStack flexShrink={1}>
                        <Text
                          size="md"
                          fontWeight="$semibold"
                          color="$textLight900"
                          sx={{ _dark: { color: '$textDark50' } }}
                        >
                          Exit node
                        </Text>
                        <Text size="sm" color="$muted500">
                          Advertise this router as a Tailscale exit node for your tailnet.
                        </Text>
                      </VStack>
                      <Toggle value={exitNode} onPress={toggleExitNode} />
                    </HStack>
                  </Card>
                ) : (
                  <Card p="$4">
                    <VStack space="md">
                      <Text size="sm" color="$muted500">
                        The node is registered but not online yet. Re-run setup or reset the auth
                        key to start over.
                      </Text>
                      <HStack space="sm" flexWrap="wrap">
                        <Button action="primary" onPress={handleSetup}>
                          <ButtonText>Install Tailscale Interface</ButtonText>
                        </Button>
                        <Button action="secondary" variant="outline" onPress={handleReset}>
                          <ButtonText>Reset Auth Key</ButtonText>
                        </Button>
                      </HStack>
                    </VStack>
                  </Card>
                )}
              </VStack>
            ) : (
              <Card>
                <Text color="$muted500">Could not get Tailscale status.</Text>
              </Card>
            )}

            <VStack space="sm">
              <SectionHeader title="Peers" count={Object.values(tailscalePeers).length} />
              {Object.values(tailscalePeers).length > 0 ? (
                <PeerList config={tailscaleConfig} showAlert={showAlert} devices={tailscalePeers} />
              ) : (
                <Card>
                  <Text color="$muted500">
                    No peers yet. Devices that join your tailnet will appear here.
                  </Text>
                </Card>
              )}
            </VStack>
          </>
        ) : (
          <Card p="$6">
            <VStack space="lg">
              <VStack space="xs">
                <Heading size="md" color="$textLight900" sx={{ _dark: { color: '$textDark50' } }}>
                  Connect to Tailscale
                </Heading>
                <Text size="sm" color="$muted500">
                  Paste an auth key to join this router to your tailnet.
                </Text>
              </VStack>

              <VStack space="xs">
                <Text
                  size="2xs"
                  color="$muted500"
                  fontWeight="$medium"
                  sx={{ '@base': { letterSpacing: 0.6, textTransform: 'uppercase' } }}
                >
                  Tailscale auth key
                </Text>
                <Input size="md" variant="outline">
                  <InputField
                    placeholder="tskey-auth-..."
                    type="password"
                    value={tailscaleAuthKey}
                    onChangeText={(value) => setTailscaleAuthKey(value.trim())}
                    onSubmitEditing={handleSetup}
                  />
                </Input>
                <Pressable onPress={() => window.open(KEYS_URL, '_blank')}>
                  <Text size="xs" color="$primary600" sx={{ _dark: { color: '$primary400' } }}>
                    Generate one in the Tailscale admin console →
                  </Text>
                </Pressable>
              </VStack>

              <Button action="primary" onPress={handleSetup}>
                <ButtonText>Set up</ButtonText>
              </Button>
            </VStack>
          </Card>
        )}
      </VStack>

      <AlertDialog isOpen={showAlertDialog} onClose={() => setShowAlertDialog(false)}>
        <AlertDialogBackdrop />
        <AlertDialogContent>
          <AlertDialogHeader>
            <Heading size="sm">{alertTitle}</Heading>
            <AlertDialogCloseButton onPress={() => setShowAlertDialog(false)}>
              <Icon as={CloseIcon} />
            </AlertDialogCloseButton>
          </AlertDialogHeader>
          <AlertDialogBody>
            <Text size="sm">{alertMessage}</Text>
          </AlertDialogBody>
          <AlertDialogFooter>
            <Button action="primary" onPress={() => setShowAlertDialog(false)}>
              <ButtonText>OK</ButtonText>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  )
}

export default SPRTailscale
