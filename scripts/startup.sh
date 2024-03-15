#!/bin/bash
set -a
. /configs/spr-tailscale/config.sh

#TAILSCALE_STATE_DIR=/state/spr-tailscale/tailscaled
#tailscaled & >$TAILSCALE_STATE_DIR/stdout.log 2>$TAILSCALE_STATE_DIR/stderr.log
#. /scripts/up.sh
###TBD fix this race, see rebuildPostrouting
#sleep 3

# forward from SPR into the tailscale network
#nft add chain ip filter POSTROUTING { type nat hook postrouting priority 100 \; }
#nft add rule ip filter POSTROUTING oif "tailscale0" masquerade

/tailscale_plugin
