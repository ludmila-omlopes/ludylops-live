using System;
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
            string appBaseUrl = CPH.GetGlobalVar<string>("lojaneon.appBaseUrl", true);
            string credentialId = CPH.GetGlobalVar<string>("lojaneon.streamerbotCredentialId", true);
            string secret = CPH.GetGlobalVar<string>("lojaneon.streamerbotCredentialSecret", true);
            if (string.IsNullOrWhiteSpace(appBaseUrl) || string.IsNullOrWhiteSpace(credentialId) || string.IsNullOrWhiteSpace(secret)) return false;
            string timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString();
            string body = "{}";
            using (var request = new HttpRequestMessage(HttpMethod.Post, appBaseUrl.TrimEnd('/') + "/api/internal/streamerbot/credentials/check"))
            {
                request.Headers.Add("x-streamerbot-credential-id", credentialId);
                request.Headers.Add("x-timestamp", timestamp);
                request.Headers.Add("x-signature", BuildSignature(body, timestamp, secret, credentialId));
                request.Content = new StringContent(body, Encoding.UTF8, "application/json");
                using (var response = Http.SendAsync(request).GetAwaiter().GetResult())
                {
                    // The check response contains public IDs/status only, never a secret or signature.
                    CPH.LogInfo("[Streamer.bot] Teste de credencial: " + (int)response.StatusCode + " " + response.Content.ReadAsStringAsync().GetAwaiter().GetResult());
                    return response.IsSuccessStatusCode;
                }
            }
        }
        catch
        {
            CPH.LogWarn("[Streamer.bot] Não foi possível testar a credencial.");
            return false;
        }
    }

    private string BuildSignature(string body, string timestamp, string secret, string credentialId)
    {
        using (var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret)))
        {
            byte[] hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(string.Format("v2\n{0}\n{1}\nPOST\n/api/internal/streamerbot/credentials/check\n{2}", timestamp, credentialId, body)));
            return BitConverter.ToString(hash).Replace("-", "").ToLowerInvariant();
        }
    }
}
