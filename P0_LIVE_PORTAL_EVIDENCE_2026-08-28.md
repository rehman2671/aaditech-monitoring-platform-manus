# Live Portal Evidence — 2026-08-28

The connected browser successfully logged into the local Docker frontend at `http://localhost:3001/login` and navigated to `/endpoints/DESKTOP-1E02MC9`. The authenticated operator shown is `aziz.shaikh`, role `ADMIN`, organization `ORG-20260813205347.229942651`.

The portal currently shows endpoint `DESKTOP-1E02MC9` as `ONLINE`, with hostname, serial `5FSKBV2`, IP `10.73.99.58`, domain `WORKGROUP`, agent `v2.4.36.0`, and last-seen timestamp `2026-08-28 05:17:32` local display time. Asset ID is server-generated as `AST-6985C3C80A04`.

Truthful evidence currently visible includes Windows 11 Pro build 26200, 32 GB total RAM, 4 CPU cores / 8 threads, Qualcomm QCA61x4A Wi-Fi adapter with an observed gateway, Hyper-V/WSL adapters, Sophos TAP adapter, Bluetooth adapter, and the agent-reported battery command status `ok` from `powercfg /batteryreport`.

Battery measured fields remain unavailable: charge percentage, health, status, design capacity, full-charge capacity, and cycle count are blank/unavailable. The UI explicitly identifies the health source and command status, but the captured command did not produce parsed battery metrics. Graphics adapters and per-adapter GPU telemetry are still absent. RAM module speed, slots, and form factor are unavailable. Network adapter link speed and throughput/latency are explicitly not collected by the agent; adapter identity, IP, MAC, and observed state are present.

Device-management metadata remains unassigned for owner, department, location, and tags; maintenance mode is OFF. Application usage is explicitly not collected, and extended disk inventory is awaiting extended disk telemetry. These are open product/evidence gaps, not treated as successful collection.
