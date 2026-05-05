using JasperFx.Events;
using Marten.Events.Projections;
using Nag.Core.Domain;
using Nag.Core.Events;
using Nag.Core.ReadModels;

namespace Nag.Core.Projections;

/// <summary>
/// Projects every habit + check-in event into one
/// <see cref="HabitComplianceHistory"/> document per habit, keyed by
/// <c>HabitId</c>. Powers the "How am I doing" strip on the habit
/// detail screen — the client fetches one doc per habit and renders
/// the <see cref="HabitComplianceHistory.Days"/> list directly.
///
/// Sliced as a <see cref="MultiStreamProjection{TDoc, TKey}"/> because
/// every event lives on the global per-account
/// <see cref="NagStreams.Root"/> stream, not a per-habit stream.
/// </summary>
public sealed class HabitComplianceHistoryProjection
    : MultiStreamProjection<HabitComplianceHistory, Guid>
{
    public HabitComplianceHistoryProjection()
    {
        Identity<HabitCreated>(e => e.HabitId);
        Identity<HabitGoalDefined>(e => e.HabitId);
        Identity<HabitGoalCleared>(e => e.HabitId);
        Identity<HabitDeleted>(e => e.HabitId);
        Identity<CheckInRecorded>(e => e.HabitId);
        Identity<CheckInMoved>(e => e.HabitId);
        Identity<CheckInMarkedSkipped>(e => e.HabitId);
        Identity<CheckInMarkedDone>(e => e.HabitId);
        Identity<CheckInDeleted>(e => e.HabitId);
    }

    public static HabitComplianceHistory Create(IEvent<HabitCreated> e)
    {
        var doc = new HabitComplianceHistory { Id = e.Data.HabitId };
        var goal = e.Data.Goal;
        // Initial goal is treated as retroactive — backfilled check-ins
        // with timestamps before HabitCreated should be evaluated against
        // the goal the user just created, not flagged as NoGoal. Later
        // HabitGoalDefined / HabitGoalCleared events anchor to their own
        // e.Timestamp, slicing the timeline forward from there.
        doc.GoalTimeline.Add(
            new GoalEpoch(DateTimeOffset.MinValue, goal?.Regularity, goal?.Frequency)
        );
        return doc;
    }

    public void Apply(IEvent<HabitCreated> e, HabitComplianceHistory doc)
    {
        EnsureId(doc, e.Data.HabitId);
        var goal = e.Data.Goal;
        AppendEpoch(doc, DateTimeOffset.MinValue, goal?.Regularity, goal?.Frequency);
        RecomputeStatuses(doc);
    }

    public void Apply(IEvent<HabitGoalDefined> e, HabitComplianceHistory doc)
    {
        EnsureId(doc, e.Data.HabitId);
        AppendEpoch(doc, e.Timestamp, e.Data.Regularity, e.Data.Frequency);
        RecomputeStatuses(doc);
    }

    public void Apply(IEvent<HabitGoalCleared> e, HabitComplianceHistory doc)
    {
        EnsureId(doc, e.Data.HabitId);
        AppendEpoch(doc, e.Timestamp, null, null);
        RecomputeStatuses(doc);
    }

    public void Apply(IEvent<HabitDeleted> e, HabitComplianceHistory doc)
    {
        // Habit gone — drop everything but keep the doc shell so the
        // endpoint still returns a coherent (empty) shape if asked.
        doc.GoalTimeline.Clear();
        doc.Days.Clear();
        doc.CheckIns.Clear();
    }

    public void Apply(IEvent<CheckInRecorded> e, HabitComplianceHistory doc)
    {
        EnsureId(doc, e.Data.HabitId);
        var date = DateKey(e.Data.Timestamp);
        doc.CheckIns.RemoveAll(c => c.Id == e.Data.CheckInId);
        doc.CheckIns.Add(new CheckInRef(e.Data.CheckInId, date, e.Data.Skipped));
        RecomputeDay(doc, date);
    }

    public void Apply(IEvent<CheckInMoved> e, HabitComplianceHistory doc)
    {
        EnsureId(doc, e.Data.HabitId);
        var oldDate = DateKey(e.Data.OldTimestamp);
        var newDate = DateKey(e.Data.NewTimestamp);
        var existing = doc.CheckIns.FirstOrDefault(c => c.Id == e.Data.CheckInId);
        var skipped = existing?.Skipped ?? false;

        doc.CheckIns.RemoveAll(c => c.Id == e.Data.CheckInId);
        doc.CheckIns.Add(new CheckInRef(e.Data.CheckInId, newDate, skipped));

        if (oldDate != newDate)
        {
            RecomputeDay(doc, oldDate);
        }
        RecomputeDay(doc, newDate);
    }

    public void Apply(IEvent<CheckInMarkedSkipped> e, HabitComplianceHistory doc)
    {
        UpdateSkipped(doc, e.Data.CheckInId, true);
    }

    public void Apply(IEvent<CheckInMarkedDone> e, HabitComplianceHistory doc)
    {
        UpdateSkipped(doc, e.Data.CheckInId, false);
    }

    public void Apply(IEvent<CheckInDeleted> e, HabitComplianceHistory doc)
    {
        var idx = doc.CheckIns.FindIndex(c => c.Id == e.Data.CheckInId);
        if (idx < 0)
            return;
        var date = doc.CheckIns[idx].Date;
        doc.CheckIns.RemoveAt(idx);
        RecomputeDay(doc, date);
    }

    private static void UpdateSkipped(HabitComplianceHistory doc, Guid checkInId, bool skipped)
    {
        var idx = doc.CheckIns.FindIndex(c => c.Id == checkInId);
        if (idx < 0)
            return;
        var existing = doc.CheckIns[idx];
        if (existing.Skipped == skipped)
            return;
        doc.CheckIns[idx] = existing with { Skipped = skipped };
        RecomputeDay(doc, existing.Date);
    }

    /// <summary>
    /// Sets <see cref="HabitComplianceHistory.Id"/> when Marten created
    /// a fresh doc for this slice — same role as the
    /// <c>EnsureInitialized</c> helpers in <c>PeriodCheckInSummaryProjection</c>.
    /// </summary>
    private static void EnsureId(HabitComplianceHistory doc, Guid habitId)
    {
        if (doc.Id == Guid.Empty)
            doc.Id = habitId;
    }

    private static void AppendEpoch(
        HabitComplianceHistory doc,
        DateTimeOffset effectiveFrom,
        Regularity? regularity,
        int? frequency
    )
    {
        // Replace any epoch with the exact same EffectiveFrom (idempotent
        // re-apply) and any later epoch (out-of-order replay would be a
        // Marten bug, but defending here is cheap).
        doc.GoalTimeline.RemoveAll(g => g.EffectiveFrom >= effectiveFrom);
        doc.GoalTimeline.Add(new GoalEpoch(effectiveFrom, regularity, frequency));
    }

    /// <summary>
    /// Recompute <see cref="DailyCompliance.Done"/>, <see cref="DailyCompliance.Target"/>
    /// and <see cref="DailyCompliance.Status"/> for a single date from
    /// the current <see cref="HabitComplianceHistory.CheckIns"/> and
    /// <see cref="HabitComplianceHistory.GoalTimeline"/>. Inserts or
    /// removes the day row as needed.
    /// </summary>
    private static void RecomputeDay(HabitComplianceHistory doc, string date)
    {
        var done = doc.CheckIns.Count(c => c.Date == date && !c.Skipped);
        var target = TargetForDate(GoalAt(doc, date));
        var status = StatusFor(done, target);

        doc.Days.RemoveAll(d => d.Date == date);
        if (done == 0 && target == 0 && status == ComplianceStatus.NoGoal)
            return; // nothing to record

        doc.Days.Add(new DailyCompliance(date, done, target, status));
        doc.Days.Sort((a, b) => string.Compare(a.Date, b.Date, StringComparison.Ordinal));
    }

    /// <summary>
    /// After a goal-timeline change, the <c>Target</c> and <c>Status</c>
    /// of every existing day may have shifted. Reuses
    /// <see cref="RecomputeDay"/> to keep the rules in one place.
    /// </summary>
    private static void RecomputeStatuses(HabitComplianceHistory doc)
    {
        var dates = doc.Days.Select(d => d.Date).ToList();
        foreach (var date in dates)
        {
            RecomputeDay(doc, date);
        }
    }

    private static GoalEpoch? GoalAt(HabitComplianceHistory doc, string date)
    {
        // GoalTimeline is kept ordered by AppendEpoch; walk from the end
        // to find the latest epoch whose EffectiveFrom is on or before
        // this date.
        var dayStart = ParseDateUtc(date);
        for (var i = doc.GoalTimeline.Count - 1; i >= 0; i--)
        {
            var epoch = doc.GoalTimeline[i];
            if (epoch.EffectiveFrom <= dayStart.AddDays(1))
                return epoch;
        }
        return null;
    }

    private static int TargetForDate(GoalEpoch? goal)
    {
        if (goal is null || goal.Regularity is null)
            return 0;
        // Per-day targets only apply to daily-regularity goals. Weekly
        // and monthly goals leave Target = 0 and the status falls
        // through to Logged / NoGoal — see the doc class summary.
        return goal.Regularity == Regularity.Day ? goal.Frequency ?? 0 : 0;
    }

    private static ComplianceStatus StatusFor(int done, int target)
    {
        if (target > 0)
        {
            if (done >= target)
                return ComplianceStatus.OnTrack;
            if (done > 0)
                return ComplianceStatus.Partial;
            return ComplianceStatus.Missed;
        }
        return done > 0 ? ComplianceStatus.Logged : ComplianceStatus.NoGoal;
    }

    private static string DateKey(DateTimeOffset timestamp)
    {
        var utc = timestamp.UtcDateTime;
        return $"{utc.Year:D4}-{utc.Month:D2}-{utc.Day:D2}";
    }

    private static DateTimeOffset ParseDateUtc(string date)
    {
        var year = int.Parse(date.AsSpan(0, 4));
        var month = int.Parse(date.AsSpan(5, 2));
        var day = int.Parse(date.AsSpan(8, 2));
        return new DateTimeOffset(year, month, day, 0, 0, 0, TimeSpan.Zero);
    }
}
