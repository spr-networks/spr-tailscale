# spr-tailscale

### Setup

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

### TBD

Simplify adding specific tailscale peers to custom groups. To do this currently, update the config.json.
See the  TailscalePeer struct

```
type TailscalePeer struct {
	IP     string
	Groups []string
	Tags   []string //unused for now
}

type Config struct {
	APIToken string
	Peers    []TailscalePeer
}
```
