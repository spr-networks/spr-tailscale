#!/bin/bash
# Command line install alternative to the UI
echo "Please enter your SPR path (/home/spr/super/)"
read -r SUPERDIR

if [ -z "$SUPERDIR" ]; then
    SUPERDIR="/home/spr/super/"
fi

export SUPERDIR

echo "Please enter your SPR API token:"
read -r SPR_API_TOKEN

if [ -z "$SPR_API_TOKEN" ]; then
  echo "need api token, generate one on the auth keys page"
  exit 1
fi

mkdir -p $SUPERDIR/configs/plugins/spr-tailscale

echo SPR_API_TOKEN=$SPR_API_TOKEN > $SUPERDIR/configs/plugins/spr-tailscale/config.sh

# Prompt for TAILSCALE_AUTH_KEY
echo "Please enter your TAILSCALE_AUTH_KEY:"
read -r TAILSCALE_AUTH_KEY

if [ -z "$TAILSCALE_AUTH_KEY" ]; then
  echo "need tailscale auth key, generate one with tailscale on https://login.tailscale.com/admin/settings/keys"
  exit 1
fi

echo TAILSCALE_AUTH_KEY=$TAILSCALE_AUTH_KEY >> $SUPERDIR/configs/plugins/spr-tailscale/config.sh

echo {\"APIToken\" : \"${SPR_API_TOKEN}\" } > $SUPERDIR/configs/plugins/spr-tailscale/config.json

docker compose build
docker compose up -d
CONTAINER_IP=$(docker inspect --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "spr-tailscale")
API=127.0.0.1

curl "http://${API}/firewall/custom_interface" \
-H "Authorization: Bearer ${SPR_API_TOKEN}" \
-X 'PUT' \
--data-raw "{\"SrcIP\":\"${CONTAINER_IP}\",\"Interface\":\"spr-tailscale\",\"Policies\":[\"wan\",\"dns\",\"api\"]}"

docker compose restart
