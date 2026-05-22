using System;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;

public class CPHInline
{
    private static readonly HttpClient Http = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };

    public bool Execute()
    {
        string appBaseUrl = ReadRequiredGlobal("lojaneon.appBaseUrl");
        string sharedSecret = ReadRequiredGlobal("lojaneon.streamerbotSharedSecret");
        string viewerExternalId = FirstArg("userId", "targetUserId", "user");
        string youtubeDisplayName = FirstArg("user", "userName", "displayName");
        string youtubeHandle = FirstArg("userName", "user");
        string broadcastId = FirstArg("broadcastId");

        if (string.IsNullOrWhiteSpace(appBaseUrl) || string.IsNullOrWhiteSpace(sharedSecret) || string.IsNullOrWhiteSpace(viewerExternalId))
        {
            CPH.LogWarn("[Loja Pipetz] New Subscriber sem app, segredo ou viewerExternalId.");
            return false;
        }

        string timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString();
        string occurredAt = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ");
        string eventId = string.Format("subscription-{0}-{1}", viewerExternalId, timestamp);
        string body = BuildBody(eventId, viewerExternalId, youtubeDisplayName, youtubeHandle, occurredAt, broadcastId);

        return PostSigned(appBaseUrl, sharedSecret, timestamp, body);
    }

    private bool PostSigned(string appBaseUrl, string sharedSecret, string timestamp, string body)
    {
        using (var request = new HttpRequestMessage(HttpMethod.Post, string.Format("{0}/api/internal/streamerbot/events", appBaseUrl.TrimEnd('/'))))
        {
            request.Content = new StringContent(body, Encoding.UTF8, "application/json");
            request.Headers.Add("x-timestamp", timestamp);
            request.Headers.Add("x-signature", BuildSignature(sharedSecret, timestamp, body));
            HttpResponseMessage response = Http.SendAsync(request).GetAwaiter().GetResult();
            string responseBody = response.Content.ReadAsStringAsync().GetAwaiter().GetResult();
            CPH.LogInfo(string.Format("[Loja Pipetz] channel_subscription status={0} body={1}", (int)response.StatusCode, responseBody));
            return response.IsSuccessStatusCode;
        }
    }

    private string ReadRequiredGlobal(string variableName)
    {
        try { return CPH.GetGlobalVar<string>(variableName, true) ?? string.Empty; }
        catch { return string.Empty; }
    }

    private string FirstArg(params string[] names)
    {
        foreach (string name in names)
        {
            if (args != null && args.ContainsKey(name) && args[name] != null)
            {
                string value = args[name].ToString().Trim();
                if (!string.IsNullOrWhiteSpace(value)) return value;
            }
            if (CPH.TryGetArg(name, out string typed) && !string.IsNullOrWhiteSpace(typed)) return typed.Trim();
        }
        return string.Empty;
    }

    private static string BuildBody(string eventId, string viewerExternalId, string youtubeDisplayName, string youtubeHandle, string occurredAt, string broadcastId)
    {
        var builder = new StringBuilder();
        builder.Append("{");
        builder.AppendFormat("\"eventId\":\"{0}\"", Escape(eventId));
        builder.Append(",\"eventType\":\"channel_subscription\"");
        builder.AppendFormat(",\"viewerExternalId\":\"{0}\"", Escape(viewerExternalId));
        if (!string.IsNullOrWhiteSpace(youtubeDisplayName)) builder.AppendFormat(",\"youtubeDisplayName\":\"{0}\"", Escape(youtubeDisplayName));
        if (!string.IsNullOrWhiteSpace(youtubeHandle)) builder.AppendFormat(",\"youtubeHandle\":\"{0}\"", Escape(youtubeHandle));
        builder.AppendFormat(",\"occurredAt\":\"{0}\"", occurredAt);
        builder.Append(",\"payload\":{\"source\":\"streamerbot\"");
        if (!string.IsNullOrWhiteSpace(broadcastId)) builder.AppendFormat(",\"broadcastId\":\"{0}\"", Escape(broadcastId));
        builder.Append("}}");
        return builder.ToString();
    }

    private static string BuildSignature(string secret, string timestamp, string body)
    {
        using (var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret)))
        {
            byte[] hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(string.Format("{0}.{1}", timestamp, body)));
            return BitConverter.ToString(hash).Replace("-", "").ToLowerInvariant();
        }
    }

    private static string Escape(string value)
    {
        return (value ?? string.Empty).Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", "\\r").Replace("\n", "\\n").Replace("\t", "\\t");
    }
}
