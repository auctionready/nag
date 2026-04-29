using JasperFx.Events;
using Marten.Events.Projections;
using Nag.Core.Events;
using Nag.Core.ReadModels;

namespace Nag.Core.Projections;

/// <summary>
/// One <see cref="CheckInState"/> doc per check-in, keyed by `CheckInId`.
/// Inline projection so the <see cref="Handlers.CommandDispatcher"/> can
/// read the prior state in the same transaction it appends the new event,
/// without any extra round-trip.
/// </summary>
public sealed class CheckInIndexProjection : MultiStreamProjection<CheckInState, Guid>
{
    public CheckInIndexProjection()
    {
        Identity<CheckInRecorded>(e => e.CheckInId);
        Identity<CheckInMoved>(e => e.CheckInId);
        Identity<CheckInMarkedSkipped>(e => e.CheckInId);
        Identity<CheckInMarkedDone>(e => e.CheckInId);
        Identity<CheckInDeleted>(e => e.CheckInId);
    }

    public static CheckInState Create(IEvent<CheckInRecorded> e) =>
        new()
        {
            Id = e.Data.CheckInId,
            HabitId = e.Data.HabitId,
            Timestamp = e.Data.Timestamp,
            Skipped = e.Data.Skipped,
        };

    public void Apply(IEvent<CheckInMoved> e, CheckInState s)
    {
        s.Timestamp = e.Data.NewTimestamp;
    }

    public void Apply(IEvent<CheckInMarkedSkipped> e, CheckInState s)
    {
        s.Skipped = true;
    }

    public void Apply(IEvent<CheckInMarkedDone> e, CheckInState s)
    {
        s.Skipped = false;
    }

    public void Apply(IEvent<CheckInDeleted> e, CheckInState s)
    {
        s.Deleted = true;
    }
}
