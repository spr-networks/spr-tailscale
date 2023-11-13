#!/bin/bash
set -ax

if [ "$ENABLE_TAILSCALE" != "true" ]; then
  exit
fi

if [ "$DEBUG" = "true" ]; then
  DEBUG_CMD="/dlv --listen=:2345 --headless=true --api-version=2 exec"
fi

TAILSCALE_STATE_DIR=/state/plugins/tailscale/tailscaled
mkdir -p $TAILSCALE_STATE_DIR

tailscaled & >$TAILSCALE_STATE_DIR/stdout.log 2>$TAILSCALE_STATE_DIR/stderr.log

. /scripts/up.sh

$DEBUG_CMD /tailscale_plugin
