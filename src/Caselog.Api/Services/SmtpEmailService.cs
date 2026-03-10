using System.Net;
using System.Net.Mail;

namespace Caselog.Api.Services;

public sealed class SmtpEmailService(IConfiguration configuration, ILogger<SmtpEmailService> logger)
{
    public async Task SendWelcomeEmailAsync(string toEmail, CancellationToken cancellationToken)
    {
        var host = configuration["CASELOG_SMTP_HOST"];
        var from = configuration["CASELOG_SMTP_FROM"];

        if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(from))
        {
            return;
        }

        var port = int.TryParse(configuration["CASELOG_SMTP_PORT"], out var smtpPort) ? smtpPort : 587;
        var user = configuration["CASELOG_SMTP_USER"];
        var pass = configuration["CASELOG_SMTP_PASS"];

        using var message = new MailMessage(from, toEmail)
        {
            Subject = "Welcome to Caselog",
            Body = "Your Caselog account has been created. Please sign in and update your password.",
            IsBodyHtml = false
        };

        using var client = new SmtpClient(host, port)
        {
            EnableSsl = true
        };

        if (!string.IsNullOrWhiteSpace(user))
        {
            client.Credentials = new NetworkCredential(user, pass);
        }

        try
        {
            await client.SendMailAsync(message, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to send welcome email to {Email}", toEmail);
        }
    }
}
