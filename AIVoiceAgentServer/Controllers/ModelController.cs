using AIVoiceAgentServer.Services;
using AIVoiceAgentServer.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace AIVoiceAgentServer.Controllers;

[ApiController]
[Route("api/models")]
public sealed class ModelController : ControllerBase
{
    private readonly IGroqModelService _modelService;

    public ModelController(IGroqModelService modelService)
    {
        _modelService = modelService;
    }

    [HttpGet]
    public async Task<IActionResult> GetModels(CancellationToken cancellationToken)
    {
        try
        {
            var catalog = await _modelService.GetCategorizedModelsAsync(cancellationToken);

            return Ok(new
            {
                success = true,
                data = catalog
            });
        }
        catch (Exception ex)
        {
            return StatusCode(
                StatusCodes.Status502BadGateway,
                new
                {
                    success = false,
                    message = "Unable to retrieve Groq models.",
                    error = ex.Message
                });
        }
    }
}