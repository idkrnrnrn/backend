def register_hr(client, email: str, login: str, password: str = "StrongPass123"):
    return client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "login": login,
            "password": password,
            "invite_code": "TEST-INVITE-CODE",
        },
    )


def login_hr(client, email: str, password: str = "StrongPass123"):
    return client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )


def test_platform_endpoints_require_auth(hr_client):
    response = hr_client.get("/api/v1/vacancies")
    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated"


def test_register_login_me_logout_flow(hr_client):
    reg = register_hr(hr_client, email="hr1@example.com", login="hr_one")
    assert reg.status_code == 201
    assert reg.json()["email"] == "hr1@example.com"

    login = login_hr(hr_client, email="hr1@example.com")
    assert login.status_code == 200
    set_cookie = login.headers.get("set-cookie", "")
    assert "hr_access_token=" in set_cookie
    assert "HttpOnly" in set_cookie

    me = hr_client.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.json()["login"] == "hr_one"

    logout = hr_client.post("/api/v1/auth/logout")
    assert logout.status_code == 204

    me_after_logout = hr_client.get("/api/v1/auth/me")
    assert me_after_logout.status_code == 401


def test_register_rejects_invalid_invite_code(hr_client):
    response = hr_client.post(
        "/api/v1/auth/register",
        json={
            "email": "hr2@example.com",
            "login": "hr_two",
            "password": "StrongPass123",
            "invite_code": "WRONG-CODE",
        },
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Invalid invitation code"


def test_register_rejects_duplicates_by_email_or_login(hr_client):
    first = register_hr(hr_client, email="dup@example.com", login="dup_login")
    assert first.status_code == 201

    duplicate_email = register_hr(hr_client, email="dup@example.com", login="another_login")
    assert duplicate_email.status_code == 409

    duplicate_login = register_hr(hr_client, email="new@example.com", login="dup_login")
    assert duplicate_login.status_code == 409
