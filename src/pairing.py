import requests


def pair_device(
    backend_url,
    pairing_code,
    name="DineFlow Mac Printer",
):
    url = (
        backend_url.rstrip("/")
        + "/api/printer-agent/pair"
    )

    payload = {
        "code": pairing_code,
        "name": name,
        "type": "MAC_AGENT",
        "capabilities": {
            "usb": False,
            "network": False,
            "bluetooth": True,
        },
    }

    print("")
    print("🔐 Pairing with DineFlow...")
    print("")

    response = requests.post(
        url,
        json=payload,
        timeout=15,
    )

    try:
        data = response.json()
    except Exception:
        data = {
            "message": response.text
        }

    if response.status_code != 201:
        raise RuntimeError(
            f"Pairing failed "
            f"({response.status_code}): "
            f"{data.get('message', data)}"
        )

    print("")
    print("======================================")
    print("🟢 PRINTER AGENT PAIRED")
    print("======================================")
    print(
        "Device ID:",
        data["deviceId"]
    )
    print(
        "Restaurant ID:",
        data["restaurantId"]
    )
    print("======================================")
    print("")

    return data