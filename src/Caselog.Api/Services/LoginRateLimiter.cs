using System.Collections.Concurrent;

namespace Caselog.Api.Services;

public sealed class LoginRateLimiter
{
    private readonly ConcurrentDictionary<string, ConcurrentQueue<DateTime>> _attempts = new();
    private static readonly TimeSpan Window = TimeSpan.FromMinutes(1);
    private const int MaxAttempts = 5;

    public bool IsBlocked(string key)
    {
        var queue = _attempts.GetOrAdd(key, _ => new ConcurrentQueue<DateTime>());
        Trim(queue);
        return queue.Count >= MaxAttempts;
    }

    public void RecordFailure(string key)
    {
        var queue = _attempts.GetOrAdd(key, _ => new ConcurrentQueue<DateTime>());
        queue.Enqueue(DateTime.UtcNow);
        Trim(queue);
    }

    public void Reset(string key)
    {
        _attempts.TryRemove(key, out _);
    }

    private static void Trim(ConcurrentQueue<DateTime> queue)
    {
        var threshold = DateTime.UtcNow - Window;
        while (queue.TryPeek(out var value) && value < threshold)
        {
            queue.TryDequeue(out _);
        }
    }
}
