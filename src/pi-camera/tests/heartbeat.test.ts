import { describe, expect, it } from "vitest";

import { resolveIpAddresses } from "../src/heartbeat";

describe("heartbeat helpers", () => {
  it("returns non-internal IPv4 and IPv6 addresses in a stable order", () => {
    const addresses = resolveIpAddresses({
      lo: [
        {
          address: "127.0.0.1",
          family: "IPv4",
          internal: true,
          netmask: "255.0.0.0",
          cidr: "127.0.0.1/8",
          mac: "00:00:00:00:00:00"
        }
      ],
      wlan0: [
        {
          address: "fe80::1",
          family: "IPv6",
          internal: false,
          netmask: "ffff:ffff:ffff:ffff::",
          cidr: "fe80::1/64",
          mac: "00:11:22:33:44:55",
          scopeid: 2
        },
        {
          address: "192.168.1.22",
          family: "IPv4",
          internal: false,
          netmask: "255.255.255.0",
          cidr: "192.168.1.22/24",
          mac: "00:11:22:33:44:55"
        }
      ]
    });

    expect(addresses).toEqual(["192.168.1.22", "fe80::1"]);
  });
});
