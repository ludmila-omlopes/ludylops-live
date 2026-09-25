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

    private static readonly string[] QuoteIdArgCandidates = new[]
    {
        "quoteId",
        "input0",
        "commandInput",
        "rawInput",
        "message",
        "text",
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

        if (!TryGetOptionalQuoteId(out string quoteId))
        {
            Reply("Comando invalido. Use !quote ou !quote <numero>.", useBotAccount);
            return false;
        }

        string body = BuildRequestBody(quoteId, "streamerbot_chat");
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
                            ? "Quote carregada com sucesso."
                            : "Nao consegui buscar a quote agora.";
                    }

                    Reply(replyMessage, useBotAccount);

                    if (!response.IsSuccessStatusCode)
                    {
                        CPH.LogWarn(string.Format(
                            "[Loja Neon] Falha ao buscar quote: HTTP {0} - {1}",
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
            Reply("Nao consegui buscar a quote agora.", useBotAccount);
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

    private bool TryGetOptionalQuoteId(out string quoteId)
    {
        quoteId = null;

        foreach (string candidate in QuoteIdArgCandidates)
        {
            string rawValue = NormalizeCommandPayload(GetArgString(candidate));
            if (string.IsNullOrWhiteSpace(rawValue))
            {
                continue;
            }

            string firstToken = ExtractFirstToken(rawValue);
            if (string.IsNullOrWhiteSpace(firstToken))
            {
                continue;
            }

            if (!int.TryParse(firstToken, out int parsed) || parsed <= 0)
            {
                quoteId = null;
                return false;
            }

            quoteId = parsed.ToString();
            return true;
        }

        if (string.IsNullOrWhiteSpace(quoteId))
        {
            quoteId = null;
            return true;
        }

        return true;
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

    private string BuildRequestBody(string quoteId, string source)
    {
        var builder = new StringBuilder();
        builder.Append("{");
        builder.Append("\"action\":\"get\"");

        if (!string.IsNullOrWhiteSpace(quoteId))
        {
            builder.AppendFormat(",\"quoteId\":{0}", quoteId);
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
            return null;
        }

        string trimmed = value.Trim();
        int firstSpace = trimmed.IndexOf(' ');
        if (firstSpace < 0)
        {
            return trimmed;
        }

        return trimmed.Substring(0, firstSpace).Trim();
    }
}
