"""Authentication API tests."""

import pytest
from httpx import AsyncClient


class TestAuthEndpoints:
    """Test authentication endpoints."""

    async def test_register_user(self, client: AsyncClient, test_user_data: dict):
        """Test user registration."""
        response = await client.post("/api/auth/register", json=test_user_data)

        assert response.status_code == 201
        data = response.json()
        assert data["username"] == test_user_data["username"]
        assert data["email"] == test_user_data["email"]
        assert "id" in data
        assert data["status"] == "offline"
        assert data["privacy_mode"] == "fuzzy"

    async def test_register_duplicate_email(self, client: AsyncClient, test_user_data: dict):
        """Test registration with duplicate email."""
        # First registration
        await client.post("/api/auth/register", json=test_user_data)

        # Duplicate email
        duplicate_data = test_user_data.copy()
        duplicate_data["username"] = "different"
        response = await client.post("/api/auth/register", json=duplicate_data)

        assert response.status_code == 400

    async def test_login_success(self, client: AsyncClient, test_user_data: dict):
        """Test successful login."""
        # Register first
        await client.post("/api/auth/register", json=test_user_data)

        # Login
        login_data = {
            "email": test_user_data["email"],
            "password": test_user_data["password"]
        }
        response = await client.post("/api/auth/login", json=login_data)

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert "user" in data
        assert data["user"]["email"] == test_user_data["email"]

    async def test_login_invalid_credentials(self, client: AsyncClient):
        """Test login with invalid credentials."""
        response = await client.post("/api/auth/login", json={
            "email": "nonexistent@example.com",
            "password": "wrongpass"
        })

        assert response.status_code == 401

    async def test_get_current_user(self, client: AsyncClient, test_user_data: dict):
        """Test getting current user profile."""
        # Register and login
        await client.post("/api/auth/register", json=test_user_data)
        login_response = await client.post("/api/auth/login", json={
            "email": test_user_data["email"],
            "password": test_user_data["password"]
        })
        token = login_response.json()["access_token"]

        # Get current user
        response = await client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["email"] == test_user_data["email"]

    async def test_get_current_user_without_token(self, client: AsyncClient):
        """Test getting current user without token."""
        response = await client.get("/api/auth/me")

        assert response.status_code == 401
