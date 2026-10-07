using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using AIVoiceAgentServer.Configuration;
using AIVoiceAgentServer.Services.Interfaces;
using Microsoft.Extensions.Options;

namespace AIVoiceAgentServer.Services;

public sealed class GroqTtsService
    : IGroqTtsService
{
    private const int MaxInputCharacters = 200;

    private readonly HttpClient _httpClient;
    private readonly GroqOptions _options;

    public GroqTtsService(
        HttpClient httpClient,
        IOptions<GroqOptions> options)
    {
        _httpClient = httpClient;
        _options = options.Value;
    }

    public async Task<byte[]>
        GenerateSpeechAsync(
            string text,
            string model,
            string voice,
            CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            throw new ArgumentException(
                "TTS text is empty.",
                nameof(text));
        }

        if (string.IsNullOrWhiteSpace(model))
        {
            throw new ArgumentException(
                "TTS model is required.",
                nameof(model));
        }

        if (string.IsNullOrWhiteSpace(voice))
        {
            throw new ArgumentException(
                "TTS voice is required.",
                nameof(voice));
        }

        var safeText = PrepareTextForTts(text);

        var body = new
        {
            model,
            input = safeText,
            voice,
            response_format = "wav" // Required by Canopy Labs Orpheus TTS endpoints
        };

        var json = JsonSerializer.Serialize(body);

        using var request =
            new HttpRequestMessage(
                HttpMethod.Post,
                "audio/speech");

        request.Headers.Authorization =
            new AuthenticationHeaderValue(
                "Bearer",
                _options.ApiKey);

        request.Content =
            new StringContent(
                json,
                Encoding.UTF8,
                "application/json");

        using var response =
            await _httpClient.SendAsync(
                request,
                cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var error =
                await response.Content
                    .ReadAsStringAsync(
                        cancellationToken);

            throw new HttpRequestException(
                "Groq TTS failed. " +
                $"Status: {(int)response.StatusCode}. " +
                $"Response: {error}");
        }

        var audio =
            await response.Content
                .ReadAsByteArrayAsync(
                    cancellationToken);

        if (audio.Length == 0)
        {
            throw new InvalidOperationException(
                "Groq TTS returned empty audio.");
        }

        return audio;
    }

    private static string PrepareTextForTts(string text)
    {
        var cleaned = text.Trim();

        if (cleaned.Length <= MaxInputCharacters)
        {
            return cleaned;
        }

        var candidate = cleaned[..MaxInputCharacters];

        var lastSentence =
            candidate.LastIndexOfAny(['.', '!', '?']);

        if (lastSentence >= 40)
        {
            return candidate[..(lastSentence + 1)];
        }

        var lastSpace = candidate.LastIndexOf(' ');

        if (lastSpace >= 40)
        {
            return candidate[..lastSpace];
        }

        return candidate;
    }
}