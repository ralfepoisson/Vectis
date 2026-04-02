import { networkInterfaces, uptime } from "node:os";
import { readFile } from "node:fs/promises";

export interface HeartbeatSnapshot {
  ipAddresses: string[];
  uptimeSeconds: number;
  temperatureCelsius: number | null;
}

export type HeartbeatProvider = () => Promise<HeartbeatSnapshot>;

const DEFAULT_TEMPERATURE_PATH = "/sys/class/thermal/thermal_zone0/temp";

export function resolveIpAddresses(
  interfaces: ReturnType<typeof networkInterfaces>
): string[] {
  return Object.values(interfaces)
    .flatMap((entries) => entries ?? [])
    .filter((entry) => !entry.internal)
    .map((entry) => entry.address)
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
}

export async function readDeviceTemperature(
  temperaturePath = DEFAULT_TEMPERATURE_PATH
): Promise<number | null> {
  try {
    const raw = await readFile(temperaturePath, "utf8");
    const milliDegrees = Number(raw.trim());

    if (!Number.isFinite(milliDegrees)) {
      return null;
    }

    return milliDegrees / 1000;
  } catch {
    return null;
  }
}

export async function readHeartbeatSnapshot(): Promise<HeartbeatSnapshot> {
  return {
    ipAddresses: resolveIpAddresses(networkInterfaces()),
    uptimeSeconds: Math.floor(uptime()),
    temperatureCelsius: await readDeviceTemperature()
  };
}
