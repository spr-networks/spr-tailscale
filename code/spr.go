package main

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"reflect"
	"slices"
	"sort"
	"strings"
	"sync"
	"time"
)

import (
	"github.com/spr-networks/sprbus"
)

var TEST_PREFIX = os.Getenv("TEST_PREFIX")
var Configmtx sync.RWMutex

type TailscalePeer struct {
	IP       string
	Policies []string
	Groups   []string
	Tags     []string //unused for now
}

type Config struct {
	TailscaleAuthKey string
	APIToken         string
	Peers            []TailscalePeer
}

var gConfig = Config{}

// when updating this value, make sure to update docker-compose.yml also
// under networks:
var TAILSCALE_INTERFACE = "spr-tailscale"

var DevicesPublicConfigFile = TEST_PREFIX + "/state/public/devices-public.json"
var ConfigFile = TEST_PREFIX + "/configs/spr-tailscale/config.json"
var TailscaleEnvFile = TEST_PREFIX + "/configs/spr-tailscale/config.sh"
var PluginTokenPath = TEST_PREFIX + "/configs/spr-tailscale/api-token"
var gDefaultGroups = []string{"tailnet"}

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

type BaseRule struct {
	RuleName string
	Disabled bool
}

type CustomInterfaceRule struct {
	BaseRule
	Interface string
	SrcIP     string
	RouteDst  string
	Policies  []string
	Groups    []string
	Tags      []string //unused for now
}

func (c *CustomInterfaceRule) Equals(other *CustomInterfaceRule) bool {
	// Create copies of the Groups and Tags so that the original slices are not modified
	cGroups := make([]string, len(c.Groups))
	copy(cGroups, c.Groups)
	cTags := make([]string, len(c.Tags))
	copy(cTags, c.Tags)

	otherGroups := make([]string, len(other.Groups))
	copy(otherGroups, other.Groups)
	otherTags := make([]string, len(other.Tags))
	copy(otherTags, other.Tags)

	// Sort the copies of Groups and Tags
	sort.Strings(cGroups)
	sort.Strings(cTags)
	sort.Strings(otherGroups)
	sort.Strings(otherTags)

	// Create a copy of CustomInterfaceRule to compare the sorted slices
	cCopy := *c
	otherCopy := *other
	cCopy.Groups = cGroups
	cCopy.Tags = cTags
	otherCopy.Groups = otherGroups
	otherCopy.Tags = otherTags

	return reflect.DeepEqual(cCopy, otherCopy)
}

type FirewallConfig struct {
	//we only care about these.
	CustomInterfaceRules []CustomInterfaceRule
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

func getSPRFirewallConfig() (FirewallConfig, error) {
	firewallConfig := FirewallConfig{}

	gw, err := getGateway()
	if err != nil {
		fmt.Println("[-] Could not retrieve SPR API from gateway address")
		return firewallConfig, err
	}

	cli := http.Client{
		Timeout: time.Second * 2, // Timeout after 2 seconds
	}

	defer cli.CloseIdleConnections()

	req, err := http.NewRequest(http.MethodGet, "http://"+gw+":80/firewall/config", nil)
	if err != nil {
		fmt.Println(err)
		return firewallConfig, err
	}

	Configmtx.RLock()
	token := gConfig.APIToken
	Configmtx.RUnlock()

	if gConfig.APIToken == "" {
		fmt.Println("[-] Missing auth token")
		return firewallConfig, fmt.Errorf("missing auth token")
	}

	req.Header.Add("Authorization", "Bearer "+token)

	resp, err := cli.Do(req)
	if err != nil {
		fmt.Println("request failed", err)
		return firewallConfig, err
	}

	if resp.StatusCode != 200 {
		return firewallConfig, fmt.Errorf("API error", resp.StatusCode)
	}

	defer resp.Body.Close()

	err = json.NewDecoder(resp.Body).Decode(&firewallConfig)
	if err != nil {
		return firewallConfig, err
	}

	return firewallConfig, nil
}

func TwiddleTinyIP(net_ip net.IP, delta int) net.IP {
	u := binary.BigEndian.Uint32(net_ip.To4()) + uint32(delta)
	return net.IPv4(byte(u>>24), byte(u>>16), byte(u>>8), byte(u))
}

func TinyIpDelta(IP string, delta int) string {
	return TwiddleTinyIP(net.ParseIP(IP), delta).String()
}

func toSubnet(IP string) string {
	return TinyIpDelta(IP, -2) + "/30"
}

func getSPRRoutes() ([]string, error) {
	connected_subnets := []string{}

	//grab devices
	devices, err := APIDevices()
	if err != nil {
		return connected_subnets, err
	}

	//get all routes
	config, err := getSPRFirewallConfig()
	if err != nil {
		return connected_subnets, err
	}

	all_groups := []string{}
	all_srcips := []string{}
	custom_interfaces := config.CustomInterfaceRules
	// gather all groups for "tailscale"
	for _, custom := range custom_interfaces {
		if custom.Interface == gSPRTailscaleInterface {
			for _, group := range custom.Groups {
				if !slices.Contains(all_groups, group) {
					all_groups = append(all_groups, group)
				}
			}

			if !slices.Contains(all_srcips, custom.SrcIP) {
				all_srcips = append(all_srcips, custom.SrcIP)
			}
		}
	}

	//now iterate groups in devices to get each /30
	for _, device := range devices {
		if device.RecentIP != "" {

			inGroup := slices.ContainsFunc(device.Groups, func(group string) bool {
				return slices.Contains(all_groups, group)
			})

			if inGroup {
				connected_subnets = append(connected_subnets, toSubnet(device.RecentIP))
			}
		}
	}

	return connected_subnets, nil
}

func updateCustomInterface(doDelete bool, SrcIP string, Policies []string, Groups []string, RouteDst string) error {
	custom_interface_rule := CustomInterfaceRule{
		BaseRule{"GeneratedTailscale-" + SrcIP,
			false},
		gSPRTailscaleInterface,
		SrcIP,
		RouteDst,
		Policies,
		Groups,
		[]string{},
	}

	cli := http.Client{
		Timeout: time.Second * 2, // Timeout after 2 seconds
	}

	defer cli.CloseIdleConnections()

	jsonValue, _ := json.Marshal(custom_interface_rule)

	meth := http.MethodPut
	if doDelete {
		meth = http.MethodDelete
	}

	gw, err := getGateway()
	if err != nil {
		fmt.Println("[-] Could not retrieve SPR API from gateway address")
		return err
	}

	req, err := http.NewRequest(meth, "http://"+gw+":80/firewall/custom_interface", bytes.NewBuffer(jsonValue))
	if err != nil {
		fmt.Println(err)
		return err
	}

	Configmtx.RLock()
	token := gConfig.APIToken
	Configmtx.RUnlock()

	req.Header.Add("Authorization", "Bearer "+token)

	resp, err := cli.Do(req)
	if err != nil {
		fmt.Println("request failed", err)
		return err
	}

	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("resp failure " + resp.Status)
	}

	return nil
}

func loadConfig() error {
	Configmtx.RLock()
	defer Configmtx.RUnlock()
	data, err := ioutil.ReadFile(ConfigFile)
	if err != nil {
		return err
	} else {
		err := json.Unmarshal(data, &gConfig)
		if err != nil {
			return err
		}
	}
	return nil
}

func writeConfigLocked() error {
	file, _ := json.MarshalIndent(gConfig, "", " ")
	return ioutil.WriteFile(ConfigFile, file, 0600)
}

func installFirewallRule() {

	if os.Getenv("VIRTUAL_SPR") == "1" {
		return
	}

	// if we're not in virtual mode, we need to add ourselve's to SPR's container
	// firewall rules

	gw, err := getGateway()
	if err != nil {
		fmt.Println("[-] Could not retrieve SPR API from gateway address")
		return
	}
	containerIP := getContainerIP()

	payload := map[string]interface{}{
		"SrcIP":     containerIP,
		"Interface": TAILSCALE_INTERFACE,
		"Policies":  []string{"wan", "dns", "api"},
	}
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		fmt.Println("Error marshalling payload:", err)
		return
	}

	api := "http://" + gw + "/firewall/custom_interface"

	// Creating the request
	req, err := http.NewRequest("PUT", api, bytes.NewBuffer(payloadBytes))
	if err != nil {
		fmt.Println("[-] Error creating request:", err)
		return
	}

	// Adding required headers
	req.Header.Add("Authorization", "Bearer "+gConfig.APIToken)
	req.Header.Add("Content-Type", "application/json")

	// Making the request
	client := &http.Client{}
	defer client.CloseIdleConnections()

	resp, err := client.Do(req)
	if err != nil {
		fmt.Println("[-] Error making container interface request:", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		fmt.Println("[-] Failed to install container firewall rule")
		return
	}
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
		if err == nil {
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

		//also write the tailscale config now
		err = ioutil.WriteFile(TailscaleEnvFile, []byte("TAILSCALE_AUTH_KEY="+gConfig.TailscaleAuthKey), 0600)
		if err != nil {
			http.Error(w, err.Error(), 400)
			return
		}

		// configure this container into SPR
		installFirewallRule()
	}
}

func advertiseRoutes(routes []string) error {
	//this script inherits auth key parameters and so on
	return exec.Command("/scripts/up.sh", "--advertise-routes="+strings.Join(routes, ",")).Run()
}

func collectPeerIPs() []string {
	cmd := exec.Command("tailscale", "status")
	stdout, err := cmd.Output()
	if err != nil {
		fmt.Println("[-] Failed to get status")
		return []string{}
	}

	lines := strings.Split(string(stdout), "\n")

	var entries []string
	for _, line := range lines {
		parts := strings.Fields(line)
		if len(parts) > 0 {
			entries = append(entries, parts[0])
		}
	}

	if len(entries) > 1 {
		return entries[1:]
	}

	return []string{}
}

func cleanOldPeers(fw FirewallConfig, tailscaleIPs []string) {
	containerIP := getContainerIP()

	for _, entry := range fw.CustomInterfaceRules {
		if entry.Interface == gSPRTailscaleInterface {
			found_peer := false
			//skip non cg nat addrs. we're looking for peers
			if entry.SrcIP[:4] != "100." {
				continue
			}
			for _, ip := range tailscaleIPs {
				if ip == entry.SrcIP {
					found_peer = true
				}
			}

			if !found_peer {
				//scanned tailscale ips, IP is not known, remove it
				err := updateCustomInterface(true, entry.SrcIP, entry.Policies, entry.Groups, containerIP)
				if err != nil {
					fmt.Println("[-] Failed to delete peer "+entry.SrcIP, err)
				}

			}
		}
	}
}

func getContainerIP() string {
	iface, err := net.InterfaceByName("eth0")
	if err != nil {
		fmt.Println("Error:", err)
		return ""
	}

	// Get the list of unicast interface addresses for the specified interface
	addrs, err := iface.Addrs()
	if err != nil {
		fmt.Println("Error:", err)
		return ""
	}

	if len(addrs) > 0 {
		ip := addrs[0].String()
		if strings.Contains(ip, "/") {
			ip = strings.Split(ip, "/")[0]
		}
		return ip
	}
	return ""
}

func matchPeerConfig(crule CustomInterfaceRule, ip string) (bool, []string, []string, []string) {
	//this routine returns false if peer is configured and different than the interface rule
	Configmtx.RLock()
	defer Configmtx.RUnlock()

	for _, peer := range gConfig.Peers {
		if peer.IP == ip {
			ret := slices.Compare(peer.Groups, crule.Groups)
			if ret == 0 {
				ret = slices.Compare(peer.Tags, crule.Tags)
				if ret == 0 {
					ret = slices.Compare(peer.Policies, crule.Policies)
					return ret == 0, peer.Groups, peer.Tags, peer.Policies
				}
			}
			return ret == 0, peer.Groups, peer.Tags, peer.Policies
		}
	}

	//we return true if not in peers
	return true, []string{}, []string{}, []string{}
}

func installNewPeers(fw FirewallConfig, tailscaleIPs []string) {
	containerIP := getContainerIP()

	policies := []string{}

	groups := gDefaultGroups
	for _, ip := range tailscaleIPs {
		found_peer := false
		for _, crule := range fw.CustomInterfaceRules {
			if crule.Interface == gSPRTailscaleInterface && crule.SrcIP == ip {

				ok, new_groups, _, _ := matchPeerConfig(crule, ip)
				if !ok {
					//delete peer and reinstall
					groups = new_groups
					err := updateCustomInterface(true, crule.SrcIP, crule.Policies, crule.Groups, containerIP)
					if err != nil {
						fmt.Println("[-] Failed to delete peer "+crule.SrcIP, err)
					}
					break
				} else {
					//peer already established with correct groups
					found_peer = true
					break
				}

			}
		}

		if !found_peer {
			//install this peer
			err := updateCustomInterface(false, ip, policies, groups, containerIP)
			if err != nil {
				fmt.Println("[-] Failed to install peer "+ip, err)
			}
		}
	}
}

func rebuildPostrouting() {
	// Check if the POSTROUTING chain already exists
	chainExistsCmd := "nft list chains | grep 'POSTROUTING'"
	if !commandOutputContains(chainExistsCmd, "POSTROUTING") {
		// Chain does not exist, so add it
		addChainCmd := "nft add chain inet nat POSTROUTING { type nat hook postrouting priority 100 \\; }"
		if err := exec.Command("sh", "-c", addChainCmd).Run(); err != nil {
			fmt.Printf("Failed to add chain: %s\nError: %s\n", addChainCmd, err)
			return
		}
	}

	// Check if the masquerade rule for tailscale0 already exists
	ruleExistsCmd := "nft list ruleset | grep 'oifname \"tailscale0\" masquerade'"
	if !commandOutputContains(ruleExistsCmd, "tailscale0") {
		// Rule does not exist, so add it
		addRuleCmd := "nft add rule inet nat POSTROUTING oifname \"tailscale0\" masquerade"
		if err := exec.Command("sh", "-c", addRuleCmd).Run(); err != nil {
			fmt.Printf("Failed to add rule: %s\nError: %s\n", addRuleCmd, err)
			return
		}
	}
}

// commandOutputContains executes a shell command and checks if the output contains the specified string.
func commandOutputContains(commandStr, searchStr string) bool {
	cmd := exec.Command("sh", "-c", commandStr)
	var out bytes.Buffer
	cmd.Stdout = &out
	err := cmd.Run()
	if err != nil {
		return false
	}
	return strings.Contains(out.String(), searchStr)
}
func rebuildState() {

	rebuildPostrouting()

	fw, err := getSPRFirewallConfig()
	if err != nil {
		fmt.Println("[-] Failed to load fw config", err.Error())
		return
	}

	//first half, get known tailscale peers, and advertise them to SPR
	tailscaleIPs := collectPeerIPs()

	//first remove any peers that dont belong
	cleanOldPeers(fw, tailscaleIPs)

	installNewPeers(fw, tailscaleIPs)

	//second half, get routes for tailscale and advertise them.
	routes, err := getSPRRoutes()
	if err != nil {
		fmt.Println("[-] Failed to get SPR routes to advertise to tailscale")
		return
	}

	err = advertiseRoutes(routes)
	if err != nil {
		fmt.Println("[-] Failed to advertise routes to tailscale")
		return
	}

	//publish peers on bus
	sprbus.Publish("tailscale:peers", tailscaleIPs)
}

func handleDeviceEvent(topic string, value string) {
	//if there was a device update, do rebuild the state.
	rebuildState()
}

func busListener() {
	go func() {
		for i := 30; i > 0; i-- {
			err := sprbus.HandleEvent("device:", handleDeviceEvent)
			if err != nil {
				log.Println(err)
			}
			time.Sleep(3 * time.Second)
		}
		log.Fatal("failed to establish connection to sprbus")
	}()
}
