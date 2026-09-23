using System;
using System.Globalization;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;

public class CPHInline
{
    private static readonly HttpClient Http = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };

    public bool Execute()
    {
        try
        {
            string origin = CPH.GetGlobalVar<string>("lojaneon.appBaseUrl", true);
            string credentialId = CPH.GetGlobalVar<string>("lojaneon.streamerbotCredentialId", true);
            string secret = CPH.GetGlobalVar<string>("lojaneon.streamerbotCredentialSecret", true);
            string kind, channel, operationKey, reason;
            if (string.IsNullOrWhiteSpace(origin) || string.IsNullOrWhiteSpace(credentialId) || string.IsNullOrWhiteSpace(secret)) return false;
            if (!CPH.TryGetArg("currencyOperation", out kind) || !CPH.TryGetArg("currencyViewerChannelId", out channel)
                || !CPH.TryGetArg("currencyOperationKey", out operationKey) || !CPH.TryGetArg("currencyReason", out reason)
                || string.IsNullOrWhiteSpace(operationKey) || string.IsNullOrWhiteSpace(reason)) return false;

            string details;
            if (kind == "refund")
            {
                string refundOf;
                if (!CPH.TryGetArg("currencyRefundOf", out refundOf) || string.IsNullOrWhiteSpace(refundOf)) return false;
                details = "\"refundOf\":" + Json(refundOf);
            }
            else
            {
                int amount;
                if ((kind != "credit" && kind != "debit") || !CPH.TryGetArg("currencyAmount", out amount) || amount < 1 || amount > 1000000) return false;
                details = "\"amount\":" + amount.ToString(CultureInfo.InvariantCulture);
            }
            string body = "{\"kind\":" + Json(kind) + ",\"viewerExternalId\":" + Json(channel)
                + ",\"operationKey\":" + Json(operationKey) + ",\"reason\":" + Json(reason) + "," + details + "}";
            string timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString(CultureInfo.InvariantCulture);
            using (var request = new HttpRequestMessage(HttpMethod.Post, origin.TrimEnd('/') + "/api/internal/streamerbot/economy"))
            {
                request.Headers.Add("x-streamerbot-credential-id", credentialId);
                request.Headers.Add("x-timestamp", timestamp);
                request.Headers.Add("x-signature", BuildSignature(body, timestamp, secret, credentialId));
                request.Content = new StringContent(body, Encoding.UTF8, "application/json");
                using (var response = Http.SendAsync(request).GetAwaiter().GetResult())
                {
                    CPH.SetArgument("currencyResponse", response.Content.ReadAsStringAsync().GetAwaiter().GetResult());
                    CPH.SetArgument("currencyHttpStatus", (int)response.StatusCode);
                    CPH.LogInfo("[Moeda da comunidade] HTTP " + (int)response.StatusCode);
                    return response.IsSuccessStatusCode;
                }
            }
        }
        catch
        {
            CPH.LogWarn("[Moeda da comunidade] Resposta indisponível. Repita com a mesma currencyOperationKey e os mesmos valores.");
            return false;
        }
    }

    private string BuildSignature(string body, string timestamp, string secret, string credentialId)
    {
        using (var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret)))
        {
            byte[] hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(string.Format("v2\n{0}\n{1}\nPOST\n/api/internal/streamerbot/economy\n{2}", timestamp, credentialId, body)));
            return BitConverter.ToString(hash).Replace("-", "").ToLowerInvariant();
        }
    }

    private string Json(string value)
    {
        var result = new StringBuilder("\"");
        foreach (char c in value ?? "")
        {
            if (c == '\\' || c == '"') result.Append('\\').Append(c);
            else if (c < 32) result.Append("\\u").Append(((int)c).ToString("x4"));
            else result.Append(c);
        }
        return result.Append('"').ToString();
    }
}
