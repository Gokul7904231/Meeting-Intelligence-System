from __future__ import annotations

import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, func
from sqlalchemy.orm import relationship

from app.db.database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)

    meetings = relationship("Meeting", back_populates="organizer")


class Meeting(Base):
    __tablename__ = "meetings"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    meeting_date = Column(DateTime, default=func.now())
    transcript = Column(JSON, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"))

    organizer = relationship("User", back_populates="meetings")
    action_items = relationship("ActionItem", back_populates="meeting", cascade="all, delete-orphan")


class ActionItem(Base):
    __tablename__ = "action_items"
    id = Column(Integer, primary_key=True, index=True)
    task = Column(String, nullable=False)
    assignee = Column(String, nullable=False)
    status = Column(String, default="PENDING")  # PENDING, IN_PROGRESS, COMPLETED
    due_date = Column(DateTime, nullable=False)
    meeting_id = Column(Integer, ForeignKey("meetings.id"))
    citations = Column(JSON, nullable=True)

    meeting = relationship("Meeting", back_populates="action_items")
