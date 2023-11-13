package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
)

var TEST_PREFIX = os.Getenv("TEST_PREFIX")

var DevicesPublicConfigFile = TEST_PREFIX + "/state/public/devices-public.json"

type DeviceEntry struct {
	Name       string
	MAC        string
	WGPubKey   string
	VLANTag    string
	RecentIP   string
	PSKEntry   PSKEntry
	Groups     []string
	DeviceTags []string
}

type PSKEntry struct {
	Type string
	Psk  string
}

func APIDevices() (map[string]DeviceEntry, error) {
	devs := map[string]DeviceEntry{}

	data, err := ioutil.ReadFile(DevicesPublicConfigFile)
	if err == nil {
		err = json.Unmarshal(data, &devs)
		if err != nil {
			fmt.Println(err)
			return nil, err
		}
	} else {
		fmt.Println(err)
		return nil, err
	}

	return devs, nil
}

/*

api calls to do:

1) get all devices via APIDevices
  -> get groups

2) get custom interface ro tailcsale, to figure out which groups were in
  use overlaps to find routes to advertise on tailscale.

2) update custom interface with routes of allowed peers

/custom_interface POST
  -> write peers that have SPR access
type CustomInterfaceRule struct {
	Interface string
	SrcIP     string
	Groups    []string
	Tags      []string //unused for now
}



3) sprbus?





func post() {
  req, err := http.NewRequest(http.MethodPut, "http://localhost:80/device?identity="+identity, bytes.NewBuffer(json))
  if err != nil {
    fmt.Println(err)
    return
  }

  FWmtx.RLock()
  token := gFirewallConfig.APIToken
  FWmtx.RUnlock()

  req.Header.Add("Authorization", "Bearer "+token)

  resp, err := cli.Do(req)
  if err != nil {
    fmt.Println("request failed", err)
    return
  }

  defer resp.Body.Close()
}

*/
