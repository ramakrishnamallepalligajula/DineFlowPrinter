import asyncio
from bleak import BleakClient, BleakScanner


PRINTER_NAME = "PSF588"

WRITE_CHARACTERISTIC = (
    "49535343-8841-43f4-a8d4-ecbe34729bb3"
)


async def find_printer():
    print("🔎 Searching for PSF588...")

    devices = await BleakScanner.discover(timeout=10)

    for device in devices:
        name = device.name or ""

        if PRINTER_NAME.lower() in name.lower():
            return device

    return None


async def print_test(client):
    print("🖨️ Sending test print...")

    # ESC/POS initialize
    init = bytes([0x1B, 0x40])

    # Center alignment
    center = bytes([0x1B, 0x61, 0x01])

    # Bold ON
    bold_on = bytes([0x1B, 0x45, 0x01])

    # Bold OFF
    bold_off = bytes([0x1B, 0x45, 0x00])

    # Text
    text = (
        "\n"
        "DINEFLOW\n"
        "------------------------------\n"
        "PSF588 TEST PRINT\n"
        "Bluetooth BLE\n"
        "Connection OK\n"
        "------------------------------\n"
        "\n"
    ).encode("ascii")

    # Left alignment
    left = bytes([0x1B, 0x61, 0x00])

    # Feed paper
    feed = bytes([0x1B, 0x64, 0x04])

    commands = [
        init,
        center,
        bold_on,
        b"DINEFLOW\n",
        bold_off,
        text,
        left,
        feed,
    ]

    for command in commands:
        await client.write_gatt_char(
            WRITE_CHARACTERISTIC,
            command,
            response=False,
        )

        # Give the printer a tiny amount of time
        await asyncio.sleep(0.05)

    print("✅ Test print data sent.")


async def main():
    print("")
    print("======================================")
    print("       DINEFLOW PSF588 TEST")
    print("======================================")
    print("")

    printer = await find_printer()

    if not printer:
        print("❌ PSF588 not found.")
        return

    print("")
    print(f"✅ Found: {printer.name}")
    print(f"Address: {printer.address}")
    print("")

    print("🔌 Connecting...")

    async with BleakClient(printer) as client:
        print("✅ Connected!")
        print("")

        print(
            "Connected:",
            client.is_connected
        )

        print("")

        await print_test(client)

    print("")
    print("🔌 Printer disconnected.")
    print("======================================")
    print("")


if __name__ == "__main__":
    asyncio.run(main())