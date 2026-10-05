import json
import os


DATA_DIRECTORY = "data"
DEVICE_FILE = os.path.join(
    DATA_DIRECTORY,
    "device.json"
)


def ensure_data_directory():
    os.makedirs(
        DATA_DIRECTORY,
        exist_ok=True
    )


def save_device(device):
    ensure_data_directory()

    with open(
        DEVICE_FILE,
        "w",
        encoding="utf-8"
    ) as file:
        json.dump(
            device,
            file,
            indent=2
        )


def load_device():
    if not os.path.exists(
        DEVICE_FILE
    ):
        return None

    with open(
        DEVICE_FILE,
        "r",
        encoding="utf-8"
    ) as file:
        return json.load(file)


def device_is_paired():
    return load_device() is not None