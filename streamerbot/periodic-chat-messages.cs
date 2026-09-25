using System;
using System.Globalization;
using System.Linq;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Newtonsoft.Json.Linq;

public class CPHInline
{
    private static readonly HttpClient Http = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };
    private const string Path = "/api/internal/streamerbot/periodic-messages";

    public bool Execute()
    {
        try
        {
            bool isTest;
            if (CPH.TryGetArg("isTest", out isTest) && isTest) return false;
            string origin = CPH.GetGlobalVar<string>("lojaneon.appBaseUrl", true);
            string credentialId = CPH.GetGlobalVar<string>("lojaneon.streamerbotCredentialId", true);
            string secret = CPH.GetGlobalVar<string>("lojaneon.streamerbotCredentialSecret", true);
            string channelId = CPH.GetGlobalVar<string>("lojaneon.periodicYoutubeChannelId", true);
            Uri baseUri;
            if (!Uri.TryCreate(origin, UriKind.Absolute, out baseUri) || baseUri.Scheme != "https"
                || !string.IsNullOrEmpty(baseUri.UserInfo) || baseUri.AbsolutePath != "/"
                || string.IsNullOrWhiteSpace(credentialId) || string.IsNullOrWhiteSpace(secret)
                || !Regex.IsMatch(channelId ?? "", "^UC[A-Za-z0-9_-]{22}$")) return false;

            // Never fall back to another monitored channel or an upcoming/ended broadcast.
            var broadcasts = CPH.YouTubeGetMonitoredBroadcasts();
            var live = broadcasts == null ? null : broadcasts.Where(b => b.ChannelId == channelId
                && string.Equals(b.Status, "live", StringComparison.OrdinalIgnoreCase)
                && !string.IsNullOrWhiteSpace(b.LiveChatId)).ToList();
            if (live == null || live.Count != 1) return true;
            string broadcastId = live[0].Id;
            var claim = Post(origin, credentialId, secret, new JObject { ["action"] = "claim", ["broadcastId"] = broadcastId, ["isLive"] = true });
            var message = claim["data"] as JObject;
            if (message == null) return true;
            string id = (string)message["id"], token = (string)message["token"], text = (string)message["text"];
            if ((string)message["broadcastId"] != broadcastId || string.IsNullOrWhiteSpace(text) || text.Length > 200) return false;
            var confirmation = Post(origin, credentialId, secret, new JObject {
                ["action"] = "confirm", ["id"] = id, ["token"] = token, ["broadcastId"] = broadcastId });
            if ((bool?)confirmation["data"]?["allowed"] != true) return true;
            // Check the local live state again after both network calls.
            var current = CPH.YouTubeGetMonitoredBroadcasts();
            if (current == null || !current.Any(b => b.Id == broadcastId && b.ChannelId == channelId
                && string.Equals(b.Status, "live", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(b.LiveChatId))) return true;
            string outcome = "sent", error = null;
            try { CPH.SendYouTubeMessage(text, true, true, broadcastId); }
            catch { outcome = "failed"; error = "O Streamer.bot não conseguiu chamar o envio ao YouTube."; }
            var ack = new JObject { ["action"] = "ack", ["id"] = id, ["token"] = token, ["outcome"] = outcome };
            if (error != null) ack["error"] = error;
            // Retry only the acknowledgement, never SendYouTubeMessage.
            try { Post(origin, credentialId, secret, ack); }
            catch { Post(origin, credentialId, secret, ack); }
            return outcome == "sent";
        }
        catch
        {
            CPH.LogWarn("[Mensagens periódicas] Operação indisponível; confira o último contato e a configuração. O envio não será repetido neste intervalo.");
            return false;
        }
    }

    private JObject Post(string origin, string credentialId, string secret, JObject payload)
    {
        string body = payload.ToString(Newtonsoft.Json.Formatting.None);
        string timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString(CultureInfo.InvariantCulture);
        string signature;
        using (var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret)))
        {
            byte[] hash = hmac.ComputeHash(Encoding.UTF8.GetBytes("v2\n" + timestamp + "\n" + credentialId + "\nPOST\n" + Path + "\n" + body));
            signature = BitConverter.ToString(hash).Replace("-", "").ToLowerInvariant();
        }
        using (var request = new HttpRequestMessage(HttpMethod.Post, origin.TrimEnd('/') + Path))
        {
            request.Headers.Add("x-streamerbot-credential-id", credentialId);
            request.Headers.Add("x-timestamp", timestamp);
            request.Headers.Add("x-signature", signature);
            request.Content = new StringContent(body, Encoding.UTF8, "application/json");
            using (var response = Http.SendAsync(request).GetAwaiter().GetResult())
            {
                if (!response.IsSuccessStatusCode) throw new InvalidOperationException("periodic_request_failed");
                var result = JObject.Parse(response.Content.ReadAsStringAsync().GetAwaiter().GetResult());
                if ((bool?)result["ok"] != true) throw new InvalidOperationException("periodic_request_failed");
                return result;
            }
        }
    }
}
