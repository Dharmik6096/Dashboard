"""
Gmail Notification Service — sends alert emails via Gmail SMTP (App Password).
Setup: Google Account → Security → 2-Step Verification → App Passwords → Generate
"""
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime
import structlog

from app.config import settings

log = structlog.get_logger()


def _build_html_body(
    severity: str,
    title: str,
    message: str,
    server_name: str,
    container_name: str | None,
    current_value: float | None,
    threshold: float | None,
    metric_name: str | None,
    fired_at: datetime,
    details: dict | None = None,
) -> str:
    severity_color = {
        "critical": "#ef4444",
        "warning": "#f59e0b",
        "info": "#3b82f6",
    }.get(severity.lower(), "#6b7280")

    severity_icon = {
        "critical": "🔴",
        "warning": "⚠️",
        "info": "ℹ️",
    }.get(severity.lower(), "📢")

    extra_rows = ""
    if current_value is not None and metric_name:
        extra_rows += f"""
        <tr><td style="color:#9ca3af;padding:6px 0">Current Value</td>
            <td style="color:#f1f5f9;font-weight:600">{current_value:.1f}%</td></tr>"""
    if threshold is not None:
        extra_rows += f"""
        <tr><td style="color:#9ca3af;padding:6px 0">Threshold</td>
            <td style="color:#f1f5f9">{threshold:.1f}%</td></tr>"""
    if container_name:
        extra_rows += f"""
        <tr><td style="color:#9ca3af;padding:6px 0">Container</td>
            <td style="color:#f1f5f9">{container_name}</td></tr>"""

    return f"""
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0a0e1a;font-family:'Segoe UI',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 20px">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#111827;border-radius:12px;overflow:hidden;border:1px solid #1f2937">
        <!-- Header -->
        <tr>
          <td style="background:{severity_color};padding:20px 30px">
            <div style="color:#fff;font-size:22px;font-weight:700">
              {severity_icon} {severity.upper()} ALERT
            </div>
            <div style="color:rgba(255,255,255,0.8);font-size:13px;margin-top:4px">
              DevOps Monitoring Dashboard
            </div>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:30px">
            <h2 style="color:#f1f5f9;margin:0 0 8px 0;font-size:18px">{title}</h2>
            <p style="color:#9ca3af;margin:0 0 24px 0;line-height:1.6">{message}</p>

            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:#1f2937;border-radius:8px;padding:16px;margin-bottom:24px">
              <tr><td style="color:#9ca3af;padding:6px 0">Server</td>
                  <td style="color:#f1f5f9;font-weight:600">{server_name}</td></tr>
              {extra_rows}
              <tr><td style="color:#9ca3af;padding:6px 0">Time</td>
                  <td style="color:#f1f5f9">{fired_at.strftime('%Y-%m-%d %H:%M:%S UTC')}</td></tr>
            </table>

            <p style="color:#6b7280;font-size:12px;margin:0">
              This is a read-only monitoring alert. No automatic actions have been taken.
              Login to the DevOps Dashboard to investigate.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#0d1117;padding:16px 30px;text-align:center">
            <span style="color:#4b5563;font-size:12px">DevOps Monitoring Dashboard — Automated Alert</span>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


async def send_alert_email(
    to_email: str,
    severity: str,
    title: str,
    message: str,
    server_name: str,
    container_name: str | None = None,
    current_value: float | None = None,
    threshold: float | None = None,
    metric_name: str | None = None,
    fired_at: datetime | None = None,
    details: dict | None = None,
) -> bool:
    """Send alert email via Gmail SMTP. Returns True on success."""
    if not settings.GMAIL_SENDER or not settings.GMAIL_APP_PASSWORD:
        log.warning("gmail_not_configured", msg="Set GMAIL_SENDER and GMAIL_APP_PASSWORD in .env")
        return False

    fired_at = fired_at or datetime.utcnow()

    html_body = _build_html_body(
        severity=severity,
        title=title,
        message=message,
        server_name=server_name,
        container_name=container_name,
        current_value=current_value,
        threshold=threshold,
        metric_name=metric_name,
        fired_at=fired_at,
        details=details,
    )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"[{severity.upper()}] {title} — DevOps Dashboard"
    msg["From"] = f"DevOps Dashboard <{settings.GMAIL_SENDER}>"
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html"))

    try:
        context = ssl.create_default_context()
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.ehlo()
            server.starttls(context=context)
            server.login(settings.GMAIL_SENDER, settings.GMAIL_APP_PASSWORD)
            server.sendmail(settings.GMAIL_SENDER, to_email, msg.as_string())
        log.info("email_sent", to=to_email, title=title)
        return True
    except smtplib.SMTPAuthenticationError:
        log.error("gmail_auth_failed", msg="Check GMAIL_APP_PASSWORD — use App Password, not Gmail password")
        return False
    except Exception as e:
        log.error("email_send_failed", error=str(e))
        return False


async def send_telegram_alert(
    message: str,
    severity: str = "warning",
) -> bool:
    """Send Telegram notification if configured."""
    if not settings.TELEGRAM_BOT_TOKEN or not settings.TELEGRAM_CHAT_ID:
        return False

    import httpx
    icon = {"critical": "🔴", "warning": "⚠️", "info": "ℹ️"}.get(severity.lower(), "📢")
    text = f"{icon} *DevOps Alert*\n\n{message}"

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage",
                json={
                    "chat_id": settings.TELEGRAM_CHAT_ID,
                    "text": text,
                    "parse_mode": "Markdown",
                },
            )
            return resp.status_code == 200
    except Exception as e:
        log.error("telegram_send_failed", error=str(e))
        return False
