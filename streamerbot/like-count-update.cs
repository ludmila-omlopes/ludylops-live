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
        int likeCount = ReadIntArg("likeCount");
        string broadcastId = FirstArg("broadcastId");
        bool isLive = ReadBoolArg("isLive");

        if (string.IsNullOrWhiteSpace(appBaseUrl) || string.IsNullOrWhiteSpace(sharedSecret) || likeCount <= 0)
        {
            CPH.LogWarn("[Loja Pipetz] Statistics Updated sem app, segredo ou likeCount.");
            return false;
        }

        string timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString();
        string occurredAt = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ");
        string eventId = string.Format("likes-{0}-{1}", string.IsNullOrWhiteSpace(broadcastId) ? "live" : broadcastId, timestamp);
        string body = BuildBody(eventId, likeCount, occurredAt, broadcastId, isLive);

        using (var request = new HttpRequestMessage(HttpMethod.Post, string.Format("{0}/api/internal/streamerbot/events", appBaseUrl.TrimEnd('/'))))
        {
            request.Content = new StringContent(body, Encoding.UTF8, "application/json");
            request.Headers.Add("x-timestamp", timestamp);
            request.Headers.Add("x-signature", BuildSignature(sharedSecret, timestamp, body));
            HttpResponseMessage response = Http.SendAsync(request).GetAwaiter().GetResult();
            string responseBody = response.Content.ReadAsStringAsync().GetAwaiter().GetResult();
            CPH.LogInfo(string.Format("[Loja Pipetz] like_count_update status={0} body={1}", (int)response.StatusCode, responseBody));
            return response.IsSuccessStatusCode;
        }
    }

    private string ReadRequiredGlobal(string variableName)
    {
        try { return CPH.GetGlobalVar<string>(variableName, true) ?? string.Empty; }
        catch { return string.Empty; }
    }

    private int ReadIntArg(string argName)
    {
        if (CPH.TryGetArg(argName, out int typedValue)) return typedValue;
        if (CPH.TryGetArg(argName, out string rawValue) && int.TryParse(rawValue, out int parsed)) return parsed;
        return 0;
    }

    private bool ReadBoolArg(string argName)
    {
        if (CPH.TryGetArg(argName, out bool typedValue)) return typedValue;
        if (CPH.TryGetArg(argName, out string rawValue)) return string.Equals(rawValue, "true", StringComparison.OrdinalIgnoreCase) || rawValue == "1";
        return false;
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

    private static string BuildBody(string eventId, int likeCount, string occurredAt, string broadcastId, bool isLive)
    {
        var builder = new StringBuilder();
        builder.Append("{");
        builder.AppendFormat("\"eventId\":\"{0}\"", Escape(eventId));
        builder.Append(",\"eventType\":\"like_count_update\"");
        builder.AppendFormat(",\"balance\":{0}", likeCount);
        builder.AppendFormat(",\"occurredAt\":\"{0}\"", occurredAt);
        builder.Append(",\"payload\":{");
        builder.Append("\"source\":\"streamerbot\"");
        builder.AppendFormat(",\"likeCount\":{0}", likeCount);
        builder.AppendFormat(",\"isLive\":{0}", isLive ? "true" : "false");
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
