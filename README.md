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

To share tailscale access with SPR devices, add them to the 'tailnet' group.
