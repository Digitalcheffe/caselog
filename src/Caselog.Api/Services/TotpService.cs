using OtpNet;
using QRCoder;

namespace Caselog.Api.Services;

public sealed class TotpService
{
    private const string Issuer = "Caselog";

    public string GenerateSecret()
    {
        var bytes = KeyGeneration.GenerateRandomKey(20);
        return Base32Encoding.ToString(bytes);
    }

    public string BuildQrCodeDataUri(string email, string secret)
    {
        var otpUri = new OtpUri(OtpType.Totp, Base32Encoding.ToBytes(secret), email, Issuer).ToString();
        using var generator = new QRCodeGenerator();
        using var qrData = generator.CreateQrCode(otpUri, QRCodeGenerator.ECCLevel.Q);
        var png = new PngByteQRCode(qrData);
        var bytes = png.GetGraphic(8);
        return $"data:image/png;base64,{Convert.ToBase64String(bytes)}";
    }

    public bool VerifyCode(string secret, string code)
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            return false;
        }

        var totp = new Totp(Base32Encoding.ToBytes(secret));
        return totp.VerifyTotp(code.Trim(), out _, VerificationWindow.RfcSpecifiedNetworkDelay);
    }
}
