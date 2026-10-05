import asyncio
from bleak import BleakClient, BleakScanner


PRINTER_NAME = "PSF588"

WRITE_CHARACTERISTIC = (
    "49535343-8841-43f4-a8d4-ecbe34729bb3"
)


class PSF588:
    def __init__(self):
        self.device = None
        self.client = None

    async def discover(self):
        devices = await BleakScanner.discover(timeout=10)

        for device in devices:
            name = device.name or ""

            if PRINTER_NAME.lower() in name.lower():
                self.device = device

                print(
                    f"🖨️ Found printer: {device.name}"
                )

                print(
                    f"📡 Bluetooth address: "
                    f"{device.address}"
                )

                return device

        return None

    async def connect(self):
        if not self.device:
            await self.discover()

        if not self.device:
            raise RuntimeError(
                "PSF588 printer not found"
            )

        if self.client and self.client.is_connected:
            return

        print("🔌 Connecting to PSF588...")

        self.client = BleakClient(
            self.device
        )

        await self.client.connect()

        if not self.client.is_connected:
            raise RuntimeError(
                "Failed to connect to PSF588"
            )

        print("✅ PSF588 connected")

    async def disconnect(self):
        if self.client:
            try:
                if self.client.is_connected:
                    await self.client.disconnect()
            except Exception:
                pass

        self.client = None

    async def print_bytes(self, data: bytes):
        await self.connect()

        print(
            f"🖨️ Sending {len(data)} bytes "
            "to PSF588..."
        )

        # BLE packets must be sent in manageable chunks.
        chunk_size = 180

        for i in range(0, len(data), chunk_size):
            chunk = data[
                i:i + chunk_size
            ]

            await self.client.write_gatt_char(
                WRITE_CHARACTERISTIC,
                chunk,
                response=False,
            )

            await asyncio.sleep(0.03)

        print("✅ Data sent to PSF588")

    async def test_print(self):
        init = bytes([
            0x1B,
            0x40,
        ])

        center = bytes([
            0x1B,
            0x61,
            0x01,
        ])

        bold_on = bytes([
            0x1B,
            0x45,
            0x01,
        ])

        bold_off = bytes([
            0x1B,
            0x45,
            0x00,
        ])

        left = bytes([
            0x1B,
            0x61,
            0x00,
        ])

        feed = bytes([
            0x1B,
            0x64,
            0x04,
        ])

        text = (
            "\n"
            "DINEFLOW\n"
            "------------------------------\n"
            "PRINTER AGENT TEST\n"
            "PSF588\n"
            "Bluetooth BLE\n"
            "Connection OK\n"
            "------------------------------\n"
            "\n"
        ).encode("ascii")

        data = (
            init
            + center
            + bold_on
            + b"DINEFLOW\n"
            + bold_off
            + text
            + left
            + feed
        )

        await self.print_bytes(data)