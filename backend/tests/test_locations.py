"""Location API tests."""

import pytest
from httpx import AsyncClient


class TestLocationEndpoints:
    """Test location endpoints."""

    async def test_create_location(self, client: AsyncClient, test_user_data: dict):
        """Test creating location."""
        # Register and login
        await client.post("/api/auth/register", json=test_user_data)
        login_response = await client.post("/api/auth/login", json={
            "email": test_user_data["email"],
            "password": test_user_data["password"]
        })
        token = login_response.json()["access_token"]

        # Create location
        location_data = {
            "latitude": 39.9042,
            "longitude": 116.4074
        }
        response = await client.post(
            "/api/locations/",
            json=location_data,
            headers={"Authorization": f"Bearer {token}"}
        )

        assert response.status_code == 201
        data = response.json()
        assert data["latitude"] == 39.9042
        assert data["longitude"] == 116.4074
        assert data["fuzzy_latitude"] is not None
        assert data["fuzzy_longitude"] is not None
        # Fuzzy location should be different from exact
        assert abs(data["fuzzy_latitude"] - 39.9042) > 0 or abs(data["fuzzy_longitude"] - 116.4074) > 0

    async def test_get_my_location(self, client: AsyncClient, test_user_data: dict):
        """Test getting current user's location."""
        # Register, login, and create location
        await client.post("/api/auth/register", json=test_user_data)
        login_response = await client.post("/api/auth/login", json={
            "email": test_user_data["email"],
            "password": test_user_data["password"]
        })
        token = login_response.json()["access_token"]

        await client.post(
            "/api/locations/",
            json={"latitude": 39.9042, "longitude": 116.4074},
            headers={"Authorization": f"Bearer {token}"}
        )

        # Get location
        response = await client.get(
            "/api/locations/me",
            headers={"Authorization": f"Bearer {token}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["latitude"] == 39.9042

    async def test_get_nearby_users(self, client: AsyncClient, test_user_data: dict):
        """Test finding nearby users."""
        # Create two users at nearby locations
        user1_data = test_user_data.copy()
        user1_data["email"] = "user1@example.com"
        user1_data["username"] = "user1"

        user2_data = test_user_data.copy()
        user2_data["email"] = "user2@example.com"
        user2_data["username"] = "user2"

        # Register both users
        await client.post("/api/auth/register", json=user1_data)
        await client.post("/api/auth/register", json=user2_data)

        # Login as user1
        login_response = await client.post("/api/auth/login", json={
            "email": user1_data["email"],
            "password": user1_data["password"]
        })
        token1 = login_response.json()["access_token"]

        # Login as user2 and set location (very close to user1)
        login_response2 = await client.post("/api/auth/login", json={
            "email": user2_data["email"],
            "password": user2_data["password"]
        })
        token2 = login_response2.json()["access_token"]

        # User2 sets location
        await client.post(
            "/api/locations/",
            json={"latitude": 39.9043, "longitude": 116.4075},
            headers={"Authorization": f"Bearer {token2}"}
        )

        # Update user2 status to studying
        await client.put(
            "/api/auth/me",
            json={"status": "studying"},
            headers={"Authorization": f"Bearer {token2}"}
        )

        # User1 sets location
        await client.post(
            "/api/locations/",
            json={"latitude": 39.9042, "longitude": 116.4074},
            headers={"Authorization": f"Bearer {token1}"}
        )

        # User1 updates status to studying
        await client.put(
            "/api/auth/me",
            json={"status": "studying"},
            headers={"Authorization": f"Bearer {token1}"}
        )

        # Find nearby users (should return user2)
        response = await client.get(
            "/api/locations/nearby?latitude=39.9042&longitude=116.4074&radius_km=1",
            headers={"Authorization": f"Bearer {token1}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1  # At least user2 should be nearby

    async def test_delete_location(self, client: AsyncClient, test_user_data: dict):
        """Test deleting location."""
        # Register and login
        await client.post("/api/auth/register", json=test_user_data)
        login_response = await client.post("/api/auth/login", json={
            "email": test_user_data["email"],
            "password": test_user_data["password"]
        })
        token = login_response.json()["access_token"]

        # Create location
        await client.post(
            "/api/locations/",
            json={"latitude": 39.9042, "longitude": 116.4074},
            headers={"Authorization": f"Bearer {token}"}
        )

        # Delete location
        response = await client.delete(
            "/api/locations/",
            headers={"Authorization": f"Bearer {token}"}
        )

        assert response.status_code == 200
        assert response.json()["message"] == "Location deleted successfully"

        # Verify location is deleted
        response = await client.get(
            "/api/locations/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 404

    async def test_location_validation(self, client: AsyncClient, test_user_data: dict):
        """Test location coordinate validation."""
        # Register and login
        await client.post("/api/auth/register", json=test_user_data)
        login_response = await client.post("/api/auth/login", json={
            "email": test_user_data["email"],
            "password": test_user_data["password"]
        })
        token = login_response.json()["access_token"]

        # Invalid latitude (> 90)
        response = await client.post(
            "/api/locations/",
            json={"latitude": 100, "longitude": 116.4074},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 422  # Validation error

        # Invalid longitude (> 180)
        response = await client.post(
            "/api/locations/",
            json={"latitude": 39.9042, "longitude": 200},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 422
