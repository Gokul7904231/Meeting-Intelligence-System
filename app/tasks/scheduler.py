from __future__ import annotations

import logging
import asyncio
from datetime import datetime, timezone
from apscheduler.schedulers.background import BackgroundScheduler

from app.db.database import get_session_local
from app.services import action_item_service
from app.integrations import notifier

logger = logging.getLogger(__name__)
scheduler = BackgroundScheduler()


def check_and_notify_overdue_items() -> None:
    """
    Cron job task that queries for overdue action items and dispatches a notification.
    """
    logger.info("Executing periodic overdue action item checks...")
    db_session_factory = get_session_local()
    db = db_session_factory()
    try:
        overdue_items = action_item_service.get_overdue_action_items(db)
        if overdue_items:
            logger.info(f"Found {len(overdue_items)} overdue action items. Notifying...")
            serialized = [
                {
                    "id": item.id,
                    "task": item.task,
                    "assignee": item.assignee,
                    "dueDate": item.due_date.strftime('%Y-%m-%d')
                }
                for item in overdue_items
            ]
            
            # Dispatch async notification safely
            try:
                loop = asyncio.get_running_loop()
                loop.create_task(notifier.send_overdue_notification(serialized))
            except RuntimeError:
                asyncio.run(notifier.send_overdue_notification(serialized))
        else:
            logger.info("No overdue action items found.")
    except Exception as e:
        logger.error(f"Error checking overdue action items in scheduler: {e}")
    finally:
        db.close()


def start_scheduler() -> None:
    """
    Starts the background scheduler job. Runs every hour.
    """
    if not scheduler.running:
        scheduler.add_job(
            check_and_notify_overdue_items,
            trigger="interval",
            hours=1,
            id="overdue_notifier_job",
            replace_existing=True
        )
        scheduler.start()
        logger.info("Background scheduler started successfully.")


def shutdown_scheduler() -> None:
    """
    Shuts down the background scheduler.
    """
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Background scheduler shut down successfully.")
