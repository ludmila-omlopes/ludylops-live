using System;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

public class CPHInline
{
    private static readonly string[] ViewerIdArgCandidates =
    {
        "id",
        "userId",
        "fromId",
        "authorId",
        "channelId",
        "youtubeUserId",
        "targetUserId",
    };

    private static readonly string[] DisplayNameArgCandidates =
    {
        "display",
        "displayName",
        "user",
        "userName",
        "authorName",
        "channelName",
    };

    private static readonly string[] HandleArgCandidates =
    {
        "userName",
        "handle",
        "youtubeHandle",
    };

    private static readonly string[] BetIdArgCandidates =
    {
        "betId",
        "activeBetId",
        "bet_id",
    };

    private static readonly HttpClient Http = new HttpClient
    {
        Timeout = TimeSpan.FromSeconds(10),
    };

    public bool Execute()
    {
        string appBaseUrl = ReadRequiredGlobal("lojaneon.appBaseUrl");
        string sharedSecret = ReadRequiredGlobal("lojaneon.streamerbotSharedSecret");

        if (string.IsNullOrWhiteSpace(appBaseUrl) || string.IsNullOrWhiteSpace(sharedSecret))
        {
            return false;
        }

        bool hasOptionIndex = TryReadIntArg("optionIndex", out int optionIndex) && optionIndex > 0;
        string optionLabel = hasOptionIndex
            ? null
            : GetFirstArgString("optionLabel", "option", "optionIndex");
        if (!hasOptionIndex && string.IsNullOrWhiteSpace(optionLabel))
        {
            Reply("Comando inválido. Use !bet <opção> <valor>.", true);
            return false;
        }

        if (!TryReadIntArg("amount", out int amount) || amount <= 0)
        {
            Reply("Valor inválido. Use !bet <opção> <valor>.", true);
            return false;
        }

        string viewerExternalId = GetFirstArgString(ViewerIdArgCandidates);
        if (string.IsNullOrWhiteSpace(viewerExternalId))
        {
            CPH.LogError(string.Format(
                "[Loja Neon] Nao consegui descobrir o id do viewer. Args testados: {0}. Args disponiveis: {1}.",
                string.Join(", ", ViewerIdArgCandidates),
                ListAvailableArgs()
            ));
            Reply("Nao consegui identificar seu canal do YouTube para apostar.", true);
            return false;
        }

        string displayName = GetFirstArgString(DisplayNameArgCandidates);
        string youtubeHandle = NormalizeHandle(GetFirstArgString(HandleArgCandidates));
        string requestedBetId = GetFirstArgString(BetIdArgCandidates);
        string configuredBetId = ReadOptionalGlobal("lojaneon.activeBetId");
        string activeBetId = !string.IsNullOrWhiteSpace(requestedBetId) ? requestedBetId : configuredBetId;
        bool useBotAccount = ReadOptionalBoolGlobal("lojaneon.useBotAccount", true);

        string body = BuildRequestBody(
            viewerExternalId,
            displayName,
            youtubeHandle,
            string.IsNullOrWhiteSpace(activeBetId) ? null : activeBetId,
            hasOptionIndex ? (int?)optionIndex : null,
            optionLabel,
            amount,
            "streamerbot_chat"
        );
        string timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString();
        string signature = BuildSignature(body, timestamp, sharedSecret);

        try
        {
            using (var request = new HttpRequestMessage(
                HttpMethod.Post,
                string.Format("{0}/api/internal/streamerbot/bets/place", appBaseUrl.TrimEnd('/'))
            ))
            {
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
                            ? string.Format("{0} apostou com sucesso.", displayName ?? "Viewer")
                            : "Nao consegui registrar a aposta agora.";
                    }

                    Reply(replyMessage, useBotAccount);

                    if (!response.IsSuccessStatusCode)
                    {
                        CPH.LogWarn(string.Format(
                            "[Loja Neon] Falha ao registrar aposta: HTTP {0} - {1}",
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
            CPH.LogError(string.Format("[Loja Neon] Erro ao chamar API de aposta: {0}", ex));
            Reply("Nao consegui registrar a aposta agora.", useBotAccount);
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

    private bool TryReadIntArg(string argName, out int value)
    {
        if (CPH.TryGetArg(argName, out int typedValue))
        {
            value = typedValue;
            return true;
        }

        if (CPH.TryGetArg(argName, out string rawValue) && int.TryParse(rawValue, out int parsedValue))
        {
            value = parsedValue;
            return true;
        }

        value = 0;
        return false;
    }

    private string GetFirstArgString(params string[] argNames)
    {
        if (argNames == null)
        {
            return null;
        }

        foreach (string argName in argNames)
        {
            string value = GetArgString(argName);
            if (!string.IsNullOrWhiteSpace(value))
            {
                return value;
            }
        }

        return null;
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

    private string ListAvailableArgs()
    {
        if (args == null || args.Count == 0)
        {
            return "(nenhum)";
        }

        return string.Join(", ", args.Keys);
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

    private string BuildSignature(string body, string timestamp, string secret)
    {
        using (var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret)))
        {
            byte[] hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(string.Format("{0}.{1}", timestamp, body)));
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
            Match replyMatch = Regex.Match(
                responseText,
                "\"replyMessage\"\\s*:\\s*\"(?<value>(?:\\\\.|[^\"])*)\"",
                RegexOptions.Singleline
            );
            if (replyMatch.Success)
            {
                return JsonUnescape(replyMatch.Groups["value"].Value);
            }

            Match errorMatch = Regex.Match(
                responseText,
                "\"error\"\\s*:\\s*\"(?<value>(?:\\\\.|[^\"])*)\"",
                RegexOptions.Singleline
            );
            if (errorMatch.Success)
            {
                return JsonUnescape(errorMatch.Groups["value"].Value);
            }
        }
        catch (Exception ex)
        {
            CPH.LogWarn(string.Format("[Loja Neon] Nao consegui ler a resposta da aposta: {0}", ex.Message));
        }

        return string.Empty;
    }

    private string BuildRequestBody(
        string viewerExternalId,
        string displayName,
        string youtubeHandle,
        string betId,
        int? optionIndex,
        string optionLabel,
        int amount,
        string source
    )
    {
        var builder = new StringBuilder();
        builder.Append("{");
        builder.AppendFormat("\"viewerExternalId\":\"{0}\"", JsonEscape(viewerExternalId));

        if (!string.IsNullOrWhiteSpace(displayName))
        {
            builder.AppendFormat(",\"youtubeDisplayName\":\"{0}\"", JsonEscape(displayName));
        }

        if (!string.IsNullOrWhiteSpace(youtubeHandle))
        {
            builder.AppendFormat(",\"youtubeHandle\":\"{0}\"", JsonEscape(youtubeHandle));
        }

        if (!string.IsNullOrWhiteSpace(betId))
        {
            builder.AppendFormat(",\"betId\":\"{0}\"", JsonEscape(betId));
        }

        if (optionIndex.HasValue)
        {
            builder.AppendFormat(",\"optionIndex\":{0}", optionIndex.Value);
        }
        else if (!string.IsNullOrWhiteSpace(optionLabel))
        {
            builder.AppendFormat(",\"optionLabel\":\"{0}\"", JsonEscape(optionLabel));
        }

        builder.AppendFormat(",\"amount\":{0}", amount);
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
