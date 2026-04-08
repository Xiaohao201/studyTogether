"""Location API endpoints."""

from fastapi import APIRouter, HTTPException, status, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.location import (
    LocationUpdate,
    LocationResponse,
    NearbyUserResponse,
    NearbyQueryParams,
)
from app.schemas.user import PublicUserResponse
from app.models.location import UserLocation
from app.dependencies import CurrentUser, DBSession
from app.services.location_service import LocationService

router = APIRouter()


@router.post("/", response_model=LocationResponse, status_code=status.HTTP_201_CREATED)
async def create_location(
    location_data: LocationUpdate,
    current_user: CurrentUser,
    db: DBSession,
):
    """
    Create/update user's current location.

    - **latitude**: Latitude in decimal degrees (-90 to 90)
    - **longitude**: Longitude in decimal degrees (-180 to 180)

    Automatically generates fuzzy location for privacy.
    Geocoding (city, district) will be added later.
    """
    location_service = LocationService(db)

    # Create location with fuzzy coordinates
    location = await location_service.create_location(
        user_id=str(current_user.id),
        latitude=location_data.latitude,
        longitude=location_data.longitude,
    )

    # Update user's last_seen_at
    from datetime import datetime
    current_user.last_seen_at = datetime.utcnow()
    await db.commit()

    return LocationResponse.model_validate(location)


@router.get("/me", response_model=LocationResponse)
async def get_my_location(
    current_user: CurrentUser,
    db: DBSession,
):
    """Get current user's latest location."""
    location_service = LocationService(db)
    location = await location_service.get_latest_location(str(current_user.id))

    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No location found. Please update your location first."
        )

    return LocationResponse.model_validate(location)


@router.delete("/")
async def delete_location(
    current_user: CurrentUser,
    db: DBSession,
):
    """
    Delete current user's location.

    This is equivalent to going "invisible" or clearing location data.
    """
    from sqlalchemy import delete

    # Delete all locations for this user
    query = (
        delete(UserLocation)
        .where(UserLocation.user_id == current_user.id)
    )
    await db.execute(query)
    await db.commit()

    return {"message": "Location deleted successfully"}


@router.get("/nearby", response_model=list[NearbyUserResponse])
async def get_nearby_users(
    db: DBSession,
    current_user: CurrentUser,
    latitude: float = Query(..., ge=-90, le=90, description="Center point latitude"),
    longitude: float = Query(..., ge=-180, le=180, description="Center point longitude"),
    radius_km: float = Query(default=5.0, ge=0.1, le=50.0, description="Search radius in kilometers"),
):
    """
    Find nearby users who are currently studying.

    - **latitude**: Your current latitude
    - **longitude**: Your current longitude
    - **radius_km**: Search radius (0.1 to 50 km, default 5 km)

    Returns users sorted by distance (nearest first).
    Excludes the requesting user from results.
    Only includes users with privacy_mode='fuzzy' or 'exact'.
    Only includes users with status='studying'.
    """
    location_service = LocationService(db)

    nearby = await location_service.find_nearby_users(
        latitude=latitude,
        longitude=longitude,
        radius_km=radius_km,
        user_id=str(current_user.id),
        privacy_filter=['fuzzy', 'exact']
    )

    # Debug logging
    print(f"[DEBUG] Nearby users query result: {len(nearby)} users found")
    for item in nearby:
        user = item['user']
        print(f"[DEBUG] User: {user.username}, Status: {user.status}, Privacy: {user.privacy_mode}")

    # Format response
    results = []
    for item in nearby:
        user = item['user']
        location = item['location']
        distance = item['distance_meters']

        results.append(NearbyUserResponse(
            id=str(user.id),
            username=user.username,
            subject=user.subject,
            status=user.status,
            distance_meters=round(distance, 2) if distance else 0,
            location={
                "latitude": float(location.fuzzy_latitude) if location.fuzzy_latitude else 0,
                "longitude": float(location.fuzzy_longitude) if location.fuzzy_longitude else 0,
            },
            city=location.city,
            district=location.district,
        ))

    print(f"[DEBUG] Returning {len(results)} nearby users to frontend")
    return results


@router.get("/stats")
async def get_location_stats(
    current_user: CurrentUser,
    db: DBSession,
):
    """Get current user's location statistics."""
    location_service = LocationService(db)

    count = await location_service.get_user_location_count(str(current_user.id))

    return {
        "user_id": str(current_user.id),
        "location_count": count,
    }
