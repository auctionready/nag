using Nag.Core;
using Nag.Core.Domain;
using Nag.Core.Events;
using Nag.Core.ReadModels;
using Nag.Tests.Infrastructure;
using Shouldly;
using Xunit;

namespace Nag.Tests.Core.Projections;

[Collection(PostgresCollection.Name)]
public class CheckInSummaryProjectionTests
{
    private readonly PostgresFixture _fixture;

    public CheckInSummaryProjectionTests(PostgresFixture fixture) => _fixture = fixture;

    public class Monthly_summary_is_keyed_by_year_month : CheckInSummaryProjectionTests
    {
        public Monthly_summary_is_keyed_by_year_month(PostgresFixture fixture)
            : base(fixture) { }

        [Fact]
        public async Task single_check_in_lands_in_the_right_month_doc()
        {
            await using var store = _fixture.CreateStore("proj_monthly_single");
            await using var session = store.LightweightSession();

            var habitId = Guid.NewGuid();
            var checkInId = Guid.NewGuid();
            var ts = new DateTimeOffset(2026, 4, 27, 12, 0, 0, TimeSpan.Zero);
            session.Events.Append(
                NagStreams.Root,
                new HabitCreated(habitId, "Read", Goal: new GoalPayload(Regularity.Day, 1)),
                new CheckInRecorded(checkInId, habitId, ts)
            );
            await session.SaveChangesAsync();

            var monthly = await session.LoadAsync<MonthlyCheckInSummary>("2026-04");
            monthly.ShouldNotBeNull();
            monthly!.MonthStart.ShouldBe(new DateTimeOffset(2026, 4, 1, 0, 0, 0, TimeSpan.Zero));
            monthly.Habits.ShouldHaveSingleItem();
            monthly.Habits[0].HabitId.ShouldBe(habitId);
            monthly.Habits[0].CheckIns.ShouldHaveSingleItem();
            monthly.Habits[0].CheckIns[0].Id.ShouldBe(checkInId);
            monthly.Habits[0].CheckIns[0].Timestamp.ShouldBe(ts);
        }
    }

    public class Monthly_summary_partitions_by_month : CheckInSummaryProjectionTests
    {
        public Monthly_summary_partitions_by_month(PostgresFixture fixture)
            : base(fixture) { }

        [Fact]
        public async Task two_months_produce_two_docs()
        {
            await using var store = _fixture.CreateStore("proj_monthly_partition");
            await using var session = store.LightweightSession();

            var habitId = Guid.NewGuid();
            session.Events.Append(
                NagStreams.Root,
                new HabitCreated(habitId, "Read", Goal: new GoalPayload(Regularity.Day, 1)),
                new CheckInRecorded(
                    Guid.NewGuid(),
                    habitId,
                    new DateTimeOffset(2026, 3, 15, 10, 0, 0, TimeSpan.Zero)
                ),
                new CheckInRecorded(
                    Guid.NewGuid(),
                    habitId,
                    new DateTimeOffset(2026, 4, 15, 10, 0, 0, TimeSpan.Zero)
                )
            );
            await session.SaveChangesAsync();

            var march = await session.LoadAsync<MonthlyCheckInSummary>("2026-03");
            var april = await session.LoadAsync<MonthlyCheckInSummary>("2026-04");
            march.ShouldNotBeNull();
            april.ShouldNotBeNull();
            march!.Habits[0].CheckIns.ShouldHaveSingleItem();
            april!.Habits[0].CheckIns.ShouldHaveSingleItem();
        }
    }

    public class Monthly_summary_groups_multiple_habits : CheckInSummaryProjectionTests
    {
        public Monthly_summary_groups_multiple_habits(PostgresFixture fixture)
            : base(fixture) { }

        [Fact]
        public async Task each_habit_has_its_own_entry()
        {
            await using var store = _fixture.CreateStore("proj_monthly_multi_habit");
            await using var session = store.LightweightSession();

            var habitA = Guid.NewGuid();
            var habitB = Guid.NewGuid();
            var ts = new DateTimeOffset(2026, 4, 10, 0, 0, 0, TimeSpan.Zero);
            session.Events.Append(
                NagStreams.Root,
                new HabitCreated(habitA, "A", Goal: new GoalPayload(Regularity.Day, 1)),
                new HabitCreated(habitB, "B", Goal: new GoalPayload(Regularity.Day, 1)),
                new CheckInRecorded(Guid.NewGuid(), habitA, ts),
                new CheckInRecorded(Guid.NewGuid(), habitB, ts.AddHours(1)),
                new CheckInRecorded(Guid.NewGuid(), habitA, ts.AddDays(1))
            );
            await session.SaveChangesAsync();

            var doc = await session.LoadAsync<MonthlyCheckInSummary>("2026-04");
            doc.ShouldNotBeNull();
            doc!.Habits.Count.ShouldBe(2);
            doc.Habits.Single(h => h.HabitId == habitA).CheckIns.Count.ShouldBe(2);
            doc.Habits.Single(h => h.HabitId == habitB).CheckIns.Count.ShouldBe(1);
        }
    }

    public class Weekly_summary_is_anchored_to_monday : CheckInSummaryProjectionTests
    {
        public Weekly_summary_is_anchored_to_monday(PostgresFixture fixture)
            : base(fixture) { }

        [Fact]
        public async Task check_ins_in_one_week_collapse_to_one_doc()
        {
            await using var store = _fixture.CreateStore("proj_weekly_anchor");
            await using var session = store.LightweightSession();

            var habitId = Guid.NewGuid();
            // Monday 2026-04-20 starts a week; Tuesday and Sunday after it
            // are the same week. Monday 2026-04-27 starts the next.
            session.Events.Append(
                NagStreams.Root,
                new HabitCreated(habitId, "Read", Goal: new GoalPayload(Regularity.Day, 1)),
                new CheckInRecorded(
                    Guid.NewGuid(),
                    habitId,
                    new DateTimeOffset(2026, 4, 20, 8, 0, 0, TimeSpan.Zero)
                ),
                new CheckInRecorded(
                    Guid.NewGuid(),
                    habitId,
                    new DateTimeOffset(2026, 4, 21, 8, 0, 0, TimeSpan.Zero)
                ),
                new CheckInRecorded(
                    Guid.NewGuid(),
                    habitId,
                    new DateTimeOffset(2026, 4, 26, 8, 0, 0, TimeSpan.Zero)
                ),
                new CheckInRecorded(
                    Guid.NewGuid(),
                    habitId,
                    new DateTimeOffset(2026, 4, 27, 8, 0, 0, TimeSpan.Zero)
                )
            );
            await session.SaveChangesAsync();

            var firstWeek = await session.LoadAsync<WeeklyCheckInSummary>("2026-04-20");
            var secondWeek = await session.LoadAsync<WeeklyCheckInSummary>("2026-04-27");
            firstWeek.ShouldNotBeNull();
            secondWeek.ShouldNotBeNull();
            firstWeek!.Habits[0].CheckIns.Count.ShouldBe(3);
            secondWeek!.Habits[0].CheckIns.Count.ShouldBe(1);
            firstWeek.WeekStart.ShouldBe(new DateTimeOffset(2026, 4, 20, 0, 0, 0, TimeSpan.Zero));
        }
    }

    public class CheckInMoved_within_same_period_patches_in_place : CheckInSummaryProjectionTests
    {
        public CheckInMoved_within_same_period_patches_in_place(PostgresFixture fixture)
            : base(fixture) { }

        [Fact]
        public async Task timestamp_updates_in_existing_doc()
        {
            await using var store = _fixture.CreateStore("proj_monthly_update");
            await using var session = store.LightweightSession();

            var habitId = Guid.NewGuid();
            var checkInId = Guid.NewGuid();
            var oldTs = new DateTimeOffset(2026, 4, 10, 8, 0, 0, TimeSpan.Zero);
            var newTs = new DateTimeOffset(2026, 4, 10, 18, 0, 0, TimeSpan.Zero);
            session.Events.Append(
                NagStreams.Root,
                new HabitCreated(habitId, "Read", Goal: new GoalPayload(Regularity.Day, 1)),
                new CheckInRecorded(checkInId, habitId, oldTs),
                new CheckInMoved(checkInId, habitId, oldTs, newTs)
            );
            await session.SaveChangesAsync();

            var doc = await session.LoadAsync<MonthlyCheckInSummary>("2026-04");
            doc.ShouldNotBeNull();
            doc!.Habits[0].CheckIns.ShouldHaveSingleItem();
            doc.Habits[0].CheckIns[0].Timestamp.ShouldBe(newTs);
        }
    }

    public class CheckInMoved_across_months : CheckInSummaryProjectionTests
    {
        public CheckInMoved_across_months(PostgresFixture fixture)
            : base(fixture) { }

        [Fact]
        public async Task removes_from_old_month_and_inserts_into_new()
        {
            await using var store = _fixture.CreateStore("proj_cross_month");
            await using var session = store.LightweightSession();

            var habitId = Guid.NewGuid();
            var checkInId = Guid.NewGuid();
            var oldTs = new DateTimeOffset(2026, 3, 28, 8, 0, 0, TimeSpan.Zero);
            var newTs = new DateTimeOffset(2026, 4, 2, 8, 0, 0, TimeSpan.Zero);
            session.Events.Append(
                NagStreams.Root,
                new HabitCreated(habitId, "Read", Goal: new GoalPayload(Regularity.Day, 1)),
                new CheckInRecorded(checkInId, habitId, oldTs),
                new CheckInMoved(checkInId, habitId, oldTs, newTs)
            );
            await session.SaveChangesAsync();

            var march = await session.LoadAsync<MonthlyCheckInSummary>("2026-03");
            var april = await session.LoadAsync<MonthlyCheckInSummary>("2026-04");
            march.ShouldNotBeNull();
            april.ShouldNotBeNull();
            // March's stale row should be removed, April should hold the new ts.
            march!.Habits.SelectMany(h => h.CheckIns).ShouldNotContain(c => c.Id == checkInId);
            april!
                .Habits.Single(h => h.HabitId == habitId)
                .CheckIns.Single(c => c.Id == checkInId)
                .Timestamp.ShouldBe(newTs);
        }
    }

    public class CheckInDeleted_removes_from_summary : CheckInSummaryProjectionTests
    {
        public CheckInDeleted_removes_from_summary(PostgresFixture fixture)
            : base(fixture) { }

        [Fact]
        public async Task summary_no_longer_lists_the_check_in()
        {
            await using var store = _fixture.CreateStore("proj_delete_checkin");
            await using var session = store.LightweightSession();

            var habitId = Guid.NewGuid();
            var checkInId = Guid.NewGuid();
            var ts = new DateTimeOffset(2026, 4, 15, 8, 0, 0, TimeSpan.Zero);
            session.Events.Append(
                NagStreams.Root,
                new HabitCreated(habitId, "Read", Goal: new GoalPayload(Regularity.Day, 1)),
                new CheckInRecorded(checkInId, habitId, ts),
                new CheckInDeleted(checkInId, habitId, ts)
            );
            await session.SaveChangesAsync();

            var doc = await session.LoadAsync<MonthlyCheckInSummary>("2026-04");
            doc.ShouldNotBeNull();
            doc!.Habits.SelectMany(h => h.CheckIns).ShouldNotContain(c => c.Id == checkInId);
        }
    }

    public class CheckInMarkedSkipped_updates_skipped_flag : CheckInSummaryProjectionTests
    {
        public CheckInMarkedSkipped_updates_skipped_flag(PostgresFixture fixture)
            : base(fixture) { }

        [Fact]
        public async Task skipped_flips_to_true()
        {
            await using var store = _fixture.CreateStore("proj_skip");
            await using var session = store.LightweightSession();

            var habitId = Guid.NewGuid();
            var checkInId = Guid.NewGuid();
            var ts = new DateTimeOffset(2026, 4, 15, 8, 0, 0, TimeSpan.Zero);
            session.Events.Append(
                NagStreams.Root,
                new HabitCreated(habitId, "Read", Goal: new GoalPayload(Regularity.Day, 1)),
                new CheckInRecorded(checkInId, habitId, ts),
                new CheckInMarkedSkipped(checkInId, habitId, ts)
            );
            await session.SaveChangesAsync();

            var doc = await session.LoadAsync<MonthlyCheckInSummary>("2026-04");
            doc!.Habits[0].CheckIns.Single(c => c.Id == checkInId).Skipped.ShouldBeTrue();
        }
    }
}
