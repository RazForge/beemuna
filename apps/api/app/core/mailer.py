import logging
import smtplib
from email.mime.text import MIMEText

from fastapi import HTTPException

from app.core.config import settings

logger = logging.getLogger(__name__)


def send_email(to: str, subject: str, html: str) -> None:
    if not settings.smtp_host or settings.environment == "development":
        print(f"[dev] Email -> {to}: {subject}")
        return

    msg = MIMEText(html, "html", "utf-8")
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from
    msg["To"] = to

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            server.starttls()
            if settings.smtp_user:
                server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)
    except smtplib.SMTPException as e:
        logger.error("Failed to send email to %s: %s", to, e)
        raise HTTPException(status_code=500, detail="Failed to send email")
