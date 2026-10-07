using System.Net.Http.Headers;
using System.Text.Json;
using AIVoiceAgentServer.Configuration;
using AIVoiceAgentServer.Services.Interfaces;
using Microsoft.Extensions.Options;

namespace AIVoiceAgentServer.Services;

public sealed class GroqSpeechService
    : IGroqSpeechService
{
    private readonly HttpClient _httpClient;

    private readonly GroqOptions _options;

    public GroqSpeechService(
        HttpClient httpClient,
        IOptions<GroqOptions> options)
    {
        _httpClient =
            httpClient;

        _options =
            options.Value;
    }

    public async Task<string>
        TranscribeAsync(
            byte[] audioBytes,
            string fileName,
            string model,
            string? language,
            CancellationToken cancellationToken = default)
    {
        if (
            audioBytes.Length == 0)
        {
            throw new ArgumentException(
                "Audio file is empty.",
                nameof(audioBytes));
        }

        if (
            string.IsNullOrWhiteSpace(
                model))
        {
            throw new ArgumentException(
                "STT model is required.",
                nameof(model));
        }

        var safeFileName =
            GetSafeFileName(
                fileName);

        using var form =
            new MultipartFormDataContent();

        var audioContent =
            new ByteArrayContent(
                audioBytes);

        audioContent.Headers.ContentType =
            new MediaTypeHeaderValue(
                GetContentType(
                    safeFileName));

        form.Add(
            audioContent,
            "file",
            safeFileName);

        form.Add(
            new StringContent(
                model),
            "model");

        form.Add(
            new StringContent(
                "json"),
            "response_format");

        form.Add(
            new StringContent(
                "0"),
            "temperature");

        if (
            !string.IsNullOrWhiteSpace(
                language))
        {
            form.Add(
                new StringContent(
                    language),
                "language");
        }

        using var request =
            new HttpRequestMessage(
                HttpMethod.Post,
                "audio/transcriptions");

        request.Headers.Authorization =
            new AuthenticationHeaderValue(
                "Bearer",
                _options.ApiKey);

        request.Content =
            form;

        using var response =
            await _httpClient.SendAsync(
                request,
                cancellationToken);

        var content =
            await response.Content
                .ReadAsStringAsync(
                    cancellationToken);

        if (
            !response.IsSuccessStatusCode)
        {
            throw new HttpRequestException(
                "Groq STT failed. " +
                $"Status: {(int)response.StatusCode}. " +
                $"Response: {content}");
        }

        using var document =
            JsonDocument.Parse(
                content);

        if (
            !document.RootElement
                .TryGetProperty(
                    "text",
                    out var textElement))
        {
            throw new InvalidOperationException(
                "Groq STT response did not contain text.");
        }

        return textElement
            .GetString()
            ?.Trim()
            ?? string.Empty;
    }

    private static string
        GetSafeFileName(
            string fileName)
    {
        var name =
            Path.GetFileName(
                fileName);

        return string.IsNullOrWhiteSpace(
            name)
            ? "recording.m4a"
            : name;
    }

    private static string
        GetContentType(
            string fileName)
    {
        var extension =
            Path.GetExtension(
                fileName)
                .ToLowerInvariant();

        return extension switch
        {
            ".wav" =>
                "audio/wav",

            ".mp3" =>
                "audio/mpeg",

            ".m4a" =>
                "audio/mp4",

            ".mp4" =>
                "audio/mp4",

            ".mpeg" =>
                "audio/mpeg",

            ".mpga" =>
                "audio/mpeg",

            ".ogg" =>
                "audio/ogg",

            ".webm" =>
                "audio/webm",

            ".flac" =>
                "audio/flac",

            _ =>
                "application/octet-stream"
        };
    }
}