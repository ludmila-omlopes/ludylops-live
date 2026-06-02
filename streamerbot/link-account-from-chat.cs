using System;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

public class CPHInline
{
    private static readonly HttpClient Http = new HttpClient
    {
        Timeout = TimeSpan.FromSeconds(10),
    };

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

    private static readonly string[] LinkCodeArgCandidates =
    {
        "linkCode",
        "code",
        "commandInput",
        "rawInput",
        "input",
        "input0",
        "input1",
        "message",
        "text",
    };

    public bool Execute()
    {
        string appBaseUrl = ReadRequiredGlobal("lojaneon.appBaseUrl");
        string sharedSecret = ReadRequiredGlobal("lojaneon.streamerbotSharedSecret");
        bool useBotAccount = ReadOptionalBoolGlobal("lojaneon.useBotAccount", true);

        if (string.IsNullOrWhiteSpace(appBaseUrl) || string.IsNullOrWhiteSpace(sharedSecret))
        {
            return false;
        }

        string viewerExternalId = GetFirstArgString(ViewerIdArgCandidates);
        if (string.IsNullOrWhiteSpace(viewerExternalId))
        {
            CPH.LogError(string.Format(
                "[Loja Neon] Nao consegui descobrir o id do viewer para o comando !link. Args disponiveis: {0}.",
                ListAvailableArgs()
            ));
            Reply("Nao consegui identificar seu canal do YouTube para vincular a conta.", useBotAccount);
            return false;
        }

        string linkCode = ResolveLinkCode();
        if (string.IsNullOrWhiteSpace(linkCode))
        {
            Reply("Comando invalido. Use !link CODIGO.", useBotAccount);
            return false;
        }

        string displayName = GetFirstArgString(DisplayNameArgCandidates);
        string youtubeHandle = NormalizeHandle(GetFirstArgString(HandleArgCandidates));

        string body = BuildRequestBody(
            linkCode,
            viewerExternalId,
            displayName,
            youtubeHandle,
            "streamerbot_chat"
        );
        string timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString();
        string signature = BuildSignature(body, timestamp, sharedSecret);

        try
        {
            using (var request = new HttpRequestMessage(
                HttpMethod.Post,
                string.Format("{0}/api/internal/streamerbot/link", appBaseUrl.TrimEnd('/'))
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
                            ? "Conta vinculada com sucesso."
                            : "Nao consegui vincular sua conta agora.";
                    }

                    Reply(replyMessage, useBotAccount);

                    if (!response.IsSuccessStatusCode)
                    {
                        CPH.LogWarn(string.Format(
                            "[Loja Neon] Falha ao vincular conta pelo chat: HTTP {0} - {1}",
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
            CPH.LogError(string.Format("[Loja Neon] Erro ao chamar API de vinculo: {0}", ex));
            Reply("Nao consegui vincular sua conta agora.", useBotAccount);
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

    private string ResolveLinkCode()
    {
        foreach (string candidate in LinkCodeArgCandidates)
        {
            string rawValue = GetArgString(candidate);
            if (string.IsNullOrWhiteSpace(rawValue))
            {
                continue;
            }

            string payload = NormalizeCommandPayload(rawValue);
            if (string.IsNullOrWhiteSpace(payload))
            {
                continue;
            }

            string firstToken = ExtractFirstToken(payload);
            Match match = Regex.Match(firstToken, @"^[A-Z0-9]{4,32}$", RegexOptions.IgnoreCase);
            if (match.Success)
            {
                return match.Value.ToUpperInvariant();
            }
        }

        return string.Empty;
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
        if (string.IsNullOrWhiteSpace(argName))
        {
            return null;
        }

        if (CPH.TryGetArg(argName, out string stringValue) && !string.IsNullOrWhiteSpace(stringValue))
        {
            return stringValue.Trim();
        }

        if (CPH.TryGetArg(argName, out object rawValue) && rawValue != null)
        {
            string converted = rawValue.ToString();
            if (!string.IsNullOrWhiteSpace(converted))
            {
                return converted.Trim();
            }
        }

        return null;
    }

    private string NormalizeHandle(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        string trimmed = value.Trim();
        return trimmed.StartsWith("@") ? trimmed : "@" + trimmed;
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

    private string ExtractFirstToken(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        Match match = Regex.Match(value.Trim(), @"^([A-Z0-9]{4,32})(?:\s|$)", RegexOptions.IgnoreCase);
        return match.Success ? match.Groups[1].Value : string.Empty;
    }

    private string BuildRequestBody(
        string linkCode,
        string viewerExternalId,
        string displayName,
        string youtubeHandle,
        string source
    )
    {
        var builder = new StringBuilder();
        builder.Append('{');
        builder.AppendFormat("\"linkCode\":\"{0}\"", JsonEscape(linkCode));
        builder.AppendFormat(",\"viewerExternalId\":\"{0}\"", JsonEscape(viewerExternalId));

        if (!string.IsNullOrWhiteSpace(displayName))
        {
            builder.AppendFormat(",\"youtubeDisplayName\":\"{0}\"", JsonEscape(displayName));
        }

        if (!string.IsNullOrWhiteSpace(youtubeHandle))
        {
            builder.AppendFormat(",\"youtubeHandle\":\"{0}\"", JsonEscape(youtubeHandle));
        }

        builder.AppendFormat(",\"source\":\"{0}\"", JsonEscape(source));
        builder.Append('}');
        return builder.ToString();
    }

    private string BuildSignature(string body, string timestamp, string secret)
    {
        using (var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret)))
        {
            byte[] hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(timestamp + "." + body));
            return BitConverter.ToString(hash).Replace("-", "").ToLowerInvariant();
        }
    }

    private string ExtractReplyMessage(string responseText)
    {
        if (string.IsNullOrWhiteSpace(responseText))
        {
            return string.Empty;
        }

        Match match = Regex.Match(responseText, "\"replyMessage\"\\s*:\\s*\"(?<value>(?:\\\\.|[^\"])*)\"");
        return match.Success ? JsonUnescape(match.Groups["value"].Value) : string.Empty;
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
        if (value == null)
        {
            return string.Empty;
        }

        return value
            .Replace("\\r", "\r")
            .Replace("\\n", "\n")
            .Replace("\\t", "\t")
            .Replace("\\\"", "\"")
            .Replace("\\\\", "\\");
    }

    private string ListAvailableArgs()
    {
        try
        {
            return string.Join(", ", args.Keys);
        }
        catch
        {
            return "(indisponivel)";
        }
    }
}
