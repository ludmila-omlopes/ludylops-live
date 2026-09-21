using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;

public class CPHInline
{
    private static readonly HttpClient Http = new HttpClient
    {
        Timeout = TimeSpan.FromSeconds(10),
    };

    public bool Execute()
    {
        string appBaseUrl = ReadRequiredGlobal("lojaneon.appBaseUrl");
        string credentialId = ReadRequiredGlobal("lojaneon.streamerbotCredentialId");
        string sharedSecret = ReadRequiredGlobal("lojaneon.streamerbotCredentialSecret");
        int pointsPerCycle = 5;

        if (string.IsNullOrWhiteSpace(appBaseUrl) || (string.IsNullOrWhiteSpace(sharedSecret) || string.IsNullOrWhiteSpace(credentialId)))
        {
            return false;
        }

        if (!args.ContainsKey("users") || args["users"] == null)
        {
            CPH.LogWarn("[Loja Pipetz] Present Viewers trigger had no users list.");
            return false;
        }

        var users = args["users"] as List<Dictionary<string, object>>;
        if (users == null)
        {
            CPH.LogWarn("[Loja Pipetz] users was not a List<Dictionary<string, object>>.");
            return false;
        }

        string broadcastId = GetArgString("broadcastId");
        bool isLive = ReadBoolArg("isLive");
        int sent = 0;
        int failed = 0;
        int ignored = 0;

        foreach (var user in users)
        {
            string viewerExternalId = GetString(user, "id");
            string youtubeDisplayName = GetString(user, "display");
            string youtubeUserName = GetString(user, "userName");

            if (string.IsNullOrWhiteSpace(viewerExternalId))
            {
                failed++;
                continue;
            }

            if (string.IsNullOrWhiteSpace(youtubeDisplayName))
            {
                youtubeDisplayName = viewerExternalId;
            }

            string timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString();
            string occurredAt = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ");
            string eventId = string.Format("presence-{0}-{1}", viewerExternalId, timestamp);

            string body = BuildRequestBody(
                eventId,
                viewerExternalId,
                youtubeDisplayName,
                youtubeUserName,
                pointsPerCycle,
                occurredAt,
                broadcastId,
                isLive
            );

            using (var request = new HttpRequestMessage(
                HttpMethod.Post,
                string.Format("{0}/api/internal/streamerbot/events", appBaseUrl.TrimEnd('/'))
            ))
            {
                request.Content = new StringContent(body, Encoding.UTF8, "application/json");
                request.Headers.Add("x-streamerbot-credential-id", credentialId);
                request.Headers.Add("x-timestamp", timestamp);
                request.Headers.Add("x-signature", BuildSignature(sharedSecret, timestamp, body, credentialId));

                try
                {
                    HttpResponseMessage response = Http.SendAsync(request).GetAwaiter().GetResult();
                    string responseBody = response.Content.ReadAsStringAsync().GetAwaiter().GetResult();

                    if (response.IsSuccessStatusCode)
                    {
                        sent++;
                        if (!string.IsNullOrWhiteSpace(responseBody) && responseBody.Contains("\"ignoredReason\""))
                        {
                            ignored++;
                            CPH.LogWarn(string.Format(
                                "[Loja Pipetz] presence_tick returned ignored result for {0}: {1}",
                                youtubeDisplayName,
                                responseBody
                            ));
                        }
                        else
                        {
                            CPH.LogInfo(string.Format(
                                "[Loja Pipetz] presence_tick ok for {0}: {1}",
                                youtubeDisplayName,
                                responseBody
                            ));
                        }
                    }
                    else
                    {
                        failed++;
                        CPH.LogWarn(string.Format(
                            "[Loja Pipetz] presence_tick failed for {0}: status={1} body={2}",
                            youtubeDisplayName,
                            (int)response.StatusCode,
                            responseBody
                        ));
                    }
                }
                catch (Exception ex)
                {
                    failed++;
                    CPH.LogWarn(string.Format(
                        "[Loja Pipetz] presence_tick exception for {0}: {1}",
                        youtubeDisplayName,
                        ex.Message
                    ));
                }
            }
        }

        CPH.LogInfo(string.Format(
            "[Loja Pipetz] Present Viewers tick finished. sent={0} ignored={1} failed={2} total={3} isLive={4} broadcastId={5}",
            sent,
            ignored,
            failed,
            users.Count,
            isLive,
            string.IsNullOrWhiteSpace(broadcastId) ? "(none)" : broadcastId
        ));

        return failed == 0;
    }

    private string ReadRequiredGlobal(string variableName)
    {
        string value = ReadOptionalGlobal(variableName);
        if (!string.IsNullOrWhiteSpace(value))
        {
            return value;
        }

        CPH.LogError(string.Format("[Loja Pipetz] Global obrigatoria ausente: {0}", variableName));
        return string.Empty;
    }

    private string ReadOptionalGlobal(string variableName)
    {
        try
        {
            return CPH.GetGlobalVar<string>(variableName, true) ?? string.Empty;
        }
        catch
        {
            return string.Empty;
        }
    }

    private bool ReadBoolArg(string argName)
    {
        if (CPH.TryGetArg(argName, out bool typedValue))
        {
            return typedValue;
        }

        if (CPH.TryGetArg(argName, out string rawValue))
        {
            if (string.Equals(rawValue, "true", StringComparison.OrdinalIgnoreCase) || rawValue == "1")
            {
                return true;
            }
        }

        return false;
    }

    private string GetArgString(string argName)
    {
        if (args != null && args.ContainsKey(argName) && args[argName] != null)
        {
            return args[argName].ToString().Trim();
        }

        if (CPH.TryGetArg(argName, out string value) && !string.IsNullOrWhiteSpace(value))
        {
            return value.Trim();
        }

        return null;
    }

    private static string GetString(Dictionary<string, object> user, string key)
    {
        return user.ContainsKey(key) && user[key] != null ? user[key].ToString() : null;
    }

    private static string BuildSignature(string secret, string timestamp, string body, string credentialId)
    {
        using (var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret)))
        {
            byte[] hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(string.Format("v2\n{0}\n{1}\nPOST\n/api/internal/streamerbot/events\n{2}", timestamp, credentialId, body)));
            return BitConverter.ToString(hash).Replace("-", "").ToLowerInvariant();
        }
    }

    private static string BuildRequestBody(
        string eventId,
        string viewerExternalId,
        string youtubeDisplayName,
        string youtubeUserName,
        int amount,
        string occurredAt,
        string broadcastId,
        bool isLive
    )
    {
        var builder = new StringBuilder();
        builder.Append("{");
        builder.AppendFormat("\"eventId\":\"{0}\"", Escape(eventId));
        builder.Append(",\"eventType\":\"presence_tick\"");
        builder.AppendFormat(",\"viewerExternalId\":\"{0}\"", Escape(viewerExternalId));
        builder.AppendFormat(",\"youtubeDisplayName\":\"{0}\"", Escape(youtubeDisplayName));

        if (!string.IsNullOrWhiteSpace(youtubeUserName))
        {
            builder.AppendFormat(",\"youtubeHandle\":\"{0}\"", Escape(youtubeUserName));
        }

        builder.AppendFormat(",\"amount\":{0}", amount);
        builder.AppendFormat(",\"occurredAt\":\"{0}\"", occurredAt);
        builder.Append(",\"payload\":{");
        builder.Append("\"reason\":\"present_viewers\"");
        builder.Append(",\"source\":\"streamerbot\"");
        builder.AppendFormat(",\"isLive\":{0}", isLive ? "true" : "false");

        if (!string.IsNullOrWhiteSpace(broadcastId))
        {
          builder.AppendFormat(",\"broadcastId\":\"{0}\"", Escape(broadcastId));
        }

        builder.Append("}}");
        return builder.ToString();
    }

    private static string Escape(string value)
    {
        if (value == null)
        {
            return string.Empty;
        }

        return value
            .Replace("\\", "\\\\")
            .Replace("\"", "\\\"")
            .Replace("\r", "\\r")
            .Replace("\n", "\\n")
            .Replace("\t", "\\t");
    }
}
