from __future__ import annotations

import logging
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)


async def send_overdue_notification(overdue_items: list[dict]) -> bool:
    """
    Sends overdue action items to configured Discord and/or Slack webhook(s).
    If no webhooks are configured, logs the items locally.
    """
    if not overdue_items:
        return True

    # 1. Format and notify for Discord
    discord_url = settings.discord_webhook_url
    if discord_url:
        try:
            async with httpx.AsyncClient() as client:
                for item in overdue_items:
                    content = (
                        f"🚨 **Overdue Action Item Alert!**\n"
                        f"**Task:** {item['task']}\n"
                        f"**Assigned To:** {item['assignee']}\n"
                        f"**Due Date:** {item['dueDate']}"
                    )
                    payload = {"content": content}
                    response = await client.post(discord_url, json=payload, timeout=10.0)
                    response.raise_for_status()
            logger.info("Sent overdue notification to Discord Webhook.")
        except Exception as e:
            logger.error(f"Failed to notify Discord Webhook: {e}")

    # 2. Format and notify for Slack
    slack_url = settings.slack_webhook_url
    if slack_url and slack_url != "https://hooks.slack.com/services/...":
        try:
            async with httpx.AsyncClient() as client:
                blocks = ["*Overdue Action Items Alert!*"]
                for item in overdue_items:
                    blocks.append(f"• *{item['task']}* (Assignee: {item['assignee']}) - Due: {item['dueDate']}")
                payload = {"text": "\n".join(blocks)}
                response = await client.post(slack_url, json=payload, timeout=10.0)
                response.raise_for_status()
            logger.info("Sent overdue notification to Slack Webhook.")
        except Exception as e:
            logger.error(f"Failed to notify Slack Webhook: {e}")

    # 3. Fallback/Local Logging if neither is configured
    if not discord_url and (not slack_url or slack_url == "https://hooks.slack.com/services/..."):
        logger.warning("No Webhook URL configured. Overdue items logged locally:")
        for item in overdue_items:
            logger.warning(f"OVERDUE: Task: {item['task']}, Assignee: {item['assignee']}, Due: {item['dueDate']}")
            
    return True
