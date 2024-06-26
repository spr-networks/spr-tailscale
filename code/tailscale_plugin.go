package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"

	"github.com/gorilla/mux"
	"github.com/vishvananda/netlink"
	"gopkg.in/validator.v2"
	"tailscale.com/client/tailscale"
)

var UNIX_PLUGIN_LISTENER = "/state/plugins/spr-tailscale/socket"

// Optionally we can adjust this with TS_SOCKET https://tailscale.com/kb/1282/docker#ts_socket
var UNIX_TAILSCALE_SOCK = "/run/tailscale/tailscaled.sock"
var TailscaleInterface = "tailscale0"

// the name of the interface from the docker network (see docker-compose.yml)
// which is visible outside of the container.
var gSPRTailscaleInterface = "spr-tailscale"

//https://pkg.go.dev/tailscale.com/client/tailscale

type tailscalePlugin struct {
	clientMtx sync.Mutex
	tsdClient tailscale.LocalClient
}

func httpInternalError(msg string, err error, w http.ResponseWriter) {
	fmt.Println(msg, err)
	http.Error(w, err.Error(), 500)
}

func (tsp *tailscalePlugin) handleGetPeers(w http.ResponseWriter, r *http.Request) {
	tsp.clientMtx.Lock()
	defer tsp.clientMtx.Unlock()

	tsdStatus, tsdErr := tsp.tsdClient.Status(r.Context())
	if tsdErr != nil {
		httpInternalError("Getting tailscale peers failed", tsdErr, w)
		return
	}

	if jsonErr := json.NewEncoder(w).Encode(tsdStatus.Peer); jsonErr != nil {
		httpInternalError("Encoding tailscale peers failed", jsonErr, w)
		return
	}
}

func (tsp *tailscalePlugin) handleGetStatus(w http.ResponseWriter, r *http.Request) {
	tsp.clientMtx.Lock()
	defer tsp.clientMtx.Unlock()

	tsdStatus, tsdErr := tsp.tsdClient.StatusWithoutPeers(r.Context())
	if tsdErr != nil {
		httpInternalError("Getting tailscale status failed", tsdErr, w)
		return
	}

	if err := json.NewEncoder(w).Encode(tsdStatus); err != nil {
		httpInternalError("Encoding tailscale status failed", err, w)
		return
	}
}

type handleUpRequest struct {
	forceReauth    bool   `cmd:"--force-reauth"`
	authKey        string `validate:"regexp=^tskey-[A-Za-z0-9\\-]+$" cmd:"--auth-key"`
	exitNode       string `validate:"ipv4" cmd:"--exit-node"`
	timeoutSeconds string `validate:"duration" cmd:"--timeout"`
}

type handleUpResponse struct {
	success bool
	message string
	args    map[string]string
}

func (tsp *tailscalePlugin) handleUp(w http.ResponseWriter, r *http.Request) {
	tsp.clientMtx.Lock()
	defer tsp.clientMtx.Unlock()

	var upArgs handleUpRequest
	if err := json.NewDecoder(r.Body).Decode(&upArgs); err != nil {
		http.Error(w, err.Error(), 400)
		return
	}
	if err := validator.Validate(upArgs); err != nil {
		http.Error(w, err.Error(), 400)
		return
	}

	status, err := tsp.tsdClient.Status(r.Context())
	if err != nil {
		httpInternalError("Getting tailscale status failed", err, w)
		return
	}

	switch state := status.BackendState; state {
	case "Running":
		if !upArgs.forceReauth {
			// Already up - nothing to be done.
			json.NewEncoder(w).Encode(handleUpResponse{
				success: true,
				message: "tailscale is (already) up",
			})
			return
		} else {

		}

	case "NeedsLogin":
		json.NewEncoder(w).Encode(handleUpResponse{
			success: false,
			message: "please login and authorize this machine",
			args: map[string]string{
				"AuthURL": status.AuthURL,
			},
		})
		return

	case "NeedsMachineAuth":
		json.NewEncoder(w).Encode(handleUpResponse{
			success: false,
			message: "please login and authorize this machine",
			args: map[string]string{
				"AuthURL": status.AuthURL,
			},
		})
		return

	case "Stopped":
		cmd := exec.Command("/scripts/up.sh")
		_, cmdErr := cmd.Output()
		if cmdErr != nil {
			json.NewEncoder(w).Encode(handleUpResponse{
				success: false,
				message: "unexpected error while bringing up tailscale",
				args: map[string]string{
					"error": cmdErr.Error(),
				},
			})
		}

	default:
		json.NewEncoder(w).Encode(handleUpResponse{
			success: false,
			message: "encountered an unknown state",
			args: map[string]string{
				"State": state,
			},
		})

	}
}

func (tsp *tailscalePlugin) handleDown(w http.ResponseWriter, r *http.Request) {
	return
}

func (tsp *tailscalePlugin) handleSetSPRPeer(w http.ResponseWriter, r *http.Request) {

	input_peer := TailscalePeer{}
	if err := json.NewDecoder(r.Body).Decode(&input_peer); err != nil {
		http.Error(w, err.Error(), 400)
		return
	}

	if input_peer.IP == "" {
		http.Error(w, "Need a Peer IP", 400)
		return
	}

	//make sure to include Tailnet in the groups
	found := false
	for _, entry := range input_peer.Groups {
		if entry == gDefaultGroups[0] {
			found = true
		}
	}
	if !found {
		input_peer.Groups = append(input_peer.Groups, gDefaultGroups[0])
	}

	Configmtx.Lock()
	defer Configmtx.Unlock()

	if r.Method == http.MethodPut {
		//replace or add a new peer
		for idx, peer := range gConfig.Peers {
			matched := false
			if input_peer.NodeKey != "" && peer.NodeKey == input_peer.NodeKey {
				matched = true
			} else if input_peer.IP == peer.IP {
				matched = true
			}

			if matched {
				gConfig.Peers[idx] = input_peer
				err := writeConfigLocked()
				if err == nil {
					go rebuildState()
				} else {
					http.Error(w, err.Error(), 400)
					return
				}
				return
			}
		}

		//append if not found
		gConfig.Peers = append(gConfig.Peers, input_peer)
		return
	} else if r.Method == http.MethodDelete {
		//delete the peer
		for idx, peer := range gConfig.Peers {
			matched := false
			if input_peer.NodeKey != "" && peer.NodeKey == input_peer.NodeKey {
				matched = true
			} else if input_peer.IP == peer.IP {
				matched = true
			}

			if matched {
				gConfig.Peers = append(gConfig.Peers[:idx], gConfig.Peers[idx+1:]...)
				err := writeConfigLocked()
				if err == nil {
					go rebuildState()
				} else {
					http.Error(w, err.Error(), 400)
					return
				}
				return
			}
		}
	}
	http.Error(w, "Not found", 404)
	return

}

func (tsp *tailscalePlugin) handleGetSetConfig(w http.ResponseWriter, r *http.Request) {

	if r.Method == http.MethodGet {
		Configmtx.RLock()
		defer Configmtx.RUnlock()
		if jsonErr := json.NewEncoder(w).Encode(gConfig); jsonErr != nil {
			http.Error(w, jsonErr.Error(), 400)
			return
		}

	} else {
		Configmtx.Lock()
		defer Configmtx.Unlock()
		//write the config
		cfg := Config{}
		if err := json.NewDecoder(r.Body).Decode(&cfg); err != nil {
			http.Error(w, err.Error(), 400)
			return
		}

		//validate that cfg has TailscaleAuthKey set
		if cfg.TailscaleAuthKey == "" {
			http.Error(w, "Missing Tailscale Auth Key", 400)
			return
		}

		tokendata, err := ioutil.ReadFile(PluginTokenPath)
		if err != nil {
			http.Error(w, "Missing SPR API Key", 400)
			return
		}

		gConfig.TailscaleAuthKey = cfg.TailscaleAuthKey
		gConfig.APIToken = string(tokendata)
		err = writeConfigLocked()
		if err != nil {
			http.Error(w, err.Error(), 400)
			return
		}

		configData := []byte("TAILSCALE_AUTH_KEY=" + gConfig.TailscaleAuthKey)
		if gConfig.AdvertiseExitNode {
			configData = append(configData, []byte("\nTAILSCALE_EXIT_NODE=1\n")...)
		}

		//also write the tailscale config now
		err = ioutil.WriteFile(TailscaleEnvFile, configData, 0600)
		if err != nil {
			http.Error(w, err.Error(), 400)
			return
		}

		// configure this container into SPR
		go installFirewallRule()
	}
}

func logRequest(handler http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Printf("%s %s %s\n", r.RemoteAddr, r.Method, r.URL)
		handler.ServeHTTP(w, r)
	})
}

func getGateway() (string, error) {
	//first, check if it is virtual spr, if so, return localhost
	// as we're running in the service:base network namespace.
	if os.Getenv("VIRTUAL_SPR") == "1" {
		return "127.0.0.1", nil
	}

	cmd := exec.Command("ip", "route")
	var out bytes.Buffer
	cmd.Stdout = &out
	err := cmd.Run()
	if err != nil {
		fmt.Println("Error executing command:", err)
		return "", err
	}

	// Process the output
	for _, line := range strings.Split(out.String(), "\n") {
		if strings.Contains(line, "default") {
			fields := strings.Fields(line)
			if len(fields) > 2 {
				return fields[2], nil
				break
			}
		}
	}

	return "", fmt.Errorf("gateway not found")
}

func routeTracker() {

	updates := make(chan netlink.RouteUpdate)
	if err := netlink.RouteSubscribe(updates, nil); err != nil {
		log.Fatalf("Failed to subscribe to route updates: %v", err)
	}

	// Listen for updates
	for _ = range updates {
		//Src, Dst/ Iifname, Oifname
		rebuildState()
	}

}

type spaHandler struct {
	staticPath string
	indexPath  string
}

func (h spaHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	path, err := filepath.Abs(r.URL.Path)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	path = filepath.Join(h.staticPath, path)
	_, err = os.Stat(path)
	if os.IsNotExist(err) {
		http.ServeFile(w, r, filepath.Join(h.staticPath, h.indexPath))
		return
	} else if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	http.FileServer(http.Dir(h.staticPath)).ServeHTTP(w, r)
}

func main() {
	loadConfig()

	if err := validator.SetValidationFunc("ipv4", isValidIPv4); err != nil {
		return
	}
	if err := validator.SetValidationFunc("duration", isValidDuration); err != nil {
		return
	}

	plugin := tailscalePlugin{
		tsdClient: tailscale.LocalClient{
			Socket:        UNIX_TAILSCALE_SOCK,
			UseSocketOnly: true,
		},
	}

	rebuildState()

	unix_plugin_router := mux.NewRouter().StrictSlash(true)

	unix_plugin_router.HandleFunc("/config", plugin.handleGetSetConfig).Methods("GET", "PUT")
	//unix_plugin_router.HandleFunc("/reauth", plugin.handleReauth).Methods("POST")
	unix_plugin_router.HandleFunc("/status", plugin.handleGetStatus).Methods("GET")
	unix_plugin_router.HandleFunc("/peers", plugin.handleGetPeers).Methods("GET")

	unix_plugin_router.HandleFunc("/setSPRPeer", plugin.handleSetSPRPeer).Methods("DELETE", "PUT")

	unix_plugin_router.HandleFunc("/up", plugin.handleUp).Methods("PUT")
	//unix_plugin_router.HandleFunc("/down", plugin.handleDown).Methods("PUT")

	// map /ui to /ui on fs
	spa := spaHandler{staticPath: "/ui", indexPath: "index.html"}
	unix_plugin_router.PathPrefix("/").Handler(spa)

	os.Remove(UNIX_PLUGIN_LISTENER)
	unixPluginListener, err := net.Listen("unix", UNIX_PLUGIN_LISTENER)
	if err != nil {
		panic(err)
	}

	busListener()

	pluginServer := http.Server{Handler: logRequest(unix_plugin_router)}

	pluginServer.Serve(unixPluginListener)
}
