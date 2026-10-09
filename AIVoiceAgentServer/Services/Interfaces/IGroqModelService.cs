using AIVoiceAgentServer.Models;

namespace AIVoiceAgentServer.Services.Interfaces;

public interface IGroqModelService
{
    Task<IReadOnlyList<GroqModel>> GetAvailableModelsAsync(CancellationToken cancellationToken = default);
    Task<ModelCatalog> GetCategorizedModelsAsync(CancellationToken cancellationToken = default);
}

public sealed class ModelCatalog
{
    public List<GroqModel> Chat { get; set; } = [];
    public List<GroqModel> SpeechToText { get; set; } = [];
    public List<GroqModel> TextToSpeech { get; set; } = [];
}