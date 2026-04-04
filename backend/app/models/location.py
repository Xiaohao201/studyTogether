"""UserLocation model with PostGIS support for geospatial queries."""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Numeric, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from geoalchemy2 import Geography

from app.core.database import Base


class UserLocation(Base):
    """
    User location model with PostGIS geospatial support.

    Stores both exact location (private) and fuzzy location (public).
    Uses PostGIS Geography type for spatial queries.

    Attributes:
        id: UUID primary key
        user_id: Foreign key to users table
        latitude: Exact GPS latitude (±90°, ~1m precision)
        longitude: Exact GPS longitude (±180°, ~1m precision)
        fuzzy_latitude: Jittered latitude for public display (~1km accuracy)
        fuzzy_longitude: Jittered longitude for public display
        coordinates: PostGIS Geography POINT (exact, private)
        fuzzy_coordinates: PostGIS Geography POINT (public, ~1km)
        country_code: ISO 3166-1 alpha-2 country code (cached geocoding)
        city: City name (cached geocoding)
        district: District name (cached geocoding)
        created_at: Location update timestamp
    """

    __tablename__ = "user_locations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # Exact location (private)
    latitude = Column(Numeric(10, 8), nullable=False)  # ~1m precision
    longitude = Column(Numeric(11, 8), nullable=False)

    # Fuzzy location (public, ~1km accuracy)
    fuzzy_latitude = Column(Numeric(10, 8), nullable=True)
    fuzzy_longitude = Column(Numeric(11, 8), nullable=True)

    # PostGIS Geography types (WGS84 SRID 4326)
    coordinates = Column(Geography('POINT', srid=4326, spatial_index=False))
    fuzzy_coordinates = Column(Geography('POINT', srid=4326))

    # Geocoding (cached)
    country_code = Column(String(2), nullable=True)  # ISO 3166-1 alpha-2
    city = Column(String(100), nullable=True)
    district = Column(String(100), nullable=True)

    # Timestamp
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Relationships
    user = relationship("User", back_populates="locations")

    # Indexes
    __table_args__ = (
        Index('idx_user_locations_user_created', 'user_id', 'created_at'),
    )

    def __repr__(self):
        return f"<UserLocation(id={self.id}, user_id={self.user_id}, lat={self.latitude}, lng={self.longitude})>"
