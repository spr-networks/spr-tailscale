package main

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io/ioutil"
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

var TEST_PREFIX = os.Getenv("TEST_PREFIX")
var Configmtx sync.RWMutex

var DevicesPublicConfigFile = TEST_PREFIX + "/state/public/devices-public.json"
var ConfigFile = TEST_PREFIX + "/configs/tailscale/config.json"
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

/*
type ForwardingRule struct {
	BaseRule
	Protocol string
	DstIP    string
	DstPort  string
	SrcIP    string
	SrcPort  string
}

type BlockRule struct {
	BaseRule
	Protocol string
	DstIP    string
	SrcIP    string
}

type ForwardingBlockRule struct {
	BaseRule
	Protocol string
	DstIP    string
	DstPort  string
	SrcIP    string
}
*/

type CustomInterfaceRule struct {
	BaseRule
	Interface string
	DstRoute  string
	SrcIP     string
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

/*
type ServicePort struct {
	Protocol        string
	Port            string
	UpstreamEnabled bool
}

// an endpoint describes an arbitrary service. It serves
// as a helper for creating other firewall rules,
// as well as one-way connectivity from devices to the endpoint
// when they share a tag.
type Endpoint struct {
	BaseRule
	Protocol string
	IP       string
	Domain   string
	Port     string
	Tags     []string
}

// NOTE , we do not need an address to filter with as well,
// the multicast proxy will take care of that.
type MulticastPort struct {
	Port     string //udp port number to listen on
	Upstream bool   // if enabled will advertose both on uplink and lan interfaces
}
*/
//TBD see if we can remove everything but CustomInterfaceRules
type FirewallConfig struct {
	//	ForwardingRules      []ForwardingRule
	//	BlockRules           []BlockRule
	//	ForwardingBlockRules []ForwardingBlockRule
	CustomInterfaceRules []CustomInterfaceRule
	// ServicePorts         []ServicePort
	// Endpoints            []Endpoint
	// MulticastPorts       []MulticastPort
	// PingLan              bool
	// PingWan              bool
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

type Config struct {
	APIToken string
}

var gConfig = Config{}

func getSPRFirewallConfig() (FirewallConfig, error) {
	firewallConfig := FirewallConfig{}

	cli := http.Client{
		Timeout: time.Second * 2, // Timeout after 2 seconds
	}

	defer cli.CloseIdleConnections()

	req, err := http.NewRequest(http.MethodGet, "http://localhost:80/firewall/config", nil)
	if err != nil {
		fmt.Println(err)
		return firewallConfig, err
	}

	Configmtx.RLock()
	token := gConfig.APIToken
	Configmtx.RUnlock()

	req.Header.Add("Authorization", "Bearer "+token)

	resp, err := cli.Do(req)
	if err != nil {
		fmt.Println("request failed", err)
		return firewallConfig, err
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
	return TinyIpDelta(IP, -1) + "/30"
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

func updateCustomInterface(doDelete bool, SrcIP string, Groups []string, RouteDst string) error {
	custom_interface_rule := CustomInterfaceRule{
    BaseRule{"GeneratedTailscale-" + SrcIP,
    false},
		gSPRTailscaleInterface,
		SrcIP,
		RouteDst,
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
	req, err := http.NewRequest(meth, "http://localhost:80/firewall/custom_interface", bytes.NewBuffer(jsonValue))
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

func advertiseRoutes(routes []string) error {
	return exec.Command("tailscale", "up", "--advertise-routes="+strings.Join(routes, ",")).Run()
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
    return addrs[0].String()
  }
  return ""
}

func installNewPeers(fw FirewallConfig, tailscaleIPs []string) {
  containerIP := getContainerIP()

	for _, ip := range tailscaleIPs {
		found_peer := false
		for _, crule := range fw.CustomInterfaceRules {
			if crule.SrcIP == ip {
				found_peer = true
				break
			}
		}

		if !found_peer {
			//install this peer
			err := updateCustomInterface(false, ip, gDefaultGroups, containerIP)
			if err != nil {
				fmt.Println("[-] Failed to install peer "+ip, err)
			}
		}
	}
}

func rebuildState() {

	fw, err := getSPRFirewallConfig()
	if err != nil {
		fmt.Println("[-] Failed to load fw config")
		return
	}

	//first half, get known tailscale peers, and advertise them to SPR
	tailscaleIPs := collectPeerIPs()
	//func updateCustomInterface(doDelete bool, SrcIP string, Groups []string, RouteDst string) error {

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

}
