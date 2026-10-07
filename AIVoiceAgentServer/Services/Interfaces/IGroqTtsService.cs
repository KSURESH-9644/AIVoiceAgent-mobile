namespace AIVoiceAgentServer.Services.Interfaces;

public interface IGroqTtsService
{
    Task<byte[]> GenerateSpeechAsync(string text, string model, string voice, CancellationToken cancellationToken = default);
}