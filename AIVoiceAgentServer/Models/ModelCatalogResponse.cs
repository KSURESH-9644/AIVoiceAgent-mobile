namespace AIVoiceAgentServer.Models;

public sealed class ModelCatalogResponse
{
    public List<GroqModel> Data { get; set; } = [];
}