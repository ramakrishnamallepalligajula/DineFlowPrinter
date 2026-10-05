import asyncio
import os

from auth import login
from dotenv import load_dotenv

from pairing import pair_device
from psf588 import PSF588
from storage import save_device, load_device
from socket_client import DineFlowSocketClient


load_dotenv()


async def printer_test():

    print("")
    print("🔎 Testing PSF588...")
    print("")

    printer = PSF588()

    device = await printer.discover()

    if not device:
        print("❌ PSF588 not found.")
        return

    try:

        await printer.connect()

        print("")
        print("🖨️ Running test print...")
        print("")

        await printer.test_print()

        print("")
        print("✅ Test print successful")

    except Exception as error:

        print("")
        print("❌ Printer error:")
        print(error)

    finally:

        await printer.disconnect()


def run_pairing():

    backend = os.getenv("DINEFLOW_BACKEND_URL")

    if not backend:
        print("❌ DINEFLOW_BACKEND_URL is missing.")
        return

    print("")
    print("======================================")
    print("       DINEFLOW PRINTER PAIRING")
    print("======================================")
    print("")

    pairing_code = input(
        "Enter pairing code: "
    ).strip()

    if not pairing_code:
        print("❌ Pairing code is required.")
        return

    name = input(
        "Device name [DineFlow Mac Printer]: "
    ).strip()

    if not name:
        name = "DineFlow Mac Printer"

    try:

        result = pair_device(
            backend,
            pairing_code,
            name,
        )

        save_device(result)

        print("")
        print("======================================")
        print("🟢 PRINTER AGENT PAIRED")
        print("======================================")
        print("")
        print("Device ID:", result["deviceId"])
        print("Restaurant ID:", result["restaurantId"])
        print("")
        print("💾 Device credentials saved.")
        print("")
        print("You can now connect this agent to DineFlow.")

    except Exception as error:

        print("")
        print("❌ Pairing failed:")
        print(error)


async def start_agent():

    device = load_device()

    if not device:

        print("")
        print("❌ No paired DineFlow device found.")
        print("")
        print("Please pair this computer first.")

        return

    backend = os.getenv("DINEFLOW_BACKEND_URL")

    if not backend:

        print("")
        print("❌ DINEFLOW_BACKEND_URL is missing.")

        return

    device_id = device.get("deviceId")
    device_secret = device.get("deviceSecret")

    if not device_id:

        print("")
        print("❌ deviceId is missing from device.json.")

        return

    if not device_secret:

        print("")
        print("❌ deviceSecret is missing from device.json.")

        return

    print("")
    print("======================================")
    print("       DINEFLOW PRINTER AGENT")
    print("======================================")
    print("")

    # ----------------------------------
    # ADMIN LOGIN
    # ----------------------------------

    print("👤 DineFlow Admin Login")
    print("")

    email = input(
        "Email: "
    ).strip()

    password = input(
        "Password: "
    )

    if not email or not password:

        print("")
        print("❌ Email and password are required.")

        return

    try:

        session = login(
            backend,
            email,
            password,
        )

    except Exception as error:

        print("")
        print("❌ Login failed:")
        print(error)
        print("")

        return

    token = session["token"]

    restaurant_id = session["user"].get(
        "restaurantId"
    )

    if not restaurant_id:

        print("")
        print("❌ Restaurant ID missing from login.")

        return

    # ----------------------------------
    # VERIFY DEVICE RESTAURANT
    # ----------------------------------

    device_restaurant_id = device.get(
        "restaurantId"
    )

    if (
        device_restaurant_id
        and str(device_restaurant_id)
        != str(restaurant_id)
    ):

        print("")
        print("❌ RESTAURANT MISMATCH")
        print("")

        print(
            "Logged-in restaurant:",
            restaurant_id
        )

        print(
            "Paired device restaurant:",
            device_restaurant_id
        )

        print("")
        print(
            "This printer is paired with a different restaurant."
        )
        print("")

        return

    print("")
    print(
        "Restaurant:",
        session["restaurant"].get("name")
    )

    print(
        "Restaurant ID:",
        restaurant_id
    )

    print(
        "Device ID:",
        device_id
    )

    print("")

    # ----------------------------------
    # CONNECT TO PHYSICAL PRINTER
    # ----------------------------------

    print("🖨️ Initializing PSF588...")
    print("")

    printer = PSF588()

    try:

        await printer.connect()

        print("")
        print("✅ PSF588 ready")
        print("")

    except Exception as error:

        print("")
        print("❌ Could not connect to PSF588:")
        print(error)
        print("")

        return

    # ----------------------------------
    # CONNECT TO DINEFLOW
    # ----------------------------------

    client = DineFlowSocketClient(
        backend_url=backend,
        device_id=device_id,
        device_secret=device_secret,
        token=token,
        printer=printer,
        heartbeat_interval=int(
            os.getenv(
                "HEARTBEAT_INTERVAL",
                "10"
            )
        ),
    )

    try:

        await client.run()

    except KeyboardInterrupt:

        print("")
        print("🛑 Stopping Printer Agent...")

    except Exception as error:

        print("")
        print("❌ DineFlow connection error:")
        print(error)

    finally:

        await client.stop()

        await printer.disconnect()

        print("")
        print("👋 Printer Agent stopped.")


# ======================================
# MAIN MENU
# ======================================

def main():

    print("")
    print("======================================")
    print("       DINEFLOW PRINTER AGENT")
    print("======================================")
    print("")

    device = load_device()

    # ==================================
    # ALREADY PAIRED
    # ==================================

    if device:

        print("🟢 Agent is already paired.")
        print("")

        print(
            "Device ID:",
            device.get("deviceId")
        )

        print(
            "Restaurant ID:",
            device.get("restaurantId")
        )

        print("")

        print("1. Connect to DineFlow")
        print("2. Test printer")
        print("3. Pair another device")
        print("")

        choice = input(
            "Select option: "
        ).strip()

        if choice == "1":

            asyncio.run(
                start_agent()
            )

        elif choice == "2":

            asyncio.run(
                printer_test()
            )

        elif choice == "3":

            run_pairing()

        else:

            print("❌ Invalid option.")

        return

    # ==================================
    # NOT PAIRED
    # ==================================

    print(
        "No DineFlow device pairing found."
    )

    print("")

    print("1. Pair this computer")
    print("2. Test printer")
    print("")

    choice = input(
        "Select option: "
    ).strip()

    if choice == "1":

        run_pairing()

    elif choice == "2":

        asyncio.run(
            printer_test()
        )

    else:

        print("❌ Invalid option.")


# ======================================
# START APPLICATION
# ======================================

if __name__ == "__main__":
    main()