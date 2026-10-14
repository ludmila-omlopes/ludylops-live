public partial class CPHInline { public FakeCPH CPH; }

public class FakeBroadcast
{
    public string Id = "live-1", ChannelId = "UCaaaaaaaaaaaaaaaaaaaaaa", Status = "live", LiveChatId = "chat-1";
}
public class FakeCPH
{
    public readonly Dictionary<string, string> Globals = new Dictionary<string, string> {
        {"lojaneon.appBaseUrl", "https://example.test"},
        {"lojaneon.overlayChatYoutubeChannelId", "UCaaaaaaaaaaaaaaaaaaaaaa"},
        {"lojaneon.overlayChatCreatorSlug", "ludylops"}
    };
    public List<FakeBroadcast> Broadcasts = new List<FakeBroadcast> {new FakeBroadcast()};
    public readonly List<string> Messages = new List<string>();
    public bool IsTest, FailSend, FailSave;
    public T GetGlobalVar<T>(string key, bool persisted) { return Globals.ContainsKey(key) ? (T)(object)Globals[key] : default(T); }
    public void SetGlobalVar(string key, object value, bool persisted) {
        if(FailSave) throw new Exception("disk unavailable");
        Globals[key] = (string)value;
    }
    public bool TryGetArg<T>(string key, out T value) { value = (T)(object)IsTest; return true; }
    public List<FakeBroadcast> YouTubeGetMonitoredBroadcasts() { return Broadcasts; }
    public void SendYouTubeMessage(string text, bool bot, bool fallback, string broadcastId) {
        if(broadcastId != "live-1") throw new Exception("Wrong broadcast");
        Messages.Add(text);
        if(FailSend) throw new Exception("ambiguous delivery");
    }
    public void LogWarn(string text) {}
}
public class FakeOverlayHttp : HttpMessageHandler
{
    public JObject Quote;
    public JArray Subscribers = new JArray();
    public bool IsLive = true, FailQuote;
    public int Calls;
    public Action OnSubscribers;
    protected override System.Threading.Tasks.Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken token) {
        Calls++;
        JToken data;
        string path = request.RequestUri.AbsolutePath;
        if(path.Contains("live-status")) data = new JObject { ["isLive"] = IsLive };
        else if(path.Contains("quotes")) {
            if(FailQuote) throw new Exception("quote unavailable");
            data = Quote;
        } else { data = Subscribers; if(OnSubscribers != null) OnSubscribers(); }
        return System.Threading.Tasks.Task.FromResult(new HttpResponseMessage(System.Net.HttpStatusCode.OK) {
            Content = new StringContent(new JObject { ["ok"] = true, ["data"] = data }.ToString())
        });
    }
}
public static class OverlayChatTests
{
    private static void Check(bool ok, string name) { if(!ok) throw new Exception("FAILED: " + name); }
    private static JObject Quote(string id, string body = "Uma frase da live") { return new JObject {
        ["overlayId"] = id, ["quoteNumber"] = 7, ["quoteBody"] = body,
        ["createdByDisplayName"] = "Lud", ["expiresAt"] = DateTimeOffset.UtcNow.AddSeconds(12).ToString("o")
    }; }
    private static JObject Subscriber(string id, string broadcast = "live-1") { return new JObject {
        ["eventId"] = id, ["displayName"] = "João", ["occurredAt"] = DateTimeOffset.UtcNow.ToString("o"), ["broadcastId"] = broadcast
    }; }
    public static void Run()
    {
        var host = new FakeCPH(); var http = new FakeOverlayHttp();
        CPHInline.Http = new HttpClient(http); var action = new CPHInline { CPH = host };
        http.Quote = Quote("q1"); http.Subscribers.Add(Subscriber("s1"));
        Check(action.Execute(), "execute");
        Check(host.Messages.SequenceEqual(new[] {"Quote #7: “Uma frase da live” — Lud", "João acabou de se inscrever! Boas-vindas ao canal!"}), "quote text and subscription");
        action.Execute(); new CPHInline { CPH = host }.Execute();
        Check(host.Messages.Count == 2, "persistent deduplication across polls and instances");
        http.Quote = Quote("q2"); action.Execute();
        Check(host.Messages.Count == 3, "same quote requested again gets a new alert ID");
        http.Quote = null; http.Subscribers.Add(Subscriber("wrong", "another-live"));
        var stale = Subscriber("old"); stale["occurredAt"] = DateTimeOffset.UtcNow.AddMinutes(-3).ToString("o"); http.Subscribers.Add(stale);
        action.Execute(); Check(host.Messages.Count == 3, "wrong broadcast and stale subscriptions skipped");
        http.Quote = Quote("expired"); http.Quote["expiresAt"] = DateTimeOffset.UtcNow.AddSeconds(-1).ToString("o");
        action.Execute(); Check(host.Messages.Count == 3, "expired quote skipped");
        host.Broadcasts[0].Status = "upcoming"; int calls = http.Calls;
        action.Execute(); Check(http.Calls == calls, "no polling before live");
        host.Broadcasts[0].Status = "live"; host.Broadcasts.Add(new FakeBroadcast { Id = "live-2" });
        action.Execute(); Check(http.Calls == calls, "ambiguous monitored lives skipped"); host.Broadcasts.RemoveAt(1);
        host.Broadcasts[0].ChannelId = "UCbbbbbbbbbbbbbbbbbbbbbb";
        action.Execute(); Check(http.Calls == calls, "other channel skipped"); host.Broadcasts[0].ChannelId = "UCaaaaaaaaaaaaaaaaaaaaaa";
        host.IsTest = true; action.Execute(); Check(http.Calls == calls, "test trigger cannot send"); host.IsTest = false;
        http.IsLive = false; http.Quote = Quote("offline"); action.Execute(); Check(host.Messages.Count == 3, "site offline skipped"); http.IsLive = true;
        http.Quote = null; http.Subscribers.Add(Subscriber("late")); http.OnSubscribers = () => host.Broadcasts[0].Status = "complete";
        action.Execute(); Check(host.Messages.Count == 3, "live ending during HTTP cannot send"); http.OnSubscribers = null; host.Broadcasts[0].Status = "live";
        http.Subscribers = new JArray(); http.Quote = Quote("long", string.Concat(Enumerable.Repeat("Olá 🎉 ", 80)));
        action.Execute(); var chunks = host.Messages.Skip(3).ToList();
        Check(chunks.Count > 1 && chunks.All(s=>s.Length <= 200 && !char.IsHighSurrogate(s[s.Length-1])), "long quote chunks preserve Unicode and length limit");
        Check(string.Concat(chunks) == "Quote #7: “" + ((string)http.Quote["quoteBody"]).Trim() + "” — Lud", "full quote preserved");
        int count = host.Messages.Count; http.Quote = Quote("failure"); host.FailSend = true; action.Execute();
        host.FailSend = false; action.Execute(); Check(host.Messages.Count == count + 1, "ambiguous send is not retried");
        count = host.Messages.Count; http.Quote = Quote("disk"); host.FailSave = true; action.Execute();
        Check(host.Messages.Count == count, "ledger failure prevents send"); host.FailSave = false;
        http.Quote = null; http.FailQuote = true; http.Subscribers.Add(Subscriber("independent")); action.Execute();
        Check(host.Messages.Count == count + 1, "quote failure does not block subscriber");
        string ledger = host.Globals.Keys.First(k=>k.StartsWith("lojaneon.overlayChatSeen.")); host.Globals[ledger] = "corrupt";
        count = host.Messages.Count; Check(!action.Execute() && host.Messages.Count == count, "corrupt ledger fails closed");
        Console.WriteLine("PASS: 19 overlay-chat behavior checks (mock HTTP and chat; no real messages sent)");
    }
}
