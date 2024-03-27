# spr-tailscale

<img width="1105" alt="image" src="https://github.com/spr-networks/spr-tailscale/assets/37549748/cbd99b74-c830-41cb-a8ee-754ff6eab65d">

## About 

Integrate TailScale with SPR. It provides connectivity between TailScale and SPR devices using SPR's Microsegmentation.

<img width="1192" alt="image" src="https://github.com/spr-networks/spr-tailscale/assets/37549748/5fc95691-41f2-49f5-ae06-594dd5b41e3c">

## Overview

The plugin runs a container with TailScale for routing between SPR and TailScale peers. It provides connectivity in several ways.

1. Users can now assign SPR Devices to the `tailnet` group to get access to all TailScale peers
2. Assign a TailScale peer to a SPR Group, to give selective access from that peer to the SPR Device. It advertises a route but the firewall only allows a specific IP.
3. Configure the container as an exit node for TailScale. This allows TailScale peers to access the SPR API as well as the internet via the container.

## Technical Details
1. This runs in a container with a custom interface bridge, 'spr-tailscale'
2. The interface bridge is configured in the container firewall rules to have 'api', 'dns', and 'wan' access. By default it does not see other SPR devices
3. Make sure to visit the TailScale UI to accept peer routes also, after configuring a Peer with a custom group. 

### UI Setup

1. Under plugins, add `https://github.com/spr-networks/spr-tailscale`.

2. After the installation has finished, navigate to the bottom of the left hand menu and look for 'spr-tailscale'

3. Generate a [tailscale auth key](https://login.tailscale.com/admin/settings/keys), and copy it into the UI presented

4. All done, now configure TailScale Peers as needed

5. If you want to grant a SPR device to all TailScale peers, add it to the `tailnet` group.


### Command Line Setup

1. go to the SUPER directory under the plugins/ folder and clone this repository

```bash
cd /home/spr/super/plugins/
git clone https://github.com/spr-networks/spr-tailscale
cd spr-tailscale
```

2. Generate an API token in the SPR API (under Auth), and a [tailscale auth key](https://login.tailscale.com/admin/settings/keys)

3. Run the install script
```bash
./install.sh
```

### Usage

To share all tailscale access with SPR devices, add the SPR devices to the 'tailnet' group.


To update custom groups for tailscale peers, edit the config.json in configs/.
See the  TailscalePeer struct

```
type TailscalePeer struct {
	NodeKey  string
	IP       string
	Policies []string
	Groups   []string
	Tags     []string //unused for now
}

type Config struct {
	TailscaleAuthKey  string
	APIToken          string
	AdvertiseExitNode bool
	Peers             []TailscalePeer
}
```

