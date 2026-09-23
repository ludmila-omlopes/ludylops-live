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

    private static readonly HttpClient Http = new HttpClient
    {
        Timeout = TimeSpan.FromSeconds(10),
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

        string viewerExternalId = GetFirstArgString(ViewerIdArgCandidates);
        if (string.IsNullOrWhiteSpace(viewerExternalId))
        {
            CPH.LogError(string.Format(
                "[Loja Neon] Não consegui descobrir o ID do espectador. Args testados: {0}. Args disponíveis: {1}.",
                string.Join(", ", ViewerIdArgCandidates),
                ListAvailableArgs()
            ));
            Reply("Não consegui identificar seu canal do YouTube para consultar seu saldo.", useBotAccount);
            return false;
        }

        string displayName = GetFirstArgString(DisplayNameArgCandidates);
        string youtubeHandle = NormalizeHandle(GetFirstArgString(HandleArgCandidates));
        string body = BuildRequestBody(viewerExternalId, displayName, youtubeHandle, "streamerbot_chat");
        string timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString();
        string signature = BuildSignature(body, timestamp, sharedSecret, credentialId);

        try
        {
            using (var request = new HttpRequestMessage(
                HttpMethod.Post,
                string.Format("{0}/api/internal/streamerbot/points", appBaseUrl.TrimEnd('/'))
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
                            ? string.Format("{0}, não consegui montar a resposta completa do saldo.", displayName ?? "Viewer")
                            : "Não consegui consultar seu saldo agora.";
                    }

                    Reply(replyMessage, useBotAccount);

                    if (!response.IsSuccessStatusCode)
                    {
                        CPH.LogWarn(string.Format(
                            "[Loja Neon] Falha ao consultar saldo: HTTP {0} - {1}",
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
            CPH.LogError(string.Format("[Loja Neon] Erro ao chamar API de saldo: {0}", ex));
            Reply("Não consegui consultar seu saldo agora.", useBotAccount);
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

    private string BuildSignature(string body, string timestamp, string secret, string credentialId)
    {
        using (var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret)))
        {
            byte[] hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(string.Format("v2\n{0}\n{1}\nPOST\n/api/internal/streamerbot/points\n{2}", timestamp, credentialId, body)));
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
            CPH.LogWarn(string.Format("[Loja Neon] Não consegui ler a resposta do saldo: {0}", ex.Message));
        }

        return string.Empty;
    }

    private string BuildRequestBody(
        string viewerExternalId,
        string displayName,
        string youtubeHandle,
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
