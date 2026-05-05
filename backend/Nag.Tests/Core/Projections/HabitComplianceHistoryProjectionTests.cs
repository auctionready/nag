using Nag.Core;
using Nag.Core.Domain;
using Nag.Core.Events;
using Nag.Core.ReadModels;
using Nag.Tests.Infrastructure;
using Shouldly;
using Xunit;

namespace Nag.Tests.Core.Projections;

[Collection(PostgresCollection.Name)]
public class HabitComplianceHistoryProjectionTests
{
    private readonly PostgresFixture _fixture;

    public HabitComplianceHistoryProjectionTests(PostgresFixture fixture) => _fixture = fixture;

    public class Daily_goal_drives_per_day_status : HabitComplianceHistoryProjectionTests
    {
        public Daily_goal_drives_per_day_status(PostgresFixture fixture)
            : base(fixture) { }

        [Fact]
        public async Task on_track_when_done_meets_target()
        {
            await using var store = _fixture.CreateStore("proj_compliance_daily_on_track");
            await using var session = store.LightweightSession();

            var habitId = Guid.NewGuid();
            var dayStart = new DateTimeOffset(2026, 4, 27, 8, 0, 0, TimeSpan.Zero);
            session.Events.Append(
                NagStreams.Root,
                new HabitCreated(habitId, "Read", Goal: new GoalPayload(Regularity.Day, 2)),
                new CheckInRecorded(Guid.NewGuid(), habitId, dayStart),
                new CheckInRecorded(Guid.NewGuid(), habitId, dayStart.AddHours(2))
            );
            await session.SaveChangesAsync();

            var doc = await session.LoadAsync<HabitComplianceHistory>(habitId);
            doc.ShouldNotBeNull();
            doc!.Days.ShouldHaveSingleItem();
            var day = doc.Days[0];
            day.Date.ShouldBe("2026-04-27");
            day.Done.ShouldBe(2);
            day.Target.ShouldBe(2);
            day.Status.ShouldBe(ComplianceStatus.OnTrack);
        }

        [Fact]
        public async Task partial_when_some_done_but_below_target()
        {
            await using var store = _fixture.CreateStore("proj_compliance_daily_partial");
            await using var session = store.LightweightSession();

            var habitId = Guid.NewGuid();
            var ts = new DateTimeOffset(2026, 4, 27, 9, 0, 0, TimeSpan.Zero);
            session.Events.Append(
                NagStreams.Root,
                new HabitCreated(habitId, "Read", Goal: new GoalPayload(Regularity.Day, 3)),
                new CheckInRecorded(Guid.NewGuid(), habitId, ts)
            );
            await session.SaveChangesAsync();

            var doc = await session.LoadAsync<HabitComplianceHistory>(habitId);
            doc!.Days[0].Status.ShouldBe(ComplianceStatus.Partial);
            doc.Days[0].Done.ShouldBe(1);
            doc.Days[0].Target.ShouldBe(3);
        }

        [Fact]
        public async Task skipped_check_in_does_not_count_toward_done()
        {
            await using var store = _fixture.CreateStore("proj_compliance_skipped");
            await using var session = store.LightweightSession();

            var habitId = Guid.NewGuid();
            var ts = new DateTimeOffset(2026, 4, 27, 9, 0, 0, TimeSpan.Zero);
            session.Events.Append(
                NagStreams.Root,
                new HabitCreated(habitId, "Read", Goal: new GoalPayload(Regularity.Day, 1)),
                new CheckInRecorded(Guid.NewGuid(), habitId, ts, Skipped: true)
            );
            await session.SaveChangesAsync();

            var doc = await session.LoadAsync<HabitComplianceHistory>(habitId);
            doc!.Days[0].Done.ShouldBe(0);
            doc.Days[0].Status.ShouldBe(ComplianceStatus.Missed);
        }
    }

    public class Skip_toggles_recompute_done : HabitComplianceHistoryProjectionTests
    {
        public Skip_toggles_recompute_done(PostgresFixture fixture)
            : base(fixture) { }

        [Fact]
        public async Task marking_done_then_skipped_then_done_lands_on_done()
        {
            await using var store = _fixture.CreateStore("proj_compliance_skip_toggle");
            await using var session = store.LightweightSession();

            var habitId = Guid.NewGuid();
            var checkInId = Guid.NewGuid();
            var ts = new DateTimeOffset(2026, 4, 27, 9, 0, 0, TimeSpan.Zero);
            session.Events.Append(
                NagStreams.Root,
                new HabitCreated(habitId, "Read", Goal: new GoalPayload(Regularity.Day, 1)),
                new CheckInRecorded(checkInId, habitId, ts),
                new CheckInMarkedSkipped(checkInId, habitId, ts),
                new CheckInMarkedDone(checkInId, habitId, ts)
            );
            await session.SaveChangesAsync();

            var doc = await session.LoadAsync<HabitComplianceHistory>(habitId);
            doc!.Days[0].Done.ShouldBe(1);
            doc.Days[0].Status.ShouldBe(ComplianceStatus.OnTrack);
        }
    }

    public class Cross_day_move_shifts_done : HabitComplianceHistoryProjectionTests
    {
        public Cross_day_move_shifts_done(PostgresFixture fixture)
            : base(fixture) { }

        [Fact]
        public async Task move_decrements_old_day_and_increments_new_day()
        {
            await using var store = _fixture.CreateStore("proj_compliance_move");
            await using var session = store.LightweightSession();

            var habitId = Guid.NewGuid();
            var checkInId = Guid.NewGuid();
            var oldTs = new DateTimeOffset(2026, 4, 27, 9, 0, 0, TimeSpan.Zero);
            var newTs = new DateTimeOffset(2026, 4, 28, 9, 0, 0, TimeSpan.Zero);
            session.Events.Append(
                NagStreams.Root,
                new HabitCreated(habitId, "Read", Goal: new GoalPayload(Regularity.Day, 1)),
                new CheckInRecorded(checkInId, habitId, oldTs),
                new CheckInMoved(checkInId, habitId, oldTs, newTs)
            );
            await session.SaveChangesAsync();

            var doc = await session.LoadAsync<HabitComplianceHistory>(habitId);
            doc.ShouldNotBeNull();
            var byDate = doc!.Days.ToDictionary(d => d.Date);
            // Old date kept (Missed) so the strip still shows the gap.
            byDate["2026-04-27"].Done.ShouldBe(0);
            byDate["2026-04-27"].Status.ShouldBe(ComplianceStatus.Missed);
            byDate["2026-04-28"].Done.ShouldBe(1);
            byDate["2026-04-28"].Status.ShouldBe(ComplianceStatus.OnTrack);
        }
    }

    public class Delete_removes_from_done : HabitComplianceHistoryProjectionTests
    {
        public Delete_removes_from_done(PostgresFixture fixture)
            : base(fixture) { }

        [Fact]
        public async Task deleted_check_in_drops_done()
        {
            await using var store = _fixture.CreateStore("proj_compliance_delete");
            await using var session = store.LightweightSession();

            var habitId = Guid.NewGuid();
            var checkInId = Guid.NewGuid();
            var ts = new DateTimeOffset(2026, 4, 27, 9, 0, 0, TimeSpan.Zero);
            session.Events.Append(
                NagStreams.Root,
                new HabitCreated(habitId, "Read", Goal: new GoalPayload(Regularity.Day, 1)),
                new CheckInRecorded(checkInId, habitId, ts),
                new CheckInDeleted(checkInId, habitId, ts)
            );
            await session.SaveChangesAsync();

            var doc = await session.LoadAsync<HabitComplianceHistory>(habitId);
            // Day still recorded with Missed because the goal targets it.
            doc!.Days[0].Done.ShouldBe(0);
            doc.Days[0].Status.ShouldBe(ComplianceStatus.Missed);
        }
    }

    public class Goal_changes_recompute_existing_days : HabitComplianceHistoryProjectionTests
    {
        public Goal_changes_recompute_existing_days(PostgresFixture fixture)
            : base(fixture) { }

        [Fact]
        public async Task initial_goal_is_retroactive_and_later_changes_anchor_forward()
        {
            await using var store = _fixture.CreateStore("proj_compliance_goal_change");
            await using var session = store.LightweightSession();

            var habitId = Guid.NewGuid();
            // Past check-in — should be evaluated against the goal the
            // habit was created with (initial epoch is retroactive).
            var pastTs = new DateTimeOffset(2026, 4, 27, 9, 0, 0, TimeSpan.Zero);
            session.Events.Append(
                NagStreams.Root,
                new HabitCreated(habitId, "Read", Goal: new GoalPayload(Regularity.Day, 3)),
                new CheckInRecorded(Guid.NewGuid(), habitId, pastTs)
            );
            await session.SaveChangesAsync();

            var doc = await session.LoadAsync<HabitComplianceHistory>(habitId);
            doc!.Days[0].Target.ShouldBe(3);
            doc.Days[0].Status.ShouldBe(ComplianceStatus.Partial);
            doc.GoalTimeline.ShouldHaveSingleItem();
            doc.GoalTimeline[0].EffectiveFrom.ShouldBe(DateTimeOffset.MinValue);

            // Goal change appends a forward-anchored epoch (EffectiveFrom
            // = event timestamp). Check-ins on past dates keep the
            // original goal; check-ins after the change pick up the new
            // goal in subsequent recomputes.
            session.Events.Append(NagStreams.Root, new HabitGoalCleared(habitId));
            await session.SaveChangesAsync();

            var doc2 = await session.LoadAsync<HabitComplianceHistory>(habitId);
            doc2!.GoalTimeline.Count.ShouldBe(2);
            doc2.GoalTimeline[1].Regularity.ShouldBeNull();
            // Past day still uses the original goal (its date precedes
            // the cleared-epoch's EffectiveFrom).
            doc2.Days[0].Target.ShouldBe(3);
        }
    }

    public class Weekly_goal_uses_logged_status : HabitComplianceHistoryProjectionTests
    {
        public Weekly_goal_uses_logged_status(PostgresFixture fixture)
            : base(fixture) { }

        [Fact]
        public async Task weekly_goal_day_with_check_in_is_logged()
        {
            await using var store = _fixture.CreateStore("proj_compliance_weekly_logged");
            await using var session = store.LightweightSession();

            var habitId = Guid.NewGuid();
            var ts = new DateTimeOffset(2026, 4, 27, 9, 0, 0, TimeSpan.Zero);
            session.Events.Append(
                NagStreams.Root,
                new HabitCreated(habitId, "Run", Goal: new GoalPayload(Regularity.Week, 3)),
                new CheckInRecorded(Guid.NewGuid(), habitId, ts)
            );
            await session.SaveChangesAsync();

            var doc = await session.LoadAsync<HabitComplianceHistory>(habitId);
            doc!.Days[0].Target.ShouldBe(0);
            doc.Days[0].Done.ShouldBe(1);
            doc.Days[0].Status.ShouldBe(ComplianceStatus.Logged);
        }
    }

    public class Doc_id_matches_habit_id : HabitComplianceHistoryProjectionTests
    {
        public Doc_id_matches_habit_id(PostgresFixture fixture)
            : base(fixture) { }

        [Fact]
        public async Task each_habit_gets_its_own_doc()
        {
            await using var store = _fixture.CreateStore("proj_compliance_doc_per_habit");
            await using var session = store.LightweightSession();

            var habitA = Guid.NewGuid();
            var habitB = Guid.NewGuid();
            var ts = new DateTimeOffset(2026, 4, 27, 9, 0, 0, TimeSpan.Zero);
            session.Events.Append(
                NagStreams.Root,
                new HabitCreated(habitA, "A", Goal: new GoalPayload(Regularity.Day, 1)),
                new HabitCreated(habitB, "B", Goal: new GoalPayload(Regularity.Day, 1)),
                new CheckInRecorded(Guid.NewGuid(), habitA, ts)
            );
            await session.SaveChangesAsync();

            var docA = await session.LoadAsync<HabitComplianceHistory>(habitA);
            var docB = await session.LoadAsync<HabitComplianceHistory>(habitB);
            docA.ShouldNotBeNull();
            docB.ShouldNotBeNull();
            docA!.Id.ShouldBe(habitA);
            docB!.Id.ShouldBe(habitB);
            docA.Days.ShouldHaveSingleItem();
            docB.Days.ShouldBeEmpty();
        }
    }
}
