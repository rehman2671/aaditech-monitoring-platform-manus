# SentinelPulse Hardware & Real-Time Monitoring Implementation Plan

## Objective
Provide 100% specification parity with the user's endpoint monitoring checklist, covering CPU clock/temperature, GPU VRAM/utilization, disk type/model, battery metrics, network adapters/Wi-Fi/Ethernet, connected peripherals, real-time resource streaming, and robust validation.

---

## Architecture & Integration Matrix

| Module | Data Points | Agent Source | Backend Ingestion & Storage | Frontend Dashboard |
|---|---|---|---|---|
| **CPU** | Model, Cores, Threads, Clock Speed, Utilization, Temperature | WMI `Win32_Processor`, Performance Counters (`\Processor(_Total)\% Processor Time`), LibreHardwareMonitor / WMI `MSAcpi_ThermalZoneTemperature` | TimescaleDB hypertable `metrics_history`, JSON payload validation | Endpoint detail performance tab, real-time utilization chart |
| **RAM** | Total, Used, Free, Utilization %, Committed Memory | WMI `Win32_ComputerSystem`, Performance Counters (`\Memory\Available MBytes`) | TimescaleDB hypertable `metrics_history` | Overview & endpoint detail RAM gauge/chart |
| **GPU** | Model, VRAM, Utilization, Temperature | WMI `Win32_VideoController`, DXGI / WMI Performance | Persistent endpoint attributes & telemetry table | Hardware tab in endpoint detail view |
| **Disk** | Model, Type (SSD/HDD/NVMe), Capacity, Free Space, Health, SMART, IOPS, Throughput, Latency | WMI `Win32_DiskDrive`, `Win32_LogicalDisk`, SMART attributes via WMI / Storage Spaces | Persistent disk table + TimescaleDB IO metrics | Hardware & Disks tab with capacity and SMART health bars |
| **Battery** | Health %, Capacity (Design/Full), Charge Level %, Charging Status, Cycle Count, Temperature | WMI `Win32_Battery` | Battery telemetry table | Overview battery summary & endpoint hardware view |
| **Network** | IP, MAC, Gateway, SSID, Signal Strength %, Bandwidth (Up/Down), Latency, VPN Status | WMI `Win32_NetworkAdapterConfiguration`, NetworkInformation APIs | Network telemetry table | Network diagnostics card & charts |
| **Peripherals** | Connected Monitors, Keyboards, Mice, USB Devices | WMI `Win32_PnPEntity`, `Win32_DesktopMonitor` | Peripheral inventory table | Hardware / Peripherals inspection tab |
| **Real-Time** | Live CPU, RAM, Disk IO, Network, GPU streams | Background polling (5-30s intervals) + SQLite offline buffer | Fastify Ingestion API + WebSocket broadcast | Real-time live dashboard overview and endpoint charts |
