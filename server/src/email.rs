//! Outgoing email over SMTP, used for password reset links.
//!
//! Configured entirely by environment variables, so any SMTP provider works
//! (Gmail with an app password, Fastmail, Postmark, Resend, SES, ...):
//!
//! - `SMTP_HOST`      e.g. `smtp.gmail.com`
//! - `SMTP_PORT`      `587` (STARTTLS, default) or `465` (implicit TLS)
//! - `SMTP_USERNAME`  login for the SMTP server
//! - `SMTP_PASSWORD`  password / app password
//! - `SMTP_FROM`      sender address (defaults to `SMTP_USERNAME`)
//! - `SMTP_FROM_NAME` sender display name (defaults to `Medici`)
//! - `APP_URL`        public URL of this Medici, e.g. `https://medici.example.com`
//!
//! Links are always built from `APP_URL`, never from the request's `Host`
//! header, which an attacker controls.
//!
//! Password reset is enabled only when host, username, password and app URL
//! are all set.

use std::sync::OnceLock;

use lettre::message::{Mailbox, header::ContentType};
use lettre::transport::smtp::authentication::Credentials;
use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};

pub struct EmailConfig {
    host: String,
    port: u16,
    username: String,
    password: String,
    from: Mailbox,
    app_url: String,
}

fn non_empty_env(name: &str) -> Option<String> {
    std::env::var(name)
        .ok()
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
}

/// The public URL of this Medici, without a trailing slash, if configured.
pub fn app_url() -> Option<String> {
    non_empty_env("APP_URL").map(|u| u.trim_end_matches('/').to_string())
}

pub fn password_reset_link(app_url: &str, token: &str) -> String {
    format!("{}/reset-password?token={}", app_url, token)
}

impl EmailConfig {
    fn from_env() -> Option<Self> {
        let host = non_empty_env("SMTP_HOST")?;
        let username = non_empty_env("SMTP_USERNAME")?;
        let password = non_empty_env("SMTP_PASSWORD")?;
        let app_url = app_url()?;

        let port = match non_empty_env("SMTP_PORT") {
            Some(p) => match p.parse() {
                Ok(port) => port,
                Err(_) => {
                    tracing::error!("SMTP_PORT is not a valid port; email is disabled");
                    return None;
                }
            },
            None => 587,
        };

        let from_address = non_empty_env("SMTP_FROM").unwrap_or_else(|| username.clone());
        let from_name = non_empty_env("SMTP_FROM_NAME").unwrap_or_else(|| "Medici".to_string());

        let from = match from_address.parse() {
            Ok(address) => Mailbox::new(Some(from_name), address),
            Err(_) => {
                tracing::error!("SMTP_FROM is not a valid email address; email is disabled");
                return None;
            }
        };

        Some(Self {
            host,
            port,
            username,
            password,
            from,
            app_url,
        })
    }

    fn transport(
        &self,
    ) -> Result<AsyncSmtpTransport<Tokio1Executor>, lettre::transport::smtp::Error> {
        let builder = if self.port == 465 {
            AsyncSmtpTransport::<Tokio1Executor>::relay(&self.host)?
        } else {
            AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(&self.host)?
        };

        Ok(builder
            .port(self.port)
            .credentials(Credentials::new(
                self.username.clone(),
                self.password.clone(),
            ))
            .build())
    }

    pub fn app_url(&self) -> &str {
        &self.app_url
    }
}

/// The email configuration, read once at first use. `None` means email (and
/// so password reset by email) is turned off.
pub fn config() -> Option<&'static EmailConfig> {
    static CONFIG: OnceLock<Option<EmailConfig>> = OnceLock::new();
    CONFIG.get_or_init(EmailConfig::from_env).as_ref()
}

pub async fn send_password_reset(
    config: &EmailConfig,
    to_name: &str,
    to_email: &str,
    link: &str,
) -> anyhow::Result<()> {
    let to = Mailbox::new(Some(to_name.to_string()), to_email.parse()?);

    let body = format!(
        "Hi {name},\n\n\
         Someone asked to reset the password for your Medici account. If that was you, \
         open this link to choose a new password:\n\n\
         {link}\n\n\
         The link works once and expires in {ttl} minutes.\n\n\
         If you didn't ask for this, you can ignore this email. Your password won't change.\n",
        name = to_name,
        link = link,
        ttl = server::PASSWORD_RESET_TTL_MINUTES,
    );

    let message = Message::builder()
        .from(config.from.clone())
        .to(to)
        .subject("Reset your Medici password")
        .header(ContentType::TEXT_PLAIN)
        .body(body)?;

    config.transport()?.send(message).await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    /// Connects to Gmail's SMTP server and negotiates STARTTLS without
    /// logging in. Needs network, so run it on purpose:
    /// `cargo test --bin server -- --ignored smtp`
    #[tokio::test]
    #[ignore]
    async fn smtp_starttls_handshake_works() {
        use lettre::{AsyncSmtpTransport, Tokio1Executor};

        let transport: AsyncSmtpTransport<Tokio1Executor> =
            AsyncSmtpTransport::<Tokio1Executor>::starttls_relay("smtp.gmail.com")
                .unwrap()
                .port(587)
                .build();

        assert!(transport.test_connection().await.unwrap());
    }
}
