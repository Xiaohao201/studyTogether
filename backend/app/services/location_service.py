"""Location service for geospatial queries and location management."""

import uuid
import random
from datetime import datetime, timedelta
from typing import Optional, List
from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession
from geoalchemy2 import functions as geofunc
from geoalchemy2.types import Geography

from app.models.location import UserLocation
from app.models.user import User
from app.core.config import get_settings

settings = get_settings()


class LocationService:
    """Service for location operations and PostGIS queries."""

    def __init__(self, db: AsyncSession):
        """Initialize location service with database session."""
        self.db = db

    def generate_fuzzy_location(
        self,
        latitude: float,
        longitude: float,
        accuracy_km: float = None
    ) -> tuple[float, float]:
        """
        Generate fuzzy location by adding random jitter to coordinates.

        This creates ~1km accuracy for privacy protection.
        Random offset is approximately ±500m radius.

        Args:
            latitude: Exact latitude
            longitude: Exact longitude
            accuracy_km: Accuracy radius in km (default from settings)

        Returns:
            Tuple of (fuzzy_latitude, fuzzy_longitude)
        """
        if accuracy_km is None:
            accuracy_km = settings.FUZZY_LOCATION_ACCURACY_KM

        # Random offset in decimal degrees
        # 1 degree ≈ 111km at equator
        offset_range = accuracy_km / 111.0
        lat_offset = random.uniform(-offset_range, offset_range)
        lng_offset = random.uniform(-offset_range, offset_range)

        fuzzy_lat = latitude + lat_offset
        fuzzy_lng = longitude + lng_offset

        # Clamp to valid ranges
        fuzzy_lat = max(-90, min(90, fuzzy_lat))
        fuzzy_lng = max(-180, min(180, fuzzy_lng))

        return (fuzzy_lat, fuzzy_lng)

    async def create_location(
        self,
        user_id: str,
        latitude: float,
        longitude: float,
        city: Optional[str] = None,
        district: Optional[str] = None,
        country_code: Optional[str] = None
    ) -> UserLocation:
        """
        Create a new location record for user.

        Generates fuzzy location and creates PostGIS point objects.

        Args:
            user_id: User UUID
            latitude: Exact latitude
            longitude: Exact longitude
            city: City name (from geocoding)
            district: District name (from geocoding)
            country_code: ISO 3166-1 alpha-2 country code

        Returns:
            Created UserLocation object
        """
        from sqlalchemy.sql import text

        # Generate fuzzy location
        fuzzy_lat, fuzzy_lng = self.generate_fuzzy_location(latitude, longitude)

        # Create location record
        location = UserLocation(
            id=uuid.uuid4(),
            user_id=uuid.UUID(user_id),
            latitude=latitude,
            longitude=longitude,
            fuzzy_latitude=fuzzy_lat,
            fuzzy_longitude=fuzzy_lng,
            city=city,
            district=district,
            country_code=country_code,
        )

        # Create PostGIS point objects using WKT (Well-Known Text)
        # Format: POINT(longitude latitude) - note the order!
        location.coordinates = text(f"SRID=4326;POINT({longitude} {latitude})")
        location.fuzzy_coordinates = text(f"SRID=4326;POINT({fuzzy_lng} {fuzzy_lat})")

        self.db.add(location)
        await self.db.commit()
        await self.db.refresh(location)

        return location

    async def find_nearby_users(
        self,
        latitude: float,
        longitude: float,
        radius_km: float = 5.0,
        user_id: Optional[str] = None,
        privacy_filter: List[str] = None
    ) -> List[dict]:
        """
        Find nearby users using PostGIS spatial queries.

        Uses ST_DWithin for efficient proximity search with GiST index.

        Args:
            latitude: Center point latitude
            longitude: Center point longitude
            radius_km: Search radius in kilometers
            user_id: Exclude this user ID from results (optional)
            privacy_filter: List of privacy modes to include (default: ['fuzzy'])

        Returns:
            List of nearby users with distance in meters
        """
        from sqlalchemy import cast, Float

        if privacy_filter is None:
            privacy_filter = ['fuzzy', 'exact']

        # Convert radius to meters
        radius_meters = radius_km * 1000

        # PostGIS query with ST_DWithin (index-aware)
        # Note: ST_MakePoint takes (longitude, latitude) - order matters!
        query = (
            select(
                User,
                UserLocation,
                geofunc.ST_DistanceSphere(
                    UserLocation.fuzzy_coordinates,
                    geofunc.ST_MakePoint(longitude, latitude)
                ).label('distance_meters')
            )
            .join(UserLocation, User.id == UserLocation.user_id)
            .where(User.privacy_mode.in_(privacy_filter))
            .where(
                geofunc.ST_DWithin(
                    UserLocation.fuzzy_coordinates,
                    geofunc.ST_MakePoint(longitude, latitude),
                    radius_meters
                )
            )
            .where(User.status == 'studying')  # Only active learners
            .order_by('distance_meters')
            .limit(100)
        )

        # Exclude current user if specified
        if user_id:
            query = query.where(User.id != uuid.UUID(user_id))

        result = await self.db.execute(query)
        rows = result.all()

        # Format results
        nearby_users = []
        for row in rows:
            user, location, distance = row
            nearby_users.append({
                'user': user,
                'location': location,
                'distance_meters': distance if distance else 0
            })

        return nearby_users

    async def get_latest_location(self, user_id: str) -> Optional[UserLocation]:
        """
        Get latest location for a user.

        Args:
            user_id: User UUID

        Returns:
            Latest UserLocation object or None
        """
        query = (
            select(UserLocation)
            .where(UserLocation.user_id == uuid.UUID(user_id))
            .order_by(UserLocation.created_at.desc())
            .limit(1)
        )

        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def cleanup_old_locations(self, retention_days: int = None) -> int:
        """
        Delete location records older than retention period (GDPR compliance).

        Args:
            retention_days: Days to retain (default from settings)

        Returns:
            Number of deleted records
        """
        if retention_days is None:
            retention_days = settings.LOCATION_RETENTION_DAYS

        cutoff_date = datetime.utcnow() - timedelta(days=retention_days)

        query = (
            delete(UserLocation)
            .where(UserLocation.created_at < cutoff_date)
        )

        result = await self.db.execute(query)
        await self.db.commit()

        return result.rowcount

    async def get_user_location_count(self, user_id: str) -> int:
        """
        Get count of location records for a user.

        Args:
            user_id: User UUID

        Returns:
            Number of location records
        """
        query = (
            select(func.count())
            .select_from(UserLocation)
            .where(UserLocation.user_id == uuid.UUID(user_id))
        )

        result = await self.db.execute(query)
        return result.scalar() or 0
