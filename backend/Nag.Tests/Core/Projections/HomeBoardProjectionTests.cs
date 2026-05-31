using Nag.Core;
using Nag.Core.Domain;
using Nag.Core.Events;
using Nag.Core.ReadModels;
using Nag.Tests.Infrastructure;
using Shouldly;
using Xunit;

namespace Nag.Tests.Core.Projections;

[Collection(PostgresCollection.Name)]
public class HomeBoardProjectionTests
{
    private readonly PostgresFixture _fixture;

    public HomeBoardProjectionTests(PostgresFixture fixture) => _fixture = fixture;

    public class HabitCreated_runs_inline : HomeBoardProjectionTests
    {
        public HabitCreated_runs_inline(PostgresFixture fixture)
            : base(fixture) { }

        [Fact]
        public async Task adds_habit_to_board()
        {
            await using var store = _fixture.CreateStore("proj_create");
            await using var session = store.LightweightSession();

            var habitId = Guid.NewGuid();
            session.Events.Append(NagStreams.Root, new HabitCreated(habitId, "Read"));
            await session.SaveChangesAsync();

            var board = await session.LoadAsync<HomeBoard>(NagStreams.Root);
            board.ShouldNotBeNull();
            board!.Habits.ShouldHaveSingleItem();
            board.Habits[0].Id.ShouldBe(habitId);
            board.Habits[0].Title.ShouldBe("Read");
        }
    }

    public class HabitDetailsEdited_replaces_in_place : HomeBoardProjectionTests
    {
        public HabitDetailsEdited_replaces_in_place(PostgresFixture fixture)
            : base(fixture) { }

        [Fact]
        public async Task title_updated()
        {
            await using var store = _fixture.CreateStore("proj_update");
            await using var session = store.LightweightSession();

            var habitId = Guid.NewGuid();
            session.Events.Append(
                NagStreams.Root,
                new HabitCreated(habitId, "Read"),
                new HabitDetailsEdited(habitId, Title: "Read more")
            );
            await session.SaveChangesAsync();

            var board = await session.LoadAsync<HomeBoard>(NagStreams.Root);
            board!.Habits[0].Title.ShouldBe("Read more");
        }
    }

    public class HabitDeleted_removes_it : HomeBoardProjectionTests
    {
        public HabitDeleted_removes_it(PostgresFixture fixture)
            : base(fixture) { }

        [Fact]
        public async Task habit_gone_from_board()
        {
            await using var store = _fixture.CreateStore("proj_delete");
            await using var session = store.LightweightSession();

            var habitId = Guid.NewGuid();
            session.Events.Append(
                NagStreams.Root,
                new HabitCreated(habitId, "Read"),
                new HabitDeleted(habitId)
            );
            await session.SaveChangesAsync();

            var board = await session.LoadAsync<HomeBoard>(NagStreams.Root);
            board!.Habits.ShouldBeEmpty();
        }
    }

    public class Archive_and_pause_flags : HomeBoardProjectionTests
    {
        public Archive_and_pause_flags(PostgresFixture fixture)
            : base(fixture) { }

        [Fact]
        public async Task archive_sets_archivedAt()
        {
            await using var store = _fixture.CreateStore("proj_archive");
            await using var session = store.LightweightSession();

            var habitId = Guid.NewGuid();
            session.Events.Append(
                NagStreams.Root,
                new HabitCreated(habitId, "Read"),
                new HabitArchived(habitId)
            );
            await session.SaveChangesAsync();

            var board = await session.LoadAsync<HomeBoard>(NagStreams.Root);
            board!.Habits[0].ArchivedAt.ShouldNotBeNull();
        }

        [Fact]
        public async Task pause_sets_pausedAt()
        {
            await using var store = _fixture.CreateStore("proj_pause");
            await using var session = store.LightweightSession();

            var habitId = Guid.NewGuid();
            session.Events.Append(
                NagStreams.Root,
                new HabitCreated(habitId, "Read"),
                new HabitPaused(habitId)
            );
            await session.SaveChangesAsync();

            var board = await session.LoadAsync<HomeBoard>(NagStreams.Root);
            board!.Habits[0].PausedAt.ShouldNotBeNull();
        }

        [Fact]
        public async Task unpause_clears_pausedAt()
        {
            await using var store = _fixture.CreateStore("proj_unpause");
            await using var session = store.LightweightSession();

            var habitId = Guid.NewGuid();
            session.Events.Append(
                NagStreams.Root,
                new HabitCreated(habitId, "Read"),
                new HabitPaused(habitId),
                new HabitUnpaused(habitId)
            );
            await session.SaveChangesAsync();

            var board = await session.LoadAsync<HomeBoard>(NagStreams.Root);
            board!.Habits[0].PausedAt.ShouldBeNull();
        }

        [Fact]
        public async Task unarchive_clears_both_flags()
        {
            await using var store = _fixture.CreateStore("proj_unarchive");
            await using var session = store.LightweightSession();

            var habitId = Guid.NewGuid();
            session.Events.Append(
                NagStreams.Root,
                new HabitCreated(habitId, "Read"),
                new HabitPaused(habitId),
                new HabitArchived(habitId),
                new HabitUnarchived(habitId)
            );
            await session.SaveChangesAsync();

            var board = await session.LoadAsync<HomeBoard>(NagStreams.Root);
            board!.Habits[0].ArchivedAt.ShouldBeNull();
            board.Habits[0].PausedAt.ShouldBeNull();
        }
    }

    public class CheckInRecorded_appends_to_period : HomeBoardProjectionTests
    {
        public CheckInRecorded_appends_to_period(PostgresFixture fixture)
            : base(fixture) { }

        [Fact]
        public async Task check_in_appears_in_periodCheckIns()
        {
            await using var store = _fixture.CreateStore("proj_check_in");
            await using var session = store.LightweightSession();

            var habitId = Guid.NewGuid();
            var checkInId = Guid.NewGuid();
            session.Events.Append(
                NagStreams.Root,
                new HabitCreated(habitId, "Read", Goal: new GoalPayload(Regularity.Day, 1)),
                new CheckInRecorded(checkInId, habitId, DateTimeOffset.UtcNow)
            );
            await session.SaveChangesAsync();

            var board = await session.LoadAsync<HomeBoard>(NagStreams.Root);
            board!.Habits[0].PeriodCheckIns.ShouldHaveSingleItem();
            board.Habits[0].PeriodCheckIns[0].Id.ShouldBe(checkInId);
        }
    }
}
