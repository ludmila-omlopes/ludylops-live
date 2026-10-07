using System;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

public class CPHInline
{
    // Only the existing Ludylops installation may opt in while legacy auth remains enabled.
    // Never switch authentication automatically after an error or a missing credential.
    private const bool UseLegacyAuthentication = false;
    private static readonly HttpClient Http = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };

    public bool Execute()
    {
        string appBaseUrl = ReadGlobal("lojaneon.appBaseUrl");
        string credentialId = ReadGlobal("lojaneon.streamerbotCredentialId");
        string secret = ReadGlobal(UseLegacyAuthentication ? "lojaneon.streamerbotSharedSecret" : "lojaneon.streamerbotCredentialSecret");
        string messageId = ReadArg("messageId");
        Uri appUri;
        if (!Uri.TryCreate(appBaseUrl, UriKind.Absolute, out appUri) ||
            (appUri.Scheme != "https" && !(appUri.Scheme == "http" && appUri.IsLoopback)) ||
            !string.IsNullOrEmpty(appUri.UserInfo) || (!UseLegacyAuthentication && string.IsNullOrWhiteSpace(credentialId)) ||
            string.IsNullOrWhiteSpace(secret) || string.IsNullOrWhiteSpace(messageId))
        {
            CPH.LogWarn("[Super Sticker] Configure URL, credencial e trigger YouTube > Chat > Super Sticker. messageId é obrigatório.");
            return false;
        }
        var payload = new JObject {
            ["messageId"] = messageId,
            ["displayName"] = ReadArg("user"),
            ["amount"] = ReadArg("amount"),
            ["stickerId"] = ReadArg("stickerId"),
            ["stickerAltText"] = ReadArg("stickerAltText"),
            ["stickerImageUrl"] = ReadArg("stickerImageUrl")
        };
        string body = payload.ToString(Formatting.None);
        string timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString();
        try
        {
            using (var request = new HttpRequestMessage(HttpMethod.Post, appBaseUrl.TrimEnd('/') + "/api/internal/streamerbot/stickers"))
            {
                request.Content = new StringContent(body, Encoding.UTF8, "application/json");
                if (!UseLegacyAuthentication) request.Headers.Add("x-streamerbot-credential-id", credentialId);
                request.Headers.Add("x-timestamp", timestamp);
                request.Headers.Add("x-signature", UseLegacyAuthentication ? BuildLegacySignature(secret, timestamp, body) : BuildSignature(secret, timestamp, body, credentialId));
                using (var response = Http.SendAsync(request).GetAwaiter().GetResult())
                {
                    CPH.LogInfo(string.Format("[Super Sticker] HTTP {0}", (int)response.StatusCode));
                    return response.IsSuccessStatusCode;
                }
            }
        }
        catch (Exception)
        {
            CPH.LogWarn("[Super Sticker] Falha ao enviar. Reexecute com o mesmo messageId para evitar duplicação.");
            return false;
        }
    }

    private string ReadGlobal(string name)
    {
        try { return CPH.GetGlobalVar<string>(name, true) ?? string.Empty; }
        catch { return string.Empty; }
    }

    private string ReadArg(string name)
    {
        string value;
        return CPH.TryGetArg(name, out value) ? value ?? string.Empty : string.Empty;
    }

    private static string BuildSignature(string secret, string timestamp, string body, string credentialId)
    {
        using (var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret)))
        {
            byte[] hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(string.Format("v2\n{0}\n{1}\nPOST\n/api/internal/streamerbot/stickers\n{2}", timestamp, credentialId, body)));
            return BitConverter.ToString(hash).Replace("-", "").ToLowerInvariant();
        }
    }

    private static string BuildLegacySignature(string secret, string timestamp, string body)
    {
        using (var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret)))
        {
            byte[] hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(timestamp + "." + body));
            return BitConverter.ToString(hash).Replace("-", "").ToLowerInvariant();
        }
    }
}
