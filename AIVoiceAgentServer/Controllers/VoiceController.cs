using AIVoiceAgentServer.Models;
using AIVoiceAgentServer.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace AIVoiceAgentServer.Controllers;

[ApiController]
[Route("api/voice")]
public sealed class VoiceController : ControllerBase
{
    private readonly IGroqSpeechService _speechService;
    private readonly IGroqChatService _chatService;
    private readonly IGroqTtsService _ttsService;

    public VoiceController(
        IGroqSpeechService speechService,
        IGroqChatService chatService,
        IGroqTtsService ttsService)
    {
        _speechService = speechService;
        _chatService = chatService;
        _ttsService = ttsService;
    }

    [HttpPost("chat")]
    [RequestSizeLimit(30_000_000)]
    public async Task<IActionResult> Chat(
        [FromBody] VoiceChatRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.AudioBase64))
            {
                return BadRequest(new VoiceChatResponse { Success = false, Error = "Audio is required." });
            }

            if (string.IsNullOrWhiteSpace(request.SttModel))
            {
                return BadRequest(new VoiceChatResponse { Success = false, Error = "STT model is required." });
            }

            if (string.IsNullOrWhiteSpace(request.ChatModel))
            {
                return BadRequest(new VoiceChatResponse { Success = false, Error = "Chat model is required." });
            }

            if (string.IsNullOrWhiteSpace(request.TtsModel))
            {
                return BadRequest(new VoiceChatResponse { Success = false, Error = "TTS model is required." });
            }

            var audioBytes = Convert.FromBase64String(request.AudioBase64);

            if (audioBytes.Length == 0)
            {
                return BadRequest(new VoiceChatResponse { Success = false, Error = "Audio data is empty." });
            }

            var fileName = string.IsNullOrWhiteSpace(request.FileName)
                ? "recording.m4a"
                : Path.GetFileName(request.FileName);

            // STEP 1: Speech -> Text
            var userText = await _speechService.TranscribeAsync(
                audioBytes,
                fileName,
                request.SttModel,
                request.Language,
                cancellationToken);

            if (string.IsNullOrWhiteSpace(userText))
            {
                return Ok(new VoiceChatResponse
                {
                    Success = true,
                    UserText = string.Empty,
                    AiText = "I didn't hear you clearly. Please try again.",
                    AudioBase64 = string.Empty,
                    AudioContentType = "audio/wav"
                });
            }

            // STEP 2: Text -> AI response
            var aiText = await _chatService.GenerateResponseAsync(
                userText,
                request.Mode,
                request.Character,
                request.ChatModel,
                request.History,
                cancellationToken);

            if (string.IsNullOrWhiteSpace(aiText))
            {
                throw new InvalidOperationException("AI returned an empty response.");
            }

            // STEP 3: AI response -> Voice
            var voice = ResolveVoice(request.VoiceGender);

            var audio = await _ttsService.GenerateSpeechAsync(
                aiText,
                request.TtsModel,
                voice,
                cancellationToken);

            return Ok(new VoiceChatResponse
            {
                Success = true,
                UserText = userText,
                AiText = aiText,
                AudioBase64 = Convert.ToBase64String(audio),
                AudioContentType = "audio/wav"
            });
        }
        catch (FormatException)
        {
            return BadRequest(new VoiceChatResponse { Success = false, Error = "Invalid audio Base64 data." });
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            return StatusCode(StatusCodes.Status499ClientClosedRequest, new VoiceChatResponse { Success = false, Error = "Voice request was cancelled." });
        }
        catch (HttpRequestException ex)
        {
            return StatusCode(StatusCodes.Status502BadGateway, new VoiceChatResponse { Success = false, Error = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(StatusCodes.Status500InternalServerError, new VoiceChatResponse { Success = false, Error = "Voice AI processing failed: " + ex.Message });
        }
    }

    private static string ResolveVoice(string gender)
    {
        return gender.ToLowerInvariant() switch
        {
            "male" => "troy",
            _ => "hannah"
        };
    }
}