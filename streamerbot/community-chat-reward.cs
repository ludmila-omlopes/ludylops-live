using System;
using System.Globalization;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

public class CPHInline
{
    private static readonly HttpClient Http = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };

    public bool Execute()
    {
        CPH.SetArgument("chatRewardHttpStatus", 0);
        CPH.SetArgument("chatRewardResponse", "");
        try
        {
            bool isTest;
            if (CPH.TryGetArg("isTest", out isTest) && isTest) return false;
            string origin = CPH.GetGlobalVar<string>("lojaneon.appBaseUrl", true);
            string credentialId = CPH.GetGlobalVar<string>("lojaneon.streamerbotCredentialId", true);
            string secret = CPH.GetGlobalVar<string>("lojaneon.streamerbotCredentialSecret", true);
            string channel, broadcast, messageId;
            if (string.IsNullOrWhiteSpace(origin) || string.IsNullOrWhiteSpace(credentialId) || string.IsNullOrWhiteSpace(secret)) return false;
            if (!CPH.TryGetArg("userId", out channel) || !Regex.IsMatch(channel ?? "", "^UC[A-Za-z0-9_-]{22}$")
                || !CPH.TryGetArg("broadcast.id", out broadcast) || !Regex.IsMatch(broadcast ?? "", "^[A-Za-z0-9_-]{1,128}$")
                || !CPH.TryGetArg("messageId", out messageId) || string.IsNullOrWhiteSpace(messageId)) return false;
            // Native event IDs are retained on retries. No message text or client-selected amount is sent.
            string body = "{\"viewerExternalId\":" + Json(channel) + ",\"broadcastId\":" + Json(broadcast)
                + ",\"messageId\":" + Json(messageId) + "}";
            string timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString(CultureInfo.InvariantCulture);
            using (var request = new HttpRequestMessage(HttpMethod.Post, origin.TrimEnd('/') + "/api/internal/streamerbot/chat-rewards"))
            {
                request.Headers.Add("x-streamerbot-credential-id", credentialId);
                request.Headers.Add("x-timestamp", timestamp);
                request.Headers.Add("x-signature", BuildSignature(body, timestamp, secret, credentialId));
                request.Content = new StringContent(body, Encoding.UTF8, "application/json");
                using (var response = Http.SendAsync(request).GetAwaiter().GetResult())
                {
                    CPH.SetArgument("chatRewardResponse", response.Content.ReadAsStringAsync().GetAwaiter().GetResult());
                    CPH.SetArgument("chatRewardHttpStatus", (int)response.StatusCode);
                    if (!response.IsSuccessStatusCode) CPH.LogWarn("[Ganhos no chat] HTTP " + (int)response.StatusCode);
                    return response.IsSuccessStatusCode;
                }
            }
        }
        catch
        {
            CPH.LogWarn("[Ganhos no chat] Resposta indisponível. Ao repetir, preserve userId, broadcast.id e messageId.");
            return false;
        }
    }
    private string BuildSignature(string body, string timestamp, string secret, string credentialId)
    {
        using (var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret)))
        {
            byte[] hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(string.Format("v2\n{0}\n{1}\nPOST\n/api/internal/streamerbot/chat-rewards\n{2}", timestamp, credentialId, body)));
            return BitConverter.ToString(hash).Replace("-", "").ToLowerInvariant();
        }
    }
    private string Json(string value)
    {
        var result = new StringBuilder("\"");
        foreach (char c in value ?? "")
        {
            if (c == '\\' || c == '"') result.Append('\\').Append(c);
            else if (c < 32) result.Append("\\u").Append(((int)c).ToString("x4"));
            else result.Append(c);
        }
        return result.Append('"').ToString();
    }
}
