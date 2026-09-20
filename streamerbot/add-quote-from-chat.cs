using System;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;

public class CPHInline
{
    private static readonly HttpClient Http = new HttpClient
    {
        Timeout = TimeSpan.FromSeconds(10),
    };

    private static readonly string[] ViewerIdArgCandidates = new[]
    {
        "id",
        "userId",
        "fromId",
        "authorId",
        "channelId",
        "youtubeUserId",
        "targetUserId",
    };

    private static readonly string[] DisplayNameArgCandidates = new[]
    {
        "display",
        "displayName",
        "authorName",
        "targetUser",
        "user",
    };

    private static readonly string[] HandleArgCandidates = new[]
    {
        "userName",
        "youtubeHandle",
        "handle",
    };

    private static readonly string[] ModeratorArgCandidates = new[]
    {
        "isModerator",
        "isMod",
        "userIsModerator",
    };

    private static readonly string[] BroadcasterArgCandidates = new[]
    {
        "isBroadcaster",
        "isStreamer",
        "userIsBroadcaster",
    };

    private static readonly string[] AdminArgCandidates = new[]
    {
        "isAdmin",
        "userIsAdmin",
    };

    private static readonly string[] QuoteTextArgCandidates = new[]
    {
        "quoteText",
        "rawInput",
        "commandInput",
        "input",
        "message",
        "text",
        "input0",
    };

    public bool Execute()
    {
        string appBaseUrl = ReadRequiredGlobal("lojaneon.appBaseUrl");
        string credentialId = ReadRequiredGlobal("lojaneon.streamerbotCredentialId");
        string sharedSecret = ReadRequiredGlobal("lojaneon.streamerbotCredentialSecret");
        bool useBotAccount = ReadOptionalBoolGlobal("lojaneon.useBotAccount", true);

        if (string.IsNullOrWhiteSpace(appBaseUrl) || (string.IsNullOrWhiteSpace(sharedSecret) || string.IsNullOrWhiteSpace(credentialId)))
        {
            return false;
        }

        string quoteText = ResolveQuoteText();
        if (string.IsNullOrWhiteSpace(quoteText))
        {
            Reply("Comando invalido. Use !addquote <texto>.", useBotAccount);
            return false;
        }

        string viewerExternalId = GetFirstArgString(ViewerIdArgCandidates);
        if (string.IsNullOrWhiteSpace(viewerExternalId))
        {
            CPH.LogError("[Loja Neon] Nao consegui descobrir o id do viewer para salvar a quote.");
            Reply("Nao consegui identificar quem executou o comando.", useBotAccount);
            return false;
        }

        string displayName = GetFirstArgString(DisplayNameArgCandidates);
        string youtubeHandle = NormalizeHandle(GetFirstArgString(HandleArgCandidates));
        bool isModerator = GetFirstBoolArg(ModeratorArgCandidates, false);
        bool isBroadcaster = GetFirstBoolArg(BroadcasterArgCandidates, false);
        bool isAdmin = GetFirstBoolArg(AdminArgCandidates, false);

        string body = BuildRequestBody(
            viewerExternalId,
            displayName,
            youtubeHandle,
            quoteText,
            isModerator,
            isBroadcaster,
            isAdmin,
            "streamerbot_chat"
        );
        string timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString();
        string signature = BuildSignature(body, timestamp, sharedSecret, credentialId);

        try
        {
            using (var request = new HttpRequestMessage(
                HttpMethod.Post,
                string.Format("{0}/api/internal/streamerbot/quotes", appBaseUrl.TrimEnd('/'))
            ))
            {
                request.Headers.Add("x-streamerbot-credential-id", credentialId);
                request.Headers.TryAddWithoutValidation("x-timestamp", timestamp);
                request.Headers.TryAddWithoutValidation("x-signature", signature);
                request.Content = new StringContent(body, Encoding.UTF8, "application/json");

                using (HttpResponseMessage response = Http.SendAsync(request).GetAwaiter().GetResult())
                {
                    string responseText = response.Content.ReadAsStringAsync().GetAwaiter().GetResult();
                    string replyMessage = ExtractReplyMessage(responseText);

                    if (string.IsNullOrWhiteSpace(replyMessage))
                    {
                        replyMessage = response.IsSuccessStatusCode
                            ? "Quote salva com sucesso."
                            : "Nao consegui salvar a quote agora.";
                    }

                    Reply(replyMessage, useBotAccount);

                    if (!response.IsSuccessStatusCode)
                    {
                        CPH.LogWarn(string.Format(
                            "[Loja Neon] Falha ao salvar quote: HTTP {0} - {1}",
                            (int)response.StatusCode,
                            responseText
                        ));
                    }

                    return response.IsSuccessStatusCode;
                }
            }
        }
        catch (Exception ex)
        {
            CPH.LogError(string.Format("[Loja Neon] Erro ao chamar API de quotes: {0}", ex));
            Reply("Nao consegui salvar a quote agora.", useBotAccount);
            return false;
        }
    }

    private void Reply(string message, bool useBot)
    {
        CPH.SendYouTubeMessageToLatestMonitored(message, useBot, true);
    }

    private string ReadRequiredGlobal(string variableName)
    {
        string value = ReadOptionalGlobal(variableName);
        if (!string.IsNullOrWhiteSpace(value))
        {
            return value;
        }

        CPH.LogError(string.Format("[Loja Neon] Global obrigatoria ausente: {0}", variableName));
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

    private bool ReadOptionalBoolGlobal(string variableName, bool defaultValue)
    {
        try
        {
            return CPH.GetGlobalVar<bool>(variableName, true);
        }
        catch
        {
            return defaultValue;
        }
    }

    private string GetArgString(string argName)
    {
        if (args != null && args.ContainsKey(argName) && args[argName] != null)
        {
            string directValue = args[argName].ToString();
            if (!string.IsNullOrWhiteSpace(directValue))
            {
                return directValue.Trim();
            }
        }

        if (CPH.TryGetArg(argName, out string value) && !string.IsNullOrWhiteSpace(value))
        {
            return value.Trim();
        }

        return null;
    }

    private string GetFirstArgString(string[] candidates)
    {
        foreach (string candidate in candidates)
        {
            string value = GetArgString(candidate);
            if (!string.IsNullOrWhiteSpace(value))
            {
                return value;
            }
        }

        return null;
    }

    private string ResolveQuoteText()
    {
        foreach (string candidate in QuoteTextArgCandidates)
        {
            string value = NormalizeCommandPayload(GetArgString(candidate));
            if (!string.IsNullOrWhiteSpace(value))
            {
                return value;
            }
        }

        return null;
    }

    private bool GetFirstBoolArg(string[] candidates, bool defaultValue)
    {
        foreach (string candidate in candidates)
        {
            if (TryGetBoolArg(candidate, out bool value))
            {
                return value;
            }
        }

        return defaultValue;
    }

    private bool TryGetBoolArg(string argName, out bool value)
    {
        if (args != null && args.ContainsKey(argName) && args[argName] != null)
        {
            if (TryParseBool(args[argName].ToString(), out value))
            {
                return true;
            }
        }

        if (CPH.TryGetArg(argName, out bool typedValue))
        {
            value = typedValue;
            return true;
        }

        if (CPH.TryGetArg(argName, out string rawValue) && TryParseBool(rawValue, out value))
        {
            return true;
        }

        value = false;
        return false;
    }

    private bool TryParseBool(string rawValue, out bool value)
    {
        if (bool.TryParse(rawValue, out value))
        {
            return true;
        }

        if (string.Equals(rawValue, "1", StringComparison.OrdinalIgnoreCase))
        {
            value = true;
            return true;
        }

        if (string.Equals(rawValue, "0", StringComparison.OrdinalIgnoreCase))
        {
            value = false;
            return true;
        }

        value = false;
        return false;
    }

    private string NormalizeHandle(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        string trimmed = value.Trim();
        return trimmed.StartsWith("@") ? trimmed : string.Format("@{0}", trimmed);
    }

    private string NormalizeCommandPayload(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        string trimmed = value.Trim();
        if (!trimmed.StartsWith("!"))
        {
            return trimmed;
        }

        int firstSpace = trimmed.IndexOf(' ');
        if (firstSpace < 0 || firstSpace == trimmed.Length - 1)
        {
            return null;
        }

        return trimmed.Substring(firstSpace + 1).Trim();
    }

    private string BuildSignature(string body, string timestamp, string secret, string credentialId)
    {
        using (var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret)))
        {
            byte[] hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(string.Format("v2\n{0}\n{1}\nPOST\n/api/internal/streamerbot/quotes\n{2}", timestamp, credentialId, body)));
            return BitConverter.ToString(hash).Replace("-", "").ToLowerInvariant();
        }
    }

    private string ExtractReplyMessage(string responseText)
    {
        if (string.IsNullOrWhiteSpace(responseText))
        {
            return string.Empty;
        }

        try
        {
            if (TryExtractJsonStringProperty(responseText, "replyMessage", out string reply))
            {
                return JsonUnescape(reply);
            }

            if (TryExtractJsonStringProperty(responseText, "error", out string errorMessage))
            {
                return JsonUnescape(errorMessage);
            }
        }
        catch (Exception ex)
        {
            CPH.LogWarn(string.Format("[Loja Neon] Nao consegui ler a resposta de quote: {0}", ex.Message));
        }

        return string.Empty;
    }

    private bool TryExtractJsonStringProperty(string json, string propertyName, out string value)
    {
        value = string.Empty;

        string needle = "\"" + propertyName + "\"";
        int propertyIndex = json.IndexOf(needle, StringComparison.Ordinal);
        if (propertyIndex < 0)
        {
            return false;
        }

        int colonIndex = json.IndexOf(':', propertyIndex + needle.Length);
        if (colonIndex < 0)
        {
            return false;
        }

        int valueStart = colonIndex + 1;
        while (valueStart < json.Length && char.IsWhiteSpace(json[valueStart]))
        {
            valueStart++;
        }

        if (valueStart >= json.Length || json[valueStart] != '"')
        {
            return false;
        }

        var builder = new StringBuilder();
        bool escaping = false;

        for (int i = valueStart + 1; i < json.Length; i++)
        {
            char current = json[i];

            if (escaping)
            {
                builder.Append('\\');
                builder.Append(current);
                escaping = false;
                continue;
            }

            if (current == '\\')
            {
                escaping = true;
                continue;
            }

            if (current == '"')
            {
                value = builder.ToString();
                return true;
            }

            builder.Append(current);
        }

        return false;
    }

    private string BuildRequestBody(
        string viewerExternalId,
        string displayName,
        string youtubeHandle,
        string quoteText,
        bool isModerator,
        bool isBroadcaster,
        bool isAdmin,
        string source
    )
    {
        var builder = new StringBuilder();
        builder.Append("{");
        builder.Append("\"action\":\"create\"");
        builder.AppendFormat(",\"viewerExternalId\":\"{0}\"", JsonEscape(viewerExternalId));

        if (!string.IsNullOrWhiteSpace(displayName))
        {
            builder.AppendFormat(",\"youtubeDisplayName\":\"{0}\"", JsonEscape(displayName));
        }

        if (!string.IsNullOrWhiteSpace(youtubeHandle))
        {
            builder.AppendFormat(",\"youtubeHandle\":\"{0}\"", JsonEscape(youtubeHandle));
        }

        builder.AppendFormat(",\"quoteText\":\"{0}\"", JsonEscape(quoteText));
        builder.AppendFormat(",\"isModerator\":{0}", isModerator ? "true" : "false");
        builder.AppendFormat(",\"isBroadcaster\":{0}", isBroadcaster ? "true" : "false");
        builder.AppendFormat(",\"isAdmin\":{0}", isAdmin ? "true" : "false");
        builder.AppendFormat(",\"source\":\"{0}\"", JsonEscape(source));
        builder.Append("}");
        return builder.ToString();
    }

    private string JsonEscape(string value)
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

    private string JsonUnescape(string value)
    {
        if (string.IsNullOrEmpty(value))
        {
            return string.Empty;
        }

        return value
            .Replace("\\\"", "\"")
            .Replace("\\\\", "\\")
            .Replace("\\r", "\r")
            .Replace("\\n", "\n")
            .Replace("\\t", "\t");
    }
}
