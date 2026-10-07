namespace AIVoiceAgentServer.Services.Interfaces;

public interface IGroqSpeechService
{
    Task<string> TranscribeAsync(
        byte[] audioBytes,
        string fileName,
        string model,
        string? language,
        CancellationToken cancellationToken = default);
}