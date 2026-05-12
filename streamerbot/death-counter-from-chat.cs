using System;
using System.Globalization;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;

public class CPHInline
{
    private static readonly HttpClient Http = new HttpClient
    {
        Timeout = TimeSpan.FromSeconds(10),
    };

    private static readonly string[] RequestedByArgCandidates = new[]
    {
        "display",
        "displayName",
        "authorName",
        "userName",
        "username",
        "userLogin",
        "targetUser",
        "user",
    };

    private static readonly string[] ActionArgCandidates = new[]
    {
        "counterAction",
        "action",
    };

    private static readonly string[] CommandNameArgCandidates = new[]
    {
        "command",
        "commandName",
    };

    private static readonly string[] CommandPatternArgCandidates = new[]
    {
        "command",
        "commandName",
    };

    private static readonly string[] AmountArgCandidates = new[]
    {
        "amount",
        "count",
        "value",
    };

    private static readonly string[] ScopeKeyArgCandidates = new[]
    {
        "scopeKey",
        "gameKey",
        "counterGameKey",
    };

    private static readonly string[] ScopeLabelArgCandidates = new[]
    {
        "scopeLabel",
        "gameLabel",
        "counterGameLabel",
    };

    private static readonly string[] CommandPayloadArgCandidates = new[]
    {
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
        string sharedSecret = ReadRequiredGlobal("lojaneon.streamerbotSharedSecret");
        bool useBotAccount = ReadOptionalBoolGlobal("lojaneon.useBotAccount", true);
        bool debugLogging = ReadOptionalBoolGlobal("lojaneon.debugDeathCounter", true);

        if (string.IsNullOrWhiteSpace(appBaseUrl) || string.IsNullOrWhiteSpace(sharedSecret))
        {
            return false;
        }

        string endpointUrl = BuildEndpointUrl(appBaseUrl);
        if (string.IsNullOrWhiteSpace(endpointUrl))
        {
            CPH.LogError(string.Format(
                "[Loja Neon] appBaseUrl invalida para contador de mortes: {0}",
                appBaseUrl ?? "<null>"
            ));
            Reply("Nao consegui atualizar o contador agora.", useBotAccount);
            return false;
        }

        string rawCommand = GetRawCommandText();
        string action = ResolveAction(rawCommand);
        if (string.IsNullOrWhiteSpace(action))
        {
            CPH.LogWarn(string.Format(
                "[Loja Neon] Nao foi possivel resolver a action do contador. {0}",
                BuildDiagnosticsSummary(rawCommand, string.Empty, 0, string.Empty, string.Empty)
            ));
            Reply("Comando invalido. Use !death+, !death- ou !deaths.", useBotAccount);
            return false;
        }

        int amount = ResolveAmount(rawCommand);
        string requestedBy = GetFirstArgString(RequestedByArgCandidates);
        string scopeKey = ResolveScopeKey();
        string scopeLabel = ResolveScopeLabel();
        string body = BuildRequestBody(action, amount, requestedBy, scopeKey, scopeLabel, "streamerbot_chat");
        string timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString();
        string signature = BuildSignature(body, timestamp, sharedSecret);

        if (debugLogging)
        {
            CPH.LogInfo(string.Format(
                "[Loja Neon] Preparando envio do contador de mortes. endpoint={0}; {1}; body={2}",
                endpointUrl,
                BuildDiagnosticsSummary(rawCommand, action, amount, scopeKey, scopeLabel),
                TruncateForLog(body, 600)
            ));
        }

        try
        {
            using (var request = new HttpRequestMessage(
                HttpMethod.Post,
                endpointUrl
            ))
            {
                request.Headers.TryAddWithoutValidation("x-timestamp", timestamp);
                request.Headers.TryAddWithoutValidation("x-signature", signature);
                request.Headers.TryAddWithoutValidation("x-source", "streamerbot");
                request.Content = new StringContent(body, Encoding.UTF8, "application/json");

                using (HttpResponseMessage response = Http.SendAsync(request).GetAwaiter().GetResult())
                {
                    string responseText = response.Content.ReadAsStringAsync().GetAwaiter().GetResult();
                    string replyMessage = ExtractReplyMessage(responseText);

                    if (string.IsNullOrWhiteSpace(replyMessage))
                    {
                        replyMessage = response.IsSuccessStatusCode
                            ? "Contador atualizado."
                            : "Nao consegui atualizar o contador agora.";
                    }

                    Reply(replyMessage, useBotAccount);

                    if (!response.IsSuccessStatusCode)
                    {
                        CPH.LogWarn(string.Format(
                            "[Loja Neon] Falha ao chamar contador de mortes: HTTP {0}; endpoint={1}; {2}; response={3}",
                            (int)response.StatusCode,
                            endpointUrl,
                            BuildDiagnosticsSummary(rawCommand, action, amount, scopeKey, scopeLabel),
                            TruncateForLog(responseText, 600)
                        ));
                    }
                    else if (debugLogging)
                    {
                        CPH.LogInfo(string.Format(
                            "[Loja Neon] Contador de mortes processado com sucesso: HTTP {0}; endpoint={1}; response={2}",
                            (int)response.StatusCode,
                            endpointUrl,
                            TruncateForLog(responseText, 600)
                        ));
                    }

                    return response.IsSuccessStatusCode;
                }
            }
        }
        catch (Exception ex)
        {
            CPH.LogError(string.Format(
                "[Loja Neon] Erro ao chamar API de contadores. endpoint={0}; {1}; exception={2}",
                endpointUrl,
                BuildDiagnosticsSummary(rawCommand, action, amount, scopeKey, scopeLabel),
                ex
            ));
            Reply("Nao consegui atualizar o contador agora.", useBotAccount);
            return false;
        }
    }

    private void Reply(string message, bool useBot)
    {
        CPH.SendYouTubeMessageToLatestMonitored(message, useBot, true);
    }

    private string ResolveAction(string rawCommand)
    {
        string explicitAction = NormalizeAction(GetFirstArgString(ActionArgCandidates));
        if (!string.IsNullOrWhiteSpace(explicitAction))
        {
            return explicitAction;
        }

        string commandName = GetFirstArgString(CommandNameArgCandidates);
        if (!string.IsNullOrWhiteSpace(commandName))
        {
            string actionFromCommandArg = ResolveActionFromCommandName(commandName);
            if (!string.IsNullOrWhiteSpace(actionFromCommandArg))
            {
                return actionFromCommandArg;
            }
        }

        string commandPattern = GetFirstArgString(CommandPatternArgCandidates);
        if (!string.IsNullOrWhiteSpace(commandPattern))
        {
            string actionFromPattern = ResolveActionFromPattern(commandPattern);
            if (!string.IsNullOrWhiteSpace(actionFromPattern))
            {
                return actionFromPattern;
            }
        }

        commandName = GetCommandName(rawCommand);
        return ResolveActionFromCommandName(commandName);
    }

    private string ResolveActionFromCommandName(string commandName)
    {
        if (string.IsNullOrWhiteSpace(commandName))
        {
            return string.Empty;
        }

        switch (commandName)
        {
            case "!morte+":
            case "!death+":
                return "increment";
            case "!morte-":
            case "!death-":
                return "decrement";
            case "!mortes":
            case "!deaths":
                return "get";
            default:
                return string.Empty;
        }
    }

    private string ResolveActionFromPattern(string commandPattern)
    {
        if (string.IsNullOrWhiteSpace(commandPattern))
        {
            return string.Empty;
        }

        string normalized = commandPattern.Trim().ToLowerInvariant();
        if (ContainsCommandToken(normalized, "!death+") || ContainsCommandToken(normalized, "!morte+"))
        {
            return "increment";
        }

        if (ContainsCommandToken(normalized, "!death-") || ContainsCommandToken(normalized, "!morte-"))
        {
            return "decrement";
        }

        if (ContainsCommandToken(normalized, "!deaths") || ContainsCommandToken(normalized, "!mortes"))
        {
            return "get";
        }

        return string.Empty;
    }

    private int ResolveAmount(string rawCommand)
    {
        foreach (string candidate in AmountArgCandidates)
        {
            if (TryGetIntArg(candidate, out int directAmount) && directAmount > 0)
            {
                return directAmount;
            }
        }

        string commandArgs = GetCommandArgs(rawCommand);
        if (!string.IsNullOrWhiteSpace(commandArgs) &&
            int.TryParse(commandArgs, NumberStyles.Integer, CultureInfo.InvariantCulture, out int parsedAmount) &&
            parsedAmount > 0)
        {
            return parsedAmount;
        }

        return 1;
    }

    private string ResolveScopeKey()
    {
        string argValue = NormalizeScopeKey(GetFirstArgString(ScopeKeyArgCandidates));
        if (!string.IsNullOrWhiteSpace(argValue))
        {
            return argValue;
        }

        return NormalizeScopeKey(ReadOptionalGlobal("lojaneon.counterGameKey"));
    }

    private string ResolveScopeLabel()
    {
        string argValue = GetFirstArgString(ScopeLabelArgCandidates);
        if (!string.IsNullOrWhiteSpace(argValue))
        {
            return argValue.Trim();
        }

        string globalValue = ReadOptionalGlobal("lojaneon.counterGameLabel");
        return string.IsNullOrWhiteSpace(globalValue) ? string.Empty : globalValue.Trim();
    }

    private string BuildRequestBody(
        string action,
        int amount,
        string requestedBy,
        string scopeKey,
        string scopeLabel,
        string source
    )
    {
        var builder = new StringBuilder();
        builder.Append("{");
        builder.AppendFormat("\"action\":\"{0}\"", JsonEscape(action));
        builder.AppendFormat(",\"amount\":{0}", amount);

        if (!string.IsNullOrWhiteSpace(requestedBy))
        {
            builder.AppendFormat(",\"requestedBy\":\"{0}\"", JsonEscape(requestedBy));
        }

        if (!string.IsNullOrWhiteSpace(scopeKey))
        {
            builder.Append(",\"scopeType\":\"game\"");
            builder.AppendFormat(",\"scopeKey\":\"{0}\"", JsonEscape(scopeKey));

            if (!string.IsNullOrWhiteSpace(scopeLabel))
            {
                builder.AppendFormat(",\"scopeLabel\":\"{0}\"", JsonEscape(scopeLabel));
            }
        }

        builder.AppendFormat(",\"source\":\"{0}\"", JsonEscape(source));
        builder.Append("}");
        return builder.ToString();
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

    private string GetRawCommandText()
    {
        return GetFirstArgString(CommandPayloadArgCandidates) ?? string.Empty;
    }

    private string BuildEndpointUrl(string appBaseUrl)
    {
        if (string.IsNullOrWhiteSpace(appBaseUrl))
        {
            return string.Empty;
        }

        string trimmed = appBaseUrl.Trim();
        if (!trimmed.StartsWith("http://", StringComparison.OrdinalIgnoreCase) &&
            !trimmed.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            return string.Empty;
        }

        return string.Format("{0}/api/internal/streamerbot/deaths", trimmed.TrimEnd('/'));
    }

    private string BuildDiagnosticsSummary(
        string rawCommand,
        string action,
        int amount,
        string scopeKey,
        string scopeLabel
    )
    {
        return string.Format(
            "isTest={0}; trigger={1}; source={2}; command={3}; rawInput={4}; input0={5}; amountArg={6}; resolvedAction={7}; resolvedAmount={8}; requestedBy={9}; scopeKey={10}; scopeLabel={11}",
            GetArgString("isTest") ?? "<null>",
            GetArgString("triggerName") ?? "<null>",
            GetArgString("commandSource") ?? GetArgString("source") ?? "<null>",
            TruncateForLog(GetFirstArgString(CommandNameArgCandidates) ?? string.Empty, 120),
            TruncateForLog(rawCommand ?? string.Empty, 120),
            TruncateForLog(GetArgString("input0") ?? string.Empty, 120),
            GetArgString("amount") ?? "<null>",
            string.IsNullOrWhiteSpace(action) ? "<null>" : action,
            amount,
            TruncateForLog(GetFirstArgString(RequestedByArgCandidates) ?? string.Empty, 120),
            string.IsNullOrWhiteSpace(scopeKey) ? "<global>" : scopeKey,
            string.IsNullOrWhiteSpace(scopeLabel) ? "<null>" : TruncateForLog(scopeLabel, 120)
        );
    }

    private string GetCommandName(string rawCommand)
    {
        if (string.IsNullOrWhiteSpace(rawCommand))
        {
            return string.Empty;
        }

        string trimmed = rawCommand.Trim();
        int separatorIndex = trimmed.IndexOf(' ');
        return separatorIndex < 0 ? trimmed.ToLowerInvariant() : trimmed.Substring(0, separatorIndex).ToLowerInvariant();
    }

    private string GetCommandArgs(string rawCommand)
    {
        if (string.IsNullOrWhiteSpace(rawCommand))
        {
            return string.Empty;
        }

        string trimmed = rawCommand.Trim();
        int separatorIndex = trimmed.IndexOf(' ');
        if (separatorIndex < 0 || separatorIndex == trimmed.Length - 1)
        {
            return string.Empty;
        }

        return trimmed.Substring(separatorIndex + 1).Trim();
    }

    private string NormalizeAction(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        string normalized = value.Trim().ToLowerInvariant();
        switch (normalized)
        {
            case "increment":
            case "decrement":
            case "get":
            case "reset":
                return normalized;
            default:
                return string.Empty;
        }
    }

    private string NormalizeScopeKey(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        return value.Trim().ToLowerInvariant().Replace(" ", "_");
    }

    private bool ContainsCommandToken(string haystack, string token)
    {
        if (string.IsNullOrWhiteSpace(haystack) || string.IsNullOrWhiteSpace(token))
        {
            return false;
        }

        return haystack.Contains(token) || haystack.Contains(token.Replace("+", "\\+"));
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

    private bool TryGetIntArg(string argName, out int value)
    {
        if (args != null && args.ContainsKey(argName) && args[argName] != null)
        {
            string rawValue = args[argName].ToString();
            if (int.TryParse(rawValue, NumberStyles.Integer, CultureInfo.InvariantCulture, out value))
            {
                return true;
            }
        }

        if (CPH.TryGetArg(argName, out int typedValue))
        {
            value = typedValue;
            return true;
        }

        if (CPH.TryGetArg(argName, out string stringValue) &&
            int.TryParse(stringValue, NumberStyles.Integer, CultureInfo.InvariantCulture, out value))
        {
            return true;
        }

        value = 0;
        return false;
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
            CPH.LogWarn(string.Format("[Loja Neon] Nao consegui ler a resposta do contador: {0}", ex.Message));
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

    private string TruncateForLog(string value, int maxLength)
    {
        if (string.IsNullOrEmpty(value))
        {
            return string.Empty;
        }

        if (value.Length <= maxLength)
        {
            return value;
        }

        return value.Substring(0, maxLength) + "...";
    }
}
