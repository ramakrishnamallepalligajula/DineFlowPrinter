import requests


def login(backend_url, email, password):
    url = (
        backend_url.rstrip("/")
        + "/api/auth/login"
    )

    payload = {
        "email": email,
        "password": password,
    }

    print("")
    print("🔐 Logging into DineFlow...")
    print("")

    response = requests.post(
        url,
        json=payload,
        timeout=60,
    )

    try:
        data = response.json()
    except Exception:
        data = {
            "message": response.text
        }

    if response.status_code != 200:
        raise RuntimeError(
            f"Login failed "
            f"({response.status_code}): "
            f"{data.get('message', data)}"
        )

    token = data.get("token")
    user = data.get("user")
    restaurant = data.get("restaurant")

    if not token:
        raise RuntimeError(
            "Login succeeded but no authentication token was returned."
        )

    if not user:
        raise RuntimeError(
            "Login succeeded but no user information was returned."
        )

    if not restaurant:
        raise RuntimeError(
            "Login succeeded but no restaurant information was returned."
        )

    print("")
    print("======================================")
    print("🟢 DINEFLOW LOGIN SUCCESSFUL")
    print("======================================")
    print("User:", user.get("name"))
    print("Role:", user.get("role"))
    print("Restaurant:", restaurant.get("name"))
    print("Restaurant ID:", user.get("restaurantId"))
    print("======================================")
    print("")

    return {
        "token": token,
        "user": user,
        "restaurant": restaurant,
    }