using System;
using System.Globalization;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

public class CPHInline
{
    private static readonly HttpClient Http = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };

    public bool Execute()
    {
        string appBaseUrl = ReadGlobal("lojaneon.appBaseUrl");
        string credentialId = ReadGlobal("lojaneon.streamerbotCredentialId");
        string secret = ReadGlobal("lojaneon.streamerbotCredentialSecret");
        string giftName = ReadArg("gift.name");
        string eventId = BuildEventId(giftName);
        Uri appUri;
        if (!Uri.TryCreate(appBaseUrl, UriKind.Absolute, out appUri) ||
            (appUri.Scheme != "https" && !(appUri.Scheme == "http" && appUri.IsLoopback)) ||
            !string.IsNullOrEmpty(appUri.UserInfo) || string.IsNullOrWhiteSpace(credentialId) ||
            string.IsNullOrWhiteSpace(secret) || string.IsNullOrWhiteSpace(eventId))
        {
            CPH.LogWarn("[Presente com joias] Configure URL, credencial e o trigger YouTube > Chat > Jewels Gifted.");
            return false;
        }
        var payload = new JObject {
            ["eventId"] = eventId,
            ["displayName"] = ReadArg("user"),
            ["giftName"] = giftName,
            ["giftAltText"] = ReadArg("gift.altText"),
            ["giftImageUrl"] = ReadArg("gift.url"),
            ["jewelsAmount"] = ReadInt("gift.jewelsAmount", 0),
            ["comboCount"] = Math.Max(1, ReadInt("gift.comboCount", 1))
        };
        string body = payload.ToString(Formatting.None);
        string timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString();
        try
        {
            using (var request = new HttpRequestMessage(HttpMethod.Post, appBaseUrl.TrimEnd('/') + "/api/internal/streamerbot/gifts"))
            {
                request.Content = new StringContent(body, Encoding.UTF8, "application/json");
                request.Headers.Add("x-streamerbot-credential-id", credentialId);
                request.Headers.Add("x-timestamp", timestamp);
                request.Headers.Add("x-signature", BuildSignature(secret, timestamp, body, credentialId));
                using (var response = Http.SendAsync(request).GetAwaiter().GetResult())
                {
                    CPH.LogInfo(string.Format("[Presente com joias] HTTP {0}", (int)response.StatusCode));
                    return response.IsSuccessStatusCode;
                }
            }
        }
        catch (Exception)
        {
            CPH.LogWarn("[Presente com joias] Falha ao enviar. Reexecute com os mesmos argumentos para evitar duplicação.");
            return false;
        }
    }

    // The trigger has no message id, so the key combines who sent it, when, which gift and the combo step.
    // A test action can set eventId directly.
    private string BuildEventId(string giftName)
    {
        string explicitId = ReadArg("eventId");
        if (!string.IsNullOrWhiteSpace(explicitId)) return explicitId;
        string userId = ReadArg("userId");
        string publishedAt = ReadArg("publishedAt");
        if (string.IsNullOrWhiteSpace(userId) || string.IsNullOrWhiteSpace(publishedAt)) return string.Empty;
        return string.Join("|", userId, publishedAt, giftName, ReadInt("gift.comboCount", 1).ToString(CultureInfo.InvariantCulture));
    }

    private string ReadGlobal(string name)
    {
        try { return CPH.GetGlobalVar<string>(name, true) ?? string.Empty; }
        catch { return string.Empty; }
    }

    private string ReadArg(string name)
    {
        object value;
        if (!CPH.TryGetArg(name, out value) || value == null) return string.Empty;
        if (value is DateTime) return ((DateTime)value).ToUniversalTime().ToString("o", CultureInfo.InvariantCulture);
        if (value is DateTimeOffset) return ((DateTimeOffset)value).ToUniversalTime().ToString("o", CultureInfo.InvariantCulture);
        return Convert.ToString(value, CultureInfo.InvariantCulture) ?? string.Empty;
    }

    private int ReadInt(string name, int fallback)
    {
        int value;
        return int.TryParse(ReadArg(name), NumberStyles.Integer, CultureInfo.InvariantCulture, out value) && value >= 0 ? value : fallback;
    }

    private static string BuildSignature(string secret, string timestamp, string body, string credentialId)
    {
        using (var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret)))
        {
            byte[] hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(string.Format("v2\n{0}\n{1}\nPOST\n/api/internal/streamerbot/gifts\n{2}", timestamp, credentialId, body)));
            return BitConverter.ToString(hash).Replace("-", "").ToLowerInvariant();
        }
    }
}
