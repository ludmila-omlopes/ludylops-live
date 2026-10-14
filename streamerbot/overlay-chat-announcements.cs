using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using Newtonsoft.Json.Linq;

public class CPHInline
{
    private static readonly HttpClient Http = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };

    // Run once every two seconds in ONE dedicated timed action. Public feeds only;
    // credentials and OBS browser sources must never send messages themselves.
    public bool Execute()
    {
        try
        {
            bool isTest;
            if (CPH.TryGetArg("isTest", out isTest) && isTest) return false;
            string origin = ReadGlobal("lojaneon.appBaseUrl");
            string channelId = ReadGlobal("lojaneon.overlayChatYoutubeChannelId");
            string creator = ReadGlobal("lojaneon.overlayChatCreatorSlug");
            Uri uri;
            if (!Uri.TryCreate(origin, UriKind.Absolute, out uri) || uri.Scheme != "https"
                || !string.IsNullOrEmpty(uri.UserInfo) || uri.AbsolutePath != "/"
                || !string.IsNullOrEmpty(uri.Query) || !string.IsNullOrEmpty(uri.Fragment)
                || !Regex.IsMatch(channelId, "^UC[A-Za-z0-9_-]{22}$")) return false;
            if (!string.IsNullOrEmpty(creator) && !Regex.IsMatch(creator, "^[a-z0-9]+(?:-[a-z0-9]+)*$")) return false;

            string scope = Digest(uri.GetLeftPart(UriPartial.Authority) + "|" + creator + "|" + channelId);
            using (var mutex = new Mutex(false, "LudylopsOverlayChat-" + scope))
            {
                bool entered = false;
                try
                {
                    try { entered = mutex.WaitOne(0); }
                    catch (AbandonedMutexException) { entered = true; }
                    if (!entered) return true;
                    string broadcastId = LiveBroadcast(channelId);
                    if (broadcastId == null) return true;
                    string suffix = string.IsNullOrEmpty(creator) ? "" : "?creator=" + Uri.EscapeDataString(creator);
                    string baseUrl = uri.GetLeftPart(UriPartial.Authority);
                    var live = Get(baseUrl + "/api/obs/live-status" + suffix);
                    if ((bool?)live?["data"]?["isLive"] != true) return true;

                    string key = "lojaneon.overlayChatSeen." + scope;
                    string saved = ReadGlobal(key);
                    // A corrupt ledger must stop sending, not silently replay old alerts.
                    var seen = string.IsNullOrEmpty(saved) ? new JObject() : JObject.Parse(saved);
                    long cutoff = DateTimeOffset.UtcNow.AddDays(-1).ToUnixTimeMilliseconds();
                    foreach (var property in seen.Properties().ToList())
                        if (property.Value.Type == JTokenType.Integer && (long)property.Value < cutoff) property.Remove();

                    // An unavailable feed does not block the other one.
                    try
                    {
                        var quote = Get(baseUrl + "/api/obs/quotes/current" + suffix)?["data"] as JObject;
                        DateTimeOffset expires;
                        if (quote != null && DateTimeOffset.TryParse((string)quote["expiresAt"], out expires)
                            && expires > DateTimeOffset.UtcNow && !string.IsNullOrEmpty((string)quote["overlayId"]))
                        {
                            string body = Clean((string)quote["quoteBody"]);
                            if (body.Length > 0)
                            {
                                string text = "Quote #" + (string)quote["quoteNumber"] + ": “" + body + "”";
                                string author = Clean((string)quote["createdByDisplayName"]);
                                if (author.Length > 0) text += " — " + author;
                                SendOnce("quote:" + (string)quote["overlayId"], text, channelId, broadcastId, key, seen);
                            }
                        }
                    }
                    catch { CPH.LogWarn("[Avisos no chat] Não foi possível processar a quote."); }

                    try
                    {
                        var subscribers = Get(baseUrl + "/api/obs/subscribers/current" + suffix)?["data"] as JArray;
                        if (subscribers != null)
                            foreach (var subscriber in subscribers)
                            {
                                string eventId = (string)subscriber["eventId"];
                                string eventBroadcast = (string)subscriber["broadcastId"];
                                DateTimeOffset occurred;
                                if (string.IsNullOrEmpty(eventId)
                                    || (!string.IsNullOrEmpty(eventBroadcast) && eventBroadcast != broadcastId)
                                    || !DateTimeOffset.TryParse((string)subscriber["occurredAt"], out occurred)
                                    || occurred < DateTimeOffset.UtcNow.AddMinutes(-2) || occurred > DateTimeOffset.UtcNow.AddSeconds(30)) continue;
                                string name = Clean((string)subscriber["displayName"]);
                                if (name.Length == 0) name = Clean((string)subscriber["youtubeHandle"]);
                                if (name.Length == 0) name = "Uma pessoa";
                                SendOnce("subscriber:" + eventId, name + " acabou de se inscrever! Boas-vindas ao canal!",
                                    channelId, broadcastId, key, seen);
                            }
                    }
                    catch { CPH.LogWarn("[Avisos no chat] Não foi possível processar as novas inscrições."); }
                    return true;
                }
                finally { if (entered) mutex.ReleaseMutex(); }
            }
        }
        catch
        {
            CPH.LogWarn("[Avisos no chat] Confira a configuração e o registro de envios; nenhum reenvio foi forçado.");
            return false;
        }
    }

    private void SendOnce(string id, string text, string channelId, string broadcastId, string key, JObject seen)
    {
        int part = 0;
        foreach (string message in SplitMessage(text))
        {
            string token = Digest(id + ":" + part++);
            if (seen[token] != null) continue;
            // Recheck after network calls and between chunks. Never fall back to another live.
            if (LiveBroadcast(channelId) != broadcastId) return;
            // Persist BEFORE handing off: a crash/ambiguous YouTube result cannot duplicate it.
            seen[token] = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            CPH.SetGlobalVar(key, seen.ToString(Newtonsoft.Json.Formatting.None), true);
            CPH.SendYouTubeMessage(message, true, true, broadcastId);
        }
    }

    private string LiveBroadcast(string channelId)
    {
        var broadcasts = CPH.YouTubeGetMonitoredBroadcasts();
        var live = broadcasts == null ? null : broadcasts.Where(b => b.ChannelId == channelId
            && string.Equals(b.Status, "live", StringComparison.OrdinalIgnoreCase)
            && !string.IsNullOrWhiteSpace(b.LiveChatId)).ToList();
        return live != null && live.Count == 1 ? live[0].Id : null;
    }

    private JObject Get(string url)
    {
        using (var response = Http.GetAsync(url).GetAwaiter().GetResult())
        {
            if (!response.IsSuccessStatusCode) return null;
            var payload = Newtonsoft.Json.JsonConvert.DeserializeObject<JObject>(
                response.Content.ReadAsStringAsync().GetAwaiter().GetResult(),
                new Newtonsoft.Json.JsonSerializerSettings { DateParseHandling = Newtonsoft.Json.DateParseHandling.None });
            return (bool?)payload["ok"] == true ? payload : null;
        }
    }

    private string ReadGlobal(string key)
    {
        return CPH.GetGlobalVar<string>(key, true) ?? "";
    }

    private static string Clean(string text)
    {
        return Regex.Replace(text ?? "", @"\s+", " ").Trim();
    }

    private static IEnumerable<string> SplitMessage(string text)
    {
        var part = new StringBuilder();
        var elements = StringInfo.GetTextElementEnumerator(text);
        while (elements.MoveNext())
        {
            string element = elements.GetTextElement();
            if (part.Length + element.Length > 200 && part.Length > 0)
            {
                yield return part.ToString();
                part.Clear();
            }
            // Pathological combining sequences must not exceed YouTube's limit.
            if (element.Length > 200) throw new InvalidOperationException("chat_text_element_too_long");
            part.Append(element);
        }
        if (part.Length > 0) yield return part.ToString();
    }

    private static string Digest(string text)
    {
        using (var hash = SHA256.Create())
            return BitConverter.ToString(hash.ComputeHash(Encoding.UTF8.GetBytes(text))).Replace("-", "").ToLowerInvariant();
    }
}
